# Android Play Store Deployment Guide

Complete step-by-step guide to deploy Airaplay mobile app to Google Play Store.

## Prerequisites

- [x] Android Studio installed (latest version)
- [x] Google Play Developer Account ($25 one-time fee)
- [x] JDK 17+ installed
- [x] Project built successfully for Android
- [x] All assets (icons, screenshots, graphics) ready

---

## Part 1: Setup Android Studio & Environment

### Step 1.1: Install Android Studio

1. Download from: https://developer.android.com/studio
2. Install with default settings
3. Open Android Studio
4. Complete setup wizard

**Select:**
- Standard installation
- Download Android SDK
- Accept licenses

### Step 1.2: Install Required SDK Components

1. Open Android Studio
2. Go to: `Tools` → `SDK Manager`
3. Install:
   - ✅ Android 14.0 (API 34) - Latest
   - ✅ Android 13.0 (API 33)
   - ✅ Android SDK Platform-Tools
   - ✅ Android SDK Build-Tools 34.0.0

4. Switch to "SDK Tools" tab
5. Install:
   - ✅ Android SDK Command-line Tools
   - ✅ Google Play services

### Step 1.3: Configure Environment Variables

**Windows:**
```cmd
setx ANDROID_HOME "C:\Users\YourUsername\AppData\Local\Android\Sdk"
setx PATH "%PATH%;%ANDROID_HOME%\platform-tools"
```

**macOS/Linux:**
```bash
# Add to ~/.bashrc or ~/.zshrc
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
```

Restart terminal after setting variables.

---

## Part 2: Prepare Project for Release

### Step 2.1: Build Web Assets First

```bash
# From project root
npm install
npm run build:app
```

This creates optimized production build in `dist/` folder.

### Step 2.2: Sync Capacitor

```bash
# Copy web assets to Android
npx cap sync android
```

### Step 2.3: Open Project in Android Studio

```bash
npx cap open android
```

OR manually:
1. Open Android Studio
2. `File` → `Open`
3. Navigate to project → `android` folder
4. Click "Open"

### Step 2.4: Wait for Gradle Sync

Android Studio will automatically:
- Download dependencies
- Sync Gradle
- Index project

**Wait until you see:** "Gradle sync finished" (bottom right)

---

## Part 3: Configure App for Release

### Step 3.1: Update App Information

Open `android/app/build.gradle` and verify:

```gradle
android {
    namespace "com.airaplay.app"
    compileSdk 34

    defaultConfig {
        applicationId "com.airaplay.app"
        minSdk 24
        targetSdk 34
        versionCode 1        // Increment for each release
        versionName "1.0.0"  // User-visible version
    }
}
```

### Step 3.2: Update Version for Release

**Important:** For each new release:
- Increment `versionCode` (1, 2, 3, 4...)
- Update `versionName` ("1.0.0", "1.0.1", "1.1.0"...)

### Step 3.3: Configure App Name

Open `android/app/src/main/res/values/strings.xml`:

```xml
<resources>
    <string name="app_name">Airaplay</string>
    <string name="title_activity_main">Airaplay</string>
    <string name="package_name">com.airaplay.app</string>
    <string name="custom_url_scheme">airaplay</string>
</resources>
```

### Step 3.4: Verify App Icon

Check that icons exist in:
- `android/app/src/main/res/mipmap-hdpi/`
- `android/app/src/main/res/mipmap-mdpi/`
- `android/app/src/main/res/mipmap-xhdpi/`
- `android/app/src/main/res/mipmap-xxhdpi/`
- `android/app/src/main/res/mipmap-xxxhdpi/`

**Generate icons if needed:**
1. Use Android Studio: `File` → `New` → `Image Asset`
2. Select icon type: "Launcher Icons (Adaptive and Legacy)"
3. Upload your logo
4. Click "Next" → "Finish"

---

## Part 4: Create Signing Key

### Step 4.1: Generate Keystore File

**IMPORTANT:** Keep this file safe! You'll need it for ALL future updates.

```bash
# Navigate to android/app directory
cd android/app

# Generate keystore
keytool -genkey -v -keystore airaplay-release-key.keystore -alias airaplay-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

**You'll be prompted for:**
- Keystore password: (Create strong password - SAVE THIS!)
- Key password: (Same as keystore password recommended)
- First and last name: Your name or company name
- Organizational unit: Development or your team name
- Organization: Airaplay
- City/Locality: Your city
- State/Province: Your state
- Country code: Your 2-letter country code (e.g., US, NG, UK)

**Example:**
```
Enter keystore password: MySecurePassword123!
Re-enter new password: MySecurePassword123!
What is your first and last name? [Unknown]: John Doe
What is the name of your organizational unit? [Unknown]: Development
What is the name of your organization? [Unknown]: Airaplay
What is the name of your City or Locality? [Unknown]: Lagos
What is the name of your State or Province? [Unknown]: Lagos State
What is the two-letter country code for this unit? [Unknown]: NG
Is CN=John Doe, OU=Development, O=Airaplay, L=Lagos, ST=Lagos State, C=NG correct? [no]: yes
```

### Step 4.2: Secure Your Keystore

**CRITICAL:**
1. Backup `airaplay-release-key.keystore` to secure location
2. Save passwords in secure password manager
3. **NEVER commit keystore to Git**
4. **NEVER share keystore publicly**

Add to `.gitignore`:
```
*.keystore
*.jks
key.properties
```

### Step 4.3: Create Key Properties File

Create `android/key.properties`:

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=airaplay-key-alias
storeFile=airaplay-release-key.keystore
```

Replace with your actual passwords from Step 4.1.

### Step 4.4: Configure Gradle to Use Signing Key

Open `android/app/build.gradle` and add BEFORE `android {`:

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    // ... existing config

    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

---

## Part 5: Build Release APK/AAB

### Step 5.1: Clean Build

In Android Studio:
1. `Build` → `Clean Project`
2. Wait for completion
3. `Build` → `Rebuild Project`

### Step 5.2: Build App Bundle (AAB) - Recommended

App Bundle is required for Play Store:

**Method 1 - Android Studio:**
1. `Build` → `Generate Signed Bundle / APK`
2. Select "Android App Bundle"
3. Click "Next"
4. Select keystore file: `android/app/airaplay-release-key.keystore`
5. Enter passwords
6. Key alias: `airaplay-key-alias`
7. Click "Next"
8. Select "release" build variant
9. Check "Export encrypted key"
10. Click "Create"

**Method 2 - Command Line:**
```bash
cd android
./gradlew bundleRelease
```

**Output location:**
```
android/app/build/outputs/bundle/release/app-release.aab
```

### Step 5.3: Build APK (Optional - for testing)

For testing on devices before Play Store submission:

```bash
cd android
./gradlew assembleRelease
```

**Output location:**
```
android/app/build/outputs/apk/release/app-release.apk
```

### Step 5.4: Verify Build Success

Check that files exist:
- ✅ `app-release.aab` (for Play Store)
- ✅ `app-release.apk` (for testing)

**File sizes should be:**
- AAB: ~20-50 MB (optimized)
- APK: ~30-70 MB

---

## Part 6: Test Release Build

### Step 6.1: Install APK on Test Device

```bash
# Connect Android device via USB (enable USB debugging)
adb devices  # Verify device connected

# Install APK
adb install android/app/build/outputs/apk/release/app-release.apk
```

### Step 6.2: Test Critical Features

Test thoroughly:
- ✅ App launches successfully
- ✅ Login/Signup works
- ✅ Music playback works
- ✅ Video playback works
- ✅ Treat wallet works
- ✅ Promotions work
- ✅ No crashes or errors
- ✅ All screens load properly

### Step 6.3: Test on Multiple Devices

Test on at least:
- 1 device with Android 10 or lower
- 1 device with Android 11-13
- 1 device with Android 14+
- Different screen sizes (phone and tablet)

---

## Part 7: Create Google Play Developer Account

### Step 7.1: Register Developer Account

1. Go to: https://play.google.com/console/signup
2. Sign in with Google account
3. Accept Developer Agreement
4. Pay $25 one-time registration fee
5. Complete account details:
   - Developer name: "Airaplay" or your company name
   - Email address
   - Phone number
   - Website (optional)

### Step 7.2: Verify Identity

Google may require:
- Phone verification
- Email verification
- Identity verification (government ID)

Complete all verification steps.

---

## Part 8: Create App in Play Console

### Step 8.1: Create New App

1. Login to Play Console: https://play.google.com/console
2. Click "Create app"
3. Fill in details:

**App details:**
- App name: `Airaplay`
- Default language: `English (United States)`
- App or game: `App`
- Free or paid: `Free`

**Declarations:**
- Check "I declare that this app complies with US export laws"
- Check content rating declarations

Click "Create app"

### Step 8.2: Set Up App Details

Navigate through left sidebar and complete ALL sections:

#### 8.2.1 App Access
- Select: "All functionality is available without restrictions"
- OR provide test credentials if login required

#### 8.2.2 Ads
- Does your app contain ads? `Yes`
- Does app use AdMob? `Yes`

#### 8.2.3 Content Rating

1. Click "Start questionnaire"
2. Enter email address
3. Select category: `Music`
4. Answer questions honestly:
   - Violence: No
   - Sexual content: No
   - Profanity: No (unless user-generated content)
   - Drug/alcohol/tobacco: No
   - User interaction: Yes (users can upload/share content)
   - Share location: No
   - Purchase digital goods: Yes

5. Submit questionnaire
6. Apply ratings

#### 8.2.4 Target Audience

- Target age groups: `13 years and older`
- Appeal to children: `No`

#### 8.2.5 News App

- Is this a news app? `No`

#### 8.2.6 COVID-19 Contact Tracing

- Contact tracing app? `No`

#### 8.2.7 Data Safety

**IMPORTANT:** Be accurate and complete

1. Click "Start"
2. Data collection:
   - Email address: Collected, Required, For account management
   - Name: Collected, Required, For account functionality
   - Location: Collected, Optional, For app functionality
   - App interactions: Collected, Required, For analytics

3. Data sharing: No data shared with third parties

4. Data security:
   - Data encrypted in transit: Yes
   - Users can request deletion: Yes
   - Committed to Play Families Policy: No

5. Data usage:
   - Account management
   - Personalization
   - Analytics
   - App functionality

#### 8.2.8 Government Apps

- Government app? `No`

#### 8.2.9 Financial Features

- Financial transactions? `Yes` (in-app purchases for Treats)
- Describe: "Users can purchase virtual currency (Treats) for promotional features"

---

## Part 9: Store Listing

### Step 9.1: Main Store Listing

Navigate to: `Grow` → `Store presence` → `Main store listing`

**App details:**
- **App name:** Airaplay
- **Short description (80 chars):**
  ```
  Stream music & videos. Support artists. Earn rewards while listening.
  ```

- **Full description (4000 chars max):**
  ```
  Airaplay is the revolutionary music and video streaming platform that rewards EVERYONE.

  🎵 FOR LISTENERS:
  • Stream unlimited music and videos
  • Discover trending tracks and rising artists
  • Create and share playlists
  • Earn rewards while listening to content
  • Support your favorite creators with Treats
  • Get personalized Daily Mixes
  • Listen offline with downloads

  🎤 FOR CREATORS:
  • Upload your music and videos
  • Reach millions of listeners
  • Earn from streams and engagement
  • Promote your content effectively
  • Track detailed analytics
  • Build your fanbase organically
  • Collaborate with other artists

  💰 UNIQUE FEATURES:
  • Revolutionary reward system - earn while you listen
  • Fair revenue distribution
  • Direct creator support via Treats
  • Promotional system for visibility
  • Real-time analytics
  • Social features and collaboration tools

  🌍 GLOBAL MUSIC COMMUNITY:
  Join thousands of artists and listeners worldwide. Whether you're creating music or discovering new sounds, Airaplay gives you the platform and rewards you deserve.

  Download now and be part of the music revolution!

  Support: airaplayintl@gmail.com
  ```

**App icon:**
- Upload 512x512 PNG icon
- No alpha channel
- Full-bleed icon (follows Material Design guidelines)

**Feature graphic:**
- Size: 1024 x 500 pixels
- Eye-catching promotional image
- Include app name and tagline

**Phone screenshots (REQUIRED - 2-8 images):**
- Minimum 2 screenshots
- Size: 1080 x 1920 pixels (9:16 ratio)
- PNG or JPEG

Screenshot suggestions:
1. Home screen with music player
2. Profile/Library screen
3. Creator upload interface
4. Treat wallet/rewards screen
5. Trending/Discovery screen

**7-inch tablet screenshots (OPTIONAL):**
- Size: 1200 x 1920 pixels

**10-inch tablet screenshots (OPTIONAL):**
- Size: 1920 x 1200 pixels

**Video (OPTIONAL but recommended):**
- Upload demo video (30 seconds - 2 minutes)
- Show key features
- Good quality (1080p minimum)

### Step 9.2: Contact Details

- **Email:** airaplayintl@gmail.com
- **Phone:** (Your support phone number)
- **Website:** https://airaplay.com (if available)
- **Privacy Policy URL:** (Required - see Step 9.3)

### Step 9.3: Create Privacy Policy

Create a privacy policy page and host it publicly. Include:
- What data you collect
- How data is used
- How data is protected
- User rights
- Contact information

Host on:
- Your website
- GitHub Pages
- Google Sites

Example URL: `https://airaplay.com/privacy-policy`

---

## Part 10: Release Management

### Step 10.1: Create Production Release

1. Navigate to: `Release` → `Production`
2. Click "Create new release"
3. Upload AAB file: `app-release.aab`
4. Wait for upload (may take 5-15 minutes)
5. Google Play will process and optimize

### Step 10.2: Release Name

- Enter: `1.0.0 - Initial Release`

### Step 10.3: Release Notes

**English (US) - What's new:**
```
Welcome to Airaplay!

🎉 Initial Release Features:
• Stream unlimited music and videos
• Earn rewards while listening
• Support creators with Treats
• Upload and promote your content
• Personalized Daily Mixes
• Offline downloads
• Real-time analytics

Join the music revolution today!
```

### Step 10.4: Select Countries/Regions

- Add countries: Select "Add countries/regions"
- Choose: "Available in all countries"
- OR select specific countries

### Step 10.5: Review Release

Check all sections have green checkmarks:
- ✅ App details complete
- ✅ Store listing complete
- ✅ Content rating assigned
- ✅ Target audience set
- ✅ Data safety complete
- ✅ Pricing & distribution set

### Step 10.6: Submit for Review

1. Click "Save"
2. Click "Review release"
3. Verify all information
4. Click "Start rollout to Production"

---

## Part 11: Review Process

### Step 11.1: Initial Review Timeline

- **Typical duration:** 3-7 days
- **Can take:** Up to 14 days for first app

### Step 11.2: Review Status

Check status in Play Console:
- `In review` - Google is testing
- `Approved` - App will be published soon
- `Rejected` - Issues found (see rejection reasons)

### Step 11.3: If Rejected

Common rejection reasons:
1. **Policy violations** - Review policies and fix
2. **Crashes** - Fix bugs and resubmit
3. **Misleading content** - Update descriptions
4. **Privacy policy issues** - Update policy

**To resubmit:**
1. Fix issues
2. Build new AAB (increment versionCode)
3. Create new release
4. Resubmit

---

## Part 12: Post-Launch

### Step 12.1: Monitor Performance

Track in Play Console:
- Downloads and installs
- Crashes and ANRs
- User ratings and reviews
- Uninstall rate

### Step 12.2: Respond to Reviews

- Respond to user reviews within 24-48 hours
- Address issues professionally
- Thank users for positive feedback

### Step 12.3: Update Release

For updates:
1. Make code changes
2. Build web: `npm run build:app`
3. Sync Capacitor: `npx cap sync android`
4. Increment `versionCode` in `build.gradle`
5. Update `versionName` (e.g., 1.0.0 → 1.0.1)
6. Build new AAB
7. Create new release in Play Console
8. Submit for review

---

## Part 13: Troubleshooting

### Issue 1: Gradle Build Fails

**Solution:**
```bash
cd android
./gradlew clean
./gradlew build
```

### Issue 2: Signing Error

**Error:** "Failed to read key from keystore"

**Solution:**
- Verify passwords in `key.properties`
- Check keystore file path is correct
- Ensure keystore file exists

### Issue 3: App Crashes on Launch

**Solution:**
1. Test debug build first: `npx cap run android`
2. Check logs: `adb logcat`
3. Fix errors in code
4. Rebuild release version

### Issue 4: APK Size Too Large

**Solution:**
- Enable ProGuard (already configured)
- Use App Bundle instead of APK
- Remove unused resources
- Optimize images

### Issue 5: Upload Rejected - Version Code

**Error:** "Version code 1 has already been used"

**Solution:**
- Increment `versionCode` in `build.gradle`
- Must be higher than previous release
- Example: 1 → 2 → 3

---

## Security Checklist

Before releasing:
- [x] Debug mode disabled
- [x] ProGuard enabled
- [x] API keys secured (not in code)
- [x] HTTPS used for all API calls
- [x] User data encrypted
- [x] Keystore backed up securely
- [x] Privacy policy published
- [x] Google Play policies reviewed

---

## Required Assets Checklist

Before Play Store submission:
- [x] App icon (512x512)
- [x] Feature graphic (1024x500)
- [x] Phone screenshots (2-8)
- [x] Privacy policy URL
- [x] Signed AAB file
- [x] App description
- [x] Release notes
- [x] Content rating

---

## Timeline Summary

| Task | Estimated Time |
|------|----------------|
| Setup Android Studio | 30-60 minutes |
| Configure project | 20-30 minutes |
| Create signing key | 10 minutes |
| Build release AAB | 10-20 minutes |
| Test release build | 1-2 hours |
| Play Console setup | 1-2 hours |
| Create store listing | 1-2 hours |
| Submit for review | 15 minutes |
| **Total:** | **4-8 hours** |
| Google Review | **3-7 days** |

---

## Cost Breakdown

| Item | Cost |
|------|------|
| Google Play Developer Account | $25 (one-time) |
| App hosting (Vercel) | Free |
| Supabase database | Free tier |
| **Total to get started:** | **$25** |

---

## Support Resources

- **Android Studio:** https://developer.android.com/studio/intro
- **Play Console:** https://support.google.com/googleplay/android-developer
- **Capacitor Docs:** https://capacitorjs.com/docs/android
- **Play Store Policies:** https://play.google.com/about/developer-content-policy

---

## Quick Command Reference

```bash
# Build web for app
npm run build:app

# Sync Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android

# Build release AAB (command line)
cd android && ./gradlew bundleRelease

# Build release APK (command line)
cd android && ./gradlew assembleRelease

# Install APK on device
adb install android/app/build/outputs/apk/release/app-release.apk
```

---

**Next Steps:**
1. ✅ Follow this guide step-by-step
2. ✅ Complete Play Console setup
3. ✅ Submit app for review
4. ✅ Monitor and maintain app

**Deployment Status:** Ready for Play Store ✅
