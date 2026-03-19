# Email System Architecture - Visual Overview

## System Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         AIRAPLAY EMAIL SYSTEM                             │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    DATABASE EVENTS (Automatic)                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌──────────────┐  INSERT  ┌──────────────────────────────────────┐    │
│  │    users     │ ────────▶│ trigger_send_welcome_email()          │    │
│  │   (signup)   │          │   → queue_email('welcome')            │    │
│  └──────────────┘          └──────────────────────────────────────┘    │
│                                        │                                  │
│  ┌──────────────┐  INSERT  ┌──────────┴───────────────────────────┐    │
│  │treat_trans.. │ ────────▶│ trigger_send_purchase_email()         │    │
│  │ (purchase)   │          │   → queue_email('purchase_treat')     │    │
│  └──────────────┘          └──────────────────────────────────────┘    │
│                                        │                                  │
│  ┌──────────────┐  UPDATE  ┌──────────┴───────────────────────────┐    │
│  │ withdrawal_  │ ────────▶│ trigger_send_withdrawal_approval_..() │    │
│  │  requests    │          │   → queue_email('approved_withdraw.') │    │
│  └──────────────┘          └──────────────────────────────────────┘    │
│                                        │                                  │
│  ┌──────────────┐  UPDATE  ┌──────────┴───────────────────────────┐    │
│  │  creator_    │ ────────▶│ trigger_send_creator_approval_email() │    │
│  │  requests    │          │   → queue_email('creator_approved')   │    │
│  └──────────────┘          └──────────────────────────────────────┘    │
│                                        │                                  │
│  ┌──────────────┐  UPDATE  ┌──────────┴───────────────────────────┐    │
│  │  promotions  │ ────────▶│ trigger_send_promotion_active_email() │    │
│  │   (active)   │          │   → queue_email('promotion_active')   │    │
│  └──────────────┘          └──────────────────────────────────────┘    │
│                                        │                                  │
│                                        ▼                                  │
│                          ┌─────────────────────────┐                     │
│                          │     email_queue         │                     │
│                          │  (status='pending')     │                     │
│                          │                         │                     │
│                          │  • template_type        │                     │
│                          │  • recipient_email      │                     │
│                          │  • variables (JSON)     │                     │
│                          │  • attempts: 0/3        │                     │
│                          │  • scheduled_for        │                     │
│                          └─────────────────────────┘                     │
│                                        │                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    MANUAL TRIGGERS (Admin)                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                        │                                  │
│  ┌──────────────┐  Admin   ┌──────────┴───────────────────────────┐    │
│  │    Admin     │ ────────▶│ Send Newsletter                       │    │
│  │  Dashboard   │          │   → queue_email('newsletter')         │    │
│  │              │          └──────────────────────────────────────┘    │
│  │              │  Admin   ┌──────────────────────────────────────┐    │
│  │              │ ────────▶│ Send Weekly Report                    │    │
│  └──────────────┘          │   → queue_email('weekly_report')      │    │
│                            └──────────────────────────────────────┘    │
│                                        │                                  │
│                                        ▼                                  │
│                          ┌─────────────────────────┐                     │
│                          │     email_queue         │                     │
│                          │  (status='pending')     │                     │
│                          └─────────────────────────┘                     │
│                                        │                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    EMAIL PROCESSING                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                        │                                  │
│                                        ▼                                  │
│              ┌─────────────────────────────────────────────┐             │
│              │   process-email-queue Edge Function          │             │
│              │   (Runs every 2 minutes via cron)           │             │
│              │                                              │             │
│              │  1. Fetch pending emails (batch 20)         │             │
│              │  2. Mark as 'processing'                    │             │
│              │  3. For each email:                         │             │
│              └─────────────────────────────────────────────┘             │
│                              │                                            │
│                              ▼                                            │
│              ┌─────────────────────────────────────────────┐             │
│              │   send-email Edge Function                  │             │
│              │                                              │             │
│              │  1. Fetch email_templates                   │             │
│              │  2. Fetch zeptomail_config                  │             │
│              │  3. Replace {{variables}}                   │             │
│              │  4. Call ZeptoMail API                      │             │
│              │  5. Log result                              │             │
│              └─────────────────────────────────────────────┘             │
│                              │                                            │
│                              ▼                                            │
│              ┌─────────────────────────────────────────────┐             │
│              │         ZeptoMail API                       │             │
│              │   (External Email Service)                  │             │
│              │                                              │             │
│              │  POST https://api.zeptomail.com/v1.1/email  │             │
│              └─────────────────────────────────────────────┘             │
│                              │                                            │
│                    ┌─────────┴─────────┐                                 │
│                    │                   │                                  │
│              ✅ Success          ❌ Failure                               │
│                    │                   │                                  │
│                    ▼                   ▼                                  │
│    ┌──────────────────────┐  ┌──────────────────────┐                   │
│    │  email_queue         │  │  email_queue         │                   │
│    │  status='sent'       │  │  attempts += 1       │                   │
│    │  sent_at=now()       │  │  status='pending'    │                   │
│    └──────────────────────┘  │  (retry if < 3)      │                   │
│              │                └──────────────────────┘                   │
│              ▼                          │                                 │
│    ┌──────────────────────┐            │                                 │
│    │   email_logs         │            ▼                                 │
│    │                      │  ┌──────────────────────┐                   │
│    │  • template_type     │  │  Max retries reached │                   │
│    │  • recipient_email   │  │  status='failed'     │                   │
│    │  • status='sent'     │  │  error_message       │                   │
│    │  • sent_at           │  └──────────────────────┘                   │
│    │  • provider_msg_id   │                                              │
│    └──────────────────────┘                                              │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

## Template → Data Source Mapping

```
┌────────────────────────────────────────────────────────────────────┐
│                     EMAIL TEMPLATE CONNECTIONS                      │
└────────────────────────────────────────────────────────────────────┘

1. welcome
   ├─ Trigger: users.INSERT
   ├─ Variables: users.{display_name, email}
   └─ Static: app_url

2. purchase_treat
   ├─ Trigger: treat_transactions.INSERT (type='purchase', status='completed')
   ├─ Variables: treat_transactions.{amount, id, payment_method, created_at}
   └─ Joined: users.{display_name, email}

3. approved_withdrawal
   ├─ Trigger: withdrawal_requests.UPDATE (status='approved')
   ├─ Variables: withdrawal_requests.{amount, currency, payment_method, account_holder_name}
   └─ Joined: users.{display_name, email}

4. newsletter
   ├─ Trigger: Admin Manual
   ├─ Variables: Admin Input + users.{display_name, email}
   └─ Targets: Segmented user list

5. weekly_report
   ├─ Trigger: Admin Manual / Scheduled
   ├─ Variables: Analytics aggregations + users.{display_name, email}
   └─ Targets: Creators only

6. creator_approved
   ├─ Trigger: creator_requests.UPDATE (status='approved')
   ├─ Variables: users.{display_name, email}
   └─ Static: app_url

7. promotion_active
   ├─ Trigger: promotions.UPDATE (status='active')
   ├─ Variables: promotions.{section, treats_spent, start_date, end_date}
   ├─ Joined: users.{display_name, email}
   └─ Joined: songs.title OR videos.title
```

## Queue Processing Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                   EMAIL QUEUE STATE MACHINE                         │
└────────────────────────────────────────────────────────────────────┘

    [Event Occurs]
          │
          ▼
    queue_email()
          │
          ▼
   ┌──────────────┐
   │   PENDING    │ ◄──── Retry (attempts < 3)
   └──────────────┘
          │
          │ process_email_queue() fetches
          │
          ▼
   ┌──────────────┐
   │ PROCESSING   │
   └──────────────┘
          │
          │ send-email called
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌──────┐   ┌──────────┐
│ SENT │   │  FAILED  │
└──────┘   └──────────┘
    │           │
    │           └─ (attempts >= 3)
    │
    ▼
┌──────────────┐
│ email_logs   │
│ (archived)   │
└──────────────┘
```

## Database Relationships

```
┌────────────────────────────────────────────────────────────────────┐
│                  DATABASE SCHEMA RELATIONSHIPS                      │
└────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│    users     │
│              │──┐
│  • id        │  │
│  • email     │  │ Foreign Keys
│  • display_. │  │
└──────────────┘  │
                  │
┌─────────────────┼────────────┐
│ email_queue     │            │
│                 │            │
│  • id           │            │
│  • template_..  │            │
│  • recipient_.. │            │
│  • recipient_.. ├────────────┘ (references users.id)
│  • variables    │
│  • status       │
│  • attempts     │
└─────────────────┘

┌──────────────────┐
│ email_templates  │
│                  │
│  • template_type │ ◄──── Referenced by email_queue.template_type
│  • subject       │
│  • html_content  │
│  • variables[]   │
│  • is_active     │
└──────────────────┘

┌──────────────────┐
│ zeptomail_config │
│                  │
│  • api_token     │ ◄──── Used by send-email function
│  • from_email    │
│  • from_name     │
│  • is_active     │
└──────────────────┘

┌──────────────────┐
│   email_logs     │
│                  │
│  • template_type │
│  • recipient_..  │
│  • status        │
│  • sent_at       │
│  • provider_..   │
│  • error_message │
└──────────────────┘
```

## Admin Dashboard Integration Points

```
┌────────────────────────────────────────────────────────────────────┐
│              ADMIN DASHBOARD → EMAIL SYSTEM                         │
└────────────────────────────────────────────────────────────────────┘

Admin Dashboard
│
├─ Announcements
│  ├─ Push Notifications
│  └─ Emails (ZeptoMail) ◄──── YOU ARE HERE
│     │
│     ├─ Email Templates
│     │  ├─ View all templates
│     │  ├─ Edit template (with live preview)
│     │  ├─ Preview with sample data
│     │  └─ Send Test Email ──────────────┐
│     │                                    │
│     ├─ Email Logs                        │
│     │  ├─ View delivery history          │
│     │  ├─ Filter by status               │
│     │  └─ See error messages             │
│     │                                    │
│     └─ ZeptoMail Config                  │
│        ├─ Edit API credentials           │
│        ├─ Test Connection                │
│        └─ View config status             │
│                                          │
├─ Withdrawals                             │
│  └─ Approve Button ───────────────────┐  │
│     (triggers approved_withdrawal)    │  │
│                                       │  │
├─ Creator Requests                     │  │
│  └─ Approve Button ───────────────────┼─┐│
│     (triggers creator_approved)       │ ││
│                                       │ ││
└─ Promotions                           │ ││
   └─ Approve Button ────────────────────┼─┼┘
      (triggers promotion_active)       │ │
                                        │ │
        All trigger queue_email()       │ │
                │                       │ │
                ▼                       │ │
        ┌──────────────┐                │ │
        │ email_queue  │ ◄──────────────┘ │
        └──────────────┘                  │
                │                         │
                ▼                         │
    process-email-queue ◄─────────────────┘
                │
                ▼
         send-email (ZeptoMail API)
```

## Variable Resolution Flow

```
┌────────────────────────────────────────────────────────────────────┐
│               HOW VARIABLES GET POPULATED                           │
└────────────────────────────────────────────────────────────────────┘

Template HTML:
  "Hello {{user_name}}, your purchase of {{amount}} Treats..."

                       ▼

Trigger Function:
  jsonb_build_object(
    'user_name', users.display_name,
    'amount', treat_transactions.amount::text
  )

                       ▼

Email Queue:
  {
    template_type: 'purchase_treat',
    variables: {
      "user_name": "John Doe",
      "amount": "1000"
    }
  }

                       ▼

send-email Function:
  For each (key, value) in variables:
    html = html.replace(/{{key}}/g, value)

                       ▼

Final Email:
  "Hello John Doe, your purchase of 1000 Treats..."

                       ▼

ZeptoMail API → User's Inbox
```

---

## Quick Reference Commands

### Check Email Queue Status
```sql
SELECT status, COUNT(*) 
FROM email_queue 
GROUP BY status;
```

### View Recent Emails
```sql
SELECT 
  template_type,
  recipient_email,
  status,
  attempts,
  created_at
FROM email_queue
ORDER BY created_at DESC
LIMIT 20;
```

### Manual Queue Processing
```sql
SELECT * FROM process_email_queue(20);
```

### View Failed Emails
```sql
SELECT 
  template_type,
  recipient_email,
  error_message,
  attempts
FROM email_queue
WHERE status = 'failed';
```

### Check Template Triggers
```sql
SELECT 
  tgname AS trigger_name,
  tgenabled AS enabled,
  tgrelid::regclass AS table_name
FROM pg_trigger
WHERE tgname LIKE '%email%';
```

---

**Legend:**
- ──▶ : Data flow
- ├─ : Branch/Option
- └─ : End of branch
- ◄── : Reference/Lookup
- ✅ : Success path
- ❌ : Failure path
