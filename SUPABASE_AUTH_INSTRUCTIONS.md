# How to Get Supabase Access Token

## Method 1: Personal Access Token (Recommended)

1. Go to: https://supabase.com/dashboard/account/tokens
2. Click **"Generate new token"**
3. Give it a name (e.g., "CLI Token")
4. Click **"Generate token"**
5. **Copy the token immediately** (it starts with `sbp_...` and you won't see it again!)
6. Use it to authenticate:
   ```bash
   npx supabase login --token sbp_YOUR_TOKEN_HERE
   ```

## Method 2: Interactive Login

1. Run:
   ```bash
   npx supabase login
   ```
2. Press Enter to open browser
3. Log in to Supabase in the browser
4. Authorization will complete automatically
5. The CLI will be authenticated

## After Authentication

Once authenticated, you can:
- Link your project: `npx supabase link --project-ref vwcadgjaivvffxwgnkzy`
- Deploy functions: `npx supabase functions deploy payment-webhook`




