# Payout Settings Cleanup

**Date:** 2025-12-28

## Problem Identified

The admin dashboard had **redundant and confusing** ad revenue configuration in two separate locations:

1. **Ad Safety Caps & Revenue Split** (in Ad Management section) - Configured ad revenue at 60/0/40
2. **Ad Revenue Splitting tab** (in Payout Settings) - Another place to configure the same thing

This created confusion about which setting was actually used and unnecessarily complicated the admin interface.

## Solution Applied

Removed the redundant "Ad Revenue Splitting" tab from the Payout Settings section.

### What Was Removed:
- "Ad Revenue Splitting" nested tab
- Ad-specific percentage fields (ad_artist_percentage, ad_listener_percentage, ad_platform_percentage)
- Ad-specific table columns in the settings display
- Related validation logic for ad percentages

### What Remains:

#### 1. Payout Settings (Earnings & Payout Settings → Payout Settings tab)
**Purpose:** Controls earnings distribution for **non-ad revenue**
- Treat tips
- Treat promotions
- Other earnings

**Default Split:** 45% Creator | 20% Listener | 35% Platform

**Features:**
- Create global, country-specific, or user-specific payout rules
- Set withdrawal thresholds
- Configure earnings distribution percentages

**Note Added:** Clear message explaining these settings are for non-ad revenue only

#### 2. Ad Safety Caps & Revenue Split (Ad Management section)
**Purpose:** Single source of truth for **ad revenue configuration**
- Ad revenue split: 60% Creator | 0% Listener | 40% Platform
- Daily ad limits (max 50 rewarded ads per day)
- Quality thresholds (minimum 65 seconds playback)
- Pending balance unlock period (7 days)

**Compliance:** Meets AdMob policies with 60% minimum to creators

## Benefits

1. **No More Confusion** - Single place to configure ad revenue
2. **Clearer Separation** - Non-ad earnings vs. ad revenue are clearly separated
3. **Simplified UI** - Removed unnecessary nested tabs and columns
4. **Better Admin Experience** - Easier to understand where to configure what

## Technical Changes

### Files Modified:
- `src/screens/AdminDashboardScreen/EarningsPayoutSettingsSection.tsx`

### Changes Made:
1. Removed `activeTab` state variable for nested tabs
2. Removed ad revenue fields from `formData` state
3. Simplified `PayoutSetting` TypeScript interface
4. Removed ad revenue columns from table display
5. Removed conditional logic for ad revenue updates
6. Added clarifying note about ad revenue configuration location

### Database:
No database changes required. The `payout_settings` table still has ad revenue columns (nullable) for backward compatibility, but the UI no longer exposes them.

## Where to Configure What

| Revenue Source | Configuration Location | Current Split |
|---------------|------------------------|---------------|
| **Treat Tips** | Earnings & Payout Settings → Payout Settings | 45% / 20% / 35% |
| **Treat Promotions** | Earnings & Payout Settings → Payout Settings | 45% / 20% / 35% |
| **Ad Revenue** | Ad Management → Ad Safety Caps & Revenue Split | 60% / 0% / 40% |
| **Contribution Rewards** | Contribution Rewards section | Monthly budget |

## Notes

- Listener rewards from ads remain at 0% (AdMob compliance)
- Listeners earn through the separate Contribution Rewards system
- Ad revenue split is hardcoded at 60/0/40 in the Ad Safety Caps section
- Non-ad earnings can be configured per country or per user if needed
