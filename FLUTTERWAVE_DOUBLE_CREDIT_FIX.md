# Flutterwave Double Credit Fix

## Issue Description

Users purchasing Treats via Flutterwave were receiving **double the amount** they paid for.

**Example:**
- User buys 100 Treats
- User receives 200 Treats (100 + 100 duplicate)

## Root Cause

The Flutterwave payment flow had **two separate crediting paths**:

1. **GET Callback** (user returns from payment page)
   - URL: `/payment-webhook-flutterwave?tx_ref=XXX&status=successful`
   - Verified payment with Flutterwave API
   - **Credited treats to user wallet** ❌

2. **POST Webhook** (Flutterwave server notification)
   - URL: `/payment-webhook-flutterwave` (POST request)
   - Verified payment with Flutterwave API
   - **Credited treats to user wallet again** ❌

Both paths executed for every successful payment, resulting in double crediting.

## Solution Implemented

### New Payment Flow

**GET Callback (User Return):**
- ✅ Verifies payment with Flutterwave API
- ✅ Marks payment as `pending_credit`
- ❌ Does NOT credit treats

**POST Webhook (Authoritative):**
- ✅ Verifies payment with Flutterwave API
- ✅ Credits treats to user wallet
- ✅ Marks payment as `completed`

### Payment Status Flow

```
pending → pending_credit → completed
   ↓           ↓              ↓
Initial    Verified      Treats Credited
           (GET)         (POST Webhook)
```

### Idempotency Protection

Multiple layers prevent duplicate crediting:

1. **Payment Status Check**
   ```typescript
   if (payment.status === "completed") {
     // Skip - already processed
     return;
   }
   ```

2. **Transaction Check**
   ```typescript
   const existingTransaction = await supabase
     .from("treat_transactions")
     .select("id")
     .eq("payment_reference", paymentId)
     .eq("status", "completed")
     .maybeSingle();
   
   if (existingTransaction) {
     // Skip - treats already credited
     return true;
   }
   ```

3. **Status-Based Processing**
   - GET callback: Only processes if status is `pending`
   - POST webhook: Only processes if status is `pending` or `pending_credit`

## Database Changes

### New Payment Status

Added `pending_credit` status to `treat_payments` table:

```sql
ALTER TABLE treat_payments 
ADD CONSTRAINT treat_payments_status_check 
CHECK (status IN ('pending', 'pending_credit', 'completed', 'failed', 'cancelled'));
```

**Status Meanings:**
- `pending`: Payment initiated, awaiting completion
- `pending_credit`: Payment verified, awaiting webhook to credit treats
- `completed`: Treats credited to user wallet
- `failed`: Payment failed
- `cancelled`: Payment cancelled by user

## Verification

### Check Payment Processing

```sql
-- View recent payments and their status flow
SELECT 
  id,
  user_id,
  amount,
  status,
  created_at,
  completed_at,
  (completed_at - created_at) as processing_time
FROM treat_payments
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;
```

### Check for Double Credits

```sql
-- Find any payments that might have been double-credited
SELECT 
  tt.payment_reference,
  COUNT(*) as transaction_count,
  SUM(tt.amount) as total_credited,
  tp.amount as payment_amount,
  ARRAY_AGG(tt.id) as transaction_ids
FROM treat_transactions tt
JOIN treat_payments tp ON tp.id = tt.payment_reference
WHERE 
  tt.transaction_type = 'purchase'
  AND tt.status = 'completed'
  AND tt.created_at > NOW() - INTERVAL '7 days'
GROUP BY tt.payment_reference, tp.amount
HAVING COUNT(*) > 1
ORDER BY tt.payment_reference DESC;
```

### Check User Wallet Balance

```sql
-- Verify a specific user's wallet matches their transactions
WITH user_transactions AS (
  SELECT 
    user_id,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_credits,
    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_debits
  FROM treat_transactions
  WHERE user_id = 'USER_ID_HERE'
    AND status = 'completed'
)
SELECT 
  tw.user_id,
  tw.balance as current_balance,
  ut.total_credits,
  ut.total_debits,
  (ut.total_credits - ut.total_debits) as calculated_balance,
  tw.balance - (ut.total_credits - ut.total_debits) as discrepancy
FROM treat_wallets tw
JOIN user_transactions ut ON ut.user_id = tw.user_id
WHERE tw.user_id = 'USER_ID_HERE';
```

## Testing the Fix

### Test Successful Payment

1. **Initiate Payment**
   ```bash
   # User purchases 100 Treats via Flutterwave
   ```

2. **GET Callback Fires**
   - Payment status: `pending` → `pending_credit`
   - Treats credited: NO
   - User balance: Unchanged

3. **POST Webhook Fires**
   - Payment status: `pending_credit` → `completed`
   - Treats credited: YES (100 treats)
   - User balance: +100

4. **Verify Result**
   ```sql
   -- Check payment
   SELECT status FROM treat_payments WHERE id = 'payment_id';
   -- Expected: 'completed'
   
   -- Check transactions
   SELECT COUNT(*) FROM treat_transactions 
   WHERE payment_reference = 'payment_id' AND status = 'completed';
   -- Expected: 1 (not 2!)
   
   -- Check wallet
   SELECT balance FROM treat_wallets WHERE user_id = 'user_id';
   -- Expected: Previous balance + 100
   ```

### Test Duplicate Webhook

Flutterwave sometimes sends duplicate webhooks. Test idempotency:

1. **First Webhook**
   - Credits treats: YES
   - Status: `completed`

2. **Second Webhook (Duplicate)**
   - Credits treats: NO (idempotency check)
   - Log: "payment_already_completed"

## Rollback Plan

If issues occur, revert to old behavior:

```sql
-- Remove pending_credit status
ALTER TABLE treat_payments DROP CONSTRAINT treat_payments_status_check;
ALTER TABLE treat_payments 
ADD CONSTRAINT treat_payments_status_check 
CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'));

-- Update any pending_credit payments to completed
UPDATE treat_payments 
SET status = 'completed' 
WHERE status = 'pending_credit';
```

Then redeploy previous version of edge function.

## Monitoring

### Alert if Double Crediting Occurs

```sql
-- Run this query daily to detect double credits
SELECT 
  tt.payment_reference,
  tp.user_id,
  COUNT(*) as credit_count,
  SUM(tt.amount) as total_credited
FROM treat_transactions tt
JOIN treat_payments tp ON tp.id = tt.payment_reference
WHERE 
  tt.transaction_type = 'purchase'
  AND tt.status = 'completed'
  AND tt.created_at > NOW() - INTERVAL '24 hours'
GROUP BY tt.payment_reference, tp.user_id
HAVING COUNT(*) > 1;
```

If results found: Investigate immediately and contact affected users.

## Support for Affected Users

If users were double-credited before this fix:

1. **Identify Affected Payments**
   ```sql
   -- Find double-credited payments
   SELECT DISTINCT tt.payment_reference, tp.user_id
   FROM treat_transactions tt
   JOIN treat_payments tp ON tp.id = tt.payment_reference
   WHERE tt.transaction_type = 'purchase'
     AND tt.status = 'completed'
   GROUP BY tt.payment_reference, tp.user_id
   HAVING COUNT(*) > 1;
   ```

2. **Calculate Over-Credit**
   ```sql
   -- Calculate how much each user was over-credited
   WITH double_credits AS (
     SELECT 
       tt.user_id,
       tt.payment_reference,
       COUNT(*) - 1 as extra_credits,
       (SUM(tt.amount) - MAX(tt.amount)) as over_credited_amount
     FROM treat_transactions tt
     WHERE tt.transaction_type = 'purchase'
       AND tt.status = 'completed'
     GROUP BY tt.user_id, tt.payment_reference
     HAVING COUNT(*) > 1
   )
   SELECT 
     user_id,
     COUNT(*) as affected_payments,
     SUM(over_credited_amount) as total_over_credited
   FROM double_credits
   GROUP BY user_id
   ORDER BY total_over_credited DESC;
   ```

3. **Decision**
   - Option A: Let users keep the extra treats (goodwill gesture)
   - Option B: Deduct extra treats from future purchases
   - Option C: Communicate with users and adjust balances

## Summary

**Problem:** Double crediting on Flutterwave payments
**Cause:** Both callback and webhook credited treats
**Solution:** Only webhook credits treats; callback marks as verified
**Result:** Users now receive exactly what they paid for

**Status:** ✅ Fixed and Deployed
**Date:** 2026-02-08
**Deployed:** Edge function updated, migration applied
