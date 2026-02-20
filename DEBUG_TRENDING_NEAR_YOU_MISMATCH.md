# Debugging: Trending Near You Section vs ViewAll Screen Mismatch

## Issue Reported
Songs displaying in TrendingNearYouSection.tsx are NOT displaying in TrendingNearYouViewAllScreen.tsx

## Debugging Added

I've added comprehensive console logging to TrendingNearYouViewAllScreen to track the data flow. The logs will help identify where songs are being lost.

### Console Log Locations

**fetchAllSongs() function:**

1. **Entry point** (line 721-727):
   ```
   [TrendingNearYouViewAll] Fetching songs for country: {countryCode}
   [TrendingNearYouViewAll] Selected genre: {genreId}
   ```

2. **Promoted content** (line 735):
   ```
   [TrendingNearYouViewAll] Promoted song IDs: [...]
   ```

3. **Manual songs** (line 739):
   ```
   [TrendingNearYouViewAll] Manual songs fetched: {count}
   ```

4. **RPC call result** (line 778):
   ```
   [TrendingNearYouViewAll] Auto-trending songs fetched from RPC: {count}
   ```

5. **Genre filtering** (line 782-793):
   ```
   [TrendingNearYouViewAll] Applying genre filter: {genreId}
   [TrendingNearYouViewAll] Songs in this genre: {count}
   [TrendingNearYouViewAll] Filtered data after genre: {count}
   ```

6. **No genre match** (line 796-800):
   ```
   [TrendingNearYouViewAll] No songs in this genre, showing manual songs only
   [TrendingNearYouViewAll] No manual songs either, returning empty
   ```

7. **Final combination** (line 933-943):
   ```
   [TrendingNearYouViewAll] Combined songs breakdown:
     - Manual: {count}
     - Promoted (new): {count}
     - Promoted (existing): {count}
     - Auto: {count}
     - Total combined: {count}
   [TrendingNearYouViewAll] Split into: {count} top ten, {count} additional
   ```

8. **Final results** (line 969):
   ```
   [TrendingNearYouViewAll] Final results: {count} top ten, {count} additional
   ```

## How to Debug

### Step 1: Open Browser Console
1. Open the app in your browser
2. Open Developer Tools (F12)
3. Go to the Console tab

### Step 2: Navigate to Section
1. Go to the Home screen
2. Scroll to "Trending Near You" section
3. Note which songs are displayed
4. Check console for logs from TrendingNearYouSection:
   ```
   [TrendingNearYouSection] Final songs with X promoted items
   ```

### Step 3: Navigate to ViewAll Screen
1. Click "View All" on the Trending Near You section
2. Check console for the sequence of logs from TrendingNearYouViewAll
3. Look for the data flow through each step

## Common Issues to Check For

### Issue 1: Genre Filter Mismatch
**Symptom**: ViewAll shows "No Songs Found" but Section shows songs

**Check logs for**:
```
[TrendingNearYouViewAll] Selected genre: {not 'all'}
[TrendingNearYouViewAll] Applying genre filter: ...
[TrendingNearYouViewAll] No songs in this genre, showing manual songs only
```

**Cause**: A genre is selected (not "all") and there are no songs in that genre

**Solution**: The genre selector should default to "all" when navigating from Section


### Issue 2: Country Code Mismatch
**Symptom**: ViewAll fetches different country than Section

**Check logs for**:
```
[TrendingNearYouSection] Fetching songs for country: NG
[TrendingNearYouViewAll] Fetching songs for country: US  ← Different!
```

**Cause**: Location detection differs between screens or timing issue

**Solution**: Both use same `useLocation` hook, check if location changes between navigation


### Issue 3: RPC Returns Empty
**Symptom**: Both screens get 0 songs from RPC

**Check logs for**:
```
[TrendingNearYouViewAll] Auto-trending songs fetched from RPC: 0
```

**Cause**:
- Threshold too high (check admin settings)
- No songs in the detected country
- Smart fallback not working

**Solution**: Check `content_section_thresholds` table in database


### Issue 4: Songs Filtered Out
**Symptom**: RPC returns songs but final result is empty

**Check logs for**:
```
[TrendingNearYouViewAll] Auto-trending songs fetched from RPC: 20
[TrendingNearYouViewAll] Total combined: 0
```

**Cause**: Songs are being filtered out during combination (duplicate removal)

**Solution**: Check if all songs are marked as promoted/manual, causing them to be filtered


### Issue 5: Early Return
**Symptom**: Logs stop abruptly

**Check logs for**:
```
[TrendingNearYouViewAll] No country code, returning early
```

**Cause**: Location not detected yet when ViewAll screen loads

**Solution**: Wait for location to load before navigating


## Expected Log Sequence

### Normal successful flow:
```
[TrendingNearYouViewAll] Fetching songs for country: NG
[TrendingNearYouViewAll] Selected genre: all
[TrendingNearYouViewAll] Promoted song IDs: []
[TrendingNearYouViewAll] Manual songs fetched: 0
[TrendingNearYouViewAll] Auto-trending songs fetched from RPC: 15
[TrendingNearYouViewAll] Combined songs breakdown:
  - Manual: 0
  - Promoted (new): 0
  - Promoted (existing): 0
  - Auto: 15
  - Total combined: 15
[TrendingNearYouViewAll] Split into: 10 top ten, 5 additional
[TrendingNearYouViewAll] Final results: 10 top ten, 5 additional
```

## Comparison with Section

TrendingNearYouSection has similar logs (line 158-160, 291):
```
[TrendingNearYouSection] Fetching promoted content for trending_near_you section
[TrendingNearYouSection] Promoted song IDs received: [...]
[TrendingNearYouSection] Final songs with X promoted items
```

Compare the country codes, song counts, and genre filters between both screens.

## Next Steps After Identifying Issue

1. **Share console logs**: Copy the entire console output showing both Section and ViewAll logs
2. **Check database**: Verify the songs exist and have correct country codes
3. **Check admin settings**: Verify threshold is not too high
4. **Check genre tagging**: Verify songs have genres assigned if genre filter is applied

## Files Modified

- `src/screens/TrendingNearYouViewAllScreen/TrendingNearYouViewAllScreen.tsx`
  - Added 15+ console.log statements throughout fetchAllSongs()
  - No logic changes, only debugging logs added

## Build Status

✅ Build successful with debug logs included
