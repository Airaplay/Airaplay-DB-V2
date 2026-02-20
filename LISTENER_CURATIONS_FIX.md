# Listener Curations Section Fix

## Problem
The ListenerCurationsSection was displaying regular uploaded singles and albums, when it should ONLY show:
1. User-created playlists
2. Promoted content (any type: playlists, songs, albums)

## What Was Fixed

### Before
The section was fetching:
- User-created playlists ✓
- **Regular songs (top by play count)** ✗ WRONG
- **Regular albums (top by play count)** ✗ WRONG
- Promoted playlists ✓
- Promoted songs ✓
- Promoted albums ✓

This caused singles uploaded by users to appear in the section even when they weren't promoted.

### After
The section now ONLY fetches:
- User-created playlists ✓
- Promoted playlists ✓
- Promoted songs ✓ (only if promoted)
- Promoted albums ✓ (only if promoted)

## Changes Made

### File: `src/screens/HomePlayer/sections/ListenerCurationsSection/ListenerCurationsSection.tsx`

1. **Removed regular songs query** (lines 101-104)
   - No longer fetches top songs by play count
   - Songs now ONLY appear if they are promoted

2. **Removed regular albums query** (lines 105-108)
   - No longer fetches top albums by play count
   - Albums now ONLY appear if they are promoted

3. **Removed songs processing** (lines 131-146)
   - Removed code that added regular songs to the content list

4. **Removed albums processing** (lines 149-164)
   - Removed code that added regular albums to the content list

5. **Updated promoted content logic**
   - Songs in promoted list are now always added (they're only shown if promoted)
   - Albums in promoted list are now always added (they're only shown if promoted)
   - Playlists check if already in the list before adding

6. **Increased playlist limit**
   - Changed from 15 to 20 playlists to ensure enough content

7. **Fixed promoted playlist fetching**
   - Changed from RPC call to direct table query for promoted playlists
   - Properly handles playlist data structure

## Result

The Listener Curations section now correctly shows:
- User-created playlists (curated by listeners)
- Promoted content only (playlists, songs, or albums that creators have paid to promote)

Singles uploaded as regular tracks will NOT appear unless they are actively promoted by the creator.

## Verification

Build tested and passed:
```bash
npm run build:app
✓ built in 22.27s
```

No linting errors related to the logic changes.
