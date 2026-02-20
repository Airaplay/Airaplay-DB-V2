# Email System - Quick Reference

## System Status

✅ **FULLY OPERATIONAL** - All components active and ready

| Component | Status | Details |
|-----------|--------|---------|
| ZeptoMail Config | ✅ Active | Connected |
| Email Templates | ✅ Ready | 7 templates |
| Email Queue | ✅ Operational | Auto-processing |
| Database Triggers | ✅ Active | 5 triggers |
| Cron Job | ✅ Running | Every 5 minutes |
| pg_net Extension | ✅ Enabled | HTTP ready |
| pg_cron Extension | ✅ Enabled | Scheduler ready |

## What Emails Are Sent

1. **Welcome** - User signs up
2. **Purchase Confirmation** - Treat purchased
3. **Withdrawal Approval** - Withdrawal approved
4. **Creator Approval** - Creator account approved  
5. **Promotion Active** - Promotion goes live

## Quick Checks

### Queue Status
```sql
SELECT status, COUNT(*) FROM email_queue GROUP BY status;
```

### Recent Emails
```sql
SELECT * FROM email_queue ORDER BY created_at DESC LIMIT 5;
```

### Cron Status
```sql
SELECT * FROM cron.job WHERE jobname = 'process-email-queue-every-5-minutes';
```

### Last 5 Cron Runs
```sql
SELECT start_time, status FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-email-queue-every-5-minutes')
ORDER BY start_time DESC LIMIT 5;
```

### Failed Emails
```sql
SELECT * FROM email_queue WHERE status = 'failed' ORDER BY created_at DESC;
```

## Test Email

```sql
SELECT queue_email(
  'welcome',
  'your@email.com',
  NULL,
  jsonb_build_object(
    'user_name', 'Test',
    'user_email', 'your@email.com',
    'app_url', 'https://airaplay.com'
  )
);
```

## Retry Failed Emails

```sql
UPDATE email_queue
SET status = 'pending', attempts = 0, error_message = NULL
WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours';
```

## Cleanup Old Emails

```sql
DELETE FROM email_queue
WHERE status IN ('sent', 'failed') AND created_at < NOW() - INTERVAL '7 days';
```

## Manually Trigger

```bash
curl -X POST https://your-project.supabase.co/functions/v1/process-email-queue \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## Change Schedule

```sql
-- Every 2 minutes instead of 5
SELECT cron.unschedule('process-email-queue-every-5-minutes');
SELECT cron.schedule('process-email-queue-every-2-minutes', '*/2 * * * *', $$ [command] $$);
```

## Disable/Enable

```sql
-- Disable (pause)
UPDATE cron.job SET active = false WHERE jobname = 'process-email-queue-every-5-minutes';

-- Enable (resume)
UPDATE cron.job SET active = true WHERE jobname = 'process-email-queue-every-5-minutes';
```

---

**Full Documentation:** See EMAIL_SYSTEM_COMPLETE.md
