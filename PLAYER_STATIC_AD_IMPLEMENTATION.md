# Player Static Ad Placement Implementation

## Overview

Added static ad banner placements in three player screens that can be configured from the Admin Dashboard. These ads display between the album/song artwork and the title/controls section.

## Implementation Details

### 1. New Component Created

**PlayerStaticAdBanner** (`src/components/PlayerStaticAdBanner.tsx`)
- Displays a banner-style ad optimized for player screens
- Features:
  - Sponsored badge
  - Image banner with hover effects
  - Title, description, and advertiser name
  - CTA button with "Visit" action
  - Automatic impression tracking (50% visibility threshold)
  - Click tracking
  - Opens links in new tab

### 2. Updated Player Screens

All three player screens now support static ad placements:

#### MusicPlayerScreen (`src/screens/MusicPlayerScreen/MusicPlayerScreen.tsx`)
- **Ad Placement:** `music_player`
- **Location:** Between album artwork and song title
- Fetches ad based on user country
- Conditionally renders when ad is available

#### AlbumPlayerScreen (`src/screens/AlbumPlayerScreen/AlbumPlayerScreen.tsx`)
- **Ad Placement:** `album_player`
- **Location:** Between album artwork and album information
- Fetches ad based on user country
- Conditionally renders when ad is available

#### PlaylistPlayerScreen (`src/screens/PlaylistPlayerScreen/PlaylistPlayerScreen.tsx`)
- **Ad Placement:** `playlist_player`
- **Location:** Between playlist artwork and playlist information
- Fetches ad based on user country
- Conditionally renders when ad is available

### 3. Admin Dashboard Integration

**NativeAdsSection** (`src/screens/AdminDashboardScreen/NativeAdsSection.tsx`)

Added three new placement type options in the admin:
- **Music Player Screen** - Displays on single song player
- **Album Player Screen** - Displays on album player
- **Playlist Player Screen** - Displays on playlist player

Admins can now:
- Create static ads for player screens
- Upload ad images
- Set click URLs
- Configure targeting (countries, priority)
- Set expiration dates
- Enable/disable ads
- Track impressions and clicks

### 4. Ad Loading Logic

Each player screen:
1. Loads user country from database (if authenticated)
2. Fetches relevant ad using `getNativeAdsForPlacement()`
3. Filters ads based on:
   - Placement type (music_player, album_player, playlist_player)
   - User country (if ad has country targeting)
   - Active status
   - Expiration date
4. Displays highest priority ad that matches criteria

### 5. Tracking & Analytics

The system automatically tracks:
- **Impressions:** When ad is 50% visible on screen
- **Clicks:** When user clicks on ad banner or CTA button
- **Metrics:** Stored in `native_ad_cards` table
  - `impression_count` - Total impressions
  - `click_count` - Total clicks

### 6. Database Functions Used

- `getNativeAdsForPlacement()` - Fetches eligible ads
- `recordNativeAdImpression()` - Increments impression count
- `recordNativeAdClick()` - Increments click count
- RPC: `increment_native_ad_impression`
- RPC: `increment_native_ad_click`

## Usage for Admins

### Creating Player Ads

1. Go to Admin Dashboard
2. Navigate to "Native Ads" section
3. Click "Create New Native Ad"
4. Fill in ad details:
   - **Title:** Ad headline
   - **Description:** Short ad copy
   - **Image URL:** Banner image (recommended: 1200x300px)
   - **Click URL:** Landing page URL
   - **Advertiser Name:** Company/brand name
   - **Placement Type:** Select one of:
     - Music Player Screen
     - Album Player Screen
     - Playlist Player Screen
   - **Priority:** 1-10 (higher = shown first)
   - **Target Countries:** (Optional) Comma-separated country codes
   - **Expiration Date:** (Optional) When ad should stop showing
5. Click "Create Native Ad"

### Best Practices

1. **Image Size:** Use 1200x300px or similar horizontal aspect ratio
2. **File Format:** PNG or JPG, optimized for web
3. **Priority:** Use 8-10 for premium ads, 5-7 for standard, 1-4 for filler
4. **Targeting:** Leave blank for global reach, specify countries for local ads
5. **Copy:** Keep title under 50 characters, description under 100
6. **Testing:** Create test ads with low priority first

## Features

### Visual Design
- Modern gradient background with backdrop blur
- Responsive layout (max-width 280px, centered)
- Smooth hover animations
- "SPONSORED" badge for transparency
- Green CTA button matching app theme

### User Experience
- Non-intrusive placement
- Clear ad labeling
- One-click access to advertiser site
- Respects user privacy (no personal data tracking)

### Performance
- Lazy loading of images
- Intersection Observer for efficient impression tracking
- Minimal bundle size impact
- No blocking of player functionality

## Testing

Build completed successfully with no errors:
```bash
npm run build
✓ 2587 modules transformed
```

All TypeScript types validated correctly.

## Files Modified

1. `src/components/PlayerStaticAdBanner.tsx` - New component
2. `src/screens/MusicPlayerScreen/MusicPlayerScreen.tsx` - Added ad support
3. `src/screens/AlbumPlayerScreen/AlbumPlayerScreen.tsx` - Added ad support
4. `src/screens/PlaylistPlayerScreen/PlaylistPlayerScreen.tsx` - Added ad support
5. `src/screens/AdminDashboardScreen/NativeAdsSection.tsx` - Added placement types

## Database Schema

Uses existing `native_ad_cards` table with placement types:
- `music_player`
- `album_player`
- `playlist_player`

No database migrations required.

## Future Enhancements

Potential improvements:
1. A/B testing for multiple ads in same placement
2. Frequency capping (limit impressions per user)
3. Time-based ad scheduling
4. Genre-specific targeting
5. Revenue tracking per ad
6. Click-through rate reporting in admin dashboard
7. Ad preview in admin before publishing
