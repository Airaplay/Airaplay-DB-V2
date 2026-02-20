# 🚨 IMMEDIATE SECURITY FIXES (Deploy Within 24 Hours)

## Fix 1: Add Webhook Signature Validation

### Paystack Webhook
**File:** `supabase/functions/payment-webhook-paystack/index.ts`

```typescript
// Add after line 102
const paystackSignature = req.headers.get("x-paystack-signature");
const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");

if (!paystackSignature) {
  return new Response(
    JSON.stringify({ error: "Missing signature" }),
    { status: 401, headers: corsHeaders }
  );
}

const hash = await crypto.subtle.digest(
  "SHA-512",
  new TextEncoder().encode(JSON.stringify(body) + PAYSTACK_SECRET_KEY)
);
const hashHex = Array.from(new Uint8Array(hash))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');

if (hashHex !== paystackSignature) {
  logError({
    step: "signature_validation_failed",
    expected: hashHex.substring(0, 10) + "...",
    received: paystackSignature.substring(0, 10) + "..."
  });
  return new Response(
    JSON.stringify({ error: "Invalid signature" }),
    { status: 401, headers: corsHeaders }
  );
}
```

### Flutterwave Webhook
**File:** `supabase/functions/payment-webhook-flutterwave/index.ts`

```typescript
// Replace lines 111-119 with:
const verifHash = req.headers.get("verif-hash");
const FLUTTERWAVE_SECRET_HASH = Deno.env.get("FLUTTERWAVE_SECRET_HASH");

if (!verifHash || verifHash !== FLUTTERWAVE_SECRET_HASH) {
  logError({
    step: "signature_validation_failed",
    hasHash: !!verifHash
  });
  return new Response(
    JSON.stringify({ error: "Invalid webhook signature" }),
    { status: 401, headers: corsHeaders }
  );
}
```

---

## Fix 2: Enforce Authentication in Upload Functions

**File:** `supabase/functions/upload-to-bunny/index.ts`

```typescript
// Replace lines 88-103 with:
let authenticatedUserId: string;

try {
  authenticatedUserId = await validateUserAuth(req);
  console.log(`✅ Authenticated user: ${authenticatedUserId}`);
} catch (authError) {
  console.error("Auth validation failed:", authError);
  return new Response(
    JSON.stringify({
      error: "Authentication required",
      details: authError instanceof Error ? authError.message : "Unknown error"
    }),
    { status: 401, headers: corsHeaders }
  );
}

try {
  await verifyUserIsCreator(authenticatedUserId);
  console.log(`✅ User is verified creator`);
} catch (authError) {
  console.error("Creator verification failed:", authError);
  return new Response(
    JSON.stringify({
      error: "Creator verification required",
      details: authError instanceof Error ? authError.message : "Unknown error"
    }),
    { status: 403, headers: corsHeaders }
  );
}
```

---

## Fix 3: Add UPDATE RLS Policy to Users Table

**Create new migration file:** `supabase/migrations/YYYYMMDDHHMMSS_fix_users_table_rls.sql`

```sql
/*
  # Fix Users Table RLS Policy

  1. Security
    - Add UPDATE policy requiring admin role
    - Prevent non-admin users from changing roles
    - Prevent privilege escalation attacks
*/

-- Drop existing permissive policies if any
DROP POLICY IF EXISTS "Users can update own profile" ON users;

-- Create strict UPDATE policy
CREATE POLICY "users_update_restricted" ON users
  FOR UPDATE TO authenticated
  USING (
    -- Allow users to update only their own profile
    id = auth.uid()
    AND
    -- But prevent role changes unless admin
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    id = auth.uid()
    AND
    -- Ensure role field isn't being changed unless by admin
    (
      role = (SELECT role FROM users WHERE id = auth.uid())
      OR
      (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
    )
  );

-- Allow users to update non-sensitive fields
CREATE POLICY "users_update_own_profile_safe_fields" ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM users WHERE id = auth.uid()) -- Role unchanged
  );
```

---

## Fix 4: Remove Direct Wallet Updates from Admin Function

**Create new migration file:** `supabase/migrations/YYYYMMDDHHMMSS_fix_admin_double_credit.sql`

```sql
/*
  # Fix Admin Double Credit Issue

  1. Changes
    - Remove direct wallet updates from admin_credit_payment_manually
    - Let trigger handle all wallet updates
    - Prevents double-crediting
*/

CREATE OR REPLACE FUNCTION admin_credit_payment_manually(
  p_user_id uuid,
  p_total_treats integer,
  p_notes text,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_id uuid;
BEGIN
  -- 1. Admin verification
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = p_admin_id AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin role required'
    );
  END IF;

  -- 2. Validate user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- 3. Create payment record
  INSERT INTO treat_payments (
    user_id,
    amount,
    currency,
    status,
    payment_gateway,
    notes
  ) VALUES (
    p_user_id,
    0, -- Manual credit has no actual payment
    'USD',
    'completed',
    'admin_manual',
    p_notes
  ) RETURNING id INTO v_payment_id;

  -- 4. Create transaction (trigger will update wallet)
  INSERT INTO treat_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    payment_reference,
    status
  ) VALUES (
    p_user_id,
    p_total_treats,
    'purchase',
    COALESCE(p_notes, 'Manual credit by admin'),
    v_payment_id::text,
    'completed'
  );

  -- 5. DO NOT UPDATE WALLET DIRECTLY - Let trigger handle it

  -- 6. Log admin action
  INSERT INTO admin_action_logs (
    admin_id,
    action,
    details
  ) VALUES (
    p_admin_id,
    'manual_treat_credit',
    jsonb_build_object(
      'user_id', p_user_id,
      'amount', p_total_treats,
      'notes', p_notes,
      'payment_id', v_payment_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'treats_credited', p_total_treats
  );
END;
$$;
```

---

## Fix 5: Fix Critical RLS Policies

**Create new migration file:** `supabase/migrations/YYYYMMDDHHMMSS_fix_critical_rls_policies.sql`

```sql
/*
  # Fix Critical RLS Policies

  1. Changes
    - Replace USING (true) with proper user_id checks
    - Enforce ownership validation
    - Prevent unauthorized access
*/

-- Fix contribution_rate_limits
DROP POLICY IF EXISTS "System can manage rate limits" ON contribution_rate_limits;

CREATE POLICY "Users manage own rate limits" ON contribution_rate_limits
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role manages rate limits" ON contribution_rate_limits
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Fix user_daily_earnings
DROP POLICY IF EXISTS "System can manage daily earnings" ON user_daily_earnings;

CREATE POLICY "Users view own earnings" ON user_daily_earnings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages earnings" ON user_daily_earnings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Fix file_hash_index
DROP POLICY IF EXISTS "Users can update access count" ON file_hash_index;

CREATE POLICY "Users manage own files" ON file_hash_index
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

-- Fix payment_channels
DROP POLICY IF EXISTS "Authenticated users can manage payment channels" ON treat_payment_channels;

CREATE POLICY "Admin manages payment channels" ON treat_payment_channels
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Fix user_follows
DROP POLICY IF EXISTS "Users can read follow relationships" ON user_follows;

CREATE POLICY "Users view own follows" ON user_follows
  FOR SELECT TO authenticated
  USING (
    follower_id = auth.uid() OR following_id = auth.uid()
  );
```

---

## Fix 6: Add Authentication to Edge Functions

**Files to update:**
- `supabase/functions/process-job-queue/index.ts`
- `supabase/functions/reconcile-payments/index.ts`
- `supabase/functions/auto-reconcile-payments/index.ts`

**Add to each file after CORS check:**

```typescript
// Validate authentication
const authHeader = req.headers.get("Authorization");
if (!authHeader?.startsWith("Bearer ")) {
  return new Response(
    JSON.stringify({ error: "Authorization header required" }),
    { status: 401, headers: corsHeaders }
  );
}

const token = authHeader.replace("Bearer ", "");
const { data: { user }, error: authError } = await supabase.auth.getUser(token);

if (authError || !user) {
  return new Response(
    JSON.stringify({ error: "Invalid or expired token" }),
    { status: 401, headers: corsHeaders }
  );
}

// Verify admin role for sensitive operations
const { data: userData, error: userError } = await supabase
  .from("users")
  .select("role")
  .eq("id", user.id)
  .maybeSingle();

if (userError || !userData || userData.role !== "admin") {
  return new Response(
    JSON.stringify({ error: "Admin access required" }),
    { status: 403, headers: corsHeaders }
  );
}
```

---

## Fix 7: Restrict CORS Origins

**Update ALL edge function CORS headers:**

```typescript
// Replace wildcard with specific origins
const allowedOrigins = [
  "https://your-production-domain.com",
  "https://your-staging-domain.com",
  "http://localhost:5173", // Dev only
  "capacitor://localhost", // Mobile app
];

const origin = req.headers.get("origin") || "";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0],
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Access-Control-Max-Age": "86400",
};
```

---

## Deployment Checklist

- [ ] Test webhook signature validation with real payment providers
- [ ] Verify upload authentication with non-creator accounts
- [ ] Test RLS policies with different user roles
- [ ] Confirm admin double-credit is fixed
- [ ] Validate CORS restrictions don't break mobile app
- [ ] Run edge function tests with invalid tokens
- [ ] Monitor logs for authentication failures
- [ ] Set up alerts for failed webhook signatures

## Rollback Plan

If issues occur:
1. Revert migrations in reverse order
2. Restore previous edge function code
3. Monitor error rates
4. Hotfix specific issues
5. Redeploy with fixes

## Post-Deployment Monitoring

- Watch for spike in 401/403 errors (auth working correctly)
- Monitor webhook delivery success rates
- Check wallet balance updates for correctness
- Verify no duplicate transactions
- Confirm upload functionality works for creators
