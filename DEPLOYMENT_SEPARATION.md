# Deployment Separation Guide

## Overview
This app has two separate deployment targets to prevent accidental cross-deployment:
- **Web**: Admin Dashboard deployed to Vercel
- **App**: Capacitor app deployed to Google Play Store

Both share the same Supabase database and backend, but are built separately.

## Build Targets

### Web Build (Vercel)
```bash
npm run build:web
```
- Creates build for web deployment
- Includes Admin Dashboard
- Sets `__APP_TARGET__ = 'web'`
- Deploy from `dist/` folder to Vercel

### App Build (Play Store)
```bash
npm run build:app
```
- Creates build for Capacitor mobile app
- Includes mobile UI optimizations
- Sets `__APP_TARGET__ = 'app'`
- Use with Capacitor CLI for Android/iOS builds

## Development

### Web Development
```bash
npm run dev:web
```
Runs dev server for web version

### App Development
```bash
npm run dev:app
```
Runs dev server for app version (defaults to app if not specified)

## Safety Mechanisms

### 1. Build Target Constant
The build includes a global constant `__APP_TARGET__` that identifies which target was built.

```typescript
import { BUILD_TARGET, isWebTarget, isAppTarget } from './lib/buildTarget';

if (isWebTarget()) {
  // Web-only code
}

if (isAppTarget()) {
  // App-only code
}
```

### 2. Build Environment Variable
Each build script sets `VITE_APP_TARGET` which is injected into the build.

### 3. Capacitor Package ID
The app has a distinct package ID (`com.airaplay.app`) for Play Store to prevent web builds from being used in Android projects.

## Deployment Checklist

### Before Vercel Deploy (Web)
```bash
# Always use web build
npm run clean-build:web
npm run lint

# Verify build was created
ls dist/

# Check that this is the web build
# Look for assets and ensure it includes admin routes
```

**Vercel Deployment:**
1. Connect Vercel project to this repo
2. Set build command: `npm run build:web`
3. Deploy

### Before Play Store Deploy (App)
```bash
# Always use app build
npm run clean-build:app
npm run lint

# Build Android APK/AAB
npx cap open android

# Or use Capacitor directly:
npx cap copy
npx cap copy android
```

**Play Store Deployment:**
1. Open `android/` directory in Android Studio
2. Build signed APK/AAB
3. Upload to Google Play Store console
4. Package ID must be `com.airaplay.app`

## Shared Infrastructure

### Database
Both targets connect to the same Supabase database with:
- Same auth system
- Same real-time updates
- Same RLS policies

### Environment Variables (.env)
```
VITE_SUPABASE_URL=<same for both>
VITE_SUPABASE_ANON_KEY=<same for both>
```

These are used by both builds to connect to the same backend.

## Preventing Cross-Deployment Mistakes

### If Web Build Accidentally Used for Play Store
1. The APK will have wrong package ID (will fail upload)
2. Admin routes will be included in mobile app
3. Mobile optimizations won't be present

### If App Build Accidentally Deployed to Vercel
1. Vercel will run the app, but performance won't be optimized
2. Mobile-specific Capacitor code might not work in browser
3. App will still work (it detects browser environment) but won't have web optimizations

## Continuous Integration

### Recommended GitHub Actions Setup

```yaml
name: Deploy Web
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - run: npm ci
      - run: npm run lint
      - run: npm run build:web  # Explicitly use web build
      - run: npx vercel deploy --prod
```

## Quick Reference

| Task | Command |
|------|---------|
| Dev (any) | `npm run dev` |
| Dev Web | `npm run dev:web` |
| Dev App | `npm run dev:app` |
| Build (default app) | `npm run build` |
| Build Web | `npm run build:web` |
| Build App | `npm run build:app` |
| Check lint | `npm run lint` |

## Troubleshooting

**Q: Which build did I just create?**
A: Check the `__APP_TARGET__` in browser console or build output.

**Q: Can I deploy web build to Play Store?**
A: No - it will fail because package ID won't match and admin code will bloat the app.

**Q: Can I deploy app build to Vercel?**
A: It will technically work but lacks web optimizations and includes unnecessary mobile code.

**Q: How do I know which one succeeded?**
A: Web will have Admin Dashboard routes (/admin). App will be optimized for mobile.
