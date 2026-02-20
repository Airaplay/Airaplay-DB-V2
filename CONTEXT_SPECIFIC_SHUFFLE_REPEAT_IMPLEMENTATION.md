# Context-Specific Shuffle & Repeat Implementation

## Overview

Successfully implemented context-specific shuffle and repeat settings where each player screen (MusicPlayerScreen, AlbumPlayerScreen, PlaylistPlayerScreen) maintains its own independent shuffle/repeat state.

## What Was Implemented

### 1. Database Schema

**New Table: `user_player_context_settings`**
- Stores shuffle and repeat preferences per playback context
- Each context (album, playlist, song) has independent settings
- Settings persist across sessions and are user-specific
- Automatic cleanup of contexts not accessed in 90+ days

**Key Fields:**
- `user_id` - User who owns the settings
- `context_key` - Unique identifier (e.g., 'album-{id}', 'playlist-{id}')
- `context_type` - Type of context (album, playlist, song, discovery, profile)
- `shuffle_enabled` - Boolean for shuffle state
- `repeat_mode` - Enum: 'off', 'one', 'all'
- `last_used_at` - Timestamp for cleanup purposes

**Helper Functions:**
- `upsert_context_settings()` - Save or update settings
- `cleanup_old_context_settings()` - Remove stale data

### 2. Context Settings Management

**New File: `src/lib/contextSettings.ts`**

**Key Functions:**
- `generateContextKey()` - Creates unique context identifiers
  - Albums: `album-{albumId}`
  - Playlists: `playlist-{playlistId}`
  - Profile sections: `profile-{userId}-singles`
  - Discovery: `discovery-{contextName}`

- `loadContextSettings()` - Retrieves settings for a context
  - Uses in-memory cache for performance
  - Falls back to defaults if none exist

- `saveContextSettings()` - Persists settings to database
  - Debounced to prevent excessive writes
  - Updates cache immediately for instant UI feedback

### 3. Global Player Hook Updates

**File: `src/hooks/useMusicPlayer.ts`**

**Changes:**
1. Added context key tracking via `currentContextKeyRef`
2. Added effect to load context-specific settings when context changes
3. Updated `toggleShuffle()` to save settings per context
4. Updated `toggleRepeat()` to save settings per context
5. Automatic shuffled playlist generation when shuffle is loaded

**Behavior:**
- When `playlistContext` or `albumId` changes, load that context's settings
- Settings are loaded asynchronously without blocking playback
- Each context remembers its own shuffle/repeat preferences

### 4. MusicPlayerScreen Updates

**File: `src/screens/MusicPlayerScreen/MusicPlayerScreen.tsx`**

**Changes:**
1. Imported and integrated `useMusicPlayer` hook
2. Removed local `isShuffleEnabled` and `repeatMode` state
3. Using global context-aware state instead
4. Updated toggle handlers to call global functions:
   - `handleToggleShuffle()` → calls `globalToggleShuffle()`
   - `handleToggleRepeat()` → calls `globalToggleRepeat()`

### 5. Existing Player Screens

**AlbumPlayerScreen & PlaylistPlayerScreen:**
- Already using global `useMusicPlayer` hook ✅
- Already passing correct context keys ✅
- No changes needed - work perfectly with new system

**Context Keys Used:**
- AlbumPlayerScreen: `album-${albumData.id}`
- PlaylistPlayerScreen: `playlist-${playlistData.id}`

## How It Works

### User Flow Example

**Scenario 1: Album to Song**
```
1. User plays Album A
2. Enables shuffle
   → Saved as: context_key='album-abc123', shuffle=true

3. User switches to Single Song B
   → New context: context_key='song-xyz789'
   → Loads settings: shuffle=false (default)
   → Button shows OFF

4. User returns to Album A
   → Context: context_key='album-abc123'
   → Loads saved settings: shuffle=true
   → Button shows ON (remembered!)
```

**Scenario 2: Playlist to Playlist**
```
1. User plays Playlist A with repeat ALL
   → Saved as: context_key='playlist-111', repeat='all'

2. User switches to Playlist B
   → New context: context_key='playlist-222'
   → Loads settings: repeat='off' (default)
   → Button shows OFF

3. User returns to Playlist A
   → Context: context_key='playlist-111'
   → Loads saved settings: repeat='all'
   → Button shows REPEAT ALL (remembered!)
```

### Context Detection Logic

```typescript
// When context changes
playlistContext: 'album-abc123'
albumId: 'abc123'
↓
generateContextKey() → 'album-abc123'
↓
loadContextSettings('album-abc123')
↓
Returns: { shuffle_enabled: true, repeat_mode: 'one' }
↓
Updates player state
```

### Settings Persistence

1. **Toggle Event:**
   - User clicks shuffle/repeat button
   - Global state updates immediately (instant UI feedback)
   - Debounced save to database (1 second delay)

2. **Context Switch:**
   - Detect context change via useEffect
   - Load settings from cache or database
   - Update UI to reflect context's settings

3. **Session Restore:**
   - App reopens
   - Context is restored
   - Settings automatically loaded for that context

## Benefits

✅ **Independent Contexts** - Each album/playlist/song has its own settings
✅ **Persistent Memory** - Settings remembered across sessions
✅ **No Confusion** - Switching content doesn't affect other content's settings
✅ **Clean UX** - Users can have different preferences per content type
✅ **Performance** - In-memory cache prevents excessive database reads
✅ **Scalable** - Automatic cleanup prevents unbounded growth

## Technical Details

### Context Key Generation

```typescript
// Albums get their ID-based key
album-abc123-def456

// Playlists get their ID-based key
playlist-xyz789-uvw012

// Creator profiles get section-specific keys
profile-user123-singles
profile-user123-albums

// Discovery contexts get prefixed keys
discovery-Global-Trending
discovery-New-Releases
```

### Database Performance

- **Indexes** on `user_id`, `context_key`, `last_used_at`
- **Composite primary key** ensures one setting per user per context
- **RLS policies** ensure users only access their own settings
- **Cleanup function** removes contexts older than 90 days

### Memory Management

- **In-memory cache** for fast lookups
- **Debounced saves** reduce database writes
- **Lazy loading** only loads settings when needed
- **Cache invalidation** on context change

## Testing Points

### Manual Testing

1. **Album Independence:**
   - Enable shuffle on Album A
   - Play Album B (should be off)
   - Return to Album A (should still be on)

2. **Playlist Independence:**
   - Set repeat to "all" on Playlist A
   - Play Playlist B (should be off)
   - Return to Playlist A (should still be "all")

3. **Cross-Screen Consistency:**
   - Enable shuffle in AlbumPlayerScreen
   - Expand to MusicPlayerScreen (should show ON)
   - Collapse back to AlbumPlayerScreen (should still be ON)

4. **Session Persistence:**
   - Enable shuffle on Album X
   - Close app
   - Reopen app and play Album X
   - Shuffle should still be ON

### Edge Cases Handled

- ✅ Switching from single song to album
- ✅ Switching from album to playlist
- ✅ Smart Autoplay context transitions
- ✅ Creator profile section transitions
- ✅ Session restore with context settings
- ✅ Anonymous users (use defaults)
- ✅ Missing context data (use defaults)

## Files Modified

1. **Database:**
   - `supabase/migrations/[timestamp]_create_context_specific_player_settings.sql`

2. **New Files:**
   - `src/lib/contextSettings.ts`

3. **Modified Files:**
   - `src/hooks/useMusicPlayer.ts`
   - `src/screens/MusicPlayerScreen/MusicPlayerScreen.tsx`

4. **Verified (No Changes Needed):**
   - `src/screens/AlbumPlayerScreen/AlbumPlayerScreen.tsx`
   - `src/screens/PlaylistPlayerScreen/PlaylistPlayerScreen.tsx`

## Build Status

✅ Build completed successfully
✅ No TypeScript errors
✅ All imports resolved correctly
✅ Database migration applied

## Summary

The implementation successfully achieves the goal of context-specific shuffle and repeat settings. Each player screen now maintains its own independent state, providing users with a clean and intuitive experience where their preferences are remembered per content type without affecting other contexts.
