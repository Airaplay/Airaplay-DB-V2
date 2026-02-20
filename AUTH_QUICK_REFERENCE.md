# Authentication Quick Reference

## ✅ DO THIS (Correct Pattern)

```typescript
import { useAuth } from '@/contexts/AuthContext';

export const MyComponent = () => {
  // Get auth state from context
  const { user, isAuthenticated, isInitialized } = useAuth();
  const [userData, setUserData] = useState(null);

  // React to auth state changes
  useEffect(() => {
    if (isInitialized && isAuthenticated && user) {
      loadUserData();
    } else {
      setUserData(null);
    }
  }, [isAuthenticated, user, isInitialized]);

  const loadUserData = async () => {
    // Use user.id from context
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    setUserData(data);
  };

  if (!isInitialized) {
    return <Spinner />;
  }

  return (
    <div>
      {isAuthenticated ? (
        <p>Welcome, {user.email}</p>
      ) : (
        <p>Please log in</p>
      )}
    </div>
  );
};
```

## ❌ DON'T DO THIS (Anti-Pattern)

```typescript
export const MyComponent = () => {
  // ❌ DON'T: Local auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ❌ DON'T: Custom auth listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN') {
          setIsAuthenticated(true);
        }
        // ❌ Missing: TOKEN_REFRESHED handler!
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // ❌ DON'T: Manual session check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    checkAuth();
  }, []);
}
```

## Common Patterns

### Pattern 1: Protected Action

```typescript
const { isAuthenticated, user } = useAuth();

const handleLike = async () => {
  if (!isAuthenticated) {
    showLoginModal();
    return;
  }

  await likeSong(songId, user.id);
};
```

### Pattern 2: Conditional Rendering

```typescript
const { isAuthenticated, isInitialized } = useAuth();

if (!isInitialized) {
  return <LoadingSpinner />;
}

return (
  <div>
    {isAuthenticated ? (
      <AuthenticatedView />
    ) : (
      <GuestView />
    )}
  </div>
);
```

### Pattern 3: User Data Loading

```typescript
const { user, isAuthenticated, isInitialized } = useAuth();
const [profile, setProfile] = useState(null);

useEffect(() => {
  if (isInitialized && isAuthenticated && user) {
    loadProfile();
  } else {
    setProfile(null);
  }
}, [isAuthenticated, user, isInitialized]);

const loadProfile = async () => {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  setProfile(data);
};
```

### Pattern 4: Optional Auth Features

```typescript
const { isAuthenticated } = useAuth();

return (
  <div>
    <PublicContent />

    {isAuthenticated && (
      <>
        <DailyCheckinButton />
        <TreatWalletWidget />
      </>
    )}
  </div>
);
```

## useAuth() Hook API

```typescript
const {
  user,              // User | null - Current user object
  session,           // Session | null - Current session
  isAuthenticated,   // boolean - True if user is signed in
  isLoading,         // boolean - True during auth operations
  isInitialized,     // boolean - True after initial auth check
  signOut,           // () => Promise<void> - Sign out function
  refreshAuth        // () => Promise<void> - Manually refresh auth
} = useAuth();
```

## State Values

### user
- **Type:** `User | null`
- **Contains:** `id`, `email`, `user_metadata`, etc.
- **Usage:** Access user ID and email
- **Example:** `user.id`, `user.email`

### isAuthenticated
- **Type:** `boolean`
- **True when:** User is signed in
- **False when:** User is signed out
- **Usage:** Show/hide authenticated features

### isInitialized
- **Type:** `boolean`
- **True when:** Initial auth check is complete
- **False when:** App is still checking auth status
- **Usage:** Show loading state until ready

## Common Mistakes

### Mistake 1: Not Checking isInitialized

```typescript
// ❌ BAD: Might show wrong state during init
return isAuthenticated ? <Profile /> : <Login />;

// ✅ GOOD: Wait for initialization
if (!isInitialized) return <Spinner />;
return isAuthenticated ? <Profile /> : <Login />;
```

### Mistake 2: Using getSession() Directly

```typescript
// ❌ BAD: Bypasses central state management
const { data: { session } } = await supabase.auth.getSession();
const isAuth = !!session;

// ✅ GOOD: Use context
const { isAuthenticated } = useAuth();
```

### Mistake 3: Creating Custom Listeners

```typescript
// ❌ BAD: Duplicate listener
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(...);
  return () => subscription.unsubscribe();
}, []);

// ✅ GOOD: Rely on context's listener
const { isAuthenticated } = useAuth();
useEffect(() => {
  if (isAuthenticated) {
    // React to auth changes
  }
}, [isAuthenticated]);
```

## Debugging

### Check Auth State

```typescript
const auth = useAuth();
console.log('Auth State:', {
  isAuthenticated: auth.isAuthenticated,
  isInitialized: auth.isInitialized,
  userId: auth.user?.id,
  email: auth.user?.email
});
```

### Monitor Auth Events

Check browser console for:
```
[AuthContext] Auth state change: TOKEN_REFRESHED has session
[AuthContext] Auth state change: SIGNED_IN has session
[AuthContext] Auth state change: SIGNED_OUT no session
```

### Verify Context Wrapping

Ensure `AuthProvider` wraps your app:
```typescript
// src/index.tsx
<AuthProvider>
  <App />
</AuthProvider>
```

## Detection

Run this to find components using the anti-pattern:
```bash
./scripts/fix-auth-state-pattern.sh
```

## When to Use getSession()

**Never use directly in components.** The only valid uses are:
1. Inside `AuthContext` implementation
2. In server-side functions (Supabase Edge Functions)
3. In middleware that needs to check auth before context is available

## Quick Checklist

Before committing code with auth logic:
- [ ] Uses `useAuth()` hook, not local state
- [ ] No custom `onAuthStateChange` listeners
- [ ] Checks `isInitialized` before rendering
- [ ] Reacts to auth changes via `useEffect` dependencies
- [ ] Uses `user` from context, not `getUser()` call
- [ ] Passes `./scripts/fix-auth-state-pattern.sh` check

## Examples in Codebase

**Good examples (use these as reference):**
- ✅ `src/contexts/AuthContext.tsx` - The source of truth
- ✅ `src/screens/HomePlayer/sections/HeroSection/HeroSection.tsx` - Fixed header
- ✅ `src/screens/MusicPlayerScreen/MusicPlayerScreen.tsx` - Fixed player

**Bad examples (don't copy these):**
- ❌ Components listed by `./scripts/fix-auth-state-pattern.sh`

## Getting Help

1. Read `AUTH_STATE_PERSISTENCE_FIX.md` for detailed explanation
2. Check `AUTH_FIX_SUMMARY.md` for overview
3. Run detection script to verify your changes
4. Compare with fixed components (HeroSection, MusicPlayerScreen)
