# Listener Curations - Quick Start Guide

## What Is It?
A discovery section showcasing high-quality playlists created by listeners, with admin approval and monetization tracking.

## For Listeners

### Submit a Playlist for Curation:
1. Create a public playlist with 10+ songs
2. Use database function (future: UI button):
   ```sql
   SELECT submit_playlist_for_curation('your-playlist-id');
   ```
3. Wait for admin approval
4. If approved, your playlist appears in "Listener Curations" section

### Requirements:
- Must be a **listener** (not creator/admin)
- Minimum **10 songs**
- Playlist must be **public**
- High-quality, unique content

## For Admins

### Access Admin Panel:
1. Login to admin dashboard
2. Click "Playlist Curations" in sidebar
3. View pending submissions

### Review Process:
1. **View pending** playlists (default filter)
2. **Click eye icon** to preview songs
3. **Approve** (green checkmark) or **Reject** (red X)
4. **Approved playlists** appear on home screen immediately

### Manage Featured:
- Switch to "Featured" tab
- **Unfeature** playlists if needed (orange ban icon)
- Drag to reorder (future feature)

## Database Functions

### User Functions:
```sql
-- Submit playlist for curation
SELECT submit_playlist_for_curation('playlist-uuid');

-- Get all featured playlists
SELECT * FROM get_featured_playlists(20);
```

### Admin Functions:
```sql
-- Approve a playlist
SELECT admin_review_playlist_curation('playlist-uuid', 'approved');

-- Reject a playlist
SELECT admin_review_playlist_curation('playlist-uuid', 'rejected');

-- Unfeature a playlist
SELECT admin_unfeature_playlist('playlist-uuid');
```

## Where to Find

### Home Screen:
- Section appears after "Mix For You"
- Shows 6 featured playlists
- "View All" button for more

### Admin Dashboard:
- Sidebar: "Playlist Curations"
- Statistics at top
- Filters: All, Pending, Featured, Rejected
- Search bar for finding specific playlists

## Monetization (Coming Soon)

### Revenue Structure:
- Curators: 5% of ad revenue from playlist plays
- Tracked in `curator_earnings` table
- Analytics view for curators

### Tracking:
- Each play recorded in `playlist_plays`
- Revenue calculated per play
- Aggregated in curator analytics

## Key Features

### Auto-Maintained Data:
- ✅ Song count updates automatically
- ✅ Play count increments on plays
- ✅ Featured position auto-assigned
- ✅ Timestamps recorded

### Performance:
- ✅ 10-minute cache on home screen
- ✅ Optimized database indexes
- ✅ Lazy loading with Suspense
- ✅ Fast admin dashboard

### Security:
- ✅ RLS policies enforce access
- ✅ Role-based permissions
- ✅ Function security with DEFINER
- ✅ Public playlists only

## Status Workflow

```
none (default)
  ↓
pending (listener submits)
  ↓
approved (admin approves) → Featured on home screen
  OR
rejected (admin rejects) → Can resubmit

approved → none (admin unfeatures)
```

## Quick Troubleshooting

### Playlist not appearing after approval?
- Check `is_public = true`
- Verify `song_count >= 10`
- Check `curation_status = 'approved'`

### Can't submit for curation?
- Verify user role is 'listener'
- Check playlist has 10+ songs
- Ensure playlist is public
- Not already submitted

### Submission rejected?
- Review quality standards
- Check for duplicate content
- Ensure proper metadata
- Contact admin for feedback

## Development Notes

### New Tables:
- `playlist_plays` - Play tracking
- `curator_earnings` - Earnings tracking

### Extended Tables:
- `playlists` - Added 8 new fields

### New Components:
- `ListenerCurationsSection` - Home screen display
- `PlaylistCurationSection` - Admin management

### Database Views:
- `curator_analytics` - Aggregated statistics

## Testing Locally

1. **Create test playlist** as listener
2. **Submit via SQL:**
   ```sql
   SELECT submit_playlist_for_curation('playlist-id');
   ```
3. **Login as admin**
4. **Navigate to Playlist Curations**
5. **Approve the playlist**
6. **Check home screen** - should appear in Listener Curations

## Build & Deploy

```bash
# Build project
npm run build

# Verify success
✓ built in 24.86s

# Deploy
# (No special steps needed)
```

## Support

### Common Questions:

**Q: Can creators submit playlists?**
A: No, only listeners. Creators have their own content promotion tools.

**Q: How long does approval take?**
A: Target: <24 hours. Depends on admin availability.

**Q: Can I edit after approval?**
A: Yes, but major changes may require re-review.

**Q: How is featured order determined?**
A: Auto-assigned or manually set by admin.

**Q: When do earnings start?**
A: Tracking is active, but payout system is Phase 2.

## Resources

- Full Documentation: `LISTENER_CURATIONS_FEATURE_COMPLETE.md`
- Migration File: `supabase/migrations/create_listener_curations_system.sql`
- Home Section: `src/screens/HomePlayer/sections/ListenerCurationsSection/`
- Admin Section: `src/screens/AdminDashboardScreen/PlaylistCurationSection.tsx`

---

**Status:** ✅ Production Ready
**Version:** 1.0
**Last Updated:** 2025-12-27
