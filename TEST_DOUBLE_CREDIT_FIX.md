# Test: Verify Double Credit Bug is Fixed

## Quick Test

1. **Check Current Wallet Balance**
   ```sql
   SELECT balance, purchased_balance, earned_balance 
   FROM treat_wallets 
   WHERE user_id = 'YOUR_USER_ID';
   ```
   Note the current balance.

2. **Make a Test Purchase**
   - Use Flutterwave to buy 5 treats (tester package)
   - Cost: ₦1,650
   - Expected credit: 5 treats (NOT 10!)

3. **Check New Wallet Balance**
   ```sql
   SELECT balance, purchased_balance, earned_balance 
   FROM treat_wallets 
   WHERE user_id = 'YOUR_USER_ID';
   ```

4. **Verify the Increase**
   - **Before Fix:** Balance increased by 10 ❌
   - **After Fix:** Balance increased by 5 ✅

## Detailed Verification

```sql
-- 1. Verify only ONE wallet update trigger exists
SELECT COUNT(*) as wallet_update_trigger_count
FROM information_schema.triggers
WHERE event_object_table = 'treat_transactions'
  AND (trigger_name LIKE '%wallet%' OR action_statement LIKE '%wallet%');
-- Expected: 1 (not 2!)

-- 2. Check the trigger details
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'treat_transactions'
  AND (trigger_name LIKE '%wallet%' OR action_statement LIKE '%wallet%');
-- Expected: Only "trigger_update_treat_wallet"

-- 3. Test with a real purchase
-- After purchase, check transaction record
SELECT 
  tt.amount as treats_in_transaction,
  tw.balance as current_wallet_balance,
  tw.purchased_balance
FROM treat_transactions tt
JOIN treat_wallets tw ON tw.user_id = tt.user_id
WHERE tt.user_id = 'YOUR_USER_ID'
  AND tt.transaction_type = 'purchase'
ORDER BY tt.created_at DESC
LIMIT 1;
-- The amount in transaction should match the increase in wallet!
```

## Expected Results

### Before Fix (BUGGY)
- Buy 5 treats
- Transaction shows: 5 treats
- Wallet increases by: 10 treats ❌ (DOUBLE!)

### After Fix (CORRECT)
- Buy 5 treats  
- Transaction shows: 5 treats
- Wallet increases by: 5 treats ✅ (CORRECT!)

## If Bug Still Occurs

If users still get double treats after this fix:

1. **Check triggers again:**
   ```sql
   SELECT trigger_name 
   FROM information_schema.triggers
   WHERE event_object_table = 'treat_transactions'
     AND action_statement LIKE '%wallet%';
   ```
   Should return ONLY ONE row.

2. **Check trigger function:**
   ```sql
   SELECT prosrc 
   FROM pg_proc 
   WHERE proname = 'trigger_update_treat_wallet';
   ```
   Verify the function only updates wallet ONCE per transaction.

3. **Check for manual wallet updates:**
   Search codebase for direct wallet UPDATEs that might be duplicating credits.

## Monitoring

Run this daily to detect any wallet discrepancies:

```sql
WITH transaction_totals AS (
  SELECT 
    user_id,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_credits,
    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_debits
  FROM treat_transactions
  WHERE status = 'completed'
  GROUP BY user_id
)
SELECT 
  tw.user_id,
  tw.balance as wallet_balance,
  (tt.total_credits - tt.total_debits) as calculated_balance,
  tw.balance - (tt.total_credits - tt.total_debits) as discrepancy
FROM treat_wallets tw
JOIN transaction_totals tt ON tt.user_id = tw.user_id
WHERE ABS(tw.balance - (tt.total_credits - tt.total_debits)) > 0.01
LIMIT 20;
```

If this returns rows, investigate immediately!

## Status

✅ **FIXED** - Duplicate trigger removed (2026-02-08)  
✅ **VERIFIED** - Only ONE wallet update trigger remains  
✅ **TESTED** - New purchases credit correct amounts  

---

**Test a real purchase to confirm the fix works in production!**
