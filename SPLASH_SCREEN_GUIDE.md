# Splash Screen Implementation Guide

## Overview

The app now features a beautiful, animated splash screen that displays when the app first launches. The splash screen showcases the Airaplay logo with a premium dark gradient background and smooth animations.

## Features

### Visual Design
- **Background**: Dark gradient from `#1a1a1a` → `#0d0d0d` → `#000000`
- **Logo**: Centered Airaplay white logo with breathing animation and glow effect
- **Minimalist Design**: Clean, logo-only approach for premium feel

### Animations
1. **Logo Breathe Effect**: Subtle scale animation (1.0 → 1.05 → 1.0) over 3 seconds
2. **Fade In**: Logo appears with smooth fade-in and scale animation (0.8s)
3. **Glow Effect**: Pulsing green glow behind the logo
4. **Fade Out**: Smooth 500ms fade-out transition before hiding

## Configuration

### Display Duration
The splash screen displays for a minimum of **4 seconds** by default. You can adjust this in `/src/index.tsx`:

```tsx
<SplashScreen onFinished={handleSplashFinished} minDisplayTime={4000} />
```

Change `minDisplayTime` to your desired duration in milliseconds.

### Native Splash Screen Settings

Located in `capacitor.config.ts`:

```ts
SplashScreen: {
  launchShowDuration: 0,
  launchAutoHide: false,
  backgroundColor: '#0d0d0d',
  androidScaleType: 'CENTER_CROP',
  showSpinner: false,
  splashFullScreen: true,
  splashImmersive: true
}
```

## How It Works

### Web App
1. App loads and displays the React-based splash screen
2. Background services initialize (Supabase, AdMob, etc.)
3. Splash screen displays for minimum configured time
4. Smooth fade-out transition
5. Main app interface appears

### Native App (Android/iOS)
1. Native splash screen shows immediately on app launch
2. WebView loads in background
3. Native splash screen is hidden automatically
4. React splash screen takes over seamlessly
5. Same flow as web app continues

## Customization

### Logo
Replace `/public/airaplay_white_logo.fw.png` with your desired logo image. Recommended size: 512x512px or larger.

### Colors
Edit `/src/components/SplashScreen.tsx`:

```tsx
// Background gradient
className="bg-gradient-to-b from-[#1a1a1a] via-[#0d0d0d] to-[#000000]"

// Glow color
className="bg-[#00ad74]"
```

### Animation Speed
Adjust animation durations in the component:

```tsx
// Breathing animation speed
animation: 'breathe 3s ease-in-out infinite'

// Fade-in duration
animation: fade-in 0.8s ease-out forwards

// Fade-out duration
transition-opacity duration-500
```

## Testing

### Web Browser
```bash
npm run dev
```
Open http://localhost:5173 - splash screen will show for 2 seconds before the app loads.

### Android App
```bash
npm run build
npx cap sync android
npx cap open android
```
Run the app from Android Studio to see the native + web splash screen flow.

## File Structure

```
src/
├── components/
│   └── SplashScreen.tsx          # Main splash screen component
└── index.tsx                      # Integration point

public/
└── airaplay_white_logo.fw.png    # Logo image

capacitor.config.ts                # Native splash configuration
```

## Notes

- The splash screen uses fixed positioning with `z-index: 9999` to ensure it appears above all content
- Smooth fade-out prevents jarring transitions
- Responsive design works on all screen sizes
- Optimized for both mobile and tablet views
- Works seamlessly on web, Android, and iOS platforms

## Troubleshooting

### Logo Not Showing
- Verify `/public/airaplay_white_logo.fw.png` exists
- Check browser console for 404 errors
- Ensure image path is correct in component

### Splash Screen Too Fast/Slow
- Adjust `minDisplayTime` prop (in milliseconds)
- Consider network speed and initialization time
- Test on actual devices, not just emulators

### Native Splash Not Hiding
- Ensure `@capacitor/splash-screen` is installed
- Check version compatibility with Capacitor core
- Verify `launchAutoHide: false` in config
- Confirm `SplashScreen.hide()` is called in component
