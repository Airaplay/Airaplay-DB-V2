# Deploy Edge Functions to Fix Upload 404 Error

## Problem
When uploading content (audio, video, albums, singles), you get:
```
Upload Failed with Status: 404
```

This happens because the Supabase Edge Functions are not deployed yet.

## Solution

You need to deploy two edge functions to your Supabase project:
1. `upload-to-bunny` - Handles audio/image uploads
2. `bunny-stream-upload` - Handles video uploads

---

## Step 1: Set Up Environment Variables in Supabase

Before deploying, you need to configure the required environment variables in your Supabase project.

### Go to Supabase Dashboard

1. Visit https://supabase.com/dashboard
2. Select your project: `vwcadgjaivvffxwgnkzy`
3. Navigate to: **Settings** → **Edge Functions** → **Secrets**

### Add These Environment Variables

#### For Bunny Storage (audio/images):
```
BUNNY_STORAGE_ZONE = your_bunny_storage_zone_name
BUNNY_STORAGE_API_KEY = your_bunny_storage_api_key
BUNNY_CDN_HOSTNAME = airaplay.b-cdn.net
BUNNY_STORAGE_ENDPOINT = uk.storage.bunnycdn.com
```

#### For Bunny Stream (videos):
```
BUNNY_STREAM_LIBRARY_ID = your_bunny_stream_library_id
BUNNY_STREAM_API_KEY = your_bunny_stream_api_key
BUNNY_STREAM_HOSTNAME = your_bunny_stream_hostname
```

**Note:** You should already have these values from your Bunny.net account. If not:
- Log in to https://panel.bunny.net
- Get Storage credentials from: Storage → [Your Zone] → FTP & API Access
- Get Stream credentials from: Stream → [Your Library] → API

---

## Step 2: Install Supabase CLI

If you haven't already, install the Supabase CLI:

```bash
npm install -g supabase
```

---

## Step 3: Login to Supabase

```bash
supabase login
```

This will open a browser window to authenticate. Follow the prompts.

---

## Step 4: Link Your Project

Link your local project to your Supabase project:

```bash
supabase link --project-ref vwcadgjaivvffxwgnkzy
```

You'll be prompted to enter your database password.

---

## Step 5: Deploy the Edge Functions

### Option A: Deploy Both Functions at Once (Recommended)

```bash
# Deploy upload-to-bunny function
supabase functions deploy upload-to-bunny

# Deploy bunny-stream-upload function
supabase functions deploy bunny-stream-upload
```

### Option B: Deploy All Functions

```bash
supabase functions deploy
```

This will deploy all functions in the `supabase/functions` directory.

---

## Step 6: Verify Deployment

After deployment, verify the functions are live:

1. Go to your Supabase Dashboard
2. Navigate to: **Edge Functions**
3. You should see both functions listed as "Active"

### Test the Functions

You can test if they're working by trying to upload content again in your app.

---

## Step 7: Monitor Function Logs (Optional)

To view logs for debugging:

```bash
# View logs for upload-to-bunny
supabase functions logs upload-to-bunny

# View logs for bunny-stream-upload
supabase functions logs bunny-stream-upload
```

---

## Troubleshooting

### Issue: "supabase: command not found"

**Solution:**
```bash
npm install -g supabase
```

### Issue: "Project not linked"

**Solution:**
```bash
supabase link --project-ref vwcadgjaivvffxwgnkzy
```

### Issue: "Deployment failed - missing environment variables"

**Solution:** Go back to Step 1 and ensure all environment variables are set in the Supabase dashboard.

### Issue: Still getting 404 after deployment

**Solution:**
1. Wait 1-2 minutes for deployment to propagate
2. Clear browser cache
3. Restart your app
4. Check function logs for errors:
   ```bash
   supabase functions logs upload-to-bunny --tail
   ```

### Issue: "Authentication required" or "Invalid token"

**Solution:**
```bash
supabase login
supabase link --project-ref vwcadgjaivvffxwgnkzy
```

---

## Quick Reference: All Commands

```bash
# 1. Install CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Link project
supabase link --project-ref vwcadgjaivvffxwgnkzy

# 4. Deploy functions
supabase functions deploy upload-to-bunny
supabase functions deploy bunny-stream-upload

# 5. Check status
supabase functions list

# 6. View logs (optional)
supabase functions logs upload-to-bunny --tail
supabase functions logs bunny-stream-upload --tail
```

---

## Alternative: Deploy via Supabase Dashboard (No CLI)

If you prefer not to use the CLI, you can deploy functions directly from the dashboard:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Edge Functions**
4. Click **Create a new function** or **Deploy existing**
5. Upload the function files from `supabase/functions/upload-to-bunny/` and `supabase/functions/bunny-stream-upload/`

However, using the CLI is much easier and recommended.

---

## After Successful Deployment

Once deployed, your upload functionality should work:

1. **Single Upload**: Users can upload individual songs
2. **Album Upload**: Users can upload full albums
3. **Video Upload**: Users can upload video content

Test by:
1. Opening the app
2. Going to the upload screen
3. Selecting a file
4. Uploading - should now succeed without 404 error

---

## Summary

The 404 error occurs because the edge functions that handle file uploads to Bunny.net aren't deployed yet. By following these steps:

1. Set environment variables in Supabase dashboard
2. Deploy the edge functions using Supabase CLI
3. Verify deployment in the dashboard

Your upload functionality will be fully operational.
