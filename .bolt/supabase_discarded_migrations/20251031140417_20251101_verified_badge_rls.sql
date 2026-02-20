/*
  # Definitive Verified Badge Config RLS Fix - Final Authority
  
  ## Problem Summary
  Multiple migration attempts (8+ files) created conflicting RLS policies on verified_badge_config table,
  causing "new row violates row-level security policy" errors when admins upload badges.
  
  ## Root Cause
  1. Two different comprehensive cleanup migrations ran, each with different naming and verification methods
  2. Possible duplicate policies from both inline admin checks AND is_admin() function approach
  3. Migration ordering issues preventing complete cleanup
  4. Auth context not properly resolving during database operations
  
  ## Definitive Solution
  This migration is the FINAL AUTHORITY on verified_badge_config RLS policies.
  It completely supersedes all previous badge-related RLS work.
  
  ## Approach
  1. Drop EVERY possible policy name (comprehensive cleanup of all 20+ variations)
  2. Use INLINE admin verification only (no function dependencies)
  3. Use explicit schema qualification to avoid ambiguity
  4. Create exactly 4 clean, non-conflicting policies
  5. Verify RLS is enabled
  6. Add verification queries
  
  ## Security Model
  - SELECT: Everyone can read badge config (required for profile display)
  - INSERT: Only users with role='admin' in public.users table
  - UPDATE: Only users with role='admin' in public.users table
  - DELETE: Only users with role='admin' in public.users table
  
  ## Auth Requirements
  - User must be authenticated (auth.uid() IS NOT NULL)
  - User must have role='admin' in public.users table
  - Both checks must pass for write operations
*/

-- ============================================================================
-- STEP 1: COMPREHENSIVE POLICY CLEANUP - Drop ALL possible policy names
-- ============================================================================
-- From initial attempts
DROP POLICY IF EXISTS "Users can submit creator request" ON verified_badge_config;
DROP POLICY IF EXISTS "Admins can view verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Admins can insert verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Admins can update verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Admins can delete verified badge config" ON verified_badge_config;

-- From first cleanup attempt (20251030230058)
DROP POLICY IF EXISTS "Public badge viewing" ON verified_badge_config;
DROP POLICY IF EXISTS "Public can view verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Authenticated users can view verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Anyone can view verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Only admins can insert verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Only admins can update verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Only admins can delete verified badge config" ON verified_badge_config;

-- From enhancement attempt (20251031082904)
DROP POLICY IF EXISTS "Everyone can view verified badge config" ON verified_badge_config;

-- From complete fix attempt (20251031090915)
DROP POLICY IF EXISTS "verified_badge_config_select_all" ON verified_badge_config;
DROP POLICY IF EXISTS "verified_badge_config_insert_admin" ON verified_badge_config;
DROP POLICY IF EXISTS "verified_badge_config_update_admin" ON verified_badge_config;
DROP POLICY IF EXISTS "verified_badge_config_delete_admin" ON verified_badge_config;

-- From comprehensive cleanup (20251031131742)
DROP POLICY IF EXISTS "verified_badge_select_everyone" ON verified_badge_config;
DROP POLICY IF EXISTS "verified_badge_insert_admin_only" ON verified_badge_config;
DROP POLICY IF EXISTS "verified_badge_update_admin_only" ON verified_badge_config;
DROP POLICY IF EXISTS "verified_badge_delete_admin_only" ON verified_badge_config;

-- From final fix attempt (20251031134802)
DROP POLICY IF EXISTS "badge_select_public" ON verified_badge_config;
DROP POLICY IF EXISTS "badge_insert_admin_only" ON verified_badge_config;
DROP POLICY IF EXISTS "badge_update_admin_only" ON verified_badge_config;
DROP POLICY IF EXISTS "badge_delete_admin_only" ON verified_badge_config;

-- Additional variations that may exist
DROP POLICY IF EXISTS "Public select" ON verified_badge_config;
DROP POLICY IF EXISTS "Admin insert" ON verified_badge_config;
DROP POLICY IF EXISTS "Admin update" ON verified_badge_config;
DROP POLICY IF EXISTS "Admin delete" ON verified_badge_config;

-- ============================================================================
-- STEP 2: Ensure RLS is enabled on the table
-- ============================================================================
ALTER TABLE verified_badge_config ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Create exactly 4 clean, definitive RLS policies using INLINE verification
-- ============================================================================

-- Policy 1: SELECT - Everyone can read verified badge config
-- This is safe and necessary: the badge is a system-wide UI element displayed on all creator profiles
CREATE POLICY "vbc_select_everyone"
  ON verified_badge_config
  FOR SELECT
  USING (true);

-- Policy 2: INSERT - Only admins can create badge configurations
-- Uses inline EXISTS check with explicit schema qualification
CREATE POLICY "vbc_insert_admin_only"
  ON verified_badge_config
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM public.users
      WHERE public.users.id = auth.uid()
        AND public.users.role = 'admin'
        AND public.users.is_active = true
    )
  );

-- Policy 3: UPDATE - Only admins can modify badge configurations
-- Uses inline EXISTS check with explicit schema qualification for both USING and WITH CHECK
CREATE POLICY "vbc_update_admin_only"
  ON verified_badge_config
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM public.users
      WHERE public.users.id = auth.uid()
        AND public.users.role = 'admin'
        AND public.users.is_active = true
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM public.users
      WHERE public.users.id = auth.uid()
        AND public.users.role = 'admin'
        AND public.users.is_active = true
    )
  );

-- Policy 4: DELETE - Only admins can delete badge configurations
-- Uses inline EXISTS check with explicit schema qualification
CREATE POLICY "vbc_delete_admin_only"
  ON verified_badge_config
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM public.users
      WHERE public.users.id = auth.uid()
        AND public.users.role = 'admin'
        AND public.users.is_active = true
    )
  );

-- ============================================================================
-- STEP 4: Add documentation comment
-- ============================================================================
COMMENT ON TABLE verified_badge_config IS 
'System-wide verified badge configuration. 
RLS: Everyone can SELECT (needed for profile display). Only active admin users can INSERT/UPDATE/DELETE.
Admin check: role=admin and is_active=true in public.users table.
Auth check: auth.uid() must not be NULL.
Migration: 20251101_definitive_verified_badge_rls_final_fix.sql (FINAL AUTHORITY - supersedes all previous badge RLS migrations)';

-- ============================================================================
-- STEP 5: Verification queries (for documentation/debugging)
-- ============================================================================

-- Verify exactly 4 policies exist with correct names
-- Query: SELECT policyname, cmd FROM pg_policies WHERE tablename='verified_badge_config' ORDER BY policyname;
-- Expected results:
--   vbc_delete_admin_only    | DELETE
--   vbc_insert_admin_only    | INSERT
--   vbc_select_everyone      | SELECT
--   vbc_update_admin_only    | UPDATE

-- Verify admin user exists and has correct role
-- Query: SELECT id, email, role, is_active FROM public.users WHERE role='admin' LIMIT 1;
-- Expected result: At least one user with role='admin' and is_active=true

-- Verify table has default badge entry
-- Query: SELECT id, badge_url FROM verified_badge_config LIMIT 1;
-- Expected result: One row with a badge_url
