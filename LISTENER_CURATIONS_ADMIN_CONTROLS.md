# Listener Curations Admin Controls

## Overview
Comprehensive admin dashboard section for managing the Listener Curations system, including global settings, eligibility requirements, monetization controls, featured playlists, and analytics.

## Admin Dashboard Access

**Location:** Admin Dashboard → Listener Curations
**Required Role:** Admin
**Icon:** Users (multiple people icon)

## Features

### 1. Global Settings

#### System Status Toggle
- **Global Enable/Disable** - Turn the entire Listener Curations system on or off
  - When disabled: No new curation approvals, existing playlists remain visible but not monetizable
  - When enabled: System functions normally
  - Default: Enabled

#### Curator Monetization Toggle
- **Enable/Disable Earnings** - Control whether curators can earn from playlists
  - Independent of global system status
  - When disabled: Playlists remain visible but no earnings are credited
  - When enabled: Earnings processed according to revenue split
  - Default: Enabled

#### Eligibility Requirements

**Minimum Songs Required**
- Range: 1-100 songs
- Default: 10 songs
- Description: Minimum number of songs in a playlist for curation eligibility
- Impact: Playlists below this threshold cannot be submitted for curation

**Minimum Song Plays Required**
- Range: 0-10,000 plays
- Default: 0 plays
- Description: Minimum total plays across all songs in the playlist
- Impact: Helps ensure quality content by requiring proven track records
- Use Case: Set to 0 for new platforms, increase as platform grows

#### Revenue Split Percentage
- Range: 0-20%
- Default: 5%
- Description: Percentage of ad revenue shared with playlist curators
- Visual: Slider with numeric input for precision
- Real-time preview of percentage
- Changes apply to future earnings only

### 2. Top Curated Playlists

#### Sorting Options
- **By Plays** - Total playlist play count
- **By Earnings** - Total curator earnings (in Treats)
- **By Engagement** - Composite score:
  - Play count × 1.0
  - Unique listeners × 5.0
  - Average session duration ÷ 60

#### Playlist Information Display
Each playlist card shows:
- Playlist title
- Curator name
- Song count
- Curation status badge (approved/pending/rejected)
- Featured status (⭐ if featured)
- Monetization status (🚫 if blocked)
- Metrics:
  - Total plays
  - Unique listeners
  - Total earnings ($)
  - Average session duration (minutes)

#### Quick Actions (Per Playlist)
1. **Feature/Unfeature Toggle** (⭐ button)
   - Yellow highlight when featured
   - Gray when not featured
   - One-click toggle

2. **Block/Unblock Monetization** (👁️/🚫 button)
   - Red when blocked
   - Gray when active
   - Affects only earnings, not visibility

### 3. Featured Playlists Management

#### How Featuring Works
- Admin can manually feature any approved playlist
- Featured playlists appear in special homepage sections
- Featured status is independent of monetization
- Only one active feature per playlist (no duplicates)
- Featured order can be customized (future enhancement)

#### Feature Actions
- **Feature** - Add playlist to featured rotation
  - Playlist must exist
  - Cannot feature already-featured playlist
  - Admin notes recorded for tracking

- **Unfeature** - Remove from featured rotation
  - Playlist remains public and monetizable
  - Unfeatured timestamp recorded
  - Does not affect existing plays/earnings

- **Update Order** - Change display priority (future)
  - Higher numbers = higher priority
  - Useful for seasonal/promotional campaigns

### 4. Monetization Blocks

#### Block Types

**Playlist-Level Block**
- Blocks earnings for a specific playlist
- Curator's other playlists unaffected
- Playlist remains visible to listeners
- Use cases:
  - Quality issues identified
  - Terms of service violations
  - Gaming/fraud detected (works with auto-flagging)
  - Inappropriate content

**User-Level Block**
- Blocks all curator earnings for a specific user
- Affects all their playlists
- Playlists remain visible
- Use cases:
  - Repeated violations
  - Confirmed fraud across multiple playlists
  - Account suspension pending review

#### Block Management
- **Block** - Immediately stops earnings
  - Requires admin confirmation
  - Optional reason field for documentation
  - Logged with timestamp and admin ID

- **Unblock** - Restores earning capability
  - Takes effect immediately for future plays
  - Past blocked earnings NOT retroactively credited
  - Logged with timestamp

### 5. Quick Stats Dashboard

Four key metrics displayed at bottom:

**Total Playlists**
- Count of all curated playlists (any status)
- Shows platform adoption

**Featured**
- Count of currently featured playlists
- Quick visibility into featured content

**Total Earnings**
- Sum of all curator earnings across all playlists
- Platform-wide curator payout tracking

**Blocked**
- Count of playlists with active monetization blocks
- Fraud/quality issue indicator

## Database Functions

### `admin_get_top_curated_playlists()`
**Purpose:** Retrieve top playlists with comprehensive analytics

**Parameters:**
- `p_sort_by` - Sorting method: 'plays', 'earnings', or 'engagement'
- `p_limit` - Maximum results (default 50)

**Returns:**
- Playlist details
- Curator information
- Play and listener metrics
- Earnings data
- Featured and block status
- Engagement scores

**Security:** Admin-only access via RLS

### `admin_feature_playlist()`
**Purpose:** Manage playlist featured status

**Parameters:**
- `p_playlist_id` - Target playlist
- `p_action` - 'feature', 'unfeature', or 'update_order'
- `p_admin_notes` - Optional notes (for tracking)
- `p_featured_order` - Display priority (0-999)

**Returns:** Success/failure with message

**Validation:**
- Admin role verification
- Playlist existence check
- Prevents duplicate featuring
- Records admin actions

### `admin_block_curator_monetization()`
**Purpose:** Block or unblock monetization

**Parameters:**
- `p_block_type` - 'playlist' or 'user'
- `p_target_id` - Playlist ID or User ID
- `p_action` - 'block' or 'unblock'
- `p_block_reason` - Optional reason text

**Returns:** Success/failure with message

**Validation:**
- Admin role verification
- Block type validation
- Prevents duplicate blocks
- Records reason and admin

## Database Tables

### `curator_settings`
**Purpose:** Store all admin configuration

**Key Settings:**
- `curator_global_status` - System on/off
- `curator_eligibility` - Min requirements
- `curator_revenue_split` - Earnings percentage

**Schema:**
```sql
setting_key (text, primary key)
setting_value (jsonb)
updated_at (timestamptz)
```

### `featured_curated_playlists`
**Purpose:** Track featured playlists

**Schema:**
```sql
id (uuid, primary key)
playlist_id (uuid, unique when active)
featured_by (uuid, admin who featured)
featured_order (integer, display priority)
is_active (boolean)
admin_notes (text)
featured_at (timestamptz)
unfeatured_at (timestamptz)
```

**RLS:** Public read for active features, admin-only write

### `curator_monetization_blocks`
**Purpose:** Track monetization restrictions

**Schema:**
```sql
id (uuid, primary key)
block_type (text: 'playlist' or 'user')
playlist_id (uuid, nullable)
user_id (uuid, nullable)
blocked_by (uuid, admin who blocked)
block_reason (text)
is_active (boolean)
blocked_at (timestamptz)
unblocked_at (timestamptz)
```

**Constraints:**
- Exactly one of playlist_id or user_id must be set
- Active blocks indexed for fast lookup

**RLS:** Admin-only access

## Integration with Anti-Fraud System

The admin controls seamlessly integrate with the anti-fraud system:

1. **Auto-Flagged Playlists**
   - Appear in top playlists with critical severity
   - Admin can review fraud evidence
   - One-click block monetization if confirmed

2. **Manual Review Workflow**
   - Review fraud detection logs
   - Check engagement patterns
   - Block monetization if abuse confirmed
   - Keep playlist visible for user experience

3. **Fraud Evidence Display** (future enhancement)
   - Show validation scores in playlist cards
   - Display fraud reasons inline
   - Link to detailed fraud report

## Admin Actions & Effects

| Action | Playlist Visibility | User Experience | Earnings | Notes |
|--------|-------------------|-----------------|----------|-------|
| Disable Global System | Visible | Normal playback | None | Emergency stop |
| Disable Monetization | Visible | Normal playback | None | Pause payouts |
| Block Playlist | Visible | Normal playback | Blocked | Specific playlist |
| Block User | Visible | Normal playback | Blocked | All user playlists |
| Feature Playlist | Enhanced | Priority display | Normal | Marketing tool |
| Unfeature Playlist | Visible | Normal display | Normal | Remove highlight |
| Change Requirements | No effect | No effect | Affects new | Future submissions |

## Best Practices

### Setting Minimum Requirements
1. **Start Low** - 10 songs, 0 plays for new platforms
2. **Increase Gradually** - As platform grows, raise standards
3. **Monitor Quality** - Review rejection rates
4. **Communicate** - Inform curators of requirement changes

### Revenue Split Management
1. **Market Research** - Check competitor offerings
2. **Start Conservative** - 5% is sustainable
3. **Monitor Costs** - Ensure platform profitability
4. **Adjust Seasonally** - Promotional increases for growth

### Featured Playlists Strategy
1. **Quality First** - Only feature excellent playlists
2. **Rotate Regularly** - Keep homepage fresh
3. **Diverse Genres** - Represent all music types
4. **New Curators** - Give opportunities to newcomers
5. **Seasonal Themes** - Holiday, summer vibes, etc.

### Blocking Guidelines
1. **Document Reasons** - Always add reason text
2. **Review First** - Check fraud evidence thoroughly
3. **Communicate** - Notify curator if appropriate
4. **Time-Bound** - Set review dates for temporary blocks
5. **Appeal Process** - Have clear unblock criteria

## Performance Considerations

- Top playlists query optimized with indexes
- Default limit of 50 prevents UI slowdowns
- Real-time updates via Supabase subscriptions
- Settings cached to reduce DB queries
- Lazy loading for large playlist lists

## Error Handling

All admin actions include:
- Permission verification
- Input validation
- Transaction safety
- User-friendly error messages
- Audit logging

Common errors:
- "Admin access required" - Role check failed
- "Playlist not found" - Invalid ID
- "Already featured/blocked" - Duplicate action
- "Invalid action" - Wrong parameter

## Future Enhancements

Potential improvements:
- Bulk actions (feature/block multiple)
- Advanced filtering (by genre, curator, etc.)
- Export analytics to CSV
- Scheduled feature rotations
- A/B testing featured playlists
- Curator performance scoring
- Automated quality suggestions
- Integration with payments system

---

**Status:** Production Ready ✅
**Build:** Successful (21.09s)
**Last Updated:** 2025-12-27
