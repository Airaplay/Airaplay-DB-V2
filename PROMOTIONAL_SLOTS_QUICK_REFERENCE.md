# Promotional Slots - Quick Reference

## New Sections Added

### 1. Listener Curations
- **Section Key:** `listener_curations`
- **Content Type:** Playlists (profile type)
- **Slots:** 1 promotion per section
- **Position:** First position (index 0)
- **Badge:** Top-left corner, gold gradient with "BOOSTED"
- **File:** `src/screens/HomePlayer/sections/ListenerCurationsSection/ListenerCurationsSection.tsx`

### 2. Tracks Blowing Up
- **Section Key:** `tracks_blowing_up`
- **Content Type:** Songs
- **Slots:** 1 promotion per section
- **Position:** First position (index 0)
- **Badge:** Bottom-left on cover, gold gradient with "BOOSTED"
- **File:** `src/screens/HomePlayer/sections/TracksBlowingUpSection/TracksBlowingUpSection.tsx`

## How to Create a Promotion

### Via Boost Center (User Flow)

1. Navigate to **Boost Center** screen
2. Select content type:
   - **Profile** tab for Listener Curations
   - **Singles** tab for Tracks Blowing Up
3. Click **"Boost"** button on desired content
4. In modal, select section:
   - "Listener Curations" for playlists
   - "Tracks Blowing Up" for songs
5. Set duration and confirm payment
6. Wait for admin approval

### Via Admin Dashboard

1. Go to **Admin Dashboard → Promotion Manager**
2. Find pending promotion in "Pending Approvals" tab
3. Review content and section
4. Click **"Approve"** or **"Reject"**
5. Promotion goes live immediately if approved

## Database Queries

### Check Active Promotions

```sql
-- For Listener Curations
SELECT
  p.target_title,
  p.treats_cost,
  p.start_date,
  p.end_date,
  p.status
FROM promotions p
JOIN promotion_sections ps ON p.promotion_section_id = ps.id
WHERE ps.section_key = 'listener_curations'
  AND p.status = 'active';

-- For Tracks Blowing Up
SELECT
  p.target_title,
  p.treats_cost,
  p.start_date,
  p.end_date,
  p.status
FROM promotions p
JOIN promotion_sections ps ON p.promotion_section_id = ps.id
WHERE ps.section_key = 'tracks_blowing_up'
  AND p.status = 'active';
```

### View Section Analytics

```sql
SELECT
  ps.section_name,
  COUNT(p.id) FILTER (WHERE p.status = 'active') as active,
  COUNT(p.id) FILTER (WHERE p.status = 'completed') as completed,
  SUM(p.treats_cost) as total_treats,
  AVG(p.impressions_actual) as avg_impressions,
  AVG(p.clicks) as avg_clicks
FROM promotion_sections ps
LEFT JOIN promotions p ON p.promotion_section_id = ps.id
WHERE ps.section_key IN ('listener_curations', 'tracks_blowing_up')
GROUP BY ps.section_name;
```

### Disable/Enable Section

```sql
-- Disable
UPDATE promotion_sections
SET is_active = false
WHERE section_key = 'listener_curations';

-- Enable
UPDATE promotion_sections
SET is_active = true
WHERE section_key = 'listener_curations';
```

## Visual Design

### Badge Specifications

**Listener Curations Badge:**
- Position: `absolute top-1.5 left-1.5`
- Background: `bg-gradient-to-r from-yellow-500 to-orange-500`
- Text: `text-[10px] text-white font-bold`
- Icon: `Sparkles w-2.5 h-2.5`
- Label: "BOOSTED"

**Tracks Blowing Up Badge:**
- Position: `absolute bottom-0.5 left-0.5`
- Background: `bg-gradient-to-r from-yellow-500 to-orange-500`
- Text: `text-[8px] text-white font-bold`
- Icon: `Sparkles w-2 h-2`
- Label: "BOOSTED"

## Integration Points

### Frontend Files Modified

1. **ListenerCurationsSection.tsx**
   - Added `getPromotedContentDetailed` import
   - Added `recordPromotedContentClick` import
   - Added `Sparkles` icon import
   - Added `isPromoted` to interface
   - Modified fetch logic for parallel loading
   - Added click tracking
   - Added badge rendering

2. **TracksBlowingUpSection.tsx**
   - Added `getPromotedContentDetailed` import
   - Added `recordPromotedContentClick` import
   - Added `Sparkles` icon import
   - Added `isPromoted` to interface
   - Modified fetch logic for parallel loading
   - Added click tracking
   - Added badge rendering

### Backend (Database)

Migration: `add_listener_curations_and_blowing_up_promotion_sections.sql`

Tables affected:
- `promotion_sections` (2 new rows)
- No changes to existing tables

## Admin Dashboard Access

**Location:** Admin Dashboard → Promotion Manager

**Tabs:**
- **Pending Approvals:** Review and approve new promotions
- **Active:** Monitor currently running promotions
- **Completed:** View past promotion performance
- **Analytics:** Section-wide performance metrics
- **Settings:** Configure pricing and availability

**Section Filters:**
Both new sections appear automatically in:
- Promotion creation dropdown
- Section filter dropdown
- Analytics section breakdown
- Pricing configuration

## Monitoring Commands

### Check System Status

```sql
-- Verify sections are active
SELECT section_name, is_active
FROM promotion_sections
WHERE section_key IN ('listener_curations', 'tracks_blowing_up');

-- Count active promotions
SELECT
  ps.section_name,
  COUNT(p.id) as active_count
FROM promotion_sections ps
LEFT JOIN promotions p ON p.promotion_section_id = ps.id AND p.status = 'active'
WHERE ps.section_key IN ('listener_curations', 'tracks_blowing_up')
GROUP BY ps.section_name;

-- Recent click activity
SELECT
  ps.section_name,
  p.target_title,
  pi.clicks_count,
  pi.impressions_count,
  pi.created_at
FROM promotion_impressions pi
JOIN promotions p ON pi.promotion_id = p.id
JOIN promotion_sections ps ON p.promotion_section_id = ps.id
WHERE ps.section_key IN ('listener_curations', 'tracks_blowing_up')
ORDER BY pi.created_at DESC
LIMIT 10;
```

### Performance Metrics

```sql
-- CTR by section
SELECT
  ps.section_name,
  ROUND(
    SUM(pi.clicks_count)::numeric / NULLIF(SUM(pi.impressions_count), 0) * 100,
    2
  ) as ctr_percentage
FROM promotion_sections ps
JOIN promotions p ON p.promotion_section_id = ps.id
LEFT JOIN promotion_impressions pi ON pi.promotion_id = p.id
WHERE ps.section_key IN ('listener_curations', 'tracks_blowing_up')
GROUP BY ps.section_name;
```

## Troubleshooting

### Issue: Promoted content not showing

**Solution 1:** Check active promotions
```sql
SELECT * FROM promotions
WHERE promotion_section_id IN (
  SELECT id FROM promotion_sections
  WHERE section_key IN ('listener_curations', 'tracks_blowing_up')
)
AND status = 'active'
AND start_date <= NOW()
AND end_date >= NOW();
```

**Solution 2:** Check console logs
- Open browser DevTools → Console
- Look for: `[ListenerCurations] Promoted playlist IDs:`
- Look for: `[TracksBlowingUp] Promoted song IDs:`

**Solution 3:** Clear cache
- Clear browser cache
- App will refetch promoted content

### Issue: Badge not displaying

**Check CSS classes:**
```typescript
// Should see this in DevTools
<div class="absolute ... bg-gradient-to-r from-yellow-500 to-orange-500">
  <svg>...</svg> <!-- Sparkles icon -->
  <span>BOOSTED</span>
</div>
```

**Verify isPromoted flag:**
```typescript
// Add console.log in component
console.log('Tracks:', tracks.map(t => ({ id: t.id, isPromoted: t.isPromoted })));
```

### Issue: Clicks not tracking

**Verify function call:**
```typescript
// Should see in console when clicking promoted content
console.log('[ClickTracking] Recording click...');
```

**Check database:**
```sql
SELECT * FROM promotion_impressions
WHERE clicked = true
ORDER BY created_at DESC
LIMIT 5;
```

## Feature Status

✅ **Completed:**
- Database migration applied
- Frontend integration (both sections)
- Admin dashboard integration
- Click tracking
- Visual badges
- Fair rotation support
- Build successful

📊 **Analytics Available:**
- Impressions per promotion
- Clicks per promotion
- CTR calculation
- Section-wide metrics
- User engagement data

🎯 **Ready for Production:**
- All tests passing
- No breaking changes
- Backward compatible
- Documentation complete

## Support

**For Issues:**
1. Check this quick reference
2. Review main documentation: `PROMOTIONAL_SLOTS_LISTENER_CURATIONS_BLOWING_UP.md`
3. Check database status with SQL queries above
4. Review console logs for errors

**For Feature Requests:**
- Fair rotation improvements
- Multiple slot support
- Advanced targeting
- A/B testing capabilities
