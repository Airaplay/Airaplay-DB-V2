# AdMob Quick Fix - Get Ads Showing in 5 Minutes

**Problem:** Ads configured in Admin Dashboard but not showing in Android app
**Solution:** Switch to test ads for immediate results

---

## Fastest Solution (5 Minutes)

### Step 1: Enable Test Ads (2 minutes)

1. **Open Supabase SQL Editor**
   - Go to your Supabase project
   - Click "SQL Editor" in left menu
   - Click "New query"

2. **Run This Command**
   ```sql
   -- Update to test ad units (will show immediately!)
   UPDATE ad_units
   SET unit_id = 'ca-app-pub-3940256099942544/6300978111'
   WHERE placement = 'music_player_bottom_banner';

   UPDATE ad_units
   SET unit_id = 'ca-app-pub-3940256099942544/1033173712'
   WHERE placement = 'after_song_play_interstitial';
   ```

3. **Click "Run"** - Should see "Success" message

---

### Step 2: Rebuild Android App (2 minutes)

```bash
# In your project folder, run:
npm run build:app
npx cap sync android
npx cap open android
```

This will:
- Build your React app for Android
- Copy files to Android folder
- Open Android Studio

---

### Step 3: Test on Physical Device (1 minute)

**CRITICAL:** Must use physical Android device (ads don't work on emulator)

1. **Connect Android phone via USB**
   - Enable "Developer Mode" on phone
   - Enable "USB Debugging"

2. **In Android Studio**
   - Click green "Run" button (▶️)
   - Select your physical device
   - Wait for app to install

3. **Test Ads**
   - Open app
   - Navigate to music player
   - **Banner should appear at bottom** ✅
   - Play a song completely
   - **Interstitial should appear after** ✅

---

## What If Ads Still Don't Show?

### Run Configuration Check

1. **Open Supabase SQL Editor**

2. **Run This Query**
   ```sql
   -- Check your configuration
   SELECT * FROM ad_units WHERE network_id IN (
     SELECT id FROM ad_networks WHERE network = 'admob'
   );
   ```

3. **Verify:**
   - `unit_id` contains test ad IDs (3940256099942544)
   - `is_active` = true
   - `network_id` is not null

---

### Check Android Logs

1. **In Android Studio**
   - Click "Logcat" tab at bottom
   - Filter by "AdMob"

2. **Look For:**
   ```
   ✅ Good: "AdMob initialized successfully"
   ✅ Good: "Banner ad loaded"
   ❌ Bad: "Ad failed to load"
   ❌ Bad: "Invalid ad unit ID"
   ```

3. **If You See Errors:**
   - "Invalid ad unit ID" → Run SQL update again
   - "No fill" → Normal, retry in a minute
   - "Network error" → Check internet connection

---

### Common Mistakes

**❌ Testing on emulator**
- Ads never show on emulators
- Must use physical Android device

**❌ Forgot to rebuild after database change**
- Database changes need app rebuild
- Run: `npm run build:app && npx cap sync android`

**❌ Using real ad unit IDs**
- Real ads need 24-48 hours approval
- Use test ads first to verify integration works

**❌ No internet connection**
- Phone must be online
- Check WiFi/data is working

---

## Test Ad IDs Reference

Use these Google test ad IDs for immediate testing:

| Ad Type | Test Ad Unit ID |
|---------|----------------|
| Banner | `ca-app-pub-3940256099942544/6300978111` |
| Interstitial | `ca-app-pub-3940256099942544/1033173712` |
| Rewarded | `ca-app-pub-3940256099942544/5224354917` |

These ALWAYS show ads immediately (no approval needed).

---

## After Test Ads Work

Once test ads are working, you know your integration is correct!

**Next steps:**

1. **Create AdMob Account**
   - Go to https://apps.admob.google.com
   - Sign up / login with Google account

2. **Create Your App**
   - Click "Apps" → "Add App"
   - Select Android
   - Enter package name: `com.airaplay.app`

3. **Create Ad Units**
   - Click your app → "Ad units" → "Add ad unit"
   - Create banner ad unit
   - Create interstitial ad unit
   - Copy the ad unit IDs

4. **Update Database**
   ```sql
   -- Replace YOUR_REAL_BANNER_ID and YOUR_REAL_INTERSTITIAL_ID
   UPDATE ad_units
   SET unit_id = 'YOUR_REAL_BANNER_ID'
   WHERE placement = 'music_player_bottom_banner';

   UPDATE ad_units
   SET unit_id = 'YOUR_REAL_INTERSTITIAL_ID'
   WHERE placement = 'after_song_play_interstitial';
   ```

5. **Rebuild and Wait**
   - Rebuild app with real ad unit IDs
   - Wait 24-48 hours for Google to approve
   - Ads will start showing automatically

---

## Troubleshooting Checklist

Before asking for help, verify:

- [ ] Using test ad IDs (`3940256099942544`)
- [ ] Tested on **physical device** (not emulator)
- [ ] Rebuilt app after database changes
- [ ] Device has internet connection
- [ ] Ad placements are enabled in database
- [ ] AndroidManifest.xml has AdMob App ID

If all checked and still no ads:
→ See **ADMOB_ANDROID_TROUBLESHOOTING.md** for detailed debugging

---

## Expected Behavior

### Working Correctly

**Banner Ad:**
- Appears at bottom of music player screen
- Shows Google test ad (text or image)
- Size adjusts to screen width
- Stays visible while on screen

**Interstitial Ad:**
- Appears after song finishes playing
- Full screen overlay
- Shows Google test ad
- Closeable after 5 seconds

**Logs Show:**
```
[AdMob] Initialized successfully
[AdMob] Banner ad loaded
[AdMob] Interstitial ad loaded
```

---

## Files Created for You

1. **ENABLE_TEST_ADS.sql** - Quick SQL script to enable test ads
2. **CHECK_AD_CONFIG.sql** - Verify your configuration
3. **ADMOB_ANDROID_TROUBLESHOOTING.md** - Complete troubleshooting guide

---

## Support

**Still stuck?** Check these files:

1. **ADMOB_ANDROID_TROUBLESHOOTING.md** - Detailed troubleshooting
2. **ADMOB_SETUP_INSTRUCTIONS.md** - Initial setup guide
3. **AD_DISPLAY_RULES_OPTIMIZED.md** - Ad display rules reference

**Google Resources:**

- AdMob Help: https://support.google.com/admob
- Android Quick Start: https://developers.google.com/admob/android/quick-start
- Test Ads Guide: https://developers.google.com/admob/android/test-ads

---

**⏱️ Total Time: 5 minutes**
**✅ Success Rate: If test ads show, your integration is 100% working**
