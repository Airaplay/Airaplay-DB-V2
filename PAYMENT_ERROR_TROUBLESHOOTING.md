# Payment Error Troubleshooting Guide

## When Users Report Payment Errors

### Step 1: Identify the Error Message
Ask the user for the **exact error message** they see. Common errors:

1. "Edge Function Returned a non-2xx status code" ← **OLD ERROR (before fix)**
2. "Payment gateway not properly configured"
3. "Payment system requires configuration"
4. "Payment failed"
5. "Currency not supported"
6. Specific error from Paystack/Flutterwave

### Step 2: Check Edge Function Logs
```bash
npx supabase functions logs process-payment --filter "error" --tail
```

Look for:
- Configuration errors
- API authentication failures
- Currency conversion issues
- Payment gateway responses

### Step 3: Verify Payment Channel Configuration

#### Check if Payment Channels Exist:
```sql
SELECT
  id,
  channel_name,
  channel_type,
  is_enabled,
  display_order,
  created_at
FROM treat_payment_channels
ORDER BY display_order;
```

#### Verify Configuration Has API Keys:
```sql
SELECT
  channel_name,
  channel_type,
  is_enabled,
  CASE
    WHEN configuration ? 'secret_key' THEN '✓ Has secret_key'
    ELSE '✗ Missing secret_key'
  END as secret_key_status,
  CASE
    WHEN configuration ? 'public_key' THEN '✓ Has public_key'
    ELSE '✗ Missing public_key'
  END as public_key_status
FROM treat_payment_channels;
```

### Step 4: Check User's Payment Attempt
```sql
SELECT
  tp.id,
  u.email,
  tp.amount,
  tp.currency,
  tp.currency_name,
  tp.exchange_rate,
  tp.status,
  tp.payment_method,
  tp.detected_country,
  tp.detected_country_code,
  tp.created_at,
  tp.updated_at
FROM treat_payments tp
JOIN users u ON u.id = tp.user_id
WHERE u.email = 'user@example.com'  -- Replace with actual user email
ORDER BY tp.created_at DESC
LIMIT 5;
```

## Common Error Scenarios & Solutions

### Error: "Payment gateway not properly configured"

**Cause:** Payment channel exists but missing configuration or API keys

**Solution:**
1. Go to Admin Dashboard → Treat Manager → Payment Channels
2. Find the payment channel
3. Click Edit
4. Add required API keys:
   - **Paystack:** public_key, secret_key
   - **Flutterwave:** public_key, secret_key, encryption_key (V4), api_version
   - **USDT:** wallet_address, network
5. Click Save
6. Ensure "Is Enabled" is checked

### Error: "No payment methods available"

**Cause:** No payment channels are enabled

**Solution:**
1. Enable at least one payment channel in Admin Dashboard
2. Verify the channel has valid configuration
3. Test payment flow again

### Error: "Currency XXX not supported"

**Cause:** User's detected currency not supported by the payment gateway

**Solution:**
The system should automatically fallback to:
- USD for Flutterwave
- NGN for Paystack

**Check:**
1. Verify exchange rates are configured
2. Ensure currency detection is working:
```sql
SELECT
  country,
  country_code,
  currency,
  currency_symbol,
  currency_name,
  exchange_rate
FROM users
WHERE email = 'user@example.com';
```

### Error: API Authentication Errors

**Symptoms:**
- "Invalid API key"
- "Authentication failed"
- "401 Unauthorized"

**Solution:**
1. Verify API keys are correct (no extra spaces)
2. Check if using test vs live keys
3. Confirm keys are active on payment gateway dashboard
4. Test API keys directly:

**Paystack Test:**
```bash
curl https://api.paystack.co/transaction/initialize \
  -H "Authorization: Bearer YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","amount":"50000"}'
```

**Flutterwave Test:**
```bash
curl https://api.flutterwave.com/v3/payments \
  -H "Authorization: Bearer YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tx_ref":"test-123",
    "amount":"100",
    "currency":"NGN",
    "redirect_url":"https://example.com",
    "customer":{"email":"test@test.com"}
  }'
```

### Error: "Payment stuck in pending"

**Cause:** Webhook not received or payment not completed

**Solution:**
1. Check webhook configuration on payment gateway
2. Verify webhook URL is correct:
   - Paystack: `https://your-project.supabase.co/functions/v1/payment-webhook-paystack`
   - Flutterwave: `https://your-project.supabase.co/functions/v1/payment-webhook-flutterwave`
3. Check webhook logs:
```bash
npx supabase functions logs payment-webhook-paystack
npx supabase functions logs payment-webhook-flutterwave
```

4. Manually verify payment:
```sql
-- Get payment details
SELECT * FROM treat_payments
WHERE id = 'payment-id-here';

-- If payment was successful but status is pending, manually update:
UPDATE treat_payments
SET status = 'completed'
WHERE id = 'payment-id-here'
AND status = 'pending';
```

### Error: User from specific country can't pay

**Cause:** Payment gateway doesn't support that country

**Solutions:**
1. **Enable Flutterwave** (supports more countries)
2. **Enable USDT** for crypto payments
3. Check payment gateway's supported countries:
   - Paystack: Nigeria, Ghana, South Africa, Kenya
   - Flutterwave: 34+ African countries, US, UK, Canada, etc.

### Error: Amount conversion issues

**Symptoms:**
- Wrong amount shown
- Excessive conversion rate
- Amount mismatch

**Solution:**
1. Check exchange rates in database:
```sql
SELECT
  currency,
  currency_name,
  exchange_rate
FROM users
WHERE country_code = 'XX';  -- Replace with country code
```

2. Verify currency detection service is working
3. Test with manual currency selection

## Debug Mode for Admins

### Enable Detailed Logging
Add this to your `.env.local`:
```
VITE_DEBUG_PAYMENTS=true
```

### Monitor Real-time Payment Flow
```bash
# Watch all payment-related functions
npx supabase functions logs --tail | grep -i "payment"
```

### Test Payment Flow Step-by-Step

1. **Get Available Payment Channels:**
```javascript
const { data, error } = await supabase
  .from('treat_payment_channels')
  .select('*')
  .eq('is_enabled', true);
console.log('Available channels:', data);
```

2. **Test Currency Detection:**
```javascript
import { detectCurrency } from './lib/currencyDetection';
const currency = await detectCurrency();
console.log('Detected currency:', currency);
```

3. **Simulate Payment Request:**
```javascript
const { data, error } = await supabase.functions.invoke('process-payment', {
  body: {
    channel_id: 'channel-uuid',
    channel_type: 'flutterwave',
    amount: 100,
    package_id: 'package-uuid',
    user_email: 'user@example.com',
    configuration: { /* API keys */ },
    currency: 'USD',
    currency_symbol: '$',
    currency_name: 'US Dollar',
    exchange_rate: 1,
    detected_country: 'United States',
    detected_country_code: 'US'
  }
});
console.log('Payment result:', data, error);
```

## Escalation Checklist

Before escalating to payment gateway support:

- [ ] Verified API keys are correct
- [ ] Confirmed payment channel is enabled
- [ ] Checked edge function logs for specific errors
- [ ] Tested with different currencies
- [ ] Verified webhook configuration
- [ ] Confirmed user's country is supported
- [ ] Tested with different payment amounts
- [ ] Checked payment gateway status page

## Contact Payment Gateway Support

### Paystack Support
- Email: support@paystack.com
- Documentation: https://paystack.com/docs
- Status: https://status.paystack.com

### Flutterwave Support
- Email: support@flutterwavego.com
- Documentation: https://developer.flutterwave.com/docs
- Status: https://status.flutterwave.com

### Information to Provide:
1. Transaction reference
2. Error message
3. API keys being used (first/last 4 chars only)
4. Timestamp of failed transaction
5. User's country and currency
6. Amount and currency attempted
7. API response (if available)

## Preventive Measures

### Regular Health Checks
Run weekly:
```sql
-- Check enabled payment channels
SELECT COUNT(*) as enabled_channels
FROM treat_payment_channels
WHERE is_enabled = true;

-- Check recent payment success rate
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_payments,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM treat_payments
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Set Up Alerts
Monitor for:
- Payment failure rate > 20%
- No successful payments in 24 hours
- API authentication errors
- Configuration errors

### Test Payments Monthly
- Test payment with each enabled gateway
- Test with different currencies
- Test from different countries (using VPN)
- Verify webhooks are working
- Check payment confirmation flow
