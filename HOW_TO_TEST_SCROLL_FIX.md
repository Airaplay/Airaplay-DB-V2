# How to Test the Scroll Fix

## Quick Test Steps

### 1. Play Any Song
- Go to Home screen
- Tap any song to play it
- ✅ Mini player should appear at the bottom

### 2. Test Scrolling on Home Screen
- Scroll all the way down
- Can you see the last section completely?
- Is any content hidden behind the mini player or nav bar?
- ✅ You should see ALL content with proper spacing

### 3. Test Other Screens
Navigate to each screen and test scrolling:

**Library Screen:**
- Go to Library tab
- Scroll to bottom
- ✅ All playlists/songs visible?

**Profile Screen:**
- Go to Profile tab
- Scroll to bottom
- ✅ All content accessible?

**Explore Screen:**
- Go to Explore tab
- Scroll through all genres
- ✅ Last genre fully visible?

### 4. Test Mini Player Hide/Show
- Play a song (mini player appears)
- Notice the smooth padding adjustment
- Close the mini player (X button)
- Notice padding reduces smoothly
- ✅ Transition should be smooth (0.3s animation)

### 5. Test Video Route
- Go to Home → Must Watch section
- Play any video
- ✅ Mini player should automatically hide
- Go back to Home
- ✅ Mini player should reappear

## What You Should See

### ✅ CORRECT Behavior:
- All content scrollable and visible
- No content hidden behind mini player
- No content hidden behind navigation bar
- Smooth padding transitions when mini player appears/disappears
- Proper spacing at the bottom (you should see some empty space after the last item)

### ❌ WRONG Behavior (If Not Fixed):
- Last items cut off
- Can't scroll to see bottom content
- Content hidden behind mini player
- Have to scroll "past" visible area to see content

## Visual Reference

```
┌─────────────────────────┐
│                         │
│   Scrollable Content    │
│                         │
│   [More Content]        │
│                         │
│   [Last Item]          │ ← Should be FULLY visible
│                         │
│   [Empty Space]        │ ← Padding area (invisible)
├─────────────────────────┤
│  🎵 Mini Music Player   │ ← 68px height
├─────────────────────────┤
│  [Home] [Search] [+]    │ ← Nav bar: 64px height
└─────────────────────────┘
```

## Debugging

If content is still clipped:

1. **Open browser DevTools** (if testing in browser)
2. **Inspect body element**
3. **Check if `mini-player-active` class is present**
   - If YES: Class is working
   - If NO: React hook may not be triggering

4. **Inspect any screen container**
5. **Check computed `padding-bottom` value**
   - Without mini player: should be ~80px (5rem)
   - With mini player: should be ~136px (8.5rem)

6. **Check if mini player is visible**
   - Mini player positioned at `bottom: calc(4rem + env(safe-area-inset-bottom))`
   - Should be 64px above the nav bar

## Expected Measurements

| Element | Height | Position |
|---------|--------|----------|
| Nav Bar | 64px (4rem) | Fixed bottom: 0 |
| Mini Player | ~68px (4.5rem) | Fixed bottom: 64px |
| Content Padding (no player) | 80px (5rem) | Bottom padding |
| Content Padding (with player) | 136px (8.5rem) | Bottom padding |

## Known Good Behaviors

✅ Mini player hides on these routes:
- `/video/:id` - Video player screen
- `/album/:id` - Album player screen
- `/playlist/:id` - Playlist player screen
- `/create` - Create/upload screen

✅ Mini player shows on these routes:
- `/` - Home
- `/explore` - Explore
- `/library` - Library
- `/profile` - Profile
- `/treats` - Treat store
- All other main screens

---

**If all tests pass, the scroll fix is working correctly! 🎉**
