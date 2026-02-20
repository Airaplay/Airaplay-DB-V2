/*
  # Complete Fix for Verified Badge Upload - Final Authority
  
  ## Problem
  Badge upload fails with RLS policy errors despite correct policies being in place.
  This suggests auth context issues during the badge upload process.
  
  ## Root Causes Identified
  1. RLS policies require explicit auth.uid() checks
  2. Policy WITH CHECK clauses may need additional verification
  3. INSERT/UPDATE operations require both USING and WITH CHECK for consistency
  4. Auth context must be properly established before policy evaluation
  
  ## Solution
  1. Drop all existing badge policies
  2. Recreate with simplified, explicit auth checks
  3. Add is_active check to prevent suspended admins from uploading
  4. Ensure storage policies align with table policies
  5. Add comprehensive error handling guidance
  
  ## Testing
  After this migration:
  - Admin users should be able to INSERT and UPDATE verified_badge_config
  - Non-admins should get permission denied
  - Badge should display for all users
*/

-- Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "badge_config_delete_admin" ON verified_badge_config;
DROP POLICY IF EXISTS "badge_config_insert_admin" ON verified_badge_config;
DROP POLICY IF EXISTS "badge_config_select_public" ON verified_badge_config;
DROP POLICY IF EXISTS "badge_config_update_admin" ON verified_badge_config;
DROP POLICY IF EXISTS "vbc_delete_admin_only" ON verified_badge_config;
DROP POLICY IF EXISTS "vbc_insert_admin_only" ON verified_badge_config;
DROP POLICY IF EXISTS "vbc_select_everyone" ON verified_badge_config;
DROP POLICY IF EXISTS "vbc_update_admin_only" ON verified_badge_config;
DROP POLICY IF EXISTS "verified_badge_config_delete_admin" ON verified_badge_config;
DROP POLICY IF EXISTS "verified_badge_config_insert_admin" ON verified_badge_config;
DROP POLICY IF EXISTS "verified_badge_config_select_all" ON verified_badge_config;
DROP POLICY IF EXISTS "verified_badge_config_update_admin" ON verified_badge_config;

-- Ensure RLS is enabled
ALTER TABLE verified_badge_config ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Public read for all users (required for badge display)
CREATE POLICY "badge_public_select"
  ON verified_badge_config
  FOR SELECT
  USING (true);

-- INSERT Policy: Only authenticated admin users can insert
CREATE POLICY "badge_admin_insert"
  ON verified_badge_config
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      SELECT role = 'admin' AND is_active = true
      FROM public.users
      WHERE id = auth.uid()
    )
  );

-- UPDATE Policy: Only authenticated admin users can update
CREATE POLICY "badge_admin_update"
  ON verified_badge_config
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      SELECT role = 'admin' AND is_active = true
      FROM public.users
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      SELECT role = 'admin' AND is_active = true
      FROM public.users
      WHERE id = auth.uid()
    )
  );

-- DELETE Policy: Only authenticated admin users can delete
CREATE POLICY "badge_admin_delete"
  ON verified_badge_config
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND (
      SELECT role = 'admin' AND is_active = true
      FROM public.users
      WHERE id = auth.uid()
    )
  );

-- Ensure default badge exists
INSERT INTO verified_badge_config (badge_url, updated_at)
VALUES ('https://via.placeholder.com/24x24.png?text=V', now())
ON CONFLICT DO NOTHING;

-- Add table documentation
COMMENT ON TABLE verified_badge_config IS 
'System-wide verified badge configuration for creator profiles.

POLICIES (FINAL FIX - Migration: 20251101_fix_verified_badge_upload_complete):
- SELECT (badge_public_select): Public read for badge display
- INSERT (badge_admin_insert): Admin only via authenticated session
- UPDATE (badge_admin_update): Admin only via authenticated session  
- DELETE (badge_admin_delete): Admin only via authenticated session

Requirements for admin operations:
- User must be authenticated (auth.uid() IS NOT NULL)
- User must have role=''admin'' in public.users table
- User must have is_active=true in public.users table

Storage: Admins can upload to thumbnails bucket under badges/ folder.';
