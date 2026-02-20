# AdMob Setup Instructions - Step by Step

Follow these steps to complete your AdMob setup.

## Part 1: Apply Database Migration

### Step 1: Open Supabase Dashboard
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar

### Step 2: Run the Migration Script
1. Open the file `APPLY_ADMOB_SETUP.sql` in this project
2. Copy the entire content (Steps 1-3)
3. Paste it into the Supabase SQL Editor
4. Click **Run** or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

### Step 3: Verify Migration
After running, you should see:
- A row with `network = 'admob'`
- `app_id = 'ca-app-pub-4739421992298461~4630726757'`
- `api_key = 'pub-4739421992298461'`
- `is_active = true`

**Copy the `id` value** from this query result - you'll need it later.

---

## Part 2: Create Ad Units in AdMob Dashboard

### Step 1: Access AdMob Console
1. Go to [AdMob Console](https://apps.admob.com/)
2. Sign in with your Google account
3. If prompted, accept AdMob terms and conditions

### Step 2: Create or Select Your App
1. If you haven't created the app yet:
   - Click **Apps** → **Add app**
   - Select **Android**
   - Enter app name: **Airaplay**
   - Enter package name: **com.airaplay.app**
   - Click **Add app**

2. If the app already exists:
   - Click on **Airaplay** from the apps list

### Step 3: Create Banner Ad Unit
1. In your app's dashboard, click **Ad units** tab
2. Click **Add ad unit**
3. Select **Banner**
4. Enter ad unit name: **Home Screen Banner** (or any name you prefer)
5. Click **Create ad unit**
6. **Copy the Ad Unit ID** (format: `ca-app-pub-4739421992298461/XXXXXXXX`)
7. Save it somewhere - you'll need it for the database

### Step 4: Create Interstitial Ad Unit
1. Click **Add ad unit** again
2. Select **Interstitial**
3. Enter ad unit name: **Between Songs Interstitial**
4. Click **Create ad unit**
5. **Copy the Ad Unit ID**
6. Save it

### Step 5: Create Rewarded Ad Unit
1. Click **Add ad unit** again
2. Select **Rewarded**
3. Enter ad unit name: **After Video Rewarded**
4. Click **Create ad unit**
5. **Copy the Ad Unit ID**
6. Save it

### Step 6: Wait for Ad Unit Approval
- Ad units may show as "Limited" initially
- This is normal - AdMob needs time to review
- Ads will start serving within 24-48 hours
- You can still use them for testing

---

## Part 3: Add Ad Units to Database

### Step 1: Prepare SQL Script
1. Open `APPLY_ADMOB_SETUP.sql`
2. Scroll to **Step 4** (the commented section)
3. You'll see three INSERT statements for:
   - Banner ad unit
   - Interstitial ad unit
   - Rewarded ad unit

### Step 2: Update the SQL Script
Replace the placeholders with your actual ad unit IDs:

```sql
-- Example with your actual ad unit IDs:
INSERT INTO ad_units (network_id, unit_type, unit_id, placement, is_active)
SELECT 
  id,
  'banner',
  'ca-app-pub-4739421992298461/1234567890',  -- Replace with your banner ID
  'home_screen',
  true
FROM ad_networks 
WHERE network = 'admob'
ON CONFLICT DO NOTHING;

INSERT INTO ad_units (network_id, unit_type, unit_id, placement, is_active)
SELECT 
  id,
  'interstitial',
  'ca-app-pub-4739421992298461/0987654321',  -- Replace with your interstitial ID
  'between_songs',
  true
FROM ad_networks 
WHERE network = 'admob'
ON CONFLICT DO NOTHING;

INSERT INTO ad_units (network_id, unit_type, unit_id, placement, is_active)
SELECT 
  id,
  'rewarded',
  'ca-app-pub-4739421992298461/1122334455',  -- Replace with your rewarded ID
  'after_video',
  true
FROM ad_networks 
WHERE network = 'admob'
ON CONFLICT DO NOTHING;
```

### Step 3: Run the SQL Script
1. Copy all three INSERT statements (with your actual ad unit IDs)
2. Paste into Supabase SQL Editor
3. Click **Run**

### Step 4: Verify Ad Units
Run the verification query from Step 5 in `APPLY_ADMOB_SETUP.sql`:

```sql
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
```

You should see all three ad units listed.

---

## Part 4: Alternative - Use Admin Dashboard

Instead of SQL, you can also add ad units via the Admin Dashboard:

1. Open your app
2. Go to **Admin Dashboard** → **Ad Management**
3. Click **Ad Units** tab
4. Click **Add New Ad Unit**
5. Fill in:
   - **Network**: Select "Google AdMob"
   - **Unit Type**: Select (Banner/Interstitial/Rewarded)
   - **Unit ID**: Paste your ad unit ID from AdMob
   - **Placement**: Select appropriate placement
   - **Active**: Check the box
6. Click **Save**
7. Repeat for each ad unit type

---

## Verification Checklist

After completing all steps, verify:

- [ ] Database has AdMob network entry with correct App ID
- [ ] All three ad units created in AdMob dashboard
- [ ] All three ad units added to database
- [ ] Ad units are active (`is_active = true`)
- [ ] App builds successfully in Android Studio
- [ ] AdMob initializes without errors (check logcat)
- [ ] Test ads work in development mode

---

## Testing

### Development Testing
- Use test ad IDs (already configured)
- Test mode is automatically enabled in development
- Ads should show immediately

### Production Testing
- Wait 24-48 hours after creating ad units
- Build release APK/AAB
- Install on real device
- Ads should appear (may take a few minutes to start serving)

---

## Troubleshooting

### Ads Not Showing?
1. **Check logcat** for AdMob errors
2. **Verify ad units** are active in database
3. **Check AdMob dashboard** - are ad units approved?
4. **Wait 24-48 hours** - new ad units need time
5. **Verify App ID** matches in AndroidManifest and database

### "Ad Unit Not Found" Error?
1. Verify ad unit IDs are correct (no typos)
2. Check ad units exist in database
3. Ensure `is_active = true` for all ad units
4. Verify network is active in `ad_networks` table

### Test Ads in Production?
- Check `testMode` is `false` in production builds
- Verify `import.meta.env.MODE === 'production'`
- Remove test device IDs from production

---

## Next Steps

1. ✅ Apply database migration
2. ✅ Create ad units in AdMob
3. ✅ Add ad units to database
4. 🔄 Build app in Android Studio
5. 🔄 Test on real device
6. 🔄 Monitor AdMob dashboard for impressions

---

**Need Help?** Check `ADMOB_SETUP_VERIFICATION.md` for detailed troubleshooting.

