/*
  CHECK AD CONFIGURATION STATUS

  Run this query to verify your AdMob setup is correct.
  This will show you what's configured and what's missing.
*/

-- 1. Check AdMob Network Configuration
SELECT
  '1. AdMob Network' as check_item,
  CASE
    WHEN EXISTS (SELECT 1 FROM ad_networks WHERE network = 'admob' AND is_active = true)
    THEN '✅ Configured and Active'
    ELSE '❌ Not configured or inactive'
  END as status,
  COALESCE(app_id, 'NOT SET') as app_id
FROM ad_networks
WHERE network = 'admob'
UNION ALL

-- 2. Check Ad Units
SELECT
  '2. Ad Units' as check_item,
  CASE
    WHEN COUNT(*) >= 2 THEN '✅ ' || COUNT(*)::text || ' ad units configured'
    WHEN COUNT(*) = 1 THEN '⚠️ Only 1 ad unit (need banner + interstitial)'
    ELSE '❌ No ad units configured'
  END as status,
  STRING_AGG(unit_type || ' (' ||
    CASE
      WHEN unit_id LIKE '%3940256099942544%' THEN 'TEST'
      ELSE 'REAL'
    END || ')', ', ') as app_id
FROM ad_units
WHERE network_id IN (SELECT id FROM ad_networks WHERE network = 'admob')
AND is_active = true
UNION ALL

-- 3. Check Ad Placements
SELECT
  '3. Ad Placements' as check_item,
  CASE
    WHEN COUNT(*) >= 2 THEN '✅ ' || COUNT(*)::text || ' placements active'
    WHEN COUNT(*) = 1 THEN '⚠️ Only 1 placement'
    ELSE '❌ No placements configured'
  END as status,
  STRING_AGG(screen_name || ' → ' || ad_type, ', ') as app_id
FROM ad_placements
WHERE is_enabled = true
AND ad_unit_id IN (
  SELECT id FROM ad_units
  WHERE network_id IN (SELECT id FROM ad_networks WHERE network = 'admob')
);

-- Detailed breakdown
SELECT '═══════════════════════════════════════════════════════════════════' as separator;
SELECT 'DETAILED AD CONFIGURATION' as title;
SELECT '═══════════════════════════════════════════════════════════════════' as separator;

-- AdMob Network Details
SELECT
  '📡 AdMob Network' as section,
  network,
  app_id,
  is_active,
  CASE
    WHEN app_id = 'ca-app-pub-473942199229846~4630726757'
    THEN '✅ Matches AndroidManifest.xml'
    ELSE '⚠️ Check AndroidManifest.xml'
  END as manifest_check
FROM ad_networks
WHERE network = 'admob';

SELECT '───────────────────────────────────────────────────────────────────' as separator;

-- Ad Units Details
SELECT
  '📱 Ad Units' as section,
  unit_type,
  placement,
  unit_id,
  is_active,
  CASE
    WHEN unit_id LIKE '%3940256099942544%' THEN '🧪 TEST AD (shows immediately)'
    ELSE '🔴 REAL AD (needs AdMob Console creation + approval)'
  END as ad_type,
  CASE
    WHEN unit_id LIKE '%3940256099942544%' THEN 'Ready to test'
    ELSE 'Create in AdMob Console: https://apps.admob.google.com'
  END as action_needed
FROM ad_units
WHERE network_id IN (SELECT id FROM ad_networks WHERE network = 'admob');

SELECT '───────────────────────────────────────────────────────────────────' as separator;

-- Ad Placements Details
SELECT
  '📍 Ad Placements' as section,
  placement_key,
  placement_name,
  screen_name,
  ad_type,
  position,
  is_enabled,
  CASE
    WHEN is_enabled THEN '✅ Will show ads'
    ELSE '❌ Disabled (won\'t show)'
  END as will_show
FROM ad_placements
WHERE ad_unit_id IN (
  SELECT id FROM ad_units
  WHERE network_id IN (SELECT id FROM ad_networks WHERE network = 'admob')
)
ORDER BY screen_name, ad_type;

SELECT '═══════════════════════════════════════════════════════════════════' as separator;

-- Configuration Summary
SELECT
  '📊 CONFIGURATION SUMMARY' as title,
  (SELECT COUNT(*) FROM ad_networks WHERE network = 'admob' AND is_active = true) as active_networks,
  (SELECT COUNT(*) FROM ad_units WHERE network_id IN (SELECT id FROM ad_networks WHERE network = 'admob') AND is_active = true) as active_ad_units,
  (SELECT COUNT(*) FROM ad_placements WHERE is_enabled = true AND ad_unit_id IN (SELECT id FROM ad_units WHERE network_id IN (SELECT id FROM ad_networks WHERE network = 'admob'))) as enabled_placements;

SELECT '═══════════════════════════════════════════════════════════════════' as separator;

-- Next Steps
SELECT
  '🎯 NEXT STEPS' as title,
  CASE
    WHEN (SELECT COUNT(*) FROM ad_units WHERE unit_id LIKE '%3940256099942544%' AND network_id IN (SELECT id FROM ad_networks WHERE network = 'admob')) >= 2
    THEN 'Using test ads. Rebuild app and test on physical device. If test ads work, create real ad units in AdMob Console.'
    ELSE 'Using real ad units. If they don''t exist in AdMob Console yet:
    1. Run ENABLE_TEST_ADS.sql to switch to test ads
    2. Test to verify integration works
    3. Create real ad units in AdMob Console
    4. Update database with real ad unit IDs
    5. Wait 24-48 hours for Google approval'
  END as instructions;

/*
  INTERPRETING RESULTS:

  ✅ = Good, no action needed
  ⚠️ = Warning, might need attention
  ❌ = Error, action required
  🧪 = Test configuration
  🔴 = Production configuration

  IDEAL CONFIGURATION (for testing):
  - 1 active AdMob network
  - 2+ active ad units (using test IDs)
  - 2+ enabled placements
  - App ID matches AndroidManifest.xml

  If everything shows ✅ but ads still don't show:
  1. Make sure you rebuilt the app after database changes
  2. Testing on PHYSICAL device (not emulator)
  3. Device has internet connection
  4. Check Android Logcat for AdMob errors:
     adb logcat | grep AdMob
*/