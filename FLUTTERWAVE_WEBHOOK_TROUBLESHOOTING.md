# Flutterwave Webhook Error: "requested path is invalid" - Complete Fix Guide

## The Error

When configuring a webhook in Flutterwave dashboard, you may see:
```json
{"error": "requested path is invalid"}
```

This error occurs when Flutterwave tries to validate your webhook URL and cannot reach or validate the endpoint.

---

## Quick Fix Checklist

### ✅ Step 1: Verify Your Supabase Project URL

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy your **Project URL** (example: `https://vwcadgjaivvffxwgnkzy.supabase.co`)

### ✅ Step 2: Verify the Edge Function is Deployed

1. In Supabase Dashboard, go to **Edge Functions**
2. Look for `payment-webhook` function
3. Verify it shows as **"Active"** or **"Deployed"**
4. If not deployed:
   ```bash
   # From your project root directory
   npx supabase functions deploy payment-webhook
   ```

### ✅ Step 3: Test the Webhook Endpoint Manually

Open this URL in your browser (replace with your actual Supabase URL):
```
https://YOUR_SUPABASE_PROJECT_URL/functions/v1/payment-webhook
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

**If you see this response, your endpoint is working correctly!**

If you get an error, the Edge Function may not be deployed. Deploy it first before configuring in Flutterwave.

---

## ✅ Step 4: Configure Webhook URL in Flutterwave Dashboard

### Correct Webhook URL Format

```
https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook?provider=flutterwave
```

**Important Points:**
- ✅ **MUST** include `/functions/v1/payment-webhook`
- ✅ **MUST** use HTTPS (not HTTP)
- ✅ **NO** trailing slash at the end
- ✅ The `?provider=flutterwave` is optional but recommended
- ❌ **DO NOT** use just the base URL: `https://vwcadgjaivvffxwgnkzy.supabase.co`

### Steps in Flutterwave Dashboard

1. Go to [Flutterwave Dashboard](https://dashboard.flutterwave.com)
2. Navigate to **Settings** → **Webhooks**
3. Click **Add Webhook** or **Edit** existing webhook
4. Enter the webhook URL exactly as shown above (with your project URL)
5. **DO NOT** add a trailing slash
6. Click **Save** or **Update**

---

## Common Mistakes to Avoid

### ❌ Wrong URL Formats

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| `https://vwcadgjaivvffxwgnkzy.supabase.co` | `https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook` |
| `https://vwcadgjaivvffxwgnkzy.supabase.co/payment-webhook` | `https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook` |
| `https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook/` | `https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook` |
| `http://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook` | `https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook` |

### ❌ Common Issues

1. **Missing `/functions/v1/` path** - Most common mistake
2. **Trailing slash** - Causes path validation to fail
3. **Using HTTP instead of HTTPS** - Flutterwave requires HTTPS
4. **Edge Function not deployed** - Endpoint won't exist
5. **Typos in URL** - Double-check every character

---

## Detailed Troubleshooting Steps

### Issue 1: Edge Function Not Deployed

**Symptoms:**
- Browser shows 404 when testing the endpoint
- Flutterwave returns "requested path is invalid"

**Solution:**
1. Make sure you have Supabase CLI installed:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   npx supabase login
   ```

3. Link your project (if not already linked):
   ```bash
   npx supabase link --project-ref vwcadgjaivvffxwgnkzy
   ```

4. Deploy the webhook function:
   ```bash
   npx supabase functions deploy payment-webhook
   ```

5. Wait for deployment to complete (check Supabase dashboard)
6. Test the endpoint again in your browser
7. Retry configuring in Flutterwave dashboard

### Issue 2: URL Format Error

**Symptoms:**
- Edge Function is deployed
- Browser test works
- But Flutterwave still shows error

**Solution:**
1. Copy the exact URL from your browser test (the one that worked)
2. Go to Flutterwave dashboard
3. Delete the existing webhook configuration
4. Create a new webhook with the exact URL
5. **Double-check for:**
   - No trailing slash
   - Full path: `/functions/v1/payment-webhook`
   - HTTPS protocol
   - Correct project URL

### Issue 3: CORS or Network Issues

**Symptoms:**
- Edge Function is deployed
- Browser test works locally
- Flutterwave cannot validate

**Solution:**
1. Check Supabase Edge Functions logs:
   - Go to Supabase Dashboard → Edge Functions → payment-webhook → Logs
   - Look for incoming requests from Flutterwave
   - Check for any errors

2. Verify CORS headers are correct (already configured in the function)

3. Wait 2-3 minutes after saving webhook in Flutterwave - sometimes validation takes time

---

## Testing the Webhook

### Test 1: Health Check (Browser)

Open in browser:
```
https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook
```

Should return JSON with status "ok".

### Test 2: With cURL

```bash
curl -X GET "https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook" \
  -H "Content-Type: application/json"
```

Should return:
```json
{"status":"ok","message":"Payment webhook endpoint is active",...}
```

### Test 3: Test Payment

1. Make a small test payment using Flutterwave
2. Check Supabase Edge Functions logs for webhook reception
3. Verify payment is processed in Admin Dashboard → Payment Monitoring

---

## Verification Steps

After configuring the webhook:

1. ✅ **Browser test passes** - Endpoint returns health check JSON
2. ✅ **Flutterwave dashboard accepts URL** - No error when saving
3. ✅ **Webhook appears in Flutterwave** - Listed as active webhook
4. ✅ **Test payment works** - Payment is processed automatically
5. ✅ **Logs show webhook received** - Check Supabase Edge Functions logs

---

## Still Having Issues?

### Check These:

1. **Supabase Project Status**
   - Is your project paused? (Check project status in dashboard)
   - Is your project on the free tier? (May have rate limits)

2. **Flutterwave Account Status**
   - Is your account in test mode? (Use test keys if testing)
   - Is your account active?

3. **Network/Firewall**
   - Are you behind a corporate firewall?
   - Try from a different network

4. **Logs**
   - Check Supabase Edge Functions logs
   - Check Flutterwave webhook logs (in their dashboard)

### Get Help

If still experiencing issues:

1. Copy your exact webhook URL
2. Screenshot the error from Flutterwave dashboard
3. Check Supabase Edge Functions logs and copy recent entries
4. Test the endpoint in browser and copy the response
5. Provide all this information for troubleshooting

---

## Quick Reference

**Your Webhook URL:**
```
https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook?provider=flutterwave
```

**Test URL (Health Check):**
```
https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook
```

**Edge Function Name:** `payment-webhook`

**Deploy Command:**
```bash
npx supabase functions deploy payment-webhook
```

---

## Success Indicators

You'll know it's working when:

✅ Browser test returns health check JSON  
✅ Flutterwave dashboard accepts the URL without error  
✅ Webhook is listed as "Active" in Flutterwave  
✅ Test payments are processed automatically  
✅ Logs show webhook requests being received  
✅ Payment Monitoring shows completed payments  

---

**Last Updated:** After adding health check endpoint support




