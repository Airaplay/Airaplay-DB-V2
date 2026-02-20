# Currency Investigation Findings - Critical Issues Found

## Investigation Date: 2026-01-23

## Executive Summary

Investigation complete. Found **ONE CRITICAL BUG** affecting all international user withdrawals. The system has two separate financial flows, only one is broken:

### ✅ Flow 1: Treat Economy (Working Correctly)
- Users buy Treats in local currency → Correct
- Users spend Treats on promotions/tips → Correct
- Users withdraw Treats to Live Balance (USD) → Correct

### ❌ Flow 2: Earnings Withdrawals (CRITICALLY BROKEN)
- Users earn USD from ads/contributions → Correct
- Users withdraw USD to bank/mobile money → **BROKEN**
- All users get exchange rate 1.0 regardless of country → **CRITICAL BUG**

## System Architecture

### Two Separate Currencies:

**1. Treats (In-App Currency)**
- Purchased with real money
- Used for: tips, promotions, collaboration unlocks
- Can be withdrawn to Live Balance as USD
- Total in system: ~3M Treats ($30,088 USD equivalent)

**2. Live Balance (USD)**
- Earned from: ad revenue, contribution rewards, curator earnings
- Stored in `users.total_earnings` (USD)
- Withdrawn to: bank accounts, mobile money wallets
- Total in system: $25,909.52 USD

### Two Withdrawal Systems:

**System A: Treat → Live Balance Withdrawal**
```
Function: process_treat_withdrawal()
Flow: Treats → USD (using treat_to_usd_rate)
Destination: users.total_earnings
Status: ✅ WORKING CORRECTLY
```

**System B: Live Balance → Bank/Mobile Money Withdrawal**
```
Function: withdraw_user_funds()
Flow: USD → Local Currency (using exchange_rate from withdrawal_settings)
Destination: User's bank/mobile money
Status: ❌ CRITICALLY BROKEN
```

## The Bug Explained

### Current Implementation (WRONG):

```sql
-- withdrawal_settings table has ONE global exchange rate
exchange_rate: 1.0000 (hardcoded USD to USD)

-- withdraw_user_funds() function uses this rate for ALL countries:
v_exchange_rate := withdrawal_settings_record.exchange_rate;  -- Always 1.0!

-- Creates withdrawal with wrong conversion:
exchange_rate_applied = 1.0  -- Wrong for all non-USD countries!
```

### Impact on Real Users:

**Recent Pending Withdrawals (All WRONG):**

| User ID | Amount (USD) | Exchange Rate | Country | Should Be Rate | Correct Amount | Loss |
|---------|--------------|---------------|---------|----------------|----------------|------|
| User 1 | $12,824.00 | 1.0 | NG | 1,650 | ₦21,159,600 | 99.94% |
| User 2 | $18.00 | 1.0 | NG | 1,650 | ₦29,700 | 99.94% |
| User 3 | $34.03 | 1.0 | NG | 1,650 | ₦56,150 | 99.94% |
| User 4 | $76.18 | 1.0 | NG | 1,650 | ₦125,697 | 99.94% |
| User 5 | $68.68 | 1.0 | NG | 1,650 | ₦113,322 | 99.94% |

**Total Loss on These 5 Withdrawals:**
- USD Amount: $13,020.89
- Should Receive: ₦21,484,469
- Currently Receiving: ₦13,020.89
- Total Loss: ₦21,471,448 (~$13,013 USD equivalent)

## All Flows Audited

### ✅ Currency Flows Working Correctly:

1. **Treat Purchases (Multi-Currency)**
   - Location: `treat_payments` table
   - Process: Local currency → USD → Treats
   - Status: ✅ Perfect
   - Evidence: 54 payments in 7 currencies (NGN, EUR, GBP, CAD, AUD, GHS, USD)
   - Exchange rates correctly applied and stored

2. **Ad Revenue Distribution**
   - Location: Database functions (60/0/40 split)
   - Currency: USD
   - Status: ✅ Correct (always USD, no conversion needed)

3. **Contribution Score System**
   - Location: `contribution_conversion_history`
   - Process: Points → USD
   - Conversion Rate: 0.001999 USD per point
   - Status: ✅ Working correctly

4. **Curator Earnings**
   - Location: `curator_earnings` table
   - Currency: USD
   - Status: ✅ Correct (always USD)

5. **Treat Withdrawals to Live Balance**
   - Location: `process_treat_withdrawal()` function
   - Process: Treats → USD
   - Conversion: Uses `treat_to_usd_rate` from `treat_withdrawal_settings`
   - Status: ✅ Working correctly

6. **Treat Tips**
   - Location: `treat_tips` table
   - Currency: Treats (not affected by exchange rates)
   - Status: ✅ No issue

7. **Promotions**
   - Location: `promotions` table
   - Cost: In Treats
   - Status: ✅ No issue

8. **Daily Check-in Rewards**
   - Location: `daily_checkin_history`
   - Reward: In Treats
   - Status: ✅ No issue

### ❌ Currency Flow with Critical Bug:

**Live Balance Withdrawals (Bank/Mobile Money)**
- Location: `withdraw_user_funds()` function
- Process: USD → Local Currency
- Current: Uses single global `exchange_rate = 1.0`
- Impact: **ALL non-USD countries lose massive value**
- Status: ❌ **CRITICAL BUG - MUST FIX IMMEDIATELY**

## Root Cause Analysis

### Why This Bug Exists:

1. **Original Design**: System was designed with `withdrawal_settings` table having ONE global setting
2. **USD-Centric**: The exchange_rate field was meant for USD-to-USD (rate = 1.0)
3. **No Multi-Currency Plan**: When international users joined, no one updated the withdrawal logic
4. **Treat Purchases Worked**: Multi-currency was implemented correctly for purchases, but not for withdrawals

### Database Evidence:

```sql
-- Current withdrawal_settings (WRONG for international users)
SELECT * FROM withdrawal_settings;

id: e143991b-67d2-4954-a268-9167db6c68d6
exchange_rate: 1.0000  ← THIS IS THE BUG
withdrawal_fee_type: percentage
withdrawal_fee_value: 5.0
withdrawals_enabled: true
minimum_withdrawal_usd: 5.00
exchange_rate_source: manual
```

### User Distribution:

```sql
SELECT country, COUNT(*) FROM users WHERE country IS NOT NULL GROUP BY country;

Country | Users | Total Earnings
--------|-------|---------------
NG      | 22    | $25,909.52
Others  | 1     | $0.00
```

**98% of users are Nigerian and losing 99.94% of withdrawal value!**

## Financial Impact Analysis

### Current State:
- Total Live Balance in System: $25,909.52
- If all users withdraw with current bug: Users receive ₦25,909.52
- If all users withdraw with correct rate: Users receive ₦42,750,708
- **Shortfall: ₦42,724,799 (~$25,894 USD)**

### Affected Withdrawals:

**Pending (Need Immediate Fix):**
- 5 withdrawals totaling $13,020.89
- Status: pending (admin hasn't processed yet)
- Action: MUST recalculate before approval

**Completed (Past Damage):**
- Need to audit all historical "approved"/"completed" withdrawals
- Users may have already lost significant value
- May need compensation policy

## Currency Detection System

### Currently Working (For Purchases):

```typescript
// src/lib/currencyDetection.ts
CURRENCIES = {
  NGN: { code: 'NGN', symbol: '₦', exchangeRate: 1650 },
  GHS: { code: 'GHS', symbol: '₵', exchangeRate: 15.5 },
  KES: { code: 'KES', symbol: 'KSh', exchangeRate: 129 },
  GBP: { code: 'GBP', symbol: '£', exchangeRate: 0.79 },
  EUR: { code: 'EUR', symbol: '€', exchangeRate: 0.92 },
  // ... 13 more currencies
}
```

These rates are:
- ✅ Used correctly for Treat purchases
- ❌ NOT used for earnings withdrawals
- ⚠️ Hardcoded (not auto-updated)

## Other Issues Found (Not Critical)

### 1. Hardcoded Exchange Rates
- **Issue**: Rates in `currencyDetection.ts` are hardcoded
- **Impact**: Medium (rates become stale over time)
- **Fix**: Implement API-based rate updates (Phase 2)

### 2. No Currency Display on Earnings
- **Issue**: UI only shows USD, not local currency equivalent
- **Impact**: Low (user experience issue, not financial)
- **Fix**: Add dual currency display (Phase 3)

### 3. Premium Currency Rounding
- **Issue**: GBP/EUR amounts < 1 rounded up to 1
- **Impact**: Negligible (documented feature for purchases)
- **Status**: Working as designed

## Conclusion

**ONE CRITICAL BUG FOUND:**
- Earnings withdrawals use exchange rate 1.0 for all countries
- Nigerian users (98% of user base) lose 99.94% of withdrawal value
- 5 pending withdrawals need immediate recalculation
- Historical approved/completed withdrawals may be affected

**ALL OTHER CURRENCY FLOWS WORKING CORRECTLY**

## Next Steps (In Order)

1. **URGENT: Halt all withdrawal approvals**
2. **Create country-specific exchange rates system**
3. **Update withdrawal function to use correct rates**
4. **Recalculate pending withdrawals**
5. **Audit completed withdrawals**
6. **Deploy fix and resume withdrawals**
7. **Implement monitoring and alerts**

---

**Investigation Status:** COMPLETE
**Critical Issues:** 1
**Ready for Implementation:** YES
**Estimated Fix Time:** 2-3 hours
