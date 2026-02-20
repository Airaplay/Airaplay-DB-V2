# Engagement Sync System - Quick Reference

## Overview

Real-time synchronization system for engagement metrics (play counts, likes, views, comments) across all app sections.

## Core Components

### 1. Engagement Sync Service
**Location**: `src/lib/engagementSyncService.ts`

Centralized event system for broadcasting metric updates.

```typescript
import { engagementSync } from '../lib/engagementSyncService';

// Update play count
engagementSync.updatePlayCount(songId, 'song', newCount);

// Update like count
engagementSync.updateLikeCount(songId, 'song', newCount);

// Update view count
engagementSync.updateViewCount(videoId, 'video', newCount);

// Update comment count
engagementSync.updateCommentCount(songId, 'song', newCount);
```

### 2. React Hooks
**Location**: `src/hooks/useEngagementSync.ts`

Three hooks for different use cases:

#### A. Subscribe to All Updates (Sections)
```typescript
import { useEngagementSync } from '../hooks/useEngagementSync';

// In your section component
useEngagementSync(useCallback((update) => {
  if (update.contentType === 'song' && update.metric === 'play_count') {
    setSongs(prevSongs =>
      prevSongs.map(song =>
        song.id === update.contentId
          ? { ...song, play_count: update.value }
          : song
      )
    );
  }
}, []));
```

#### B. Subscribe to Specific Content (Detail Screens)
```typescript
import { useContentEngagementSync } from '../hooks/useEngagementSync';

// In a song detail screen
useContentEngagementSync(songId, (update) => {
  if (update.metric === 'play_count') {
    setSong(prev => ({ ...prev, play_count: update.value }));
  }
});
```

#### C. Manually Emit Updates (Buttons/Actions)
```typescript
import { useEngagementEmitter } from '../hooks/useEngagementSync';

const { updateLikeCount, updateCommentCount } = useEngagementEmitter();

// In a like button handler
const handleLike = async () => {
  // ... API call to like the song ...
  updateLikeCount(songId, 'song', newLikeCount);
};
```

## Supported Metrics

| Metric | Content Types | Description |
|--------|---------------|-------------|
| `play_count` | song, video | Number of plays/views |
| `like_count` | song, video, album, playlist | Number of likes |
| `view_count` | song, video | Number of views |
| `comment_count` | song, video | Number of comments |

## Sections Already Updated

✅ TrendingSection
✅ NewReleasesSection
✅ TracksBlowingUpSection
✅ TrendingNearYouSection
✅ AIRecommendedSection
✅ InspiredByYouSection
✅ MustWatchSection (videos)
✅ ListenerCurationsSection
✅ TrendingAlbumsSection

## How to Add to New Section

**Step 1**: Import the hook
```typescript
import { useEngagementSync } from '../../../../hooks/useEngagementSync';
import { useCallback } from 'react';
```

**Step 2**: Add to component (after state declarations)
```typescript
// Real-time engagement sync
useEngagementSync(useCallback((update) => {
  if (update.contentType === 'song' && update.metric === 'play_count') {
    setYourData(prevData =>
      prevData.map(item =>
        item.id === update.contentId
          ? { ...item, play_count: update.value }
          : item
      )
    );
  }
}, []));
```

**Step 3**: Update state mapping for your data structure

## How to Add New Metric (e.g., Share Count)

**Step 1**: Add to EngagementMetric type
```typescript
// In src/lib/engagementSyncService.ts
type EngagementMetric = 'play_count' | 'like_count' | 'view_count' | 'comment_count' | 'share_count';
```

**Step 2**: Add emitter method
```typescript
// In EngagementSyncService class
updateShareCount(contentId: string, contentType: 'song' | 'video', newCount: number): void {
  this.emit({
    contentId,
    contentType,
    metric: 'share_count',
    value: newCount,
    timestamp: Date.now()
  });
}
```

**Step 3**: Add to useEngagementEmitter hook
```typescript
// In src/hooks/useEngagementSync.ts
const updateShareCount = useCallback((contentId: string, contentType: 'song' | 'video', count: number) => {
  engagementSync.updateShareCount(contentId, contentType, count);
}, []);

return {
  // ... existing methods
  updateShareCount
};
```

**Step 4**: Update sections to listen for new metric
```typescript
useEngagementSync(useCallback((update) => {
  if (update.metric === 'share_count') {
    // Update your state
  }
}, []));
```

## Integration Points

### Playback Tracking
Already integrated in `src/lib/playbackTrackerOptimized.ts`:
- Automatically emits play count updates after successful plays
- Fetches fresh count from database
- Broadcasts to all subscribers

### Like Button (Example)
```typescript
const handleLike = async (songId: string) => {
  // Call API
  const { data } = await supabase.rpc('toggle_like', { song_id: songId });

  // Emit update
  const { updateLikeCount } = useEngagementEmitter();
  updateLikeCount(songId, 'song', data.new_like_count);
};
```

### Comment Form (Example)
```typescript
const handleCommentSubmit = async (songId: string, comment: string) => {
  // Call API
  await supabase.from('comments').insert({ song_id: songId, text: comment });

  // Fetch new count
  const { count } = await supabase.from('comments').select('*', { count: 'exact' }).eq('song_id', songId);

  // Emit update
  const { updateCommentCount } = useEngagementEmitter();
  updateCommentCount(songId, 'song', count);
};
```

## Performance Notes

- ✅ Zero additional database queries during browsing
- ✅ In-memory updates only (React state)
- ✅ Event system is synchronous and fast
- ✅ Automatic cleanup on component unmount
- ✅ No memory leaks

## Debugging

### Check Active Listeners
```typescript
import { engagementSync } from '../lib/engagementSyncService';

console.log('Active listeners:', engagementSync.getListenerCount());
```

### Check Cached Values
```typescript
const cachedPlayCount = engagementSync.getCachedValue(songId, 'play_count');
console.log('Cached play count:', cachedPlayCount);
```

### Monitor Events (in browser console)
```typescript
// Subscribe to all events for debugging
engagementSync.subscribeToAll((update) => {
  console.log('[EngagementSync]', update);
});
```

## Common Patterns

### Pattern 1: Update Multiple Metrics
```typescript
useEngagementSync(useCallback((update) => {
  // Handle any metric update
  setData(prevData =>
    prevData.map(item => {
      if (item.id !== update.contentId) return item;

      // Update the specific metric
      return {
        ...item,
        [update.metric]: update.value
      };
    })
  );
}, []));
```

### Pattern 2: Filter by Content Type
```typescript
useEngagementSync(useCallback((update) => {
  // Only handle songs
  if (update.contentType !== 'song') return;

  // Handle song updates
  // ...
}, []));
```

### Pattern 3: Conditional Updates
```typescript
useEngagementSync(useCallback((update) => {
  // Only update if count increased
  if (update.metric === 'play_count') {
    setData(prevData =>
      prevData.map(item => {
        if (item.id === update.contentId && update.value > item.play_count) {
          return { ...item, play_count: update.value };
        }
        return item;
      })
    );
  }
}, []));
```

## Testing

### Manual Test Checklist
1. ✅ Play a song from Trending section
2. ✅ Check New Releases - verify count updated
3. ✅ Check other sections - verify consistency
4. ✅ Test with both logged-in and anonymous users
5. ✅ Verify no performance issues
6. ✅ Check browser console for sync events

### Expected Behavior
- All sections show identical play counts
- Updates happen immediately (within milliseconds)
- No flickering or visual glitches
- No extra network requests

## Troubleshooting

### Play counts not updating?
1. Check browser console for errors
2. Verify `useEngagementSync` is called in component
3. Check that callback is wrapped in `useCallback`
4. Verify state update logic matches your data structure

### Updates delayed?
1. Check network speed (fetching fresh count from DB)
2. Verify playback tracker is emitting events
3. Check console for fetch errors

### Memory leaks?
1. Verify `useCallback` dependencies are correct
2. Check that components unmount properly
3. Use React DevTools to check for stale subscriptions

## Best Practices

1. **Always use `useCallback`** for update handlers to prevent re-subscriptions
2. **Match data structure** - ensure update logic matches your state shape
3. **Filter content types** - only handle relevant content in your section
4. **Test thoroughly** - verify updates across all sections
5. **Monitor performance** - check React DevTools for unnecessary re-renders

## Future Enhancements

Ready to implement:
- 🔲 Optimistic updates (show expected value immediately)
- 🔲 Batch updates (group multiple events)
- 🔲 Offline queue (sync when back online)
- 🔲 Visual indicators (subtle animation on update)
- 🔲 Analytics tracking (measure engagement patterns)

## Questions?

Refer to the complete implementation guide: `PLAY_COUNT_SYNC_IMPLEMENTATION_COMPLETE.md`
