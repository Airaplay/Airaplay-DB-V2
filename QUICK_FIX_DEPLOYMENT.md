# Quick Fix Deployment for Payment Error

## Issue
Users from other countries getting: **"Edge Function Returned a non-2xx status code"**

## Quick Fix Steps

### Step 1: Deploy Updated Edge Function
```bash
# Login to Supabase (if not already logged in)
npx supabase login

# Deploy the fixed edge function
npx supabase functions deploy process-payment
```

### Step 2: Verify Payment Gateway Configuration

1. Go to **Admin Dashboard** in your app
2. Navigate to **Treat Manager** section
3. Check **Payment Channels** tab

**Make sure AT LEAST ONE payment channel is configured:**

#### Paystack Configuration:
- Channel Name: "Paystack"
- Channel Type: paystack
- Is Enabled: ✓ Yes
- Configuration:
  ```json
  {
    "public_key": "pk_test_xxxxx or pk_live_xxxxx",
    "secret_key": "sk_test_xxxxx or sk_live_xxxxx"
  }
  ```

#### Flutterwave Configuration:
- Channel Name: "Flutterwave"
- Channel Type: flutterwave
- Is Enabled: ✓ Yes
- Configuration:
  ```json
  {
    "public_key": "FLWPUBK_TEST-xxxxx or FLWPUBK-xxxxx",
    "secret_key": "FLWSECK_TEST-xxxxx or FLWSECK-xxxxx",
    "encryption_key": "FLWSECK_TESTxxxxx" (for V4 only),
    "api_version": "v3" or "v4"
  }
  ```

### Step 3: Test Payment Flow

1. Open your app
2. Go to Treat Screen
3. Select a treat package
4. Click "Pay"
5. Select a payment method
6. Verify you see detailed error messages (if any)

### Step 4: Monitor Logs

```bash
# Watch real-time logs
npx supabase functions logs process-payment --tail

# Check recent errors
npx supabase functions logs process-payment
```

## Common Issues After Deployment

### Issue: "Payment gateway not properly configured"
**Fix:** Add API keys in Admin Dashboard → Treat Manager → Payment Channels

### Issue: Still seeing generic error
**Fix:** Make sure edge function was deployed successfully:
```bash
npx supabase functions list
```
Should show `process-payment` with recent update time

### Issue: "Currency not supported"
**Fix:** This is normal for some currencies. The system will automatically convert to USD or fallback currency.

## What Changed

### Better Error Messages
Before: "Edge Function Returned a non-2xx status code"
After: "Payment gateway not properly configured. Please contact support."

### Enhanced Logging
- All payment requests are logged with full details
- API responses from payment gateways are logged
- Error context is captured for debugging

### Configuration Validation
- System checks if payment channel has required API keys
- Validates configuration before attempting payment
- Returns clear error if setup is incomplete

## Testing Checklist

- [ ] Edge function deployed successfully
- [ ] At least one payment channel configured with API keys
- [ ] Payment channel is enabled
- [ ] Test payment with local currency
- [ ] Test payment with international currency
- [ ] Verify error messages are clear and actionable
- [ ] Check logs for any warnings or errors

## Need Help?

### Check Payment Channel Status
```sql
SELECT
  channel_name,
  channel_type,
  is_enabled,
  configuration->'secret_key' as has_secret_key,
  created_at
FROM treat_payment_channels
ORDER BY display_order;
```

### Check Recent Failed Payments
```sql
SELECT
  tp.id,
  u.email,
  tp.amount,
  tp.currency,
  tp.status,
  tp.payment_method,
  tp.created_at
FROM treat_payments tp
JOIN users u ON u.id = tp.user_id
WHERE tp.status = 'failed'
ORDER BY tp.created_at DESC
LIMIT 10;
```

### View Edge Function Errors
```bash
npx supabase functions logs process-payment --filter "error"
```

## Rollback Plan

If issues persist, you can rollback by:
```bash
# This will redeploy from your git repository
git checkout HEAD~1 supabase/functions/process-payment/index.ts
npx supabase functions deploy process-payment
```

## Success Indicators

✅ Users see specific error messages instead of generic "Edge Function" error
✅ Payment logs show detailed information about failures
✅ Configuration errors are caught before attempting payment
✅ International users can successfully complete payments
