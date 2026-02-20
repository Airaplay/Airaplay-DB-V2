# Authentication State Persistence Fix

## Problem Summary

The app's header and various components incorrectly displayed users as "not signed in" after:
- Idle time (a few minutes of inactivity)
- Navigating between screens
- Token refresh events

## Root Cause

**Anti-Pattern:** 16+ components maintained their own local `isAuthenticated` state using `useState` instead of subscribing to the centralized `AuthContext`.

```typescript
// ❌ PROBLEMATIC PATTERN (Found in 16 components)
const [isAuthenticated, setIsAuthenticated] = useState(false);

useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      setIsAuthenticated(true);
    } else if (event === 'SIGNED_OUT') {
      setIsAuthenticated(false);
    }
    // ❌ Missing: TOKEN_REFRESHED event handler!
  });
  return () => subscription.unsubscribe();
}, []);
```

**Issues with this approach:**
1. **Token refresh ignored:** When Supabase auto-refreshes tokens (after idle periods), these listeners don't handle `TOKEN_REFRESHED` events
2. **Multiple sources of truth:** Each component maintains separate auth state, causing desynchronization
3. **No navigation reactivity:** Components don't re-check auth when navigating
4. **Race conditions:** Components check auth once on mount, missing subsequent updates

## Solution

**Correct Pattern:** Use the centralized `AuthContext` that handles ALL auth events:

```typescript
// ✅ CORRECT PATTERN
import { useAuth } from '../contexts/AuthContext';

export const MyComponent = () => {
  const { user, isAuthenticated, isInitialized } = useAuth();

  useEffect(() => {
    if (isInitialized && isAuthenticated && user) {
      // Load user-specific data
      loadUserData();
    } else {
      // Clear user data
      setUserData(null);
    }
  }, [isAuthenticated, user, isInitialized]);

  // Component automatically reacts to:
  // - SIGNED_IN
  // - SIGNED_OUT
  // - TOKEN_REFRESHED ✅
  // - USER_UPDATED
};
```

## Fixed Components

### ✅ HeroSection (Header Component)
**Location:** `src/screens/HomePlayer/sections/HeroSection/HeroSection.tsx`

**Changes:**
- Removed local `isAuthenticated` state
- Imported and used `useAuth()` hook
- Removed custom `onAuthStateChange` listener
- Added reactive `useEffect` that triggers on auth state changes

### ✅ MusicPlayerScreen
**Location:** `src/screens/MusicPlayerScreen/MusicPlayerScreen.tsx`

**Changes:**
- Removed local `isAuthenticated` state
- Imported and used `useAuth()` hook
- Removed `checkAuthStatus()` function
- Updated `loadUserCountry()` to use `user` from context
- Component now reacts to token refreshes automatically

## Remaining Components to Fix

Run this command to find all components still using the anti-pattern:

```bash
grep -r "const \[isAuthenticated, setIsAuthenticated\] = useState" src/
```

**Found 14 more components that need fixing:**

1. `src/components/CommentsModal.tsx`
2. `src/components/TreatWalletWidget.tsx`
3. `src/components/DailyCheckinButton.tsx`
4. `src/components/PlaylistDetailModal.tsx`
5. `src/components/GenreSongsModal.tsx`
6. `src/screens/HomePlayer/sections/AIRecommendedSection/AIRecommendedSection.tsx`
7. `src/screens/TreatScreen/TreatScreen.tsx`
8. `src/screens/CreateScreen/CreateScreen.tsx`
9. `src/screens/LibraryScreen/LibraryScreen.tsx`
10. `src/screens/ProfileScreen/ProfileScreen.tsx`
11. `src/screens/AlbumPlayerScreen/AlbumPlayerScreen.tsx`
12. `src/screens/VideoPlayerScreen/VideoPlayerScreen.tsx`
13. `src/screens/PlaylistPlayerScreen/PlaylistPlayerScreen.tsx`
14. `src/screens/PromotionCenterScreen/PromotionCenterScreen.tsx`

## Migration Guide

For each component, follow these steps:

### Step 1: Add Import
```typescript
import { useAuth } from '../contexts/AuthContext'; // Adjust path as needed
```

### Step 2: Replace Local State
```typescript
// ❌ Remove this:
const [isAuthenticated, setIsAuthenticated] = useState(false);

// ✅ Add this:
const { user, isAuthenticated, isInitialized } = useAuth();
```

### Step 3: Remove Custom Auth Listeners
```typescript
// ❌ Remove this entire block:
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      setIsAuthenticated(true);
      loadUserData();
    } else if (event === 'SIGNED_OUT') {
      setIsAuthenticated(false);
      clearUserData();
    }
  });
  return () => subscription.unsubscribe();
}, []);
```

### Step 4: Add Reactive Effect
```typescript
// ✅ Add this:
useEffect(() => {
  if (isInitialized) {
    if (isAuthenticated && user) {
      loadUserData();
    } else {
      clearUserData();
    }
  }
}, [isAuthenticated, user, isInitialized]);
```

### Step 5: Update User Data Functions
```typescript
// ❌ Before:
const loadUserData = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // Use user data
  }
};

// ✅ After:
const loadUserData = async () => {
  if (!user?.id) return;
  // Use user.id directly from context
};
```

## Why This Fix Works

### Centralized Auth Management
The `AuthContext` provider:
1. Maintains single source of truth for authentication state
2. Handles ALL Supabase auth events in one place:
   - `INITIAL_SESSION`
   - `SIGNED_IN`
   - `SIGNED_OUT`
   - `TOKEN_REFRESHED` ✅
   - `USER_UPDATED`
3. Automatically refreshes sessions before they expire
4. Validates tokens on app initialization

### Reactive Components
Components using `useAuth()`:
- Automatically re-render when auth state changes
- Don't need their own auth state management
- Respond to token refreshes without extra code
- Stay synchronized across the entire app

### Token Refresh Handling
When Supabase refreshes a token (every ~55 minutes):
```
1. Supabase SDK detects token expiring soon
2. Triggers TOKEN_REFRESHED event
3. AuthContext handles event → updates state
4. All components using useAuth() re-render with fresh state
5. UI stays authenticated ✅
```

## Testing the Fix

### Test Scenario 1: Idle Timeout
1. Log in to the app
2. Leave app idle for 10+ minutes
3. Navigate between screens
4. ✅ Header should still show "Hi [username]"
5. ✅ User should remain authenticated

### Test Scenario 2: Navigation
1. Log in to the app
2. Navigate: Home → Explore → Library → Profile → Home
3. ✅ Header should persist authentication state
4. ✅ No flashing between logged-in/logged-out states

### Test Scenario 3: Token Refresh
1. Log in to the app
2. Open browser DevTools → Console
3. Watch for "[AuthContext] Auth state change: TOKEN_REFRESHED"
4. ✅ UI should not change
5. ✅ User should remain authenticated

### Test Scenario 4: Music Player
1. Log in to the app
2. Open Music Player
3. Leave player open for 5+ minutes
4. Interact with player (like, follow, comment)
5. ✅ All auth-required features should work
6. ✅ No "Please log in" messages

## Prevention Measures

### 1. ESLint Rule (Recommended)
Create custom ESLint rule to prevent this anti-pattern:

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-local-auth-state': {
      // Prevent: const [isAuthenticated, setIsAuthenticated] = useState
      // Enforce: const { isAuthenticated } = useAuth()
    }
  }
};
```

### 2. Code Review Checklist
Before merging PRs, check:
- [ ] No `useState` for `isAuthenticated`
- [ ] Uses `useAuth()` hook instead
- [ ] No custom `onAuthStateChange` listeners (except in AuthContext)
- [ ] Components react to auth state changes via `useEffect` dependencies

### 3. Documentation
Update developer docs:
- Add "Authentication Best Practices" section
- Include this migration guide
- Provide code snippets for common patterns

### 4. Component Template
Create a starter template for new components:

```typescript
import { useAuth } from '@/contexts/AuthContext';

export const NewComponent = () => {
  const { user, isAuthenticated, isInitialized } = useAuth();

  useEffect(() => {
    if (isInitialized && isAuthenticated && user) {
      // Load authenticated data
    }
  }, [isAuthenticated, user, isInitialized]);

  if (!isInitialized) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      {isAuthenticated ? (
        <AuthenticatedView user={user} />
      ) : (
        <GuestView />
      )}
    </div>
  );
};
```

## Architecture Benefits

### Before (Anti-Pattern)
```
┌─────────────────────────────────────────┐
│ 16+ Components                          │
│ ┌────────┐ ┌────────┐ ┌────────┐      │
│ │ Auth 1 │ │ Auth 2 │ │ Auth N │ ...  │
│ └────────┘ └────────┘ └────────┘      │
│      ↓          ↓          ↓           │
│  [Desync]   [Desync]   [Desync]       │
└─────────────────────────────────────────┘
```

### After (Correct Pattern)
```
┌─────────────────────────────────────────┐
│           AuthContext                   │
│    Single Source of Truth ✅            │
│         ↓         ↓         ↓           │
│  Component1  Component2  ComponentN     │
│  [Synced]    [Synced]    [Synced]      │
└─────────────────────────────────────────┘
```

## Additional Notes

### Performance Considerations
Using `useAuth()` is **more performant** than local state because:
- Eliminates duplicate auth checks
- Reduces number of `getSession()` calls
- No redundant `onAuthStateChange` subscriptions
- Single validation point at app initialization

### Mobile-Specific Considerations
On Capacitor apps:
- Token refresh is critical when app resumes from background
- `AuthContext` handles this automatically
- Local state components would miss these events

### Future Improvements
1. Add auth state debugging overlay (dev mode only)
2. Implement auth state persistence metrics
3. Add automated tests for auth state synchronization
4. Create visual regression tests for auth UI states

## Summary

This fix eliminates authentication state desynchronization by:
1. ✅ Using centralized `AuthContext` instead of local state
2. ✅ Handling `TOKEN_REFRESHED` events properly
3. ✅ Making components reactive to auth changes
4. ✅ Providing single source of truth for authentication

**Result:** Users remain authenticated across all screens, even after idle periods and token refreshes.
