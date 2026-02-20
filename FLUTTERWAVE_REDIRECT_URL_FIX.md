# Flutterwave "requested path is invalid" Error Fix

## The Problem

After a successful Flutterwave payment, you're seeing:
```json
{"error": "requested path is invalid"}
```

This error occurs because:
1. **Redirect URL is incorrect** - Currently pointing to Supabase URL instead of your frontend app
2. **Webhook validation failing** - Flutterwave can't validate the webhook endpoint

## Quick Fix

### Step 1: Set Frontend URL Environment Variable

You need to set the `FRONTEND_URL` environment variable in Supabase to point to your actual frontend app URL.

**Option A: Using Supabase Dashboard**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `vwcadgjaivvffxwgnkzy`
3. Navigate to **Edge Functions** → **Settings** (or **Project Settings** → **Edge Functions**)
4. Add a new environment variable:
   - **Name:** `FRONTEND_URL`
   - **Value:** Your frontend app URL (e.g., `https://airaplay.com` or `https://your-app.netlify.app`)
5. Save the changes

**Option B: Using Supabase CLI**

```bash
# Set the frontend URL
npx supabase secrets set FRONTEND_URL=https://your-frontend-url.com
```

**What is your frontend URL?**
- If hosted on Netlify: `https://your-app.netlify.app`
- If hosted on Vercel: `https://your-app.vercel.app`
- If using custom domain: `https://airaplay.com` (or your actual domain)
- If using Supabase hosting: `https://vwcadgjaivvffxwgnkzy.supabase.co` (current fallback)

### Step 2: Verify Webhook URL in Flutterwave

Make sure your Flutterwave webhook URL is set to:

```
https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook-flutterwave
```

**Important:**
- ✅ Use the **separate Flutterwave webhook URL** (not the old unified one)
- ✅ No trailing slash
- ✅ Use HTTPS
- ✅ Full path: `/functions/v1/payment-webhook-flutterwave`

### Step 3: Redeploy Functions

After setting the environment variable, redeploy the functions:

```bash
npx supabase functions deploy process-payment
npx supabase functions deploy payment-webhook-flutterwave
```

## Testing

1. **Test the redirect URL:**
   - Make a test payment
   - After payment, you should be redirected to: `https://your-frontend-url.com/?payment=success&provider=flutterwave&reference=treat_XXX`
   - The app should handle this and redirect to home screen

2. **Check webhook logs:**
   - Go to Supabase Dashboard → Edge Functions → payment-webhook-flutterwave → Logs
   - Look for successful POST requests from Flutterwave

3. **Verify payment processing:**
   - Check Admin Dashboard → Payment Monitoring
   - Payment should appear as "completed" and treats should be credited

## Current Configuration

**Webhook URL (Flutterwave Dashboard):**
```
https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook-flutterwave
```

**Redirect URL (after payment):**
```
https://YOUR_FRONTEND_URL/?payment=success&provider=flutterwave&reference=treat_XXX
```

## Still Getting the Error?

If you're still seeing the error after setting `FRONTEND_URL`:

1. **Check the exact error message** - Is it from Flutterwave dashboard or after payment?
2. **Check Supabase logs** - Look for 401 errors in Edge Functions logs
3. **Verify webhook URL** - Make sure it's exactly as shown above
4. **Test the webhook endpoint:**
   ```bash
   curl -X GET "https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook-flutterwave"
   ```
   Should return a health check JSON response

## Next Steps

1. Set `FRONTEND_URL` environment variable in Supabase
2. Redeploy the functions
3. Update Flutterwave webhook URL if needed
4. Test a payment
5. Verify redirect works correctly

---

**Need Help?** Share:
- Your frontend app URL
- The exact error message you're seeing
- When the error occurs (during webhook config or after payment)




