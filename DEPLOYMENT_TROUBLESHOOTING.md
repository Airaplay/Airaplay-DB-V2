# Deployment Troubleshooting Guide

Common issues and solutions for Vercel and Play Store deployment.

---

## Vercel Deployment Issues

### Issue 1: Build Fails - TypeScript Errors

**Error:**
```
Error: Command "npm run build:web" exited with 1
Type error: Cannot find module...
```

**Solution:**
```bash
# Fix TypeScript errors locally first
npm run build:web

# Fix any errors shown, then push to GitHub
git add .
git commit -m "Fix TypeScript errors"
git push origin main
```

### Issue 2: Environment Variables Not Working

**Symptoms:**
- Supabase connection fails
- Data doesn't load
- Console shows "undefined" for env vars

**Solution:**
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Verify both variables exist:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Ensure they're set for "Production" environment
4. Redeploy: Deployments → ... → Redeploy

### Issue 3: 404 on Page Refresh

**Solution:**
Already fixed with `vercel.json`. If still occurring:
1. Check `vercel.json` exists in root
2. Verify it contains SPA redirect rules
3. Redeploy project

---

## Android Build Issues

### Issue 1: Gradle Sync Failed

**Error:**
```
Gradle sync failed: Could not resolve dependencies
```

**Solution:**
```bash
cd android
./gradlew clean
./gradlew build --refresh-dependencies
```

### Issue 2: Cannot Find Keystore

**Error:**
```
Execution failed: keystore not found
```

**Solution:**
1. Verify `key.properties` file exists in `android/` folder
2. Check `storeFile` path in `key.properties`
3. Ensure keystore file exists at specified location
4. Use relative path: `storeFile=app/airaplay-release-key.keystore`

### Issue 3: Signing Failed - Wrong Password

**Error:**
```
Failed to read key: Keystore was tampered with, or password was incorrect
```

**Solution:**
1. Verify password in `key.properties`
2. Try entering password manually during signing
3. If forgotten, you must create new keystore (cannot update existing app!)

### Issue 4: APK Too Large

**Solution:**
1. Enable ProGuard (already configured)
2. Use App Bundle (.aab) instead of APK
3. Remove unused resources:
   ```gradle
   android {
       buildTypes {
           release {
               shrinkResources true
               minifyEnabled true
           }
       }
   }
   ```

### Issue 5: App Crashes on Launch

**Solution:**
```bash
# Check logs
adb logcat | grep "AndroidRuntime"

# Common fixes:
# 1. Clear app data
adb shell pm clear com.airaplay.app

# 2. Reinstall
adb uninstall com.airaplay.app
adb install app-release.apk

# 3. Check for missing permissions in AndroidManifest.xml
```

---

## Play Store Submission Issues

### Issue 1: Version Code Already Exists

**Error:**
```
Version code 1 has already been used. Try another version code.
```

**Solution:**
1. Open `android/app/build.gradle`
2. Increment `versionCode`: 1 → 2 → 3
3. Update `versionName` too: "1.0.0" → "1.0.1"
4. Rebuild AAB
5. Upload new version

### Issue 2: Data Safety Form Incomplete

**Solution:**
Complete all sections:
1. Click "Start" in Data Safety
2. Answer all questions thoroughly
3. Be specific about data collection
4. Include privacy policy URL
5. Save and return to dashboard

### Issue 3: Content Rating Missing

**Solution:**
1. Go to Content Rating section
2. Click "Start questionnaire"
3. Select app category: Music
4. Answer all questions
5. Submit questionnaire
6. Apply ratings

### Issue 4: App Rejected - Policy Violation

**Common reasons:**
- Misleading app description
- Missing privacy policy
- Inappropriate content
- Broken functionality

**Solution:**
1. Read rejection email carefully
2. Fix specific issues mentioned
3. Update store listing if needed
4. Increment version code
5. Rebuild and resubmit

### Issue 5: Screenshots Rejected

**Requirements:**
- Minimum 2 screenshots
- Size: 1080 x 1920 pixels
- PNG or JPEG format
- Must show actual app content
- No excessive text overlays

**Solution:**
1. Take screenshots on real device
2. Use Android Studio Device File Explorer
3. Or use `adb shell screencap`
4. Crop to exactly 1080 x 1920
5. Re-upload to Play Console

---

## Supabase Connection Issues

### Issue 1: Database Connection Failed

**Symptoms:**
- "Failed to fetch" errors
- Data doesn't load
- Blank screens

**Solution:**
1. Check Supabase project isn't paused
2. Verify `.env` variables are correct
3. Test connection:
   ```bash
   curl https://vwcadgjaivvffxwgnkzy.supabase.co/rest/v1/
   ```
4. Check Supabase dashboard for service status

### Issue 2: RLS Policies Blocking Access

**Symptoms:**
- "403 Forbidden" errors
- Data shows in Supabase but not in app

**Solution:**
Check RLS policies in Supabase:
1. Go to Table Editor
2. Click table → "Edit table" → RLS
3. Verify policies allow proper access
4. Test with `authenticated` and `anon` roles

---

## Build Performance Issues

### Slow Build Times

**Solution:**
```bash
# Clear caches
rm -rf node_modules
rm -rf android/build
rm -rf android/app/build
npm install

# Or use clean build
npm run clean-build:app
```

### Out of Memory Error

**Solution:**
Increase Gradle memory in `android/gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxPermSize=512m
```

---

## Testing Issues

### Cannot Install APK

**Error:**
```
INSTALL_FAILED_UPDATE_INCOMPATIBLE
```

**Solution:**
```bash
# Uninstall existing app first
adb uninstall com.airaplay.app

# Then install new version
adb install app-release.apk
```

### ADB Device Not Found

**Solution:**
```bash
# Check devices
adb devices

# If empty:
# 1. Enable USB debugging on phone
# 2. Change USB mode to "File Transfer"
# 3. Accept authorization prompt on phone
# 4. Run: adb devices again
```

---

## Quick Fixes

### Reset Vercel Deployment
```bash
# Force new deployment
git commit --allow-empty -m "Trigger deploy"
git push origin main
```

### Reset Android Build
```bash
cd android
./gradlew clean
cd ..
npx cap sync android
```

### Clear All Caches
```bash
rm -rf node_modules
rm -rf .vite
rm -rf dist
npm install
```

---

## Getting Help

### Vercel Issues
- Check build logs in Vercel dashboard
- Visit: https://vercel.com/support
- Community: https://github.com/vercel/vercel/discussions

### Android Issues
- Check Android Studio logs
- Visit: https://developer.android.com/studio/debug
- Stack Overflow: Tag `android` + `capacitor`

### Play Store Issues
- Check rejection email
- Visit: https://support.google.com/googleplay/android-developer
- Review policies: https://play.google.com/about/developer-content-policy

---

## Emergency Recovery

### Lost Keystore File
**CRITICAL:** Cannot update app without original keystore!
- Check all backups immediately
- Contact all team members
- If truly lost, must publish as new app

### Deployment Completely Broken
1. Revert to last working commit
2. Deploy that version
3. Debug issues in separate branch
4. Merge fixes when working

---

**Still having issues? Contact support with:**
- Exact error message
- Steps to reproduce
- Screenshots/logs
- What you've tried already
