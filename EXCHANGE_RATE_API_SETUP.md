# Exchange Rate API Integration Setup

## Overview

The Exchange Rate Management section in the Admin Dashboard now integrates with exchangerate-api.com to fetch real-time currency exchange rates automatically.

## Features

1. **One-Click Sync**: Click the "Sync from API" button to fetch the latest rates from exchangerate-api.com
2. **Automatic Updates**: All exchange rates are updated with current market data (USD as base currency)
3. **Audit Trail**: Every API sync creates history entries with timestamps and notes
4. **Supported Currencies**: 20+ currencies including NGN, GHS, KES, ZAR, GBP, EUR, CAD, AUD, INR, BRL, and more
5. **Visual Feedback**: Loading states and success/error notifications

## Setup Instructions

### Step 1: Get Your API Key

1. Go to [exchangerate-api.com](https://www.exchangerate-api.com/)
2. Sign up for a free account (1,500 requests/month free tier)
3. Copy your API key from the dashboard

### Step 2: Configure Supabase Secret

The API key needs to be configured as a Supabase secret:

1. Go to your Supabase dashboard
2. Navigate to Project Settings → Edge Functions
3. Add a new secret:
   - **Name**: `EXCHANGERATE_API_KEY`
   - **Value**: Your API key from exchangerate-api.com

Alternatively, use the Supabase CLI:

```bash
supabase secrets set EXCHANGERATE_API_KEY=your_api_key_here
```

## How It Works

### Automatic Hourly Sync

The system automatically syncs exchange rates every hour:
- **Schedule**: Runs at minute 0 of every hour (1:00, 2:00, 3:00, etc.)
- **Edge Function**: `auto-sync-exchange-rates`
- **Rate Adjustment**: Automatically applies 6% reduction to all rates
- **Logging**: Full audit trail of all sync operations
- **No Manual Intervention**: Runs completely automatically

### Edge Functions

**1. `auto-sync-exchange-rates` (Automated)**
- Triggered by cron job every hour
- Fetches latest rates from exchangerate-api.com API
- Applies 6% reduction buffer (multiplies by 0.94)
- Updates all supported currencies in database
- Logs success/error counts

**2. `fetch-exchange-rates` (Manual)**
- Available for manual sync via Admin Dashboard
- Same functionality as auto-sync
- Provides immediate rate updates when needed

### Admin Dashboard Integration

The Exchange Rates Management section:
- Displays a "Sync from API" button
- Shows info banner about the API integration
- Syncs rates by calling the edge function
- Maps currency codes to country codes automatically
- Updates all matching rates in the database
- Shows success count and any errors
- Records all updates in the rate history

### Currency Mapping

The system automatically maps these currency codes to countries:

| Currency | Country Code | Country |
|----------|--------------|---------|
| NGN | NG | Nigeria |
| GHS | GH | Ghana |
| KES | KE | Kenya |
| ZAR | ZA | South Africa |
| EGP | EG | Egypt |
| GBP | GB | United Kingdom |
| EUR | DE | Germany (Euro) |
| USD | US | United States |
| CAD | CA | Canada |
| AUD | AU | Australia |
| NZD | NZ | New Zealand |
| INR | IN | India |
| PKR | PK | Pakistan |
| BRL | BR | Brazil |
| ARS | AR | Argentina |
| MXN | MX | Mexico |
| JPY | JP | Japan |
| CNY | CN | China |
| SGD | SG | Singapore |

## Usage

### Automatic Sync (Recommended)

Rates are automatically synced every hour at minute 0:
- **1:00 AM** - Auto-sync runs
- **2:00 AM** - Auto-sync runs
- **3:00 AM** - Auto-sync runs
- ... and so on every hour

No manual intervention needed!

### Manual Sync (Optional)

For immediate updates outside the hourly schedule:

1. Log into the Admin Dashboard
2. Navigate to "Exchange Rates Management"
3. Click "Sync from API" button
4. Wait for sync to complete (usually 5-10 seconds)
5. Review the success message showing how many rates were updated
6. Check the rate history to see the updates

### Manual Rate Override

Even after API sync, admins can still manually edit rates:
1. Click the edit icon next to any rate
2. Enter the new rate value
3. Optionally add notes explaining the change
4. Click save

All changes are tracked in the rate history.

## API Rate Limits

### Free Tier (1,500 requests/month)
- ~50 requests per day
- Sufficient for daily manual syncs

### Pro Tier ($9.99/month - 100,000 requests/month)
- For automated hourly/daily syncs
- Recommended for production use

## Benefits

1. **Accuracy**: Real-time market rates updated every hour
2. **Automation**: No manual intervention required
3. **Consistency**: All rates updated from single source
4. **Transparency**: Complete audit trail of rate changes
5. **Efficiency**: Bulk update in seconds vs manual entry
6. **Reliability**: Professional API service with 99.9% uptime
7. **Protection**: 6% buffer protects against currency volatility

## Troubleshooting

### "EXCHANGERATE_API_KEY not configured" error
- Ensure the secret is set in Supabase
- Verify the secret name is exactly `EXCHANGERATE_API_KEY`
- Redeploy the edge function after adding the secret

### "Failed to fetch rates from API" error
- Check your API key is valid
- Verify you haven't exceeded rate limits
- Check exchangerate-api.com service status

### Some rates not updating
- Ensure the currency is in the supported list
- Check the currency-to-country mapping in the code
- Verify the country exists in your database

## Automated Features

- ✅ **Automatic hourly syncs** - Implemented
- ✅ **6% rate reduction buffer** - Implemented
- ✅ **Complete audit trail** - Implemented
- ✅ **Error logging and monitoring** - Implemented

## Future Enhancements

- Rate change alerts when rates fluctuate significantly
- Support for additional API providers (Fixer, CurrencyAPI)
- Rate volatility tracking and reporting
- Automated email notifications on sync completion
- Admin dashboard sync status monitoring

## Monitoring

To check if auto-sync is working:

1. View the rate history in Admin Dashboard
2. Look for entries with notes like "Auto-synced via exchangerate-api.com"
3. Check timestamps - should show hourly updates
4. Review the "Last Updated" column in the rates table

## Troubleshooting Auto-Sync

If rates are not updating automatically:

1. **Check cron job status**:
   - Query: `SELECT * FROM cron.job WHERE jobname = 'auto-sync-exchange-rates-hourly';`
   - Verify it's active and scheduled correctly

2. **Check recent runs**:
   - Query: `SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-sync-exchange-rates-hourly') ORDER BY start_time DESC LIMIT 10;`
   - Look for errors in the output

3. **Verify API key**:
   - Ensure `EXCHANGERATE_API_KEY` is set in Supabase secrets
   - Check API rate limits aren't exceeded

4. **Manual test**:
   - Click "Sync from API" in Admin Dashboard
   - If manual sync works but auto-sync doesn't, it's a cron configuration issue

## Related Files

- Auto-Sync Edge Function: `/supabase/functions/auto-sync-exchange-rates/index.ts`
- Manual Sync Edge Function: `/supabase/functions/fetch-exchange-rates/index.ts`
- Admin UI: `/src/screens/AdminDashboardScreen/ExchangeRatesSection.tsx`
- Service: `/src/lib/withdrawalCurrencyService.ts`
- Database Table: `withdrawal_exchange_rates`
- Cron Job Migration: `schedule_exchange_rate_sync.sql`

---

**Status**: Fully Automated
**Last Updated**: 2026-01-26
**Deployed**: Yes
**Auto-Sync**: Every hour at minute 0
**Rate Buffer**: 6% reduction applied
