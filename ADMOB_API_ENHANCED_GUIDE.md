# AdMob API Integration - Enhanced Security & Monitoring Guide

## Overview

The AdMob API integration now includes comprehensive security, monitoring, and rate limiting features to ensure reliable and secure revenue data synchronization.

## What's New

### 1. Rate Limiting System

Prevents API abuse and protects against excessive sync operations.

**Features:**
- Hourly sync limit: 10 syncs per hour (configurable)
- Daily sync limit: 50 syncs per day (configurable)
- Automatic blocking with clear error messages
- Rate limit tracking per configuration

**Database Tables:**
- `admob_sync_rate_limit` - Tracks sync frequency by hour and day

**Functions:**
- `check_admob_sync_rate_limit(config_id)` - Validates sync request against limits

**Usage:**
```sql
SELECT check_admob_sync_rate_limit('your-config-id');
-- Returns: { allowed: true, hourly_remaining: 9, daily_remaining: 49 }
```

### 2. Enhanced Error Logging

Comprehensive error tracking with automatic alerting.

**Features:**
- Categorized error types (authentication, api_error, rate_limit, network, parsing, database)
- Severity levels (warning, error, critical)
- Automatic admin notifications after threshold failures
- Error resolution tracking
- Request/response payload logging for debugging

**Database Tables:**
- `admob_error_log` - Stores detailed error information
- `admin_notifications` - Alerts for critical issues

**Functions:**
- `log_admob_error(...)` - Records errors with context

**Automatic Alerting:**
- After 3 consecutive failures (configurable)
- Admin dashboard notifications
- Email/push notifications (future enhancement)

### 3. API Quota Tracking

Monitor API usage against Google AdMob quotas.

**Features:**
- Daily API call tracking
- Success/failure rate monitoring
- Revenue fetched per day
- Quota limit warnings

**Database Tables:**
- `admob_api_quota` - Daily quota usage tracking

**Functions:**
- `record_admob_sync_success(...)` - Updates quota on successful sync

### 4. Credentials Vault Support

Enhanced security for storing service account credentials.

**Features:**
- Optional Supabase Vault integration
- Credential rotation tracking
- Automatic rotation reminders (90 days default)

**New Config Columns:**
- `credentials_vault_secret_name` - Vault secret reference
- `use_vault` - Toggle vault vs database storage
- `last_credential_rotation` - Track rotation date
- `credential_rotation_days` - Rotation policy

**Setup:**
```sql
-- Enable vault storage
UPDATE admob_api_config
SET
  use_vault = true,
  credentials_vault_secret_name = 'admob_service_account',
  last_credential_rotation = now()
WHERE id = 'your-config-id';
```

### 5. Enhanced Monitoring

Real-time tracking of sync health and performance.

**New Config Columns:**
- `consecutive_failures` - Track failure streak
- `last_successful_sync` - Last successful operation
- `alert_on_failure` - Enable/disable alerts
- `alert_after_failures` - Alert threshold (default: 3)
- `max_syncs_per_hour` - Hourly rate limit
- `max_syncs_per_day` - Daily rate limit

## Configuration Guide

### 1. Configure Rate Limits

```sql
UPDATE admob_api_config
SET
  max_syncs_per_hour = 10,  -- Max syncs per hour
  max_syncs_per_day = 50    -- Max syncs per day
WHERE id = 'your-config-id';
```

### 2. Enable/Configure Alerts

```sql
UPDATE admob_api_config
SET
  alert_on_failure = true,
  alert_after_failures = 3  -- Alert after 3 consecutive failures
WHERE id = 'your-config-id';
```

### 3. Setup Credential Rotation

```sql
UPDATE admob_api_config
SET
  credential_rotation_days = 90,
  last_credential_rotation = now()
WHERE id = 'your-config-id';
```

## Monitoring & Maintenance

### Check Sync Rate Limits

```sql
SELECT
  config_id,
  hour_start,
  day_start,
  syncs_this_hour,
  syncs_this_day,
  blocked_attempts
FROM admob_sync_rate_limit
WHERE config_id = 'your-config-id'
ORDER BY hour_start DESC
LIMIT 24;
```

### View Recent Errors

```sql
SELECT
  error_type,
  error_message,
  severity,
  operation,
  created_at,
  is_resolved
FROM admob_error_log
WHERE config_id = 'your-config-id'
ORDER BY created_at DESC
LIMIT 20;
```

### Check API Quota Usage

```sql
SELECT
  quota_date,
  total_api_calls,
  successful_calls,
  failed_calls,
  total_rows_fetched,
  total_revenue_fetched
FROM admob_api_quota
WHERE config_id = 'your-config-id'
ORDER BY quota_date DESC
LIMIT 30;
```

### View Unresolved Errors

```sql
SELECT
  error_type,
  error_message,
  severity,
  operation,
  created_at
FROM admob_error_log
WHERE is_resolved = false
ORDER BY severity DESC, created_at DESC;
```

### Mark Error as Resolved

```sql
UPDATE admob_error_log
SET
  is_resolved = true,
  resolved_at = now(),
  resolved_by = auth.uid(),
  resolution_notes = 'Fixed by updating credentials'
WHERE id = 'error-id';
```

## Automatic Cleanup

The system automatically cleans up old data:

**Retention Periods:**
- Rate limit records: 7 days
- Resolved errors: 90 days
- Quota records: 30 days

**Manual Cleanup:**
```sql
SELECT cleanup_admob_monitoring_data();
-- Returns: { rate_limits_deleted: 50, errors_deleted: 10, quota_records_deleted: 20 }
```

## Error Types & Handling

### Authentication Errors
- **Type**: `authentication`
- **Common Causes**: Expired credentials, invalid service account
- **Resolution**: Update credentials in config

### API Errors
- **Type**: `api_error`
- **Common Causes**: Invalid request, API changes, quota exceeded
- **Resolution**: Check AdMob dashboard, verify request format

### Rate Limit Errors
- **Type**: `rate_limit`
- **Common Causes**: Too many sync requests
- **Resolution**: Wait for rate limit reset, adjust sync frequency

### Network Errors
- **Type**: `network`
- **Common Causes**: Connection timeout, DNS issues
- **Resolution**: Temporary, usually self-resolves

### Parsing Errors
- **Type**: `parsing`
- **Common Causes**: Unexpected API response format
- **Resolution**: Check API version compatibility

### Database Errors
- **Type**: `database`
- **Common Causes**: Connection issues, constraint violations
- **Resolution**: Check database health, verify schema

## Admin Dashboard Integration

The enhanced system integrates with the admin dashboard:

**Visible Metrics:**
- Current rate limit status
- Recent error count
- Last successful sync
- Consecutive failure count
- API quota usage

**Actions:**
- View detailed error logs
- Resolve errors with notes
- Adjust rate limits
- Configure alerting

## Best Practices

### 1. Monitor Regularly
- Check admin notifications daily
- Review error logs weekly
- Monitor quota usage monthly

### 2. Rate Limit Configuration
- Start conservative (10/hour, 50/day)
- Adjust based on actual needs
- Monitor blocked attempts

### 3. Credential Management
- Rotate credentials every 90 days
- Use Vault for production
- Test after rotation

### 4. Error Response
- Resolve errors promptly
- Document resolution steps
- Update config if needed

### 5. Quota Management
- Stay well below Google's limits
- Monitor usage trends
- Scale sync frequency appropriately

## Troubleshooting

### High Failure Rate
1. Check error logs for patterns
2. Verify credentials are valid
3. Test connection manually
4. Review API quota usage

### Rate Limit Hit Frequently
1. Review sync frequency settings
2. Check for duplicate sync triggers
3. Increase limits if justified
4. Implement better scheduling

### Missing Revenue Data
1. Check sync history for gaps
2. Verify date range settings
3. Manually trigger sync for missing dates
4. Review AdMob dashboard for discrepancies

### Alert Fatigue
1. Adjust alert threshold
2. Fix recurring issues
3. Implement auto-recovery
4. Better error categorization

## Security Considerations

### Credentials Storage
- **Current**: Encrypted in database
- **Recommended**: Use Supabase Vault for production
- **Rotation**: Every 90 days minimum

### Access Control
- Admin-only access to all tables
- Row Level Security enabled
- Audit trail for all changes

### API Security
- Rate limiting prevents abuse
- Token validation on all requests
- Secure credential handling

## Performance Optimization

### Database Indexes
- Optimized for common queries
- Cleanup indexes for old data
- Composite indexes on foreign keys

### Sync Efficiency
- Batch operations where possible
- Avoid redundant syncs
- Use appropriate date ranges

### Monitoring Overhead
- Minimal performance impact
- Async logging operations
- Efficient cleanup processes

## Future Enhancements

### Planned Features
1. Email/SMS alerts for critical errors
2. Automated credential rotation
3. Predictive quota management
4. Advanced analytics dashboard
5. Multi-account support
6. Real-time sync status dashboard

### Integration Opportunities
1. Slack/Discord notifications
2. PagerDuty integration
3. Custom webhooks
4. Analytics platform export
5. Revenue forecasting

## Support & Documentation

### Resources
- Google AdMob API Docs: https://developers.google.com/admob/api
- Supabase Vault: https://supabase.com/docs/guides/database/vault
- Rate Limiting Best Practices: Internal wiki

### Getting Help
1. Check error logs first
2. Review this guide
3. Contact platform admin
4. Submit support ticket

## Conclusion

The enhanced AdMob API integration provides enterprise-grade monitoring, security, and reliability. Regular monitoring and following best practices ensures optimal performance and early detection of issues.
