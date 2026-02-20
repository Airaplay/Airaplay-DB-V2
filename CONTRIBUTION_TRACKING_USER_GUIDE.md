# Understanding Your Contribution Score

## The System IS Working!

Your contribution score system is functioning correctly. Points ARE being credited when you perform activities. However, there are **time-gating rules** that prevent earning the same reward multiple times too quickly.

## Why You Might Not See Expected Points

### 1. Time-Gating Rules

Many activities can only be earned **once per day, once per week, or once per item**:

| Activity Type | How Often You Can Earn |
|--------------|------------------------|
| Like a song | Once per song (unlimited songs) |
| Like a video | Once per video (unlimited videos) |
| Comment on content | Once per day |
| Follow artist | Once per artist |
| Share content | Once per day |
| Listen 5 songs | Once per day |
| Listen 10 songs | Once per day |
| Listen 20 songs | Once per day |
| Listen 50 songs | Once per day |
| Genre explorer | Once per week |
| Artist discovery | Once per week |
| Song completion | Once per day |
| 3-day streak | Once per streak |
| 7-day streak | Once per streak |
| 30-day streak | Once per streak |

### 2. Examples of Time-Gating

**Example 1: Liking Songs**
- First like today: ✅ 3 points
- Second like today (different song): ✅ 3 points
- Third like today (different song): ✅ 3 points
- Like same song again: ❌ 0 points (already liked)

**Example 2: Listening Milestones**
- Listen to 5 songs: ✅ 10 points (daily_active_listener)
- Listen to 10 songs: ✅ 15 points (daily_listener_10)
- Listen to 20 songs: ✅ 25 points (daily_listener_20)
- Listen to 50 songs: ✅ 50 points (daily_listener_50)
- Listen to 100 songs same day: ❌ 0 points (all daily milestones already earned)
- Tomorrow, listen to 5 songs: ✅ 10 points (new day!)

**Example 3: Comments**
- First comment today: ✅ 5 points
- Second comment today: ❌ 0 points (once per day)
- Tomorrow, first comment: ✅ 5 points

## How to Check Your Score

### Option 1: Check Your Profile
Your contribution score is displayed in your profile with:
- **Total Points** - Lifetime points earned
- **This Period** - Points earned in current period
- **Category Breakdown** - Points by activity type

### Option 2: Run Database Query

Check your today's activity:
```sql
SELECT * FROM get_user_points_today('YOUR_USER_ID');
```

Get detailed breakdown:
```sql
SELECT * FROM get_user_contribution_breakdown('YOUR_USER_ID');
```

### Option 3: Check Recent Contributions

See what you've earned recently:
```sql
SELECT
  activity_type,
  contribution_points,
  created_at,
  metadata
FROM listener_contributions
WHERE user_id = 'YOUR_USER_ID'
  AND created_at >= CURRENT_DATE
ORDER BY created_at DESC;
```

## Common Scenarios

### Scenario 1: "I liked 20 songs but only got 60 points"

**Expected**: 20 songs × 3 points = 60 points ✅

This is correct! Each like gives 3 points.

### Scenario 2: "I listened to 50 songs but only got 100 points"

**Expected**: 10 + 15 + 25 + 50 = 100 points ✅

You earned 4 separate milestones:
- 5 songs milestone: 10 points
- 10 songs milestone: 15 points
- 20 songs milestone: 25 points
- 50 songs milestone: 50 points

**Not**: 50 × points per song (that would violate AdMob policy)

### Scenario 3: "I commented on 5 videos but only got 5 points"

**Expected**: 5 points (once per day) ✅

Comments can only be earned once per day, so:
- First comment: 5 points
- Other 4 comments: 0 points (blocked by time-gating)
- Tomorrow you can earn 5 points again

### Scenario 4: "I performed 20+ activities but got no points"

**Possible reasons**:
1. ❌ Activities are disabled in admin dashboard
2. ❌ You already earned those activities today
3. ❌ You're liking/following same items you already did
4. ❌ Listening to your own content (creators can't earn listener rewards from own uploads)

**How to diagnose**:
```sql
-- Check if activities are active
SELECT activity_type, is_active, base_reward_points
FROM contribution_activities
WHERE activity_type IN ('song_like', 'content_comment', 'artist_follow', etc);

-- Check what you earned today
SELECT * FROM get_user_points_today('YOUR_USER_ID');
```

## Maximum Daily Points

Realistically, here's what you can earn per day:

### Social Engagement (Unlimited Different Items)
- Like 20 different songs: 60 points
- Like 10 different videos: 30 points
- Follow 5 different artists: 25 points
- Comment once: 5 points
- Share once: 3 points

**Subtotal**: ~123 points

### Listening Milestones (Once Per Day Each)
- Listen 5 songs: 10 points
- Listen 10 songs: 15 points
- Listen 20 songs: 25 points
- Listen 50 songs: 50 points
- Song completion bonus: 15 points

**Subtotal**: 115 points

### Playlist Activities (Varies)
- Create playlist: 10 points per playlist
- Playlist played by others: 5 points per play

**Subtotal**: Varies

### Weekly Bonuses (Once Per Week)
- Genre explorer: 25 points
- Artist discovery: 20 points

**Subtotal**: 45 points per week

### **Theoretical Maximum Per Day: ~250-350 points**

## How to Maximize Your Score

### Daily Activities (Do These Every Day)
1. ✅ Listen to 50+ songs (earn all milestones: 100 points)
2. ✅ Like 10-20 different songs (30-60 points)
3. ✅ Comment on content (5 points)
4. ✅ Share content (3 points)
5. ✅ Follow new artists (5 points each)

### Weekly Goals
1. ✅ Listen to 5+ different genres (25 points)
2. ✅ Discover small artists <10k plays (20 points)

### Long-term Strategies
1. ✅ Create quality playlists that others play (5 points per play + 100 point bonus at 50 plays)
2. ✅ Maintain listening streaks (30 → 75 → 300 points)
3. ✅ Early discovery of songs/artists before they become popular (50-100 points)

## The System IS Working

✅ **Contributions ARE being recorded**
✅ **Points ARE being added to your score**
✅ **Scores ARE displayed in your profile**

The most common "issue" is users expecting to earn the same reward multiple times, which is prevented by time-gating rules to ensure fair distribution and prevent abuse.

## Need Help?

Run these diagnostic queries to see your exact status:

```sql
-- Today's activity summary
SELECT * FROM get_user_points_today();

-- Detailed breakdown with time-gating info
SELECT * FROM get_user_contribution_breakdown();

-- Your current score
SELECT * FROM listener_contribution_scores
WHERE user_id = auth.uid();

-- Recent contributions
SELECT activity_type, contribution_points, created_at
FROM listener_contributions
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 20;
```

Your contribution score system is working perfectly! 🎉
