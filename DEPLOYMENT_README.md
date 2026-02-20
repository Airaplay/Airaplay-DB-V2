# Airaplay Deployment Guides

Complete documentation for deploying Airaplay to production.

---

## 📖 Available Guides

### 1. Quick Start Guide
**File:** [DEPLOYMENT_QUICK_START.md](./DEPLOYMENT_QUICK_START.md)  
**Time:** 5 minutes read  
**Use when:** You need a fast overview of the deployment process

Quick reference guide with essential commands and steps.

---

### 2. Vercel Deployment Guide (Admin Dashboard)
**File:** [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md)  
**Time:** 30-60 minutes to deploy  
**Use when:** Deploying the web-based admin dashboard

Comprehensive guide covering:
- Project preparation
- Git repository setup
- Vercel configuration
- Environment variables
- Custom domain setup
- Continuous deployment
- Troubleshooting

---

### 3. Android Deployment Guide (Play Store)
**File:** [ANDROID_DEPLOYMENT_GUIDE.md](./ANDROID_DEPLOYMENT_GUIDE.md)  
**Time:** 4-8 hours to deploy (+ 3-7 days review)  
**Use when:** Publishing the mobile app to Google Play Store

Complete step-by-step guide covering:
- Android Studio setup
- Project configuration
- Signing key generation
- Building release AAB/APK
- Testing procedures
- Google Play Console setup
- Store listing creation
- Submission process
- Post-launch monitoring

---

### 4. Deployment Checklist
**File:** [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)  
**Time:** Use throughout deployment  
**Use when:** You want to track progress and ensure nothing is missed

Interactive checklist covering:
- Pre-deployment requirements
- Vercel deployment steps
- Play Store submission steps
- Post-deployment tasks
- Critical backups

---

### 5. Troubleshooting Guide
**File:** [DEPLOYMENT_TROUBLESHOOTING.md](./DEPLOYMENT_TROUBLESHOOTING.md)  
**Time:** As needed  
**Use when:** You encounter issues during deployment

Solutions for common problems:
- Vercel build failures
- Android build errors
- Play Store rejections
- Supabase connection issues
- Signing problems
- Testing issues

---

## 🎯 Recommended Path

### For First-Time Deployment:

1. **Start Here:** Read [DEPLOYMENT_QUICK_START.md](./DEPLOYMENT_QUICK_START.md)
2. **Deploy Admin:** Follow [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md)
3. **Deploy App:** Follow [ANDROID_DEPLOYMENT_GUIDE.md](./ANDROID_DEPLOYMENT_GUIDE.md)
4. **Track Progress:** Use [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
5. **If Issues:** Check [DEPLOYMENT_TROUBLESHOOTING.md](./DEPLOYMENT_TROUBLESHOOTING.md)

### For Updates/Re-deployment:

1. **Quick Reference:** Use [DEPLOYMENT_QUICK_START.md](./DEPLOYMENT_QUICK_START.md)
2. **Specific Issues:** Check [DEPLOYMENT_TROUBLESHOOTING.md](./DEPLOYMENT_TROUBLESHOOTING.md)

---

## 📊 Deployment Overview

```
┌─────────────────────────────────────────────────────┐
│                 AIRAPLAY DEPLOYMENT                  │
└─────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│  Admin Dashboard     │         │   Mobile App         │
│  (Web Application)   │         │  (Android)           │
└──────────────────────┘         └──────────────────────┘
         │                                  │
         ▼                                  ▼
┌──────────────────────┐         ┌──────────────────────┐
│     Vercel           │         │   Google Play        │
│  - Build: Vite       │         │   - Format: AAB      │
│  - Deploy: Auto      │         │   - Review: 3-7 days │
│  - Time: 30-60 min   │         │   - Time: 4-8 hours  │
└──────────────────────┘         └──────────────────────┘
         │                                  │
         └──────────────┬───────────────────┘
                        ▼
              ┌─────────────────────┐
              │  Supabase Backend   │
              │  - Database         │
              │  - Auth             │
              │  - Storage          │
              │  - Edge Functions   │
              └─────────────────────┘
```

---

## 💡 Key Information

### Deployment Targets

| Target | Platform | Time | Cost |
|--------|----------|------|------|
| Admin Dashboard | Vercel | 30-60 min | Free |
| Mobile App | Google Play | 4-8 hours + review | $25 one-time |

### Required Accounts

- ✅ GitHub (free)
- ✅ Vercel (free tier sufficient)
- ✅ Google Play Developer ($25 one-time)
- ✅ Supabase (free tier sufficient)

### Critical Files

**Must Backup:**
- Keystore file (`airaplay-release-key.keystore`)
- Keystore passwords
- Environment variables (`.env`)

**Never Commit:**
- `.env` file
- `*.keystore` files
- `key.properties`

---

## 🚨 Important Warnings

### Keystore Security
⚠️ **CRITICAL:** The Android keystore file is required for ALL future app updates. Losing it means you cannot update your app on Play Store - you'd have to publish as a completely new app, losing all reviews, ratings, and downloads.

**Required Actions:**
1. Backup keystore to 3+ secure locations
2. Save passwords in password manager
3. Never commit to version control
4. Never share publicly

### Environment Variables
⚠️ Keep Supabase credentials secure:
- Never commit `.env` to Git
- Use Vercel environment variables for production
- Regenerate if accidentally exposed

### Version Management
⚠️ Always increment version numbers:
- `versionCode`: Must increase for each release (1, 2, 3...)
- `versionName`: User-visible version (1.0.0, 1.0.1, 1.1.0...)

---

## 📞 Support Resources

### Official Documentation
- **Vercel:** https://vercel.com/docs
- **Android Developer:** https://developer.android.com
- **Play Console:** https://support.google.com/googleplay/android-developer
- **Capacitor:** https://capacitorjs.com/docs

### Community Support
- **Vercel Discussions:** https://github.com/vercel/vercel/discussions
- **Android Stack Overflow:** https://stackoverflow.com/questions/tagged/android
- **Capacitor Forums:** https://forum.ionicframework.com

### Direct Support
- **App Support:** airaplayintl@gmail.com
- **Vercel Support:** https://vercel.com/support
- **Google Play Support:** Via Play Console

---

## 🔄 Update Process

### Admin Dashboard (Vercel)
Automatic deployment on every Git push:
```bash
git add .
git commit -m "Update admin dashboard"
git push origin main
# Vercel auto-deploys in 2-3 minutes
```

### Android App (Play Store)
Manual process for each update:
1. Make code changes
2. Increment `versionCode` and `versionName`
3. Build new AAB
4. Upload to Play Console
5. Submit for review (1-3 days)

---

## ✅ Pre-Deployment Checklist

Before starting deployment:

**Code:**
- [ ] All features working locally
- [ ] No console errors
- [ ] Tests passing
- [ ] Build succeeds: `npm run build:web` and `npm run build:app`

**Accounts:**
- [ ] GitHub account ready
- [ ] Vercel account created
- [ ] Google Play Developer account ($25 paid)

**Assets:**
- [ ] App icon (512x512)
- [ ] Feature graphic (1024x500)
- [ ] Screenshots (2-8 images)
- [ ] Privacy policy written and hosted

**Information:**
- [ ] App description prepared
- [ ] Release notes written
- [ ] Support email configured
- [ ] Contact information ready

---

## 🎉 Post-Deployment

After successful deployment:

### Immediate Actions
1. Test both deployments thoroughly
2. Monitor error logs (Vercel + Play Console)
3. Verify analytics tracking
4. Check email notifications working

### Ongoing Maintenance
1. Respond to user reviews (within 24-48 hours)
2. Monitor crash reports
3. Track performance metrics
4. Plan regular updates
5. Engage with user feedback

### Marketing
1. Announce launch on social media
2. Share Play Store link
3. Reach out to early users
4. Encourage reviews and ratings
5. Create promotional content

---

## 📈 Success Metrics

Track these KPIs post-launch:

**Admin Dashboard:**
- Uptime percentage
- Load times
- Error rates
- Admin user activity

**Mobile App:**
- Downloads/installs
- Daily active users
- Crash-free rate
- User ratings (target: 4.0+)
- Retention rate

---

## 🗺️ Roadmap

### Phase 1: Launch (Current)
- Deploy admin dashboard
- Submit to Play Store
- Basic monitoring

### Phase 2: Stabilize (Week 1-4)
- Fix critical bugs
- Improve performance
- Respond to feedback

### Phase 3: Grow (Month 2+)
- Add new features
- Optimize conversion
- Scale infrastructure

---

## 📝 Notes

- Review times vary (typically 3-7 days, can be up to 14 days for first submission)
- Keep detailed notes of your deployment process
- Document any deviations from guides
- Save all credentials securely
- Regular backups are essential

---

**Ready to deploy? Pick your starting guide above and let's launch! 🚀**

For questions or issues, start with the troubleshooting guide or contact support.
