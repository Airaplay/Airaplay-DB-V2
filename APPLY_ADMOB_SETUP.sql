-- =====================================================
-- AdMob Setup Script
-- Run this in your Supabase Dashboard SQL Editor
-- =====================================================

-- Step 1: Update/Create AdMob Network Configuration
-- =====================================================
UPDATE ad_networks
SET 
  app_id = 'ca-app-pub-4739421992298461~4630726757',
  api_key = 'pub-4739421992298461',
  updated_at = now()
WHERE network = 'admob';

-- If AdMob entry doesn't exist, create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ad_networks WHERE network = 'admob') THEN
    INSERT INTO ad_networks (network, api_key, app_id, is_active)
    VALUES ('admob', 'pub-4739421992298461', 'ca-app-pub-4739421992298461~4630726757', true);
  END IF;
END $$;

-- Step 2: Verify the configuration
-- =====================================================
SELECT 
  id,
  network,
  api_key as publisher_id,
  app_id,
  is_active,
  created_at,
  updated_at
FROM ad_networks 
WHERE network = 'admob';

-- Step 3: Get the AdMob Network ID (you'll need this for Step 4)
-- =====================================================
-- Copy the 'id' value from the query above - you'll need it to add ad units

-- Step 4: Add Ad Units (RUN THIS AFTER CREATING AD UNITS IN ADMOB DASHBOARD)
-- =====================================================
-- Replace 'YOUR_NETWORK_ID_HERE' with the id from Step 3
-- Replace the ad unit IDs with your actual production ad unit IDs from AdMob

/*
-- Example: Adding Banner Ad Unit
INSERT INTO ad_units (network_id, unit_type, unit_id, placement, is_active)
SELECT 
  id,
  'banner',
  'ca-app-pub-4739421992298461/YOUR_BANNER_AD_UNIT_ID',
  'home_screen',
  true
FROM ad_networks 
WHERE network = 'admob'
ON CONFLICT DO NOTHING;

-- Example: Adding Interstitial Ad Unit
INSERT INTO ad_units (network_id, unit_type, unit_id, placement, is_active)
SELECT 
  id,
  'interstitial',
  'ca-app-pub-4739421992298461/YOUR_INTERSTITIAL_AD_UNIT_ID',
  'between_songs',
  true
FROM ad_networks 
WHERE network = 'admob'
ON CONFLICT DO NOTHING;

-- Example: Adding Rewarded Ad Unit
INSERT INTO ad_units (network_id, unit_type, unit_id, placement, is_active)
SELECT 
  id,
  'rewarded',
  'ca-app-pub-4739421992298461/YOUR_REWARDED_AD_UNIT_ID',
  'after_video',
  true
FROM ad_networks 
WHERE network = 'admob'
ON CONFLICT DO NOTHING;
*/

-- Step 5: Verify all ad units are configured
-- =====================================================
SELECT 
  au.id,
  an.network,
  au.unit_type,
  au.unit_id,
  au.placement,
  au.is_active,
  au.created_at
FROM ad_units au
JOIN ad_networks an ON au.network_id = an.id
WHERE an.network = 'admob'
ORDER BY au.unit_type, au.placement;

