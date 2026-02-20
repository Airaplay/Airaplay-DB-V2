# Collaboration Settings Integration Complete

## Overview
The Collaborate: Find Your Fit screen is now fully integrated with the Collab tab settings from the Admin Dashboard Treat Manager.

## Admin Dashboard Settings (Collab Tab)

Location: Admin Dashboard > Treat Manager > Collab Tab

### Configurable Settings:

1. **Feature Enable/Disable Toggle**
   - Control: `is_enabled` (boolean)
   - Purpose: Turn the unlock feature on/off globally

2. **Free Matches Count**
   - Control: `free_matches_count` (1-10)
   - Purpose: Number of collaboration matches shown for free per rotation
   - Default: 3 matches

3. **Unlock Cost (Treats)**
   - Control: `unlock_cost_treats` (1-1000)
   - Purpose: Cost in Treats to unlock additional matches
   - Default: 10 Treats

4. **Max Unlockable Matches**
   - Control: `max_unlockable_matches` (1-10)
   - Purpose: Maximum additional matches users can unlock per rotation
   - Default: 1 match

## How It Works

### Database Layer
- Settings stored in: `collaboration_unlock_settings` table
- Singleton pattern ensures only one settings record exists
- RLS policies allow anyone to view, only admins to modify

### Application Layer

#### CollaborateScreen (`/collaborate`)
1. Loads settings using `getCollaborationUnlockSettings()`
2. Displays dynamic text based on settings:
   - When enabled: Shows free match count and unlock cost
   - When disabled: Shows generic match information
3. Separates matches into:
   - **Free matches**: First N matches (based on `free_matches_count`)
   - **Locked matches**: Remaining matches beyond free limit
4. Shows unlock button with dynamic cost from settings

#### LockedMatchCard Component
- Displays blurred match preview
- Shows compatibility score
- Shows unlock button with cost from settings
- Receives `unlockCost` prop from parent

#### CollabUnlockModal Component
- Confirmation modal for unlocking
- Shows cost breakdown
- Checks user's Treats balance
- Validates if user can afford unlock
- Receives `unlockCost` prop from parent

### Service Layer

#### collaborationUnlockService.ts
- `getCollaborationUnlockSettings()`: Fetches settings with 5-minute cache
- `getUserUnlockStatus()`: Checks user's unlock status for current rotation
- `purchaseCollaborationUnlock()`: Processes unlock payment
  - Deducts from purchased_balance first, then earned_balance
  - Creates transaction record
  - Records unlock in database

## Data Flow

```
Admin Updates Settings
    ↓
collaboration_unlock_settings table
    ↓
getCollaborationUnlockSettings() [cached 5 min]
    ↓
CollaborateScreen loads settings
    ↓
Determines free vs locked matches
    ↓
Passes unlockCost to child components
    ↓
LockedMatchCard & CollabUnlockModal display cost
    ↓
User confirms unlock
    ↓
purchaseCollaborationUnlock() processes payment
    ↓
Updates treat_wallets & creates transaction
    ↓
Records unlock in collaboration_unlocks
    ↓
UI refreshes to show unlocked match
```

## Recent Fixes

### 1. Database Constraint Fix
**Issue**: Wallet update violated `balance = earned_balance + purchased_balance` constraint

**Solution**: Now properly updates all three wallet fields:
```typescript
// Deduct from purchased_balance first, then earned_balance
const newBalance = newPurchasedBalance + newEarnedBalance;

// Update all three fields atomically
await supabase.from('treat_wallets').update({
  balance: newBalance,
  purchased_balance: newPurchasedBalance,
  earned_balance: newEarnedBalance
})
```

### 2. Missing RLS Policy Fix
**Issue**: Users couldn't insert unlock records (no INSERT policy)

**Solution**: Added INSERT policy:
```sql
CREATE POLICY "Users can create their own collaboration unlocks"
ON collaboration_unlocks
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
```

### 3. Dynamic Text Update
**Issue**: Hardcoded "4 curated matches" text

**Solution**: Now displays dynamic text based on settings:
```typescript
{unlockSettings && unlockSettings.isEnabled
  ? `${unlockSettings.freeMatchesCount} free match${unlockSettings.freeMatchesCount !== 1 ? 'es' : ''} per rotation, unlock more for ${unlockSettings.unlockCostTreats} Treats each.`
  : 'Matches curated from a pool of 20 artists. Automatically refresh to keep things fresh.'
}
```

## Testing Checklist

### Admin Side
- [ ] Change `free_matches_count` in admin dashboard
- [ ] Verify CollaborateScreen shows correct number of free matches
- [ ] Change `unlock_cost_treats` in admin dashboard
- [ ] Verify LockedMatchCard shows new cost
- [ ] Verify CollabUnlockModal shows new cost
- [ ] Toggle `is_enabled` off
- [ ] Verify all matches are shown without locks
- [ ] Toggle `is_enabled` on
- [ ] Verify locks appear based on `free_matches_count`

### User Side
- [ ] View CollaborateScreen with sufficient Treats
- [ ] Verify 4th match is locked (when free_matches_count=3)
- [ ] Click unlock button
- [ ] Verify modal shows correct cost
- [ ] Confirm unlock
- [ ] Verify Treats deducted correctly
- [ ] Verify match becomes visible
- [ ] Verify transaction recorded
- [ ] View CollaborateScreen with insufficient Treats
- [ ] Verify modal shows "Buy Treats" button

## Configuration Recommendations

### Conservative Setup (Higher Revenue)
- Free Matches: 2
- Unlock Cost: 15-20 Treats
- Max Unlockable: 2

### Balanced Setup (Recommended)
- Free Matches: 3
- Unlock Cost: 10 Treats
- Max Unlockable: 1

### Generous Setup (User-Friendly)
- Free Matches: 4
- Unlock Cost: 5 Treats
- Max Unlockable: 3

## Summary

The Collaborate screen is now fully connected to the admin dashboard settings. All changes made in the Collab tab of the Treat Manager will immediately affect the user experience in the Collaborate screen. Settings are cached for 5 minutes to optimize performance while ensuring changes are reflected quickly.

The system is secure, with proper RLS policies and wallet balance constraints ensuring data integrity and preventing unauthorized access or manipulation.
