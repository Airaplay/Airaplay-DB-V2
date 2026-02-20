# Curator Admin Quick Reference

## Access
**Path:** Admin Dashboard → Listener Curations
**Role Required:** Admin
**Icon:** Users

---

## Quick Actions

### Emergency Controls
```
✅ Disable System Globally → Stops all new curator activity
✅ Disable Monetization → Stops all earnings, keeps playlists live
✅ Block User Monetization → Stops specific curator earnings
```

### Feature Management
```
⭐ Feature Playlist → Add to homepage featured section
⭐ Unfeature Playlist → Remove from featured section
📊 Sort by Plays/Earnings/Engagement → Find top performers
```

### Monetization Control
```
🚫 Block Playlist → Stop earnings for specific playlist
👁️ Unblock Playlist → Resume earnings for playlist
🚫 Block User → Stop earnings for all user's playlists
```

---

## Settings Overview

| Setting | Default | Range | Impact |
|---------|---------|-------|--------|
| Global Status | Enabled | On/Off | Entire system |
| Monetization | Enabled | On/Off | All earnings |
| Min Songs | 10 | 1-100 | Eligibility |
| Min Plays | 0 | 0-10k | Quality gate |
| Revenue % | 5% | 0-20% | Curator share |

---

## Common Tasks

### 1. Review Top Performers
1. Navigate to Listener Curations
2. Select sort: Plays / Earnings / Engagement
3. Review top 10 playlists
4. Consider featuring high performers

### 2. Handle Fraud Alert
1. Check playlist with critical fraud flag
2. Review evidence in fraud detection logs
3. Click 🚫 to block monetization
4. Add reason: "Fraud detected - [specific pattern]"
5. Keep playlist visible for normal playback

### 3. Feature Quality Playlist
1. Find playlist in top performers
2. Click ⭐ button
3. Confirm feature action
4. Playlist appears in homepage featured section

### 4. Adjust Revenue Split
1. Click "Edit Settings"
2. Adjust percentage slider (or type exact number)
3. Review new percentage
4. Click "Save Changes"
5. Changes apply to future earnings

### 5. Block Problematic Curator
1. Find any playlist by curator
2. Click 🚫 button
3. Select "Block User Monetization"
4. Enter reason
5. Confirm - affects all their playlists

---

## Metrics Explained

### Play Count
- Total number of times playlist was played
- Includes all listeners
- Higher = more popular

### Unique Listeners
- Number of different people who played
- Better indicator of reach
- Higher = broader appeal

### Earnings
- Total Treats earned by curator
- Based on ad revenue × revenue split %
- Cumulative lifetime total

### Avg Session Duration
- Average time listeners spent in playlist
- Displayed in minutes
- Higher = better engagement

### Engagement Score
- Formula: (Plays × 1) + (Unique Listeners × 5) + (Avg Duration ÷ 60)
- Composite quality metric
- Higher = overall better performance

---

## Status Badges

| Badge | Color | Meaning |
|-------|-------|---------|
| Approved | Green | Active, monetizable |
| Pending | Yellow | Under review |
| Rejected | Red | Not approved |
| ⭐ Featured | Yellow | Homepage featured |
| 🚫 Blocked | Red | Monetization disabled |

---

## Fraud Integration

When fraud detected:
1. Playlist auto-flagged
2. Earnings automatically paused
3. Admin review required
4. Evidence available in fraud logs
5. Admin can:
   - Approve (clear flag, resume earnings)
   - Reject (block monetization)
   - Investigate (keep paused, gather more data)

---

## SQL Quick Queries

### Find playlists by curator
```sql
SELECT * FROM playlists
WHERE user_id = '[curator-user-id]'
AND curation_status = 'approved';
```

### Check monetization blocks
```sql
SELECT * FROM curator_monetization_blocks
WHERE is_active = true;
```

### View featured playlists
```sql
SELECT p.title, fcp.featured_at
FROM featured_curated_playlists fcp
JOIN playlists p ON fcp.playlist_id = p.id
WHERE fcp.is_active = true
ORDER BY fcp.featured_order DESC;
```

### Get curator total earnings
```sql
SELECT
  u.display_name,
  SUM(ce.amount) as total_earnings
FROM curator_earnings ce
JOIN users u ON ce.curator_id = u.id
GROUP BY u.id, u.display_name
ORDER BY total_earnings DESC;
```

---

## Important Notes

✅ **Actions are non-destructive** - Never delete playlists
✅ **Visibility preserved** - Users always see their playlists
✅ **Earnings only affected** - Blocks stop money, not content
✅ **Changes immediate** - Settings apply instantly
✅ **Past earnings safe** - Blocks don't claw back old earnings
✅ **Logged actions** - All admin actions tracked for audit

---

## Support Escalation

When to contact engineering:
- System-wide fraud attack detected
- Database performance issues
- Bulk action needed (100+ playlists)
- Feature malfunction
- Payment processing errors

When to handle yourself:
- Individual playlist quality issues
- Curator monetization blocks
- Featured playlist management
- Settings adjustments
- Fraud review and approval

---

## Tips for Success

1. **Check daily** - Review top playlists regularly
2. **Feature actively** - Rotate featured playlists weekly
3. **Monitor fraud** - Check flags every 2-3 days
4. **Communicate** - Notify curators of policy changes
5. **Document reasons** - Always add block reasons
6. **Be consistent** - Apply rules fairly across all curators
7. **Test changes** - Adjust one setting at a time
8. **Watch metrics** - Track engagement after changes

---

**For detailed information, see:** `LISTENER_CURATIONS_ADMIN_CONTROLS.md`
**For fraud management, see:** `CURATOR_FRAUD_ADMIN_GUIDE.md`
