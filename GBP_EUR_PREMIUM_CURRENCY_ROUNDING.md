# GBP/EUR Premium Currency Rounding System

## Overview

The Premium Currency Rounding System automatically ensures that GBP (British Pounds) and EUR (Euros) purchases maintain a **minimum of 1 unit** (£1.00 or €1.00). When a converted price results in less than 1 unit, the system automatically rounds UP to exactly 1 unit.

## Key Features

### 1. Automatic Rounding Logic
- **Currencies Affected**: GBP and EUR only
- **Rounding Rule**: Any amount less than 1 unit rounds UP to exactly 1 unit
- **Direction**: Always rounds UP, never down
- **Precision**: Maintains 2 decimal places before rounding

### 2. Transparency
- Users see a clear notice when rounding is applied
- Original converted amount is shown alongside rounded amount
- All rounded transactions are logged in the database

### 3. Database Tracking
- Every rounded transaction is logged in `premium_currency_rounding_log` table
- Includes original amount, rounded amount, USD equivalent, and user info
- Provides audit trail and reporting capabilities

## Implementation Details

### Core Function: `applyPremiumCurrencyRounding()`

**Location**: `/src/lib/currencyDetection.ts`

```typescript
const applyPremiumCurrencyRounding = (
  amount: number,
  currencyCode: string
): { amount: number; wasRounded: boolean } => {
  const isPremiumCurrency = ['GBP', 'EUR'].includes(currencyCode);

  if (isPremiumCurrency && amount < 1.00) {
    return { amount: 1.00, wasRounded: true };
  }

  return { amount, wasRounded: false };
};
```

### Conversion Functions

#### `convertAmount()` - Standard Conversion
Returns only the final converted amount (with rounding applied):
```typescript
const price = convertAmount(1.00, GBP_CURRENCY);
// Returns: 1.00 (even if conversion was 0.79)
```

#### `convertAmountWithRoundingInfo()` - Detailed Conversion
Returns amount plus rounding metadata:
```typescript
const info = convertAmountWithRoundingInfo(1.00, GBP_CURRENCY);
// Returns: {
//   amount: 1.00,
//   wasRounded: true,
//   originalAmount: 0.79
// }
```

## Example Conversions

### GBP (British Pounds)
Exchange Rate: 0.79 GBP = 1 USD

| USD Amount | Calculated GBP | Final GBP | Rounding Applied |
|------------|---------------|-----------|------------------|
| $1.00      | £0.79         | £1.00     | ✓ Yes            |
| $1.50      | £1.19         | £1.19     | ✗ No             |
| $2.00      | £1.58         | £1.58     | ✗ No             |
| $0.50      | £0.40         | £1.00     | ✓ Yes            |

### EUR (Euros)
Exchange Rate: 0.92 EUR = 1 USD

| USD Amount | Calculated EUR | Final EUR | Rounding Applied |
|------------|---------------|-----------|------------------|
| $1.00      | €0.92         | €1.00     | ✓ Yes            |
| $1.50      | €1.38         | €1.38     | ✗ No             |
| $2.00      | €1.84         | €1.84     | ✗ No             |
| $0.50      | €0.46         | €1.00     | ✓ Yes            |

### Other Currencies (No Rounding)
NGN (Nigerian Naira) - Exchange Rate: 1650 NGN = 1 USD

| USD Amount | Calculated NGN | Final NGN | Rounding Applied |
|------------|---------------|-----------|-------------------|
| $1.00      | ₦1,650.00     | ₦1,650.00 | ✗ No              |
| $0.50      | ₦825.00       | ₦825.00   | ✗ No              |

## User Interface

### Rounding Notice Display

When rounding is applied, users see:

```
ℹ️ Minimum Purchase Applied

Converted price was £0.79, rounded up to £1.00
minimum for GBP purchases.
```

The notice appears:
- In a blue-themed info box
- Below the currency detection notice
- Above the "About Treats" section
- Only when rounding actually applies

## Database Schema

### Table: `premium_currency_rounding_log`

```sql
CREATE TABLE premium_currency_rounding_log (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  payment_id uuid REFERENCES treat_payments(id),
  currency_code text CHECK (currency_code IN ('GBP', 'EUR')),
  original_amount numeric(10, 2) CHECK (original_amount < 1.00),
  rounded_amount numeric(10, 2) DEFAULT 1.00,
  usd_amount numeric(10, 2),
  created_at timestamptz DEFAULT now()
);
```

### Helper Function: `log_premium_currency_rounding()`

```sql
SELECT log_premium_currency_rounding(
  p_user_id := 'user-uuid',
  p_payment_id := 'payment-uuid',
  p_currency_code := 'GBP',
  p_original_amount := 0.79,
  p_usd_amount := 1.00
);
```

## Testing Guide

### Test Case 1: GBP Rounding Applied
```typescript
// Given: User in UK, $1 package
const currency = CURRENCIES.GBP; // 0.79 exchange rate
const usdPrice = 1.00;

// When: Convert price
const result = convertAmountWithRoundingInfo(usdPrice, currency);

// Then: Should round up to £1.00
expect(result.amount).toBe(1.00);
expect(result.wasRounded).toBe(true);
expect(result.originalAmount).toBe(0.79);
```

### Test Case 2: EUR Rounding Applied
```typescript
// Given: User in Germany, $1 package
const currency = CURRENCIES.EUR; // 0.92 exchange rate
const usdPrice = 1.00;

// When: Convert price
const result = convertAmountWithRoundingInfo(usdPrice, currency);

// Then: Should round up to €1.00
expect(result.amount).toBe(1.00);
expect(result.wasRounded).toBe(true);
expect(result.originalAmount).toBe(0.92);
```

### Test Case 3: GBP No Rounding Needed
```typescript
// Given: User in UK, $2 package
const currency = CURRENCIES.GBP; // 0.79 exchange rate
const usdPrice = 2.00;

// When: Convert price
const result = convertAmountWithRoundingInfo(usdPrice, currency);

// Then: Should not round (1.58 > 1.00)
expect(result.amount).toBe(1.58);
expect(result.wasRounded).toBe(false);
expect(result.originalAmount).toBeUndefined();
```

### Test Case 4: Other Currency (NGN) No Rounding
```typescript
// Given: User in Nigeria, $1 package
const currency = CURRENCIES.NGN; // 1650 exchange rate
const usdPrice = 1.00;

// When: Convert price
const result = convertAmountWithRoundingInfo(usdPrice, currency);

// Then: Should not round (NGN not premium currency)
expect(result.amount).toBe(1650.00);
expect(result.wasRounded).toBe(false);
expect(result.originalAmount).toBeUndefined();
```

## Analytics & Reporting

### View Rounding Statistics
```sql
SELECT * FROM premium_currency_rounding_stats
ORDER BY date DESC;
```

Returns daily statistics:
- Total roundings per currency
- Average original amount before rounding
- Min/max original amounts
- Total amount added through rounding
- Number of unique users affected

### View Individual Rounding Logs
```sql
SELECT
  pcrl.currency_code,
  pcrl.original_amount,
  pcrl.rounded_amount,
  pcrl.usd_amount,
  u.email,
  pcrl.created_at
FROM premium_currency_rounding_log pcrl
JOIN users u ON u.id = pcrl.user_id
WHERE pcrl.currency_code = 'GBP'
ORDER BY pcrl.created_at DESC
LIMIT 50;
```

### User-Specific Rounding History
```sql
SELECT
  currency_code,
  original_amount,
  rounded_amount,
  usd_amount,
  created_at
FROM premium_currency_rounding_log
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC;
```

## Edge Function Integration

The `process-payment` edge function already validates GBP/EUR minimum amounts:

```typescript
// Validation allows GBP/EUR minimum of $0.10 USD equivalent
const minimumUSD = isPremiumCurrency ? 0.10 : 1.00;
```

This ensures:
1. Frontend: Rounds to minimum 1 unit (£1.00/€1.00)
2. Backend: Validates minimum $0.10 USD equivalent
3. Result: £1.00 ≈ $1.27 USD ✓ (passes $0.10 minimum)
4. Result: €1.00 ≈ $1.09 USD ✓ (passes $0.10 minimum)

## Security Considerations

1. **RLS Policies**: Users can only view their own rounding logs
2. **Input Validation**: Currency codes restricted to GBP/EUR
3. **Amount Constraints**: Original amount must be < 1.00
4. **Service Role**: Only authenticated requests can log roundings
5. **Audit Trail**: All roundings permanently logged for compliance

## Troubleshooting

### Issue: Rounding notice not showing
**Check:**
- Is currency GBP or EUR?
- Is converted amount actually < 1.00?
- Is `getConvertedPriceWithRoundingInfo()` being called?

### Issue: Wrong amount displayed
**Check:**
- Currency exchange rates in `CURRENCIES` object
- Math.round precision (should be 100x for 2 decimals)
- State updates in `useEffect` hooks

### Issue: Database logs not created
**Check:**
- RLS policies enabled for authenticated users
- Function has proper permissions
- Payment ID is valid UUID if provided

## Future Enhancements

Possible improvements:
1. Add more premium currencies (CHF, SEK, DKK, etc.)
2. Configurable minimum amounts per currency
3. Admin dashboard for rounding analytics
4. Email notifications for users when rounding applied
5. Bulk export of rounding data for accounting

## Summary

The GBP/EUR Premium Currency Rounding System provides:
- ✓ Automatic minimum 1 unit enforcement
- ✓ Clear user communication
- ✓ Complete transaction logging
- ✓ Flexible reporting capabilities
- ✓ Secure and auditable implementation

All GBP and EUR transactions maintain professional minimum purchase amounts while providing full transparency to users.
