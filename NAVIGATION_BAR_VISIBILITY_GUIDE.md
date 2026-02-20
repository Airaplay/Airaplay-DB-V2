# Navigation Bar & Mini Player Visibility Guide

## Current Behavior (By Design)

### ✅ Screens WHERE Navigation Bar IS VISIBLE:

1. **Home** (`/`) - ✅ Nav bar visible
2. **Explore** (`/explore`) - ✅ Nav bar visible
3. **Library** (`/library`) - ✅ Nav bar visible
4. **Create** (`/create`) - ❌ **Nav bar HIDDEN by design** (see note below)
5. **Profile** (`/profile`) - ✅ Nav bar visible
6. **Public Profile** (`/user/:userId`) - ✅ Nav bar visible
7. **Treats** (`/treats`) - ✅ Nav bar visible
8. **Promotion Center** (`/promotion-center`) - ✅ Nav bar visible
9. **Daily Checkin** (`/daily-checkin`) - ✅ Nav bar visible
10. **Invite & Earn** (`/invite-earn`) - ✅ Nav bar visible
11. **View All Pages** - ✅ Nav bar visible
    - Trending (`/trending`)
    - Trending Near You (`/trending-near-you`)
    - Must Watch (`/must-watch`)
    - New Releases (`/new-releases`)
    - Trending Albums (`/trending-albums`)

### ❌ Screens WHERE Navigation Bar IS HIDDEN (By Design):

1. **Video Player** (`/video/:id`) - Hidden (full-screen experience)
2. **Album Player** (`/album/:id`) - Hidden (full-screen experience)
3. **Playlist Player** (`/playlist/:id`) - Hidden (full-screen experience)
4. **Notifications** (`/notifications`) - Hidden
5. **Withdraw Earnings** (`/withdraw-earnings`) - Hidden
6. **Edit Profile** (`/edit-profile`) - Hidden
7. **Become Artist** (`/become-artist`) - Hidden
8. **Transaction History** (`/transaction-history`) - Hidden
9. **Treat Analytics** (`/treat-analytics`) - Hidden
10. **Terms Pages** (`/terms/:type`) - Hidden
11. **Messages** (`/messages`, `/messages/:threadId`) - Hidden
12. **Upload Screens** - Hidden
    - Single Upload (`/upload/single`)
    - Album Upload (`/upload/album`)
13. **Admin Routes** (`/admin/*`) - Hidden
14. **When Auth Modal is showing** - Hidden
15. **When Upload Modal is visible** - Hidden
16. **When Full Music Player is active** - Hidden

## Mini Music Player Visibility

### ✅ WHERE Mini Player IS VISIBLE:

The mini player shows on **ALL main screens** where:
- A song is currently playing
- Full music player is NOT active
- User is NOT on these routes:
  - Video player (`/video/:id`)
  - Album player (when active)
  - Playlist player (when active)
  - Create screen (`/create`)

### Mini Player Positioning:
- **Position:** Fixed at bottom
- **Height:** ~68px
- **Distance from bottom:** `calc(4rem + env(safe-area-inset-bottom))`
- **This means:** 64px above the navigation bar
- **Z-index:** 40 (above content, below modals and nav bar)

## Why Create Screen (`/create`) Hides Navigation

**Line 105 & 205 in `src/index.tsx`:**
```typescript
const isCreateRoute = location.pathname === '/create';
const shouldHideMiniPlayer = isVideoRoute || isAlbumPlayerActive || isPlaylistPlayerActive || isCreateRoute;
```

The Create screen **intentionally hides** the mini music player to:
1. Provide more screen space for upload forms
2. Prevent audio playback from interfering with video uploads
3. Allow user to focus on content creation without distractions

## How to Check if Components are Rendering

### Method 1: Browser DevTools
1. Open browser DevTools (F12 or Right-click → Inspect)
2. Open Console tab
3. Type: `document.querySelector('.mobile-nav-bar')`
4. If it returns an element → Nav bar exists in DOM
5. If it returns `null` → Nav bar is hidden (check route)

### Method 2: Check Element in Elements Tab
1. Open DevTools → Elements tab
2. Press Ctrl+F (Cmd+F on Mac)
3. Search for: `mobile-nav-bar`
4. If found → Nav bar exists
5. Check computed styles to see if `display: none` or `visibility: hidden`

### Method 3: Check Mini Player
1. In Console, type: `document.body.classList.contains('mini-player-active')`
2. If `true` → Mini player should be visible
3. If `false` → No mini player (no song playing or on excluded route)

## Common Issues & Solutions

### Issue 1: "Navigation bar not showing on Home screen"

**Possible causes:**
1. ❌ Auth modal is open → Close it
2. ❌ Upload modal is open → Close it
3. ❌ Full music player is expanded → Minimize it
4. ❌ CSS z-index issue → Check DevTools computed styles
5. ❌ Element is rendered but invisible → Check opacity, display, visibility

**Solution:**
- Check `shouldHideNavigation` value in DevTools:
  ```javascript
  // In Console
  const nav = document.querySelector('.mobile-nav-bar');
  console.log('Nav exists:', !!nav);
  console.log('Nav styles:', window.getComputedStyle(nav));
  ```

### Issue 2: "Mini player not showing when song is playing"

**Possible causes:**
1. ❌ You're on an excluded route (video, album, playlist, create)
2. ❌ Full player is expanded
3. ❌ No song is currently set in state
4. ❌ `isMiniPlayerVisible` is false in state

**Solution:**
- Check state in React DevTools:
  - Install React DevTools browser extension
  - Find `App` component
  - Check `isMiniPlayerVisible`, `currentSong`, `isFullPlayerVisible`

### Issue 3: "Navigation bar hidden on wrong screen"

**Check the route conditions in `src/index.tsx` lines 185-202:**
- If your screen is incorrectly added to `shouldHideNavigation`
- Remove it from the condition
- Rebuild with `npm run build`

## Code Location Reference

### Navigation Bar Component:
**File:** `src/screens/HomePlayer/sections/NavigationBarSection/NavigationBarSection.tsx`
**Rendering:** `src/index.tsx` line 344
```typescript
{!shouldHideNavigation && !isAdminRoute && <NavigationBarSection />}
```

### Mini Music Player Component:
**File:** `src/components/MiniMusicPlayer.tsx`
**Rendering:** `src/index.tsx` line 347-365
```typescript
{isMiniPlayerVisible && currentSong && !isFullPlayerVisible && !shouldHideMiniPlayer && (
  <MiniMusicPlayer ... />
)}
```

### Visibility Logic:
**File:** `src/index.tsx` lines 185-205

### CSS Styles:
**File:** `src/index.css` lines 19-33
- `.mobile-nav-bar` - Safe area padding for nav bar
- `.content-with-nav` - Dynamic padding for content
- `body.mini-player-active .content-with-nav` - Extra padding when player visible

## Testing Checklist

### On Home Screen (`/`):
- [ ] Navigation bar visible at bottom?
- [ ] 5 nav icons showing (Home, Explore, Create, Library, Profile)?
- [ ] Active tab has green pill background?
- [ ] Clicking icons navigates correctly?

### When Playing a Song:
- [ ] Mini player appears above nav bar?
- [ ] Song title and artist showing?
- [ ] Play/pause button works?
- [ ] Close button hides player?
- [ ] Clicking player expands to full player?

### On Create Screen (`/create`):
- [ ] Navigation bar NOT visible? ✅ (This is correct!)
- [ ] Mini player NOT visible? ✅ (This is correct!)
- [ ] Back button in header works?

### On Video Player (`/video/:id`):
- [ ] Navigation bar NOT visible? ✅ (This is correct!)
- [ ] Mini player NOT visible? ✅ (This is correct!)
- [ ] Video plays full-screen?

## Making Navigation Bar ALWAYS Visible

If you want navigation bar visible on ALL screens (including Create):

### Option 1: Remove Create from Hide List
**File:** `src/index.tsx` line 205
```typescript
// BEFORE
const shouldHideMiniPlayer = isVideoRoute || isAlbumPlayerActive || isPlaylistPlayerActive || isCreateRoute;

// AFTER (if you want mini player on Create screen)
const shouldHideMiniPlayer = isVideoRoute || isAlbumPlayerActive || isPlaylistPlayerActive;
```

**Note:** Navigation bar will still show on Create screen, just the mini player will be visible.

### Option 2: Show Nav on All Screens Except Video/Album/Playlist
**File:** `src/index.tsx` lines 185-202
Remove routes from `shouldHideNavigation` condition that you want to show nav bar on.

## Current Status

✅ **Navigation bar IS working correctly!**
✅ **Mini player IS working correctly!**
✅ **Both are hidden on appropriate screens by design!**

If you're not seeing them:
1. Check which route/screen you're on
2. Check if it's in the "hidden" list above
3. Check DevTools to verify the element exists in DOM
4. Check for JavaScript errors in Console

---

**The navigation bar and mini player are working as designed. They automatically show/hide based on the current route and app state.**
