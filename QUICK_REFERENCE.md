# Quick Reference Card

## 🚀 Fast Commands

### Build & Deploy

```bash
# Build for production
npm run build

# Deploy to Netlify
netlify deploy --prod

# Deploy to Vercel
vercel --prod

# Sync Android
npx cap sync android

# Open Android Studio
npx cap open android

# Build Android APK
cd android && ./gradlew assembleDebug

# Install to phone
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📱 Android Commands

```bash
# Check devices
adb devices

# View logs
adb logcat | grep Airaplay

# Uninstall app
adb uninstall com.airaplay.app

# Take screenshot
adb shell screencap -p /sdcard/screen.png && adb pull /sdcard/screen.png

# Restart ADB
adb kill-server && adb start-server
```

---

## 🌐 Web URLs

### Local Development
- App: `http://localhost:5173`
- Admin: `http://localhost:5173/admin/login`

### Production (Example)
- App: `https://your-app.netlify.app`
- Admin: `https://your-app.netlify.app/admin/login`
- Or: `https://admin.your-app.com`

---

## 🗄️ Database

### Create Admin User

```sql
UPDATE users
SET role = 'admin'
WHERE email = 'your@email.com';
```

### Check RLS Policies

```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

### View Active Connections

```sql
SELECT count(*) FROM pg_stat_activity
WHERE datname = current_database();
```

---

## 🔧 Troubleshooting

### App won't build
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Android sync issues
```bash
npx cap sync --force
npx cap update android
```

### Gradle issues
```bash
cd android
./gradlew clean
./gradlew build
```

### Can't connect to device
```bash
adb kill-server
adb start-server
adb devices
```

---

## 📊 Monitoring

### Supabase Dashboard
- Database: Tables, queries, RLS
- Auth: Users, sessions
- Storage: Files, buckets
- Logs: API calls, errors

### Netlify Dashboard
- Deploys: Build logs, preview
- Functions: Edge functions logs
- Analytics: Traffic, performance
- Forms: Submissions (if used)

### Android Logs
- Logcat: `adb logcat`
- Chrome: `chrome://inspect`
- Crashes: Google Play Console

---

## 🔑 Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_BUNNY_STREAM_LIBRARY_ID=
VITE_BUNNY_STREAM_API_KEY=
VITE_BUNNY_CDN_HOSTNAME=
```

---

## 📁 Important Files

```
project/
├── src/                           # Source code
├── android/                       # Android project
├── dist/                          # Web build output
├── supabase/migrations/           # Database migrations
├── .env                           # Environment variables
├── capacitor.config.ts            # Capacitor config
├── vite.config.ts                 # Vite config
├── package.json                   # Dependencies
├── DEPLOYMENT_GUIDE.md            # Full guide
├── ANDROID_QUICK_START.md         # Android guide
├── WEB_ADMIN_SETUP.md             # Web admin guide
└── DEPLOYMENT_CHECKLIST.md        # Checklist
```

---

## 🆘 Emergency Fixes

### Site is down
1. Check Netlify/Vercel status
2. Check Supabase status
3. Review recent deployments
4. Rollback if needed

### App crashing
1. Check `adb logcat` for errors
2. Check `chrome://inspect` console
3. Verify Supabase connection
4. Check environment variables

### Database issues
1. Check Supabase dashboard logs
2. Verify RLS policies
3. Check connection pooling
4. Review recent migrations

### Build failing
1. Clear node_modules
2. Update dependencies
3. Check TypeScript errors
4. Review build logs

---

## 📞 Support Links

- **Capacitor Docs**: https://capacitorjs.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Netlify Docs**: https://docs.netlify.com
- **Android Docs**: https://developer.android.com
- **Stack Overflow**: Tag `capacitor`, `supabase`, `android`

---

## ✅ Health Check

Run these to verify system health:

```bash
# Node/NPM versions
node -v && npm -v

# Git status
git status

# Build test
npm run build

# Android connection
adb devices

# Supabase connection (in Node REPL)
node
> const { createClient } = require('@supabase/supabase-js')
> const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
> supabase.from('users').select('count').then(console.log)
```

---

## 🎯 Common Tasks

### Update app version
1. Update `package.json` version
2. Update `android/app/build.gradle` versionCode & versionName
3. Commit changes
4. Build and deploy

### Add new admin
```sql
UPDATE users SET role = 'admin' WHERE email = 'new@admin.com';
```

### Reset user password
1. Supabase Dashboard → Authentication → Users
2. Find user → Send password reset email

### Clear cache
```bash
# Node modules
rm -rf node_modules && npm install

# Build cache
rm -rf dist

# Android cache
cd android && ./gradlew clean
```

### Update dependencies
```bash
# Check outdated
npm outdated

# Update all
npm update

# Update specific package
npm install package@latest
```

---

## 🔐 Security Checklist

- [ ] `.env` not committed
- [ ] API keys in environment variables
- [ ] HTTPS enabled
- [ ] RLS policies active
- [ ] Admin routes protected
- [ ] Input validation implemented
- [ ] Rate limiting active
- [ ] Keystore backed up securely

---

## 📈 Performance Tips

1. **Optimize images**: Use compressed formats
2. **Lazy load**: Load content as needed
3. **Cache data**: Use local storage wisely
4. **Monitor queries**: Check Supabase dashboard
5. **Use CDN**: Bunny CDN for media
6. **Minimize builds**: Code splitting active
7. **Test on real devices**: Not just emulators

---

**Keep this handy for quick reference!** 📌
