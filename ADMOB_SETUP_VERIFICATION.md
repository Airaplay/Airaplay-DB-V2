# AdMob Setup Verification Guide

This document ensures your Google AdMob integration is fully configured and will work correctly after building the app in Android Studio.

## ✅ Pre-Build Checklist

### 1. Android Manifest Configuration ✓
**File**: `android/app/src/main/AndroidManifest.xml`

- [x] **App ID is correctly set**:
  ```xml
  <meta-data
      android:name="com.google.android.gms.ads.APPLICATION_ID"
      android:value="ca-app-pub-4739421992298461~4630726757"/>
  ```
  ✅ **Status**: Configured with your production App ID

- [x] **INTERNET permission is present**:
  ```xml
  <uses-permission android:name="android.permission.INTERNET" />
  ```
  ✅ **Status**: Present

### 2. Database Configuration ✓
**File**: `supabase/migrations/20251201052838_update_admob_configuration.sql`

- [ ] **Apply the migration** to update your database:
  - App ID: `ca-app-pub-7668216919557427~8734990279`
  - Publisher ID: `pub-7668216919557427`
  
  **How to apply**:
  1. Go to Supabase Dashboard → SQL Editor
  2. Copy and paste the migration SQL
  3. Execute it

- [ ] **Verify database entry**:
  ```sql
  SELECT * FROM ad_networks WHERE network = 'admob';
  ```
  Should return:
  - `app_id`: `ca-app-pub-4739421992298461~4630726757`
  - `api_key`: `pub-4739421992298461`
  - `is_active`: `true`

### 3. Ad Unit IDs Configuration ⚠️ **REQUIRED**

**IMPORTANT**: You need to create production Ad Unit IDs in your AdMob dashboard and add them to the database.

#### Steps to Create Ad Units in AdMob:
1. Go to [AdMob Console](https://apps.admob.com/)
2. Select your app: **Airaplay** (or create it if not exists)
3. Create the following ad units:
   - **Banner Ad Unit** (e.g., `ca-app-pub-4739421992298461/XXXXXXXX`)
   - **Interstitial Ad Unit** (e.g., `ca-app-pub-4739421992298461/YYYYYYYY`)
   - **Rewarded Ad Unit** (e.g., `ca-app-pub-4739421992298461/ZZZZZZZZ`)

#### Add Ad Units to Database:
Via Admin Dashboard → Ad Management → Ad Units, or via SQL:

```sql
-- First, get the AdMob network ID
SELECT id FROM ad_networks WHERE network = 'admob';

-- Then insert ad units (replace NETWORK_ID_UUID with the ID from above)
INSERT INTO ad_units (network_id, unit_type, unit_id, placement, is_active)
VALUES 
  ('NETWORK_ID_UUID', 'banner', 'ca-app-pub-4739421992298461/YOUR_BANNER_ID', 'home_screen', true),
  ('NETWORK_ID_UUID', 'interstitial', 'ca-app-pub-4739421992298461/YOUR_INTERSTITIAL_ID', 'between_songs', true),
  ('NETWORK_ID_UUID', 'rewarded', 'ca-app-pub-4739421992298461/YOUR_REWARDED_ID', 'after_video', true);
```

### 4. Code Configuration ✓

#### Package Dependencies ✓
- [x] `@capacitor-community/admob`: `^7.0.3` in `package.json`
- [x] Plugin registered in `android/capacitor.settings.gradle`
- [x] Plugin included in `android/app/capacitor.build.gradle`

#### Initialization Code ✓
**File**: `src/index.tsx`
- [x] AdMob service initialized on app start
- [x] Fallback test ad IDs configured (for development)
- [x] Test mode enabled in development: `testMode: import.meta.env.MODE === 'development'`

**File**: `src/lib/admobService.ts`
- [x] Loads App ID from database first
- [x] Falls back to hardcoded App ID if database fails
- [x] Proper error handling and logging
- [x] Native platform check (only runs on native, not web)

### 5. Android Build Configuration ✓

- [x] **Capacitor plugin registered**: `android/capacitor.settings.gradle`
- [x] **Plugin dependency added**: `android/app/capacitor.build.gradle`
- [x] **Plugin metadata**: `android/app/src/main/assets/capacitor.plugins.json`

### 6. Testing Configuration

#### Test Mode
- [x] Test mode automatically enabled in development
- [x] Test ad IDs used when `testMode: true`
- [ ] **Add your test device ID** (optional, for testing on real devices):
  ```typescript
  testingDevices: ['YOUR_TEST_DEVICE_ID'] // Get from logcat when running app
  ```

#### Production Mode
- [x] Test mode disabled in production builds
- [ ] **Verify production ad units are active** in AdMob dashboard
- [ ] **Wait 24-48 hours** after creating ad units before expecting ads (AdMob needs time to serve ads)

## 🔧 Build Process Verification

### Before Building in Android Studio:

1. **Sync Gradle**:
   ```bash
   cd android
   ./gradlew clean
   ./gradlew build
   ```

2. **Verify Capacitor sync**:
   ```bash
   npx cap sync android
   ```

3. **Check for errors**:
   - No compilation errors
   - No missing dependencies
   - AdMob plugin loads correctly

### During Build:

1. **Check logcat** for AdMob initialization:
   ```
   AdMob initialized successfully with App ID: ca-app-pub-4739421992298461~4630726757
   ```

2. **Verify no errors**:
   - No "AdMob not initialized" errors
   - No "Invalid App ID" errors
   - No missing ad unit ID errors

### After Building:

1. **Test on a real device** (not emulator for best results)
2. **Check ad display**:
   - Banner ads appear
   - Interstitial ads show when triggered
   - Rewarded ads work correctly

## 🚨 Common Issues & Solutions

### Issue 1: "AdMob not initialized"
**Solution**: 
- Check if App ID is correct in AndroidManifest.xml
- Verify database has the correct App ID
- Check logcat for initialization errors

### Issue 2: "No ad to show" / "Ad unit ID not found"
**Solution**:
- Verify ad units are created in AdMob dashboard
- Check ad units are added to database
- Ensure ad units are active (`is_active = true`)
- Wait 24-48 hours after creating new ad units

### Issue 3: "Invalid App ID"
**Solution**:
- Verify App ID format: `ca-app-pub-4739421992298461~4630726757`
- Ensure App ID matches between AndroidManifest and database
- Check for typos in App ID

### Issue 4: Ads not showing in production
**Solution**:
- Verify ad units are approved in AdMob dashboard
- Check ad units are not in "Limited" status
- Ensure app is published or in testing (AdMob needs time to serve ads)
- Check AdMob account is in good standing

### Issue 5: Test ads showing in production
**Solution**:
- Verify `testMode: false` in production builds
- Check `import.meta.env.MODE === 'production'`
- Remove test device IDs from production builds

## 📋 Final Verification Checklist

Before releasing to production:

- [ ] AndroidManifest.xml has correct App ID
- [ ] Database migration applied successfully
- [ ] Ad units created in AdMob dashboard
- [ ] Ad units added to database via Admin Dashboard
- [ ] Test mode disabled in production
- [ ] App builds successfully without errors
- [ ] AdMob initializes without errors (check logcat)
- [ ] Test ads work in development
- [ ] Production ad units are approved in AdMob
- [ ] App tested on real device
- [ ] No console errors related to AdMob

## 📝 Important Notes

1. **AdMob Approval Time**: New ad units may take 24-48 hours to start serving ads
2. **Test Ads**: Always use test ad IDs during development to avoid policy violations
3. **Production Ads**: Only use production ad unit IDs in production builds
4. **App Review**: Ensure your app complies with AdMob policies before submitting
5. **Revenue**: Ad revenue may take time to appear in AdMob dashboard

## 🔗 Useful Links

- [AdMob Console](https://apps.admob.com/)
- [AdMob Documentation](https://developers.google.com/admob)
- [Capacitor AdMob Plugin](https://github.com/capacitor-community/admob)
- [AdMob Policy Center](https://support.google.com/admob/answer/6128543)

---

**Last Updated**: 2025-12-01
**App ID**: `ca-app-pub-4739421992298461~4630726757`
**Publisher ID**: `pub-4739421992298461`

