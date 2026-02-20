# Content Section Thresholds - Admin Guide

## Overview

The Content Section Thresholds system gives you independent control over play count requirements for different sections in your app. Each section can have its own threshold without affecting others.

## What It Does

You can now control which content appears in each section by setting minimum play count and like count requirements:

- **Featured Artists** - Premium placement for top artists
- **Global Trending** - Worldwide trending songs
- **Trending Near You** - Country-specific trending
- **Tracks Blowing Up** - Viral recent tracks
- **New Releases** - Recently uploaded songs
- **Trending Albums** - Popular albums

## Why This Matters

### For New Apps
Start with **low thresholds** (10-25 plays) so users see content immediately. As your app grows, gradually increase thresholds to maintain quality.

### For Established Apps
Set **higher thresholds** (100+ plays) to ensure only quality, proven content appears in premium sections.

### Independent Control
Each section operates independently:
- Set "Featured Artists" to 100 plays (high quality)
- Set "Trending Near You" to 30 plays (local discovery)
- Set "New Releases" to 10 plays (discovery)

## How To Use

### Access the Feature
1. Log into **Admin Dashboard**
2. Click **"Section Thresholds"** in the sidebar (under Content)

### Configure a Section
Each section card shows:
- **Section name and icon**
- **Min Play Count** - Minimum plays required
- **Min Like Count** - Minimum likes required (optional)
- **Time Window** - How many days to count (null = all time)
- **Enable/Disable toggle**
- **Admin notes**

### Edit Thresholds

1. **Click Edit** button on any section
2. **Adjust values**:
   - Min Play Count: `0` to `999999`
   - Min Like Count: `0` to `999999`
   - Time Window: Days (e.g., `7`, `14`, `30`) or leave blank for "all time"
3. **Toggle enabled/disabled**
4. **Add notes** (optional, helps other admins understand settings)
5. **Click Save**

Changes apply **immediately** to all users!

## Default Settings (Recommended Starting Point)

| Section | Min Plays | Min Likes | Time Window | Notes |
|---------|-----------|-----------|-------------|-------|
| **Featured Artists** | 100 | 10 | All time | Premium placement |
| **Global Trending** | 50 | 5 | 14 days | High quality global |
| **Trending Near You** | 30 | 3 | 14 days | Local discovery |
| **Tracks Blowing Up** | 25 | 2 | 7 days | Recent viral content |
| **New Releases** | 10 | 1 | 30 days | Discovery friendly |
| **Trending Albums** | 75 | 8 | 14 days | Album quality |

## Scaling Strategy

### Phase 1: New App (0-1,000 users)
```
Featured Artists:  25 plays
Global Trending:   15 plays
Trending Near You: 10 plays
Blowing Up:        10 plays
New Releases:       5 plays
```

**Goal:** Show content quickly, encourage creators

### Phase 2: Growing App (1,000-10,000 users)
```
Featured Artists:  50 plays
Global Trending:   30 plays
Trending Near You: 20 plays
Blowing Up:        15 plays
New Releases:       8 plays
```

**Goal:** Balance discovery with quality

### Phase 3: Established App (10,000+ users)
```
Featured Artists:  100+ plays
Global Trending:   50+ plays
Trending Near You: 30+ plays
Blowing Up:        25+ plays
New Releases:      10+ plays
```

**Goal:** Premium quality content only

## Tips & Best Practices

### 1. Monitor Section Performance
- If a section is **empty**, lower the threshold
- If a section has **too much content**, raise the threshold
- Check weekly and adjust as needed

### 2. Time Windows Matter
- **7 days** = Recent viral content
- **14 days** = Trending content
- **30 days** = Discovery window
- **All time** = Evergreen classics

### 3. Balance Quality vs Discovery
- **High thresholds** = Quality but less content
- **Low thresholds** = More content but varied quality
- Find the sweet spot for your audience

### 4. Regional Considerations
- "Trending Near You" should have **lower** thresholds than "Global Trending"
- Helps users discover local artists with smaller audiences

### 5. Seasonal Adjustments
- Lower thresholds during **slow seasons** to keep sections populated
- Raise during **busy seasons** to showcase top content

## Database Details

### Table: `content_section_thresholds`

```sql
-- Query current thresholds
SELECT section_name, min_play_count, min_like_count, time_window_days, is_enabled
FROM content_section_thresholds
ORDER BY section_name;

-- Frontend can call helper function
SELECT get_section_threshold('global_trending');
-- Returns: 50

-- Check if content meets threshold
SELECT meets_section_threshold('blowing_up', 30, 5);
-- Returns: true/false
```

### RPC Functions Available

1. **`get_section_threshold(section_key)`**
   - Returns minimum play count for a section
   - Used by frontend to filter content

2. **`meets_section_threshold(section_key, play_count, like_count)`**
   - Checks if content meets requirements
   - Returns boolean

3. **`admin_update_section_threshold(...)`**
   - Admin function to update settings
   - Used by the UI

## Security

- ✅ **Public read** access (frontend needs thresholds)
- ✅ **Admin-only write** access
- ✅ **Audit trail** (tracks who changed what and when)
- ✅ **RLS enabled** on table

## Frontend Integration

Sections automatically respect these thresholds. Example:

```typescript
// Get threshold
const threshold = await supabase.rpc('get_section_threshold', {
  section_key_param: 'global_trending'
});

// Query only content that meets threshold
const { data: songs } = await supabase
  .from('songs')
  .select('*')
  .gte('play_count', threshold)
  .order('play_count', { ascending: false });
```

## Troubleshooting

### Problem: Section is empty
**Solution:** Lower the min_play_count threshold

### Problem: Too much low-quality content
**Solution:** Raise both min_play_count and min_like_count

### Problem: Need to feature specific content
**Solution:** Don't use this system for manual curation - use the "Featured Artists" admin section instead

### Problem: Changes not appearing
**Solution:** Check if section is **enabled** (toggle might be off)

## FAQ

**Q: Can I add new sections?**
A: Yes! Insert into `content_section_thresholds` table with a unique `section_key`

**Q: Can I delete a section?**
A: Yes, but better to **disable** it (keeps historical data)

**Q: Do changes require app restart?**
A: No! Changes apply **immediately**

**Q: Can I set different thresholds by country?**
A: Not directly, but "Trending Near You" section filters by country automatically

**Q: What if I set threshold to 0?**
A: All content will appear (same as disabling the threshold)

## Benefits

✅ **No code changes** required to adjust visibility
✅ **Independent control** per section
✅ **Quality management** at section level
✅ **Scales with your app** (start low, go high)
✅ **Immediate effect** (no deployment needed)
✅ **Audit trail** (track all changes)

---

**Pro Tip:** Start conservative (lower thresholds) and increase gradually. It's easier to raise standards than to lower them!

---

**Migration Applied:** `create_content_section_thresholds`
**Admin UI:** Admin Dashboard → Section Thresholds
**Database Table:** `content_section_thresholds`
