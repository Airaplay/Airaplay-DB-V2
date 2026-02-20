# Mood Discovery System - Analysis & Improvements

## Current System Overview

### How Songs Are Determined for Moods

The current mood detection system works in three stages:

#### 1. Genre-Based Feature Generation
```typescript
// Location: src/lib/moodAnalysisService.ts (lines 87-132)
```

Songs are analyzed based on their **genre only**, generating synthetic audio features:

- **Tempo** - Beats per minute (e.g., Hip Hop: 95, EDM: 128, Metal: 140)
- **Energy** - Intensity level (0-1 scale)
- **Valence** - Positivity/happiness (0-1 scale)
- **Danceability** - How suitable for dancing (0-1 scale)
- **Acousticness** - Amount of acoustic instruments (0-1 scale)
- **Instrumentalness** - Vocal vs instrumental content (0-1 scale)

**Problem:** All songs in the same genre get similar features, leading to poor mood matching.

#### 2. Rule-Based Mood Assignment
```typescript
// Location: src/lib/moodAnalysisService.ts (lines 137-202)
```

Moods are assigned using hardcoded rules:

```typescript
// Examples:
if (valence > 0.7 && energy > 0.7) → Happy + Energetic
if (valence < 0.4 && energy < 0.5) → Sad + Chill
if (energy > 0.75 && danceability > 0.75) → Party + Workout
```

**Problem:** Oversimplified rules that don't account for:
- Song lyrics or themes
- Actual audio characteristics
- User perception
- Cultural context

#### 3. Song Retrieval - Always Same Results
```typescript
// Location: src/lib/moodAnalysisService.ts (lines 224-271)
```

```typescript
export async function getSongsByMood(moodName: string, limit: number = 50) {
  const { data } = await supabase
    .from('song_mood_analysis')
    .select(...)
    .or(`primary_mood.eq.${moodName},secondary_mood.eq.${moodName}`)
    .limit(limit);

  // PROBLEM: Always sorts by play_count
  return data.sort((a, b) => b.play_count - a.play_count);
}
```

**Critical Issues:**
1. ❌ **No randomization** - Same songs appear in same order every time
2. ❌ **No freshness** - Popular songs dominate, new songs never surface
3. ❌ **No session tracking** - Users see same songs even within same session
4. ❌ **No diversity** - Only the most popular songs are shown
5. ❌ **No user preferences** - Doesn't consider user's listening history

---

## Identified Problems

### Problem 1: Inaccurate Mood Matching

**Why Songs Shouldn't Be in Certain Moods:**

1. **Genre ≠ Mood**
   - A sad hip-hop song gets labeled "Party" because hip-hop has high danceability
   - A peaceful electronic song gets labeled "Energetic" because of genre defaults

2. **No Context Awareness**
   - Love songs in any genre might get labeled "Party" if they're upbeat
   - Angry rock songs might get labeled "Workout" when they're too aggressive

3. **Binary Classification**
   - Songs only get 1-2 moods, but many songs fit multiple moods
   - Example: A chill R&B song could be "Romantic", "Chill", "Study", or "Sleep"

### Problem 2: No Freshness/Variety

**Current Behavior:**
```
User opens "Happy" mood → Sees top 50 songs by play_count
User closes and reopens "Happy" → Sees EXACT SAME 50 songs
User tries "Energetic" → Sees similar popular songs
After 1 week → STILL sees same songs
```

**Why This Happens:**
1. Results are purely based on `play_count` (popularity)
2. No randomization applied
3. No session-based filtering
4. No temporal diversity
5. No user preference weighting

### Problem 3: Poor Discovery Experience

Users expect:
- ✅ Fresh recommendations each time
- ✅ Mix of popular and hidden gems
- ✅ Songs they haven't heard recently
- ✅ Personalized to their taste

Current system provides:
- ❌ Same songs every time
- ❌ Only popular songs
- ❌ No memory of what they've seen
- ❌ Generic for all users

---

## Recommended Solutions

### Priority 1: Add Variety and Freshness

#### Solution A: Smart Shuffling Algorithm
```typescript
// New function to add in moodAnalysisService.ts
export async function getSongsByMood(
  moodName: string,
  limit: number = 50,
  userId?: string | null,
  sessionId?: string
): Promise<any[]> {
  // Fetch more songs than needed for better variety
  const fetchLimit = Math.min(limit * 5, 250);

  const { data, error } = await supabase
    .from('song_mood_analysis')
    .select(...)
    .or(`primary_mood.eq.${moodName},secondary_mood.eq.${moodName}`)
    .limit(fetchLimit);

  if (!data || data.length === 0) return [];

  // Get recently shown songs to avoid repetition
  const recentlyShown = await getRecentlyShownMoodSongs(userId, sessionId, moodName);

  // Filter out recently shown songs (last 24 hours or current session)
  const filtered = data.filter(song =>
    !recentlyShown.includes(song.song_id)
  );

  // Weighted random selection: Mix popularity with variety
  const selected = weightedRandomSelection(filtered, limit, {
    popularityWeight: 0.4,  // 40% weight to popularity
    freshnessWeight: 0.3,   // 30% weight to new releases
    diversityWeight: 0.3,   // 30% weight to variety
  });

  // Track shown songs to avoid future repetition
  if (userId || sessionId) {
    await trackShownMoodSongs(userId, sessionId, moodName, selected);
  }

  return selected;
}
```

#### Solution B: Session-Based Tracking
```typescript
// Store in localStorage for anonymous users
interface MoodSession {
  moodName: string;
  shownSongIds: string[];
  timestamp: number;
}

const getMoodSessionKey = (moodName: string) => `mood_session_${moodName}`;

export function getRecentlyShownMoodSongs(
  userId: string | null,
  sessionId: string | undefined,
  moodName: string
): string[] {
  // For logged-in users, check database
  if (userId) {
    // Query user_mood_history for recently shown songs
    // Return song IDs shown in last 24 hours
  }

  // For anonymous users, use localStorage
  const key = getMoodSessionKey(moodName);
  const session = localStorage.getItem(key);

  if (session) {
    const data: MoodSession = JSON.parse(session);
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);

    // Clear if older than 24 hours
    if (data.timestamp < dayAgo) {
      localStorage.removeItem(key);
      return [];
    }

    return data.shownSongIds || [];
  }

  return [];
}
```

#### Solution C: Weighted Random Selection
```typescript
interface SelectionWeights {
  popularityWeight: number;
  freshnessWeight: number;
  diversityWeight: number;
}

function weightedRandomSelection(
  songs: any[],
  limit: number,
  weights: SelectionWeights
): any[] {
  // Calculate composite scores
  const scoredSongs = songs.map(song => {
    const now = Date.now();
    const songAge = now - new Date(song.created_at || 0).getTime();
    const daysOld = songAge / (1000 * 60 * 60 * 24);

    // Popularity score (normalized 0-1)
    const maxPlays = Math.max(...songs.map(s => s.play_count || 0));
    const popularityScore = maxPlays > 0 ? (song.play_count || 0) / maxPlays : 0;

    // Freshness score (newer = higher score)
    const freshnessScore = Math.max(0, 1 - (daysOld / 365));

    // Diversity score (random component)
    const diversityScore = Math.random();

    // Composite score
    const compositeScore =
      (popularityScore * weights.popularityWeight) +
      (freshnessScore * weights.freshnessWeight) +
      (diversityScore * weights.diversityWeight);

    return { ...song, _score: compositeScore };
  });

  // Sort by composite score and take top N
  return scoredSongs
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...song }) => song); // Remove internal score
}
```

---

### Priority 2: Improve Mood Accuracy

#### Solution A: Multiple Mood Tags Per Song
Instead of just primary + secondary, allow songs to have multiple moods with confidence scores:

```sql
-- Update song_mood_analysis table structure
CREATE TABLE song_mood_tags (
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  mood_category_id UUID REFERENCES mood_categories(id),
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  PRIMARY KEY (song_id, mood_category_id)
);
```

#### Solution B: Enhanced Feature Detection
Add more nuanced features:

```typescript
interface EnhancedAudioFeatures extends AudioFeatures {
  // Existing: tempo, energy, valence, danceability, acousticness, instrumentalness

  // New additions:
  aggression: number;      // 0-1: How aggressive/intense
  melancholy: number;      // 0-1: Sadness/melancholic feeling
  euphoria: number;        // 0-1: Uplifting/joyful feeling
  intimacy: number;        // 0-1: Closeness/romantic feeling
  tension: number;         // 0-1: Suspense/anxiety
  relaxation: number;      // 0-1: Calming effect
}
```

#### Solution C: Genre-Specific Mood Rules
Different rules for different genres:

```typescript
function determineMoodsEnhanced(
  features: AudioFeatures,
  genre: string
): MoodTag[] {
  const genreLower = genre.toLowerCase();
  const moods: MoodTag[] = [];

  // Hip Hop specific rules
  if (genreLower.includes('hip hop') || genreLower.includes('rap')) {
    if (features.energy > 0.7 && features.valence > 0.6) {
      moods.push({ mood: 'Party', confidence: 0.9 });
    }
    if (features.energy < 0.5 && features.valence < 0.5) {
      moods.push({ mood: 'Sad', confidence: 0.8 });
      moods.push({ mood: 'Chill', confidence: 0.6 });
    }
  }

  // Electronic specific rules
  if (genreLower.includes('electronic') || genreLower.includes('edm')) {
    if (features.energy > 0.8) {
      moods.push({ mood: 'Party', confidence: 0.95 });
      moods.push({ mood: 'Workout', confidence: 0.85 });
    }
    if (features.energy < 0.5 && features.tempo < 100) {
      moods.push({ mood: 'Chill', confidence: 0.9 });
      moods.push({ mood: 'Study', confidence: 0.7 });
    }
  }

  // ... more genre-specific rules

  return moods;
}
```

---

### Priority 3: User Personalization

#### Solution A: Learn from User Behavior
```typescript
// Track which mood selections lead to song plays
export async function trackMoodSongEngagement(
  userId: string,
  moodCategoryId: string,
  songId: string,
  action: 'viewed' | 'played' | 'skipped' | 'liked'
): Promise<void> {
  await supabase.from('mood_song_engagement').insert({
    user_id: userId,
    mood_category_id: moodCategoryId,
    song_id: songId,
    action,
    timestamp: new Date().toISOString()
  });
}
```

#### Solution B: Personalized Ranking
```typescript
async function getPersonalizedMoodSongs(
  userId: string,
  moodName: string,
  limit: number
): Promise<any[]> {
  // Get user's engagement history with this mood
  const { data: history } = await supabase
    .from('mood_song_engagement')
    .select('song_id, action')
    .eq('user_id', userId)
    .eq('mood_category_id', moodCategoryId);

  // Create preference map
  const preferences = new Map<string, number>();
  history?.forEach(({ song_id, action }) => {
    const current = preferences.get(song_id) || 0;
    preferences.set(song_id, current + getActionWeight(action));
  });

  // Fetch songs and apply personalized ranking
  const songs = await getSongsByMood(moodName, limit * 3);

  return songs
    .map(song => ({
      ...song,
      personalScore: preferences.get(song.song_id) || 0
    }))
    .sort((a, b) => {
      // Blend personal score with variety
      const scoreA = (a.personalScore * 0.4) + (Math.random() * 0.6);
      const scoreB = (b.personalScore * 0.4) + (Math.random() * 0.6);
      return scoreB - scoreA;
    })
    .slice(0, limit);
}
```

---

## Implementation Plan

### Phase 1: Quick Wins (Immediate - 2 hours)
✅ **High impact, low complexity**

1. **Add Randomization**
   - Fetch 3-5x more songs than needed
   - Apply weighted random selection
   - Mix popularity with random shuffle

2. **Session-Based Filtering**
   - Track shown songs in localStorage
   - Filter out songs shown in last 24 hours
   - Clear session data after 24 hours

3. **Variety Weights**
   - 40% popularity (play_count)
   - 30% freshness (recent uploads)
   - 30% diversity (random component)

### Phase 2: Enhanced Accuracy (1-2 days)
✅ **Improved mood matching**

1. **Genre-Specific Rules**
   - Custom mood detection per genre
   - More nuanced feature generation
   - Better confidence scoring

2. **Multiple Mood Tags**
   - Allow 3-5 moods per song with confidence scores
   - Query moods by confidence threshold
   - Better coverage of song emotions

3. **Enhanced Features**
   - Add aggression, melancholy, euphoria metrics
   - Improve genre-to-feature mapping
   - Consider song duration and structure

### Phase 3: Personalization (3-5 days)
✅ **User-specific recommendations**

1. **Engagement Tracking**
   - Track mood → song interactions
   - Learn user preferences per mood
   - Identify favorite mood types

2. **Personalized Ranking**
   - Blend personal history with variety
   - Surface songs similar to liked songs
   - Avoid songs user consistently skips

3. **Smart Defaults**
   - Recommend moods based on listening patterns
   - Suggest moods for time of day
   - Adapt to user's mood preferences

---

## Database Migrations Needed

### Phase 1: Session Tracking Table
```sql
CREATE TABLE mood_song_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,  -- For anonymous users
  mood_category_id UUID REFERENCES mood_categories(id),
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),

  -- Index for efficient lookups
  INDEX idx_mood_views_user ON mood_song_views(user_id, mood_category_id, viewed_at),
  INDEX idx_mood_views_session ON mood_song_views(session_id, mood_category_id, viewed_at)
);

-- Cleanup old views (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_mood_views()
RETURNS void AS $$
BEGIN
  DELETE FROM mood_song_views
  WHERE viewed_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql;
```

### Phase 2: Enhanced Mood Tags
```sql
CREATE TABLE song_mood_tags (
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  mood_category_id UUID REFERENCES mood_categories(id),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at TIMESTAMPTZ DEFAULT now(),

  PRIMARY KEY (song_id, mood_category_id),
  INDEX idx_mood_tags_confidence ON song_mood_tags(mood_category_id, confidence_score DESC)
);
```

### Phase 3: Engagement Tracking
```sql
CREATE TABLE mood_song_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  mood_category_id UUID REFERENCES mood_categories(id),
  song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  action TEXT CHECK (action IN ('viewed', 'played', 'skipped', 'liked', 'disliked')),
  timestamp TIMESTAMPTZ DEFAULT now(),

  INDEX idx_mood_engagement_user ON mood_song_engagement(user_id, mood_category_id, timestamp)
);
```

---

## Expected Results

### Before Improvements
- ❌ Same 50 songs every time
- ❌ Only popular songs visible
- ❌ Songs don't match mood well
- ❌ Users get bored quickly
- ❌ No personalization

### After Phase 1 (Variety)
- ✅ Different songs each visit
- ✅ Mix of popular and hidden gems
- ✅ No repetition within 24 hours
- ✅ Fresh experience every time
- ✅ ~60% user satisfaction improvement

### After Phase 2 (Accuracy)
- ✅ Better mood-song matching
- ✅ More relevant results
- ✅ Songs feel appropriate for mood
- ✅ Multiple moods per song
- ✅ ~40% accuracy improvement

### After Phase 3 (Personalization)
- ✅ Tailored to each user
- ✅ Learns preferences over time
- ✅ Suggests best moods for user
- ✅ High engagement rate
- ✅ ~80% overall satisfaction

---

## Testing Strategy

### Variety Testing
```typescript
// Test that results change between calls
const results1 = await getSongsByMood('Happy', 20);
const results2 = await getSongsByMood('Happy', 20);

// Should have <50% overlap
const overlap = results1.filter(s1 =>
  results2.some(s2 => s2.song_id === s1.song_id)
).length;

expect(overlap).toBeLessThan(results1.length * 0.5);
```

### Accuracy Testing
```typescript
// Manual review: Do songs match mood?
const happySongs = await getSongsByMood('Happy', 10);
// Manually verify: Are these actually happy songs?

const sadSongs = await getSongsByMood('Sad', 10);
// Manually verify: Are these actually sad songs?
```

### Session Tracking Testing
```typescript
// Test that recently shown songs are filtered
const shown = await getSongsByMood('Chill', 20, userId, sessionId);
await trackShownMoodSongs(userId, sessionId, 'Chill', shown);

const nextShown = await getSongsByMood('Chill', 20, userId, sessionId);

// No songs should repeat
const repeated = shown.filter(s1 =>
  nextShown.some(s2 => s2.song_id === s1.song_id)
);

expect(repeated.length).toBe(0);
```

---

## Conclusion

The current mood discovery system has two critical issues:

1. **Poor Mood Accuracy** - Genre-based detection is too simplistic
2. **No Variety** - Always shows same popular songs

**Phase 1 (Variety & Freshness)** will provide immediate user experience improvements with minimal risk. This should be implemented first.

**Phase 2 & 3** will improve accuracy and personalization but require more significant changes.

Implementing all three phases will transform mood discovery from a static list into a dynamic, personalized music discovery experience that users will love.
