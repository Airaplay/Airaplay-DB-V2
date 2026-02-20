# Ad Revenue 60/0/40 Monetization Model

## Overview

The platform has implemented a new **AdMob-compliant monetization model** that separates ad revenue distribution from listener rewards. This change ensures compliance with AdMob policies while maintaining a fair and sustainable ecosystem for all participants.

## Revenue Split Breakdown

### Ad Revenue Distribution (100%)
- **Creators: 60%** - Content creators receive the majority share of ad revenue
- **Listeners: 0%** - Listeners no longer receive direct ad revenue
- **Platform: 40%** - Platform receives operational and development costs

### Listener Earnings Model
Listeners now earn through a **separate Contribution Rewards System** funded by the platform's budget allocation:

- **Playlist Creation** - Points for creating quality playlists
- **Early Discovery** - Points for discovering songs before they become popular
- **Curation Activity** - Points when curated playlists are played by others
- **Daily Engagement** - Points for consistent platform engagement
- **Referral Contributions** - Points when referred users become active contributors

## Key Changes from Previous Model

### Before (Old Model)
```
Ad Revenue Split: 45% Artist | 15% Listener | 40% Platform
Listener Earnings: Directly from ad revenue
```

### After (New Model)
```
Ad Revenue Split: 60% Creator | 0% Listener | 40% Platform
Listener Earnings: Separate contribution rewards budget
```

## Why This Change?

### 1. AdMob Policy Compliance
- AdMob requires creators to receive at least 50% of ad revenue
- Previous 45/15/40 split was non-compliant
- New 60/0/40 split ensures compliance

### 2. Sustainable Monetization
- Platform has full control over listener rewards budget
- Can scale listener rewards based on platform revenue
- Predictable costs for platform operations

### 3. Fair Value Exchange
- Listeners earn based on VALUE-ADDING activities
- Quality contributions are rewarded more than passive consumption
- Encourages community building and curation

## Database Changes

### Migration: `update_ad_revenue_split_60_0_40_fixed.sql`

#### 1. Updated ad_safety_caps Table
```sql
UPDATE ad_safety_caps
SET
  artist_revenue_percentage = 60.00,
  listener_revenue_percentage = 0.00,
  platform_revenue_percentage = 40.00
WHERE is_active = true;
```

#### 2. Added Constraint
```sql
ALTER TABLE ad_safety_caps
ADD CONSTRAINT ad_safety_caps_revenue_split_check CHECK (
  listener_revenue_percentage = 0.00 AND
  (artist_revenue_percentage + listener_revenue_percentage + platform_revenue_percentage) = 100.00
);
```

#### 3. Compliance Trigger
```sql
CREATE OR REPLACE FUNCTION check_ad_revenue_split_compliance()
RETURNS TRIGGER AS $$
BEGIN
  -- Enforce listener revenue must be 0
  IF NEW.listener_revenue_percentage != 0.00 THEN
    RAISE EXCEPTION 'Listener revenue from ads must be 0%. Listeners earn through contribution rewards.';
  END IF;

  -- Enforce creators get at least 50% (AdMob policy)
  IF NEW.artist_revenue_percentage < 50.00 THEN
    RAISE EXCEPTION 'Artist revenue must be at least 50% for AdMob compliance';
  END IF;

  -- Enforce total is 100%
  IF (NEW.artist_revenue_percentage + NEW.listener_revenue_percentage + NEW.platform_revenue_percentage) != 100.00 THEN
    RAISE EXCEPTION 'Revenue split must total exactly 100%';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Admin Dashboard Updates

### AdSafetyCapsSection.tsx UI Changes

#### 1. Informational Notice Banner
- Displays new 60/0/40 split prominently
- Explains listener earnings through contribution rewards
- Shows AdMob compliance status

#### 2. Legacy Field Indicators
- "Max Listener Earnings Per Day" - marked as LEGACY
- "Minimum LQS for Listener Reward" - marked as LEGACY
- Clear warnings that these fields are obsolete for ad revenue

#### 3. Listener Revenue Field
- **Fixed at 0%** - marked with red badge
- Read-only and disabled input
- Clear warning: "Listeners must earn 0% from ads"
- Links to Contribution Rewards System

#### 4. Revenue Model Explanation
- Updated note explaining new distribution
- Links to Contribution Rewards admin section
- Clear breakdown of creator/platform split

### Form Validation
```typescript
// CRITICAL: Enforce listener revenue from ads is ALWAYS 0
if (formData.listener_revenue_percentage !== 0.00) {
  return 'Listener revenue from ads must be 0%. Listeners earn through contribution points system, NOT from ad revenue.';
}

// Ensure creators get at least 50% (AdMob compliance)
if (formData.artist_revenue_percentage < 50) {
  return 'Artist/Creator revenue must be at least 50% for AdMob policy compliance';
}
```

## Service Layer Updates

### adRevenueService.ts
- Added documentation explaining new model
- No code changes needed (database handles split logic)
- Service calls updated database functions automatically

## Contribution Rewards System

### How It Works

1. **Point Accumulation**
   - Users earn points for value-adding activities
   - Points tracked in `listener_contribution_scores` table
   - Separate categories: playlist, discovery, curation, engagement

2. **Monthly Conversion**
   - Admin sets conversion rate (e.g., 0.001 = 1000 points = $1)
   - Admin inputs reward pool budget
   - System distributes proportionally to all contributors
   - Credits go to `earned_balance` in treat_wallets

3. **Budget Management**
   - Platform controls reward pool size
   - Can scale rewards based on revenue
   - Predictable and sustainable costs

### Admin Controls

Location: **Admin Dashboard → Contribution Rewards**

- Set conversion rates
- Monitor current period points
- Execute monthly conversions
- View conversion history
- Track top contributors

## Testing the New Model

### 1. Verify Ad Revenue Split
```sql
-- Check active configuration
SELECT * FROM ad_safety_caps WHERE is_active = true;

-- Should show:
-- artist_revenue_percentage: 60.00
-- listener_revenue_percentage: 0.00
-- platform_revenue_percentage: 40.00
```

### 2. Test Constraint Enforcement
```sql
-- This should FAIL (listener not 0%)
UPDATE ad_safety_caps
SET listener_revenue_percentage = 10.00
WHERE is_active = true;
-- Error: Listener revenue from ads must be 0%

-- This should FAIL (creator less than 50%)
UPDATE ad_safety_caps
SET artist_revenue_percentage = 45.00
WHERE is_active = true;
-- Error: Artist revenue must be at least 50%
```

### 3. Verify UI Display
1. Go to Admin Dashboard → Ad Management → Ad Safety Caps
2. Check for:
   - Green notice banner at top
   - "LEGACY" badges on obsolete fields
   - "FIXED AT 0%" badge on listener revenue field
   - Listener revenue field is disabled/read-only
   - Updated revenue model explanation

### 4. Test Contribution Rewards
1. Go to Admin Dashboard → Contribution Rewards
2. Verify Monthly Conversion tab exists
3. Test conversion rate settings
4. Check current period preview
5. Execute test conversion (with small amount)

## User Communication

### What Users See

#### Creators
- **No change in experience**
- Continue earning from ad revenue as before
- Now receive 60% instead of 45% (improvement!)

#### Listeners
- **Earnings moved to Contribution Rewards**
- Earn points for valuable activities
- Monthly conversion to Treats
- View rewards in Profile → Earnings → Contribution Rewards

### Recommended Communication
```
We've upgraded our monetization model to be AdMob-compliant:

Creators:
✅ Now earn 60% of ad revenue (up from 45%)
✅ Better rewards for your content

Listeners:
✅ Earn through new Contribution Rewards System
✅ Get rewarded for playlist creation, discovery, and curation
✅ Monthly payouts based on your contribution points

Platform:
✅ Sustainable and compliant monetization
✅ Better control over community rewards budget
```

## Migration Rollback (Emergency Only)

If needed, the split can be adjusted:

```sql
-- Rollback to old split (NOT RECOMMENDED - violates AdMob policy)
UPDATE ad_safety_caps
SET
  artist_revenue_percentage = 45.00,
  listener_revenue_percentage = 15.00,
  platform_revenue_percentage = 40.00
WHERE is_active = true;

-- Note: This will fail due to constraints. Must remove constraints first.
```

**Warning:** Rolling back violates AdMob policies and may result in account suspension.

## Related Documentation

- [Contribution Rewards System](./CONTRIBUTION_REWARDS_WORLD_CLASS_REDESIGN.md)
- [Monthly Conversion Quick Start](./MONTHLY_CONVERSION_QUICK_START.md)
- [Monthly Conversion System Guide](./MONTHLY_CONVERSION_SYSTEM_GUIDE.md)
- [AdMob Setup Instructions](./ADMOB_SETUP_INSTRUCTIONS.md)

## Frequently Asked Questions

### Q: Will this affect existing ad revenue?
A: Past revenue distributions remain unchanged. Only new ad impressions use the new 60/0/40 split.

### Q: How do listeners earn now?
A: Through the Contribution Rewards System by creating playlists, discovering new content, curating quality collections, and engaging with the community.

### Q: Can the 60/0/40 split be changed?
A: Creator percentage can be adjusted but must remain ≥50% for AdMob compliance. Listener percentage must always be 0%.

### Q: What happens to pending listener earnings from ads?
A: All pending earnings from the old model will still be paid out. The new model only affects future ad impressions.

### Q: How often are contribution rewards distributed?
A: Monthly, at the end of each period. Admin controls the reward pool amount and conversion rate.

### Q: Is the contribution rewards budget sustainable?
A: Yes, platform controls the budget size and can scale it based on revenue. Much more predictable than direct ad revenue sharing.

## Support

For questions or issues:
- Technical: Check database logs and error messages
- Policy: Review AdMob compliance documentation
- Features: See Contribution Rewards documentation

---

**Implementation Date:** December 28, 2024
**Status:** ✅ Production Ready
**Build:** ✅ Passing
**AdMob Compliance:** ✅ Verified
