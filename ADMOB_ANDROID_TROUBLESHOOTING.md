# AdMob Not Showing in Android App - Troubleshooting Guide

**Issue:** Ads configured in Admin Dashboard but not showing in Android app
**Status:** 🟡 Configuration Complete - Needs AdMob Account Setup
**Date:** 2026-01-24

---

## Current Configuration Status

### ✅ What's Working

1. **AdMob App ID Configured**
   - App ID: `ca-app-pub-473942199229846~4630726757`
   - Location: AndroidManifest.xml (line 58)
   - Status: Properly configured

2. **Ad Units Configured in Database**
   - Banner Ad: `ca-app-pub-473942199229846/3774323540`
   - Interstitial Ad: `ca-app-pub-473942199229846/6156944302`
   - Status: Active and enabled

3. **Ad Placements Configured**
   - MusicPlayerScreen: Banner + Interstitial
   - MiniMusicPlayer: Banner
   - Status: Enabled with proper screen mapping

4. **Code Integration Complete**
   - AdMob service initialized in index.tsx
   - useAdPlacement hook available
   - Ad display logic implemented

---

## Why Ads Aren't Showing

### 🔴 Critical Issue: Ad Units Not Created in AdMob Console

Your ad unit IDs (`ca-app-pub-473942199229846/3774323540` and `/6156944302`) need to be **created and activated in Google AdMob Console**.

**What this means:**
- The IDs in your database are placeholders
- Google AdMob doesn't know about these ad units yet
- Until you create them in AdMob Console, no ads will load

---

## Solution: Complete AdMob Setup

### Step 1: Create App in AdMob Console

1. **Go to AdMob Console**
   - URL: https://apps.admob.google.com
   - Sign in with your Google account

2. **Add Your App**
   - Click "Apps" in left menu
   - Click "+ ADD APP"
   - Select "Android"
   - App name: "Airaplay" (or your app name)
   - Package name: `com.airaplay.app` (from AndroidManifest.xml)
   - Click "ADD"

3. **Copy Your App ID**
   - After creating app, copy the App ID
   - It should look like: `ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX`
   - **Verify it matches**: `ca-app-pub-473942199229846~4630726757`

---

### Step 2: Create Ad Units

#### Create Banner Ad Unit

1. **In AdMob Console**
   - Click your app name
   - Click "Ad units" tab
   - Click "+ ADD AD UNIT"

2. **Select Ad Format**
   - Choose "Banner"
   - Click "SELECT"

3. **Configure Banner**
   - Ad unit name: "Music Player Bottom Banner"
   - Click "CREATE AD UNIT"

4. **Copy Ad Unit ID**
   - Copy the full Ad Unit ID
   - Should look like: `ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX`
   - **Update in Admin Dashboard** → Ad Management → Ad Units

#### Create Interstitial Ad Unit

1. **Create New Ad Unit**
   - Click "+ ADD AD UNIT" again
   - Select "Interstitial"

2. **Configure Interstitial**
   - Ad unit name: "After Song Play Interstitial"
   - Click "CREATE AD UNIT"

3. **Copy Ad Unit ID**
   - Copy the full Ad Unit ID
   - **Update in Admin Dashboard** → Ad Management → Ad Units

---

### Step 3: Use Test Ads During Development

While waiting for real ads to be approved (can take 24-48 hours), use Google's test ad units.

#### For Testing (Use These IDs Temporarily)

**Update in Admin Dashboard → Ad Management → Ad Units:**

1. **Banner Test Ad**
   - Unit ID: `ca-app-pub-3940256099942544/6300978111`
   - Type: Banner
   - Mark as "Test Unit"

2. **Interstitial Test Ad**
   - Unit ID: `ca-app-pub-3940256099942544/1033173712`
   - Type: Interstitial
   - Mark as "Test Unit"

3. **Rewarded Test Ad** (if needed)
   - Unit ID: `ca-app-pub-3940256099942544/5224354917`
   - Type: Rewarded

**These test ads will show immediately** and confirm your integration works.

---

### Step 4: Update Database with Real Ad Units

Once you create ad units in AdMob Console:

1. **Go to Admin Dashboard**
   - Navigate to "Ad Management" section
   - Click "Ad Units" tab

2. **Update Each Ad Unit**
   - Replace test ad unit IDs with real ones from AdMob
   - Ensure `is_active` is checked
   - Save changes

3. **Verify Ad Placements**
   - Go to "Ad Placements" tab
   - Ensure each placement points to correct ad unit
   - Check `is_enabled` is true

---

## Testing Ads in Android App

### Quick Test Checklist

- [ ] App ID in AndroidManifest.xml matches AdMob Console
- [ ] Ad units created in AdMob Console OR using test IDs
- [ ] Ad units updated in Admin Dashboard
- [ ] Ad placements enabled for screens
- [ ] App rebuilt and installed on device
- [ ] Device has internet connection
- [ ] Not using emulator (ads don't show on emulators)

### Testing on Real Device

**IMPORTANT:** Ads don't show on Android emulators. You must test on a physical device.

1. **Build and Install App**
   ```bash
   npm run build:app
   npx cap sync android
   npx cap open android
   ```

2. **Run in Android Studio**
   - Click "Run" (green play button)
   - Select your physical Android device
   - Wait for app to install and launch

3. **Test Ad Display**
   - Navigate to MusicPlayerScreen
   - Banner should appear at bottom
   - Play a song completely
   - Interstitial should show after playback

4. **Check Logs**
   - Open Android Studio Logcat
   - Filter by "AdMob"
   - Look for initialization and ad load messages

---

## Common Issues & Solutions

### Issue 1: Ads Show Blank Space

**Problem:** Ad placement visible but shows blank/white space

**Solution:**
- Using test ad IDs? They always work
- Using real ad IDs? Wait 24-48 hours for approval
- Check AdMob Console for ad unit status
- Ensure ad units are approved and active

---

### Issue 2: No Ads at All

**Problem:** No ad space visible, nothing happens

**Diagnosis:**
```bash
# Check Android Logcat for errors
adb logcat | grep AdMob
adb logcat | grep Ads
```

**Common Causes:**
1. **App ID mismatch** - Check AndroidManifest.xml vs AdMob Console
2. **Ad units not created** - Create in AdMob Console
3. **Database not updated** - Update ad unit IDs in Admin Dashboard
4. **Ad placements disabled** - Enable in Admin Dashboard → Ad Placements

---

### Issue 3: "Ad failed to load" Error

**Problem:** Seeing error messages in logs

**Solutions:**

**Error: "No fill"**
- Normal for new accounts or low traffic apps
- Use test ad IDs to verify integration works
- Real ads will show more frequently as your app grows

**Error: "Invalid Ad Unit ID"**
- Ad unit ID doesn't exist in AdMob Console
- Create ad unit or use test IDs

**Error: "App ID not found"**
- AndroidManifest.xml App ID doesn't match AdMob Console
- Update AndroidManifest.xml with correct App ID
- Rebuild app

---

### Issue 4: Ads Not Showing on Emulator

**Problem:** Testing on Android emulator

**Solution:** **Ads never show on emulators**. You MUST test on a physical device.

Reasons:
- Google blocks ads on emulators to prevent fraud
- Ad SDKs detect emulator environment
- This is intentional and cannot be bypassed

**Action:** Test on real Android device

---

## Ad Display Rules (Safety Features)

Your app has built-in ad safety rules. Ads may be blocked if:

1. **User is admin** - Admins don't see ads
2. **User is premium** - Premium users ad-free (if implemented)
3. **Country restricted** - Some countries blocked in admin settings
4. **Content type blocked** - Certain content types may disable ads
5. **Display rules** - Admin configured when ads show

**Check:** Admin Dashboard → Ad Management → Display Rules

---

## Verify Everything is Working

### Database Check

```sql
-- Check AdMob network configuration
SELECT * FROM ad_networks WHERE network = 'admob';

-- Check ad units
SELECT id, unit_id, unit_type, is_active
FROM ad_units
WHERE network_id IN (SELECT id FROM ad_networks WHERE network = 'admob');

-- Check ad placements
SELECT placement_key, screen_name, ad_type, is_enabled
FROM ad_placements
WHERE ad_unit_id IN (
  SELECT id FROM ad_units WHERE network_id IN (
    SELECT id FROM ad_networks WHERE network = 'admob'
  )
);
```

### AndroidManifest.xml Check

File: `android/app/src/main/AndroidManifest.xml`

Look for:
```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-473942199229846~4630726757"/>
```

Should match App ID from AdMob Console.

---

## Step-by-Step Testing Plan

### Phase 1: Use Test Ads (5 minutes)

1. Update Admin Dashboard → Ad Units with test IDs:
   - Banner: `ca-app-pub-3940256099942544/6300978111`
   - Interstitial: `ca-app-pub-3940256099942544/1033173712`

2. Rebuild and install app on physical device

3. Navigate to MusicPlayerScreen → Should see test banner

4. Play song completely → Should see test interstitial

**Result:** If test ads show, integration is perfect

---

### Phase 2: Create Real Ad Units (15 minutes)

1. Go to AdMob Console (https://apps.admob.google.com)

2. Create app (if not exists)

3. Create 2 ad units:
   - Banner ad unit
   - Interstitial ad unit

4. Copy real ad unit IDs

5. Update Admin Dashboard with real IDs

6. Rebuild app

**Result:** Ads may not show immediately (needs approval)

---

### Phase 3: Wait for Approval (24-48 hours)

1. Keep using test ads for now

2. Check AdMob Console for approval status

3. When approved, ads will start showing

4. Monitor AdMob Console for:
   - Impressions
   - Clicks
   - Revenue

---

## Expected Behavior (When Working)

### Banner Ads
- **Location:** Bottom of MusicPlayerScreen
- **Display:** Always visible while on screen
- **Size:** Adaptive banner (adjusts to screen width)
- **Refresh:** Automatically every 30-60 seconds

### Interstitial Ads
- **Location:** After song playback completes
- **Display:** Full screen, covers content
- **Dismissible:** User can close after 5 seconds
- **Frequency:** Max once per session per song

---

## AdMob Console Monitoring

After ads are live, monitor performance:

1. **Dashboard**
   - Daily impressions
   - Click-through rate (CTR)
   - Estimated earnings

2. **Ad Units**
   - Performance per ad unit
   - Fill rate
   - eCPM (revenue per 1000 impressions)

3. **Reports**
   - Detailed analytics
   - Country breakdown
   - Time-based trends

---

## Revenue Split Configuration

Your app uses this revenue model:

- **50%** - Creator (music artist)
- **10%** - Listener (viewer)
- **40%** - Platform (admin)

**Configured in:**
- Database: `ad_revenue_split_config` table
- Code: `adRevenueService.ts`

**Revenue tracking:**
- All ad impressions logged to `ad_impressions` table
- Revenue calculated and split automatically
- View in Admin Dashboard → Analytics → Ad Revenue

---

## Next Steps Summary

### Immediate Actions (Do This Now)

1. **Use Test Ads**
   - Update Admin Dashboard with test ad unit IDs
   - Rebuild app: `npm run build:app && npx cap sync android`
   - Test on physical device
   - Verify ads show

2. **Create AdMob Account** (if not done)
   - Sign up at https://apps.admob.google.com
   - Complete account verification

3. **Create Real Ad Units**
   - Add your app to AdMob Console
   - Create banner ad unit
   - Create interstitial ad unit
   - Copy real ad unit IDs

4. **Update Database**
   - Admin Dashboard → Ad Management → Ad Units
   - Replace test IDs with real IDs
   - Save changes

5. **Wait for Approval**
   - Keep using test ads
   - Check AdMob Console daily
   - When approved, real ads start showing

---

## Support Resources

**AdMob Help Center:**
https://support.google.com/admob

**Common Issues:**
https://support.google.com/admob/answer/9905175

**AdMob Integration Guide:**
https://developers.google.com/admob/android/quick-start

**Capacitor AdMob Plugin:**
https://github.com/capacitor-community/admob

---

## Configuration Files Reference

### 1. AndroidManifest.xml
```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-473942199229846~4630726757"/>
```

### 2. Database Tables
- `ad_networks` - AdMob network config
- `ad_units` - Ad unit IDs
- `ad_placements` - Where ads show
- `ad_impressions` - Ad tracking logs

### 3. Code Files
- `src/lib/admobService.ts` - AdMob SDK wrapper
- `src/hooks/useAdMob.ts` - React hook for ads
- `src/hooks/useAdPlacement.ts` - Placement management
- `src/index.tsx` - AdMob initialization (line 591)

---

## Status Checklist

- [x] AdMob App ID configured in AndroidManifest.xml
- [x] Ad network configured in database
- [x] Ad units configured in database
- [x] Ad placements configured in database
- [x] AdMob service initialized in app
- [ ] **Ad units created in AdMob Console** ← YOU ARE HERE
- [ ] **Test ads verified working**
- [ ] **Real ad units approved by Google**
- [ ] **Ads showing and generating revenue**

---

**Current Status:** Configuration complete, waiting for AdMob Console setup

**Action Required:** Create ad units in AdMob Console or use test ad IDs for immediate testing

**Estimated Time to See Ads:** 5 minutes (test ads) or 24-48 hours (real ads after approval)
