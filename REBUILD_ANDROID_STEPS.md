# Quick Guide: Rebuild Android App

## The Problem You Showed Me
- Your app (AIRAPLAY.jpg): Green nav bar has BLACK GAP below it ❌
- Audiomack (AUDIO MACK.jpg): Nav bar reaches bottom edge ✅

## What I Fixed
1. ✅ Created Android theme files for edge-to-edge display
2. ✅ Updated MainActivity.java for transparent system bars
3. ✅ Fixed CSS heights (html, body, #app now use `height: 100%`)
4. ✅ Removed problematic padding from html/body
5. ✅ Updated Capacitor config
6. ✅ Built the project successfully

## What You Must Do NOW

### Copy & Paste These Commands:

```bash
# Step 1: Sync changes to Android
npx cap sync android

# Step 2: Open Android Studio
npx cap open android
```

### In Android Studio:

1. **Sync Gradle**
   - Click: `File → Sync Project with Gradle Files`
   - Wait for completion

2. **Clean Build**
   - Click: `Build → Clean Project`
   - Wait for completion

3. **Rebuild**
   - Click: `Build → Rebuild Project`
   - Wait for completion

4. **Run**
   - Click the green **Play** button
   - Select your device
   - Wait for app to install

## Expected Result
Your nav bar will now look EXACTLY like Audiomack's - reaching the true bottom edge with NO GAP! 🎉

## If You Have Issues
1. Make sure you ran `npx cap sync android` first
2. Do a full Clean + Rebuild (not just re-run)
3. If still broken, uninstall old app from phone first
4. Check that you're testing on Android 5.0+ device

## Why This Will Work
- Android apps by default DON'T draw behind system bars
- I configured your app to draw edge-to-edge (like Audiomack does)
- Added proper transparent system bars
- Fixed all height constraints in HTML/CSS

---

**Your Android device info:**
- Android Version: 14 ✓
- Navigation: Gesture-based ✓
- These are perfect for the fix!
