# Android App Quick Start Guide

## 🚀 Fast Track: Test App on Your Phone in 15 Minutes

This is a condensed guide to get the Android app running on your phone as quickly as possible.

---

## Prerequisites (One-Time Setup)

### 1. Install Android Studio
- Download from: https://developer.android.com/studio
- Install with default settings
- Let it download SDK components during setup

### 2. Enable Developer Mode on Phone
1. Settings → About Phone
2. Tap "Build Number" 7 times
3. Go back → Developer Options → Enable "USB Debugging"

### 3. Connect Phone
```bash
# Verify connection
adb devices
```
Should show your device. If not, accept the prompt on your phone.

---

## Build & Install Steps

### Step 1: Prepare Project
```bash
cd /tmp/cc-agent/60861448/project

# Install dependencies (if not done)
npm install

# Build web assets
npm run build
```

### Step 2: Sync with Android
```bash
# Copy web assets to Android project
npx cap sync android
```

### Step 3: Open in Android Studio
```bash
npx cap open android
```

This opens Android Studio with your project.

### Step 4: Build & Install
In Android Studio:
1. Wait for Gradle sync to complete (bottom right corner)
2. Select your phone from device dropdown (top toolbar)
3. Click green ▶️ play button
4. Wait for build (~2-5 minutes first time)
5. App installs and opens on your phone automatically

---

## Alternative: Build APK Manually

If Android Studio method doesn't work:

```bash
# Build the APK
cd android
./gradlew assembleDebug

# Install to phone
cd ..
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

You can also:
1. Copy APK to phone's Downloads folder
2. Open file manager on phone
3. Tap APK to install
4. Allow "Install from unknown sources" if prompted

---

## Test the App

### Essential Tests
- [ ] App opens without crashing
- [ ] Can create account / login
- [ ] Home screen loads content
- [ ] Can play a song
- [ ] Can play a video
- [ ] Bottom navigation works
- [ ] Can view profile

### Check Logs (If Issues)
```bash
# View real-time logs
adb logcat | grep "Airaplay"

# Or use Chrome
# 1. Open chrome://inspect in Chrome browser
# 2. Find your device
# 3. Click "inspect"
# 4. View console tab
```

---

## Common Issues & Quick Fixes

### Issue: "adb: command not found"
**Fix:** Add Android SDK to PATH
```bash
# Add to ~/.bashrc or ~/.zshrc
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### Issue: "No devices found"
**Fix:**
1. Unplug and replug USB cable
2. Try different USB port
3. On phone: Disable and re-enable USB debugging
4. Try "File Transfer" mode instead of "Charging only"

### Issue: "Installation failed"
**Fix:**
```bash
# Uninstall existing app first
adb uninstall com.airaplay.app

# Then install again
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Issue: Gradle build failed
**Fix:**
```bash
cd android
./gradlew clean
./gradlew assembleDebug
```

### Issue: App crashes on launch
**Fix:**
1. Check logs: `adb logcat | grep "AndroidRuntime"`
2. Verify `.env` file exists and has all variables
3. Check Supabase credentials are correct
4. Rebuild: `npm run build && npx cap sync android`

### Issue: Blank/white screen
**Fix:**
1. Open chrome://inspect
2. Check console for JavaScript errors
3. Verify Supabase connection
4. Check network tab for failed requests

---

## Rebuild After Code Changes

Whenever you change code:

```bash
# 1. Rebuild web assets
npm run build

# 2. Sync to Android
npx cap sync android

# 3. Reinstall (choose one method)

# Method A: Via Android Studio
npx cap open android
# Then click Run button

# Method B: Via command line
cd android && ./gradlew installDebug
```

---

## Pro Tips

### Faster Rebuilds
```bash
# Only rebuild if you changed TypeScript/React code
npm run build && npx cap copy android && cd android && ./gradlew installDebug
```

### Keep Logs Open
```bash
# In a separate terminal, keep this running
adb logcat | grep -E "(Airaplay|Capacitor|Console)"
```

### Hot Reload (Development)
For faster development:
1. Run web dev server: `npm run dev`
2. Note the local IP (e.g., http://192.168.1.100:5173)
3. Update `capacitor.config.ts`:
```typescript
server: {
  url: 'http://192.168.1.100:5173',
  cleartext: true
}
```
4. Rebuild and install
5. App now loads from dev server (live reload!)
6. Remember to remove `server` config before production build

---

## Quick Command Reference

```bash
# Check connection
adb devices

# Install app
adb install path/to/app.apk

# Uninstall app
adb uninstall com.airaplay.app

# View logs
adb logcat | grep "Airaplay"

# Clear logs
adb logcat -c

# Copy file to phone
adb push file.apk /sdcard/Download/

# Take screenshot
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png

# Restart ADB
adb kill-server
adb start-server
```

---

## Next Steps After First Install

1. ✅ Test all core features
2. ✅ Check for crashes or errors
3. ✅ Test on different screen sizes (if available)
4. ✅ Test offline functionality
5. ✅ Monitor performance
6. ✅ Fix any issues found
7. ✅ Prepare for release build

---

## Need Help?

**Check logs first:**
```bash
adb logcat | grep -E "(ERROR|AndroidRuntime|Airaplay)"
```

**Debug in Chrome:**
1. `chrome://inspect`
2. Find device
3. Click "inspect"
4. Check console and network tabs

**Common log locations:**
- JavaScript errors: Chrome DevTools Console
- Native crashes: `adb logcat | grep AndroidRuntime`
- Network issues: Chrome DevTools Network tab
- Capacitor issues: `adb logcat | grep Capacitor`

---

## Success! ✅

If your app is running on your phone, congratulations! 🎉

You can now:
- Test features on real device
- Share APK with testers
- Continue development
- Prepare for Play Store release

Remember: This is a **debug build**. For Play Store, you'll need to create a **signed release build** (see main DEPLOYMENT_GUIDE.md).
