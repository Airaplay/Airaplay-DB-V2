/*
  ENABLE TEST ADS FOR IMMEDIATE TESTING

  Use this script to switch to Google's official test ad units.
  Test ads will show immediately (no approval needed).

  Run this in Supabase SQL Editor to enable test ads.

  After running this, rebuild your Android app:
  1. npm run build:app
  2. npx cap sync android
  3. Install on physical Android device
  4. Ads should show immediately!
*/

-- Update banner ad unit to use Google's test ad ID
UPDATE ad_units
SET
  unit_id = 'ca-app-pub-3940256099942544/6300978111',
  updated_at = now()
WHERE placement = 'music_player_bottom_banner';

-- Update interstitial ad unit to use Google's test ad ID
UPDATE ad_units
SET
  unit_id = 'ca-app-pub-3940256099942544/1033173712',
  updated_at = now()
WHERE placement = 'after_song_play_interstitial';

-- Verify the changes
SELECT
  placement,
  unit_type,
  unit_id,
  is_active,
  CASE
    WHEN unit_id LIKE '%3940256099942544%' THEN '✅ TEST AD (will show immediately)'
    ELSE '⏳ REAL AD (needs AdMob approval)'
  END as status
FROM ad_units
WHERE network_id IN (SELECT id FROM ad_networks WHERE network = 'admob');

/*
  EXPECTED OUTPUT:

  placement                      | unit_type     | unit_id                                  | status
  -------------------------------|---------------|------------------------------------------|---------------------------
  music_player_bottom_banner     | banner        | ca-app-pub-3940256099942544/6300978111  | ✅ TEST AD (will show immediately)
  after_song_play_interstitial   | interstitial  | ca-app-pub-3940256099942544/1033173712  | ✅ TEST AD (will show immediately)


  NEXT STEPS:

  1. Rebuild Android app:
     npm run build:app
     npx cap sync android

  2. Open in Android Studio:
     npx cap open android

  3. Install on PHYSICAL Android device (not emulator)

  4. Test:
     - Open app
     - Go to MusicPlayerScreen
     - You should see banner at bottom
     - Play a song completely
     - Interstitial should show after

  5. If ads show:
     ✅ Your integration is working!
     → Now create real ad units in AdMob Console
     → Replace test IDs with real ad unit IDs
     → Wait 24-48 hours for Google approval

  6. If ads DON'T show:
     → Check ADMOB_ANDROID_TROUBLESHOOTING.md
     → Verify you're testing on physical device (not emulator)
     → Check Android Logcat for AdMob errors
*/