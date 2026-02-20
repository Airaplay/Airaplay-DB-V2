# Quick Guide: Authenticate with Supabase CLI

Your project reference: `vwcadgjaivvffxwgnkzy`

## ✅ Option 1: Use Personal Access Token (Easiest)

1. Visit: https://supabase.com/dashboard/account/tokens
2. Click **"Generate new token"**
3. Name it: "CLI Deployment Token"
4. Click **"Generate token"**
5. Copy the token (starts with `sbp_...`)
6. Paste it here and I'll authenticate for you

Then run:
```bash
npx supabase login --token sbp_YOUR_TOKEN
npx supabase link --project-ref vwcadgjaivvffxwgnkzy
npx supabase functions deploy payment-webhook
```

## ✅ Option 2: Interactive Login

Just run this in your terminal manually:
```bash
npx supabase login
```

Then follow the prompts in your browser.

---

**After authentication**, we'll deploy the updated webhook function with the health check endpoint!




