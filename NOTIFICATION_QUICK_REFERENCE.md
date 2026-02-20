# Notification System - Quick Reference

## When Users Get Notified

### 💰 Treat Transactions
| Action | Notification |
|--------|-------------|
| **Purchase Treats** | ✅ "You successfully purchased X Treats!" |
| **Receive Treats** | ✅ "You received X Treats from [user]!" |
| **Send Treats** | ✅ "You sent X Treats to [user]." |
| **Withdraw Treats** | ✅ "You withdrew X Treats from your wallet." |

### 🎵 Content Interactions
| Action | Notification |
|--------|-------------|
| **Song Added to Playlist** | ✅ Artist notified: "Your song was added to [playlist] by [user]." |

### 💵 Withdrawal Requests
| Action | Notification |
|--------|-------------|
| **Request Withdrawal** | ✅ "Your withdrawal request for $X has been submitted." |
| **Withdrawal Approved** | ✅ "Great news! Your withdrawal request for $X has been approved." |

### 📢 Promotions
| Action | Notification |
|--------|-------------|
| **Promotion Goes Active** | ✅ "Your [type] promotion is now active! It will run for X days." |

## Notification Types

- **`system`**: General system notifications (purchases, playlist adds)
- **`tip`**: Treat send/receive notifications
- **`withdrawal`**: Withdrawal-related notifications
- **`promotion`**: Promotion status updates

## Implementation

All notifications are **automatically created** by database triggers. No manual code needed!

### Triggers Active On:
- ✅ `treat_transactions` table (all Treat operations)
- ✅ `playlist_songs` table (song additions)
- ✅ `withdrawal_requests` table (requests and approvals)
- ✅ `promotions` table (status changes)

## Key Features

1. **Instant Delivery**: Notifications appear immediately
2. **Smart Context**: Includes sender/recipient names when available
3. **Rich Metadata**: JSON data for detailed information
4. **No Duplicates**: Artists don't get notified for their own actions
5. **Read Tracking**: Users can mark as read/unread
6. **Secure**: RLS policies ensure users only see their notifications

## Testing

To test notifications:

1. **Treat Purchase**: Buy Treats → Check notifications
2. **Treat Tip**: Send tip to creator → Both get notified
3. **Playlist Add**: Add someone's song to playlist → Artist notified
4. **Withdrawal**: Request withdrawal → Get confirmation, then approval notification
5. **Promotion**: Create promotion → Get notification when it goes active

## Quick Troubleshooting

**No notifications appearing?**
- Check if user is authenticated
- Verify transaction completed successfully
- Ensure correct transaction_type is used

**Duplicate notifications?**
- Should not happen - contact admin if it does

**Missing details in notification?**
- Check metadata is populated in original transaction

## For Developers

### Create Manual Notification (if needed)
```typescript
import { createNotification } from './lib/notificationService';

await createNotification({
  userId: user.id,
  type: 'system',
  message: 'Your custom message here',
  metadata: { key: 'value' }
});
```

### Notification Service Functions
- `createNotification()` - Create notification manually
- `markNotificationAsRead()` - Mark single as read
- `markAllNotificationsAsRead()` - Mark all as read
- `deleteNotification()` - Delete single notification
- `getUnreadNotificationCount()` - Get unread count

## Database Tables

### `notifications`
Stores all user notifications with:
- `user_id` - Recipient
- `type` - Notification category
- `message` - Display text
- `metadata` - Additional JSON data
- `is_read` - Read status
- `created_at` - Timestamp

### Related Tables
- `treat_transactions` - Triggers Treat notifications
- `playlist_songs` - Triggers playlist notifications
- `withdrawal_requests` - Triggers withdrawal notifications
- `promotions` - Triggers promotion notifications

## Migration
- **File**: `create_comprehensive_notification_triggers.sql`
- **Status**: ✅ Applied
- **Build**: ✅ Successful

---

**Everything is automatic! Just use the app normally and users will receive appropriate notifications.**
