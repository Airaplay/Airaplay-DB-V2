/*
  # Add Admin Badge Upload Storage Policy

  ## Problem Summary
  Admin users cannot upload verified badge images because the thumbnails storage bucket
  only allows uploads to user-specific folders (/{user_id}/...), but badge uploads need
  to go to /badges/ folder which doesn't match any individual user ID pattern.

  ## Root Cause
  The existing storage policy on line 71 of the thumbnails bucket creation requires:
  (storage.foldername(name))[1] = auth.uid()::text
  
  This means uploads must be to {user_id}/... paths, but badge upload uses badges/... path.

  ## Solution
  Add a new RLS policy specifically for admin users that allows uploads to badges/ folder
  while maintaining existing user-specific folder restrictions for regular users.

  ## Security Model
  - Regular users can only upload to their own folder: /{user_id}/...
  - Admin users can also upload to badges/ folder for system-wide badge management
  - All users can read all thumbnails (public access)
  - Only file owners can update/delete their own files

  ## Scope
  - Table: storage.objects
  - Bucket: thumbnails
  - Operation: INSERT and UPDATE for badges/ folder
  - Admin verification: Check users table for role='admin' and is_active=true
*/

-- ============================================================================
-- Add new policies for admin badge uploads
-- ============================================================================

-- Policy: Admins can upload badge images to badges/ folder
-- This policy allows admins to insert files into the badges/ folder
CREATE POLICY "Admins can upload badges"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'thumbnails'
  AND (
    -- Option 1: Regular users can upload to their own folder
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Option 2: Admins can upload to badges/ folder
    (
      (storage.foldername(name))[1] = 'badges'
      AND EXISTS (
        SELECT 1 FROM public.users
        WHERE public.users.id = auth.uid()
          AND public.users.role = 'admin'
          AND public.users.is_active = true
      )
    )
  )
);

-- Policy: Admins can update badge images in badges/ folder
-- This policy allows admins to update files in the badges/ folder
CREATE POLICY "Admins can update badges"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'thumbnails'
  AND (
    -- Option 1: Regular users can update their own folder
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Option 2: Admins can update badges/ folder
    (
      (storage.foldername(name))[1] = 'badges'
      AND EXISTS (
        SELECT 1 FROM public.users
        WHERE public.users.id = auth.uid()
          AND public.users.role = 'admin'
          AND public.users.is_active = true
      )
    )
  )
)
WITH CHECK (
  bucket_id = 'thumbnails'
  AND (
    -- Option 1: Regular users can update their own folder
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Option 2: Admins can update badges/ folder
    (
      (storage.foldername(name))[1] = 'badges'
      AND EXISTS (
        SELECT 1 FROM public.users
        WHERE public.users.id = auth.uid()
          AND public.users.role = 'admin'
          AND public.users.is_active = true
      )
    )
  )
);

-- Policy: Admins can delete badge images in badges/ folder
-- This policy allows admins to delete files in the badges/ folder
CREATE POLICY "Admins can delete badges"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'thumbnails'
  AND (
    -- Option 1: Regular users can delete their own folder
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Option 2: Admins can delete badges/ folder
    (
      (storage.foldername(name))[1] = 'badges'
      AND EXISTS (
        SELECT 1 FROM public.users
        WHERE public.users.id = auth.uid()
          AND public.users.role = 'admin'
          AND public.users.is_active = true
      )
    )
  )
);
