# Egress Optimization Developer Guide

Quick reference for writing efficient Supabase queries that minimize egress costs.

---

## 🚫 NEVER Do This

### 1. Never use `select('*')`
```typescript
// ❌ BAD - Fetches all columns including binary fields
const { data } = await supabase
  .from('songs')
  .select('*')
```

### 2. Never fetch audio/video URLs in list queries
```typescript
// ❌ BAD - Audio URLs should only be fetched when playing
const { data } = await supabase
  .from('songs')
  .select('id, title, audio_url, cover_image_url')
  .limit(20)
```

### 3. Never query without pagination
```typescript
// ❌ BAD - Could fetch thousands of records
const { data } = await supabase
  .from('treat_promotions')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
```

### 4. Never nest more than 2 levels deep
```typescript
// ❌ BAD - Too much nesting with binary fields
.select(`
  id, title, audio_url, cover_image_url,
  artists:artist_id (
    id, name, image_url,
    artist_profiles (
      profile_photo_url,
      social_links (*)  // Too deep!
    )
  )
`)
```

### 5. Never skip caching for config tables
```typescript
// ❌ BAD - Fetches same data every time
const { data } = await supabase
  .from('daily_mix_config')
  .select('*')
  .single()
```

---

## ✅ ALWAYS Do This

### 1. Always specify exact columns needed
```typescript
// ✅ GOOD - Only fetch what you need
const { data } = await supabase
  .from('songs')
  .select('id, title, duration_seconds, artist_id, cover_image_url, play_count')
  .limit(20)
```

### 2. Always add pagination limits
```typescript
// ✅ GOOD - Reasonable limits prevent egress overflow
const { data } = await supabase
  .from('treat_promotions')
  .select('id, content_type, status, cost, created_at')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(50)
```

### 3. Fetch binary fields separately when needed
```typescript
// ✅ GOOD - Fetch metadata first
const songs = await supabase
  .from('songs')
  .select('id, title, artist_id, cover_image_url')
  .limit(20)

// Then fetch audio URL only when playing
const { data: songDetails } = await supabase
  .from('songs')
  .select('id, audio_url')
  .eq('id', songToPlay)
  .single()
```

### 4. Keep nested queries minimal
```typescript
// ✅ GOOD - Minimal nested data
.select(`
  id, title, artist_id,
  artists:artist_id (
    id, name,
    artist_profiles (
      id, user_id, stage_name, is_verified
    )
  )
`)
```

### 5. Always cache config tables
```typescript
// ✅ GOOD - Use centralized cache
import { fetchWithCache, CACHE_KEYS, CACHE_TTL } from '@/lib/configCache'

const config = await fetchWithCache(
  CACHE_KEYS.DAILY_MIX_CONFIG,
  CACHE_TTL.ONE_DAY,
  async () => {
    const { data } = await supabase
      .from('daily_mix_config')
      .select('enabled, mixes_per_user, songs_per_mix')
      .single()
    return data
  }
)
```

---

## 📋 Column Guidelines

### 🔴 High-Egress Columns (Fetch Only When Needed)

| Column | Size | When to Fetch |
|--------|------|---------------|
| `audio_url` | 50-500KB | Only when playing |
| `video_url` | 100KB-2MB | Only when playing |
| `profile_photo_url` | 10-100KB | Detail views only |
| `cover_photo_url` | 10-100KB | Detail views only |
| `cover_image_url` | 10-100KB | OK for lists |
| `image_url` | 10-100KB | Lazy load in lists |
| `thumbnail` | 5-20KB | OK for lists |
| `metadata` | Varies | Selective fetching |

### 🟢 Safe Columns (Always OK to Fetch)

- `id`, `user_id`, `artist_id` - UUIDs (36 bytes)
- `title`, `name`, `stage_name` - Short text (< 100 bytes)
- `duration_seconds`, `play_count` - Numbers (8 bytes)
- `created_at`, `updated_at` - Timestamps (8 bytes)
- `is_verified`, `is_active`, `is_public` - Booleans (1 byte)
- `status`, `role` - Enums (< 20 bytes)

### 🟡 Medium-Egress Columns (Fetch with Caution)

- `description`, `bio` - Can be long (100-5000 bytes)
- `lyrics` - Very long (1-10KB)
- `targeting_rules` - JSON (100-1000 bytes)
- `exchange_rates` - JSON (100-500 bytes)

---

## 🎯 Query Patterns

### List Views (Trending, Search, Browse)
```typescript
const { data } = await supabase
  .from('songs')
  .select('id, title, artist_id, cover_image_url, play_count')
  .order('play_count', { ascending: false })
  .limit(20)
```

### Detail Views (Song/Video Player)
```typescript
const { data } = await supabase
  .from('songs')
  .select('id, title, audio_url, cover_image_url, duration_seconds, artist_id, lyrics')
  .eq('id', songId)
  .single()
```

### User Profile Views
```typescript
const { data } = await supabase
  .from('users')
  .select('id, username, display_name, bio, profile_picture_url, is_creator, contribution_score')
  .eq('id', userId)
  .single()
```

### Config Tables (Use Cache!)
```typescript
import { fetchWithCache, CACHE_KEYS, CACHE_TTL } from '@/lib/configCache'

const config = await fetchWithCache(
  CACHE_KEYS.MOOD_CATEGORIES,
  CACHE_TTL.ONE_DAY,
  async () => {
    const { data } = await supabase
      .from('mood_categories')
      .select('id, name, type, description, icon, color')
      .order('name')
    return data || []
  }
)
```

---

## 🎨 Caching Patterns

### Available Cache Keys
```typescript
import { CACHE_KEYS } from '@/lib/configCache'

CACHE_KEYS.DAILY_MIX_CONFIG
CACHE_KEYS.EXCHANGE_RATES
CACHE_KEYS.MOOD_CATEGORIES
CACHE_KEYS.PAYMENT_CHANNELS
CACHE_KEYS.COLLABORATION_UNLOCK_SETTINGS
CACHE_KEYS.AD_PLACEMENT_CONFIG
CACHE_KEYS.GENRE_LIST
```

### Available TTL Options
```typescript
import { CACHE_TTL } from '@/lib/configCache'

CACHE_TTL.ONE_HOUR      // 1 hour
CACHE_TTL.SIX_HOURS     // 6 hours
CACHE_TTL.TWELVE_HOURS  // 12 hours
CACHE_TTL.ONE_DAY       // 24 hours
CACHE_TTL.ONE_WEEK      // 7 days
```

### Basic Usage
```typescript
import { fetchWithCache, CACHE_KEYS, CACHE_TTL } from '@/lib/configCache'

// Simple config fetch with caching
const data = await fetchWithCache(
  'my_config_key',
  CACHE_TTL.ONE_DAY,
  async () => {
    const { data } = await supabase.from('my_table').select('*').single()
    return data
  }
)
```

### Force Refresh
```typescript
// Force refresh bypasses cache
const freshData = await fetchWithCache(
  CACHE_KEYS.EXCHANGE_RATES,
  CACHE_TTL.ONE_HOUR,
  fetchFunction,
  true // forceRefresh
)
```

### Manual Cache Management
```typescript
import { configCache } from '@/lib/configCache'

// Invalidate specific cache
configCache.invalidate(CACHE_KEYS.EXCHANGE_RATES)

// Clear all cache
configCache.clearAll()

// Get cache statistics
const stats = configCache.getStats()
console.log(stats) // { memorySize, localStorageSize, keys }
```

---

## 📏 Pagination Limits

| Query Type | Recommended Limit | Max Limit |
|------------|------------------|-----------|
| Song Lists | 20-50 | 100 |
| Video Lists | 15-30 | 50 |
| User Playlists | 50 | 100 |
| Transactions | 50 | 100 |
| Promotions | 50 | 100 |
| Config Tables | 100 | 200 |
| Social Links | 20 | 50 |
| Search Results | 20 per type | 50 |

---

## 🔍 Pre-Commit Checklist

Before committing a query, verify:

- [ ] No `select('*')` used
- [ ] Specific columns listed
- [ ] Pagination limit added (if fetching multiple)
- [ ] No `audio_url` or `video_url` in list queries
- [ ] Nested queries kept to 2 levels max
- [ ] No `profile_photo_url` in nested relationships unless needed
- [ ] Config queries use caching
- [ ] Binary/image fields minimized

---

## 🐛 Quick Audit Commands

```bash
# Find select('*') queries
grep -r "\.select('\*')" src/

# Find queries without limits
grep -r "\.select(" src/ | grep -v "\.limit("

# Find audio_url in select statements
grep -r "audio_url" src/lib/supabase.ts | grep "select"

# Find video_url in select statements
grep -r "video_url" src/lib/supabase.ts | grep "select"
```

---

## 💾 Memory & Storage

### Cache Storage
- **Memory Cache:** ~50-100KB (cleared on page refresh)
- **LocalStorage:** ~50-100KB (persists across sessions)
- **Total:** < 200KB (negligible cost for massive savings)

### When Cache is Cleared
- **Memory:** On page refresh/reload
- **LocalStorage:** On manual clear or expiration only
- **Both:** Can be cleared programmatically

---

## 🚀 Performance Impact

| Optimization | Egress Savings | User Impact |
|--------------|----------------|-------------|
| Remove audio_url from lists | 70-90% | None - fetched on play |
| Add pagination | 50-95% | Better UX |
| Specific columns vs * | 30-60% | None |
| Reduce nesting | 20-40% | None |
| Cache config tables | 80-99% | Faster loads |
| Remove image_url from search | 40-60% | Images lazy-loaded |

---

## 📊 Real-World Examples

### Before Optimization ❌
```typescript
// 29 problematic patterns found in audit
// Estimated 3.5-18GB/day egress for 1K users

export const getTrendingSongs = async () => {
  const { data } = await supabase
    .from('songs')
    .select(`
      *,
      artists:artist_id (
        *,
        artist_profiles (*)
      )
    `)
    .order('play_count', { ascending: false })
    .limit(20)
  return data
}
```

**Issues:**
- `select('*')` - all columns
- Nested `*` - includes profile_photo_url
- Audio URLs included unnecessarily
- ~500KB per query

### After Optimization ✅
```typescript
// Optimized - specific columns, minimal nesting
// Estimated 520MB-2.7GB/day egress for 1K users (70-85% reduction)

import { fetchWithCache, CACHE_KEYS, CACHE_TTL } from '@/lib/configCache'

export const getTrendingSongs = async (limit = 20) => {
  const { data } = await supabase
    .from('songs')
    .select(`
      id,
      title,
      duration_seconds,
      artist_id,
      cover_image_url,
      play_count,
      artists:artist_id (
        id,
        name,
        artist_profiles (
          id,
          user_id,
          stage_name,
          is_verified
        )
      )
    `)
    .order('play_count', { ascending: false })
    .limit(limit)

  return data?.map(song => ({
    id: song.id,
    title: song.title,
    artist: song.artists?.artist_profiles?.[0]?.stage_name || song.artists?.name,
    artist_id: song.artists?.id || song.artist_id,
    cover_image_url: song.cover_image_url,
    audio_url: '', // Fetched when playing
    duration_seconds: song.duration_seconds || 0,
    play_count: song.play_count || 0
  }))
}
```

**Benefits:**
- Specific columns only
- No audio URLs (save 70-90%)
- Minimal nesting (no profile_photo_url)
- ~50KB per query (10x reduction!)

---

## 🎓 Common Mistakes

### Mistake #1: Fetching All Columns
```typescript
// ❌ Don't do this
.select('*')

// ✅ Do this
.select('id, title, artist_id, cover_image_url')
```

### Mistake #2: Audio URLs in Lists
```typescript
// ❌ Don't do this
.select('id, title, audio_url, cover_image_url')

// ✅ Do this
.select('id, title, artist_id, cover_image_url')
// Fetch audio_url separately when playing
```

### Mistake #3: No Pagination
```typescript
// ❌ Don't do this
.eq('user_id', userId).order('created_at')

// ✅ Do this
.eq('user_id', userId).order('created_at').limit(50)
```

### Mistake #4: Deep Nesting with Images
```typescript
// ❌ Don't do this
.select(`
  id, title,
  artists (
    id, image_url,
    artist_profiles (
      profile_photo_url,
      social_links (icon_url)
    )
  )
`)

// ✅ Do this
.select(`
  id, title, artist_id,
  artists (
    id, name,
    artist_profiles (id, user_id, stage_name)
  )
`)
```

### Mistake #5: Not Caching Config
```typescript
// ❌ Don't do this - fetches every time
const config = await supabase.from('config').select('*').single()

// ✅ Do this - cached for 24 hours
const config = await fetchWithCache(
  CACHE_KEYS.MY_CONFIG,
  CACHE_TTL.ONE_DAY,
  async () => {
    const { data } = await supabase
      .from('config')
      .select('setting1, setting2')
      .single()
    return data
  }
)
```

---

## 📖 Additional Resources

- **Phase 1 Details:** `POSTGREST_EGRESS_OPTIMIZATION_COMPLETE.md`
- **Phase 2 Details:** `PHASE_2_EGRESS_OPTIMIZATION_COMPLETE.md`
- **Complete Summary:** `POSTGREST_EGRESS_COMPLETE_SUMMARY.md`
- **Supabase Docs:** https://supabase.com/docs/guides/api

---

**Remember:** Every unnecessary byte costs money! Write efficient queries. 💰✨

**Last Updated:** 2026-02-07
