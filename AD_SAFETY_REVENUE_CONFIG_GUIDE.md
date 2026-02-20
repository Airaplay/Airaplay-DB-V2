# Ad Safety & Revenue Split Configuration Guide

## Overview

The **Ad Safety & Revenue Split** section in the Admin Dashboard allows you to configure all safety limits, quality thresholds, and revenue distribution for the ad monetization system.

## Accessing the Configuration

1. Log into the Admin Dashboard
2. Navigate to **Ad Safety & Revenue Split** in the sidebar (located under Ad Revenue)
3. You'll see four main configuration sections

## Configuration Sections

### 1. Daily User Limits

**Purpose:** Prevent abuse and control daily payouts

**Settings:**
- **Max Rewarded Ads Per Day** (Default: 50)
  - Maximum number of ads a single user can be rewarded for in a 24-hour period
  - Range: 1-200
  - Prevents ad farming and abuse

- **Max Listener Earnings Per Day (USD)** (Default: $5.00)
  - Maximum USD amount a listener can earn from ads per day
  - Range: $0.01-$50.00
  - Caps daily payout exposure

### 2. Quality Thresholds

**Purpose:** Ensure genuine engagement for rewards

**Settings:**
- **Minimum LQS for Listener Reward** (Default: 40)
  - Listening Quality Score threshold (0-100 scale)
  - Listener must meet this score to receive their share
  - Artist ALWAYS gets paid regardless of LQS
  - Range: 0-100

- **Minimum Playback Duration (Seconds)** (Default: 65)
  - Minimum seconds of content playback required for reward eligibility
  - Prevents quick skips and fake plays
  - Range: 1-300 seconds

### 3. Pending Balance Settings

**Purpose:** Fraud prevention and reconciliation window

**Settings:**
- **Pending Balance Unlock Period (Hours)** (Default: 168 hours / 7 days)
  - Hours before pending balances become withdrawable
  - Allows time for fraud detection
  - Enables reconciliation adjustments before withdrawal
  - Range: 0-720 hours (0-30 days)

### 4. Revenue Split Configuration

**Purpose:** Define how ad revenue is distributed

**Settings:**
- **Artist Revenue (%)** (Default: 45%)
  - Content creator's share of ad revenue
  - Always paid if minimum requirements met

- **Listener Revenue (%)** (Default: 15%)
  - Listener's share of ad revenue
  - Only paid if LQS meets minimum threshold
  - If LQS < minimum, this goes to platform instead

- **Platform Revenue (%)** (Default: 40%)
  - Platform's share of ad revenue
  - Increases to 55% if listener doesn't qualify

**Important:** Revenue split MUST total exactly 100%. The interface will highlight any errors.

## How Revenue Split Works

### Normal Split (LQS ≥ 40)
```
Ad Value: $1.00
├─ Artist: $0.45 (45%)
├─ Listener: $0.15 (15%)
└─ Platform: $0.40 (40%)
Total: $1.00 ✓
```

### Low Quality Split (LQS < 40)
```
Ad Value: $1.00
├─ Artist: $0.45 (45%)
├─ Listener: $0.00 (0% - didn't qualify)
└─ Platform: $0.55 (55% - receives listener's share)
Total: $1.00 ✓
```

## Making Changes

### To Update Configuration:

1. **Modify any values** in the form fields
   - The "Reset Changes" button becomes enabled
   - You'll see real-time validation

2. **Verify revenue split totals 100%**
   - The total is displayed at the bottom
   - Must equal exactly 100.00% (shown in green)
   - If incorrect, shown in red with error message

3. **Click "Save Configuration"**
   - Changes are validated
   - If valid, saved to database
   - Success message appears
   - "Reset Changes" button is disabled

4. **To discard changes**, click "Reset Changes"
   - Reverts all fields to current saved values

## Validation Rules

The system automatically validates:

### Daily Limits
- Max ads: 1-200
- Max earnings: $0.01-$50.00

### Quality Thresholds
- Min LQS: 0-100
- Min playback: 1-300 seconds

### Pending Period
- Unlock hours: 0-720 (0-30 days)

### Revenue Split
- Each percentage: 0-100%
- **Total must equal 100.00%**

## Best Practices

### Safety Limits
- Start conservative and adjust based on data
- Monitor abuse patterns and adjust caps accordingly
- Consider market rates when setting max earnings

### Quality Thresholds
- Higher LQS threshold = fewer but more genuine rewards
- Lower threshold = more rewards but potential quality issues
- 40 is a good balance for most cases

### Pending Period
- 7 days (168 hours) recommended for fraud detection
- Can be reduced for faster payouts (higher risk)
- Can be increased for more careful monitoring

### Revenue Split
- 45/15/40 is recommended default split
- Artist should always get largest share
- Platform needs enough to cover costs + safety buffer
- Listener share incentivizes engagement

## Common Scenarios

### Scenario 1: Reducing Fraud
**Problem:** Suspicious ad viewing patterns
**Solution:**
- Increase minimum LQS to 50-60
- Increase minimum playback to 90 seconds
- Reduce max ads per day to 30
- Increase pending period to 336 hours (14 days)

### Scenario 2: Boosting Engagement
**Problem:** Low listener participation
**Solution:**
- Lower minimum LQS to 30
- Increase listener revenue % to 20%
- Reduce artist % to 40%
- Keep platform at 40%

### Scenario 3: Conservative Payout
**Problem:** Need to reduce payout exposure
**Solution:**
- Lower max earnings to $2.50 per day
- Reduce max ads to 25 per day
- Increase pending period to 336 hours
- Keep quality thresholds high

### Scenario 4: Premium Quality Content
**Problem:** Want to reward only high-quality engagement
**Solution:**
- Set minimum LQS to 60+
- Set minimum playback to 120 seconds
- Keep or increase listener share to reward quality
- Maintain standard caps

## Monitoring Impact

After changing configuration:

1. **Monitor daily payout totals** (Ad Revenue section)
2. **Track average LQS scores** (Ad Impressions Monitor)
3. **Watch user cap hitting rates** (check how many hit limits)
4. **Review fraud detection alerts** (if any)
5. **Compare revenue vs payouts** (Reconciliation section)

## Tips

- **Don't change multiple settings at once** - Change one at a time to see impact
- **Monitor for 3-7 days** - Allow time to see patterns before adjusting again
- **Document changes** - Use the Notes field when inputting daily revenue
- **Check total daily** - Revenue split should always total 100%
- **Test in stages** - Make small adjustments, not dramatic changes

## Troubleshooting

### Revenue Split Won't Save
- **Check total equals 100%** - Most common issue
- **Verify all values are valid** - Check ranges for each field
- **Ensure you have admin access** - Only admins can modify

### Changes Don't Take Effect
- **Refresh the page** - Clear browser cache if needed
- **Check success message** - Verify save completed
- **Wait 1-5 minutes** - Changes may take time to propagate

### Can't See the Section
- **Verify admin role** - Only admins have access
- **Check sidebar menu** - Should appear under "Ad Revenue"
- **Refresh dashboard** - Log out and back in if needed

## Related Documentation

- See `PRODUCTION_AD_MONETIZATION_SYSTEM.md` for complete technical details
- See Ad Revenue Input section for daily revenue entry
- See Payment Monitoring for tracking actual payouts
- See Ad Reconciliation for variance tracking

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify your admin role in database
3. Check the ad_safety_caps table directly
4. Review system logs for validation errors

---

**Last Updated:** 2025-12-27
**Version:** 1.0
