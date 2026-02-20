import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  User,
  LogOut,
  Camera,
  Star,
  Instagram,
  Youtube,
  DollarSign,
  ExternalLink,
  BarChart,
  ChevronRight,
  Link2,
  Trophy,
} from 'lucide-react';
import {
  Shield,
  Bell,
  HelpCircle,
  Coins,
  Gift,
} from 'lucide-react';
import { AuthModal } from '../../components/AuthModal';
import { HelpSupportModal } from '../../components/HelpSupportModal';
import { NotificationSettingsModal } from '../../components/NotificationSettingsModal';
import { PrivacySettingsModal } from '../../components/PrivacySettingsModal';
import { PurchaseTreatsModal } from '../../components/PurchaseStreatsModal';
import { TippingModal } from '../../components/TippingModal';
import { TreatPromotionModal } from '../../components/TreatPromotionModal';
import { DataSaverToggle } from '../../components/DataSaverToggle';
import { TreatWithdrawalModal } from '../../components/TreatWithdrawalModal';
import { Top1PercentClub } from '../../components/Top1PercentClub';
import { ContributionScoreWidget } from '../../components/ContributionScoreWidget';
import { AnalyticsTab } from './AnalyticsTab';
import {
  supabase,
  getArtistProfile,
  getArtistSocialLinks,
  getFollowerCount,
  getFollowingCount,
} from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useTabPersistence } from '../../hooks/useTabPersistence';
import { persistentCache } from '../../lib/persistentCache';
import { LazyImage } from '../../components/LazyImage';
import { Skeleton } from '../../components/ui/skeleton';
import { useMusicPlayer } from '../../contexts/MusicPlayerContext';
import { useAuth } from '../../contexts/AuthContext';

export interface ProfileScreenProps {
  onFormVisibilityChange?: (isVisible: boolean) => void;
}

// Custom TikTok icon component
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

interface UserProfile {
  id: string;
  email: string;
  display_name?: string;
  role: string;
  bio?: string;
  country?: string;
  username?: string;
  wallet_address?: string;
  total_earnings?: number;
  avatar_url?: string;
  show_artist_badge?: boolean;
  username_changed?: boolean;
  receive_new_follower_notifications?: boolean;
  receive_content_notifications?: boolean;
  receive_playlist_notifications?: boolean;
  receive_system_notifications?: boolean;
  show_listening_history?: boolean;
  profile_visibility?: string;
}

interface ArtistProfile {
  id: string;
  stage_name: string;
  bio?: string;
  hometown?: string;
  country?: string;
  profile_photo_url?: string;
  is_verified?: boolean;
  artist_id?: string;
}

interface SocialLink {
  id: string;
  platform: string;
  handle: string;
  url: string;
}

export const ProfileScreen = ({
  onFormVisibilityChange,
}: ProfileScreenProps): JSX.Element => {
  const navigate = useNavigate();
  const { containerRef } = useTabPersistence('profile-screen');
  const { hideMiniPlayer, hideFullPlayer } = useMusicPlayer();
  const { signOut: authSignOut, isAuthenticated: authIsAuthenticated, isInitialized, user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [artistProfile, setArtistProfile] = useState<ArtistProfile | null>(
    null
  );
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUserProfile, setIsLoadingUserProfile] = useState(true);
  const [isLoadingArtistData, setIsLoadingArtistData] = useState(false);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalDismissed, setAuthModalDismissed] = useState(false);
  const [showArtistForm, setShowArtistForm] = useState(false);
  const [showHelpSupportModal, setShowHelpSupportModal] = useState(false);
  const [showNotificationSettingsModal, setShowNotificationSettingsModal] =
    useState(false);
  const [showPrivacySettingsModal, setShowPrivacySettingsModal] =
    useState(false);
  const [showPurchaseTreatsModal, setShowPurchaseTreatsModal] = useState(false);
  const [showTippingModal, setShowTippingModal] = useState(false);
  const [showTreatPromotionModal, setShowTreatPromotionModal] = useState(false);
  const [showTreatWithdrawalModal, setShowTreatWithdrawalModal] =
    useState(false);
  const [activeTab, setActiveTab] = useState<
    'account' | 'privacy' | 'earnings' | 'analytics' | 'topfans'
  >('account');

  // Handle form visibility changes (exclude auth modal - it's handled globally)
  useEffect(() => {
    const isAnyModalOpen =
      showArtistForm ||
      showHelpSupportModal ||
      showNotificationSettingsModal ||
      showPrivacySettingsModal ||
      showPurchaseTreatsModal ||
      showTippingModal ||
      showTreatPromotionModal ||
      showTreatWithdrawalModal;
    onFormVisibilityChange?.(isAnyModalOpen);
  }, [
    showArtistForm,
    showHelpSupportModal,
    showNotificationSettingsModal,
    showPrivacySettingsModal,
    showPurchaseTreatsModal,
    showTippingModal,
    showTreatPromotionModal,
    showTreatWithdrawalModal,
    onFormVisibilityChange,
  ]);

  useEffect(() => {
    if (authIsAuthenticated && user) {
      loadProfileData();
    } else if (!authIsAuthenticated && isInitialized) {
      setUserProfile(null);
      setArtistProfile(null);
      setSocialLinks([]);
      setFollowerCount(0);
      setFollowingCount(0);
      setIsLoading(false);
    }
  }, [authIsAuthenticated, isInitialized, user]);

  useEffect(() => {
    const handleFocus = () => {
      if (authIsAuthenticated && user) {
        loadProfileData();
      }
    };
    const handleVisibilityChange = () => {
      if (!document.hidden && authIsAuthenticated && user) {
        loadProfileData();
      }
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authIsAuthenticated, user]);

  // Realtime subscription for Live Balance updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`users:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && 'total_earnings' in payload.new) {
            setUserProfile((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                total_earnings: payload.new.total_earnings,
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Navigate to artist registration screen
  useEffect(() => {
    if (showArtistForm) {
      navigate('/become-artist');
      setShowArtistForm(false);
    }
  }, [showArtistForm, navigate]);

  // Auto-open auth modal for unauthenticated users (only if not dismissed)
  useEffect(() => {
    if (isInitialized && !authIsAuthenticated && !showAuthModal && !authModalDismissed) {
      setShowAuthModal(true);
    }
  }, [isInitialized, authIsAuthenticated]);

  const loadProfileData = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      setIsLoadingUserProfile(true);
      setIsLoadingArtistData(false);
      setIsLoadingCounts(false);

      const cacheKey = 'profile-data';
      const cached = await persistentCache.get<any>(cacheKey);

      if (cached) {
        setUserProfile(cached.userProfile);
        setArtistProfile(cached.artistProfile);
        setSocialLinks(cached.socialLinks || []);
        setFollowerCount(cached.followerCount || 0);
        setFollowingCount(cached.followingCount || 0);
        setIsLoading(false);
        setIsLoadingUserProfile(false);
        setIsLoadingArtistData(false);
        setIsLoadingCounts(false);

        setTimeout(async () => {
          try {
            const [artistDataResult, countsResult] = await Promise.allSettled([
              (async () => {
                const profile = await getArtistProfile();
                let links: SocialLink[] = [];
                if (profile) {
                  links = await getArtistSocialLinks(profile.id);
                }
                return { profile, links };
              })(),
              (async () => {
                const [followers, following] = await Promise.all([
                  getFollowerCount(user.id),
                  getFollowingCount(user.id),
                ]);
                return { followers, following };
              })()
            ]);

            if (artistDataResult.status === 'fulfilled') {
              const { profile, links } = artistDataResult.value;
              if (profile && JSON.stringify(profile) !== JSON.stringify(cached.artistProfile)) {
                setArtistProfile(profile);
              }
              if (JSON.stringify(links) !== JSON.stringify(cached.socialLinks)) {
                setSocialLinks(links || []);
              }
            }

            if (countsResult.status === 'fulfilled') {
              const { followers, following } = countsResult.value;
              if (followers !== cached.followerCount) setFollowerCount(followers);
              if (following !== cached.followingCount) setFollowingCount(following);

              await persistentCache.set('profile-data', {
                userProfile: cached.userProfile,
                artistProfile: artistDataResult.status === 'fulfilled' ? artistDataResult.value.profile : cached.artistProfile,
                socialLinks: artistDataResult.status === 'fulfilled' ? artistDataResult.value.links : cached.socialLinks,
                followerCount: followers,
                followingCount: following,
              }, 10 * 60 * 1000);
            }
          } catch (error) {
            console.error('Background refresh failed:', error);
          }
        }, 100);

        return;
      }

      await fetchFreshProfileData(false);
    } catch (error) {
      console.error('Error loading profile:', error);
      setIsLoading(false);
      setIsLoadingUserProfile(false);
    }
  };

  const fetchFreshProfileData = async (backgroundRefresh: boolean = false) => {
    if (!user?.id) return;

    if (!backgroundRefresh) {
      await persistentCache.delete('profile-data');
    }

    // Step 1: Load user profile first (critical data)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('Error fetching user profile:', userError);
      setIsLoadingUserProfile(false);
    } else {
      setUserProfile(userData);
      setIsLoadingUserProfile(false);
    }

    // Step 2 & 3: Load artist data and counts in parallel (non-critical)
    setIsLoadingArtistData(true);
    setIsLoadingCounts(true);

    const [artistDataResult, countsResult] = await Promise.allSettled([
      // Artist data loading
      (async () => {
        try {
          const profile = await getArtistProfile();
          let links: SocialLink[] = [];
          if (profile) {
            links = await getArtistSocialLinks(profile.id);
          }
          return { profile, links };
        } catch (error) {
          console.error('Error loading artist data:', error);
          return { profile: null, links: [] };
        }
      })(),
      // Counts loading
      (async () => {
        try {
          const [followers, following] = await Promise.all([
            getFollowerCount(user.id),
            getFollowingCount(user.id),
          ]);
          return { followers, following };
        } catch (error) {
          console.error('Error loading counts:', error);
          return { followers: 0, following: 0 };
        }
      })()
    ]);

    // Update artist data
    if (artistDataResult.status === 'fulfilled') {
      const { profile, links } = artistDataResult.value;
      if (profile) {
        setArtistProfile(profile);
        setSocialLinks(links || []);
      }
    }
    setIsLoadingArtistData(false);

    // Update counts
    if (countsResult.status === 'fulfilled') {
      const { followers, following } = countsResult.value;
      setFollowerCount(followers);
      setFollowingCount(following);
    }
    setIsLoadingCounts(false);

    // Cache the complete data (reuse already-fetched data)
    if (userData) {
      const profile = artistDataResult.status === 'fulfilled' ? artistDataResult.value.profile : null;
      const links = artistDataResult.status === 'fulfilled' ? artistDataResult.value.links : [];
      const followers = countsResult.status === 'fulfilled' ? countsResult.value.followers : 0;
      const following = countsResult.status === 'fulfilled' ? countsResult.value.following : 0;

      await persistentCache.set('profile-data', {
        userProfile: userData,
        artistProfile: profile,
        socialLinks: links,
        followerCount: followers,
        followingCount: following,
      }, 10 * 60 * 1000);
    }

    setIsLoading(false);
  };

  const handleSignOut = async () => {
    try {
      hideMiniPlayer();
      hideFullPlayer();

      setUserProfile(null);
      setArtistProfile(null);
      setSocialLinks([]);
      setFollowerCount(0);
      setFollowingCount(0);

      await authSignOut();

      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error during sign out:', error);
      setUserProfile(null);
      setArtistProfile(null);
      setSocialLinks([]);
      setFollowerCount(0);
      setFollowingCount(0);
    }
  };


  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    loadProfileData();
  };

  const handleNotificationSettingsSuccess = () => {
    setShowNotificationSettingsModal(false);
    loadProfileData();
  };

  const handlePrivacySettingsSuccess = () => {
    setShowPrivacySettingsModal(false);
    loadProfileData();
  };

  const handleTreatModalSuccess = () => {
    loadProfileData();
  };

  const handleViewPublicProfile = () => {
    if (userProfile?.id) {
      navigate(`/user/${userProfile.id}`);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatEarnings = (amount: number): string => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    } else if (amount >= 10000) {
      return `$${(amount / 1000).toFixed(2)}K`;
    }
    return `$${amount.toFixed(2)}`;
  };

  // Profile Skeleton Component
  const ProfileSkeleton = () => (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#1a1a1a] via-[#0d0d0d] to-[#000000] text-white overflow-y-auto content-with-nav">
      {/* Header Skeleton */}
      <header className="w-full py-4 px-5 sticky top-0 z-20 bg-gradient-to-b from-[#1a1a1a] to-transparent backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <Skeleton variant="circular" width={40} height={40} className="bg-white/10" />
          <Skeleton variant="text" height={24} width={100} className="bg-white/10" />
          <div className="w-10" />
        </div>
      </header>

      <div className="flex-1 px-5 py-6 space-y-6">
        {/* Profile Header Card Skeleton */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/10 shadow-2xl p-6">
          <div className="relative z-10">
            {/* Avatar Skeleton */}
            <div className="flex justify-center mb-4">
              <Skeleton variant="circular" width={96} height={96} className="bg-white/10" />
            </div>

            {/* Name Skeleton */}
            <div className="text-center mb-4">
              <Skeleton variant="text" height={32} width={200} className="mx-auto mb-2 bg-white/10" />
              <Skeleton variant="text" height={16} width={120} className="mx-auto mb-2 bg-white/10" />
              <Skeleton variant="rectangular" height={28} width={80} className="mx-auto rounded-full bg-white/10" />
            </div>

            {/* Bio Skeleton */}
            <div className="mb-4">
              <Skeleton variant="text" height={16} width="90%" className="mx-auto mb-1 bg-white/10" />
              <Skeleton variant="text" height={16} width="70%" className="mx-auto bg-white/10" />
            </div>

            {/* Stats Skeleton */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-center p-3 bg-white/5 rounded-xl">
                  <Skeleton variant="text" height={24} width={60} className="mx-auto mb-2 bg-white/10" />
                  <Skeleton variant="text" height={14} width={50} className="mx-auto bg-white/10" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Navigation Skeleton */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rectangular" height={40} width={100} className="rounded-full bg-white/10" />
          ))}
        </div>

        {/* Tab Content Skeleton */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton variant="rectangular" width={44} height={44} className="rounded-xl bg-white/10" />
                  <Skeleton variant="text" height={16} width={120} className="bg-white/10" />
                </div>
                <Skeleton variant="rectangular" width={20} height={20} className="bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Show UI immediately, don't block on loading
  if (!userProfile && isLoading) {
    // Still loading initial data, show minimal UI
  }

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#1a1a1a] via-[#0d0d0d] to-[#000000] content-with-nav">
        {null}
      </div>
    );
  }

  if (isLoading && !userProfile) {
    return <ProfileSkeleton />;
  }

  if (!authIsAuthenticated) {
    if (!showAuthModal && !authModalDismissed) {
      setShowAuthModal(true);
    } else if (authModalDismissed) {
      navigate('/');
      return null;
    }

    return (
      <>
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-[#1a1a1a] via-[#0d0d0d] to-[#000000] content-with-nav">
          {null}
        </div>
        {showAuthModal && (
          <AuthModal
            onClose={() => {
              setShowAuthModal(false);
              setAuthModalDismissed(true);
              onFormVisibilityChange?.(false);
              navigate('/');
            }}
            onSuccess={handleAuthSuccess}
          />
        )}
      </>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col min-h-screen min-h-[100dvh] bg-gradient-to-b from-[#1a1a1a] via-[#0d0d0d] to-[#000000] text-white overflow-y-auto content-with-nav">
      {/* Header */}
      <header className="w-full py-4 px-5 sticky top-0 z-20 bg-gradient-to-b from-[#1a1a1a] to-transparent backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="p-2 hover:bg-white/10 rounded-full transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="font-bold text-lg">Profile</h1>
          <button
            onClick={handleSignOut}
            aria-label="Logout"
            className="p-2 hover:bg-red-600/20 rounded-full transition-all"
          >
            <LogOut className="w-6 h-6 text-red-500" />
          </button>
        </div>
      </header>

      <div className="flex-1 px-5 py-6 space-y-6">
        {/* Profile Header Card */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/10 shadow-2xl p-6">
          {/* Background Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#309605]/10 to-transparent pointer-events-none"></div>

          <div className="relative z-10">
            {/* Avatar + Edit Button */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                {isLoadingUserProfile ? (
                  <Skeleton variant="circular" width={96} height={96} className="bg-white/10" />
                ) : artistProfile?.profile_photo_url || userProfile?.avatar_url ? (
                  <LazyImage
                    src={artistProfile?.profile_photo_url || userProfile?.avatar_url || ''}
                    alt="Profile"
                    className="w-24 h-24 object-cover rounded-full border-4 border-white/20 shadow-2xl"
                    width={96}
                    height={96}
                    loading="eager"
                    useSkeleton={true}
                  />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-[#309605] to-[#3ba208] rounded-full flex items-center justify-center shadow-2xl">
                    <span className="font-bold text-white text-3xl">
                      {(userProfile?.display_name || userProfile?.email || 'U')
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  </div>
                )}
                {!isLoadingUserProfile && (
                  <button
                    onClick={() => navigate('/edit-profile')}
                    className="absolute bottom-0 right-0 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-xl hover:bg-white/30 transition-all border border-white/30"
                  >
                    <Camera className="w-5 h-5 text-white" />
                  </button>
                )}
              </div>
            </div>

            {/* Name & Username */}
            <div className="text-center mb-4">
              {isLoadingUserProfile ? (
                <>
                  <Skeleton variant="text" height={32} width={200} className="mx-auto mb-2 bg-white/10" />
                  <Skeleton variant="text" height={16} width={120} className="mx-auto mb-2 bg-white/10" />
                  <Skeleton variant="rectangular" height={28} width={80} className="mx-auto rounded-full bg-white/10" />
                </>
              ) : (
                <>
                  <h2 className="font-bold text-white text-2xl mb-1">
                    {userProfile?.display_name ||
                      artistProfile?.stage_name ||
                      'Anonymous User'}
                  </h2>
                  {userProfile?.username && (
                    <p className="text-gray-400 text-sm mb-2">
                      @{userProfile.username}
                    </p>
                  )}
                  {userProfile?.role && (
                    <div className="inline-flex mt-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                      <p className="text-white text-xs font-medium">
                        {userProfile.role.charAt(0).toUpperCase() + userProfile.role.slice(1)}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bio */}
            {userProfile?.bio && (
              <p className="text-white/80 text-sm text-center mb-4 leading-relaxed">
                {userProfile.bio}
              </p>
            )}

            {/* Country */}
            {userProfile?.country && (
              <p className="text-gray-400 text-sm text-center mb-4">
                📍 {userProfile.country}
              </p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {isLoadingCounts ? (
                <>
                  {[1, 2].map((i) => (
                    <div key={i} className="text-center p-3 bg-white/5 rounded-xl backdrop-blur-sm">
                      <Skeleton variant="text" height={24} width={50} className="mx-auto mb-2 bg-white/10" />
                      <Skeleton variant="text" height={14} width={60} className="mx-auto bg-white/10" />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="text-center p-3 bg-white/5 rounded-xl backdrop-blur-sm">
                    <p className="font-bold text-white text-lg">{formatNumber(followerCount)}</p>
                    <p className="text-gray-400 text-xs">Followers</p>
                  </div>
                  <div className="text-center p-3 bg-white/5 rounded-xl backdrop-blur-sm">
                    <p className="font-bold text-white text-lg">{formatNumber(followingCount)}</p>
                    <p className="text-gray-400 text-xs">Following</p>
                  </div>
                </>
              )}
            </div>

            {/* Social Links */}
            {isLoadingArtistData ? (
              <div className="flex flex-col items-center gap-2 justify-center w-full">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center justify-center gap-2">
                    <Skeleton variant="circular" width={16} height={16} className="bg-white/10 flex-shrink-0" />
                    <Skeleton variant="text" width={200} height={14} className="bg-white/10" />
                  </div>
                ))}
              </div>
            ) : socialLinks.length > 0 ? (
              <div className="flex flex-col items-center gap-2 justify-center w-full">
                {socialLinks.map((link) => {
                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 hover:opacity-70 transition-opacity group"
                    >
                      <Link2 className="w-4 h-4 text-white/70 flex-shrink-0" />
                      <span className="text-white/80 text-xs font-normal truncate max-w-xs">
                        {link.url}
                      </span>
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {[
            { id: 'account', icon: User, label: 'Account' },
            { id: 'topfans', icon: Trophy, label: 'Top Fans' },
            { id: 'privacy', icon: Shield, label: 'Privacy' },
            { id: 'earnings', icon: DollarSign, label: 'Earnings' },
            ...(artistProfile ? [{ id: 'analytics', icon: BarChart, label: 'Analytics' }] : []),
          ].map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-center gap-1.5 py-3 px-4 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <IconComponent className="w-4 h-4 flex-shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div>
          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="space-y-4">
              <div
                onClick={() => navigate('/treats')}
                className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-yellow-600/20 to-orange-600/20 backdrop-blur-md border border-yellow-500/30 hover:border-yellow-500/50 transition-all duration-300 cursor-pointer group p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl shadow-yellow-600/25 group-hover:scale-105 transition-transform duration-200">
                      <Coins className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h4 className="text-white text-base font-semibold mb-1">
                        Treat System
                      </h4>
                      <p className="text-white/70 text-sm">
                        Manage treats, tips & promotions
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-yellow-400 group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </div>

              <div className="space-y-3">
                <div
                  onClick={() => navigate('/edit-profile')}
                  className="rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/10 hover:bg-white/[0.05] transition-all duration-300 cursor-pointer p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-white text-sm font-medium">
                        Edit Information
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>

                {userProfile && (
                  <div
                    onClick={handleViewPublicProfile}
                    className="rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/10 hover:bg-white/[0.05] transition-all duration-300 cursor-pointer p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                          <ExternalLink className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-white text-sm font-medium">
                          View Profile
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                )}

                <div
                  onClick={() => setShowNotificationSettingsModal(true)}
                  className="rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/10 hover:bg-white/[0.05] transition-all duration-300 cursor-pointer p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                        <Bell className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-white text-sm font-medium">
                        Notifications
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>

                <div
                  onClick={() => navigate('/invite-earn')}
                  className="rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/10 hover:bg-white/[0.05] transition-all duration-300 cursor-pointer p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                        <Gift className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-white text-sm font-medium">
                        Invite & Earn
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>

                <div
                  onClick={() => setShowHelpSupportModal(true)}
                  className="rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/10 hover:bg-white/[0.05] transition-all duration-300 cursor-pointer p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                        <HelpCircle className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-white text-sm font-medium">
                        Help & Support
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="w-full h-14 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 border border-red-500 hover:border-red-600 rounded-2xl font-medium text-white transition-all duration-200 flex items-center justify-center gap-3 mt-6"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>

              {userProfile?.role === 'listener' && (
                <button
                  onClick={() => setShowArtistForm(true)}
                  className="w-full h-14 bg-white hover:bg-white/90 rounded-2xl font-medium text-black transition-all duration-200 flex items-center justify-center gap-2 mt-4"
                >
                  <Star className="w-5 h-5" />
                  Become an Artist
                </button>
              )}
            </div>
          )}

          {/* Top Fans Tab */}
          {activeTab === 'topfans' && (
            <Top1PercentClub
              userId={userProfile?.id}
              userRole={userProfile?.role}
              artistProfileId={artistProfile?.id}
            />
          )}

          {/* Privacy Tab */}
          {activeTab === 'privacy' && (
            <div className="space-y-3">
              <div
                onClick={() => setShowPrivacySettingsModal(true)}
                className="rounded-2xl bg-white/[0.03] backdrop-blur-sm border border-white/10 hover:bg-white/[0.05] transition-all duration-300 cursor-pointer p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-white text-sm font-medium">
                        Profile Visibility
                      </h4>
                      <p className="text-gray-400 text-xs">
                        Control who can see your profile
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>

              <DataSaverToggle />
            </div>
          )}

          {/* Earnings Tab */}
          {activeTab === 'earnings' && (
            <div className="space-y-4">
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#309605]/20 to-[#3ba208]/20 backdrop-blur-sm border border-[#309605]/30 p-8 text-center shadow-2xl" >
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-transparent pointer-events-none"></div>
                <div className="relative z-10">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-green-600/30">
                    <DollarSign className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="font-bold text-white text-4xl mb-2 whitespace-nowrap overflow-hidden text-ellipsis px-2">
                    {formatEarnings(userProfile?.total_earnings || 0)}
                  </h3>
                  <p className="text-white/80 text-sm mb-4">
                    Live Balance
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-400 text-sm font-medium">
                      </span>
                  </div>
                </div>
              </div>

              {/* Contribution Score Widget */}
              <ContributionScoreWidget userId={user?.id} />

              <button
                onClick={() => navigate('/withdraw-earnings')}
                disabled={(userProfile?.total_earnings || 0) < 10}
                className="w-full h-14 bg-white hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium text-black transition-all duration-200 shadow-xl"
              >
                Withdraw Earnings
              </button>

              <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-6">
                <h4 className="font-['Inter',sans-serif] font-semibold text-white text-lg mb-5 tracking-tight">
                  How You Earn
                </h4>
                <ul className="space-y-4">
                  <li className="flex items-start gap-4 group">
                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-white/20 transition-colors duration-200">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="font-['Inter',sans-serif] text-white/90 text-[15px] leading-relaxed">
                        <strong>Creator Earnings:</strong> Earn from streams, plays, and engagement with your content
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4 group">
                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-white/20 transition-colors duration-200">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="font-['Inter',sans-serif] text-white/90 text-[15px] leading-relaxed">
                        <strong>Listener Contributions:</strong> Earn by creating playlists, discovering new music, and staying active
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4 group">
                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-white/20 transition-colors duration-200">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="font-['Inter',sans-serif] text-white/90 text-[15px] leading-relaxed">
                        <strong>Tips & Treats:</strong> Receive direct support from fans through tips and donations
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4 group">
                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-white/20 transition-colors duration-200">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="font-['Inter',sans-serif] text-white/90 text-[15px] leading-relaxed">
                        <strong>Community Pool:</strong> Your contribution score determines your share of the monthly community earnings pool
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && artistProfile && (
            <AnalyticsTab />
          )}
        </div>
      </div>

      {/* Modals */}
      {showHelpSupportModal && (
        <HelpSupportModal onClose={() => setShowHelpSupportModal(false)} />
      )}
      {showNotificationSettingsModal && (
        <NotificationSettingsModal
          onClose={() => setShowNotificationSettingsModal(false)}
          onSuccess={handleNotificationSettingsSuccess}
          userProfile={userProfile}
        />
      )}
      {showPrivacySettingsModal && (
        <PrivacySettingsModal
          onClose={() => setShowPrivacySettingsModal(false)}
          onSuccess={handlePrivacySettingsSuccess}
          userProfile={userProfile}
        />
      )}
      {showPurchaseTreatsModal && (
        <PurchaseTreatsModal
          onClose={() => setShowPurchaseTreatsModal(false)}
          onSuccess={() => {
            setShowPurchaseTreatsModal(false);
            handleTreatModalSuccess();
          }}
        />
      )}
      {showTippingModal && (
        <TippingModal
          onClose={() => setShowTippingModal(false)}
          onSuccess={() => {
            setShowTippingModal(false);
            handleTreatModalSuccess();
          }}
        />
      )}
      {showTreatPromotionModal && (
        <TreatPromotionModal
          onClose={() => setShowTreatPromotionModal(false)}
          onSuccess={() => {
            setShowTreatPromotionModal(false);
            handleTreatModalSuccess();
          }}
        />
      )}
      {showTreatWithdrawalModal && (
        <TreatWithdrawalModal
          onClose={() => setShowTreatWithdrawalModal(false)}
          onSuccess={() => {
            setShowTreatWithdrawalModal(false);
            handleTreatModalSuccess();
          }}
        />
      )}
    </div>
  );
};