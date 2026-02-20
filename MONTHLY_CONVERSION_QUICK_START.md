# Monthly Conversion System - Quick Start Guide

## For Admins: 3-Step Process

### Step 1: Set Conversion Rate (One-time setup)
1. Go to: **Admin Dashboard → Contribution Rewards → Monthly Conversion**
2. Click **"Edit Settings"** in Conversion Settings card
3. Enter rate (e.g., `0.001` = 1000 points = $1 USD)
4. Click **"Save Settings"**

### Step 2: Monitor Throughout Month
- Check the **"Current Period Preview"** card regularly
- Watch: Eligible points, User count, Estimated payout

### Step 3: Execute at Month End
1. Input **Reward Pool Amount** (e.g., `5000` for $5,000)
2. Confirm **Conversion Date** (last day of month)
3. Click **"Execute Conversion"**
4. Done! Treats credited to user wallets automatically

---

## How Payouts Work

```
User's Payout = User Points × Conversion Rate

Example:
- User earned 50,000 points
- Conversion rate is 0.001
- Payout = 50,000 × 0.001 = $50 USD worth of Treats
```

### If Scaling Applied

When total would exceed budget, system scales proportionally:

```
Example:
- Total points: 8,000,000
- At 0.001 rate: Would cost $8,000
- Budget: Only $5,000 available
- System scales: $5,000 ÷ $8,000 = 0.625×
- Actual rate used: 0.000625
- User with 50,000 points gets: 50,000 × 0.000625 = $31.25
```

**Everyone's payout scales by same percentage. Fair to all users.**

---

## Key Rules

✅ **Minimum Points**: Users need 10+ points to qualify (configurable)
✅ **Direct Crediting**: Goes to `earned_balance` in Treat Wallets
✅ **Points Reset**: Current period points → 0 after conversion
✅ **Total Preserved**: Lifetime total_points stay intact
✅ **Budget Safe**: Never exceeds your reward pool amount

---

## What Users See

Users see their rewards in **Profile → Earnings Tab**:

```
Contribution Rewards
├─ December 2024: $50.00 (2,000 points)
├─ November 2024: $45.00 (1,800 points)
└─ October 2024: $40.00 (1,600 points)
```

---

## Common Questions

**Q: Can I run conversion multiple times per month?**
A: Yes, but system prevents paying same user twice for same period.

**Q: What if a user has 5 points?**
A: They won't receive payout (below 10 point minimum). Points carry to next month.

**Q: Can I change the conversion rate mid-month?**
A: Yes, but it only affects the next conversion. Current month uses rate at time of execution.

**Q: What happens if I input $10,000 but only need $3,000?**
A: System only distributes what's needed. No scaling applied. You set maximum, not exact amount.

**Q: Can users withdraw earned Treats?**
A: Yes! Treats from `earned_balance` can be withdrawn same as purchased Treats.

---

## Recommended Conversion Rates

| Rate | Points per $1 | Use Case |
|------|---------------|----------|
| 0.0005 | 2,000 | Conservative, larger community |
| 0.001 | 1,000 | Standard, balanced |
| 0.002 | 500 | Generous, smaller community |

---

## Database Functions (for Developers)

```sql
-- Get real-time preview
SELECT * FROM get_conversion_preview();

-- Update conversion rate (admin only)
SELECT admin_update_conversion_rate(0.001, 'Standard rate');

-- Execute monthly conversion (admin only)
SELECT * FROM admin_distribute_contribution_rewards('2024-12-31', 5000.00);
```

---

## Security

✅ Admin-only functions (verified via RLS)
✅ All operations logged in audit trail
✅ Atomic transactions (all-or-nothing)
✅ Balance constraints prevent negative values
✅ Idempotency prevents double-payments

---

## Quick Troubleshooting

**Issue**: Conversion button disabled
- **Fix**: Enter reward pool amount and check date is valid

**Issue**: User complains they didn't get reward
- **Fix**: Check if they had ≥10 points and weren't already paid for that period

**Issue**: "No active conversion settings" error
- **Fix**: Create settings first via "Edit Settings" button

**Issue**: Preview shows higher estimate than expected
- **Fix**: Normal! Estimate uses current rate. Actual conversion can use different rate if you adjust it.

---

## Complete Documentation

For detailed technical documentation, see: `MONTHLY_CONVERSION_SYSTEM_GUIDE.md`

---

**Status**: ✅ Production Ready | **Build**: ✅ Passing | **Last Updated**: Dec 28, 2024
