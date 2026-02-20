import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import "./index.css";
import "./lib/preloader";
import { supabase, refreshSessionIfNeeded } from "./lib/supabase";
import { admobService } from "./lib/admobService";
import { appInitializer } from "./lib/appInitializer";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { BUILD_TARGET, isWebTarget } from "./lib/buildTarget";
import { webAdService } from "./lib/webAdService";
import { WebAdBanner } from "./components/WebAdBanner";
import { WebAdSidebar } from "./components/WebAdSidebar";
import { HomePlayer } from "./screens/HomePlayer";
import { NavigationBarSection } from "./screens/HomePlayer/sections/NavigationBarSection/NavigationBarSection";
import { AuthModal } from "./components/AuthModal";
import { MusicPlayerScreen } from "./screens/MusicPlayerScreen";
import { MiniMusicPlayer } from "./components/MiniMusicPlayer";
import { MusicPlayerProvider, useMusicPlayer } from "./contexts/MusicPlayerContext";
import { AlertProvider } from "./contexts/AlertContext";
import { HomeScreenDataProvider } from "./contexts/HomeScreenDataContext";
import { ConfirmProvider } from "./contexts/ConfirmContext";
import { UploadProvider } from "./contexts/UploadContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SplashScreen } from "./components/SplashScreen";
import UploadProgressModal from "./components/UploadProgressModal";

// Lazy load screens for better performance
const ExploreScreen = lazy(() => import("./screens/ExploreScreen").then(module => ({ default: module.ExploreScreen })));
const LibraryScreen = lazy(() => import("./screens/LibraryScreen").then(module => ({ default: module.LibraryScreen })));
const CreateScreen = lazy(() => import("./screens/CreateScreen").then(module => ({ default: module.CreateScreen })));
const ProfileScreen = lazy(() => import("./screens/ProfileScreen").then(module => ({ default: module.ProfileScreen })));
const TreatScreen = lazy(() => import("./screens/TreatScreen").then(module => ({ default: module.TreatScreen })));
const PublicProfileScreen = lazy(() => import("./screens/PublicProfileScreen").then(module => ({ default: module.PublicProfileScreen })));
const AlbumPlayerScreen = lazy(() => import("./screens/AlbumPlayerScreen").then(module => ({ default: module.AlbumPlayerScreen })));

// Admin screens - Always load for web environment (check at runtime, not build time)
const AdminDashboardScreen = lazy(() => import("./screens/AdminDashboardScreen"));
const AdminLoginScreen = lazy(() => import("./screens/AdminLoginScreen").then(module => ({ default: module.AdminLoginScreen })));

// Root redirect component - redirects to admin for web builds, shows HomePlayer for mobile
const RootRedirect = ({ onOpenMusicPlayer, onFormVisibilityChange }: { onOpenMusicPlayer: any; onFormVisibilityChange: any }) => {
  const isWebBuild = BUILD_TARGET === 'web' || !Capacitor.isNativePlatform();

  if (isWebBuild) {
    return <Navigate to="/admin" replace />;
  }

  return <HomePlayer onOpenMusicPlayer={onOpenMusicPlayer} onFormVisibilityChange={onFormVisibilityChange} />;
};

const TrendingViewAllScreen = lazy(() => import("./screens/TrendingViewAllScreen").then(module => ({ default: module.TrendingViewAllScreen })));
const TrendingNearYouViewAllScreen = lazy(() => import("./screens/TrendingNearYouViewAllScreen").then(module => ({ default: module.TrendingNearYouViewAllScreen })));
const MustWatchViewAllScreen = lazy(() => import("./screens/MustWatchViewAllScreen").then(module => ({ default: module.MustWatchViewAllScreen })));
const NewReleaseViewAllScreen = lazy(() => import("./screens/NewReleaseViewAllScreen").then(module => ({ default: module.NewReleaseViewAllScreen })));
const TrendingAlbumsViewAllScreen = lazy(() => import("./screens/TrendingAlbumsViewAllScreen").then(module => ({ default: module.TrendingAlbumsViewAllScreen })));
const DailyCheckinScreen = lazy(() => import("./screens/DailyCheckinScreen").then(module => ({ default: module.DailyCheckinScreen })));
const InviteEarnScreen = lazy(() => import("./screens/InviteEarnScreen").then(module => ({ default: module.InviteEarnScreen })));
const PromotionCenterScreen = lazy(() => import("./screens/PromotionCenterScreen").then(module => ({ default: module.PromotionCenterScreen })));
const NotificationScreen = lazy(() => import("./screens/NotificationScreen").then(module => ({ default: module.NotificationScreen })));
const VideoPlayerScreen = lazy(() => import("./screens/VideoPlayerScreen").then(module => ({ default: module.VideoPlayerScreen })));
const WithdrawEarningsScreen = lazy(() => import("./screens/WithdrawEarningsScreen").then(module => ({ default: module.WithdrawEarningsScreen })));
const EditProfileScreen = lazy(() => import("./screens/EditProfileScreen").then(module => ({ default: module.EditProfileScreen })));
const ArtistRegistrationScreen = lazy(() => import("./screens/ArtistRegistrationScreen").then(module => ({ default: module.ArtistRegistrationScreen })));
const PlaylistPlayerScreen = lazy(() => import("./screens/PlaylistPlayerScreen").then(module => ({ default: module.PlaylistPlayerScreen })));
const DailyMixPlayerScreen = lazy(() => import("./screens/DailyMixPlayerScreen").then(module => ({ default: module.DailyMixPlayerScreen })));
const TransactionHistoryScreen = lazy(() => import("./screens/TransactionHistoryScreen").then(module => ({ default: module.TransactionHistoryScreen })));
const TreatAnalyticsScreen = lazy(() => import("./screens/TreatAnalyticsScreen").then(module => ({ default: module.TreatAnalyticsScreen })));
const TermsAndConditionsScreen = lazy(() => import("./screens/TermsAndConditionsScreen/TermsAndConditionsScreen").then(module => ({ default: module.TermsAndConditionsScreen })));
const MessagesScreen = lazy(() => import("./screens/MessagesScreen").then(module => ({ default: module.MessagesScreen })));
const MessageThreadScreen = lazy(() => import("./screens/MessageThreadScreen").then(module => ({ default: module.MessageThreadScreen })));
const SingleUploadScreen = lazy(() => import("./screens/SingleUploadScreen"));
const AlbumUploadScreen = lazy(() => import("./screens/AlbumUploadScreen"));
const AlbumDetailScreen = lazy(() => import("./screens/AlbumDetailScreen").then(module => ({ default: module.AlbumDetailScreen })));
const PlaylistDetailScreen = lazy(() => import("./screens/PlaylistDetailScreen").then(module => ({ default: module.PlaylistDetailScreen })));
const SongScreen = lazy(() => import("./screens/SongScreen").then(module => ({ default: module.SongScreen })));
const MoodDiscoveryScreen = lazy(() => import("./screens/MoodDiscoveryScreen").then(module => ({ default: module.MoodDiscoveryScreen })));
const GenreSongsScreen = lazy(() => import("./screens/GenreSongsScreen").then(module => ({ default: module.GenreSongsScreen })));
const CollaborateScreen = lazy(() => import("./screens/CollaborateScreen").then(module => ({ default: module.CollaborateScreen })));
const CollaborationInboxScreen = lazy(() => import("./screens/CollaborationInboxScreen").then(module => ({ default: module.CollaborationInboxScreen })));

// Loading component for lazy-loaded screens - uses splash screen for consistency
const ScreenLoader = () => (
  <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#0a0a0a] via-[#0d0d0d] to-[#111111] flex items-center justify-center">
    <div className="relative">
      <img
        src="/official_airaplay_logo.png"
        alt="Loading"
        className="w-32 h-32 object-contain drop-shadow-2xl"
        style={{ animation: 'breathe 3s ease-in-out infinite' }}
      />
      <div className="absolute inset-0 -z-10 blur-3xl opacity-30 bg-[#00ad74] scale-75 animate-pulse" />
    </div>
    <style>{`
      @keyframes breathe {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); opacity: 0.9; }
      }
    `}</style>
  </div>
);

function App() {
  const [showGlobalAuthModal, setShowGlobalAuthModal] = useState(false);
  const [isAlbumPlayerActive, setIsAlbumPlayerActive] = useState(false);
  const [isPlaylistPlayerActive, setIsPlaylistPlayerActive] = useState(false);
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [isTreatModalVisible, setIsTreatModalVisible] = useState(false);
  const [isTippingModalVisible, setIsTippingModalVisible] = useState(false);
  const [isGenreModalVisible, setIsGenreModalVisible] = useState(false);
  const [isTreatAnalyticsModalVisible, setIsTreatAnalyticsModalVisible] = useState(false);
  const [isTreatTransactionsModalVisible, setIsTreatTransactionsModalVisible] = useState(false);
  
  const {
    currentSong,
    playlist,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    audioElement,
    isFullPlayerVisible,
    isMiniPlayerVisible,
    error: playerError,
    playlistContext,
    albumId,
    playSong,
    togglePlayPause,
    hideFullPlayer,
    hideMiniPlayer,
    expandFullPlayer,
    changeSong,
    seekTo,
    restorePlaybackState,
  } = useMusicPlayer();
  
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isVideoRoute = location.pathname.startsWith('/video/');
  const isArtistRegistrationRoute = location.pathname === '/become-artist';
  const isTransactionHistoryRoute = location.pathname === '/transaction-history';
  const isTreatAnalyticsRoute = location.pathname === '/treat-analytics';
  const isTermsRoute = location.pathname.startsWith('/terms/');
  const isSingleUploadRoute = location.pathname === '/upload/single';
  const isAlbumUploadRoute = location.pathname === '/upload/album';

  // Restore playback state on app initialization
  useEffect(() => {
    const restoreState = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await restorePlaybackState();
      }
    };

    restoreState();
  }, []);

  // Handle app lifecycle events to refresh session when app comes to foreground
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return; // Only run on native platforms
    }

    let appStateListener: any = null;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;

    const setupAppLifecycle = async () => {
      try {
        // Listen for app state changes (foreground/background)
        appStateListener = await CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
          if (isActive) {
            // App came to foreground - refresh session if needed
            console.log('[App] App came to foreground, checking session...');
            try {
              await refreshSessionIfNeeded();
            } catch (error) {
              console.error('[App] Error refreshing session on foreground:', error);
            }
          }
        });

        // Also refresh session periodically while app is active (every 10 minutes)
        refreshInterval = setInterval(async () => {
          try {
            await refreshSessionIfNeeded();
          } catch (error) {
            console.error('[App] Error in periodic session refresh:', error);
          }
        }, 10 * 60 * 1000); // 10 minutes
      } catch (error) {
        console.error('[App] Error setting up app lifecycle listener:', error);
      }
    };

    setupAppLifecycle();

    return () => {
      if (appStateListener) {
        appStateListener.remove();
      }
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  useEffect(() => {
    const handlePaymentCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const paymentStatus = params.get('payment');
      const provider = params.get('provider');
      const reference = params.get('ref') || params.get('reference');

      if (paymentStatus && reference && provider === 'flutterwave') {
        if (paymentStatus === 'success') {
          console.log('Flutterwave payment callback received:', reference);
          
          // Clear URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Redirect to home screen
          navigate('/', { replace: true });
        } else if (paymentStatus === 'failed') {
          console.log('Flutterwave payment failed:', reference);
          
          // Clear URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Redirect to home screen
          navigate('/', { replace: true });
        }
      }
    };

    handlePaymentCallback();
  }, [location, navigate]);

  // Handle deep links for payment callbacks (mobile app)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // Process deep link URLs
    const handleDeepLink = (url: string) => {
      try {
        const urlObj = new URL(url);

        // Handle payment callbacks
        if (urlObj.pathname.includes('/payment/')) {
          const params = new URLSearchParams(urlObj.search);
          const paymentStatus = urlObj.pathname.includes('/success') ? 'success' : 'failed';
          const provider = params.get('provider');
          const reference = params.get('ref') || params.get('reference');

          if (reference && provider === 'flutterwave') {
            console.log(`Flutterwave payment ${paymentStatus}:`, reference);

            // Navigate to home - payment monitoring will detect completion
            navigate('/', { replace: true });
          }
          return;
        }

        // Handle content sharing deep links
        const contentPatterns = [
          { pattern: /\/song\/([a-z0-9-]+)/, route: '/song/' },
          { pattern: /\/album\/([a-z0-9-]+)/, route: '/album/' },
          { pattern: /\/playlist\/([a-z0-9-]+)/, route: '/playlist/' },
          { pattern: /\/video\/([a-z0-9-]+)/, route: '/video/' },
          { pattern: /\/user\/([a-z0-9-]+)/, route: '/user/' }
        ];

        for (const { pattern, route } of contentPatterns) {
          const match = urlObj.pathname.match(pattern);
          if (match && match[1]) {
            console.log(`Deep link: Opening ${route}${match[1]}`);
            navigate(`${route}${match[1]}`, { replace: true });
            return;
          }
        }

        // Handle referral links
        const refParam = urlObj.searchParams.get('ref');
        if (refParam) {
          console.log('Deep link: Opening referral link');
          navigate(`/?ref=${refParam}`, { replace: true });
          return;
        }

        // Default: navigate to home
        console.log('Deep link: No specific handler, navigating to home');
        navigate('/', { replace: true });
      } catch (error) {
        console.error('Error handling deep link:', error);
        navigate('/', { replace: true });
      }
    };

    // Handle app opened via deep link on launch
    const checkLaunchUrl = async () => {
      try {
        const { url } = await CapacitorApp.getLaunchUrl();
        if (url) {
          handleDeepLink(url);
        }
      } catch (error) {
        // No launch URL, that's fine
      }
    };

    // Handle deep links while app is running
    const listener = CapacitorApp.addListener('appUrlOpen', (event) => {
      handleDeepLink(event.url);
    });

    // Check for launch URL on app start
    checkLaunchUrl();

    return () => {
      listener.remove();
    };
  }, [navigate]);

  // Handle referral link - Auto-open auth modal when ref parameter is present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');

    if (refCode) {
      // Check if user is already logged in
      const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser();

        // Only show auth modal if user is not logged in
        if (!user) {
          setShowGlobalAuthModal(true);
        }
      };

      checkAuth();
    }
  }, [location.search]);
  
  // Listen for album player visibility changes from components
  useEffect(() => {
    const handleAlbumPlayerVisibility = (event: CustomEvent) => {
      setIsAlbumPlayerActive(event.detail.isVisible);
    };

    const handlePlaylistPlayerVisibility = (event: CustomEvent) => {
      setIsPlaylistPlayerActive(event.detail.isVisible);
    };

    const handleTreatAnalyticsModalVisibility = (event: CustomEvent) => {
      setIsTreatAnalyticsModalVisible(event.detail.isVisible);
    };

    const handleTreatTransactionsModalVisibility = (event: CustomEvent) => {
      setIsTreatTransactionsModalVisible(event.detail.isVisible);
    };

    window.addEventListener('albumPlayerVisibilityChange', handleAlbumPlayerVisibility as EventListener);
    window.addEventListener('playlistPlayerVisibilityChange', handlePlaylistPlayerVisibility as EventListener);
    window.addEventListener('treatAnalyticsModalVisibilityChange', handleTreatAnalyticsModalVisibility as EventListener);
    window.addEventListener('treatTransactionsModalVisibilityChange', handleTreatTransactionsModalVisibility as EventListener);

    return () => {
      window.removeEventListener('albumPlayerVisibilityChange', handleAlbumPlayerVisibility as EventListener);
      window.removeEventListener('playlistPlayerVisibilityChange', handlePlaylistPlayerVisibility as EventListener);
      window.removeEventListener('treatAnalyticsModalVisibilityChange', handleTreatAnalyticsModalVisibility as EventListener);
      window.removeEventListener('treatTransactionsModalVisibilityChange', handleTreatTransactionsModalVisibility as EventListener);
    };
  }, []);
  // Stop music playback when video player becomes active
  useEffect(() => {
    if (isVideoRoute) {
      // Stop any playing music when video player is active
      hideMiniPlayer();
    }
  }, [isVideoRoute, hideMiniPlayer]);

  // Check if any form is currently active based on URL or form state
  const shouldHideNavigation = isArtistRegistrationRoute ||
                              isTransactionHistoryRoute ||
                              isTreatAnalyticsRoute ||
                              isTermsRoute ||
                              isSingleUploadRoute ||
                              isAlbumUploadRoute ||
                              showGlobalAuthModal ||
                              isUploadModalVisible ||
                              isTippingModalVisible;

  // Determine when to hide mini player
  // Hide when: video player is active OR treat modals are open OR genre modal is open OR any full player screen is active OR financial screens
  const shouldHideMiniPlayer = isVideoRoute ||
                              isTreatModalVisible ||
                              isGenreModalVisible ||
                              isFullPlayerVisible ||
                              isAlbumPlayerActive ||
                              isPlaylistPlayerActive ||
                              isTreatAnalyticsModalVisible ||
                              isTreatTransactionsModalVisible ||
                              isTransactionHistoryRoute ||
                              isTreatAnalyticsRoute;

  // Update body class when mini player visibility changes
  useEffect(() => {
    if (isMiniPlayerVisible && !shouldHideMiniPlayer) {
      document.body.classList.add('mini-player-active');
    } else {
      document.body.classList.remove('mini-player-active');
    }

    return () => {
      document.body.classList.remove('mini-player-active');
    };
  }, [isMiniPlayerVisible, shouldHideMiniPlayer]);

  // Listen for auth state changes globally to clear any cached data
  // IMPORTANT: Callback must NOT be async to avoid deadlocks (per Supabase docs)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] Global auth state change:', event, session ? 'has session' : 'no session');

      if (event === 'TOKEN_REFRESHED') {
        console.log('[Auth] Token refreshed successfully');
        return;
      }

      if (event === 'SIGNED_OUT') {
        console.log('[Auth] User signed out, clearing cached data');
        hideMiniPlayer();
        hideFullPlayer();

        const keysToRemove = ['downloaded_songs'];
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
          } catch (error) {
            console.warn(`Failed to remove ${key} from localStorage:`, error);
          }
        });
      } else if (event === 'SIGNED_IN' && session) {
        console.log('[Auth] User signed in');

        if (session.user.app_metadata?.provider === 'google') {
          (async () => {
            try {
              const { data: _existingUser, error: userError } = await supabase
                .from('users')
                .select('id')
                .eq('id', session.user.id)
                .single();

              if (userError && userError.code === 'PGRST116') {
                const { error: insertError } = await supabase
                  .from('users')
                  .insert({
                    id: session.user.id,
                    email: session.user.email || '',
                    display_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || null,
                    role: 'listener',
                  });

                if (insertError) {
                  console.error('[Auth] Error creating user record for Google auth:', insertError);
                }
              }
            } catch (error) {
              console.error('[Auth] Error handling Google sign-in:', error);
            }
          })();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [hideMiniPlayer, hideFullPlayer]);

  const handleGlobalAuthSuccess = () => {
    setShowGlobalAuthModal(false);
  };

  const handleShowGlobalAuthModal = () => {
    setShowGlobalAuthModal(true);
  };

  const handleOpenMusicPlayer = (song: any, playlist: any[] = [], context: string = 'unknown') => {
    const songIndex = playlist.findIndex(s => s.id === song.id);
    const currentIndex = songIndex !== -1 ? songIndex : 0;
    playSong(song, false, playlist, currentIndex, context, null);
  };

  return (
    <div className="bg-gradient-to-b from-[#0a0a0a] via-[#0d0d0d] to-[#111111] flex flex-col w-full min-h-screen min-h-[100dvh]">
      {isWebTarget() && (
        <WebAdBanner
          placement="banner_top"
          className="w-full"
          style={{ minHeight: '90px' }}
        />
      )}

      <div className="flex flex-row justify-center w-full flex-1">
      {isAdminRoute ? (
        // Admin routes - Full width for admin dashboard
        <Suspense fallback={<ScreenLoader />}>
          <Routes>
            <Route path="/admin" element={<AdminDashboardScreen />} />
            <Route path="/admin/login" element={<AdminLoginScreen />} />
          </Routes>
        </Suspense>
      ) : (
        <>
          <WebAdSidebar side="left" />
          {/* App routes - constrained width */}
          <div className="bg-transparent w-full max-w-[390px] relative min-h-screen min-h-[100dvh]">
          <Suspense fallback={<ScreenLoader />}>
            <Routes>
              <Route path="/" element={<RootRedirect onOpenMusicPlayer={handleOpenMusicPlayer} onFormVisibilityChange={setIsUploadModalVisible} />} />
              <Route path="/explore" element={<ExploreScreen onFormVisibilityChange={setIsUploadModalVisible} onOpenMusicPlayer={handleOpenMusicPlayer} onModalVisibilityChange={setIsGenreModalVisible} />} />
              <Route path="/library" element={<LibraryScreen onFormVisibilityChange={setIsUploadModalVisible} onOpenMusicPlayer={handleOpenMusicPlayer} />} />
              <Route path="/create" element={<CreateScreen onFormVisibilityChange={setIsUploadModalVisible} />} />
              <Route path="/profile" element={<ProfileScreen onFormVisibilityChange={setIsUploadModalVisible} />} />
              <Route path="/user/:userId" element={<PublicProfileScreen onOpenMusicPlayer={handleOpenMusicPlayer} isMiniPlayerVisible={isMiniPlayerVisible && !shouldHideMiniPlayer} onTippingModalVisibilityChange={setIsTippingModalVisible} />} />
              <Route path="/album/:albumId" element={<AlbumPlayerScreen onPlayerVisibilityChange={setIsAlbumPlayerActive} onOpenMusicPlayer={handleOpenMusicPlayer} />} />
              <Route path="/album-detail/:albumId" element={<AlbumDetailScreen />} />
              <Route path="/playlist/:playlistId" element={<PlaylistPlayerScreen onPlayerVisibilityChange={setIsPlaylistPlayerActive} onOpenMusicPlayer={handleOpenMusicPlayer} />} />
              <Route path="/playlist-detail/:playlistId" element={<PlaylistDetailScreen />} />
              <Route path="/daily-mix/:mixId" element={<DailyMixPlayerScreen />} />
              <Route path="/treats" element={<TreatScreen onFormVisibilityChange={setIsTreatModalVisible} />} />
              <Route path="/promotion-center" element={<PromotionCenterScreen />} />
              <Route path="/daily-checkin" element={<DailyCheckinScreen />} />
              <Route path="/invite-earn" element={<InviteEarnScreen />} />
              <Route path="/trending" element={<TrendingViewAllScreen onOpenMusicPlayer={handleOpenMusicPlayer} />} />
              <Route path="/trending-near-you" element={<TrendingNearYouViewAllScreen onOpenMusicPlayer={handleOpenMusicPlayer} />} />
              <Route path="/must-watch" element={<MustWatchViewAllScreen />} />
              <Route path="/new-releases" element={<NewReleaseViewAllScreen onOpenMusicPlayer={handleOpenMusicPlayer} />} />
              <Route path="/trending-albums" element={<TrendingAlbumsViewAllScreen />} />
              <Route path="/video/:videoId" element={<VideoPlayerScreen />} />
              <Route path="/notifications" element={<NotificationScreen />} />
              <Route path="/withdraw-earnings" element={<WithdrawEarningsScreen />} />
              <Route path="/edit-profile" element={<EditProfileScreen />} />
              <Route path="/become-artist" element={<ArtistRegistrationScreen />} />
              <Route path="/transaction-history" element={<TransactionHistoryScreen />} />
              <Route path="/treat-analytics" element={<TreatAnalyticsScreen />} />
              <Route path="/terms/:type" element={<TermsAndConditionsScreen />} />
              <Route path="/messages" element={<MessagesScreen />} />
              <Route path="/messages/:threadId" element={<MessageThreadScreen />} />
              <Route path="/upload/single" element={<SingleUploadScreen />} />
              <Route path="/upload/album" element={<AlbumUploadScreen />} />
              <Route path="/song/:songId" element={<SongScreen />} />
              <Route path="/mood-discovery" element={<MoodDiscoveryScreen />} />
              <Route path="/genre/:genreId" element={<GenreSongsScreen />} />
              <Route path="/collaborate" element={<CollaborateScreen />} />
              <Route path="/collaboration-inbox" element={<CollaborationInboxScreen />} />
            </Routes>
          </Suspense>
        </div>
          <WebAdSidebar side="right" />
        </>
      )}
      </div>

      {/* Bottom Navigation Bar - Positioned outside container for edge-to-edge rendering */}
      {!shouldHideNavigation && !isAdminRoute && <NavigationBarSection />}

      {/* Mini Music Player */}
      {(() => {
        const shouldShow = isMiniPlayerVisible && currentSong && !shouldHideMiniPlayer;

        return shouldShow ? (
          <MiniMusicPlayer
            song={currentSong}
            isVisible={isMiniPlayerVisible}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            error={playerError}
            albumId={albumId}
            playlistContext={playlistContext}
            onTogglePlayPause={togglePlayPause}
            onExpand={() => {
              expandFullPlayer();
            }}
            onClose={() => {
              hideMiniPlayer();
            }}
          />
        ) : null;
      })()}

      {isFullPlayerVisible && currentSong && (
        <MusicPlayerScreen
          song={currentSong}
          playlist={playlist}
          currentIndex={currentIndex}
          playlistContext={playlistContext}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          audioElement={audioElement}
          onClose={hideFullPlayer}
          onPlayPause={togglePlayPause}
          onSeek={seekTo}
          onSongChange={changeSong}
          onShowAuthModal={handleShowGlobalAuthModal}
        />
      )}

      {/* Auth Modal - Rendered at the root level outside the max-width container */}
      {showGlobalAuthModal && (
        <AuthModal
          onClose={() => setShowGlobalAuthModal(false)}
          onSuccess={handleGlobalAuthSuccess}
        />
      )}

      {/* Upload Progress Modal */}
      <UploadProgressModal />

      {isWebTarget() && (
        <WebAdBanner
          placement="banner_bottom"
          className="w-full"
          style={{ minHeight: '90px' }}
        />
      )}
    </div>
  );
}

function AppWithRouter() {
  const [showSplash, setShowSplash] = useState(true);
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    console.log('[App] Component mounted, starting initialization...');

    // Initialize app services in background
    const initializeApp = async () => {
      try {
        await appInitializer.initialize();
        console.log('[App] Initialization complete');
      } catch (err) {
        console.error('[App] Initialization error:', err);
      }

      // Initialize AdMob (native/app builds only)
      try {
        await admobService.initialize({
          bannerAdId: import.meta.env.MODE === 'development' ? 'ca-app-pub-3940256099942544/6300978111' : undefined,
          interstitialAdId: import.meta.env.MODE === 'development' ? 'ca-app-pub-3940256099942544/1033173712' : undefined,
          rewardedAdId: import.meta.env.MODE === 'development' ? 'ca-app-pub-3940256099942544/5224354917' : undefined,
          testMode: import.meta.env.MODE === 'development',
        });
        console.log('[App] AdMob initialized');
      } catch (err) {
        console.error('[App] AdMob initialization error:', err);
      }

      // Initialize web ads (web build only - Google AdSense + Monetag web)
      if (isWebTarget()) {
        try {
          await webAdService.initialize();
          console.log('[App] Web ads initialized');
        } catch (err) {
          console.warn('[App] Web ad initialization error:', err);
        }
      }

      setIsAppReady(true);
    };

    initializeApp();
  }, []);

  const handleSplashFinished = () => {
    setShowSplash(false);
  };

  console.log('[App] Rendering full app...');

  return (
    <>
      {showSplash && <SplashScreen onFinished={handleSplashFinished} minDisplayTime={4000} />}
      <BrowserRouter>
        <AuthProvider>
          <AlertProvider>
            <ConfirmProvider>
              <HomeScreenDataProvider>
                <MusicPlayerProvider>
                  <UploadProvider>
                    <App />
                  </UploadProvider>
                </MusicPlayerProvider>
              </HomeScreenDataProvider>
            </ConfirmProvider>
          </AlertProvider>
        </AuthProvider>
      </BrowserRouter>
    </>
  );
}

// Global error handler
window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.error);
  console.error('[Global Error] Message:', event.message);
  console.error('[Global Error] Stack:', event.error?.stack);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
});

const appElement = document.getElementById("app") as HTMLElement;

console.log('[Index] Script loaded, starting app mount...');
console.log('[Index] Environment check:');
console.log('[Index] - VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? 'set' : 'MISSING');
console.log('[Index] - VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'set' : 'MISSING');

try {
  // Mount React app first - loader will be removed when app is ready
  console.log('[Index] Mounting React app...');
  createRoot(appElement).render(
    <StrictMode>
      <AppWithRouter />
    </StrictMode>
  );

  console.log('[Index] React app mounted successfully');
} catch (error) {
  console.error('[Index] FATAL ERROR during app mount:', error);

  // Show error to user
  appElement.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column; background: #0a0a0a; color: white; padding: 20px; text-align: center;">
      <h1 style="font-size: 24px; margin-bottom: 20px; color: #ff4444;">App Failed to Load</h1>
      <p style="margin-bottom: 10px;">Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
      <p style="color: #666; font-size: 14px;">Check the browser console (F12) for more details</p>
      <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #309605; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
        Reload Page
      </button>
    </div>
  `;
}