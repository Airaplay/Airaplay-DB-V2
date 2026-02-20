# Artist/Creator Navigation - Quick Reference

## Corrected Navigation Calls

### MusicPlayerScreen.tsx (Lines 998-999)
```typescript
onClick={() => {
  if (artistUserId) {
    handleClose();  // Close player first
    navigate(`/user/${artistUserId}`);  // ✅ CORRECT
  }
}}
```

### AlbumPlayerScreen.tsx (Lines 862-863)
```typescript
onClick={() => {
  if (artistUserId) {
    handleClose();  // Close player first
    navigate(`/user/${artistUserId}`);  // ✅ CORRECT
  }
}}
```

### VideoPlayerScreen.tsx (Lines 1040-1042)
```typescript
onClick={() => {
  if (videoData.creator.id) {
    handleClose();  // Close player first
    navigate(`/user/${videoData.creator.id}`);  // ✅ CORRECT
  }
}}
```

---

## Route Configuration (index.tsx)

```typescript
// User's own profile
<Route path="/profile" element={<ProfileScreen />} />

// Public user profiles (OTHER users)
<Route path="/user/:userId" element={<PublicProfileScreen />} />
```

---

## Common Mistakes to Avoid

### ❌ WRONG - Wrong Route
```typescript
navigate(`/profile/${userId}`);  // Doesn't match any route
```

### ❌ WRONG - Missing Player Close
```typescript
navigate(`/user/${userId}`);     // Player stays open, overlaying profile
```

### ✅ CORRECT - Close Player + Correct Route
```typescript
handleClose();                   // Close player first
navigate(`/user/${userId}`);     // Navigate to correct route
```

---

## Pattern to Follow

**Navigation from Player Screens:**
1. Call `handleClose()` to close the player
2. Navigate to `/user/${userId}` to view the profile

**Route Usage:**
- `/profile` → For current user's own profile (no ID needed)
- `/user/${userId}` → For viewing other users' profiles

**Never use:**
- `/profile/${userId}` → This route doesn't exist
- Navigation without closing player → Creates UI overlay issue
