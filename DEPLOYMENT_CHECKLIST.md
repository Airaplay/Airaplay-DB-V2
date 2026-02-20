# Complete Deployment Checklist

Quick reference checklist for deploying Airaplay to production.

---

## Pre-Deployment Requirements

### 1. Accounts & Services
- [ ] GitHub account created
- [ ] Vercel account created (linked to GitHub)
- [ ] Google Play Developer account ($25 paid)
- [ ] Supabase project configured and running
- [ ] Domain registered (optional but recommended)

### 2. Assets Prepared
- [ ] App logo (512x512 PNG)
- [ ] Feature graphic (1024x500 PNG)
- [ ] Screenshots (minimum 2, recommend 5-8)
- [ ] Privacy policy document
- [ ] App description written
- [ ] Release notes prepared

### 3. Code Ready
- [ ] All features tested locally
- [ ] No console errors
- [ ] TypeScript compiles without errors
- [ ] Environment variables documented
- [ ] .gitignore configured properly

---

## Part A: Deploy Admin Dashboard to Vercel

**Time Required:** 30-60 minutes
**Guide:** [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md)

### Phase 1: Prepare Project
- [ ] Run `npm run build:web` successfully
- [ ] No build errors
- [ ] Verify `vercel.json` exists
- [ ] Push code to GitHub repository

### Phase 2: Deploy to Vercel
- [ ] Login to Vercel
- [ ] Import GitHub repository
- [ ] Configure build settings
- [ ] Add environment variables
- [ ] Click "Deploy"

### Phase 3: Verify Deployment
- [ ] Deployment successful
- [ ] Visit deployed URL
- [ ] Test admin login
- [ ] Verify data loads
- [ ] Check console for errors

**Status:** [ ] ✅ Admin dashboard deployed

---

## Part B: Deploy App to Play Store

**Time Required:** 4-8 hours (excluding Google review)
**Guide:** [ANDROID_DEPLOYMENT_GUIDE.md](./ANDROID_DEPLOYMENT_GUIDE.md)

### All Steps
- [ ] Setup Android Studio
- [ ] Build release AAB
- [ ] Test on devices
- [ ] Create Play Console account
- [ ] Complete store listing
- [ ] Submit for review

**Status:** [ ] ✅ App live on Play Store

---

See detailed guides for step-by-step instructions!
