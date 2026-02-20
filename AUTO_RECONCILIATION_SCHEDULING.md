# Auto-Reconciliation Function Scheduling Guide

## Overview

The `auto-reconcile-payments` Edge Function automatically verifies and credits pending payments that are older than 5 minutes. This prevents payments from getting stuck in "pending" status.

## Function Endpoint

```
POST https://YOUR_PROJECT.supabase.co/functions/v1/auto-reconcile-payments
```

## Scheduling Options

### Option 1: GitHub Actions (Recommended - Free)

Create `.github/workflows/auto-reconcile-payments.yml`:

```yaml
name: Auto-Reconcile Payments

on:
  schedule:
    # Run every 5 minutes
    - cron: '*/5 * * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  reconcile:
    runs-on: ubuntu-latest
    steps:
      - name: Call Auto-Reconcile Function
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            https://YOUR_PROJECT.supabase.co/functions/v1/auto-reconcile-payments
        env:
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

**Setup:**
1. Go to your GitHub repository → Settings → Secrets and variables → Actions
2. Add secret: `SUPABASE_SERVICE_ROLE_KEY` (your Supabase service role key)
3. Replace `YOUR_PROJECT` with your actual Supabase project URL
4. Commit the workflow file

### Option 2: Vercel Cron Jobs

If your frontend is deployed on Vercel, add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/reconcile-payments",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Create `api/cron/reconcile-payments.ts`:

```typescript
export default async function handler(req: Request) {
  const response = await fetch(
    `${process.env.VITE_SUPABASE_URL}/functions/v1/auto-reconcile-payments`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  return new Response(JSON.stringify(await response.json()), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

### Option 3: Cloudflare Workers Cron Triggers

Create `workers/auto-reconcile-payments.js`:

```javascript
export default {
  async scheduled(event, env, ctx) {
    await fetch(
      `https://YOUR_PROJECT.supabase.co/functions/v1/auto-reconcile-payments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
  },
};
```

Add to `wrangler.toml`:

```toml
[triggers]
crons = ["*/5 * * * *"]
```

### Option 4: External Cron Service

Use services like:
- **cron-job.org** (Free)
- **EasyCron** (Free tier available)
- **Cronitor** (Free tier available)

Configure to call:
```
POST https://YOUR_PROJECT.supabase.co/functions/v1/auto-reconcile-payments
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
Content-Type: application/json
```

Schedule: Every 5 minutes (`*/5 * * * *`)

### Option 5: Supabase Database Functions (If pg_cron available)

If your Supabase instance has `pg_cron` extension enabled:

```sql
-- Enable pg_cron extension (may require admin access)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the function
SELECT cron.schedule(
  'auto-reconcile-payments',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/auto-reconcile-payments',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Note:** This requires the `pg_net` extension as well, which may not be available on all Supabase plans.

## Manual Testing

You can manually trigger the function:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  https://YOUR_PROJECT.supabase.co/functions/v1/auto-reconcile-payments
```

## Monitoring

Check the function logs in Supabase Dashboard:
1. Go to Edge Functions → `auto-reconcile-payments`
2. View logs to see:
   - How many payments were processed
   - How many were verified and credited
   - Any errors encountered

## Recommended Schedule

- **Frequency:** Every 5 minutes
- **Why:** Balances between:
  - Fast payment processing (payments verified within 5 minutes)
  - API rate limits (not too frequent)
  - Cost efficiency (reasonable number of calls)

## Security

- **Never expose** your service role key in client-side code
- **Use environment variables** for all secrets
- **Restrict access** to the scheduling service
- The function uses service role key internally, so the scheduler only needs to trigger it




