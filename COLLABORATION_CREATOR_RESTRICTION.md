# Collaboration Features Restricted to Creators Only

## Summary

The collaboration feature (Find Collaborators) has been properly restricted to creators and admins only. Regular listeners no longer have access to this feature.

## Changes Made

### 1. Frontend Access Control

#### CollaborateScreen
- Added `verifyCreatorAccessAndLoadData()` function that checks user role before loading data
- Redirects non-creators to the Create screen with an error message
- Only allows users with role 'creator' or 'admin' to access the page

#### CollaborationInboxScreen
- Added the same `verifyCreatorAccessAndLoadData()` verification
- Ensures only creators can view and manage collaboration requests

#### CreateScreen
- Updated the "Find Collaborators" section visibility condition
- Now explicitly checks: `artistProfile && (userRole === 'creator' || userRole === 'admin')`
- Section is completely hidden for listeners

### 2. Database Security (RLS Policies)

Applied migration: `restrict_collaboration_to_creators_only`

Updated RLS policies on the following tables:

#### collaboration_matches
- Policy: "Creators can view their matches"
- Verifies user role is 'creator' or 'admin'

#### collaboration_requests
- "Creators can view requests they sent or received"
- "Creators can send collaboration requests"
- "Creator recipients can update request status"
- "Creator senders can withdraw their requests"
- All policies now verify user role

#### collaboration_interactions
- "Creators can insert own interactions"
- "Creators can view own interactions"
- Role verification added

#### artist_collaboration_preferences
- "Creators can view own preferences"
- "Creators can insert own preferences"
- "Creators can update own preferences"
- All policies verify user role

#### collaboration_unlocks (if exists)
- "Creators can view own unlocks"
- "Creators can insert own unlocks"
- Role verification added

## Security Benefits

1. **Multi-Layer Protection**: Both frontend and database level restrictions
2. **Role-Based Access**: Explicitly checks user role at every access point
3. **Database Enforcement**: Even if someone bypasses the frontend, database RLS prevents access
4. **Clear Error Messages**: Users get informed why they can't access the feature

## User Experience

### For Listeners (Regular Users)
- Do not see "Find Collaborators" section on Create screen
- If they try to access `/collaborate` directly, they are redirected with message: "This feature is only available to creators"
- Cannot perform any collaboration-related database operations

### For Creators
- See "Find Collaborators" section on Create screen
- Can access `/collaborate` page
- Can view matches, send requests, and manage collaborations
- All features work as expected

### For Admins
- Have full access to all collaboration features
- Same privileges as creators

## How to Become a Creator

Users who want to access collaboration features must:
1. Fill out the Creator Registration form at `/become-artist`
2. Wait for admin approval
3. Once approved, their role changes from 'listener' to 'creator'
4. They gain access to all creator features including collaboration

## Testing

To verify the restrictions work:

1. Create a test user account
2. Try to access `/collaborate` - should redirect to Create screen
3. Check that "Find Collaborators" section is not visible on Create screen
4. Try to make direct API calls to collaboration tables - should fail with permission errors
5. Approve the user as a creator via admin dashboard
6. Verify that collaboration features now become available
