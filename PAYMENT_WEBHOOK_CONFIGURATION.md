# Payment Webhook Configuration Guide

> ⚠️ **DEPRECATED**: This guide refers to the old unified webhook endpoint.
> 
> **Please use the new separate webhook endpoints instead:**
> - See **[SEPARATE_WEBHOOK_URLS.md](./SEPARATE_WEBHOOK_URLS.md)** for the latest configuration guide
> 
> The old `payment-webhook` function has been removed to avoid conflicts.

## Overview

~~The payment system uses a unified webhook endpoint that handles callbacks from both Paystack and Flutterwave.~~ 

**NEW:** We now use separate dedicated webhook endpoints for each payment provider:
- **Flutterwave**: `/functions/v1/payment-webhook-flutterwave`
- **Paystack**: `/functions/v1/payment-webhook-paystack`

See **[SEPARATE_WEBHOOK_URLS.md](./SEPARATE_WEBHOOK_URLS.md)** for configuration instructions.

## Webhook URL

Both Paystack and Flutterwave should use the **same webhook URL**:

```
https://YOUR_SUPABASE_PROJECT_URL/functions/v1/payment-webhook
```

Replace `YOUR_SUPABASE_PROJECT_URL` with your actual Supabase project URL (found in your Supabase project settings).

### Finding Your Supabase Project URL

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **Project URL** (should look like: `https://xxxxxxxxxxxxx.supabase.co`)

**Important:** The webhook URL must be exactly:
```
https://xxxxxxxxxxxxx.supabase.co/functions/v1/payment-webhook
```

**Note:** The webhook handler now **auto-detects** the payment provider from the webhook payload, so the `?provider=` query parameter is optional but recommended.

## Paystack Configuration

### Step 1: Log into Paystack Dashboard
1. Go to https://dashboard.paystack.com
2. Navigate to **Settings** → **Webhooks**

### Step 2: Add Webhook URL
1. Click **Add Webhook**
2. Enter the webhook URL:
   ```
   https://YOUR_SUPABASE_PROJECT_URL/functions/v1/payment-webhook?provider=paystack
   ```
3. Click **Save Changes**

### Step 3: Copy Webhook Secret
1. After saving, Paystack will display a **Webhook Secret**
2. Copy this secret and store it securely in your payment channel configuration

### Events to Subscribe
- `charge.success` - This is the main event we handle

## Flutterwave Configuration

### Step 1: Log into Flutterwave Dashboard
1. Go to https://dashboard.flutterwave.com
2. Navigate to **Settings** → **Webhooks**

### Step 2: Add Webhook URL
1. Click **Add Webhook**
2. Enter the webhook URL:
   ```
   https://YOUR_SUPABASE_PROJECT_URL/functions/v1/payment-webhook?provider=flutterwave
   ```
3. Enter a webhook hash/secret for verification
4. Click **Save**

### Step 3: Store Webhook Secret
1. Store the webhook hash/secret you created in your payment channel configuration

### Events to Subscribe
- `charge.completed` - This is the main event we handle

## Payment Flow

### 1. User Initiates Payment
- User selects a treat package and payment method
- Frontend creates a payment record in `treat_payments` table with status `pending`
- User is redirected to payment provider's checkout page

### 2. User Completes Payment
- User completes payment on Paystack/Flutterwave
- Payment provider redirects user back to app (GET callback)
- Payment provider sends webhook notification (POST webhook)

### 3. Webhook Processing
The webhook function performs these steps:
1. **Verify Payment** - Confirms payment with provider's API
2. **Check Idempotency** - Ensures payment hasn't already been processed
3. **Credit Treats** - Adds treats to user's wallet
4. **Update Status** - Marks payment as completed
5. **Create Transaction** - Creates transaction record for history

### 4. User Sees Updated Balance
- Real-time subscription updates the UI
- User's wallet balance reflects new treats
- Transaction appears in history

## Payment Verification

The system uses **double verification** for security:

1. **Webhook Signature Verification** (Paystack only)
   - Validates webhook came from Paystack using signature

2. **Payment Status Verification**
   - Queries payment provider's API to confirm payment success
   - Prevents fraudulent webhook submissions

## Troubleshooting

### "Requested path is invalid" Error from Flutterwave

**Problem:** Flutterwave returns `{"error": "requested path is invalid"}` after configuring the webhook.

**Possible Causes:**
1. Webhook URL format is incorrect (missing `/functions/v1/` path)
2. Webhook URL contains extra characters or trailing slashes
3. Supabase Edge Function is not deployed
4. Function name mismatch (should be exactly `payment-webhook`)

**Solutions:**
1. **Verify the webhook URL format:**
   - Correct: `https://xxxxxxxxxxxxx.supabase.co/functions/v1/payment-webhook`
   - Wrong: `https://xxxxxxxxxxxxx.supabase.co/payment-webhook`
   - Wrong: `https://xxxxxxxxxxxxx.supabase.co/functions/v1/payment-webhook/`
   
2. **Check if the Edge Function is deployed:**
   - Go to Supabase Dashboard → Edge Functions
   - Verify `payment-webhook` function exists and is deployed
   - Check the function logs for incoming requests

3. **Test the webhook URL manually:**
   - Open the webhook URL in your browser: `https://YOUR_SUPABASE_PROJECT_URL/functions/v1/payment-webhook`
   - You should see a response (even if it's an error, it confirms the endpoint exists)

4. **Verify Flutterwave webhook configuration:**
   - Go to Flutterwave Dashboard → Settings → Webhooks
   - Ensure the URL is exactly: `https://YOUR_SUPABASE_PROJECT_URL/functions/v1/payment-webhook?provider=flutterwave`
   - No trailing slash
   - Use HTTPS (not HTTP)

5. **Check webhook logs:**
   - Go to Supabase Dashboard → Edge Functions → payment-webhook → Logs
   - Look for incoming requests from Flutterwave
   - Check for any error messages

### Payment Completed but User Not Credited

**Possible Causes:**
1. Webhook URL not configured correctly
2. Webhook was blocked by firewall
3. Payment provider hasn't sent webhook yet (can take a few minutes)
4. Webhook validation failed

**Solutions:**
1. Check webhook URL configuration in payment provider dashboard
2. Check Supabase Edge Functions logs for errors
3. Verify the payment reference format matches your system (should start with `treat_`)
4. Use the Payment Monitoring section in Admin Dashboard to manually verify and credit payment

### Webhook Logs

To view webhook logs:
1. Go to Supabase Dashboard → Edge Functions
2. Click on `payment-webhook` function
3. View **Logs** tab for detailed webhook processing logs

All webhook events are logged with the following format:
```
[PAYMENT-WEBHOOK] { timestamp, step, paymentId, details }
```

### Manual Payment Verification

If automatic crediting fails:
1. Go to Admin Dashboard → Payment Monitoring
2. Find the uncredited payment
3. Click **Verify Payment** to manually check with provider
4. Click **Credit Treats** to manually credit the user

## Security Considerations

### ✅ DO:
- Always use HTTPS URLs for webhooks
- Store API keys and secrets securely in Supabase Vault
- Verify webhook signatures (Paystack)
- Verify payment status with provider API before crediting
- Implement idempotency checks to prevent double-crediting

### ❌ DON'T:
- Hardcode API keys in code
- Trust webhook data without verification
- Skip idempotency checks
- Expose webhook URLs publicly without verification

## Testing Webhooks

### Test Mode (Development)
1. Use test API keys from payment provider
2. Use test webhook URLs
3. Make test payments with provider's test cards

### Production Mode
1. Use live API keys
2. Use production webhook URLs
3. Monitor webhook logs closely for first few transactions

## Webhook Response Codes

The webhook endpoint returns:
- `200 OK` - Webhook processed successfully
- `400 Bad Request` - Invalid webhook data
- `404 Not Found` - Payment record not found
- `500 Internal Server Error` - Server error during processing

## Database Schema

### treat_payments
- Stores payment records
- Status: `pending` → `completed` or `failed`
- Links to payment channel configuration

### treat_transactions
- Stores transaction history
- Transaction type: `purchase`, `tip_sent`, `tip_received`, `withdraw`, `earn`, `spend`
- Links to payment via `payment_reference`

### treat_wallets
- Stores user wallet balances
- `balance` - Current spendable balance
- `purchased_balance` - Balance from purchases only
- `earned_balance` - Balance from ad revenue
- `total_purchased` - Lifetime purchases
- `total_spent` - Lifetime spending
- `total_earned` - Lifetime earnings

## Real-time Updates

The system uses Supabase real-time subscriptions to update the UI immediately when:
- Payment status changes
- Treats are credited
- Transaction is created

No page refresh needed - everything updates automatically!

## Support

If you encounter issues:
1. Check webhook logs in Supabase Dashboard
2. Check payment provider's webhook logs
3. Use Payment Monitoring in Admin Dashboard
4. Contact support with payment ID for investigation

## Summary

✅ Use the **same webhook URL** for both Paystack and Flutterwave
✅ URL format: `https://YOUR_SUPABASE_PROJECT_URL/functions/v1/payment-webhook`
✅ Provider auto-detection: The `?provider=` query parameter is optional (but recommended)
✅ Store webhook secrets securely
✅ Monitor webhook logs regularly
✅ Use Payment Monitoring for manual verification when needed

## Quick Checklist

- [ ] Supabase Edge Function `payment-webhook` is deployed
- [ ] Webhook URL format is correct (includes `/functions/v1/`)
- [ ] Flutterwave webhook URL configured in dashboard
- [ ] Paystack webhook URL configured in dashboard
- [ ] Webhook secrets stored in payment channel configuration
- [ ] Tested with a small payment transaction
- [ ] Checked webhook logs after test payment

The payment system is designed to be reliable, secure, and automatic. With proper webhook configuration, users will receive their treats immediately after payment completion.
