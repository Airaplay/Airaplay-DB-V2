# Curator Fraud Detection - Admin Guide

## Quick Reference

### Accessing Fraud Controls
1. Navigate to **Admin Dashboard**
2. Click **Playlist Curations** section
3. View **Silent Curator Monetization** settings panel

## Key Settings

### Revenue Split Configuration
- **Default:** 5% of ad revenue goes to curator
- **Range:** 0-20%
- **Adjustment:** Slide or type exact percentage
- Changes apply to future earnings only

### Monetization Toggle
- **Enabled:** Curators actively earning from playlists
- **Disabled:** All curator earnings paused globally
- Use for emergency fraud response or system maintenance

## Fraud Detection Alerts

### Auto-Flagged Playlists
Playlists are automatically flagged when:
- 3+ fraud events detected in 7 days
- Validation score drops below 30
- Critical bot-like patterns detected

### Flag Severity Levels

| Level | Meaning | Auto Action |
|-------|---------|-------------|
| **Low** | Minor anomalies | Monitor only |
| **Medium** | Suspicious patterns | Admin review |
| **High** | Clear fraud indicators | Earnings paused |
| **Critical** | Bot-like behavior | Earnings paused + Unpublished |

## Fraud Types Explained

### 1. Excessive Daily Plays
- **Detection:** Same listener 10+ plays in 24 hours
- **Likely Cause:** Farming account or bot
- **Action:** Auto-blocks earnings, logs event

### 2. Rapid Successive Plays
- **Detection:** 3+ plays within 1 hour
- **Likely Cause:** Playlist looping for earnings
- **Action:** Warning logged, earnings blocked if repeated

### 3. Insufficient Duration
- **Detection:** Session under 5 minutes
- **Likely Cause:** Skip-through farming
- **Action:** Earnings blocked for that session

### 4. Abnormal Looping
- **Detection:** 5+ sessions within 10-minute gaps in a week
- **Likely Cause:** Coordinated farming
- **Action:** High severity flag, earnings paused

### 5. Bot-Like Pattern
- **Detection:** Average session < 3 minutes over 5+ sessions
- **Likely Cause:** Automated scripts
- **Action:** Critical flag, immediate earnings pause

## Reviewing Flagged Playlists

### Review Queue
Located in Playlist Curations section (filtered by status)

### Information Available
- Playlist details (title, curator, songs)
- Fraud evidence summary
- Pattern analysis
- Listener behavior metrics
- Timeline of suspicious events

### Review Actions

#### 1. Approve (Clear Flag)
- Use when: False positive or resolved issue
- Result: Flag cleared, earnings resume
- Playlist remains published

#### 2. Reject (Unpublish)
- Use when: Confirmed fraud or abuse
- Result: Playlist unpublished, curator notified
- Previous earnings not clawed back (policy decision)

#### 3. Investigate (Keep Flag)
- Use when: Need more data
- Result: Flag remains, earnings stayed paused
- Monitor for additional patterns

## SQL Queries for Investigation

### View Recent Fraud Events
```sql
SELECT
  pfd.*,
  p.title as playlist_title,
  u.display_name as listener_name
FROM playlist_fraud_detection pfd
JOIN playlists p ON pfd.playlist_id = p.id
LEFT JOIN users u ON pfd.listener_id = u.id
WHERE pfd.detected_at > now() - interval '7 days'
  AND pfd.resolved = false
ORDER BY pfd.severity DESC, pfd.detected_at DESC;
```

### View Flagged Playlists
```sql
SELECT
  cff.*,
  p.title as playlist_title,
  u.display_name as curator_name
FROM curator_fraud_flags cff
JOIN playlists p ON cff.playlist_id = p.id
JOIN users u ON cff.curator_id = u.id
WHERE cff.reviewed = false
ORDER BY cff.severity DESC, cff.flagged_at DESC;
```

### Analyze Playlist Patterns
```sql
SELECT
  pls.playlist_id,
  p.title,
  COUNT(*) as total_sessions,
  COUNT(DISTINCT pls.listener_id) as unique_listeners,
  AVG(pls.total_duration_seconds) as avg_duration,
  AVG(pls.validation_score) as avg_validation_score
FROM playlist_listening_sessions pls
JOIN playlists p ON pls.playlist_id = p.id
WHERE pls.session_start > now() - interval '7 days'
GROUP BY pls.playlist_id, p.title
HAVING AVG(pls.validation_score) < 70
ORDER BY avg_validation_score ASC;
```

## Fraud Prevention Best Practices

### For Admins
1. **Regular Monitoring:** Review fraud queue weekly
2. **Quick Response:** Address high/critical flags within 24 hours
3. **Pattern Recognition:** Look for coordinated attacks
4. **Communication:** Notify curators of false positives
5. **Documentation:** Log review decisions for appeals

### For Curators (Educational)
While curators don't see fraud systems, educate them on:
- Organic growth is rewarded
- Gaming the system will be detected
- Quality content attracts genuine listeners
- Short-term farming leads to long-term loss

## Emergency Procedures

### Suspected Large-Scale Fraud
1. Disable monetization globally (toggle off)
2. Review all active flags
3. Analyze listening patterns across playlists
4. Identify coordinated accounts
5. Take appropriate actions
6. Re-enable after cleanup

### False Positive Outbreak
1. Check fraud detection thresholds
2. Review recent algorithm changes
3. Manually approve legitimate flags
4. Adjust validation scoring if needed
5. Monitor for recurrence

## Performance Metrics

### Healthy System Indicators
- ✅ Validation score average >80
- ✅ <5% of plays flagged
- ✅ <2% of playlists flagged
- ✅ Most flags resolved within 48 hours
- ✅ Fraud detection rate increasing over time

### Red Flags
- 🚩 Sudden spike in fraud events
- 🚩 Same IP addresses across multiple accounts
- 🚩 Coordinated timing patterns
- 🚩 Multiple playlists from same curator flagged
- 🚩 Validation scores dropping platform-wide

## Support & Escalation

### When to Escalate
- Suspected coordinated attack
- False positive affecting many curators
- System performance issues
- Database anomalies
- Legal concerns

### Escalation Path
1. Document the issue thoroughly
2. Gather SQL query results
3. Export fraud event logs
4. Contact system administrator
5. Preserve evidence for investigation

## FAQ

**Q: Will curators know they're flagged?**
A: No. All fraud detection is silent. Curators only notice if their playlist is unpublished after review.

**Q: Can curators appeal?**
A: Yes, through support tickets. Admins review appeals with full evidence access.

**Q: Do we claw back fraudulent earnings?**
A: Policy decision. System supports it but not enabled by default to avoid curator disputes.

**Q: How accurate is the fraud detection?**
A: Validation scoring is conservative. Score <50 is high confidence fraud. False positives should be <1%.

**Q: Can legitimate power users trigger flags?**
A: Unlikely. Natural listening rarely exceeds 10 plays/day or shows bot patterns. Review easily clears these.

---

**For Technical Issues:** See `CURATOR_ANTI_FRAUD_SYSTEM.md`
**For Feature Requests:** Contact development team
**Last Updated:** 2025-12-27
