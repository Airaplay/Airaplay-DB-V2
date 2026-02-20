# Vercel Deployment Guide - Admin Dashboard

This guide covers deploying the web-based admin dashboard to Vercel.

## Prerequisites

- [x] GitHub/GitLab/Bitbucket account
- [x] Vercel account (free tier is fine)
- [x] Project pushed to Git repository
- [x] Supabase project configured

---

## Step 1: Prepare Your Project

### 1.1 Verify Build Configuration

Check that your project builds correctly for web:

```bash
npm run build:web
```

Expected output: `✓ built in X.XXs` with no errors.

### 1.2 Review Vercel Configuration

Your project already has `vercel.json` configured. Verify it exists:

```json
{
  "buildCommand": "npm run build:web",
  "outputDirectory": "dist",
  "devCommand": "npm run dev:web",
  "installCommand": "npm install"
}
```

---

## Step 2: Push to Git Repository

### 2.1 Initialize Git (if not already done)

```bash
git init
git add .
git commit -m "Initial commit - Ready for deployment"
```

### 2.2 Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository named `airaplay-admin`
3. **DO NOT** initialize with README (we already have code)
4. Click "Create repository"

### 2.3 Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/airaplay-admin.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

---

## Step 3: Deploy to Vercel

### 3.1 Sign Up/Login to Vercel

1. Go to https://vercel.com
2. Click "Sign Up" or "Login"
3. Choose "Continue with GitHub" (recommended)
4. Authorize Vercel to access your GitHub account

### 3.2 Import Your Project

1. Click "Add New..." → "Project"
2. Find your repository in the list
3. Click "Import" next to `airaplay-admin`

### 3.3 Configure Project Settings

**Framework Preset:** Vite

**Build Command:**
```bash
npm run build:web
```

**Output Directory:**
```
dist
```

**Install Command:**
```bash
npm install
```

**Root Directory:** `./` (leave as default)

### 3.4 Add Environment Variables

Click "Environment Variables" and add the following:

| Name | Value | Where to find |
|------|-------|---------------|
| `VITE_SUPABASE_URL` | `https://vwcadgjaivvffxwgnkzy.supabase.co` | Your .env file |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Your .env file |

**Important:**
- These should be in ALL environments (Production, Preview, Development)
- Copy exact values from your local `.env` file

### 3.5 Deploy

1. Click "Deploy"
2. Wait 2-3 minutes for build and deployment
3. Vercel will show build progress

**Expected Output:**
```
✓ Building
✓ Collecting Build Trace
✓ Uploading Deployment
✓ Deployed to production
```

---

## Step 4: Configure Custom Domain (Optional)

### 4.1 Add Custom Domain

1. Go to your project dashboard
2. Click "Settings" → "Domains"
3. Enter your domain: `admin.airaplay.com`
4. Click "Add"

### 4.2 Update DNS Records

Vercel will show DNS records to add:

**A Record:**
```
Type: A
Name: admin
Value: 76.76.21.21
```

**OR CNAME (if subdomain):**
```
Type: CNAME
Name: admin
Value: cname.vercel-dns.com
```

Add these to your domain registrar's DNS settings.

### 4.3 Verify Domain

1. Wait 10-60 minutes for DNS propagation
2. Vercel will automatically verify and issue SSL certificate
3. Your admin dashboard will be live at `https://admin.airaplay.com`

---

## Step 5: Post-Deployment Verification

### 5.1 Test Admin Login

1. Visit your Vercel URL (e.g., `https://airaplay-admin.vercel.app`)
2. Navigate to `/admin-login`
3. Test login with admin credentials

### 5.2 Verify Database Connection

1. Login to admin dashboard
2. Check that data loads properly
3. Test a few admin functions

### 5.3 Check Console for Errors

1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Check Network tab for failed requests

---

## Step 6: Continuous Deployment Setup

Vercel automatically deploys on every push to `main` branch.

### 6.1 Deploy New Changes

```bash
# Make changes to your code
git add .
git commit -m "Update admin dashboard"
git push origin main
```

Vercel will automatically:
1. Detect the push
2. Build your project
3. Deploy to production
4. Update the live site

### 6.2 Preview Deployments

Every pull request gets a unique preview URL:
1. Create a feature branch
2. Push to GitHub
3. Create Pull Request
4. Vercel creates preview deployment
5. Test before merging to main

---

## Common Issues & Solutions

### Issue 1: Build Fails - TypeScript Errors

**Solution:**
```bash
# Fix TypeScript errors locally first
npm run build:web

# Fix any errors shown, then deploy
```

### Issue 2: Environment Variables Not Working

**Solution:**
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Ensure variables are set for "Production"
3. Redeploy: Deployments → ... → Redeploy

### Issue 3: 404 on Refresh

Already fixed with `vercel.json` configuration. If issue persists:

1. Check `vercel.json` has correct redirects
2. Redeploy project

### Issue 4: Supabase Connection Error

**Solution:**
1. Verify Supabase project is not paused
2. Check environment variables are correct
3. Test Supabase URL in browser (should return JSON)

---

## Security Checklist

- [x] Environment variables are NOT committed to Git
- [x] `.env` is in `.gitignore`
- [x] Supabase RLS policies are enabled
- [x] Admin routes require authentication
- [x] HTTPS is enabled (automatic with Vercel)

---

## Deployment URLs

After deployment, you'll have:

- **Production:** `https://airaplay-admin.vercel.app`
- **Custom Domain:** `https://admin.airaplay.com` (if configured)
- **Git Branch Previews:** `https://airaplay-admin-git-BRANCH.vercel.app`

---

## Monitoring & Analytics

### Enable Vercel Analytics

1. Go to project dashboard
2. Click "Analytics" tab
3. Enable "Web Analytics" (free)
4. Monitor page views, performance, and errors

### View Deployment Logs

1. Go to "Deployments" tab
2. Click any deployment
3. View "Building" and "Function" logs
4. Debug issues using logs

---

## Updating After Deployment

### Update Environment Variables

1. Vercel Dashboard → Settings → Environment Variables
2. Edit variable
3. Redeploy for changes to take effect

### Rollback Deployment

1. Vercel Dashboard → Deployments
2. Find previous working deployment
3. Click "..." → "Promote to Production"

---

## Cost Estimation

**Vercel Free Tier Includes:**
- 100 GB bandwidth/month
- Unlimited deployments
- Automatic HTTPS
- Global CDN
- Preview deployments

**Sufficient for:** 10,000-50,000 page views/month

**Upgrade needed if:**
- More than 100 GB bandwidth
- Need team collaboration features
- Require advanced analytics

---

## Next Steps

1. ✅ Deploy admin dashboard to Vercel
2. Configure custom domain
3. Set up monitoring and alerts
4. Deploy mobile app to Play Store (see ANDROID_DEPLOYMENT_GUIDE.md)

---

## Support Resources

- **Vercel Docs:** https://vercel.com/docs
- **Vercel Support:** https://vercel.com/support
- **Supabase Docs:** https://supabase.com/docs

---

**Deployment Status:** Ready to Deploy ✅
