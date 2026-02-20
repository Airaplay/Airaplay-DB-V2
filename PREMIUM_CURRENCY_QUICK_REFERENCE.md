# Premium Currency Exception - Quick Reference

## Quick Facts

| Currency | Minimum USD Equivalent | Minimum Local Amount | Status |
|----------|----------------------|---------------------|---------|
| GBP      | $0.10               | ~£0.08              | ✅ Premium |
| EUR      | $0.10               | ~€0.09              | ✅ Premium |
| USD      | $1.00               | $1.00               | Standard |
| NGN      | $1.00               | ~₦1,000             | Standard |
| All Others | $1.00             | Varies              | Standard |

## Fast Deploy

```bash
# Deploy edge function with premium currency support
npx supabase functions deploy process-payment

# Monitor premium transactions
npx supabase functions logs process-payment --filter "Premium Currency" --tail
```

## Quick Test

### Test GBP (Should Work)
```javascript
// Payment amount: £0.50
// Exchange rate: 1.30
// USD equivalent: $0.38
// Expected: ✅ SUCCESS (Premium exception applies)
```

### Test EUR (Should Work)
```javascript
// Payment amount: €0.50
// Exchange rate: 1.09
// USD equivalent: $0.46
// Expected: ✅ SUCCESS (Premium exception applies)
```

### Test NGN (Should Fail)
```javascript
// Payment amount: ₦800
// Exchange rate: 1000
// USD equivalent: $0.80
// Expected: ❌ FAIL (Minimum $1.00 USD required)
```

## Validation Logic

```typescript
// Premium currencies (exception applies)
const premiumCurrencies = ['GBP', 'EUR'];

// Minimum check
const minimumUSD = isPremiumCurrency ? 0.10 : 1.00;
```

## Database Query

### View All Premium Transactions
```sql
SELECT
  u.email,
  tp.amount || ' ' || tp.currency as local_amount,
  '$' || tp.amount_usd as usd_equivalent,
  tp.detected_country,
  tp.status,
  tp.created_at
FROM treat_payments tp
JOIN users u ON u.id = tp.user_id
WHERE tp.currency IN ('GBP', 'EUR')
  AND tp.amount_usd < 1.00
ORDER BY tp.created_at DESC
LIMIT 20;
```

### Today's Premium Stats
```sql
SELECT
  currency,
  COUNT(*) as count,
  '$' || ROUND(SUM(amount_usd)::numeric, 2) as total_usd,
  '$' || ROUND(AVG(amount_usd)::numeric, 2) as avg_usd
FROM treat_payments
WHERE currency IN ('GBP', 'EUR')
  AND amount_usd < 1.00
  AND DATE(created_at) = CURRENT_DATE
  AND status = 'completed'
GROUP BY currency;
```

## Security Checks

### Detect Abuse (10+ small transactions in 24h)
```sql
SELECT
  u.email,
  COUNT(*) as transaction_count,
  SUM(tp.amount_usd) as total_usd
FROM treat_payments tp
JOIN users u ON u.id = tp.user_id
WHERE tp.currency IN ('GBP', 'EUR')
  AND tp.amount_usd < 1.00
  AND tp.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY u.email
HAVING COUNT(*) > 10
ORDER BY COUNT(*) DESC;
```

## Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "Amount must be at least $1.00 USD equivalent" | Non-premium currency under $1 | Use larger package or premium currency |
| "Amount must be at least $0.10 USD equivalent" | GBP/EUR under $0.10 | Use larger package |
| "Payment gateway not properly configured" | Missing API keys | Check admin payment settings |

## Support Script

When user reports payment issue:

```bash
# 1. Check user's last payment attempt
SELECT * FROM treat_payments
WHERE user_id = '<user-id>'
ORDER BY created_at DESC LIMIT 1;

# 2. Check if premium currency was detected
# Look for: currency = 'GBP' or 'EUR'

# 3. Check USD equivalent
# If currency IN ('GBP','EUR') and amount_usd < 1.00:
#   Should be allowed (premium exception)
# Else if amount_usd < 1.00:
#   Should be blocked (standard minimum)

# 4. Check edge function logs
npx supabase functions logs process-payment --filter "<user-email>"
```

## Adding New Premium Currency

1. Edit `supabase/functions/_shared/validation.ts`:
```typescript
const premiumCurrencies = ['GBP', 'EUR', 'NEW_CURRENCY'];
```

2. Edit `supabase/functions/process-payment/index.ts`:
```typescript
const premiumCurrencies = ['GBP', 'EUR', 'NEW_CURRENCY'];
```

3. Deploy:
```bash
npx supabase functions deploy process-payment
```

4. Test thoroughly!

## Monitoring Dashboard Query

```sql
-- Premium Currency Performance (Last 7 Days)
SELECT
  DATE(created_at) as date,
  currency,
  COUNT(*) as transactions,
  COUNT(CASE WHEN amount_usd < 1.00 THEN 1 END) as premium_exceptions,
  ROUND((COUNT(CASE WHEN amount_usd < 1.00 THEN 1 END)::numeric / COUNT(*)::numeric * 100), 1) || '%' as exception_rate,
  '$' || ROUND(SUM(amount_usd)::numeric, 2) as total_revenue,
  '$' || ROUND(AVG(amount_usd)::numeric, 2) as avg_transaction
FROM treat_payments
WHERE currency IN ('GBP', 'EUR')
  AND status = 'completed'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), currency
ORDER BY date DESC, currency;
```

## Troubleshooting

### GBP/EUR Payment Blocked (Should Work)
1. ✓ Check currency is uppercase (GBP/EUR not gbp/eur)
2. ✓ Check amount_usd >= 0.10
3. ✓ Check exchange_rate is valid (> 0)
4. ✓ Verify edge function deployed
5. ✓ Check edge function logs for validation errors

### Other Currency Allowed Under $1 (Should Not Work)
1. ✗ Check validation is running
2. ✗ Verify currency code is not in premiumCurrencies array
3. ✗ Check edge function is latest version
4. ✗ Review edge function logs for bypass

## Files to Remember
- `supabase/functions/_shared/validation.ts` - Validation logic
- `supabase/functions/process-payment/index.ts` - Payment processing
- `GBP_EUR_PAYMENT_EXCEPTION.md` - Full documentation
