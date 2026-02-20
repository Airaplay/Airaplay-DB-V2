# Auth Screen Flash Fix

## Issue
When non-authenticated users navigated to Create, Library, or Profile screens, they would briefly see a loading skeleton (with animated placeholders) before the "Sign In Required" screen appeared. This created an unpleasant flash of content (FOUC - Flash of Unstyled/Unauthenticated Content).

## Root Cause
The screens were checking authentication state asynchronously while immediately rendering loading skeletons. The skeleton UI looked like actual content, which made the transition jarring when it switched to the "Sign In Required" screen.

## Solution
Updated all affected screens to use the centralized AuthContext's `isInitialized` state and show a cleaner loading state:

### Changes Made

1. **CreateScreen** (`src/screens/CreateScreen/CreateScreen.tsx`)
   - Added `useAuth` hook to access `isInitialized` state
   - Replaced skeleton loading UI with simple `LoadingLogo` component
   - Changed condition from `isAuthenticated === null || isLoading` to `!isInitialized || isLoading`
   - Removed local `isAuthenticated` state management (now uses AuthContext)

2. **LibraryScreen** (`src/screens/LibraryScreen/LibraryScreen.tsx`)
   - Added `useAuth` hook to access `isInitialized` state
   - Replaced grid skeleton loading UI with simple `LoadingLogo` component
   - Changed condition from `isAuthenticated === null || isLoading` to `!isInitialized || isLoading`
   - Removed local `isAuthenticated` state management (now uses AuthContext)

3. **ProfileScreen** (`src/screens/ProfileScreen/ProfileScreen.tsx`)
   - Updated to use AuthContext's `isInitialized` state
   - Shows `LoadingLogo` while auth is initializing
   - Shows `ProfileSkeleton` only when loading user profile data (not during auth check)
   - Separated auth initialization check from data loading check

## Result
Now when non-authenticated users navigate to these screens:
1. They see a clean loading logo (no content flash)
2. Once auth check completes, they immediately see the "Sign In Required" screen
3. No jarring transition or content flash

## Technical Details

**Before:**
```typescript
if (isAuthenticated === null || isLoading) {
  return <SkeletonUI />; // Looks like content
}
```

**After:**
```typescript
if (!isInitialized || isLoading) {
  return <LoadingLogo />; // Clean, minimal loading state
}

if (!authIsAuthenticated) {
  return <SignInRequired />;
}
```

The key improvement is using `isInitialized` from AuthContext, which is specifically designed to track when the initial auth check is complete, ensuring we don't show any content-like UI until we know the user's auth state.
