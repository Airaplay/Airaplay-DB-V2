/*
  # Comprehensive Verified Badge Config RLS Policy Cleanup and Fix

  ## Problem
  - 12+ conflicting RLS policies accumulated across 6 migrations
  - Multiple policies with different names doing the same operations
  - Mix of is_admin() function calls and inline admin verification
  - Policies targeting different roles (anon, authenticated) without clear hierarchy
  - Badge upload fails with "new row violates row-level security policy"

  ## Root Causes
  1. Policies created but never fully dropped in subsequent migrations
  2. Inconsistent admin verification approaches (is_admin() vs inline queries)
  3. Multiple SELECT policies with same effect causing confusion
  4. Schema qualification issues in function references

  ## Solution
  1. Drop ALL policies on verified_badge_config table (comprehensive cleanup)
  2. Create exactly 4 clean, non-conflicting policies with clear naming
  3. Use consistent inline admin verification (avoid function dependency issues)
  4. SELECT: Everyone (anon + authenticated) can view badge for profile display
  5. INSERT: Only admins can create badge configurations
  6. UPDATE: Only admins can modify badge configurations
  7. DELETE: Only admins can delete badge configurations

  ## Security Guarantees
  - Public users can READ badge config (needed for profile display)
  - Authenticated users can READ badge config (needed for profile display)
  - Only users with role='admin' in public.users table can write/modify/delete
  - Uses explicit schema qualification (public.users) to avoid ambiguity
  - Auth context verified via auth.uid() with proper user role check

  ## Testing Strategy
  1. Admin users should be able to insert/update/delete badge config
  2. Non-admin authenticated users should NOT be able to write badge config
  3. All users (anon + authenticated) should be able to read badge config
  4. Creator request approval/rejection should work without RLS errors
  5. Notifications should be created successfully for creator actions
*/

-- Step 1: Drop ALL existing policies on verified_badge_config
-- This is a comprehensive cleanup to remove all conflicting policies
DROP POLICY IF EXISTS "Public badge viewing" ON verified_badge_config;
DROP POLICY IF EXISTS "Public can view verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Authenticated users can view verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Admins can view verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Admins can insert verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Admins can update verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Admins can delete verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Anyone can view verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Only admins can insert verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Only admins can update verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Only admins can delete verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Everyone can view verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "verified_badge_config_select_all" ON verified_badge_config;
DROP POLICY IF EXISTS "verified_badge_config_insert_admin" ON verified_badge_config;
DROP POLICY IF EXISTS "verified_badge_config_update_admin" ON verified_badge_config;
DROP POLICY IF EXISTS "verified_badge_config_delete_admin" ON verified_badge_config;

-- Step 2: Create exactly 4 clean, non-conflicting policies

-- Policy 1: SELECT - Everyone (anon and authenticated) can view badge config
-- This is safe and necessary for profile display across the app
CREATE POLICY "verified_badge_select_everyone"
  ON verified_badge_config
  FOR SELECT
  USING (true);

-- Policy 2: INSERT - Only admins can create badge configurations
-- Uses explicit schema qualification to avoid ambiguity
CREATE POLICY "verified_badge_insert_admin_only"
  ON verified_badge_config
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.role = 'admin'
    )
  );

-- Policy 3: UPDATE - Only admins can modify badge configurations
-- Uses explicit schema qualification to avoid ambiguity
CREATE POLICY "verified_badge_update_admin_only"
  ON verified_badge_config
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.role = 'admin'
    )
  );

-- Policy 4: DELETE - Only admins can delete badge configurations
-- Uses explicit schema qualification to avoid ambiguity
CREATE POLICY "verified_badge_delete_admin_only"
  ON verified_badge_config
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.role = 'admin'
    )
  );

-- Step 3: Verify RLS is enabled on verified_badge_config
ALTER TABLE verified_badge_config ENABLE ROW LEVEL SECURITY;

-- Step 4: Add helpful database comment for maintenance
COMMENT ON TABLE verified_badge_config IS 'System-wide verified badge configuration. RLS: Everyone can read, only admins can write/update/delete. See migration 20251031_comprehensive_verified_badge_rls_cleanup for policy details.';
