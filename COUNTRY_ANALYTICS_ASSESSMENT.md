# Country Analytics System - Assessment & Implementation Plan

## Current State Analysis

### Database Structure

#### Country Data Sources
Your database has **multiple country tracking mechanisms**:

1. **User Profile Country** (`users.country`)
   - Manually set by users during registration/profile updates
   - Can be changed (with 14-day restriction)
   - May not reflect actual user location

2. **Detected Country** (from IP geolocation)
   - `listening_history.detected_country` and `detected_country_code`
   - `video_playback_history.detected_country` and `detected_country_code`
   - `treat_payments.detected_country` and `detected_country_code`
   - More accurate for analytics as it reflects actual user location during activity

3. **Content Origin**
   - `songs.country` - Where song was created
   - `artist_profiles.country` - Artist's home country

4. **Financial/Withdrawal**
   - `withdrawal_requests.country` and `user_country`
   - `withdrawal_exchange_rates.country_code` and `country_name`

---

### Revenue & Earnings Tracking

#### Current Tables:
1. **users.total_earnings** (numeric)
   - **This is NET earnings** (current balance after withdrawals)
   - NOT gross lifetime earnings

2. **ad_revenue_events**
   - Tracks ad impressions and revenue
   - Links: user_id, artist_id, content_id
   - Has revenue_amount in USD
   - Status: pending/processed

3. **treat_payments**
   - Treat (in-app currency) purchases
   - Has `amount_usd` (actual money paid)
   - Has detected country tracking
   - Status: pending/completed

4. **withdrawal_requests**
   - Tracks payouts to creators
   - Has country information
   - Status: pending/approved/completed/rejected

5. **curator_earnings**
   - Silent curator monetization system
   - Separate revenue stream

6. **user_daily_earnings**
   - Tracks daily contribution points
   - NOT in USD, uses points system

---

### Current Admin Dashboard Issues

#### CountryAnalyticsSection.tsx Problems:

```typescript
// ISSUE 1: Uses user.country (manual) instead of detected_country
const { data: countriesData } = await supabase
  .from('users')
  .select('country, role, gender, total_earnings');

// ISSUE 2: Only counts total_earnings (NET balance), not gross
countryStats.total_revenue += user.total_earnings || 0;

// ISSUE 3: Listener rewards are calculated incorrectly
stats.listener_rewards = stats.total_plays * 0.001; // Random multiplier

// ISSUE 4: Doesn't separate revenue sources
// No distinction between:
// - Ad revenue (creators earn 50%, listeners earn 10%)
// - Treat purchases (pure revenue)
// - Curator earnings
// - Withdrawn vs available balance
```

#### What's Missing:

1. **Revenue Source Breakdown**
   - Ad Revenue (creator share)
   - Ad Revenue (listener share)
   - Treat Purchase Revenue (USD)
   - Curator Earnings
   - Withdrawn amounts

2. **Accurate Country Detection**
   - Should use detected_country from playback history
   - Should show both "Registered Country" vs "Active Country"

3. **Time-based Analytics**
   - No date range filtering
   - No growth trends by country
   - No period-over-period comparison

4. **Performance Metrics by Country**
   - Which countries have highest engagement?
   - Which countries generate most revenue?
   - Which countries have best retention?

---

## Proposed Implementation Plan

### Phase 1: Create Comprehensive Country Analytics View

Create a database view/function that aggregates:

```sql
-- Country Analytics Comprehensive View
CREATE OR REPLACE FUNCTION get_country_analytics(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  country_code text,
  country_name text,

  -- User Metrics
  total_users bigint,
  registered_users bigint,        -- Users who set this as their country
  active_users bigint,             -- Users detected in this country via IP
  listener_count bigint,
  creator_count bigint,
  male_count bigint,
  female_count bigint,
  other_count bigint,

  -- Engagement Metrics
  total_song_plays bigint,
  total_video_views bigint,
  total_content_items bigint,
  avg_plays_per_user numeric,

  -- Revenue Metrics (USD)
  ad_revenue_total numeric,        -- Total ad revenue generated
  ad_revenue_creators numeric,     -- 50% to creators
  ad_revenue_listeners numeric,    -- 10% to listeners
  ad_revenue_platform numeric,     -- 40% to platform

  treat_purchase_revenue numeric,  -- Actual USD from Treat purchases
  treat_spent_amount numeric,      -- Treats spent in this country

  curator_earnings_total numeric,  -- Curator monetization

  gross_earnings_usd numeric,      -- Total ever earned (current + withdrawn)
  current_balance_usd numeric,     -- Available balance
  withdrawn_usd numeric,           -- Total withdrawn

  -- Growth Metrics
  new_users_period bigint,
  new_creators_period bigint,
  plays_growth_percent numeric,
  revenue_growth_percent numeric
) AS $$
...
```

### Phase 2: Enhanced Admin Dashboard

#### New Section: "Country Performance Dashboard"

**Overview Cards:**
- Total Active Countries
- Top Revenue Country
- Fastest Growing Country
- Highest Engagement Country

**Interactive Features:**
- Date range selector (Today, 7d, 30d, 90d, All Time)
- Country search and filter
- Sort by: Users, Plays, Revenue, Growth
- Export to CSV/Excel

**Visualizations:**
1. **World Map** (color-coded by metric)
   - User count heatmap
   - Revenue heatmap
   - Engagement heatmap

2. **Top 10 Countries Charts**
   - By total users
   - By engagement (plays + views)
   - By revenue generated
   - By growth rate

3. **Revenue Breakdown by Country**
   - Stacked bar chart showing:
     - Ad revenue (creator share)
     - Ad revenue (listener share)
     - Treat purchases
     - Curator earnings

4. **Detailed Country Table**
   ```
   Country | Users | L/C | Plays | Views | Revenue | Withdrawn | Growth
   --------|-------|-----|-------|-------|---------|-----------|--------
   Nigeria | 2.5K  | 2K/500 | 45K | 12K | $1,234 | $890 | +15%
   USA     | 1.8K  | 1.5K/300 | 38K | 9K | $2,100 | $1,500 | +8%
   ```

### Phase 3: Real-time Country Detection

**Enhance IP Geolocation:**
- Ensure all playback events capture detected_country
- Store both country_code (NG, US, GB) and country_name (Nigeria, USA, UK)
- Update analytics in real-time

**Data Integrity:**
- Normalize country names (Nigeria vs NG)
- Handle VPNs and proxy detection
- Flag suspicious location changes

---

## Data Sources for Accurate Analytics

### For User Count by Country:
```sql
-- Use DETECTED country from actual activity, not user profile
SELECT
  COALESCE(
    lh.detected_country_code,
    vph.detected_country_code,
    u.country
  ) as country
FROM users u
LEFT JOIN listening_history lh ON lh.user_id = u.id
LEFT JOIN video_playback_history vph ON vph.user_id = u.id
```

### For Revenue by Country:
```sql
-- Ad Revenue
SELECT detected_country_code, SUM(revenue_amount)
FROM ad_revenue_events
WHERE status = 'processed'
GROUP BY detected_country_code;

-- Treat Revenue (actual USD)
SELECT detected_country_code, SUM(amount_usd)
FROM treat_payments
WHERE status = 'completed'
GROUP BY detected_country_code;

-- Withdrawn Amounts
SELECT country, SUM(amount)
FROM withdrawal_requests
WHERE status IN ('approved', 'completed')
GROUP BY country;
```

### For Engagement by Country:
```sql
-- Song Plays
SELECT detected_country_code, COUNT(*) as plays
FROM listening_history
GROUP BY detected_country_code;

-- Video Views
SELECT detected_country_code, COUNT(*) as views
FROM video_playback_history
GROUP BY detected_country_code;
```

---

## Key Metrics to Track

### Per Country:

**User Metrics:**
- Total registered users
- Active users (last 30 days)
- Listener count
- Creator count
- Gender distribution
- New user growth rate

**Engagement Metrics:**
- Total plays (all time)
- Total views (all time)
- Plays per user
- Views per user
- Session duration
- Return rate

**Revenue Metrics:**
- **Gross Earnings:** Total ever earned by users in this country
- **Net Balance:** Current available balance
- **Total Withdrawn:** Amount paid out
- **Ad Revenue Generated:** From users in this country consuming content
- **Treat Purchase Revenue:** Actual USD spent on Treats
- **Platform Revenue:** 40% of ad revenue

**Content Metrics:**
- Songs uploaded from this country
- Videos uploaded from this country
- Top trending content in this country
- Local vs international content consumption

---

## Security & Privacy Considerations

1. **IP Geolocation Accuracy**
   - IPs can be spoofed or use VPNs
   - Label as "detected_country" not "actual_country"
   - Allow users to set preferred country

2. **GDPR Compliance**
   - Don't store raw IP addresses long-term
   - Only store country-level data
   - Allow users to opt-out of geolocation

3. **Data Anonymization**
   - Aggregate data only (no individual tracking)
   - Minimum threshold for display (e.g., only show countries with 10+ users)

---

## Next Steps

Before implementing, please confirm:

1. **Which metrics are most important to you?**
   - User count?
   - Revenue performance?
   - Engagement/plays?
   - Growth rates?

2. **What's the primary use case?**
   - Marketing (where to focus growth efforts)?
   - Financial (which countries generate most revenue)?
   - Content strategy (what content works where)?
   - Operational (where to support local payment methods)?

3. **Do you want:**
   - A new comprehensive analytics function?
   - Enhanced CountryAnalyticsSection component?
   - Both?

4. **Time range preferences:**
   - Real-time (today)?
   - Historical (30d, 90d, all time)?
   - Comparison periods (this month vs last month)?

---

## Recommendation

**Start with a new database function** that provides accurate, comprehensive country analytics, then **update the admin dashboard** to display this data with proper visualizations.

This approach ensures:
- Accurate data (using detected_country from playback history)
- Proper revenue tracking (separating gross/net, ad/treat revenue)
- Better performance (pre-aggregated data)
- Flexible querying (date ranges, filters)

Let me know which direction you'd like to take, and I'll implement accordingly!
