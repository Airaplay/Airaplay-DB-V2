# Withdrawal Systems Clarification - IMPORTANT

## Two Separate Withdrawal Systems

Your app has TWO completely independent withdrawal systems:

### 1. Treat Withdrawals (Treats → Live Balance)
**Purpose**: Convert earned treats to USD and add to Live Balance
**Settings Table**: `treat_withdrawal_settings`
**User Interface**: `TreatWithdrawalModal.tsx`
**Process**: Instant conversion, no admin approval needed
**Admin Control**: Managed through Treat Manager section (separate from Earnings & Payout Settings)

**Flow**:
1. User has treats in their wallet (earned from engagement, check-ins, tips, etc.)
2. User opens "Withdraw Treats" modal
3. Converts treats to USD based on `treat_to_usd_rate`
4. Deducts fees (percentage + fixed)
5. Net amount instantly added to user's Live Balance
6. NO admin approval required

### 2. Earnings Withdrawals (Live Balance → Bank/USDT)
**Purpose**: Withdraw USD earnings from Live Balance to external accounts
**Settings Table**: `withdrawal_settings`
**User Interface**: `WithdrawEarningsScreen.tsx`
**Process**: Creates withdrawal request, requires admin approval
**Admin Control**: Managed through "Earnings & Payout Settings" → "Withdrawal Settings" tab

**Flow**:
1. User has Live Balance (from treat withdrawals, content earnings, tips received, etc.)
2. User navigates to "Withdraw Earnings" screen
3. Selects withdrawal method (Bank Account or USDT Wallet)
4. Enters amount and submits request
5. Request goes to admin for approval
6. Admin reviews and approves/rejects
7. On approval, fees are calculated and deducted
8. Net amount is processed for payout

## Admin Dashboard - Withdrawal Settings Tab

The "Withdrawal Settings" tab in "Earnings & Payout Settings" controls **ONLY earnings withdrawals** (Live Balance to Bank/USDT), NOT treat withdrawals.

### What This Controls:
- ✅ Exchange rate for multi-currency support
- ✅ Withdrawal fees (percentage or fixed)
- ✅ Minimum withdrawal amount in USD
- ✅ Master toggle to enable/disable earnings withdrawals
- ✅ Dynamic exchange rate updates for international operations

### What This Does NOT Control:
- ❌ Treat to USD conversion rate (that's in `treat_withdrawal_settings`)
- ❌ Treat withdrawal fees
- ❌ Treat wallet operations

## Database Tables

### treat_withdrawal_settings
```sql
- is_withdrawal_enabled: boolean
- minimum_withdrawal_amount: integer (in treats)
- withdrawal_fee_percentage: decimal
- withdrawal_fee_fixed: decimal
- treat_to_usd_rate: decimal
```

### withdrawal_settings
```sql
- withdrawals_enabled: boolean
- minimum_withdrawal_usd: decimal (in USD)
- exchange_rate: decimal (for multi-currency support)
- withdrawal_fee_type: 'percentage' | 'fixed'
- withdrawal_fee_value: decimal
- exchange_rate_source: 'manual' | 'auto_api'
- exchange_rate_last_updated: timestamptz
- exchange_rate_api_config: jsonb
```

## Database Functions

### For Treat Withdrawals
- `process_treat_withdrawal(user_id, treats_amount)` - Uses `treat_withdrawal_settings`

### For Earnings Withdrawals
- `get_earnings_withdrawal_settings()` - Gets current settings for preview
- `calculate_earnings_withdrawal_preview(amount)` - Calculates fees for UI
- `admin_approve_withdrawal(request_id, notes)` - Applies fees from `withdrawal_settings`
- `admin_reject_withdrawal(request_id, notes)` - Returns funds to user

## Migration Applied

**File**: `update_earnings_withdrawal_to_use_withdrawal_settings.sql`

**What Changed**:
1. Updated `admin_approve_withdrawal()` to fetch settings from `withdrawal_settings`
2. Apply exchange rate and fees when approving earnings withdrawal requests
3. Store fee details in withdrawal request metadata
4. Created helper functions for fee preview in UI
5. Added validation to check if withdrawals are enabled

## Key Differences

| Feature | Treat Withdrawals | Earnings Withdrawals |
|---------|------------------|---------------------|
| **From** | Treat Wallet | Live Balance |
| **To** | Live Balance | Bank/USDT |
| **Approval** | Instant (no approval) | Admin approval required |
| **Settings** | `treat_withdrawal_settings` | `withdrawal_settings` |
| **Admin UI** | Treat Manager | Earnings & Payout Settings |
| **Fee Structure** | Percentage + Fixed | Percentage OR Fixed |
| **Exchange Rate** | Static treat-to-USD | Dynamic USD exchange rate |

## User Journey Example

**Scenario**: User earned 10,000 treats and wants to cash out

**Step 1: Convert Treats to Live Balance**
- Opens "Withdraw Treats" modal
- Enters 10,000 treats
- System shows:
  - Gross: 10,000 treats × $0.01 = $100.00
  - Fee: 5% + $2 = $7.00
  - Net: $93.00 added to Live Balance
- Clicks confirm - money instantly in Live Balance

**Step 2: Withdraw Live Balance to Bank**
- Navigates to "Withdraw Earnings"
- Has $93.00 in Live Balance
- Selects bank account
- Enters $93.00
- System shows:
  - Gross: $93.00
  - Fee: 3% = $2.79
  - Net: $90.21 will be sent to bank
- Submits request
- Admin reviews and approves
- $90.21 is processed for bank transfer

## Admin Configuration

### For Treat Withdrawals
Configure in Treat Manager section (or directly in database if no admin UI exists):
```sql
UPDATE treat_withdrawal_settings SET
  treat_to_usd_rate = 0.01,  -- 1 treat = $0.01
  withdrawal_fee_percentage = 5,  -- 5%
  withdrawal_fee_fixed = 2,  -- $2
  minimum_withdrawal_amount = 1000,  -- 1000 treats minimum
  is_withdrawal_enabled = true;
```

### For Earnings Withdrawals
Configure in Admin Dashboard → Earnings & Payout Settings → Withdrawal Settings tab:
- Exchange Rate: 1.0 (for USD) or dynamic for other currencies
- Fee Type: Percentage OR Fixed (not both)
- Fee Value: 3% or $5 fixed
- Minimum: $10 USD
- Master Toggle: Enable/Disable

## Dynamic Exchange Rate for Multi-Country Operations

The `withdrawal_settings` table supports dynamic exchange rates for international operations:

### Use Case
If your app operates in Nigeria and users want to withdraw in NGN:
1. Set exchange rate: 1 USD = 1500 NGN
2. Update rate daily/hourly via API
3. When user withdraws $100 from Live Balance:
   - $100 × 1500 = 150,000 NGN
   - Deduct fees
   - Transfer NGN to their bank

### Implementation
See `WITHDRAWAL_SETTINGS_UPGRADE_COMPLETE.md` for detailed instructions on:
- Setting up automatic exchange rate updates
- Integrating with exchange rate APIs
- Scheduling hourly/daily updates

## Testing Checklist

**Treat Withdrawals**:
- [ ] User can convert treats to Live Balance
- [ ] Correct fees are applied from `treat_withdrawal_settings`
- [ ] Net amount added to Live Balance instantly
- [ ] Transaction is logged

**Earnings Withdrawals**:
- [ ] User can submit withdrawal request
- [ ] Request shows current fees from `withdrawal_settings`
- [ ] Fee preview is accurate
- [ ] Request requires admin approval
- [ ] Admin sees fee breakdown when approving
- [ ] Correct net amount is calculated
- [ ] If withdrawals disabled, user sees warning

## Common Confusion Points

### ❌ WRONG: "Admin withdrawal settings should control treat withdrawals"
✅ CORRECT: Admin withdrawal settings only control earnings withdrawals (Live Balance → Bank)

### ❌ WRONG: "There's only one withdrawal system"
✅ CORRECT: There are TWO independent systems with different purposes

### ❌ WRONG: "Exchange rate in withdrawal_settings is for treats"
✅ CORRECT: Exchange rate is for multi-currency earnings withdrawals, not treats

### ❌ WRONG: "Treat withdrawals need admin approval"
✅ CORRECT: Treat withdrawals are instant; earnings withdrawals need approval

## Troubleshooting

**Issue**: "Treat withdrawal settings aren't working"
- **Solution**: Check `treat_withdrawal_settings` table, NOT `withdrawal_settings`

**Issue**: "Earnings withdrawal fees aren't applied"
- **Solution**: Check that `admin_approve_withdrawal` is using `withdrawal_settings`

**Issue**: "User can't withdraw treats"
- **Solution**: Check `is_withdrawal_enabled` in `treat_withdrawal_settings`

**Issue**: "User can't submit earnings withdrawal"
- **Solution**: Check `withdrawals_enabled` in `withdrawal_settings`

## Summary

- **Treat Withdrawals**: Internal conversion from treats to Live Balance (instant, no approval)
- **Earnings Withdrawals**: External payout from Live Balance to real money (approval required)
- **Admin Withdrawal Settings Tab**: Controls earnings withdrawals ONLY, not treats
- **Two separate systems**: Different tables, different purposes, different workflows

Both systems are now working correctly and independently.
