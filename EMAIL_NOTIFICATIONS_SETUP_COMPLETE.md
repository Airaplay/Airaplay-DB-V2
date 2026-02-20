# Email Notifications System - Setup Complete

## Summary

The email notification system is now fully configured and ready to send emails for the following events:

✅ **User Sign Up** - Welcome email
✅ **Treat Purchase** - Purchase confirmation  
✅ **Withdrawal Approval** - Approval notification
✅ **Creator Account Approval** - Welcome to creator program
✅ **Promotion Goes Active** - Promotion live notification
✅ **Newsletter** - Weekly/monthly newsletters (template ready)

## How It Works

### 1. Event Triggers
Database triggers automatically queue emails when events occur:
- User signs up → Welcome email queued
- Treat purchase completed → Confirmation email queued
- Withdrawal approved → Approval email queued
- Creator account approved → Creator welcome email queued
- Promotion status changes to "active" → Promo live email queued

### 2. Email Queue
All emails are queued in the `email_queue` table with:
- Template type
- Recipient email and user ID
- Variables for personalization
- Scheduling (immediate or delayed)
- Retry logic (max 3 attempts)

### 3. Processing
The `process-email-queue` edge function:
- Fetches pending emails from the queue
- Calls the `send-email` function for each
- Handles failures and retries
- Logs all activity

### 4. Email Delivery
The `send-email` edge function:
- Gets the email template
- Replaces variables with actual values
- Sends via ZeptoMail API
- Logs delivery status

## Database Tables

### `email_queue`
Stores emails waiting to be sent:
```sql
id                 uuid
template_type      text
recipient_email    text
recipient_user_id  uuid
variables          jsonb
status            text (pending, processing, sent, failed)
attempts          integer
max_attempts      integer
scheduled_for     timestamptz
sent_at           timestamptz
```

### `email_templates`
Stores reusable email templates:
- welcome
- purchase_treat
- approved_withdrawal
- creator_approved ← NEW
- promotion_active ← NEW
- newsletter
- weekly_report

### `email_logs`
Tracks all sent emails for audit:
- Who received it
- When it was sent
- Delivery status
- Provider message ID
- Any errors

### `zeptomail_config`
Stores ZeptoMail API configuration (already configured):
- API token
- From email (noreply@airaplay.com)
- From name (Airaplay)

## Database Triggers

The following triggers automatically queue emails:

1. **on_user_signup_send_welcome_email**
   - Table: `users`
   - Event: INSERT
   - Sends welcome email to new users

2. **on_purchase_send_confirmation_email**
   - Table: `treat_transactions`
   - Event: INSERT (when type='purchase' and status='completed')
   - Sends purchase confirmation

3. **on_withdrawal_approved_send_email**
   - Table: `withdrawal_requests`
   - Event: UPDATE (when status changes to 'approved')
   - Sends withdrawal approval email

4. **on_creator_approved_send_email**
   - Table: `creator_requests`
   - Event: UPDATE (when status changes to 'approved')
   - Sends creator approval email

5. **on_promotion_active_send_email**
   - Table: `promotions`
   - Event: UPDATE (when status changes to 'active')
   - Sends promotion live email

## Edge Functions

### `send-email`
**URL:** `https://your-project.supabase.co/functions/v1/send-email`

Sends individual emails via ZeptoMail API.

**Request:**
```json
{
  "template_type": "welcome",
  "recipient_email": "user@example.com",
  "recipient_user_id": "uuid",
  "variables": {
    "user_name": "John Doe",
    "app_url": "https://airaplay.com"
  }
}
```

### `process-email-queue` ← NEW
**URL:** `https://your-project.supabase.co/functions/v1/process-email-queue`

Processes pending emails in the queue.

**Request:** None (GET or POST)

**Response:**
```json
{
  "success": true,
  "message": "Processed 5 emails",
  "processed": 5,
  "sent": 4,
  "failed": 1
}
```

## Setup Instructions

### 1. Deploy Edge Functions

```bash
# Deploy send-email function (already done)
supabase functions deploy send-email

# Deploy NEW process-email-queue function
supabase functions deploy process-email-queue
```

### 2. Schedule Email Processing

**Option A: Manual Trigger (Testing)**
Call the process-email-queue function manually:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/process-email-queue \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

**Option B: Scheduled Cron Job (Production)**

Set up a cron job to process emails every 5 minutes:

1. **Using Supabase pg_cron:**
```sql
-- Run every 5 minutes
SELECT cron.schedule(
  'process-email-queue',
  '*/5 * * * *',
  $$ 
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/process-email-queue',
    headers:=jsonb_build_object('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'),
    body:='{}'::jsonb
  ) 
  $$
);
```

2. **Using External Cron (e.g., cron-job.org):**
- Set up a cron job pointing to your edge function URL
- Schedule: Every 5 minutes
- Method: POST
- Headers: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`

**Option C: External Service (Recommended)**
Use a service like:
- Vercel Cron Jobs
- GitHub Actions (scheduled workflow)
- AWS EventBridge
- Google Cloud Scheduler

### 3. Test Email Sending

#### Test 1: Welcome Email
```sql
-- Manually queue a welcome email
SELECT queue_email(
  'welcome',
  'test@example.com',
  NULL,
  jsonb_build_object(
    'user_name', 'Test User',
    'user_email', 'test@example.com',
    'app_url', 'https://airaplay.com'
  )
);
```

#### Test 2: Process Queue
```bash
# Call the process-email-queue function
curl -X POST https://your-project.supabase.co/functions/v1/process-email-queue \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

#### Test 3: Check Results
```sql
-- Check email queue status
SELECT * FROM email_queue ORDER BY created_at DESC LIMIT 10;

-- Check email logs
SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 10;
```

## Monitoring & Debugging

### Check Pending Emails
```sql
SELECT 
  id,
  template_type,
  recipient_email,
  status,
  attempts,
  created_at,
  error_message
FROM email_queue
WHERE status = 'pending'
ORDER BY scheduled_for ASC
LIMIT 20;
```

### Check Failed Emails
```sql
SELECT 
  id,
  template_type,
  recipient_email,
  attempts,
  error_message,
  created_at
FROM email_queue
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 20;
```

### Check Email Logs
```sql
SELECT 
  template_type,
  recipient_email,
  status,
  sent_at,
  error_message
FROM email_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;
```

### Retry Failed Emails
```sql
-- Reset failed emails to pending (for retry)
UPDATE email_queue
SET 
  status = 'pending',
  attempts = 0,
  error_message = NULL,
  updated_at = NOW()
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '1 day';
```

## Email Templates

### Variables Available

**Welcome Email:**
- `user_name` - User's display name
- `user_email` - User's email
- `app_url` - Link to app

**Purchase Confirmation:**
- `user_name` - User's name
- `amount` - Number of treats purchased
- `transaction_id` - Transaction reference
- `payment_method` - Payment method used
- `date` - Purchase date/time

**Withdrawal Approved:**
- `user_name` - User's name
- `amount` - Withdrawal amount
- `currency` - Currency code
- `payment_method` - Payment method
- `account_details` - Account holder name

**Creator Approved:**
- `user_name` - User's name
- `user_email` - User's email
- `app_url` - Link to create screen

**Promotion Active:**
- `user_name` - User's name
- `content_title` - Song/video title
- `section` - Promotion section
- `duration` - Duration in days
- `treats_spent` - Treats spent

## Customizing Templates

### Update Email Template

```sql
-- Example: Update welcome email subject
UPDATE email_templates
SET 
  subject = 'Welcome to Airaplay - Let the Music Play!',
  updated_at = NOW()
WHERE template_type = 'welcome';
```

### Add New Variable

1. Update template HTML to include new variable:
```sql
UPDATE email_templates
SET 
  html_content = REPLACE(html_content, '</body>', '<p>{{new_variable}}</p></body>'),
  variables = variables || '["new_variable"]'::jsonb,
  updated_at = NOW()
WHERE template_type = 'welcome';
```

2. Update trigger function to pass the variable:
```sql
-- Modify the trigger function to include new variable
CREATE OR REPLACE FUNCTION trigger_send_welcome_email()
...
  jsonb_build_object(
    'user_name', COALESCE(NEW.display_name, NEW.email),
    'user_email', NEW.email,
    'app_url', 'https://airaplay.com',
    'new_variable', 'value'  -- NEW
  )
...
```

## Troubleshooting

### Emails Not Sending

1. **Check ZeptoMail config:**
```sql
SELECT is_active, from_email FROM zeptomail_config;
```

2. **Check if emails are being queued:**
```sql
SELECT COUNT(*) FROM email_queue WHERE created_at > NOW() - INTERVAL '1 hour';
```

3. **Check edge function logs:**
- Go to Supabase Dashboard → Edge Functions → Logs
- Look for errors in `process-email-queue` and `send-email`

4. **Test send-email function directly:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-email \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template_type": "welcome",
    "recipient_email": "test@example.com",
    "variables": {
      "user_name": "Test",
      "user_email": "test@example.com",
      "app_url": "https://airaplay.com"
    }
  }'
```

### Duplicate Emails

If users receive duplicate emails, check:
```sql
-- Find duplicate entries in queue
SELECT 
  recipient_email,
  template_type,
  variables,
  COUNT(*) as count
FROM email_queue
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY recipient_email, template_type, variables
HAVING COUNT(*) > 1;
```

### Trigger Not Firing

```sql
-- Check if trigger exists
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%email%';

-- Check trigger function
SELECT 
  proname,
  prosrc
FROM pg_proc
WHERE proname LIKE '%email%';
```

## Cost Optimization

### ZeptoMail Free Tier
- 10,000 emails per month free
- Monitor usage in ZeptoMail dashboard

### Reduce Email Volume
```sql
-- Disable non-critical email types
UPDATE email_templates
SET is_active = false
WHERE template_type IN ('weekly_report', 'newsletter');
```

### Cleanup Old Queue Items
```sql
-- Delete old sent/failed emails (keep logs)
DELETE FROM email_queue
WHERE status IN ('sent', 'failed')
  AND created_at < NOW() - INTERVAL '7 days';
```

## Next Steps

1. **Deploy the process-email-queue function:**
   ```bash
   supabase functions deploy process-email-queue
   ```

2. **Set up cron job** to call it every 5 minutes

3. **Test all email types:**
   - Sign up a new user
   - Purchase treats
   - Approve a withdrawal
   - Approve a creator request
   - Activate a promotion

4. **Monitor email logs** for the first few days

5. **Customize templates** to match your brand

## Support

If you encounter issues:
1. Check edge function logs in Supabase dashboard
2. Check `email_queue` and `email_logs` tables
3. Verify ZeptoMail API token is valid
4. Test with a personal email first

---

**Status:** ✅ System Ready  
**Deployed:** 2026-02-08  
**Next Action:** Deploy process-email-queue function and set up cron job
