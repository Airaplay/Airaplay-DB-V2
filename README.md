# 🎵 Airaplay - Music & Video Streaming Platform

A comprehensive mobile-first streaming platform with platform-managed rewards for creators and listeners, built with React, Capacitor, and Supabase.

---

🌟 Overview

Airaplay is a dual-platform streaming application featuring:

📱 Mobile App (Android)
A full-featured streaming experience for listeners and creators.

🌐 Web Admin Dashboard
A comprehensive admin panel for platform management, analytics, and content moderation.

💼 💼 Platform-Managed Reward Distribution  
Rewards are allocated across creators, listeners, and the platform through internally managed reward pools based on performance, engagement, and contribution.

🎁 Treat Wallet System
An in-app currency used for tipping, promotions, and feature access.

🎯 Promotion System
Smart content promotion with rotation and performance-based visibility.


---

## ✨ Key Features

### For Users
- 🎵 Stream unlimited music and videos
- 📥 Download content for offline playback
- 💝 Earn rewards through engagement and participation
- 🎮 Create and manage playlists
- 👥 Follow favorite artists
- 🎁 Daily check-in rewards
- 💰 Referral bonuses

### For Creators
- 📤 Upload music, videos, and albums
- 📊 View detailed analytics
- 💸 Track reward performance and earnings insights
- 🚀 Promote content
- 💳 Withdraw earnings
- 🎨 Customize profile
- 📈 Grow fanbase

### For Admins
- 👥 User management
- 🎵 Content moderation
- 📊 Analytics dashboard
- 💰 Reward and transaction management
- 🔧 System configuration
- 📋 Report handling
- 🎯 Promotion management

---

## 🏗️ Tech Stack

### Frontend
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool
- **TailwindCSS**: Styling
- **Lucide React**: Icons
- **React Router**: Navigation

### Mobile
- **Capacitor 7**: Native wrapper
- **Android SDK**: Android platform
- **HLS.js**: Audio streaming
- **AdMob**: Ad integration

### Backend
- **Supabase**: Backend as a Service
  - PostgreSQL database
  - Authentication
  - Storage
  - Edge Functions
  - Real-time subscriptions
- **Bunny CDN**: Media delivery and transcoding

### Infrastructure
- **Netlify/Vercel**: Web hosting
- **Google Play Store**: Android distribution
- **GitHub**: Version control

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Git**
- **Android Studio** (for mobile development)
- **Supabase Account** (free tier available)
- **Bunny CDN Account** (for media streaming)

---

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/airaplay.git
cd airaplay

# Install dependencies
npm install
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_BUNNY_STREAM_LIBRARY_ID=your_bunny_library_id
VITE_BUNNY_STREAM_API_KEY=your_bunny_api_key
VITE_BUNNY_CDN_HOSTNAME=your_bunny_cdn_hostname
```

### 3. Set Up Database

```bash
# Apply migrations (via Supabase dashboard or CLI)
# All migrations are in supabase/migrations/

# Or use the integrated MCP tool during development
```

### 4. Run Development Server

```bash
# Start web dev server
npm run dev

# Access at http://localhost:5173
```

### 5. Build for Production

```bash
# Build web assets
npm run build

# Build output in dist/
```

---

## 📱 Android Development

### Prerequisites
- Android Studio installed
- Android SDK configured
- Device with USB debugging enabled

### Build and Test

```bash
# 1. Build web assets
npm run build

# 2. Sync with Capacitor
npx cap sync android

# 3. Open in Android Studio
npx cap open android

# 4. Run on device (click green play button)
```

### Quick Commands

```bash
# View device logs
adb logcat | grep Airaplay

# Install APK directly
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Check connected devices
adb devices
```

**📖 Detailed Guide**: See [ANDROID_QUICK_START.md](./ANDROID_QUICK_START.md)

---

## 🌐 Web Deployment

### Deploy Admin Dashboard

#### Option 1: Netlify (Recommended)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

#### Option 2: Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

**📖 Detailed Guide**: See [WEB_ADMIN_SETUP.md](./WEB_ADMIN_SETUP.md)

---

## 📚 Documentation

### Deployment Guides
- **[DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)** - Overview and next steps
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Complete deployment instructions
- **[ANDROID_QUICK_START.md](./ANDROID_QUICK_START.md)** - 15-minute Android setup
- **[WEB_ADMIN_SETUP.md](./WEB_ADMIN_SETUP.md)** - Web admin deployment
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - Step-by-step checklist

### Quick References
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Command cheat sheet
- **[QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md)** - Getting started quickly

### Technical Documentation
- **[IMPLEMENTATION_DETAILS.md](./IMPLEMENTATION_DETAILS.md)** - Architecture details
- **[DATABASE_SECURITY_AUDIT_2025.md](./DATABASE_SECURITY_AUDIT_2025.md)** - Security documentation

### Bug Fixes & Updates
- Multiple `*_FIX.md` and `*_COMPLETE.md` files documenting changes

---

## 🗂️ Project Structure

```
airaplay/
├── src/
│   ├── components/          # Reusable UI components
│   ├── contexts/            # React context providers
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities and services
│   ├── screens/             # Main application screens
│   │   ├── HomePlayer/      # Home screen sections
│   │   ├── AdminDashboardScreen/  # Admin sections
│   │   └── ...              # Other screens
│   ├── index.tsx            # App entry point
│   └── index.css            # Global styles
│
├── android/                 # Android native project
│   ├── app/                 # Android app module
│   └── ...                  # Android config files
│
├── supabase/
│   ├── functions/           # Edge functions
│   └── migrations/          # Database migrations
│
├── public/                  # Static assets
├── dist/                    # Build output
├── capacitor.config.ts      # Capacitor configuration
├── vite.config.ts           # Vite configuration
├── tailwind.config.js       # Tailwind configuration
└── package.json             # Dependencies
```

---

## 🔐 Security Features

- ✅ **Row Level Security (RLS)**: All database tables protected
- ✅ **JWT Authentication**: Secure user sessions
- ✅ **Role-Based Access Control**: Admin, creator, and user roles
- ✅ **Input Validation**: Server-side validation
- ✅ **Rate Limiting**: API call limits
- ✅ **Secure Storage**: Environment variables for secrets
- ✅ **HTTPS Only**: Enforced on all deployments

---

## 💰 Reward & Revenue Model

Airaplay operates a platform-managed reward system funded by total platform revenue, including advertising, subscriptions, promotions, and in-app purchases.

### Monthly Reward Pools
At the end of each reward cycle:
- A **Creator Reward Pool** is allocated to creators based on streams, engagement, and content performance.
- A **Listener Reward Pool** is allocated to listeners based on contribution metrics such as discovery impact, playlist performance, and engagement.

Reward calculations are performed internally and are not directly tied to individual ad views, impressions, or clicks.

```

**Important**: Creators cannot earn listener rewards from their own content.

### Treat Wallet System

**Treat** is Airaplay’s in-app currency used for tipping, promotions, and content boosting.

#### How Users Obtain Treat:
- Purchasing treat packages
- Receiving tips from other users
- Platform bonuses and special events
- Creator promotions and rewards

#### How Treat Is Used:
- Tip creators or other users
- Promote songs, videos, or playlists
- Boost visibility within the platform


- Eligible users can withdraw rewards once minimum payout thresholds and cycle requirements are met

---
## 🎯 Reward Points System

Reward Points reflect a user’s engagement and contribution on Airaplay.

Points are earned through:
- Playlist creation and performance
- Discovery and promotion of creators
- Community participation
- Engagement challenges
- Optional rewarded ads (Unity Ads only)

Points determine eligibility and weighting within periodic reward pools.
Points do not represent cash value and do not have a fixed conversion rate.
---


## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors

# Android
npx cap sync android     # Sync web assets to Android
npx cap open android     # Open in Android Studio
npx cap update android   # Update Capacitor plugins

# Database
# Use Supabase dashboard or MCP tools
```

### Code Quality

- **TypeScript**: Full type safety
- **ESLint**: Code linting
- **Prettier**: Code formatting (if configured)
- **Component Structure**: Clean, modular architecture
- **Performance**: Optimized builds with code splitting

---

## 📊 Admin Dashboard Features

### Dashboard Sections

1. **Analytics Overview** - Key metrics and trends
2. **User Management** - View, edit, manage users
3. **Content Management** - Moderate and feature content
4. **Creator Requests** - Approve creator applications
5. **Withdrawal Requests** - Process earnings withdrawals
6. **Payment Monitoring** - Track transactions
7. **Reports Management** - Handle user reports
8. **Promotion Manager** - Configure promotions
9. **Featured Artists** - Set featured content
10. **Genre Manager** - Manage categories
11. **Mix Manager** - Create curated playlists
12. **Daily Check-in** - Configure rewards
13. **Referral Management** - Set bonuses
14. **Treat Manager** - Configure packages
15. **Ad Management** - Ad placement settings
16. **Settings** - System configuration

### Access Admin Dashboard

- **Local**: `http://localhost:5173/admin/login`
- **Production**: `https://your-domain.com/admin/login`

### Create First Admin

```sql
-- In Supabase SQL Editor
UPDATE users
SET role = 'admin'
WHERE email = 'your@email.com';
```

---

## 🧪 Testing

### Local Testing

```bash
# Start dev server
npm run dev

# Test in browser
# - User flows: signup, login, playback
# - Creator flows: upload, analytics
# - Admin flows: dashboard, management
```

### Android Testing

```bash
# Build and install
npm run build
npx cap sync android
npx cap open android
# Click run in Android Studio

# Monitor logs
adb logcat | grep Airaplay
```

### Production Testing

- Test all user flows
- Test all creator features
- Test all admin functions
- Test on multiple devices
- Test offline functionality
- Test payment flows

---

## 🐛 Troubleshooting

### Common Issues

**Build Fails**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Android Connection Issues**
```bash
adb kill-server
adb start-server
adb devices
```

**Database Connection Failed**
- Check Supabase project status
- Verify environment variables
- Check RLS policies

**App Crashes**
- Check `adb logcat` for errors
- Use `chrome://inspect` for web debugging
- Verify all permissions granted

**📖 More Solutions**: See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) Part 7

---

## 📈 Performance

### Optimizations Implemented

- ✅ Code splitting and lazy loading
- ✅ Image optimization
- ✅ Database query optimization
- ✅ CDN for media delivery
- ✅ Caching strategies
- ✅ Bundle size optimization

### Monitoring

- Supabase dashboard for database metrics
- Netlify/Vercel analytics for web traffic
- Google Play Console for app metrics
- Custom analytics in admin dashboard

---

## 🤝 Contributing

### Development Workflow

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit pull request
5. Code review
6. Merge to main

### Code Standards

- Use TypeScript for type safety
- Follow existing code structure
- Write meaningful commit messages
- Test before committing
- Keep components modular
- Document complex logic

---

## 📄 License

This project is proprietary. All rights reserved.

---

## 🆘 Support

### Documentation
- Check the guides in the root directory
- Review technical documentation
- Search closed issues

### Resources
- [Capacitor Docs](https://capacitorjs.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev)
- [Tailwind Docs](https://tailwindcss.com/docs)

### Community
- Stack Overflow (tags: capacitor, supabase, react)
- Supabase Discord
- Capacitor Discord

---

## 🎯 Roadmap

### Completed ✅
- Core streaming functionality
- User authentication
- Creator features
- Admin dashboard
- Platform-managed reward distribution system
- Treat wallet
- Promotion system
- Android app

### In Progress 🚧
- Play Store submission
- Web deployment
- User testing

### Planned 🔮
- iOS app
- Advanced analytics
- Social features
- Live streaming
- Podcast support
- International expansion

---

## 🙏 Acknowledgments

Built with:
- [React](https://react.dev)
- [Capacitor](https://capacitorjs.com)
- [Supabase](https://supabase.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Vite](https://vitejs.dev)
- [Bunny CDN](https://bunny.net)

---
## ⚖️ Rewards Disclaimer

Airaplay rewards are calculated from platform-managed pools and may vary by cycle.
No specific earnings amount is guaranteed.
Ad views, impressions, or clicks do not directly determine user payouts.

Airaplay displays ads to support platform operations.
Ads do not directly determine user rewards, and no user is compensated for viewing or interacting with advertisements.
---


## 📞 Contact

- **Email**: support@airaplay.com
- **Website**: https://airaplay.com
- **Admin**: https://admin.airaplay.com

---

## 🚀 Getting Started Checklist

Ready to deploy? Follow these steps:

- [ ] Read [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md)
- [ ] Complete [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- [ ] Deploy web admin (follow [WEB_ADMIN_SETUP.md](./WEB_ADMIN_SETUP.md))
- [ ] Build Android app (follow [ANDROID_QUICK_START.md](./ANDROID_QUICK_START.md))
- [ ] Test everything thoroughly
- [ ] Launch! 🎉

---

**Made with ❤️ for music lovers and creators**

*Last updated: November 2025*
