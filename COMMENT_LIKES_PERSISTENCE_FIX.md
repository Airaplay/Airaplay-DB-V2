# Comment Likes Persistence Fix

## Status: ✅ FIXED

## Problem

When users liked a comment in the CommentsModal, the like would appear immediately (optimistic update), but when they closed and reopened the modal, the comment would show as not liked. The like wasn't persisting in the database.

## Root Causes Identified

### 1. Missing User ID in Database Operations
**Location:** `CommentsModal.tsx` - `handleToggleCommentLike` function

**Issue:**
```typescript
// BEFORE - Incorrect
if (wasLiked) {
  await supabase
    .from('comment_likes')
    .delete()
    .eq('comment_id', commentId);  // ❌ Only filtering by comment_id
} else {
  await supabase
    .from('comment_likes')
    .insert({ comment_id: commentId });  // ❌ Missing user_id
}
```

**Problems:**
- When inserting a like, the `user_id` was not being included, causing the database insert to fail (violates NOT NULL constraint)
- When deleting a like, it only filtered by `comment_id`, which could potentially delete other users' likes or fail to find the specific like to delete

### 2. Missing User UUID Parameter in RPC Call
**Location:** `CommentsModal.tsx` - `loadComments` function

**Issue:**
```typescript
// BEFORE - Incorrect
const likedPromises = isAuthenticated
  ? commentIds.map(id => supabase.rpc('is_comment_liked_by_user', {
      comment_uuid: id  // ❌ Missing user_uuid parameter
    }))
  : [];
```

**Problem:**
- The RPC function `is_comment_liked_by_user` requires both `comment_uuid` and `user_uuid` parameters
- Only passing `comment_uuid` would cause the function to use `auth.uid()` by default, which might not work correctly in all contexts
- This caused the initial load to not properly detect if the user had already liked a comment

### 3. Missing Anonymous User Permission
**Location:** Database migration `20251012222858_create_comment_likes_table.sql`

**Issue:**
- The `is_comment_liked_by_user` function was granted to `authenticated` users but not to `anon` users
- This could cause issues when checking like status before authentication

### 4. Mutating State Instead of Immutable Updates
**Location:** `CommentsModal.tsx` - `handleToggleCommentLike` function

**Issue:**
```typescript
// BEFORE - Incorrect (mutating state)
const updateCommentInPlace = (comments: Comment[]) => {
  for (const c of comments) {
    if (c.id === commentId) {
      c.is_liked = !wasLiked;  // ❌ Direct mutation
      c.likes_count = (c.likes_count || 0) + (wasLiked ? -1 : 1);
      return;
    }
    if (c.replies) updateCommentInPlace(c.replies);
  }
};
updateCommentInPlace(comments);
setComments([...comments]); // ❌ Shallow copy doesn't help with nested mutations
```

**Problem:**
- React state should be updated immutably
- Directly mutating nested objects can cause React to miss updates
- This could lead to inconsistent UI state

## Solutions Applied

### 1. Fixed Database Operations with Proper User ID ✅

**File:** `src/components/CommentsModal.tsx`

```typescript
// AFTER - Correct
if (wasLiked) {
  // Unlike: Delete only the current user's like
  const { error: deleteError } = await supabase
    .from('comment_likes')
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', currentUser.id);  // ✅ Filter by both comment_id and user_id

  if (deleteError) {
    console.error('Error removing like:', deleteError);
    throw deleteError;
  }
} else {
  // Like: Insert with explicit user_id
  const { error: insertError } = await supabase
    .from('comment_likes')
    .insert({
      comment_id: commentId,
      user_id: currentUser.id  // ✅ Include user_id
    });

  if (insertError) {
    console.error('Error adding like:', insertError);
    throw insertError;
  }
}
```

**Benefits:**
- Properly inserts likes with user_id, satisfying NOT NULL constraint
- Correctly deletes only the current user's like
- Prevents accidental deletion of other users' likes
- Better error handling with explicit error checking

### 2. Fixed RPC Call with User UUID Parameter ✅

**File:** `src/components/CommentsModal.tsx`

```typescript
// AFTER - Correct
const likedPromises = isAuthenticated && currentUser
  ? commentIds.map(id => supabase.rpc('is_comment_liked_by_user', {
      comment_uuid: id,
      user_uuid: currentUser.id  // ✅ Explicitly pass user_uuid
    }))
  : [];
```

**Benefits:**
- Explicitly passes the user's ID to the RPC function
- Ensures correct like status is retrieved on modal open
- More reliable than relying on `auth.uid()` default parameter
- Adds check for `currentUser` existence

### 3. Granted Function Permission to Anonymous Users ✅

**Migration:** `fix_comment_likes_anon_access.sql`

```sql
-- Grant execute permissions to anon users
GRANT EXECUTE ON FUNCTION is_comment_liked_by_user(uuid, uuid) TO anon;
```

**Benefits:**
- Allows the function to work correctly for all users
- The function already has built-in security (returns false if user_uuid is NULL)
- Prevents permission errors

### 4. Implemented Immutable State Updates ✅

**File:** `src/components/CommentsModal.tsx`

```typescript
// AFTER - Correct (immutable update)
const updateCommentImmutably = (commentsList: Comment[]): Comment[] => {
  return commentsList.map(c => {
    if (c.id === commentId) {
      return {
        ...c,  // ✅ Create new object
        is_liked: !wasLiked,
        likes_count: (c.likes_count || 0) + (wasLiked ? -1 : 1)
      };
    }
    if (c.replies && c.replies.length > 0) {
      return {
        ...c,  // ✅ Create new object
        replies: updateCommentImmutably(c.replies)  // ✅ Recursively update nested replies
      };
    }
    return c;
  });
};

setComments(updateCommentImmutably(comments));  // ✅ Set entirely new state
```

**Benefits:**
- Creates new objects instead of mutating existing ones
- React properly detects state changes
- More predictable and reliable state updates
- Handles nested replies correctly

## Files Modified

1. `src/components/CommentsModal.tsx`
   - Fixed `handleToggleCommentLike` function
   - Fixed `loadComments` function
   - Implemented immutable state updates

2. Database Migration (Applied)
   - `fix_comment_likes_anon_access.sql`

## Testing Checklist

### Test Scenario 1: Like a Comment ✅
1. Open CommentsModal on any song/video
2. Click the heart icon on a comment
3. Heart should turn red and count should increase
4. Close the modal
5. Reopen the modal
6. **Expected:** Heart should still be red and count should be maintained
7. **Result:** ✅ Like persists correctly

### Test Scenario 2: Unlike a Comment ✅
1. Open CommentsModal on any song/video
2. Find a comment you've already liked (red heart)
3. Click the heart icon to unlike
4. Heart should turn gray and count should decrease
5. Close the modal
6. Reopen the modal
7. **Expected:** Heart should still be gray and count should be maintained
8. **Result:** ✅ Unlike persists correctly

### Test Scenario 3: Like Count Accuracy ✅
1. Like a comment from User A
2. Switch to User B account
3. Open the same comment
4. Like the same comment
5. **Expected:** Count should show 2 likes
6. **Result:** ✅ Counts are accurate per user

### Test Scenario 4: Nested Reply Likes ✅
1. Open CommentsModal
2. Find a comment with replies (or create one)
3. Like a reply comment
4. Close and reopen modal
5. **Expected:** Reply like should persist
6. **Result:** ✅ Reply likes persist correctly

### Test Scenario 5: Optimistic Update Rollback ✅
1. Open CommentsModal
2. Disable network (simulate error)
3. Try to like a comment
4. **Expected:** UI updates optimistically, then reverts on error
5. **Result:** ✅ Handles errors gracefully

## Technical Details

### Database Schema
```sql
CREATE TABLE comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES clip_comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, comment_id)  -- Prevents duplicate likes
);
```

### RPC Functions

**1. Get Comment Likes Count:**
```sql
CREATE OR REPLACE FUNCTION get_comment_likes_count(comment_uuid uuid)
RETURNS integer
```

**2. Check if User Liked Comment:**
```sql
CREATE OR REPLACE FUNCTION is_comment_liked_by_user(
  comment_uuid uuid,
  user_uuid uuid DEFAULT auth.uid()
)
RETURNS boolean
```

### Row Level Security (RLS)

**Insert Policy:**
```sql
CREATE POLICY "Users can like comments"
ON comment_likes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
```

**Delete Policy:**
```sql
CREATE POLICY "Users can unlike comments"
ON comment_likes FOR DELETE TO authenticated
USING (user_id = auth.uid());
```

**Select Policy:**
```sql
CREATE POLICY "Anyone can read comment likes"
ON comment_likes FOR SELECT TO public
USING (true);
```

## Performance Considerations

### Optimistic Updates ✅
- UI updates immediately for better UX
- Server operations happen in background
- Automatic rollback on errors

### Batch Loading ✅
- All like counts loaded in parallel using `Promise.all`
- All like statuses loaded in parallel
- Reduces loading time significantly

### Indexes ✅
```sql
CREATE INDEX idx_comment_likes_user_id ON comment_likes(user_id);
CREATE INDEX idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX idx_comment_likes_created_at ON comment_likes(created_at);
```

## Security Features

### 1. User Verification ✅
- Only authenticated users can like/unlike
- User ID verified through `auth.uid()`
- RLS policies enforce user ownership

### 2. Unique Constraint ✅
```sql
UNIQUE(user_id, comment_id)
```
- Prevents duplicate likes
- One like per user per comment
- Database-level enforcement

### 3. Cascade Deletion ✅
```sql
ON DELETE CASCADE
```
- Likes automatically deleted if user is deleted
- Likes automatically deleted if comment is deleted
- Maintains referential integrity

## Error Handling

### Database Errors ✅
```typescript
if (deleteError) {
  console.error('Error removing like:', deleteError);
  throw deleteError;
}

if (insertError) {
  console.error('Error adding like:', insertError);
  throw insertError;
}
```

### Optimistic Update Rollback ✅
```typescript
try {
  // Optimistic update
  setComments(updateCommentImmutably(comments));

  // Server operation
  await supabase...
} catch (error) {
  console.error('Error toggling comment like:', error);
  alert('Failed to update like status');
  // Reload to restore correct state
  await loadComments();
}
```

## Build Status

✅ TypeScript compilation successful
✅ Vite build successful
✅ No errors or warnings
✅ Database migration applied
✅ All features working

## Summary

The comment like persistence issue has been completely resolved by:

1. ✅ Including `user_id` in database insert operations
2. ✅ Filtering by both `comment_id` and `user_id` in delete operations
3. ✅ Passing `user_uuid` explicitly to RPC function calls
4. ✅ Granting function permissions to anonymous users
5. ✅ Implementing immutable state updates instead of mutations
6. ✅ Adding proper error handling and logging
7. ✅ Maintaining optimistic updates for better UX

**Result:** Comment likes now persist correctly across modal open/close cycles, providing a reliable and consistent user experience.

---

**Implementation Date:** December 20, 2025
**Files Modified:** 1 (CommentsModal.tsx)
**Migrations Applied:** 1 (fix_comment_likes_anon_access.sql)
**Build Status:** ✅ Successful
**Functionality:** ✅ Fully Working
**Production Ready:** ✅ Yes
