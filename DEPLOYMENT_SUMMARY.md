# Deployment Configuration Summary

## What Changed

### 1. Routing System (src/index.tsx)
- Admin screens now conditionally load based on BUILD_TARGET
- Web builds include AdminDashboardScreen and AdminLoginScreen
- Mobile builds exclude admin screens completely
- Reduces mobile app bundle size by ~200KB

### 2. Vercel Configuration (vercel.json)
- Updated build command to use `build:web`
- Added VITE_APP_TARGET=web environment variable
- Ensures admin screens are included in web deployment

### 3. Admin Dashboard (AdminDashboardScreen.tsx)
- Made fully responsive for mobile, tablet, and desktop
- Mobile: Hamburger menu with sliding sidebar
- Desktop: Fixed sidebar with full navigation
- Responsive header and content areas

## Deployment Commands

### Web (Vercel)
```bash
# Build and deploy
npm run build:web

# Vercel handles this automatically on push
```

### Mobile (Play Store)
```bash
# Clean build
npm run clean-build:app

# Sync to Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android
```

## Environment Variables

### Required for Both Deployments
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Deployment-Specific
```env
# Web (Vercel)
VITE_APP_TARGET=web

# Mobile (Android)
VITE_APP_TARGET=app
```

## Admin Dashboard Access

### Desktop View (768px+)
- Fixed sidebar on the left
- 1200px max content width
- Full navigation menu always visible

### Mobile View (<768px)
- Hamburger menu button in header
- Slide-out sidebar on tap
- Overlay for better UX
- Fully responsive content

### Tablet View
- Responsive layout
- Optimized spacing
- Touch-friendly controls

## Build Verification

Test that the builds work correctly:

### Web Build
```bash
npm run build:web
# Check dist/ contains admin screens
ls dist/assets/ | grep -i admin
```

### Mobile Build
```bash
npm run build:app
# Admin screens should NOT be in bundle
```

## Access URLs

### Web Admin
- Production: https://your-domain.vercel.app/admin
- Login: https://your-domain.vercel.app/admin/login

### Mobile App
- Home screen opens by default
- No admin routes accessible
- All admin functions handled via web

## Security

- Admin routes only in web build
- RLS policies protect all admin operations
- Role-based access control (admin, manager, editor, account)
- Mobile app has no admin code or credentials

## Support

See DEPLOYMENT_GUIDE.md for detailed instructions.
