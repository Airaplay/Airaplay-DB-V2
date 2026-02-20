# Contribution Rewards - Frontend Implementation Guide

## Quick Reference

This guide shows exactly where to integrate contribution tracking in the frontend codebase.

---

## 1. Track Playlist Creation

**File:** `src/components/CreatePlaylistModal.tsx`

**Location:** After successful playlist creation (line ~295)

**Add this:**

```typescript
import { trackPlaylistCreated } from '../lib/contributionService';

// In handleSubmit, after playlist is created successfully:
if (playlistData && isPublic) {
  // Track contribution (fire and forget)
  trackPlaylistCreated(playlistData.id).catch(console.error);
}
```

---

## 2. Track Playlist Plays

**File:** `src/contexts/MusicPlayerContext.tsx`

**Location:** When a playlist starts playing

**Add this:**

```typescript
import { trackPlaylistPlayed } from '../lib/contributionService';

// When starting playlist playback:
if (playlist && playlist.user_id && currentUser?.id) {
  trackPlaylistPlayed(
    playlist.user_id,
    playlist.id,
    currentUser.id
  ).catch(console.error);
}
```

---

## 3. Add Contribution Score Display

**Create New Component:** `src/components/ContributionScoreCard.tsx`

```typescript
import React from 'react';
import { Star, TrendingUp, Award } from 'lucide-react';
import { useContributionScore } from '../hooks/useContributionRewards';
import { useAuth } from '../contexts/AuthContext';

export const ContributionScoreCard: React.FC = () => {
  const { user } = useAuth();
  const { score, loading } = useContributionScore(user?.id);

  if (loading || !score) return null;

  return (
    <div className="bg-gradient-to-br from-[#00ad74]/20 to-[#008257]/10 rounded-2xl p-6 border border-[#00ad74]/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Community Contributions</h3>
        <Award className="w-6 h-6 text-[#00ad74]" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-white/60 text-sm">Current Period</p>
          <p className="text-2xl font-bold text-white">
            {score.current_period_points.toLocaleString()}
            <span className="text-sm text-white/60 ml-1">pts</span>
          </p>
        </div>
        <div>
          <p className="text-white/60 text-sm">All Time</p>
          <p className="text-2xl font-bold text-white">
            {score.total_points.toLocaleString()}
            <span className="text-sm text-white/60 ml-1">pts</span>
          </p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <p className="text-xs text-white/60 mb-2">Contribution Breakdown:</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-white/60">Playlists:</span>
            <span className="text-white font-semibold">{score.playlist_creation_points}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Discovery:</span>
            <span className="text-white font-semibold">{score.discovery_points}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Curation:</span>
            <span className="text-white font-semibold">{score.curation_points}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Engagement:</span>
            <span className="text-white font-semibold">{score.engagement_points}</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => window.location.href = '/contribution-rewards'}
        className="w-full mt-4 py-2 bg-[#00ad74]/20 hover:bg-[#00ad74]/30 border border-[#00ad74]/40 rounded-xl text-white text-sm font-medium transition-all"
      >
        View Rewards Details
      </button>
    </div>
  );
};
```

---

## 4. Add to Profile/Library Screen

**File:** `src/screens/LibraryScreen/LibraryScreen.tsx`

**Add the contribution card:**

```typescript
import { ContributionScoreCard } from '../../components/ContributionScoreCard';

// In the render, add this section (maybe after playlists):
<div className="px-4 py-6">
  <ContributionScoreCard />
</div>
```

---

## 5. Create Rewards Leaderboard Screen

**Create New File:** `src/screens/ContributionRewardsScreen/ContributionRewardsScreen.tsx`

```typescript
import React from 'react';
import { Trophy, Star, Award, TrendingUp } from 'lucide-react';
import { useTopContributors, useRewardsBudget } from '../../hooks/useContributionRewards';

export const ContributionRewardsScreen: React.FC = () => {
  const { contributors, loading } = useTopContributors(20);
  const { budget } = useRewardsBudget();

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#00ad74]/20 to-transparent p-6">
        <h1 className="text-3xl font-bold mb-2">Community Rewards</h1>
        <p className="text-white/70">
          Earn rewards by making valuable contributions
        </p>

        {budget && (
          <div className="mt-4 p-4 bg-white/5 rounded-xl">
            <p className="text-sm text-white/60 mb-1">This Month's Pool</p>
            <p className="text-2xl font-bold text-[#00ad74]">
              ${budget.total_budget_usd.toFixed(2)}
            </p>
            <p className="text-xs text-white/50 mt-1">
              {budget.total_points_pool.toLocaleString()} total points
            </p>
          </div>
        )}
      </div>

      {/* How It Works */}
      <div className="px-6 py-4">
        <h2 className="text-xl font-bold mb-3">How to Earn</h2>
        <div className="space-y-2">
          <RewardActivity
            icon={<Star />}
            title="Create Playlists"
            points={10}
            description="Share your music taste with the community"
          />
          <RewardActivity
            icon={<TrendingUp />}
            title="Discover Early"
            points={50}
            description="Find great music before it's popular"
          />
          <RewardActivity
            icon={<Award />}
            title="Quality Playlists"
            points={100}
            description="Get 50+ plays on your playlists"
          />
        </div>
      </div>

      {/* Leaderboard */}
      <div className="px-6 py-4">
        <h2 className="text-xl font-bold mb-3">Top Contributors</h2>
        {loading ? (
          <p className="text-white/60">Loading...</p>
        ) : (
          <div className="space-y-2">
            {contributors.map((contributor, index) => (
              <div
                key={contributor.user_id}
                className="flex items-center gap-3 p-4 bg-white/5 rounded-xl"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#00ad74]/20 text-[#00ad74] font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{contributor.username}</p>
                  <p className="text-sm text-white/60">
                    {contributor.current_period_points.toLocaleString()} points
                  </p>
                </div>
                {index < 3 && <Trophy className="w-5 h-5 text-yellow-500" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const RewardActivity = ({ icon, title, points, description }: any) => (
  <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
    <div className="w-10 h-10 rounded-full bg-[#00ad74]/20 flex items-center justify-center text-[#00ad74]">
      {icon}
    </div>
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <p className="font-semibold">{title}</p>
        <span className="text-[#00ad74] font-bold">+{points}</span>
      </div>
      <p className="text-sm text-white/60">{description}</p>
    </div>
  </div>
);
```

---

## 6. Update Navigation

**File:** `src/screens/HomePlayer/sections/NavigationBarSection/NavigationBarSection.tsx`

**Add navigation item:**

```typescript
// Add to navigation items
{
  icon: <Award className="w-6 h-6" />,
  label: 'Rewards',
  path: '/contribution-rewards'
}
```

---

## 7. Update Treat/Wallet Terminology

**Files to Update:**

1. `src/components/TreatWalletCard.tsx`
2. `src/components/TreatWalletWidget.tsx`
3. `src/screens/TreatScreen/TreatScreen.tsx`

**Changes:**

Remove or update any language that says:
- ❌ "Earn from listening"
- ❌ "Get paid when you watch"
- ❌ "Ad revenue sharing"

Replace with:
- ✅ "Earn from contributions"
- ✅ "Community rewards"
- ✅ "Contribution bonus"

**Example Update:**

```typescript
// OLD
<p>Earn Streats while you listen to music and watch videos</p>

// NEW
<p>Earn Streats by purchasing packages or making community contributions</p>
```

---

## 8. Update Admin Dashboard

**File:** `src/screens/AdminDashboardScreen/AdminDashboardScreen.tsx`

**Add new section for Contribution Rewards:**

```typescript
{
  id: 'contribution-rewards',
  label: 'Contribution Rewards',
  icon: Award,
  component: <ContributionRewardsAdminSection />
}
```

**Create:** `src/screens/AdminDashboardScreen/ContributionRewardsAdminSection.tsx`

---

## 9. Create Help/FAQ Content

**Create:** `src/screens/ContributionRewardsHelpScreen/ContributionRewardsHelpScreen.tsx`

Include:
- How the system works
- What activities earn points
- How rewards are calculated
- When payouts happen
- FAQ about the change from old system

---

## 10. Update Terms & Privacy

**Files to Update:**
1. `src/screens/TermsAndConditionsScreen/TermsAndConditionsScreen.tsx`
2. Privacy Policy (if you have one)

**Add sections about:**
- Community Rewards Program
- Contribution tracking
- Discretionary nature of rewards
- Right to modify/terminate program

---

## Testing Checklist

After implementation, test these scenarios:

- [ ] Create a public playlist → Check contribution recorded
- [ ] Create a private playlist → Check NO contribution recorded
- [ ] Play someone else's playlist → Check their score increases
- [ ] Play your own playlist → Check NO points awarded
- [ ] View contribution score card → Shows correct data
- [ ] View leaderboard → Top contributors shown correctly
- [ ] Admin can set monthly budget
- [ ] Admin can distribute rewards
- [ ] User receives notification of rewards
- [ ] No language about "earning from ads"

---

## Migration Communication

### In-App Notification

```
🎉 Introducing Community Rewards!

We've upgraded our rewards system! Now you can earn by:
• Creating amazing playlists
• Discovering new artists early
• Helping others find great music

Top contributors can earn up to $50/month!

Tap to learn more about how to earn →
```

### Email Template

```
Subject: Exciting Update: New Community Rewards System

Hi [Username],

Great news! We've upgraded our rewards system to better recognize your
valuable contributions to the Airaplay community.

What's New:
✓ Earn by creating playlists that others love
✓ Get rewarded for discovering artists early
✓ Bonus points for high-quality curat ions
✓ Top contributors earn up to $50/month!

What's Changed:
• Rewards now focus on community contributions
• Your previous earnings are safe and can be withdrawn
• More opportunities to earn through active participation

Start earning today by creating your first playlist!

[Get Started →]

Happy curating!
The Airaplay Team
```

---

## Deployment Steps

1. **Deploy Database Migration**
   ```bash
   # Already deployed via mcp__supabase__apply_migration
   ```

2. **Deploy Frontend Changes**
   ```bash
   npm run build
   # Deploy to production
   ```

3. **Send User Communications**
   - Push in-app notification
   - Send email announcement
   - Update help docs

4. **Monitor**
   - Check contribution tracking works
   - Monitor user feedback
   - Track engagement metrics
   - Verify no correlation with ads

---

## Support Responses

### Common User Questions:

**Q: Why did this change?**
A: "We updated our system to better reward active community members who create value through their contributions. This gives you more opportunities to earn!"

**Q: What happened to my earnings?**
A: "All your previous earnings are safe and available for withdrawal. Nothing has changed there!"

**Q: Can I still earn money?**
A: "Yes! In fact, active contributors can earn even more. Create playlists, discover new artists, and engage with the community to earn rewards."

---

## Success Indicators

After launch, monitor these:

1. **Contribution Activity**
   - Playlist creation rate
   - User engagement with leaderboard
   - Points accumulation patterns

2. **User Satisfaction**
   - Support tickets about the change
   - User retention rates
   - Active contributor growth

3. **Compliance**
   - No AdMob policy warnings
   - No patterns suggesting incentivized viewing
   - Clean audit logs

---

## Quick Start Checklist

To implement RIGHT NOW:

- [ ] Add contribution tracking to playlist creation
- [ ] Add contribution tracking to playlist plays
- [ ] Add ContributionScoreCard to Library screen
- [ ] Update any "earn from ads" language
- [ ] Test contribution recording works
- [ ] Review all user-facing text for compliance

---

**Implementation Priority:** HIGH
**Estimated Time:** 4-6 hours for core features
**Status:** Ready to implement
