# Persistent Home Screen Caching Implementation

## Overview
The home screen now implements a comprehensive persistent caching system that ensures content remains visible and never shows loading states when navigating back to the home screen.

## Key Changes

### 1. App-Level Context Provider
**Location**: `src/index.tsx`

The `HomeScreenDataProvider` is now wrapped at the app root level (alongside `MusicPlayerProvider` and `AlertProvider`), ensuring it persists across all navigation and never unmounts.

```typescript
<HomeScreenDataProvider>
  <MusicPlayerProvider>
    <App />
  </MusicPlayerProvider>
</HomeScreenDataProvider>
```

**Benefits**:
- Context data persists across all screen navigation
- No re-initialization when returning to home screen
- Single source of truth for all home screen data

### 2. Extended Cache Duration
**Location**: `src/lib/dataFetching.ts`

Cache duration increased from 3 minutes to 30 minutes:
```typescript
const HOME_SCREEN_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
```

**Benefits**:
- Content stays fresh longer
- Fewer API calls
- Better user experience during typical session length

### 3. Section-Level Persistent Caching
**Location**: `src/screens/HomePlayer/sections/TrendingSection/TrendingSection.tsx`

Each section now caches its **processed content** (including promotions) separately:

```typescript
const CACHE_KEY = 'trending_section_processed';

// Load cached songs on mount
useEffect(() => {
  const loadCachedSongs = async () => {
    if (isInitialMount.current) {
      const cached = await persistentCache.get<TrendingSong[]>(CACHE_KEY);
      if (cached && cached.length > 0) {
        setTrendingSongs(cached);
      }
      isInitialMount.current = false;
    }
  };
  loadCachedSongs();
}, []);

// Cache processed songs after merging with promotions
await persistentCache.set(CACHE_KEY, songsWithPromotion, 30 * 60 * 1000);
```

**Benefits**:
- Instant display on component mount
- Promotions already merged (no re-processing)
- IndexedDB + memory cache for reliability

### 4. Smart Loading Logic
Only shows loading skeleton when truly needed:

```typescript
const isLoading = dataLoading && trendingSongs.length === 0 && formattedSongs.length === 0 && !isInitialMount.current;
```

**When loading shows**:
- Very first app visit (no cache exists)

**When loading doesn't show**:
- Returning to home screen (has cached data)
- After cache expires (shows old data while refreshing)
- Quick navigation (context data still available)

## User Experience Flow

### First Visit
1. User opens app
2. Shows loading skeleton briefly
3. Fetches data from API
4. Processes promotions
5. Caches everything (context + processed sections)

### Returning to Home Screen (Same Session)
1. User navigates back to home
2. **Instantly shows cached content** (no loading)
3. If cache expired, refreshes in background
4. Updates content seamlessly

### After App Restart
1. User opens app again
2. **Loads from IndexedDB cache** (instant display)
3. Refreshes data in background
4. Updates when new data arrives

### Content Refresh
Content automatically refreshes:
- After 30 minutes (background refresh)
- On pull-to-refresh gesture
- When explicitly requested

## Cache Storage

The system uses a multi-layer caching approach:

### Layer 1: Memory Cache (persistentCache.memoryCache)
- Fastest access
- Lives in JavaScript memory
- Lost on page reload
- Used for immediate access

### Layer 2: IndexedDB (persistentCache.db)
- Persistent across sessions
- Survives page reloads
- Automatic cleanup of expired items
- Used for long-term storage

### Layer 3: Context State
- Lives in React context
- Persists while app is running
- Shared across all components
- Never resets during navigation

## Cache Keys

| Key | Content | Duration | Storage |
|-----|---------|----------|---------|
| `home_screen_data_v2` | Raw home screen data | 30 min | IndexedDB + Memory |
| `trending_section_processed` | Trending songs with promotions | 30 min | IndexedDB + Memory |

## Performance Benefits

### Before
- Navigate away and back: **Shows loading skeleton**
- Data refetches: **Every 3 minutes**
- Promotions: **Reprocessed on every mount**
- User experience: **Feels slow and janky**

### After
- Navigate away and back: **Instant display**
- Data refetches: **Every 30 minutes (background)**
- Promotions: **Cached and reused**
- User experience: **Feels instant and smooth**

## Future Enhancements

To extend this pattern to other sections:

1. Create a cache key constant
2. Load cached data on mount using `useRef` to track initial load
3. Cache processed data after promotion merging
4. Update loading logic to check for cached data

Example for NewReleasesSection:
```typescript
const CACHE_KEY = 'new_releases_section_processed';
const isInitialMount = useRef(true);

useEffect(() => {
  const loadCached = async () => {
    if (isInitialMount.current) {
      const cached = await persistentCache.get(CACHE_KEY);
      if (cached) setSongs(cached);
      isInitialMount.current = false;
    }
  };
  loadCached();
}, []);
```

## Conclusion

The home screen now provides an app-like experience where content persists across navigation, loads instantly, and only refreshes when necessary. Users will never see unnecessary loading states or content disappearing.
