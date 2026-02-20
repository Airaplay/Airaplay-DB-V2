# Function Search Path Security Issue

## What is "Function Search Path Mutable"?

**Function Search Path Mutable** is a PostgreSQL security vulnerability where functions marked as `SECURITY DEFINER` don't have a fixed `search_path`, making them susceptible to **schema injection attacks**.

---

## The Security Risk Explained

### How PostgreSQL Functions Work

When you create a function with `SECURITY DEFINER` in PostgreSQL, it runs with the privileges of the function owner (often a superuser or admin), not the caller. This is powerful but dangerous if not secured properly.

### The Vulnerability

**Without a fixed `search_path`:**
```sql
CREATE FUNCTION public.add_treat_balance(...)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges
AS $function$
BEGIN
  -- This function doesn't specify: SET search_path = public, pg_temp
  INSERT INTO treat_wallets ...  -- Which schema's "treat_wallets"?
END;
$function$
```

**Attack Scenario:**
1. Attacker creates a malicious schema and table:
   ```sql
   CREATE SCHEMA evil_schema;
   CREATE TABLE evil_schema.treat_wallets (...);
   ```

2. Attacker sets their search_path:
   ```sql
   SET search_path = evil_schema, public;
   ```

3. When they call `add_treat_balance()`, the function runs with **SECURITY DEFINER** privileges but looks in `evil_schema` first, executing malicious code with elevated permissions.

---

## Your Current Status

### Audit Results:
- **Total Functions:** 265
- **With `SET search_path`:** 16 (6%)
- **Without `SET search_path`:** 249 (94%) ⚠️

### Risk Level: 🟡 **MEDIUM**

While this is a theoretical vulnerability, your application has strong RLS policies that provide defense-in-depth. However, it's still a security best practice to fix this.

---

## How to Fix This

### The Solution

Add `SET search_path = public, pg_temp` to all `SECURITY DEFINER` functions:

```sql
-- INSECURE (current state)
CREATE FUNCTION public.add_treat_balance(...)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- vulnerable code
END;
$function$

-- SECURE (fixed)
CREATE OR REPLACE FUNCTION public.add_treat_balance(...)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- ← Fixed search path
AS $function$
BEGIN
  -- now secure
END;
$function$
```

### Why This Works

- `search_path = public, pg_temp` ensures the function **only** looks in the `public` schema and temporary tables
- Attackers can't inject malicious schemas
- The function behavior is predictable and secure

---

## Functions That Need Fixing

### High-Priority Functions (Financial/Admin)

These functions handle sensitive operations and should be fixed first:

1. **Financial Functions:**
   - `add_treat_balance()`
   - `add_treats_to_wallet()`
   - `admin_adjust_treat_balance()`
   - `admin_adjust_user_treats()`
   - `admin_approve_withdrawal()`
   - `process_treat_payment()`

2. **Admin Functions:**
   - `admin_adjust_user_earnings()`
   - `admin_assign_role()`
   - `admin_delete_user()`
   - `admin_create_announcement()`

3. **User Data Functions:**
   - `update_user_profile()`
   - `delete_user_account()`
   - `create_artist_profile()`

---

## Example Fix Migration

```sql
/*
  # Fix Function Search Path Security

  ## Security Issue
  249 out of 265 functions lack a fixed search_path, making them
  vulnerable to schema injection attacks.

  ## Fix
  Add SET search_path = public, pg_temp to all SECURITY DEFINER functions
*/

-- Example: Fix add_treat_balance function
CREATE OR REPLACE FUNCTION public.add_treat_balance(
  p_user_id uuid,
  p_amount integer,
  p_transaction_type text DEFAULT 'bonus'::text,
  p_description text DEFAULT NULL::text,
  p_reference_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- ← Added this line
AS $function$
DECLARE
  v_balance_before numeric;
  v_balance_after numeric;
  -- ... rest of function
BEGIN
  -- Function body remains the same
END;
$function$;

-- Repeat for all 249 functions...
```

---

## Why This Isn't Critical (Yet)

### Mitigating Factors:

1. **RLS Policies** - Your database has 100% RLS coverage, which prevents unauthorized data access even if schema injection occurs

2. **Schema Permissions** - Regular users typically can't create schemas in production databases

3. **Application Layer** - Your Supabase client uses parameterized queries, limiting attack surface

4. **No Public Schema Write** - Users can't arbitrarily create objects in the public schema

### However...

This is still a **security best practice** violation and should be fixed because:
- Defense-in-depth principle
- PostgreSQL security recommendations
- Compliance requirements
- Future-proofing

---

## Recommendation

### Priority: 🟡 MEDIUM (Not Urgent, But Important)

**Suggested Approach:**

1. **Phase 1: High-Risk Functions (Priority)**
   - Fix all financial transaction functions
   - Fix all admin privilege functions
   - ~50 functions, 1-2 hours

2. **Phase 2: User Data Functions**
   - Fix all user profile and content functions
   - ~100 functions, 2-3 hours

3. **Phase 3: Remaining Functions**
   - Fix all other SECURITY DEFINER functions
   - ~99 functions, 2-3 hours

**Total Effort:** 5-8 hours to fix all functions

---

## Automated Fix Script

Here's a helper query to generate fix statements:

```sql
-- Generate ALTER FUNCTION statements for all functions
SELECT
  'ALTER FUNCTION ' ||
  n.nspname || '.' ||
  p.proname ||
  '(' || pg_get_function_arguments(p.oid) || ') ' ||
  'SET search_path = public, pg_temp;' as fix_statement
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%'
  AND pg_get_functiondef(p.oid) LIKE '%SECURITY DEFINER%'
ORDER BY p.proname;
```

This generates ALTER statements you can run to fix existing functions without recreating them.

---

## Testing After Fix

After applying the fix, verify:

```sql
-- Should return 0
SELECT COUNT(*)
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) LIKE '%SECURITY DEFINER%'
  AND pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%';
```

---

## References

- [PostgreSQL Security - Writing SECURITY DEFINER Functions Safely](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
- [OWASP - SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

## Summary

**What:** 249 functions missing fixed `search_path`
**Why It Matters:** Potential schema injection vulnerability
**Risk Level:** 🟡 Medium (mitigated by RLS)
**Fix:** Add `SET search_path = public, pg_temp` to all functions
**Effort:** 5-8 hours total
**Priority:** Medium - Schedule for next maintenance window

---

**Document Created:** November 23, 2025
**Status:** Identified, Not Yet Fixed
**Recommended Action:** Plan migration in next sprint
