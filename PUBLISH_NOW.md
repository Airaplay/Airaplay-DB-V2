# Quick Start: Publish Airaplay Now

Your app is ready to publish! Follow these steps to go live.

## Status: ✅ Ready for Deployment

Both builds have been verified and are production-ready.

---

## Option 1: Web Deployment (Admin Dashboard) - 5 Minutes

### Deploy to Vercel

**Easiest Method - Automatic Deployment:**

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for production"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to https://vercel.com/new
   - Click "Import Project"
   - Select your Airaplay repository
   - Click "Import"

3. **Configure (Auto-detected)**
   - Framework: Vite (auto-detected)
   - Build Command: `npm run build:web` (configured in vercel.json)
   - Output: dist (configured in vercel.json)

4. **Add Environment Variables**
   Click "Environment Variables" and add:
   ```
   VITE_SUPABASE_URL=your_value
   VITE_SUPABASE_ANON_KEY=your_value
   VITE_APP_TARGET=web
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes
   - Your admin dashboard will be live at: `https://your-project.vercel.app/admin`

**Done!** Your web admin dashboard is now live.

---

## Option 2: Mobile Deployment (Play Store) - 30 Minutes

### Build for Android

**Already built!** The production build is ready in the `dist` folder.

1. **Sync to Android**
   ```bash
   npx cap sync android
   ```

2. **Open Android Studio**
   ```bash
   npx cap open android
   ```

3. **Generate Signed Bundle**
   
   In Android Studio:
   - Go to: **Build** > **Generate Signed Bundle / APK**
   - Select: **Android App Bundle**
   - Create/Select keystore (save credentials securely!)
   - Select **release** build variant
   - Click **Finish**

4. **Upload to Play Store**
   
   - Go to https://play.google.com/console
   - Create new app or select existing
   - Go to: **Release** > **Production**
   - Upload the AAB file from: `android/app/release/app-release.aab`
   - Fill in store listing (use PUBLICATION_GUIDE.md for content)
   - Submit for review

5. **Wait for Approval**
   - Review typically takes 1-7 days
   - You'll receive email when approved
   - App will be live on Play Store

**Done!** Your mobile app is submitted to Play Store.

---

## What's Deployed Where?

### Web (Vercel)
- ✅ Admin Dashboard
- ✅ Admin Login
- ✅ All management tools
- 📱 Accessible on desktop and mobile browsers

### Mobile (Play Store)
- ✅ Home, Explore, Library, Create, Profile screens
- ✅ All user features (streaming, uploads, payments)
- ✅ No admin routes (security)
- 📱 Native Android app

### Both Share
- 🗄️ Same Supabase database
- 💾 Same BunnyCDN storage
- 💳 Same payment gateways
- 📧 Same email system

---

## Environment Variables Checklist

Make sure these are configured:

### Required (Both Deployments)
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

### Web Only
```env
VITE_APP_TARGET=web
```

### Mobile Only  
```env
VITE_APP_TARGET=app
```

---

## Quick Commands Reference

### Deploy Web
```bash
git push origin main  # Vercel auto-deploys
```

### Build Mobile
```bash
npm run build:app
npx cap sync android
npx cap open android
```

### Verify Before Deploy
```bash
./verify-deployment.sh
```

---

## Post-Deployment

### Immediately After Web Deploy

1. **Test Admin Access**
   - Visit: `https://your-domain.vercel.app/admin/login`
   - Login with admin credentials
   - Verify dashboard loads

2. **Test Core Features**
   - User signup/login
   - Content browsing
   - Basic navigation

3. **Monitor Logs**
   - Check Vercel dashboard for errors
   - Review Supabase logs
   - Monitor user activity

### After Mobile App Approval

1. **Test on Real Device**
   - Download from Play Store
   - Test all features
   - Verify payments (test mode first!)

2. **Monitor Metrics**
   - Play Console dashboard
   - Crash reports
   - User reviews

3. **Gradual Rollout**
   - Start with 10% of users
   - Monitor for issues
   - Increase to 100% if stable

---

## Support & Documentation

- **Full Guide**: See `PUBLICATION_GUIDE.md`
- **Deployment Config**: See `DEPLOYMENT_GUIDE.md`
- **Troubleshooting**: See `PUBLICATION_GUIDE.md` > Troubleshooting section

---

## Verification Results

```
✓ Web build successful
✓ Mobile build successful
✓ Environment configured
✓ Dependencies installed
✓ Project structure valid
✓ Ready for deployment
```

---

## Need Help?

### Common Issues

**Web deployment fails:**
- Check Vercel build logs
- Verify environment variables
- Ensure `VITE_APP_TARGET=web`

**Mobile build fails:**
- Run `npx cap sync android` again
- Check Android Studio logs
- Verify SDK versions

**Admin dashboard not accessible:**
- Check URL is correct (/admin/login)
- Verify user has admin role in database
- Check browser console for errors

---

## Success Criteria

Your app is live when:

- ✅ Web admin dashboard is accessible at your Vercel URL
- ✅ Mobile app is available on Google Play Store
- ✅ Users can sign up, log in, and use the app
- ✅ Content can be uploaded and streamed
- ✅ No critical errors in production

---

## Ready to Go Live?

1. **Web**: Just push to GitHub, Vercel handles the rest
2. **Mobile**: Run the Android Studio steps above
3. **Monitor**: Keep an eye on logs and user feedback

🚀 **You're all set to publish Airaplay!**
