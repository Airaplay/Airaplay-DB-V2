# Plan: Fix Treat Users Management Add/Remove Treats

## Problem
- "Failed to add treats" and "Failed to remove treats" errors
- Root cause: Functions and tables don't exist in database

## Verification Results
✅ Verified: `treat_wallets` table does NOT exist
✅ Verified: `treat_transactions` table does NOT exist  
✅ Verified: `admin_activity_log` table does NOT exist (but migration exists)
✅ Verified: `admin_add_treats_to_user` function does NOT exist
✅ Verified: `admin_remove_treats_from_user` function does NOT exist

## Solution

### Step 1: Create Missing Tables
Create migration: `supabase/migrations/20251202112927_create_treat_system_tables.sql`
- Create `treat_wallets` table with columns:
  - user_id (PK, FK to users)
  - balance, total_purchased, total_spent, total_earned, total_withdrawn
  - earned_balance, purchased_balance (from later migrations)
  - created_at, updated_at
- Create `treat_transactions` table with columns:
  - id (PK), user_id (FK), transaction_type, amount
  - balance_before, balance_after, description, metadata, status, created_at
- Add indexes and RLS policies

### Step 2: Create Missing Functions  
Create migration: `supabase/migrations/20251202113000_create_treat_admin_functions.sql`
- Create `admin_add_treats_to_user` with:
  - Return JSON errors for validation (not exceptions)
  - SET search_path = public, pg_temp
  - Proper error messages
- Create `admin_remove_treats_from_user` with same improvements
- Create `admin_get_treat_users` and `admin_count_treat_users` helper functions

### Step 3: Improve Frontend Error Handling
Update: `src/screens/AdminDashboardScreen/TreatUsersSection.tsx`
- Extract detailed error messages from Supabase responses
- Display specific errors instead of generic messages
- Add console logging for debugging

## Files to Create
1. `supabase/migrations/20251202112927_create_treat_system_tables.sql`
2. `supabase/migrations/20251202113000_create_treat_admin_functions.sql`
3. Update `src/screens/AdminDashboardScreen/TreatUsersSection.tsx`

