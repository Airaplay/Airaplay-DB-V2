# Treat Wallet Withdrawal System

## Overview
The Treat Wallet system has been updated to properly track earnings and enforce withdrawal restrictions. Users can only withdraw from earned treats, not from purchased treats.

## Wallet Structure

### Balance Fields
- **balance**: Total funds the user currently has (earned + purchased - spent - withdrawn)
- **total_earned**: Total Treats earned from daily check-ins, referrals, bonuses, or tips (WITHDRAWABLE)
- **total_purchased**: Total Treats purchased with real money (NOT WITHDRAWABLE)
- **total_spent**: Total Treats spent on promotions, tips, etc.
- **total_withdrawn**: Total Treats successfully withdrawn

### Key Formula
```
balance = total_earned + total_purchased - total_spent - total_withdrawn
```

## Withdrawal Rules

### 1. Only Earned Balance is Withdrawable
Users can ONLY withdraw from `total_earned`. Purchased Treats remain in the wallet for spending on platform features (promotions, tips, etc.) but cannot be withdrawn.

### 2. Validation Checks
The system performs the following validations before processing a withdrawal:
- Withdrawal amount must be greater than 0
- Withdrawal amount must meet the minimum withdrawal threshold
- User must have sufficient earned balance
- Withdrawals must be enabled globally
- Balance validation prevents negative values

### 3. Race Condition Protection
- Uses row-level locking (`FOR UPDATE`) to prevent concurrent withdrawals
- Atomic transaction ensures all wallet updates happen together or not at all
- Failed withdrawals don't affect wallet state

## Database Functions

### `process_treat_withdrawal(user_id, treats_amount)`
Processes a withdrawal request with the following steps:
1. Validates withdrawal settings and amount
2. Locks the wallet row to prevent race conditions
3. Checks if user has sufficient earned balance
4. Calculates USD amount based on conversion rate
5. Applies fees (percentage + fixed)
6. Updates wallet balances atomically
7. Creates transaction log entry
8. Returns detailed result with net amount

### `add_treat_balance(user_id, amount, transaction_type, description, reference_id)`
Adds or deducts treats from user wallet with proper tracking:

**Earning Transaction Types** (update total_earned):
- `earn`
- `daily_checkin`
- `referral_bonus`
- `tip_received`
- `bonus`
- `reward`

**Purchase Transaction Types** (update total_purchased):
- `purchase`
- `deposit`

**Spending Transaction Types** (negative amounts, update total_spent):
- `spend`
- `tip_sent`
- `promotion_payment`

## UI Components

### TreatWalletCard
Displays:
- Current balance (total available treats)
- Total Earned card (withdrawable balance)
- Total Spent card
- Action buttons for Purchase, Treat, Promote, and Withdraw

### TreatWithdrawalModal
Features:
- Shows total balance and earned balance separately
- Highlights earned balance as "Withdrawable"
- Displays purchased and withdrawn amounts
- Preset percentage buttons (25%, 50%, 75%, MAX)
- MAX button sets amount to total_earned, not total balance
- Real-time conversion preview showing USD amount and fees
- Validation prevents withdrawal of more than earned balance
- Success animation with net amount transferred

## Error Handling

### Common Error Messages
1. **Insufficient earned balance**: User tried to withdraw more than they've earned
2. **Insufficient balance**: Total balance is lower than withdrawal amount (safety check)
3. **Withdrawal amount too small**: After fees, the net amount would be zero or negative
4. **Withdrawals disabled**: System-wide withdrawal feature is turned off
5. **Below minimum**: Withdrawal amount is below the configured minimum

### Transaction Safety
- All database operations are wrapped in error handlers
- Failed transactions return error messages without affecting wallet state
- Comprehensive logging for audit trail
- Balance validation at multiple checkpoints

## Example Scenarios

### Scenario 1: Pure Earned Balance
```
Initial State:
- total_earned: 1000
- total_purchased: 0
- balance: 1000

Withdraw 500 treats:
✓ Success - Has sufficient earned balance

Result:
- total_earned: 500
- total_purchased: 0
- total_withdrawn: 500
- balance: 500
```

### Scenario 2: Mixed Balance
```
Initial State:
- total_earned: 500
- total_purchased: 1000
- balance: 1500

Attempt to withdraw 800 treats:
✗ Failed - Only 500 earned treats available

Withdraw 300 treats:
✓ Success - Within earned balance

Result:
- total_earned: 200
- total_purchased: 1000
- total_withdrawn: 300
- balance: 1200
```

### Scenario 3: All Purchased
```
Initial State:
- total_earned: 0
- total_purchased: 2000
- balance: 2000

Attempt to withdraw any amount:
✗ Failed - No earned balance available
Note: Purchased treats cannot be withdrawn
```

## Admin Configuration

### Withdrawal Settings
Admins can configure:
- `is_withdrawal_enabled`: Enable/disable withdrawals globally
- `minimum_withdrawal_amount`: Minimum treats required to withdraw
- `withdrawal_fee_percentage`: Percentage fee (e.g., 2.5%)
- `withdrawal_fee_fixed`: Fixed fee in USD (e.g., $0.50)
- `treat_to_usd_rate`: Conversion rate (e.g., 0.01 = 1 treat = $0.01)

## Security Features

1. **Row-Level Locking**: Prevents concurrent modification of the same wallet
2. **SECURITY DEFINER**: Functions run with elevated privileges for proper access
3. **Balance Validation**: Multiple checks ensure balances never go negative
4. **Transaction Logging**: Every withdrawal is logged with full details
5. **Atomic Operations**: All wallet updates happen together or are rolled back
6. **Input Validation**: Comprehensive validation of all inputs

## Testing Checklist

- [ ] User can withdraw earned balance successfully
- [ ] User cannot withdraw more than earned balance
- [ ] User cannot withdraw purchased balance
- [ ] Minimum withdrawal amount is enforced
- [ ] Fees are calculated correctly
- [ ] Concurrent withdrawals are handled safely
- [ ] Failed withdrawals don't affect wallet state
- [ ] Transaction logs are created correctly
- [ ] UI shows correct earned vs total balance
- [ ] MAX button uses earned balance, not total balance
