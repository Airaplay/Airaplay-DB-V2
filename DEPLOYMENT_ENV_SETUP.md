# Environment Variables Setup for Production

Your app requires environment variables to connect to Supabase. Without these, the app will show a configuration error.

## Required Environment Variables

```
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Where to Find These Values

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click on **Settings** (gear icon) → **API**
4. Copy:
   - **Project URL** → use as `VITE_SUPABASE_URL`
   - **anon public** key → use as `VITE_SUPABASE_ANON_KEY`

## Platform-Specific Setup Instructions

### Netlify

1. Go to your site dashboard on Netlify
2. Navigate to **Site settings** → **Environment variables**
3. Click **Add a variable** and add:
   - Variable: `VITE_SUPABASE_URL`
   - Value: Your Supabase project URL
4. Click **Add a variable** again and add:
   - Variable: `VITE_SUPABASE_ANON_KEY`
   - Value: Your Supabase anon key
5. Click **Save**
6. Go to **Deploys** and click **Trigger deploy** → **Clear cache and deploy site**

### Vercel

1. Go to your project dashboard on Vercel
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:
   - Name: `VITE_SUPABASE_URL`
   - Value: Your Supabase project URL
4. Add another variable:
   - Name: `VITE_SUPABASE_ANON_KEY`
   - Value: Your Supabase anon key
5. Click **Save**
6. Redeploy your application

### Other Platforms

For other hosting platforms, consult their documentation on how to set environment variables. The variables should be available at build time (not just runtime).

## Verifying the Setup

After adding the environment variables:

1. Trigger a new deployment
2. Check the build logs to ensure no errors
3. Visit your deployed site - it should load properly
4. Open browser console (F12) - you should NOT see "Missing Supabase environment variables" errors

## Troubleshooting

**App still shows loading animation:**
- Environment variables must start with `VITE_` prefix for Vite to expose them
- Clear build cache and redeploy
- Verify the variable names are exactly as specified (case-sensitive)

**Build succeeds but app doesn't work:**
- Check browser console for errors
- Ensure you're using the correct Supabase URL (should end with `.supabase.co`)
- Verify the anon key is the public key, not the service role key

**Getting authentication errors:**
- Make sure you're using the `anon` (public) key, not the `service_role` (secret) key
- The service role key should NEVER be exposed in the frontend

## Security Note

- Only use the `anon` (public) key in your frontend
- NEVER commit the `.env` file to version control
- The `.env` file is already in `.gitignore`
