# Deployment Quick Start Guide

Fast-track guide to deploy Airaplay admin dashboard and mobile app.

---

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ GitHub account
- ✅ Vercel account
- ✅ Google Play Developer account ($25)
- ✅ Android Studio installed
- ✅ All code tested locally

---

## 🚀 Part 1: Deploy Admin Dashboard (30 mins)

### Step 1: Build & Test
```bash
npm run build:web
```

### Step 2: Push to GitHub
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 3: Deploy to Vercel
1. Go to https://vercel.com
2. Click "Import Project"
3. Select your GitHub repository
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click "Deploy"

### Step 4: Verify
- Visit your Vercel URL
- Test admin login
- Confirm data loads

**✅ Admin dashboard deployed!**

---

## 📱 Part 2: Deploy Android App (4-8 hours)

### Step 1: Build App Bundle
```bash
npm run build:app
npx cap sync android
npx cap open android
```

### Step 2: Create Signing Key
```bash
cd android/app
keytool -genkey -v -keystore airaplay-release-key.keystore \
  -alias airaplay-key-alias -keyalg RSA -keysize 2048 -validity 10000
```
⚠️ **Save password securely! Backup keystore file!**

### Step 3: Build Release
In Android Studio:
1. `Build` → `Generate Signed Bundle / APK`
2. Select "Android App Bundle"
3. Choose keystore file
4. Enter passwords
5. Build release

### Step 4: Test APK
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```
Test all features thoroughly!

### Step 5: Submit to Play Store
1. Go to https://play.google.com/console
2. Create new app
3. Complete all required sections
4. Upload AAB file
5. Submit for review

**✅ App submitted! Wait 3-7 days for approval.**

---

## 📚 Detailed Guides

For complete step-by-step instructions:

1. **Admin Dashboard:** [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md)
2. **Android App:** [ANDROID_DEPLOYMENT_GUIDE.md](./ANDROID_DEPLOYMENT_GUIDE.md)
3. **Checklist:** [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
4. **Troubleshooting:** [DEPLOYMENT_TROUBLESHOOTING.md](./DEPLOYMENT_TROUBLESHOOTING.md)

---

## 🆘 Common Issues

### Build Fails
```bash
npm run build:web  # Fix errors shown
```

### Can't Find Keystore
- Check `android/key.properties`
- Verify keystore file location

### Play Store Rejection
- Read rejection email
- Fix specific issues
- Increment version code
- Resubmit

---

## 💰 Costs

- Google Play Developer: $25 (one-time)
- Vercel: Free
- Supabase: Free
- **Total: $25**

---

## ⏱️ Timeline

- Admin deployment: 30-60 mins
- Android build: 2-3 hours
- Play Store setup: 2-3 hours
- Google review: 3-7 days
- **Total: ~1 week to launch**

---

## ✅ Success Checklist

- [ ] Admin dashboard live on Vercel
- [ ] Android AAB built successfully
- [ ] Tested on real devices
- [ ] Play Store listing complete
- [ ] Submitted for review
- [ ] App approved and live

---

## 📞 Support

**Need help?**
- Vercel: https://vercel.com/support
- Play Store: https://support.google.com/googleplay/android-developer
- Email: airaplayintl@gmail.com

---

**Ready to deploy? Start with the admin dashboard, then move to Android!**

Good luck! 🎉
