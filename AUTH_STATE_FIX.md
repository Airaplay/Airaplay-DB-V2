# Authentication State Fix - Persistent Sign-In for Mobile Apps

## 🔍 Problem Identified

After a few minutes of using the mobile app, the Home Screen suddenly behaves as if the user is not signed in, even though they never logged out. The app starts reloading repeatedly. However, when the app is fully closed and reopened, it correctly shows the user is still signed in.

### Root Causes

1. **Session Expiration Without Refresh**: Supabase sessions expire after a period of inactivity, but the app wasn't automatically refreshing them
2. **No App Lifecycle Handling**: When the app goes to background/foreground, sessions weren't being checked or refreshed
3. **Stale Session Errors**: Components using `getSession()` were failing when sessions expired, causing auth state to appear as "not signed in"
4. **Missing Session Refresh Configuration**: Supabase client wasn't explicitly configured for optimal session handling
5. **Incorrect Error Handling**: App was treating temporary session errors (network issues, expired tokens) as "user logged out" instead of "need to refresh session"
6. **Mobile App Expectation**: In mobile apps, users should stay signed in until they explicitly log out - the app wasn't respecting this

---

## ✅ Solution Implemented

### 1. Enhanced Supabase Client Configuration

**File**: `src/lib/supabase.ts`

- Added explicit `autoRefreshToken: true` to ensure automatic token refresh
- Added `persistSession: true` to maintain sessions across app restarts
- Configured proper storage for session persistence

### 2. Session Refresh Utility Functions

**File**: `src/lib/supabase.ts`

Created two utility functions:

**`refreshSessionIfNeeded()`**: 
- Checks if session is expired or expiring soon (within 10 minutes - more aggressive)
- Automatically refreshes the session if needed
- Only fails if refresh token is truly invalid (user logged out or token revoked)
- For network errors, assumes session is still valid (mobile app behavior)

**`getAuthenticatedSession()`**:
- Enhanced session getter that automatically refreshes before returning
- Ensures users stay signed in until they explicitly log out
- Handles expired sessions transparently
- Only returns "no session" if user is truly not signed in

```typescript
export const getAuthenticatedSession = async () => {
  // Automatically refreshes session if needed
  // Users stay signed in until they explicitly log out
}
```

### 3. App Lifecycle Handler

**File**: `src/index.tsx`

Added comprehensive app lifecycle management:
- **Foreground Detection**: When app comes to foreground, automatically refreshes session
- **Periodic Refresh**: Refreshes session every 10 minutes while app is active
- **Native Platform Only**: Only runs on Capacitor native platforms (Android/iOS)

### 4. Enhanced Auth Handling Across All Screens

**Files**: 
- `src/screens/HomePlayer/sections/HeroSection/HeroSection.tsx`
- `src/screens/CreateScreen/CreateScreen.tsx`
- `src/screens/TreatScreen/TreatScreen.tsx`
- `src/screens/LibraryScreen/LibraryScreen.tsx`

Improved all auth check functions to:
- Use `getAuthenticatedSession()` for automatic session refresh
- Only set `isAuthenticated(false)` if refresh token is truly invalid
- Don't treat temporary errors (network, expired tokens) as "logged out"
- Maintain auth state during temporary connectivity issues
- Respect mobile app behavior: users stay signed in until they log out

### 5. Global Auth State Listener Enhancement

**File**: `src/index.tsx`

Enhanced the global `onAuthStateChange` listener to:
- Log `TOKEN_REFRESHED` events for debugging
- Better handle session refresh events
- Maintain consistent auth state across the app

---

## 🔧 Technical Details

### Session Refresh Strategy

1. **Proactive Refresh**: Session is refreshed when:
   - App comes to foreground (after being in background)
   - Periodically every 10 minutes while app is active
   - Before critical auth checks in all screens
   - When session expires within 10 minutes (more aggressive)

2. **Refresh Timing**: 
   - Refreshes if session expires within 10 minutes (increased from 5)
   - Prevents "expired session" errors before they occur
   - More aggressive refresh ensures users never see "logged out" incorrectly

3. **Error Handling - Mobile App Behavior**:
   - **Network errors**: Don't log user out - assume session is still valid
   - **Expired tokens**: Automatically refresh - user stays signed in
   - **Invalid refresh token**: Only then treat as "logged out" (user actually logged out or token revoked)
   - **Temporary failures**: Keep current auth state - don't show false "logged out"
   - **Mobile app principle**: Users stay signed in until they explicitly log out

### App Lifecycle Events

- **`appStateChange`**: Listens for app going to background/foreground
- **`isActive: true`**: Triggers session refresh when app becomes active
- **Periodic Interval**: 10-minute refresh cycle while app is active

---

## 📝 Files Modified

1. **`src/lib/supabase.ts`**
   - Enhanced Supabase client configuration
   - Added `refreshSessionIfNeeded()` utility function

2. **`src/index.tsx`**
   - Added app lifecycle handler for foreground/background
   - Enhanced global auth state change listener
   - Added periodic session refresh

3. **`src/screens/HomePlayer/sections/HeroSection/HeroSection.tsx`**
   - Improved session refresh handling
   - Better error recovery for expired sessions

---

## 🧪 Testing Checklist

### Test on Android Device

1. **Basic Session Persistence**:
   - [ ] Sign in to the app
   - [ ] Use the app for 10+ minutes
   - [ ] Verify you remain signed in throughout
   - [ ] Check that Home Screen still shows authenticated state

2. **Background/Foreground**:
   - [ ] Sign in to the app
   - [ ] Put app in background (press home button)
   - [ ] Wait 2-3 minutes
   - [ ] Bring app back to foreground
   - [ ] Verify you're still signed in
   - [ ] Check that Home Screen shows correct auth state

3. **Extended Session**:
   - [ ] Sign in to the app
   - [ ] Use the app for 30+ minutes continuously
   - [ ] Verify session doesn't expire
   - [ ] Check that navigation and all screens work correctly

4. **Network Interruption**:
   - [ ] Sign in to the app
   - [ ] Turn off WiFi/data briefly
   - [ ] Turn it back on
   - [ ] Verify session is restored/refreshed
   - [ ] Check that app doesn't show "not signed in" incorrectly

5. **App Reload Prevention**:
   - [ ] Sign in to the app
   - [ ] Use the app normally
   - [ ] Verify app doesn't reload repeatedly
   - [ ] Check that auth state remains consistent

---

## 🔍 Debugging

### Check Session Status

Add this to browser console or use React DevTools:

```javascript
// Check current session
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);
console.log('Expires at:', session?.expires_at);
console.log('Expires in:', session?.expires_at ? (session.expires_at - Math.floor(Date.now() / 1000)) : 'N/A', 'seconds');
```

### Monitor Auth Events

The app now logs auth events:
- `[Auth] Global auth state change: TOKEN_REFRESHED`
- `[App] App came to foreground, checking session...`
- `[Auth] Session expiring soon, refreshing...`
- `[Auth] Session refreshed successfully`

### Common Issues

1. **Still seeing "not signed in" after a few minutes**:
   - Check network connectivity
   - Verify Supabase project is accessible
   - Check browser console for auth errors
   - Verify session refresh is happening (check logs)

2. **App still reloading**:
   - Check for other error sources (not just auth)
   - Verify no infinite loops in useEffect hooks
   - Check React DevTools for component re-renders

3. **Session refresh failing**:
   - Check Supabase project settings
   - Verify JWT expiration settings
   - Check refresh token validity

---

## 📊 Expected Behavior

### Before Fix
- ❌ Session expires after a few minutes
- ❌ App shows "not signed in" incorrectly
- ❌ App reloads repeatedly
- ❌ User has to close and reopen app

### After Fix
- ✅ Session automatically refreshes before expiration
- ✅ App maintains auth state correctly
- ✅ No unnecessary reloads
- ✅ Seamless user experience

---

## 🚀 Next Steps

1. **Build and Test**:
   ```bash
   npm run build
   npx cap sync android
   npx cap open android
   ```

2. **Test on Physical Device**: 
   - Test extended sessions (30+ minutes)
   - Test background/foreground transitions
   - Monitor console logs for auth events

3. **Monitor in Production**:
   - Watch for session refresh errors
   - Monitor auth state change events
   - Track user session duration

---

## 📄 Related Files

- `src/lib/supabase.ts` - Supabase client and session refresh utility
- `src/index.tsx` - App lifecycle and global auth state management
- `src/screens/HomePlayer/sections/HeroSection/HeroSection.tsx` - Home screen auth handling

---

**Status**: ✅ Complete - Session refresh and app lifecycle handling implemented

