# Quick Fix: "requested path is invalid" Error

## ⚡ Immediate Actions

### Step 1: Test Your Webhook Endpoint

Open this URL in your browser:
```
https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook
```

**If you see a JSON response like this:**
```json
{
  "status": "ok",
  "message": "Payment webhook endpoint is active",
  ...
}
```
✅ **Your endpoint is working!** Proceed to Step 2.

**If you see a 404 error:**
❌ **Edge Function is not deployed.** Run Step 1b first.

### Step 1b: Deploy the Edge Function (if needed)

Open terminal in your project directory and run:
```bash
npx supabase functions deploy payment-webhook
```

Wait for deployment to complete, then test the URL again.

---

### Step 2: Configure in Flutterwave Dashboard

1. Go to: https://dashboard.flutterwave.com
2. Navigate to: **Settings** → **Webhooks**
3. **Delete** any existing webhook for this endpoint
4. Click **Add Webhook**
5. Enter this **EXACT** URL (no trailing slash):
   ```
   https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook?provider=flutterwave
   ```
6. Click **Save**

**Important:** Copy the URL exactly - no trailing slash, no extra characters!

---

### Step 3: Verify

1. Flutterwave should accept the URL without error
2. The webhook should appear as "Active" in Flutterwave
3. Make a test payment to verify it's working

---

## 🔍 Common Issues

### "Still getting the error after deploying?"

1. **Wait 2-3 minutes** - Flutterwave may need time to validate
2. **Double-check the URL** - Must include `/functions/v1/payment-webhook`
3. **No trailing slash** - Remove any `/` at the end
4. **Use HTTPS** - Not HTTP

### "404 error when testing in browser?"

The Edge Function is not deployed. Deploy it:
```bash
npx supabase login
npx supabase link --project-ref vwcadgjaivvffxwgnkzy
npx supabase functions deploy payment-webhook
```

### "Browser test works but Flutterwave still errors?"

1. Delete the webhook in Flutterwave dashboard
2. Wait 1 minute
3. Add it again with the exact URL
4. Make sure there's NO trailing slash

---

## ✅ Success Checklist

- [ ] Browser test returns JSON with `"status": "ok"`
- [ ] Edge Function is deployed (check Supabase dashboard)
- [ ] URL in Flutterwave is exactly: `https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook?provider=flutterwave`
- [ ] No trailing slash in the URL
- [ ] Flutterwave accepts the URL without error
- [ ] Webhook shows as "Active" in Flutterwave dashboard

---

**Need more help?** See `FLUTTERWAVE_WEBHOOK_TROUBLESHOOTING.md` for detailed troubleshooting.




