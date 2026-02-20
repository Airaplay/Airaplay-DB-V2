# Web Admin Dashboard Setup Guide

## Overview

This guide explains how to deploy **only the Admin Dashboard** to the web while keeping the mobile app separate.

---

## Architecture

```
┌─────────────────────────────────────┐
│   Airaplay Ecosystem                │
├─────────────────────────────────────┤
│                                     │
│  📱 Mobile App (Android)            │
│  └─ Play Store Distribution        │
│  └─ User Features Only             │
│  └─ No Admin Access                │
│                                     │
│  🌐 Web Dashboard (admin.airaplay)  │
│  └─ Netlify/Vercel Hosting         │
│  └─ Admin Features Only            │
│  └─ Desktop Browsers Only          │
│                                     │
│  🗄️  Shared Backend                 │
│  └─ Supabase Database              │
│  └─ Same data for both platforms   │
│                                     │
└─────────────────────────────────────┘
```

---

## Current Setup Analysis

### Admin Routes
The admin dashboard currently uses these routes:
- `/admin/login` - Admin login page
- `/admin/dashboard` - Main admin dashboard

### Access Control
Admin access is controlled by:
1. **Route Protection**: Checking user role in routing
2. **Database RLS**: Row Level Security policies
3. **Function Security**: Admin-only database functions

---

## Option 1: Deploy Everything to Web (Recommended)

### Why This Works

Both mobile and web versions can use the **same build**:
- Mobile app uses Capacitor to wrap the web app
- Web deployment serves the same files
- Admin routes are hidden in mobile app navigation
- Admin dashboard accessible via direct URL on web

### Steps

**1. Deploy to Netlify/Vercel**

Follow the deployment guide (DEPLOYMENT_GUIDE.md Part 2).

Your web app will be available at:
```
https://your-app.netlify.app
```

**2. Access Points**

- **Users (Mobile & Web)**: `https://your-app.netlify.app/`
- **Admin (Web Only)**: `https://your-app.netlify.app/admin/login`

**3. Security Measures**

The admin dashboard is already protected:

```typescript
// Already implemented in your app
- User must be logged in
- User role must be 'admin'
- Redirects to home if not admin
- RLS policies prevent non-admin database access
```

**4. Optional: Custom Domain for Admin**

You can set up a subdomain:
- User app: `app.airaplay.com`
- Admin: `admin.airaplay.com`

Both point to the same deployment, but admin subdomain automatically routes to `/admin/login`.

---

## Option 2: Separate Admin Deployment (Advanced)

If you want completely separate deployments:

### Create Admin-Only Build

**1. Create a separate build configuration**

Create `vite.config.admin.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist-admin',
    rollupOptions: {
      input: {
        main: './admin.html'
      }
    }
  }
});
```

**2. Create `admin.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Airaplay Admin Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/admin-main.tsx"></script>
  </body>
</html>
```

**3. Create `src/admin-main.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

// Import only admin components
import AdminLoginScreen from './screens/AdminLoginScreen/AdminLoginScreen';
import AdminDashboardScreen from './screens/AdminDashboardScreen/AdminDashboardScreen';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AdminLoginScreen />} />
        <Route path="/dashboard" element={<AdminDashboardScreen />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
```

**4. Update `package.json`**

```json
{
  "scripts": {
    "dev": "vite",
    "dev:admin": "vite --config vite.config.admin.ts",
    "build": "tsc && vite build",
    "build:admin": "tsc && vite build --config vite.config.admin.ts",
    "build:all": "npm run build && npm run build:admin"
  }
}
```

**5. Deploy Admin Separately**

```bash
# Build admin dashboard
npm run build:admin

# Deploy to separate Netlify site
netlify deploy --dir=dist-admin --prod
```

---

## Recommended: Option 1 with Subdomain

### Best of Both Worlds

1. **Single Deployment**: Easier to maintain
2. **Separate URLs**: Professional appearance
3. **Same Codebase**: No duplication

### Setup Steps

**1. Deploy to Netlify**

```bash
npm run build
netlify deploy --prod
```

**2. Add Custom Domain**

In Netlify dashboard:
1. Go to Domain settings
2. Add custom domain: `airaplay.com`
3. Add subdomain: `admin.airaplay.com`

**3. Configure Redirects**

Create `netlify.toml`:
```toml
[[redirects]]
  from = "https://admin.airaplay.com/*"
  to = "https://admin.airaplay.com/admin/login"
  status = 200
  force = false
  conditions = {Role = ["admin"]}

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**4. Update DNS**

Add DNS records at your domain registrar:
```
Type: CNAME
Name: admin
Value: your-app.netlify.app
```

**5. Access Points**

- Main App: `https://airaplay.com`
- Admin: `https://admin.airaplay.com`

---

## Security Checklist for Web Admin

### Essential Security Measures

- [x] **HTTPS Only**: Netlify/Vercel provide automatic HTTPS
- [x] **Authentication Required**: Must login to access admin
- [x] **Role Verification**: Database checks user.role = 'admin'
- [x] **RLS Policies**: Prevent unauthorized data access
- [x] **Environment Variables**: API keys not in code
- [x] **CORS**: Configured in Supabase dashboard
- [x] **Rate Limiting**: Implemented in database functions

### Additional Recommended Security

**1. IP Allowlist (Optional)**

In `netlify.toml`:
```toml
[[redirects]]
  from = "/admin/*"
  to = "/admin/:splat"
  status = 200
  conditions = {Country = ["US", "NG", "GB"]}  # Your countries
```

**2. Two-Factor Authentication**

Consider implementing 2FA for admin accounts (future enhancement).

**3. Audit Logging**

Already implemented: All admin actions are logged in database.

**4. Session Timeout**

Configure in Supabase:
- Dashboard → Authentication → Settings
- Set JWT expiry time (default: 1 hour)
- Set refresh token rotation

---

## Testing Web Admin Dashboard

### Local Testing

```bash
# Start dev server
npm run dev

# Access admin at:
# http://localhost:5173/admin/login
```

### Production Testing

After deployment:

1. **Test Authentication**
   - Try accessing `/admin/dashboard` without login
   - Should redirect to `/admin/login`

2. **Test Admin Functions**
   - Login with admin account
   - Test each admin section
   - Verify data loads correctly

3. **Test Non-Admin Access**
   - Login with regular user account
   - Try accessing `/admin/dashboard`
   - Should redirect to home page

4. **Test Mobile Browser**
   - Admin dashboard should work on mobile browsers
   - Layout should be responsive
   - All features should work

---

## Admin Account Setup

### Create First Admin Account

**Method 1: Direct Database Update**

```sql
-- In Supabase SQL editor
UPDATE users
SET role = 'admin'
WHERE email = 'your-admin@email.com';
```

**Method 2: Via Admin Function** (if implemented)

```typescript
// In browser console after logging in
await supabase.rpc('promote_to_admin', {
  user_id: 'user-uuid-here'
});
```

**Method 3: Manual in Database**

1. Go to Supabase Dashboard
2. Table Editor → `users` table
3. Find your user row
4. Edit `role` column to `'admin'`
5. Save changes

### Verify Admin Access

1. Logout and login again
2. Navigate to `/admin/dashboard`
3. Should see admin dashboard
4. Verify all sections load

---

## Maintenance & Updates

### Update Admin Dashboard

```bash
# 1. Make code changes
# 2. Test locally
npm run dev

# 3. Build for production
npm run build

# 4. Deploy
netlify deploy --prod
# or
vercel --prod
```

### Monitor Admin Activity

Check logs in:
1. **Supabase Dashboard**: Database logs
2. **Netlify/Vercel**: Deployment and function logs
3. **Browser DevTools**: Console errors

---

## Troubleshooting

### Issue: Can't access admin dashboard

**Check:**
1. Is user role = 'admin' in database?
2. Is user logged in?
3. Are there console errors?
4. Is Supabase connection working?

**Fix:**
```sql
-- Verify user role
SELECT id, email, role FROM users WHERE email = 'your@email.com';

-- Set role to admin
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

### Issue: Admin dashboard shows blank

**Check:**
1. Browser console for errors
2. Network tab for failed requests
3. Supabase RLS policies

**Fix:**
```bash
# Rebuild and redeploy
npm run build
netlify deploy --prod
```

### Issue: Regular users can access admin

**This is a serious security issue!**

**Check:**
1. Route protection in code
2. RLS policies in database
3. Admin verification functions

**Emergency Fix:**
```sql
-- Temporarily disable admin functions
REVOKE EXECUTE ON FUNCTION admin_get_users() FROM authenticated;
REVOKE EXECUTE ON FUNCTION admin_get_withdrawal_requests() FROM authenticated;
-- Add GRANT back after fixing
```

---

## Performance Optimization

### For Web Admin Dashboard

**1. Enable Caching**

In `netlify.toml`:
```toml
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

**2. Enable Compression**

Automatic with Netlify/Vercel (Brotli + Gzip)

**3. Optimize Bundle Size**

Already configured in `vite.config.ts` with code splitting.

---

## Summary

### Recommended Setup

✅ **Deploy full app to web** (includes admin routes)
✅ **Use subdomain for admin** (optional, for professional look)
✅ **Keep mobile app separate** (APK for Play Store)
✅ **Share same Supabase backend**
✅ **Protect admin routes with authentication**

### Access Points

- **Mobile App**: Installed from Play Store
- **User Web App**: `https://airaplay.com` (optional)
- **Admin Dashboard**: `https://admin.airaplay.com` or `https://airaplay.com/admin/login`

### Benefits

- ✅ Single codebase
- ✅ Easy maintenance
- ✅ Shared backend
- ✅ Automatic updates
- ✅ Secure by design
- ✅ Cost effective

You're all set! The admin dashboard will be accessible on the web while users access the full app via Android. 🚀
