# GBP/EUR Premium Currency Payment Exception

## Overview
The payment system now includes a special exception for GBP (British Pounds) and EUR (Euros) transactions, allowing purchases even when the USD equivalent is less than $1.

## Business Rule

### Standard Minimum
- **All currencies:** Minimum payment of **$1.00 USD equivalent**

### Premium Currency Exception
- **GBP and EUR only:** Minimum payment of **$0.10 USD equivalent**

This means:
- A user in the UK can pay as little as **£0.10** (approximately $0.13 USD)
- A user in the EU can pay as little as **€0.10** (approximately $0.11 USD)
- All other currencies must maintain the $1.00 USD minimum

## Why This Exception?

### 1. Premium Currency Purchasing Power
GBP and EUR are strong currencies with high purchasing power. A small amount in these currencies can represent significant value.

### 2. Lower Payment Gateway Fees
Payment gateways typically charge lower percentage fees for GBP/EUR transactions in their native regions, making smaller transactions viable.

### 3. Competitive Pricing
Allowing smaller amounts makes the platform more competitive in UK and EU markets where users expect flexible pricing.

### 4. Market Strategy
This exception enables micro-transactions in high-value markets while maintaining revenue protection in other regions.

## Technical Implementation

### Edge Function Validation
**File:** `supabase/functions/_shared/validation.ts`

```typescript
// Special validation for USD equivalent with GBP/EUR exception
if (data.amount && data.exchange_rate && data.currency) {
  const amountUSD = data.exchange_rate > 0 ? data.amount / exchange_rate : data.amount;
  const premiumCurrencies = ['GBP', 'EUR'];
  const isPremiumCurrency = premiumCurrencies.includes(data.currency.toUpperCase());

  // For GBP and EUR, allow amounts less than $1 USD (minimum $0.10 USD equivalent)
  // For other currencies, maintain $1 USD minimum
  const minimumUSD = isPremiumCurrency ? 0.10 : 1.00;

  if (amountUSD < minimumUSD) {
    errors.push({
      field: 'amount',
      message: `Amount must be at least $${minimumUSD} USD equivalent`
    });
  }
}
```

### Transaction Logging
**File:** `supabase/functions/process-payment/index.ts`

All GBP/EUR transactions with USD equivalent less than $1 are logged:

```typescript
// Log premium currency transactions (GBP/EUR with USD equivalent < $1)
const premiumCurrencies = ['GBP', 'EUR'];
const isPremiumCurrency = premiumCurrencies.includes(currency.toUpperCase());
if (isPremiumCurrency && amountUSD < 1.00) {
  console.log(`[Premium Currency] ${currency} transaction allowed:`, {
    amount: amount,
    currency: currency,
    amountUSD: amountUSD,
    exchange_rate: exchange_rate,
    user_email: user_email,
    detected_country: detected_country
  });
}
```

## Database Tracking

All transactions are stored in the `treat_payments` table with:
- **amount:** Original amount in local currency (GBP/EUR)
- **currency:** Currency code (GBP/EUR)
- **amount_usd:** USD equivalent (may be less than $1 for GBP/EUR)
- **exchange_rate:** Exchange rate used
- **detected_country:** User's detected country
- **detected_country_code:** Country code (GB/EU countries)

## Example Transactions

### Example 1: UK User
```
User: john@example.co.uk
Country: United Kingdom
Package: 100 Treats for $0.99 USD
Local Price: £0.77 (at exchange rate 1.29)
USD Equivalent: $0.77
Status: ✅ ALLOWED (Premium Currency Exception)
```

### Example 2: EU User
```
User: marie@example.fr
Country: France
Package: 50 Treats for $0.50 USD
Local Price: €0.46 (at exchange rate 1.09)
USD Equivalent: $0.50
Status: ✅ ALLOWED (Premium Currency Exception)
```

### Example 3: Other Currency
```
User: user@example.com
Country: Nigeria
Package: 100 Treats for $0.99 USD
Local Price: ₦990 (at exchange rate 1000)
USD Equivalent: $0.99
Status: ❌ BLOCKED (Minimum $1.00 USD required for non-premium currencies)
```

## Security & Abuse Prevention

### Minimum Floor
Even for GBP/EUR, there's a hard minimum of **$0.10 USD equivalent** (approximately £0.08 or €0.09) to prevent:
- Micro-transaction abuse
- Payment gateway fee exploitation
- System performance issues from excessive tiny transactions

### Transaction Monitoring
All premium currency transactions are logged and can be monitored:

```sql
-- View all GBP/EUR transactions under $1 USD
SELECT
  u.email,
  tp.amount,
  tp.currency,
  tp.amount_usd,
  tp.detected_country,
  tp.created_at
FROM treat_payments tp
JOIN users u ON u.id = tp.user_id
WHERE tp.currency IN ('GBP', 'EUR')
  AND tp.amount_usd < 1.00
  AND tp.status = 'completed'
ORDER BY tp.created_at DESC;
```

### Rate Limiting
Standard rate limiting applies to all transactions regardless of currency to prevent abuse.

## Admin Monitoring

### View Premium Currency Statistics
```sql
SELECT
  DATE(created_at) as date,
  currency,
  COUNT(*) as total_transactions,
  SUM(amount) as total_local_amount,
  SUM(amount_usd) as total_usd_equivalent,
  AVG(amount_usd) as avg_usd_equivalent,
  COUNT(CASE WHEN amount_usd < 1.00 THEN 1 END) as under_1_usd_count
FROM treat_payments
WHERE currency IN ('GBP', 'EUR')
  AND status = 'completed'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), currency
ORDER BY date DESC, currency;
```

### Flag Suspicious Patterns
```sql
-- Users making many small premium currency transactions
SELECT
  u.email,
  tp.currency,
  COUNT(*) as transaction_count,
  SUM(tp.amount_usd) as total_usd,
  AVG(tp.amount_usd) as avg_usd,
  MIN(tp.amount_usd) as min_usd
FROM treat_payments tp
JOIN users u ON u.id = tp.user_id
WHERE tp.currency IN ('GBP', 'EUR')
  AND tp.amount_usd < 1.00
  AND tp.status = 'completed'
  AND tp.created_at >= NOW() - INTERVAL '7 days'
GROUP BY u.email, tp.currency
HAVING COUNT(*) > 10  -- More than 10 small transactions in 7 days
ORDER BY transaction_count DESC;
```

## Testing

### Test GBP Transaction (Under $1 USD)
1. Set user location to United Kingdom
2. User should be detected with GBP currency
3. Select smallest treat package
4. Local price should display in GBP
5. Complete payment even if USD equivalent is less than $1
6. Verify transaction is logged with premium currency flag

### Test EUR Transaction (Under $1 USD)
1. Set user location to France/Germany/Spain
2. User should be detected with EUR currency
3. Select smallest treat package
4. Local price should display in EUR
5. Complete payment even if USD equivalent is less than $1
6. Verify transaction is logged with premium currency flag

### Test Other Currency (Under $1 USD)
1. Set user location to Nigeria/India/Brazil
2. User should be detected with NGN/INR/BRL currency
3. Select treat package under $1 USD
4. Payment should be BLOCKED with error message
5. Error: "Amount must be at least $1.00 USD equivalent"

## Edge Function Logs

When deploying, monitor logs for premium currency transactions:

```bash
npx supabase functions logs process-payment --tail
```

Look for log entries like:
```
[Premium Currency] GBP transaction allowed: {
  amount: 0.77,
  currency: 'GBP',
  amountUSD: 0.77,
  exchange_rate: 1.29,
  user_email: 'user@example.co.uk',
  detected_country: 'United Kingdom'
}
```

## Deployment Steps

### 1. Deploy Edge Function
```bash
npx supabase functions deploy process-payment
```

### 2. Verify Validation Logic
```bash
npx supabase functions logs process-payment --filter "Premium Currency"
```

### 3. Test Transactions
- Test GBP payment under $1 USD
- Test EUR payment under $1 USD
- Test other currency payment under $1 USD (should fail)
- Verify all transactions log correctly

### 4. Monitor for 24 Hours
Watch for:
- Successful GBP/EUR transactions under $1
- Proper rejection of non-premium currencies under $1
- Any abuse patterns or suspicious activity

## Future Considerations

### Adding More Premium Currencies
To add more currencies to the exception (e.g., CHF, AUD, CAD):

1. Update the array in `_shared/validation.ts`:
```typescript
const premiumCurrencies = ['GBP', 'EUR', 'CHF', 'AUD', 'CAD'];
```

2. Update the array in `process-payment/index.ts`:
```typescript
const premiumCurrencies = ['GBP', 'EUR', 'CHF', 'AUD', 'CAD'];
```

3. Redeploy edge function
4. Test thoroughly with each new currency

### Adjusting Minimums
To change the minimum for premium currencies:

Update both files:
```typescript
const minimumUSD = isPremiumCurrency ? 0.10 : 1.00;  // Change 0.10 to desired minimum
```

### Regional Exceptions
If you want different minimums for different regions:
```typescript
const regionMinimums = {
  'GBP': 0.10,
  'EUR': 0.10,
  'CHF': 0.15,
  'AUD': 0.20,
  'CAD': 0.15
};
const minimumUSD = regionMinimums[currency] || 1.00;
```

## Compliance & Legal

### Payment Gateway Requirements
- Paystack: Supports GBP, EUR (minimum per Paystack terms)
- Flutterwave: Supports GBP, EUR (minimum per Flutterwave terms)
- USDT: No minimum restrictions (crypto)

### Transaction Fees
Consider payment gateway fees when setting minimums:
- **Paystack:** 1.5% + £0.15 (UK) or 1.4% + €0.20 (EU)
- **Flutterwave:** 2.9% + £0.20 (UK) or 2.9% + €0.25 (EU)

For a £0.77 transaction:
- Fee: ~£0.15-0.20
- Net: ~£0.57-0.62
- Still profitable for small treat packages

## Support & Troubleshooting

### User Reports "Payment Blocked" in GBP/EUR
1. Check if amount is at least $0.10 USD equivalent
2. Verify currency detection is correct
3. Check edge function logs for validation errors
4. Confirm exchange rate is up to date

### Transaction Not Logging as Premium
1. Verify currency code is uppercase (GBP/EUR)
2. Check if amount_usd is calculated correctly
3. Review edge function logs for premium currency flag
4. Ensure edge function is deployed correctly

### Admin Questions About Revenue Impact
Query total premium currency revenue:
```sql
SELECT
  currency,
  COUNT(*) as transactions,
  SUM(amount_usd) as total_usd,
  AVG(amount_usd) as avg_usd,
  COUNT(CASE WHEN amount_usd < 1.00 THEN 1 END) as under_1_usd
FROM treat_payments
WHERE currency IN ('GBP', 'EUR')
  AND status = 'completed'
  AND created_at >= NOW() - INTERVAL '30 days';
```

## Files Modified
1. `supabase/functions/_shared/validation.ts` - Added GBP/EUR validation exception
2. `supabase/functions/process-payment/index.ts` - Added premium currency logging

## Success Metrics
- GBP/EUR transactions under $1 USD successfully processed
- No non-premium currencies bypassing $1 minimum
- All transactions properly logged with currency details
- Payment gateway fees remain profitable
- No abuse patterns detected
