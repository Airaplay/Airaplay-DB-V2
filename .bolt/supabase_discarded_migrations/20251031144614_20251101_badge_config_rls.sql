/*
  # Fix Verified Badge Config RLS Policies - Final Authority

  ## Problem Summary
  Multiple migration attempts (8+ files) created conflicting RLS policies on verified_badge_config table,
  causing "new row violates row-level security policy" errors when admins upload badges.

  ## Root Cause Analysis
  1. Multiple cleanup migrations with different naming conventions
  2. Conflicting policies from both inline checks and is_admin() function approaches
  3. Policy ordering issues causing incomplete cleanup
  4. Auth context resolution issues during database operations

  ## Definitive Solution
  This migration is the FINAL AUTHORITY on verified_badge_config RLS policies.
  It completely supersedes all previous badge-related RLS work.

  ## Approach
  1. Drop EVERY possible policy name (comprehensive cleanup)
  2. Use INLINE admin verification only (no function dependencies)
  3. Use explicit schema qualification to avoid ambiguity
  4. Create exactly 4 clean, non-conflicting policies
  5. Verify RLS is enabled
  6. Add clear documentation

  ## Security Model
  - SELECT: Everyone can read badge config (required for profile display)
  - INSERT: Only authenticated users with role='admin' in public.users table
  - UPDATE: Only authenticated users with role='admin' in public.users table
  - DELETE: Only authenticated users with role='admin' in public.users table

  ## Auth Requirements
  - User must be authenticated (auth.uid() IS NOT NULL)
  - User must have role='admin' in public.users table
  - User must have is_active=true in public.users table
  - Both checks must pass for write operations
*/

-- ============================================================================
-- STEP 1: COMPREHENSIVE POLICY CLEANUP - Drop ALL possible policy names
-- ============================================================================
-- From initial table creation attempts
DROP POLICY IF EXISTS "Users can submit creator request" ON verified_badge_config;
DROP POLICY IF EXISTS "Anyone can view verified badge config" ON verified_badge_config;

-- From first cleanup attempt (20251030230058)
DROP POLICY IF EXISTS "Public badge viewing" ON verified_badge_config;
DROP POLICY IF EXISTS "Public can view verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Authenticated users can view verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Admins can view verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Admins can insert verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Admins can update verified badge config" ON verified_badge_config;
DROP POLICY IF EXISTS "Admins can delete verified badge config" ON verified_badge_config;
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

-- From definitive fix attempt (20251031140417)
DROP POLICY IF EXISTS "vbc_select_everyone" ON verified_badge_config;
DROP POLICY IF EXISTS "vbc_insert_admin_only" ON verified_badge_config;
DROP POLICY IF EXISTS "vbc_update_admin_only" ON verified_badge_config;
DROP POLICY IF EXISTS "vbc_delete_admin_only" ON verified_badge_config;

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
CREATE POLICY "badge_config_select_public"
  ON verified_badge_config
  FOR SELECT
  USING (true);

-- Policy 2: INSERT - Only admins can create badge configurations
-- Uses inline EXISTS check with explicit schema qualification
CREATE POLICY "badge_config_insert_admin"
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
CREATE POLICY "badge_config_update_admin"
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
CREATE POLICY "badge_config_delete_admin"
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
-- STEP 4: Add comprehensive documentation
-- ============================================================================
COMMENT ON TABLE verified_badge_config IS 
'System-wide verified badge configuration for creator profiles.

RLS POLICIES (Final Authority - Migration: 20251101_fix_verified_badge_config_rls_final):
  - SELECT: Public read access (everyone can view for profile display)
  - INSERT: Admin only (auth.uid() must exist AND user.role=admin AND user.is_active=true)
  - UPDATE: Admin only (auth.uid() must exist AND user.role=admin AND user.is_active=true)
  - DELETE: Admin only (auth.uid() must exist AND user.role=admin AND user.is_active=true)

Admin Verification:
  - Checks public.users table for auth.uid() match
  - Requires role=admin and is_active=true
  - Uses inline verification (no function dependencies)

Expected Policies (exactly 4):
  1. badge_config_select_public (SELECT)
  2. badge_config_insert_admin (INSERT)
  3. badge_config_update_admin (UPDATE)
  4. badge_config_delete_admin (DELETE)';

-- ============================================================================
-- STEP 5: Ensure table has default badge entry
-- ============================================================================
INSERT INTO verified_badge_config (badge_url)
VALUES ('https://via.placeholder.com/24x24.png?text=V')
ON CONFLICT DO NOTHING;
