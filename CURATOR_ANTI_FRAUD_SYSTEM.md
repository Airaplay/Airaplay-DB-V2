# Curator Anti-Fraud System

## Overview
Comprehensive fraud detection and prevention system for Listener Curations monetization that protects against abuse while maintaining normal playlist playback functionality.

## Anti-Fraud Measures Implemented

### 1. Self-Listening Prevention
**Status:** ✅ Implemented
- Playlist creators cannot earn from their own playlists
- Validated at database level in `process_curator_ad_revenue()`
- Returns blocked with reason: `own_content`

### 2. Duplicate Stream Prevention
**Status:** ✅ Implemented
- Blocks repeated earnings from same listener within 24 hours
- Checked via `playlist_ad_impressions` history
- Returns blocked with reason: `duplicate_play`

### 3. Minimum Listening Duration
**Status:** ✅ Implemented
- **Requirement:** 5 minutes (300 seconds) minimum per session
- Enforced before any earnings are credited
- Returns blocked with reason: `insufficient_duration`
- Session duration tracked in `playlist_listening_sessions` table

### 4. Excessive Play Detection
**Status:** ✅ Implemented
- **Daily Limit:** Maximum 10 plays per listener per playlist
- **Hourly Limit:** Maximum 3 plays per listener per playlist
- Severity: High for daily, Medium for hourly
- Auto-logs to `playlist_fraud_detection` table

### 5. Abnormal Looping Behavior
**Status:** ✅ Implemented
- Detects listeners repeatedly looping playlists
- **Threshold:** 5+ sessions within 10 minutes in a week
- Severity: High
- Indicates potential farming behavior

### 6. Bot-Like Pattern Detection
**Status:** ✅ Implemented
- Analyzes average session durations
- Flags accounts with consistently short sessions
- **Threshold:** Average < 3 minutes over 5+ sessions
- Severity: Critical
- Suggests automated behavior

### 7. Validation Scoring
**Status:** ✅ Implemented
- Each play receives validation score (0-100)
- Scoring penalties:
  - Excessive daily plays: -50 points
  - Rapid successive plays: -30 points
  - Insufficient duration: -40 points
  - Abnormal looping: -35 points
  - Bot-like pattern: -45 points
- **Blocking Threshold:** Score < 50 blocks earnings

### 8. Automatic Playlist Flagging
**Status:** ✅ Implemented
- Auto-flags playlists with suspicious patterns
- **Trigger:** 3+ unresolved fraud events in 7 days
- Severity levels: Low, Medium, High, Critical
- High/Critical = Earnings automatically paused
- Critical = Playlist status reverted to 'pending'

### 9. Admin Review Queue
**Status:** ✅ Implemented
- Flagged playlists sent to admin dashboard
- Evidence stored in `curator_fraud_flags` table
- Admins can review, approve, or reject
- Manual earnings pause/resume controls

## Database Tables

### `playlist_listening_sessions`
Complete tracking of listening sessions:
- Session duration, songs played, completion status
- Validation score for fraud detection
- IP address and user agent for pattern analysis

### `playlist_fraud_detection`
Logs all suspicious patterns:
- Fraud type (excessive_daily_plays, rapid_successive_plays, etc.)
- Severity level (low, medium, high, critical)
- Evidence and metadata
- Resolution tracking

### `curator_fraud_flags`
Admin review queue:
- Auto-detected or manually flagged playlists
- Evidence bundle with detection details
- Earnings pause status
- Review workflow tracking

## Functions

### `detect_playlist_fraud_patterns()`
Comprehensive fraud detection:
- Analyzes play frequency and patterns
- Calculates validation score
- Logs fraud events automatically
- Returns detailed fraud check results

### `auto_flag_suspicious_playlist()`
Automatic flagging system:
- Counts recent fraud events
- Determines severity level
- Creates admin review flag
- Pauses earnings if critical

### `process_curator_ad_revenue()` (Enhanced)
Revenue processing with fraud checks:
- Validates session duration (≥5 minutes)
- Checks duplicate plays (24-hour window)
- Verifies playlist not flagged
- Runs comprehensive fraud detection
- Blocks earnings if fraud detected (score < 50)
- Auto-flags if score < 30
- Records validated sessions

## Fraud Check Flow

```
1. Listener plays approved playlist with ad
   ↓
2. Check minimum duration (300 seconds)
   ↓ PASS
3. Check duplicate play (24 hours)
   ↓ PASS
4. Check playlist flagged status
   ↓ PASS
5. Run fraud pattern detection
   ↓
6. Calculate validation score
   ↓
7. Score ≥ 50?
   ↓ YES
8. Credit curator earnings silently

   NO → Block earnings + Log fraud + Auto-flag if score < 30
```

## Fraud Types & Thresholds

| Fraud Type | Detection Criteria | Severity | Score Penalty |
|------------|-------------------|----------|---------------|
| Excessive Daily Plays | ≥10 plays/day | High | -50 |
| Rapid Successive Plays | ≥3 plays/hour | Medium | -30 |
| Insufficient Duration | <300 seconds | Medium | -40 |
| Abnormal Looping | ≥5 rapid replays/week | High | -35 |
| Bot-Like Pattern | Avg <180s over 5+ sessions | Critical | -45 |

## Normal Playback Protection

**IMPORTANT:** Fraud detection ONLY blocks earnings, never playback:

✅ Listeners can always play any playlist
✅ Playback experience never interrupted
✅ No user-facing error messages about fraud
✅ Playlist creators don't see fraud flags
✅ Only earnings are silently blocked when abuse detected

## Admin Controls

Admins have full visibility and control:

1. **Review Queue** - View all flagged playlists
2. **Evidence Viewer** - Detailed fraud pattern analysis
3. **Manual Actions:**
   - Approve (clear flag, resume earnings)
   - Reject (unpublish playlist)
   - Investigate (keep flag, gather more data)
4. **Monetization Toggle** - Enable/disable curator earnings globally
5. **Revenue Split Adjustment** - Configure curator percentage

## Development Logging

In development mode, console logs show:

**Successful Earnings:**
```javascript
[Curator Monetization] Earnings processed: {
  curator_id: "...",
  curator_share: 0.05,
  revenue_split: 5,
  session_duration: 420,
  validation_score: 100
}
```

**Blocked Earnings:**
```javascript
[Curator Monetization] Earnings blocked: {
  reason: "Fraudulent pattern detected",
  blocked_reason: "fraud_detected",
  fraud_check: { validation_score: 35, fraud_reasons: [...] }
}
```

## Testing Scenarios

### Legitimate Use Cases (Should Earn)
- ✅ Listener plays 5-minute session with ad
- ✅ Different listeners play throughout the day
- ✅ Natural listening patterns with varied durations
- ✅ Occasional replays with time gaps

### Fraud Cases (Should Block)
- ❌ Creator playing own playlist
- ❌ Same listener 11+ times in 24 hours
- ❌ Session duration under 5 minutes
- ❌ Rapid successive plays (3+ per hour)
- ❌ Playlist looping within 10-minute windows
- ❌ Bot-like consistent short sessions

## Performance Considerations

- Fraud checks run asynchronously
- Validation indexed for fast queries
- Session tracking lightweight
- No impact on playback performance
- Fraud logs archived after 90 days

## Future Enhancements

Potential improvements:
- Machine learning fraud scoring
- IP-based geolocation analysis
- Device fingerprinting
- Cross-playlist pattern detection
- Listener reputation scoring
- Time-of-day analysis
- Collaborative filtering for anomalies

## Security Notes

- All fraud detection tables have RLS enabled
- Admin-only access to fraud detection data
- Service role functions for validation
- Sensitive data (IP, user agent) restricted
- No personal data exposed to curators
- Fraud flags reviewed privately

---

**Status:** Production Ready ✅
**Build:** Successful (23.86s)
**Last Updated:** 2025-12-27
