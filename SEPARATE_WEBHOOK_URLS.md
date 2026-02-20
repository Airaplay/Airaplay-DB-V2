# Separate Webhook URLs for Flutterwave and Paystack

## ✅ New Separate Webhook Endpoints

We've created dedicated webhook endpoints for each payment provider to make configuration easier and troubleshooting simpler.

---

## 🔗 Webhook URLs

### Flutterwave Webhook URL
```
https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook-flutterwave
```

### Paystack Webhook URL
```
https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook-paystack
```

---

## 📋 Configuration Steps

### Flutterwave Configuration

1. **Go to Flutterwave Dashboard**
   - Visit: https://dashboard.flutterwave.com
   - Log in to your account

2. **Navigate to Webhooks**
   - Go to **Settings** → **Webhooks**
   - Click **Add Webhook** or **Edit** existing webhook

3. **Enter the Webhook URL**
   ```
   https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook-flutterwave
   ```
   - ✅ Must include `/functions/v1/payment-webhook-flutterwave`
   - ✅ Use HTTPS (not HTTP)
   - ✅ No trailing slash at the end
   - ✅ No query parameters needed

4. **Save the Configuration**
   - Click **Save** or **Update**
   - Flutterwave will validate the endpoint

---

### Paystack Configuration

1. **Go to Paystack Dashboard**
   - Visit: https://dashboard.paystack.com
   - Log in to your account

2. **Navigate to Webhooks**
   - Go to **Settings** → **Webhooks**
   - Click **Add Webhook**

3. **Enter the Webhook URL**
   ```
   https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook-paystack
   ```
   - ✅ Must include `/functions/v1/payment-webhook-paystack`
   - ✅ Use HTTPS (not HTTP)
   - ✅ No trailing slash at the end

4. **Save the Configuration**
   - Click **Save Changes**
   - Paystack will display a Webhook Secret (copy and store this)

---

## ✅ Testing the Endpoints

### Test Flutterwave Webhook (Health Check)

Open in browser:
```
https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook-flutterwave?apikey=YOUR_ANON_KEY
```

Expected response:
```json
{
  "status": "ok",
  "message": "Flutterwave payment webhook endpoint is active",
  "provider": "flutterwave",
  "endpoint": "/functions/v1/payment-webhook-flutterwave",
  "supported_methods": ["GET", "POST", "OPTIONS"]
}
```

### Test Paystack Webhook (Health Check)

Open in browser:
```
https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook-paystack?apikey=YOUR_ANON_KEY
```

Expected response:
```json
{
  "status": "ok",
  "message": "Paystack payment webhook endpoint is active",
  "provider": "paystack",
  "endpoint": "/functions/v1/payment-webhook-paystack",
  "supported_methods": ["GET", "POST", "OPTIONS"]
}
```

**Note:** Replace `YOUR_ANON_KEY` with your actual Supabase anon key from the dashboard.

---

## 🔍 Verification Checklist

After configuring:

- [ ] Flutterwave webhook URL configured in dashboard
- [ ] Paystack webhook URL configured in dashboard
- [ ] Both endpoints return health check JSON when tested
- [ ] Test payment with Flutterwave completes successfully
- [ ] Test payment with Paystack completes successfully
- [ ] Check Supabase Edge Functions logs for webhook activity
- [ ] Payments appear in Admin Dashboard → Payment Monitoring

---

## 🆘 Troubleshooting

### "requested path is invalid" Error (Flutterwave)

**Solution:**
1. Verify the URL is exactly: `https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook-flutterwave`
2. No trailing slash
3. Use HTTPS (not HTTP)
4. Check that the function is deployed in Supabase dashboard

### Webhook Not Received

1. **Check Function Logs:**
   - Go to: https://supabase.com/dashboard/project/vwcadgjaivvffxwgnkzy/functions
   - Click on the respective webhook function
   - View **Logs** tab for incoming requests

2. **Check Payment Provider Logs:**
   - Flutterwave: Dashboard → Settings → Webhooks → View logs
   - Paystack: Dashboard → Settings → Webhooks → View delivery logs

3. **Verify Webhook URL:**
   - Double-check the URL is correct in payment provider dashboard
   - Test the health check endpoint in browser

---

## 📝 Quick Reference

### Flutterwave
- **Webhook URL:** `https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook-flutterwave`
- **Function Name:** `payment-webhook-flutterwave`
- **Event Type:** `charge.completed`

### Paystack
- **Webhook URL:** `https://vwcadgjaivvffxwgnkzy.supabase.co/functions/v1/payment-webhook-paystack`
- **Function Name:** `payment-webhook-paystack`
- **Event Type:** `charge.success`

---

## ✨ Benefits of Separate Endpoints

1. **Cleaner Configuration** - Each provider has its own dedicated endpoint
2. **Easier Troubleshooting** - Separate logs for each provider
3. **Better Organization** - Clear separation of concerns
4. **Simpler Maintenance** - Update one provider without affecting the other

---

**Both webhook functions are now deployed and ready to use!**




