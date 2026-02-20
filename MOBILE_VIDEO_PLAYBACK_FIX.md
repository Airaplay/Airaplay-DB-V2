# Mobile Video Playback Fix

## Problem
Videos were playing on desktop Chrome but not on mobile devices (Android and iOS Chrome).

## Root Causes
1. **Autoplay Policies**: Mobile browsers have strict autoplay policies requiring user interaction
2. **Preload Strategy**: `preload="none"` on some video elements prevented data loading
3. **Missing CORS Headers**: Video elements didn't have crossOrigin attribute
4. **Inadequate Error Handling**: No visibility into why videos fail on mobile
5. **Network Conditions**: HLS.js buffer settings not optimized for mobile networks
6. **Ready State Handling**: No checks before attempting playback

## Solutions Implemented

### 1. VideoPlayerScreen (`src/screens/VideoPlayerScreen/VideoPlayerScreen.tsx`)

**Changes:**
- Added `crossOrigin="anonymous"` attribute for CORS support
- Changed `preload="metadata"` to `preload="auto"` for better mobile compatibility
- Improved `togglePlayPause()` function:
  - Added comprehensive logging of video element state
  - Implemented readyState checking before playback
  - Added `canplay` event listener for seamless load-then-play sequence
  - Better error handling with detailed error information logging
  - Proper Promise handling for play() method

**Video Element:**
```jsx
<video
  ref={videoRef}
  className="w-full h-full object-contain"
  playsInline
  crossOrigin="anonymous"
  preload="auto"
  // ... event handlers
/>
```

**Play Logic:**
- Checks readyState before attempting playback
- If readyState is 0 (not initialized), calls load() and waits for 'canplay' event
- Otherwise attempts immediate playback
- Catches and logs all play errors with details

### 2. LoopsVideoDisplay (`src/screens/LoopsVideoDisplay/LoopsVideoDisplay.tsx`)

**Changes:**
- Added `crossOrigin="anonymous"` attribute
- Changed `preload="none"` to `preload="metadata"` for faster loading
- Enhanced intersection observer logic:
  - Proper readyState checking before playback
  - Implemented `canplay` event listener for reliable playback start
  - Better error handling in onError callback
  - Added comprehensive logging at each step
- Improved video error event listener with detailed state information

**Key Improvements:**
- Only loads and plays current video (not future videos)
- Waits for `canplay` event before attempting playback
- Logs all state transitions for debugging
- Better network state reporting in errors

### 3. useHLSPlayer Hook (`src/hooks/useHLSPlayer.ts`)

**Changes:**
- Added mobile device detection using user agent
- Optimized HLS.js configuration for mobile:
  - Smaller buffer lengths on mobile (20-40KB vs 30-60KB on desktop)
  - Starts at quality level 0 on mobile (instead of -1 for adaptive)
  - Adjusted backBufferLength for memory efficiency
- Added CORS header to native HLS playback (Safari/iOS)
- Skips autoplay on mobile (respects browser policies)
- Enhanced error logging with detailed information
- Better error recovery messages

**Mobile-Optimized HLS.js Config:**
```typescript
const hls = new Hls({
  enableWorker: true,
  lowLatencyMode: false,
  backBufferLength: isMobile ? 60 : 90,      // Smaller on mobile
  maxBufferLength: isMobile ? 20 : 30,       // Smaller on mobile
  maxMaxBufferLength: isMobile ? 40 : 60,    // Smaller on mobile
  startLevel: isMobile ? 0 : -1,             // Lower quality start on mobile
  capLevelToPlayerSize: true,
  debug: false,
});
```

### 4. AndroidManifest.xml (`android/app/src/main/AndroidManifest.xml`)

**Changes:**
- Added `android:usesCleartextTraffic="true"` to application tag
- Allows HTTP video URLs (if using non-HTTPS sources)
- Important for testing and certain CDN scenarios

## How It Works

### Desktop Behavior
1. Video loads with `preload="auto"` immediately
2. Playback can be attempted immediately
3. HLS.js uses adaptive bitrate (starts at auto level)
4. Larger buffers for better streaming performance

### Mobile Behavior
1. Video loads with `preload="metadata"` (faster initial load)
2. Requires user gesture (tap) to start playback
3. `play()` call waits for `canplay` event first
4. HLS.js starts at lower quality level for faster start
5. Smaller buffers reduce memory usage
6. Better error recovery with detailed logging

## Debugging

The fixes include comprehensive console logging at key points:

**VideoPlayerScreen:**
```
[togglePlayPause] Attempting to play. Video state: { readyState, networkState, ... }
[togglePlayPause] Loading video before playing
[togglePlayPause] Video playback started successfully
[togglePlayPause] Error playing video: ...
```

**LoopsVideoDisplay:**
```
[Intersection] Loading video: { clipId, quality, readyState }
[Intersection] Autoplay successful for clip: ...
[Intersection] Autoplay prevented (expected on mobile): ...
[Intersection] Resuming video: { clipId }
```

**useHLSPlayer:**
```
[useHLSPlayer] Hook called with: { isMobile, videoElementReadyState, ... }
[useHLSPlayer] Using native HLS support (Safari/iOS)
[useHLSPlayer] Using HLS.js (Firefox/Chrome/Android)
HLS.js error: { type, details, fatal, error }
Fatal network error encountered, attempting recovery
```

## Testing Recommendations

1. **Physical Devices**: Test on actual Android and iOS phones (not emulators)
2. **Different Browsers**:
   - Android Chrome
   - Android Firefox
   - iOS Safari
   - In-app WebView (Capacitor)
3. **Network Conditions**:
   - WiFi (fast network)
   - 4G (medium network)
   - 3G or throttled (slow network)
4. **User Interactions**:
   - Tap to play
   - Tap to pause
   - Swipe to next video
   - Background/foreground transitions

## Monitoring

Open browser DevTools on mobile to see console logs:
1. Open Chrome DevTools on desktop
2. Connect Android device via USB
3. Navigate to chrome://inspect
4. View logs while testing video playback

## Browser Compatibility

### iOS Safari
- Uses native HLS support (no HLS.js needed)
- `playsInline` works on iOS 10+
- Respects user gesture requirement for full playback

### Android Chrome
- Uses HLS.js for adaptive streaming
- `playsInline` works on Android 4.4+
- Respects autoplay policies

### Android Firefox
- Uses HLS.js for adaptive streaming
- Good video codec support
- Respects autoplay policies

## Files Modified

1. `src/screens/VideoPlayerScreen/VideoPlayerScreen.tsx`
2. `src/screens/LoopsVideoDisplay/LoopsVideoDisplay.tsx`
3. `src/hooks/useHLSPlayer.ts`
4. `android/app/src/main/AndroidManifest.xml`

## Build Status
✓ All changes compile successfully
✓ No TypeScript errors
✓ Build completed: 25.93s
