# ZeptoMail Connection Testing Guide

## Overview
The Email Management system includes built-in testing features to verify your ZeptoMail integration is working correctly.

## Testing Methods

### 1. Send Test Email (Recommended)

This is the best way to test your ZeptoMail connection as it actually sends an email and verifies the entire flow.

#### Steps:
1. Go to **Admin Dashboard** → **Announcements** → **Emails** tab
2. Navigate to **Email Templates** sub-tab
3. Click the **"Send Test Email"** button (green button in top right)
4. In the modal:
   - Select an email template type (e.g., Welcome Email)
   - Enter your email address as the recipient
   - Click **"Send Test"**
5. Wait for the result:
   - ✅ **Success**: Green message confirming email was sent
   - ❌ **Error**: Red message with error details

#### What Happens:
- Calls the `send-email` edge function
- Uses sample data for the selected template
- Sends actual email via ZeptoMail API
- Records the attempt in Email Logs
- Shows success/failure in real-time

### 2. Test from Config Tab

Quick test button directly in the ZeptoMail Config section.

#### Steps:
1. Go to **Admin Dashboard** → **Announcements** → **Emails** tab
2. Navigate to **ZeptoMail Config** sub-tab
3. If configured, you'll see a **"Test Connection"** button
4. Click to open the test modal
5. Follow same steps as method 1

## Verification Checklist

### Before Testing:
- [ ] ZeptoMail account created at https://www.zeptomail.zoho.com
- [ ] API token obtained from ZeptoMail dashboard
- [ ] API token added in ZeptoMail Config tab
- [ ] From email and name configured
- [ ] Domain verified in ZeptoMail (if using custom domain)

### What to Check:
1. **Configuration Status**
   - Green badge showing "ZeptoMail is configured and active"
   - All config fields populated

2. **Test Email Results**
   - Success message appears
   - Email arrives in recipient inbox
   - Check spam/junk folder if not in inbox

3. **Email Logs**
   - Go to Email Logs sub-tab
   - Find your test email entry
   - Status should be "Sent"
   - No error messages displayed

## Common Issues & Solutions

### Issue: "Email service not configured"
**Solution**: Configure ZeptoMail in the Config tab first

### Issue: "Email template not found"
**Solution**: Database migration may not have run. Check that email_templates table exists

### Issue: "Failed to send email" with API error
**Solutions**:
- Verify API token is correct
- Check that from_email domain is verified in ZeptoMail
- Ensure API token has send permissions

### Issue: Email sent but not received
**Solutions**:
- Check spam/junk folder
- Verify recipient email is valid
- Check ZeptoMail dashboard for delivery status
- Review bounce logs in ZeptoMail

### Issue: "Invalid API token"
**Solutions**:
- Regenerate token in ZeptoMail dashboard
- Ensure you copied the full token
- Token should start with "Zoho-enczapikey"

## Email Logs Monitoring

After sending test emails, monitor in Email Logs tab:

### Log Entry Fields:
- **Type**: Template type used
- **Recipient**: Email address
- **Subject**: Email subject line
- **Status**: pending → sent/failed
- **Date**: When email was sent
- **Error Message**: If failed, shows reason

### Status Meanings:
- **Pending**: Queued for sending
- **Sent**: Successfully delivered to ZeptoMail
- **Failed**: Error occurred during send
- **Bounced**: Recipient email bounced

## Production Checklist

Before going live:
- [ ] Test all 5 email templates
- [ ] Verify emails arrive correctly formatted
- [ ] Check emails in multiple email clients (Gmail, Outlook, etc.)
- [ ] Test with different recipient domains
- [ ] Review ZeptoMail sending limits
- [ ] Set up bounce address
- [ ] Monitor email logs regularly

## API Reference

### Edge Function: `send-email`

**Endpoint**: `{SUPABASE_URL}/functions/v1/send-email`

**Request Body**:
```json
{
  "template_type": "welcome",
  "recipient_email": "user@example.com",
  "variables": {
    "user_name": "John Doe",
    "app_url": "https://airaplay.com"
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Email sent successfully",
  "message_id": "zeptomail-message-id"
}
```

## Support Resources

- **ZeptoMail Docs**: https://www.zoho.com/zeptomail/help/
- **ZeptoMail API**: https://www.zoho.com/zeptomail/help/api/
- **Email Templates**: Admin Dashboard → Announcements → Emails
- **Email Logs**: Monitor all sent emails in real-time

## Testing Best Practices

1. **Start Small**: Test with one template first
2. **Use Real Email**: Test with actual email addresses you can access
3. **Check Logs**: Always verify in Email Logs tab
4. **Monitor ZeptoMail**: Check ZeptoMail dashboard for detailed delivery info
5. **Test Regularly**: Test after any configuration changes
