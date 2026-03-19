# Email Management System - Admin Guide

## Overview

The Email Management System in the Airaplay Admin Dashboard provides a comprehensive interface for managing email templates, configuring ZeptoMail, monitoring email delivery, and sending test emails.

## Table of Contents

1. [Accessing the Email System](#accessing-the-email-system)
2. [Email Templates](#email-templates)
3. [ZeptoMail Configuration](#zeptomail-configuration)
4. [Email Logs](#email-logs)
5. [Testing Email Delivery](#testing-email-delivery)
6. [Troubleshooting](#troubleshooting)

---

## Accessing the Email System

1. Navigate to the Admin Dashboard at `/admin`
2. Click on "Announcements" in the left sidebar
3. Select the "Emails (ZeptoMail)" tab at the top

You'll see three sub-tabs:
- **Email Templates**: Manage and edit email templates
- **Email Logs**: View email delivery history
- **ZeptoMail Config**: Configure your ZeptoMail API credentials

---

## Email Templates

### Available Templates

The system comes with 5 pre-configured email templates:

1. **Welcome Email** - Sent to new users upon registration
2. **Treat Purchase** - Confirmation for in-app purchases
3. **Withdrawal Approved** - Notification when withdrawal is approved
4. **Weekly Newsletter** - Marketing and content updates
5. **Creator Weekly Report** - Performance stats for artists

### Editing Templates

#### Enhanced Template Editor Features:

1. **Click "Edit" button** on any template to open the editor
2. **Variable Insertion Helper**:
   - Click any variable button to insert it into your HTML content
   - Available variables are shown at the top of the editor
   - Variables use the format `{{variable_name}}`

3. **Live Preview** (Toggle On/Off):
   - See real-time preview of your changes
   - Preview shows sample data for all variables
   - Subject line preview included
   - Side-by-side editor and preview layout

4. **Editor Features**:
   - Character and line count
   - Monospace font for HTML editing
   - Full-screen modal for maximum editing space
   - Validation before saving

5. **Full Preview**:
   - Click "Full Preview" to see a complete preview in a new modal
   - Shows exactly how the email will look to recipients
   - Includes subject line and all formatted content

### Template Structure

Each template has:
- **Subject Line**: Can include variables using `{{variable_name}}`
- **HTML Content**: Full HTML email body with inline CSS
- **Variables**: Dynamic placeholders that get replaced with actual data
- **Version**: Automatically incremented on each save
- **Status**: Active/Inactive toggle

### Best Practices for Template Editing

1. **Always use inline CSS** - Email clients don't support external stylesheets
2. **Test variables** - Use the preview to ensure variables display correctly
3. **Keep it simple** - Complex layouts may not render well in all email clients
4. **Mobile responsive** - Test how your email looks on mobile devices
5. **Include alt text** - For all images in the email
6. **Test before production** - Use "Send Test Email" before deploying

---

## ZeptoMail Configuration

### Initial Setup

1. **Get ZeptoMail Account**:
   - Sign up at [https://www.zeptomail.zoho.com](https://www.zeptomail.zoho.com)
   - Verify your domain (required for production use)
   - Generate an API token

2. **Configure in Admin Dashboard**:
   - Navigate to "ZeptoMail Config" tab
   - Click "Configure Now" if first time, or "Edit Config" to update
   - Fill in all required fields:
     - **API Token** (Required): Your ZeptoMail API token (starts with "Zoho-enczapikey")
     - **From Email** (Required): Verified sender email (e.g., noreply@yourdomain.com)
     - **From Name** (Required): Display name shown to recipients (e.g., "Airaplay")
     - **Bounce Address** (Optional): Email to receive bounce notifications

3. **Save Configuration**:
   - Click "Save Configuration"
   - Configuration is validated before saving
   - Email format validation included
   - API token format check

### Testing the Configuration

#### Test Connection
- Click "Test Connection" button in the config view
- Verifies database connection and configuration validity
- Quick check without sending actual email
- Results displayed immediately

#### Send Test Email
- Click "Send Test Email" button
- Select a template from the dropdown
- Enter recipient email address
- Sends actual email through ZeptoMail
- Logged in Email Logs for verification

### Configuration Status Display

When configured, you'll see:
- ✅ Green badge showing "ZeptoMail is configured and active"
- Configuration details (from email, from name, bounce address)
- Masked API token (last 6 characters visible)
- Status indicator (Active)
- Last updated timestamp

### Security Notes

- API tokens are stored in the database
- Tokens are displayed as masked in the UI
- Use environment variables for additional security in production
- Regularly rotate API tokens

---

## Email Logs

### Viewing Email History

The Email Logs tab shows all sent emails with:
- **Template Type**: Which template was used
- **Recipient**: Email address
- **Subject**: Email subject line
- **Status**: Delivery status with color-coded badges:
  - 🟡 **Pending**: Queued for delivery
  - 🟢 **Sent**: Successfully delivered
  - 🔴 **Failed**: Delivery failed (with error message)
  - 🟠 **Bounced**: Email bounced back
- **Date**: When the email was sent

### Status Badges

- **Sent** (Green): Email successfully delivered to ZeptoMail
- **Failed** (Red): Delivery failed - hover for error details
- **Pending** (Yellow): Email queued but not yet sent
- **Bounced** (Orange): Email bounced - check recipient address

### Log Details

- Last 100 emails displayed
- Most recent emails shown first
- Error messages displayed for failed emails
- Timestamps in local timezone format

---

## Testing Email Delivery

### Method 1: Send Test Email (Recommended)

1. Navigate to "Email Templates" or "ZeptoMail Config" tab
2. Click "Send Test Email" button
3. Select template type from dropdown
4. Enter your test email address
5. Click "Send Test"
6. Check results:
   - ✅ Success message with confirmation
   - ❌ Error message if failed
7. Verify receipt in your inbox
8. Check Email Logs tab for delivery status

### Method 2: Test Connection Only

1. Navigate to "ZeptoMail Config" tab
2. Click "Test Connection" button
3. Verifies configuration without sending email
4. Quick validation check

### What to Verify

- ✅ Email arrives in inbox (not spam)
- ✅ Subject line displays correctly
- ✅ All variables are replaced with sample data
- ✅ Images load properly
- ✅ Links work correctly
- ✅ Layout looks good on mobile and desktop
- ✅ Sender name and email display correctly

---

## Troubleshooting

### Email Not Sending

**Symptom**: Test email fails or shows error

**Solutions**:
1. **Check ZeptoMail Configuration**:
   - Verify API token is correct
   - Ensure from_email domain is verified in ZeptoMail
   - Check that all required fields are filled

2. **Verify Domain**:
   - Log into ZeptoMail dashboard
   - Confirm sender domain is verified
   - Add necessary DNS records if needed

3. **Check API Token**:
   - Token should start with "Zoho-enczapikey"
   - Regenerate token if expired
   - Update in Admin Dashboard

4. **Review Email Logs**:
   - Check for specific error messages
   - Look for pattern in failures
   - Verify recipient email format

### Emails Going to Spam

**Solutions**:
1. Verify sender domain in ZeptoMail
2. Set up SPF, DKIM, and DMARC records
3. Use consistent from_name and from_email
4. Avoid spam trigger words in subject/content
5. Include unsubscribe link (for newsletters)

### Templates Not Saving

**Solutions**:
1. Check that subject is not empty
2. Verify HTML content is not empty
3. Ensure valid HTML syntax
4. Check browser console for errors
5. Try refreshing and editing again

### Variables Not Replacing

**Solutions**:
1. Use correct format: `{{variable_name}}`
2. Match exact variable names from template
3. Check preview to see sample data
4. Verify variables exist in template definition

### Preview Not Showing

**Solutions**:
1. Toggle "Show Preview" button
2. Check that template has sample data defined
3. Verify HTML content is valid
4. Try full preview button
5. Check browser console for iframe errors

### Connection Test Failing

**Solutions**:
1. Save configuration before testing
2. Verify database connection
3. Check all required fields are filled
4. Ensure Supabase connection is active
5. Review error message for specific issue

---

## Email System Architecture

### Components

1. **Frontend (React)**:
   - `EmailManagementTab.tsx` - Main UI component
   - Template editor with live preview
   - Configuration management
   - Log viewer

2. **Backend (Supabase)**:
   - `email_templates` table - Template storage
   - `zeptomail_config` table - API configuration
   - `email_logs` table - Delivery history

3. **Edge Function**:
   - `send-email` - Handles email sending
   - Fetches template and config
   - Replaces variables
   - Calls ZeptoMail API
   - Logs results

### Email Sending Flow

1. Trigger event (e.g., user registration)
2. Call `send-email` edge function with:
   - Template type
   - Recipient email
   - Variable data
3. Function fetches active template
4. Function fetches ZeptoMail config
5. Variables replaced with actual data
6. Email sent via ZeptoMail API
7. Result logged to database
8. Status returned to caller

### Database Tables

#### `email_templates`
- `id`: UUID primary key
- `template_type`: Unique template identifier
- `subject`: Email subject line (with variables)
- `html_content`: Email HTML body (with variables)
- `variables`: Array of variable names
- `is_active`: Boolean status
- `version`: Auto-incremented version number
- `created_at`, `updated_at`: Timestamps

#### `zeptomail_config`
- `id`: UUID primary key
- `api_token`: ZeptoMail API token
- `from_email`: Sender email address
- `from_name`: Sender display name
- `bounce_address`: Optional bounce email
- `is_active`: Boolean status
- `created_at`, `updated_at`: Timestamps

#### `email_logs`
- `id`: UUID primary key
- `template_type`: Template used
- `recipient_email`: Recipient address
- `recipient_user_id`: Optional user reference
- `subject`: Actual subject sent
- `html_content`: Actual HTML sent
- `status`: Delivery status
- `provider_message_id`: ZeptoMail message ID
- `error_message`: Error details if failed
- `metadata`: Additional data (variables used)
- `sent_at`: Delivery timestamp
- `created_at`: Log creation timestamp

---

## Production Deployment Checklist

Before going live with the email system:

- [ ] ZeptoMail account created and verified
- [ ] Domain verified in ZeptoMail
- [ ] SPF, DKIM, DMARC records configured
- [ ] API token generated and saved
- [ ] All email templates reviewed and tested
- [ ] Test emails sent to multiple email providers (Gmail, Outlook, etc.)
- [ ] Emails not landing in spam
- [ ] Mobile rendering verified
- [ ] All links working correctly
- [ ] Unsubscribe links included (for newsletters)
- [ ] Privacy policy and terms linked
- [ ] Error handling tested
- [ ] Email logs monitoring set up
- [ ] Bounce handling configured
- [ ] Rate limits understood (ZeptoMail free tier: 10,000/month)

---

## Support and Resources

### ZeptoMail Resources
- **Dashboard**: [https://www.zeptomail.zoho.com](https://www.zeptomail.zoho.com)
- **Documentation**: [https://www.zoho.com/zeptomail/help/](https://www.zoho.com/zeptomail/help/)
- **API Reference**: [https://www.zoho.com/zeptomail/help/api/](https://www.zoho.com/zeptomail/help/api/)

### Email Best Practices
- Keep emails under 102KB for Gmail
- Use responsive design
- Include alt text for images
- Test across multiple clients
- Avoid JavaScript and external CSS
- Use inline CSS only
- Include plain text alternative

### Monitoring
- Check Email Logs daily
- Monitor ZeptoMail dashboard for delivery rates
- Review bounce and spam reports
- Track open and click rates (if configured)
- Set up alerts for high failure rates

---

## Changelog

### Version 1.1 (Current)
- ✅ Enhanced template editor with live preview
- ✅ Variable insertion helper buttons
- ✅ Improved ZeptoMail configuration UI
- ✅ Connection testing functionality
- ✅ Comprehensive validation
- ✅ Better error messages
- ✅ Status displays and badges
- ✅ Full preview modal

### Version 1.0 (Initial)
- Basic template management
- ZeptoMail configuration
- Email logs viewer
- Test email sending

---

## Quick Reference

### Common Variables by Template

**Welcome Email**:
- `{{user_name}}` - User's full name
- `{{user_email}}` - User's email
- `{{app_url}}` - App URL

**Purchase Treat**:
- `{{user_name}}` - User's name
- `{{amount}}` - Purchase amount
- `{{transaction_id}}` - Transaction ID
- `{{payment_method}}` - Payment method
- `{{date}}` - Purchase date

**Approved Withdrawal**:
- `{{user_name}}` - User's name
- `{{amount}}` - Withdrawal amount
- `{{currency}}` - Currency code
- `{{payment_method}}` - Payment method
- `{{account_details}}` - Masked account

**Newsletter**:
- `{{user_name}}` - Subscriber name
- `{{trending_content}}` - Trending section
- `{{new_releases}}` - New releases section
- `{{featured_artists}}` - Featured artists
- `{{app_url}}` - App URL
- `{{unsubscribe_url}}` - Unsubscribe link

**Weekly Report**:
- `{{user_name}}` - Artist name
- `{{date_range}}` - Report period
- `{{plays}}` - Total plays
- `{{likes}}` - Total likes
- `{{shares}}` - Total shares
- `{{earnings}}` - Total earnings
- `{{new_followers}}` - New followers
- `{{top_track}}` - Most played track

---

*Last Updated: March 19, 2026*
*Document Version: 1.1*
