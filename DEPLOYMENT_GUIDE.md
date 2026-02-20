# Airaplay Deployment Guide

This document provides comprehensive instructions for deploying Airaplay to both web (Vercel) and mobile (Play Store).

## Deployment Architecture

Airaplay uses a **split deployment strategy**:

- **Web (Vercel)**: Admin Dashboard for content management
- **Mobile (Play Store)**: Full app experience for creators and listeners

## Overview

```
┌─────────────────────────────────────────────┐
│           Airaplay Platform                 │
├─────────────────────────────────────────────┤
│                                             │
│  Web (Vercel)                Mobile (Play)  │
│  ├── Admin Dashboard        ├── Home        │
│  ├── Admin Login            ├── Explore     │
│  └── Management Tools       ├── Library     │
│                             ├── Create       │
│                             ├── Profile      │
│                             └── All user     │
│                                 screens      │
│                                             │
└─────────────────────────────────────────────┘
         │                           │
         └───────────┬───────────────┘
                     │
              Shared Supabase
                 Backend
```

## Build Targets

The project supports two build targets controlled by `VITE_APP_TARGET` environment variable:

- **`web`**: Includes admin screens, optimized for web deployment
- **`app`**: Excludes admin screens, optimized for mobile deployment

## Web Deployment (Vercel)

### Configuration

The web build is configured in `vercel.json`:

```json
{
  "buildCommand": "npm run build:web",
  "outputDirectory": "dist",
  "env": {
    "VITE_APP_TARGET": "web"
  }
}
```

### Environment Variables

Set these in Vercel dashboard:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APP_TARGET=web
```

### Deployment Steps

1. **Connect Repository to Vercel**
   - Go to vercel.com
   - Import your repository
   - Vercel will auto-detect the configuration

2. **Configure Environment Variables**
   - Go to Project Settings > Environment Variables
   - Add all required variables
   - Ensure VITE_APP_TARGET=web is set

3. **Deploy**
   ```bash
   # Manual deployment (optional)
   npm run build:web
   vercel --prod
   ```

4. **Verify Deployment**
   - Visit your deployed URL
   - Navigate to /admin/login
   - Verify admin dashboard loads correctly

### Admin Access

- **URL**: https://your-domain.vercel.app/admin
- **Login**: https://your-domain.vercel.app/admin/login

## Mobile Deployment (Play Store)

### Build Commands

```bash
# Production build
npm run clean-build:app

# Sync to Android
npx cap sync android

# Open in Android Studio
npx cap open android
```

### Environment Variables

Set these in `.env`:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APP_TARGET=app
```

### Build Process

1. **Build Web Assets**
   ```bash
   npm run clean-build:app
   ```

2. **Sync to Capacitor**
   ```bash
   npx cap sync android
   ```

3. **Open Android Studio**
   ```bash
   npx cap open android
   ```

4. **Build APK/AAB**
   - In Android Studio: Build > Generate Signed Bundle / APK
   - Select "Android App Bundle" for Play Store
   - Build release version

5. **Upload to Play Store**
   - Upload the AAB file to Play Console
   - Complete store listing
   - Submit for review

## Package Scripts

```json
{
  "scripts": {
    "build:web": "VITE_APP_TARGET=web tsc --incremental && vite build",
    "build:app": "VITE_APP_TARGET=app tsc --incremental && vite build",
    "clean-build:web": "rm -rf dist && VITE_APP_TARGET=web tsc --incremental && vite build",
    "clean-build:app": "rm -rf dist && VITE_APP_TARGET=app tsc --incremental && vite build"
  }
}
```

## Quick Reference

| Task | Command |
|------|---------|
| Build for web | `npm run build:web` |
| Build for mobile | `npm run build:app` |
| Sync to Android | `npx cap sync android` |
| Open Android Studio | `npx cap open android` |
