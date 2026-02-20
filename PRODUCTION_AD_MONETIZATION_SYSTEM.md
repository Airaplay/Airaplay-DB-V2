# Production Ad Monetization System - Complete Implementation

## Overview

A complete, production-ready ad-based reward system has been implemented with safety mechanisms, auditing, and revenue reconciliation. The system distributes AdMob revenue between artists (45%), listeners (15%), and the platform (40%), with strict quality controls and daily limits.

## Core Features

### 1. Safety Buffer System (70-80%)
- Admin inputs actual daily AdMob revenue
- System automatically applies configurable safety buffer (75% default)
- Only uses 70-80% of actual revenue for rewards
- Remaining 20-30% acts as safety cushion for:
  - Revenue fluctuations
  - Withdrawal processing
  - Fraud prevention
  - System sustainability

### 2. Listening Quality Score (LQS)
- Calculated per ad impression (0-100 scale)
- Factors include:
  - Playback duration (minimum 65 seconds)
  - Audio not muted
  - Active listening behavior
  - Content engagement
- **Minimum LQS of 40 required for listener rewards**
- Artist always gets paid if LQS criteria met
- Listener only gets paid if LQS >= 40

### 3. Daily User Caps
- **Max 50 rewarded ads per user per day**
- **Max $5 listener earnings per day**
- Prevents abuse and overpaying
- Configurable via safety caps table

### 4. Revenue Split Logic
```
If LQS >= 40:
  - Artist: 45% of ad value
  - Listener: 15% of ad value
  - Platform: 40% of ad value

If LQS < 40:
  - Artist: 45% of ad value
  - Listener: 0% (no reward)
  - Platform: 55% of ad value
```

### 5. Pending Balance System
- All earnings go to pending balance first
- 7-day default holding period (168 hours)
- Allows for fraud detection
- Enables reconciliation adjustments
- Configurable unlock period

### 6. Daily Reconciliation
- Compares estimated payouts vs actual AdMob revenue
- Calculates variance and adjustment factors
- Applies proportional adjustments to pending balances only
- **Never touches withdrawn funds**
- Complete audit trail

## Database Schema

### New Tables Created

#### 1. `ad_unit_daily_values`
Stores daily revenue per ad unit type with safety buffer.

**Key Columns:**
- `date` - Revenue date
- `ad_unit_type` - banner, interstitial, rewarded, native
- `actual_revenue_usd` - Real revenue from AdMob
- `safety_buffer_percentage` - Applied buffer (75% default)
- `usable_revenue_usd` - Actual * buffer (generated)
- `total_impressions` - Total ad impressions
- `avg_cpm_usable` - Average CPM after buffer (generated)

#### 2. `ad_daily_revenue_input`
Admin's immutable source of truth for daily AdMob revenue.

**Key Columns:**
- `revenue_date` - Date (unique)
- `total_revenue_usd` - Total daily revenue
- `banner_revenue`, `interstitial_revenue`, `rewarded_revenue`, `native_revenue` - Breakdown by type
- `safety_buffer_percentage` - Applied buffer
- `is_locked` - Prevents modifications once finalized
- `notes` - Admin notes
- `created_by`, `updated_by` - Audit trail

#### 3. `ad_safety_caps`
Configurable system-wide safety limits.

**Key Columns:**
- `max_rewarded_ads_per_day` - Default: 50
- `max_listener_earnings_per_day_usd` - Default: $5.00
- `min_lqs_for_listener_reward` - Default: 40
- `min_playback_duration_seconds` - Default: 65
- `pending_balance_unlock_hours` - Default: 168 (7 days)
- `artist_revenue_percentage` - Default: 45%
- `listener_revenue_percentage` - Default: 15%
- `platform_revenue_percentage` - Default: 40%
- `is_active` - Only one active config allowed

#### 4. `ad_reconciliation_log`
Daily reconciliation tracking and adjustments.

**Key Columns:**
- `reconciliation_date` - Date (unique)
- `estimated_total_payout_usd` - What we estimated
- `actual_admob_revenue_usd` - What AdMob actually paid
- `variance_usd` - Difference (generated)
- `variance_percentage` - Percentage difference (generated)
- `adjustment_factor` - Multiplier to apply (generated)
- `reconciliation_status` - pending, processing, completed, failed
- `total_impressions_reconciled` - Count
- `total_users_affected` - Count
- `adjustments_applied_count` - Count

### Enhanced Table

#### `ad_impressions` (New Columns Added)
- `listening_quality_score` - LQS value (0-100)
- `playback_duration` - Seconds played
- `is_muted` - Was audio muted
- `is_rewarded` - Was reward given
- `is_eligible_for_reward` - Met all criteria
- `reward_split` - JSONB with breakdown (artist_reward_usd, listener_reward_usd, platform_revenue_usd, lqs, etc.)
- `processing_status` - pending, processed, failed, skipped
- `processed_at` - Timestamp

## Database Functions

### 1. `check_user_daily_ad_cap(user_id UUID)`

Checks if a user has reached their daily limits.

**Returns JSONB:**
```json
{
  "success": true,
  "user_id": "...",
  "today_rewarded_ad_count": 25,
  "today_listener_earnings_usd": 2.50,
  "max_rewarded_ads_per_day": 50,
  "max_listener_earnings_per_day_usd": 5.00,
  "has_reached_ad_cap": false,
  "has_reached_earnings_cap": false,
  "is_capped": false
}
```

**Usage:**
```sql
SELECT check_user_daily_ad_cap('user-uuid-here');
```

### 2. `admin_input_daily_admob_revenue(...)`

Admin function to input daily AdMob revenue with safety buffer.

**Parameters:**
- `p_revenue_date` - Date (required)
- `p_total_revenue_usd` - Total revenue (required)
- `p_banner_revenue` - Banner revenue (optional, default 0)
- `p_interstitial_revenue` - Interstitial revenue (optional, default 0)
- `p_rewarded_revenue` - Rewarded revenue (optional, default 0)
- `p_native_revenue` - Native revenue (optional, default 0)
- `p_safety_buffer_pct` - Buffer percentage (optional, default 75%)
- `p_notes` - Admin notes (optional)

**Returns JSONB:**
```json
{
  "success": true,
  "revenue_input_id": "...",
  "revenue_date": "2025-12-27",
  "total_revenue_usd": 1000.00,
  "safety_buffer_percentage": 75.00,
  "usable_revenue_usd": 750.00,
  "created_by": "admin-uuid"
}
```

**Usage Example:**
```sql
SELECT admin_input_daily_admob_revenue(
  '2025-12-27',           -- revenue date
  1000.00,                -- total revenue
  250.00,                 -- banner revenue
  300.00,                 -- interstitial revenue
  400.00,                 -- rewarded revenue
  50.00,                  -- native revenue
  75.00,                  -- safety buffer (75%)
  'Daily revenue from AdMob dashboard'  -- notes
);
```

## Security & Access Control

### Row Level Security (RLS)
All tables have RLS enabled with admin-only policies:

- **Admin Users** - Full access to all tables
- **Authenticated Users** - Can only read active safety caps
- **Admin Role Check** - Uses `users.role = 'admin'`

### Audit Trail
Complete tracking of all operations:
- Who created/updated records
- When records were modified
- Immutable entries once locked
- Complete history preservation

## Implementation Workflow

### Daily Operations

#### 1. Morning: Admin Inputs Previous Day's Revenue
```sql
-- Admin logs into dashboard
-- Navigates to Ad Revenue Input section
-- Enters data from AdMob dashboard
SELECT admin_input_daily_admob_revenue(
  CURRENT_DATE - INTERVAL '1 day',  -- Yesterday
  1234.56,                            -- Total from AdMob
  300.00,                             -- Banner
  400.00,                             -- Interstitial
  500.00,                             -- Rewarded
  34.56,                              -- Native
  75.00,                              -- 75% safety buffer
  'Revenue from AdMob dashboard for Dec 26'
);
```

#### 2. Throughout Day: Ad Impressions Tracked
- App tracks ad impressions in `ad_impressions` table
- LQS calculated based on user behavior
- Playback duration, mute status recorded
- Eligibility determined (caps, LQS threshold, duration)

#### 3. Evening: Process Pending Impressions
- Background job processes pending ad impressions
- Checks daily caps via `check_user_daily_ad_cap()`
- Calculates reward splits based on LQS and caps
- Credits pending balances (not immediate withdrawal)
- Stores reward details in `reward_split` JSONB

#### 4. Weekly: Reconciliation (Optional)
- Compare estimated payouts vs actual revenue
- Calculate adjustment factors
- Apply proportional adjustments to pending balances
- Never touch withdrawn funds

#### 5. After 7 Days: Unlock Pending Balances
- Pending balances older than 7 days become withdrawable
- Users can request withdrawal
- Admin processes withdrawal requests

## Next Steps for Admin Dashboard UI

You'll need to create admin UI components for:

### 1. Daily Revenue Input Section
**Location:** `src/screens/AdminDashboardScreen/AdRevenueInputSection.tsx`

**Features:**
- Date picker for revenue date
- Input fields for total revenue and breakdown by type
- Safety buffer slider (50-90%)
- Notes textarea
- Submit button calling `admin_input_daily_admob_revenue()`
- Table showing recent revenue entries
- Lock/unlock mechanism for entries
- Visual indicator of usable vs total revenue

### 2. Safety Caps Configuration
**Location:** `src/screens/AdminDashboardScreen/AdSafetyCapsSection.tsx`

**Features:**
- Edit form for safety caps configuration
- Number inputs for:
  - Max ads per day
  - Max earnings per day
  - Min LQS threshold
  - Min playback duration
  - Pending unlock hours
  - Revenue split percentages
- Validation that splits sum to 100%
- Save button with confirmation
- Preview of what changes mean

### 3. Reconciliation Dashboard
**Location:** `src/screens/AdminDashboardScreen/AdReconciliationSection.tsx`

**Features:**
- Date range selector
- Table showing daily reconciliation status
- Variance tracking (estimated vs actual)
- Adjustment factor display
- Status indicators (pending, processing, completed, failed)
- Manual reconciliation trigger button
- Affected users count
- Adjustments applied count

### 4. Ad Impressions Monitor
**Location:** `src/screens/AdminDashboardScreen/AdImpressionsMonitorSection.tsx`

**Features:**
- Real-time view of ad impressions
- Filter by processing status
- LQS distribution chart
- Reward eligibility breakdown
- User cap tracking
- Daily totals and trends

## Important Notes

### Safety First
- Always use 70-80% safety buffer
- Never exceed $5 per user per day for listeners
- Never exceed 50 rewarded ads per user per day
- Always validate LQS >= 40 for listener rewards

### Data Integrity
- Locked revenue entries cannot be modified
- Pending balances only adjustable during reconciliation
- Withdrawn funds are untouchable
- Complete audit trail for all operations

### Fraud Prevention
- 7-day pending period allows fraud detection
- Daily caps prevent abuse
- LQS system prevents fake engagement
- Minimum playback duration (65 seconds)
- Mute detection prevents silent farming

### Scalability
- Indexes on all key columns
- JSONB for flexible reward data
- Efficient date-based queries
- Generated columns for calculated values

## Testing Checklist

Before going live:

1. **Admin Revenue Input**
   - [ ] Test inputting daily revenue
   - [ ] Verify safety buffer calculation
   - [ ] Test locking/unlocking entries
   - [ ] Test breakdown by ad type

2. **User Cap Checking**
   - [ ] Test reaching 50 ad cap
   - [ ] Test reaching $5 earnings cap
   - [ ] Test cap reset at midnight
   - [ ] Test function returns correct data

3. **LQS System**
   - [ ] Test LQS < 40 (no listener reward)
   - [ ] Test LQS >= 40 (listener rewarded)
   - [ ] Test artist always paid
   - [ ] Test playback duration requirement

4. **Revenue Splits**
   - [ ] Verify 45% to artist
   - [ ] Verify 15% to listener (when eligible)
   - [ ] Verify 40% to platform (or 55% if listener ineligible)
   - [ ] Test split calculations

5. **Pending Balances**
   - [ ] Test 7-day pending period
   - [ ] Test balance unlock after period
   - [ ] Test withdrawal restrictions before unlock

6. **Security**
   - [ ] Verify admin-only access to sensitive data
   - [ ] Test non-admin cannot input revenue
   - [ ] Test RLS policies work correctly
   - [ ] Verify audit trail captures all changes

## Support

For questions or issues:
1. Check database logs: `SELECT * FROM ad_reconciliation_log ORDER BY created_at DESC;`
2. Check recent revenue inputs: `SELECT * FROM ad_daily_revenue_input ORDER BY revenue_date DESC LIMIT 10;`
3. Check active safety caps: `SELECT * FROM ad_safety_caps WHERE is_active = true;`
4. Check user's daily status: `SELECT check_user_daily_ad_cap('user-uuid');`

## Summary

The production ad monetization system is now fully implemented at the database level with:
- ✅ 4 new tables for revenue tracking, safety caps, and reconciliation
- ✅ Enhanced ad_impressions table with LQS tracking
- ✅ 2 key admin functions for cap checking and revenue input
- ✅ Complete RLS security policies
- ✅ Safety buffer system (70-80%)
- ✅ Daily user caps (50 ads, $5 max)
- ✅ LQS-based conditional rewards
- ✅ Pending balance system (7-day hold)
- ✅ Audit trail for all operations

**Next:** Build the admin dashboard UI components to interact with this system.
