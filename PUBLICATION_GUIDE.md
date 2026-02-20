# Airaplay Publication Guide

This guide walks you through publishing Airaplay to both Vercel (web) and Google Play Store (mobile).

## Pre-Deployment Checklist

### Essential Requirements
- [ ] Supabase project is set up and configured
- [ ] All database migrations have been applied
- [ ] Environment variables are documented
- [ ] Admin user accounts created in database
- [ ] Payment gateway credentials configured (Paystack/Flutterwave)
- [ ] BunnyCDN storage configured
- [ ] Email service (ZeptoMail) configured
- [ ] AdMob account set up with ad units

### Testing Verification
- [ ] All screens load without errors
- [ ] User authentication works (signup/login)
- [ ] Content upload (songs, videos, albums) works
- [ ] Payment flow tested (test mode)
- [ ] Admin dashboard accessible
- [ ] Mobile build tested on physical device
- [ ] Database security (RLS) verified

### Production Readiness
- [ ] All console errors resolved
- [ ] Performance optimized
- [ ] Images compressed
- [ ] API rate limits configured
- [ ] Error logging set up
- [ ] Analytics configured

---

## Part 1: Web Deployment (Vercel)

### Step 1: Prepare Environment Variables

Create a `.env.production` file with all required variables:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Build Target
VITE_APP_TARGET=web

# BunnyCDN
VITE_BUNNY_STORAGE_ZONE=your_storage_zone
VITE_BUNNY_HOSTNAME=your_hostname.b-cdn.net
VITE_BUNNY_STREAM_LIBRARY_ID=your_library_id

# Payment Gateways
VITE_PAYSTACK_PUBLIC_KEY=pk_live_xxx
VITE_FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_xxx
```

### Step 2: Deploy to Vercel

#### Option A: Via Vercel Dashboard (Recommended)

1. **Go to Vercel**
   - Visit https://vercel.com/new
   - Sign in with your GitHub account

2. **Import Repository**
   - Click "Import Project"
   - Select your Airaplay repository
   - Click "Import"

3. **Configure Project**
   - Framework Preset: Vite
   - Root Directory: ./
   - Build Command: `npm run build:web`
   - Output Directory: dist
   - Install Command: `npm install`

4. **Add Environment Variables**
   - Go to "Environment Variables" section
   - Add all variables from `.env.production`
   - Make sure `VITE_APP_TARGET=web` is set
   - Click "Deploy"

5. **Verify Deployment**
   - Wait for deployment to complete (2-3 minutes)
   - Visit the deployed URL
   - Test `/admin/login` route
   - Verify admin dashboard works

#### Option B: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod

# Follow prompts to configure project
```

### Step 3: Configure Custom Domain (Optional)

1. Go to Project Settings > Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Wait for SSL certificate (automatic)

### Step 4: Post-Deployment

- **Test Admin Access**: Visit `/admin/login`
- **Create Test User**: Ensure auth works
- **Monitor Logs**: Check Vercel dashboard for errors
- **Set Up Alerts**: Enable error notifications

---

## Part 2: Mobile Deployment (Google Play Store)

### Step 1: Prepare Android Build

#### Update App Configuration

Edit `android/app/build.gradle`:

```gradle
android {
    namespace "com.airaplay.app"
    compileSdk 34
    
    defaultConfig {
        applicationId "com.airaplay.app"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
    }
    
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

#### Update App Metadata

Edit `android/app/src/main/res/values/strings.xml`:

```xml
<resources>
    <string name="app_name">Airaplay</string>
    <string name="title_activity_main">Airaplay</string>
    <string name="package_name">com.airaplay.app</string>
    <string name="custom_url_scheme">airaplay</string>
</resources>
```

### Step 2: Build Production APK/AAB

```bash
# Clean build
npm run clean-build:app

# Sync to Capacitor
npx cap sync android

# Copy config
npx cap copy android

# Open in Android Studio
npx cap open android
```

### Step 3: Generate Signed Bundle in Android Studio

1. **Generate Upload Key** (First time only)
   ```bash
   keytool -genkey -v -keystore airaplay-upload-key.keystore -alias airaplay -keyalg RSA -keysize 2048 -validity 10000
   ```
   
   - Store the keystore file securely
   - Save the password safely

2. **Configure Signing in Android Studio**
   - Go to: Build > Generate Signed Bundle / APK
   - Select: Android App Bundle
   - Create new or choose existing keystore
   - Fill in credentials
   - Select "release" build variant
   - Click "Finish"

3. **Locate the AAB file**
   - Found at: `android/app/release/app-release.aab`
   - This file will be uploaded to Play Store

### Step 4: Create Play Store Listing

1. **Go to Google Play Console**
   - Visit https://play.google.com/console
   - Create new app

2. **Complete App Details**
   - App name: Airaplay
   - Default language: English
   - App or game: App
   - Free or paid: Free

3. **Set Up Store Listing**

   **Short description** (80 chars):
   ```
   Stream music, discover artists, earn rewards. Your music, your way.
   ```

   **Full description** (4000 chars):
   ```
   Airaplay is a revolutionary music streaming platform that rewards both creators and listeners.

   FOR CREATORS:
   • Upload your music and videos
   • Earn from streams and engagement
   • Promote your content
   • Build your fanbase
   • Track detailed analytics

   FOR LISTENERS:
   • Stream unlimited music and videos
   • Earn rewards while listening
   • Discover new artists
   • Create custom playlists
   • Daily personalized mixes
   • Support your favorite artists

   KEY FEATURES:
   ✓ High-quality audio streaming
   ✓ AI-powered recommendations
   ✓ Offline playback
   ✓ Social sharing
   ✓ Real-time analytics
   ✓ Secure payments
   ✓ Multi-currency support

   Join thousands of music lovers and creators on Airaplay today!
   ```

4. **Upload Assets**

   Required assets:
   - App icon (512x512 PNG)
   - Feature graphic (1024x500 PNG)
   - Screenshots (2-8 images, phone & tablet)
   - Video (optional, YouTube URL)

5. **Content Rating**
   - Complete the questionnaire
   - Airaplay should get "Everyone" or "Teen" rating

6. **Select Countries**
   - Choose all available countries or specific regions
   - Configure pricing (Free)

7. **Privacy Policy**
   - Provide privacy policy URL
   - Must be accessible public URL

### Step 5: Upload App Bundle

1. **Go to Release > Production**
2. Click "Create new release"
3. Upload the AAB file (`app-release.aab`)
4. Add release notes:
   ```
   Initial release of Airaplay
   • Stream music and videos
   • Earn rewards while listening
   • Create and share playlists
   • Discover new artists
   ```
5. Review and roll out

### Step 6: Review and Launch

1. Complete all required sections
2. Submit for review
3. Wait for approval (1-7 days typically)
4. Monitor review status in Play Console

---

## Post-Publication Monitoring

### Web (Vercel)

**Monitor:**
- Vercel Analytics Dashboard
- Error logs in Vercel console
- User feedback

**Access:**
- Production URL: `https://your-domain.vercel.app`
- Admin Dashboard: `https://your-domain.vercel.app/admin`

### Mobile (Play Store)

**Monitor:**
- Play Console Dashboard
- Crash reports
- User reviews and ratings
- Installation statistics

**Access:**
- Play Store listing
- Production metrics
- User feedback

---

## Maintenance and Updates

### Deploying Updates

**Web:**
```bash
# Make changes, commit, and push
git add .
git commit -m "Update: description"
git push origin main

# Vercel auto-deploys on push
```

**Mobile:**
```bash
# Update versionCode and versionName in build.gradle
# Build new version
npm run clean-build:app
npx cap sync android
npx cap open android

# Generate signed bundle
# Upload to Play Console > Production > Create new release
```

---

## Troubleshooting

### Web Deployment Issues

**Build fails on Vercel:**
- Check build logs in Vercel dashboard
- Verify all environment variables are set
- Ensure `VITE_APP_TARGET=web`
- Check Node version compatibility

**Admin dashboard not loading:**
- Verify admin routes are included in build
- Check browser console for errors
- Verify Supabase connection

### Mobile Deployment Issues

**Build fails in Android Studio:**
- Clean and rebuild project
- Sync Gradle files
- Check Android SDK versions
- Verify capacitor.config.ts

**App crashes on launch:**
- Check Android logs (Logcat)
- Verify environment variables in .env
- Test on multiple devices
- Check permissions in AndroidManifest.xml

**Play Store review rejection:**
- Common reasons: Privacy policy, content rating, permissions
- Address feedback and resubmit
- Ensure app follows Play Store policies

---

## Support Checklist

### Documentation
- [ ] README.md updated
- [ ] API documentation complete
- [ ] User guide created
- [ ] Admin guide created

### Backup and Recovery
- [ ] Database backups automated
- [ ] Media files backed up
- [ ] Environment variables documented
- [ ] Recovery plan documented

### Security
- [ ] SSL/TLS enabled
- [ ] API keys secured
- [ ] RLS policies active
- [ ] Input validation implemented
- [ ] Rate limiting configured

---

## Quick Command Reference

### Web Deployment
```bash
# Build for production
npm run build:web

# Deploy to Vercel
vercel --prod
```

### Mobile Deployment
```bash
# Build for production
npm run clean-build:app

# Sync to Android
npx cap sync android

# Open in Android Studio
npx cap open android
```

### Database
```bash
# Apply migrations
supabase db push

# Reset database (development only)
supabase db reset
```

---

## Success Criteria

Your app is successfully published when:

- ✅ Web admin dashboard is live and accessible
- ✅ Mobile app is available on Play Store
- ✅ Users can sign up and log in
- ✅ Content can be uploaded and streamed
- ✅ Payments are processing correctly
- ✅ No critical errors in production
- ✅ Analytics are tracking correctly
- ✅ Email notifications working

Congratulations on publishing Airaplay!
