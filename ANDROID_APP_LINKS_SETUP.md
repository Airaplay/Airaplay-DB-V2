# Android App Links Setup for Payment Callbacks

This guide configures your app to handle payment callback URLs from Flutterwave when users complete purchases.

## What This Does

When Flutterwave redirects users to `https://www.airaplay.com/?payment=success&...`, Android will automatically open your Airaplay app instead of a browser.

## Setup Steps

### 1. Get Your Release Key SHA-256 Fingerprint

**For Production Release:**

```bash
# Navigate to your keystore location
cd /path/to/your/keystore

# Get the SHA-256 fingerprint
keytool -list -v -keystore your-release-key.keystore -alias your-key-alias
```

Look for the `SHA256` line in the output and copy the fingerprint (format: `XX:XX:XX:...`).

**For Debug/Testing (Optional):**

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

### 2. Update assetlinks.json

Edit `public/.well-known/assetlinks.json` and replace `YOUR_RELEASE_KEY_SHA256_FINGERPRINT_HERE` with your actual fingerprint:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.airaplay.app",
      "sha256_cert_fingerprints": [
        "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5"
      ]
    }
  }
]
```

**Note:** Remove colons (`:`) from the fingerprint when adding it to the JSON file.

### 3. Deploy assetlinks.json to Your Domain

The file MUST be accessible at:
```
https://www.airaplay.com/.well-known/assetlinks.json
```

**Verification:**
- URL must return HTTP 200
- Content-Type must be `application/json`
- File must be accessible without redirects

Test it:
```bash
curl -I https://www.airaplay.com/.well-known/assetlinks.json
```

### 4. Set Supabase Secrets

In Supabase Dashboard → Functions → Secrets, add:

```
FRONTEND_URL=https://www.airaplay.com
APP_URL=https://www.airaplay.com
```

Or via CLI:
```bash
npx supabase secrets set FRONTEND_URL=https://www.airaplay.com
npx supabase secrets set APP_URL=https://www.airaplay.com
```

### 5. Rebuild Android App

```bash
npm run build
npx cap sync android
npx cap open android
```

Then build the release APK/AAB in Android Studio.

## Testing

### Test Deep Links (Custom Scheme)

```bash
adb shell am start -a android.intent.action.VIEW -d "airaplay://payment?status=success&ref=test123"
```

### Test App Links (Web URLs)

```bash
adb shell am start -a android.intent.action.VIEW -d "https://www.airaplay.com/?payment=success&provider=flutterwave&reference=test123"
```

Both should open your Airaplay app and show the payment callback handling.

## How Payment Flow Works

1. User initiates payment in app
2. App opens Flutterwave payment page
3. User completes payment
4. Flutterwave redirects to: `https://www.airaplay.com/?payment=success&provider=flutterwave&reference=XXX`
5. Android detects the URL matches your App Link configuration
6. Android opens Airaplay app (instead of browser)
7. App's deep link handler in `src/index.tsx` (lines 199-252) processes the payment status

## Troubleshooting

### App Links Not Working?

1. **Verify assetlinks.json is accessible:**
   ```bash
   curl https://www.airaplay.com/.well-known/assetlinks.json
   ```

2. **Check Android verification:**
   ```bash
   adb shell pm get-app-links com.airaplay.app
   ```

3. **Reset App Links verification:**
   ```bash
   adb shell pm set-app-links --package com.airaplay.app 0 all
   adb shell pm verify-app-links --re-verify com.airaplay.app
   ```

4. **View verification results:**
   ```bash
   adb shell pm get-app-links com.airaplay.app
   ```

### Custom Scheme Always Works

Even if App Links fail, the custom scheme `airaplay://` will always work as a fallback. Consider updating Flutterwave redirect URLs to use `airaplay://payment?...` for more reliable deep linking.

## Important Notes

- App Links require HTTPS (won't work with HTTP)
- The assetlinks.json file must be at the root domain, not a subdomain
- Google Play may take 24-48 hours to verify App Links after first upload
- Test on a real device or emulator running Android 6.0+
