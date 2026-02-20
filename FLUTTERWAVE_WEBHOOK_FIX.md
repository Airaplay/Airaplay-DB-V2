# Flutterwave Webhook Configuration Fix

## ❌ INCORRECT Webhook URL (What you used):
```
https://vwcadgjaivvffxwgnkzy.supabase.co
```

## ✅ CORRECT Webhook URL (What you need):
```
https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook?provider=flutterwave
```

---

## Steps to Fix in Flutterwave Dashboard

1. **Go to Flutterwave Dashboard**
   - Visit: https://dashboard.flutterwave.com
   - Log in to your account

2. **Navigate to Webhooks Settings**
   - Go to **Settings** → **Webhooks**
   - Or search for "Webhooks" in the dashboard

3. **Update the Webhook URL**
   - Find your existing webhook configuration
   - Click **Edit** or **Update**
   - Replace the URL with:
     ```
     https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook?provider=flutterwave
     ```
   - **Important:** 
     - ✅ Must include `/functions/v1/payment-webhook`
     - ✅ Use HTTPS (not HTTP)
     - ✅ No trailing slash at the end
     - ✅ The `?provider=flutterwave` is optional (webhook auto-detects now) but recommended

4. **Save the Changes**
   - Click **Save** or **Update**

5. **Verify the Configuration**
   - Test by making a small payment
   - Check Supabase Edge Functions logs to see if webhook is received

---

## Key Differences

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| `https://vwcadgjaivvffxwgnkzy.supabase.co` | `https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook` |
| Missing `/functions/v1/payment-webhook` | Includes full Edge Function path |
| Points to base Supabase URL | Points to specific Edge Function |

---

## Testing the Webhook URL

You can test if the endpoint exists by opening this URL in your browser:

```
https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook
```

**Expected Response (Health Check):**
```json
{
  "status": "ok",
  "message": "Payment webhook endpoint is active",
  "endpoint": "/functions/v1/payment-webhook",
  "supported_methods": ["GET", "POST", "OPTIONS"],
  "supported_providers": ["paystack", "flutterwave"]
}
```

✅ **If you see this JSON response, your endpoint is working correctly!**

❌ **If you get a 404 error, the Edge Function is not deployed.** Deploy it first:
```bash
npx supabase functions deploy payment-webhook
```

---

## After Updating

1. **Wait 1-2 minutes** for Flutterwave to update the webhook configuration
2. **Make a test payment** (small amount)
3. **Check Supabase Logs:**
   - Go to: https://supabase.com/dashboard/project/vwcadgjaivvffxwgnkzy/edge-functions/payment-webhook/logs
   - Look for incoming webhook requests
   - Check for any errors

4. **Monitor Payment Processing:**
   - Go to Admin Dashboard → Payment Monitoring
   - Verify the payment appears and is processed correctly

---

## Troubleshooting

### Still getting "requested path is invalid"?
- Double-check the URL has no typos
- Ensure there's no trailing slash
- Verify the Edge Function `payment-webhook` is deployed in Supabase

### Webhook not being received?
- Check Flutterwave webhook logs in their dashboard
- Check Supabase Edge Functions logs
- Verify the webhook URL is saved correctly in Flutterwave

### Payment completed but treats not credited?
- Check Supabase Edge Functions logs for errors
- Use Admin Dashboard → Payment Monitoring to manually verify and credit

---

## Quick Reference

**Your Supabase Project URL:** `https://vwcadgjaivvffxwgnkzy.supabase.co`

**Webhook URL for Flutterwave:**
```
https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook?provider=flutterwave
```

**Webhook URL for Paystack (if needed):**
```
https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook?provider=paystack
```


