# Unified Cache Logic Implementation - Complete

## Overview
All home screen sections now use the **exact same cache logic pattern** as TrendingSection, with only the cache duration being different per section.

## The Unified Pattern

Every section now follows this exact structure:

### 1. **State Setup**
```typescript
const [songs, setSongs] = useState<Song[]>([]);
const [isLoading, setIsLoading] = useState(true);
const isInitialMount = useRef(true);
```

### 2. **Cache Key Definition**
```typescript
const CACHE_KEY = 'section_name_processed';
```

### 3. **Load Cache on Mount**
```typescript
useEffect(() => {
  const loadCached = async () => {
    if (isInitialMount.current) {
      const cached = await persistentCache.get<Song[]>(CACHE_KEY);
      if (cached && cached.length > 0) {
        setSongs(cached);
      }
      isInitialMount.current = false;
    }
  };
  loadCached();
}, []);
```

### 4. **Cache Processed Data**
```typescript
// After processing songs with promotions
setSongs(processedSongs);
await persistentCache.set(CACHE_KEY, processedSongs, DURATION_MS);
```

### 5. **Loading Logic**
```typescript
// Only show loading skeleton on very first load when we have absolutely no data
const shouldShowLoading = isLoading && songs.length === 0 && !isInitialMount.current;

// Hide section only if we truly have no content to display
if (!shouldShowLoading && songs.length === 0) {
  return <></>;
}
```

### 6. **Render Logic**
```typescript
{shouldShowLoading ? (
  // Loading skeleton
) : (
  // Display songs directly - no fallback, no error states
  songs.map((song) => ...)
)}
```

## Cache Durations by Section

| Section | Cache Duration | Cache Key |
|---------|---------------|-----------|
| TrendingSection | 30 minutes | `trending_section_processed` |
| TrendingNearYouSection | 20 minutes | `trending_near_you_section_processed` |
| InspiredByYouSection | 15 minutes | `inspired_by_you_section_processed` |
| MustWatchSection | 18 minutes | `must_watch_section_processed` |
| NewReleasesSection | 7 minutes | `new_releases_section_processed` |
| MixForYouSection | 33 minutes | `mix_for_you_section_processed` |
| TrendingAlbumsSection | 25 minutes | `trending_albums_section_processed` |
| AIRecommendedSection | 5 minutes | `ai_recommended_section_processed` |

## Key Benefits

### 1. **Consistent Behavior**
All sections now behave identically:
- Instant display from cache
- No loading states on navigation
- Background refresh at specified intervals
- No fallback/error states cluttering the UI

### 2. **Simplified Logic**
Removed complexity:
- ❌ No `displayItems` fallback arrays
- ❌ No complex error state rendering
- ❌ No `shouldShow` flags
- ✅ Simple: cached data or hide section

### 3. **Performance**
Each section:
- Loads instantly on mount (from cache)
- Refreshes silently in background
- Never blocks or shows unnecessary skeletons
- Persists across navigation

## The Critical Check

The magic is in this line:
```typescript
const shouldShowLoading = isLoading && songs.length === 0 && !isInitialMount.current;
```

This ensures:
- ✅ Loading shows **only** when truly no data exists
- ✅ `!isInitialMount.current` prevents loading flash while cache loads
- ✅ If cache exists, it's shown immediately
- ✅ Background refresh happens without disrupting display

## User Experience Flow

### First Visit Ever
1. User opens app
2. `isInitialMount.current` is `true` → No loading shown yet
3. Cache load attempt (returns nothing)
4. `isInitialMount.current` set to `false`
5. Fetch begins, loading skeleton shows briefly
6. Data loads, cached, displayed

### Subsequent Visits (Same Session)
1. User returns to home screen
2. State still has songs → Display immediately
3. No fetch, no loading
4. Silky smooth! ✨

### After App Restart
1. User opens app
2. `isInitialMount.current` is `true`
3. Cache loads from IndexedDB → Songs appear instantly!
4. `isInitialMount.current` set to `false`
5. Background refresh happens silently
6. Still smooth! 🚀

### After Cache Expires
1. Cache expires (e.g., after 20 minutes)
2. Old data still in state and displayed
3. Fetch happens in background
4. New data replaces old seamlessly
5. No loading interruption! 💫

## Technical Implementation

### Dual-Layer Caching
1. **Memory Cache** (React state)
   - Persists during session
   - Instant access
   - Survives navigation

2. **IndexedDB Cache** (persistentCache)
   - Survives app restarts
   - Automatic cleanup
   - TTL-based expiration

### Smart Fetch Logic
Sections only set `isLoading = true` when they have no cached data:
```typescript
if (songs.length === 0) {
  setIsLoading(true);
}
```

This prevents loading states when refreshing cached content.

## Result

Every section on the home screen now provides an instant, app-like experience:
- ✅ **Zero loading states** on navigation
- ✅ **Persistent content** across sessions
- ✅ **Background refresh** without disruption
- ✅ **Consistent behavior** across all sections
- ✅ **Only one difference** per section: cache duration

The home screen feels like a native app with instant, reliable content! 🎉
