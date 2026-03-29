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
  ShieldCheck,
  Clock,
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
import { safeHrefUrl } from '../../lib/sanitizeHtml';
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

interface WithdrawalHistoryItem {
  id: string;
  amount: number | null;
  net_amount: number | null;
  currency_code: string | null;
  currency_symbol: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  requested_date: string | null;
  request_date?: string | null;
  created_at?: string | null;
  processed_date: string | null;
  payment_reference: string | null;
  method_type: 'usdt_wallet' | 'bank_account' | null;
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
  const [isSigningOut, setIsSigningOut] = useState(false);
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
  const [admobRevenueStatus, setAdmobRevenueStatus] = useState<{
    ready: boolean;
    message: string;
    has_successful_sync: boolean;
  } | null>(null);
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalHistoryItem[]>([]);
  const [isLoadingWithdrawalHistory, setIsLoadingWithdrawalHistory] = useState(false);

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
      loadAdmobRevenueStatus();
      loadWithdrawalHistory();
    } else if (!authIsAuthenticated && isInitialized) {
      setUserProfile(null);
      setArtistProfile(null);
      setSocialLinks([]);
      setFollowerCount(0);
      setFollowingCount(0);
      setWithdrawalHistory([]);
      setIsLoading(false);
    }
  }, [authIsAuthenticated, isInitialized, user]);

  useEffect(() => {
    const handleFocus = () => {
      if (authIsAuthenticated && user) {
        loadProfileData();
        loadWithdrawalHistory();
      }
    };
    const handleVisibilityChange = () => {
      if (!document.hidden && authIsAuthenticated && user) {
        loadProfileData();
        loadWithdrawalHistory();
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

  const loadAdmobRevenueStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('get_admob_revenue_status');
      if (error) throw error;
      setAdmobRevenueStatus(data);
    } catch (error) {
      console.error('Error loading AdMob revenue status:', error);
      setAdmobRevenueStatus({ ready: false, message: 'Unable to check revenue status', has_successful_sync: false });
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

  const loadWithdrawalHistory = async () => {
    if (!user?.id) return;
    try {
      setIsLoadingWithdrawalHistory(true);
      const retentionCutoffMs = Date.now() - 45 * 24 * 60 * 60 * 1000;
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select(
          'id, amount, net_amount, currency_code, currency_symbol, status, requested_date, request_date, created_at, processed_date, payment_reference, method_type'
        )
        .eq('user_id', user.id)
        .limit(50);

      if (error) throw error;
      const normalized = ((data || []) as WithdrawalHistoryItem[])
        .map((row) => {
          const effectiveDate = row.requested_date || row.request_date || row.created_at || null;
          return {
            ...row,
            requested_date: effectiveDate,
          };
        })
        .filter((row) => {
          if (!row.requested_date) return false;
          const ts = new Date(row.requested_date).getTime();
          return !Number.isNaN(ts) && ts >= retentionCutoffMs;
        })
        .sort((a, b) => {
          const aTs = new Date(a.requested_date || 0).getTime();
          const bTs = new Date(b.requested_date || 0).getTime();
          return bTs - aTs;
        })
        .slice(0, 10);
      setWithdrawalHistory(normalized);
    } catch (error) {
      console.error('Error loading withdrawal history:', error);
      setWithdrawalHistory([]);
    } finally {
      setIsLoadingWithdrawalHistory(false);
    }
  };

  const formatWithdrawalAmount = (row: WithdrawalHistoryItem): string => {
    const amount = row.net_amount ?? row.amount ?? 0;
    const symbol = row.currency_symbol || '$';
    return `${symbol}${Number(amount).toFixed(2)}`;
  };

  const formatWithdrawalDate = (value: string | null): string => {
    if (!value) return '—';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      hideMiniPlayer();
      hideFullPlayer();

      // Navigate immediately to prevent showing "Anonymous User"
      navigate('/', { replace: true });

      // Clear state after navigation to prevent flash
      setUserProfile(null);
      setArtistProfile(null);
      setSocialLinks([]);
      setFollowerCount(0);
      setFollowingCount(0);

      await authSignOut();
    } catch (error) {
      console.error('Error during sign out:', error);
      setUserProfile(null);
      setArtistProfile(null);
      setSocialLinks([]);
      setFollowerCount(0);
      setFollowingCount(0);
    } finally {
      setIsSigningOut(false);
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

  // Profile Skeleton Component — InviteEarn design system
  const ProfileSkeleton = () => (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#1a1a1a] via-[#0d0d0d] to-[#000000] text-white overflow-y-auto content-with-nav font-['Inter',sans-serif]">
      <header
        className="w-full py-5 px-5 sticky top-0 z-20 bg-gradient-to-b from-[#1a1a1a] to-transparent backdrop-blur-sm border-b border-white/10"
        style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top, 0px) * 0.25)', paddingBottom: '1.25rem' }}
      >
        <div className="flex items-center justify-between">
          <Skeleton variant="circular" width={40} height={40} className="bg-white/10" />
          <Skeleton variant="text" height={24} width={100} className="bg-white/10" />
          <div className="w-10" />
        </div>
      </header>

      <div className="flex-1 px-5 py-6 space-y-6">
        <div className="relative rounded-3xl overflow-hidden bg-white/5 border border-white/10 p-6">
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
    <div ref={containerRef} className="flex flex-col min-h-screen min-h-[100dvh] bg-gradient-to-b from-[#1a1a1a] via-[#0d0d0d] to-[#000000] text-white overflow-y-auto content-with-nav font-['Inter',sans-serif]">
      {/* Header — matches InviteEarnScreen design system */}
      <header
        className="w-full py-5 px-5 sticky top-0 z-20 bg-gradient-to-b from-[#1a1a1a] to-transparent backdrop-blur-sm border-b border-white/10"
        style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top, 0px) * 0.25)', paddingBottom: '1.25rem' }}
      >
        <div className="flex items-center justify-between">
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            aria-label="Go back"
            className="min-w-[44px] min-h-[44px] p-2 rounded-full hover:bg-white/10 active:bg-white/15 transition-colors flex items-center justify-center -ml-1"
          >
            <ArrowLeft className="w-5 h-5 text-white/80" />
          </button>
          <div className="text-center min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60 mb-0.5">
              Account
            </p>
            <h1 className="text-[15px] font-black tracking-tight text-white leading-none">
              Profile
            </h1>
          </div>
          <button
            onClick={handleSignOut}
            aria-label="Logout"
            className="min-w-[44px] min-h-[44px] p-2 rounded-full hover:bg-red-500/20 active:bg-red-500/30 transition-colors flex items-center justify-center"
          >
            <LogOut className="w-5 h-5 text-red-400" />
          </button>
        </div>
      </header>

      <div className="flex-1 px-5 py-6 space-y-6">
        {/* Profile Header Card — InviteEarn design system */}
        <div className="relative rounded-3xl overflow-hidden bg-white/5 border border-white/10 p-6">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(48,150,5,0.12),transparent_60%)] pointer-events-none" />

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
                    className="w-24 h-24 object-cover rounded-full border-4 border-white/10"
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
                    className="absolute bottom-0 right-0 w-11 h-11 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all border border-white/10"
                  >
                    <Camera className="w-5 h-5 text-white/80" />
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
                    {isSigningOut ? 'Signing out...' : userProfile?.display_name || ''}
                  </h2>
                  {userProfile?.username && (
                    <p className="text-white/50 text-sm mb-2">
                      @{userProfile.username}
                    </p>
                  )}
                  {userProfile?.role && (
                    <div className="inline-flex mt-2 px-4 py-1.5 bg-white/10 rounded-full border border-white/10">
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
              <p className="text-white/50 text-sm text-center mb-4">
                📍 {userProfile.country}
              </p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {isLoadingCounts ? (
                <>
                  {[1, 2].map((i) => (
                    <div key={i} className="text-center p-3 bg-white/5 rounded-xl border border-white/10">
                      <Skeleton variant="text" height={24} width={50} className="mx-auto mb-2 bg-white/10" />
                      <Skeleton variant="text" height={14} width={60} className="mx-auto bg-white/10" />
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div className="text-center p-3 bg-white/5 rounded-xl border border-white/10">
                    <p className="font-bold text-white text-lg">{formatNumber(followerCount)}</p>
                    <p className="text-white/50 text-xs">Followers</p>
                  </div>
                  <div className="text-center p-3 bg-white/5 rounded-xl border border-white/10">
                    <p className="font-bold text-white text-lg">{formatNumber(followingCount)}</p>
                    <p className="text-white/50 text-xs">Following</p>
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
                  const safeUrl = safeHrefUrl(link.url);
                  return safeUrl ? (
                    <a
                      key={link.id}
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 hover:opacity-70 transition-opacity group"
                    >
                      <Link2 className="w-4 h-4 text-white/70 flex-shrink-0" />
                      <span className="text-white/80 text-xs font-normal truncate max-w-xs">
                        {link.url}
                      </span>
                    </a>
                  ) : (
                    <span key={link.id} className="flex items-center justify-center gap-2 text-white/80 text-xs truncate max-w-xs">
                      <Link2 className="w-4 h-4 text-white/70 flex-shrink-0" />
                      {link.url}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        {/* Tab Navigation — InviteEarn design system */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {[
            { id: 'account', icon: User, label: 'Account' },
            { id: 'topfans', icon: Trophy, label: 'Top Fans' },
            { id: 'privacy', icon: Shield, label: 'Privacy' },
            { id: 'earnings', icon: DollarSign, label: 'Earnings' },
            ...(userProfile?.role === 'creator' ? [{ id: 'analytics', icon: BarChart, label: 'Analytics' }] : []),
          ].map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-center gap-1.5 py-3 px-4 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
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
              {/* Treat System — same colors as TreatWalletCard (yellow/orange gradient) */}
              <div
                onClick={() => navigate('/treats')}
                className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-yellow-600/20 to-orange-600/20 backdrop-blur-sm border border-yellow-500/30 hover:border-yellow-500/50 transition-all cursor-pointer group p-5"
              >
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-600/25 group-hover:scale-105 transition-transform">
                      <Coins className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h4 className="font-['Inter',sans-serif] font-bold text-white text-base mb-1">
                        Treat System
                      </h4>
                      <p className="font-['Inter',sans-serif] text-white/70 text-sm">
                        Manage treats, tips & promotions
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/50 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div className="space-y-3">
                <div
                  onClick={() => navigate('/edit-profile')}
                  className="rounded-2xl bg-white/5 border border-white/10 hover:bg-white/5 hover:border-white/20 transition-all cursor-pointer p-4 active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                        <User className="w-5 h-5 text-white/80" />
                      </div>
                      <span className="text-white text-sm font-medium">
                        Edit Information
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/50" />
                  </div>
                </div>

                {userProfile && (
                  <div
                    onClick={handleViewPublicProfile}
                    className="rounded-2xl bg-white/5 border border-white/10 hover:bg-white/5 hover:border-white/20 transition-all cursor-pointer p-4 active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                          <ExternalLink className="w-5 h-5 text-white/80" />
                        </div>
                        <span className="text-white text-sm font-medium">
                          View Profile
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-white/50" />
                    </div>
                  </div>
                )}

                <div
                  onClick={() => setShowNotificationSettingsModal(true)}
                  className="rounded-2xl bg-white/5 border border-white/10 hover:bg-white/5 hover:border-white/20 transition-all cursor-pointer p-4 active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                        <Bell className="w-5 h-5 text-white/80" />
                      </div>
                      <span className="text-white text-sm font-medium">
                        Notifications
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/50" />
                  </div>
                </div>

                <div
                  onClick={() => navigate('/invite-earn')}
                  className="rounded-2xl bg-white/5 border border-white/10 hover:bg-white/5 hover:border-white/20 transition-all cursor-pointer p-4 active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                        <Gift className="w-5 h-5 text-white/80" />
                      </div>
                      <span className="text-white text-sm font-medium">
                        Invite & Earn
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/50" />
                  </div>
                </div>

                <div
                  onClick={() => setShowHelpSupportModal(true)}
                  className="rounded-2xl bg-white/5 border border-white/10 hover:bg-white/5 hover:border-white/20 transition-all cursor-pointer p-4 active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                        <HelpCircle className="w-5 h-5 text-white/80" />
                      </div>
                      <span className="text-white text-sm font-medium">
                        Help & Support
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/50" />
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="w-full min-h-[48px] bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-2xl font-semibold text-red-400 transition-all flex items-center justify-center gap-3 mt-6 active:scale-[0.98]"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>

              {userProfile?.role === 'listener' && (
                <button
                  onClick={() => setShowArtistForm(true)}
                  className="w-full min-h-[48px] bg-white hover:opacity-90 text-black rounded-2xl font-bold transition-all flex items-center justify-center gap-2 mt-4 active:scale-[0.98]"
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
                className="rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer p-4 active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                      <Shield className="w-5 h-5 text-white/80" />
                    </div>
                    <div>
                      <h4 className="text-white text-sm font-medium">
                        Profile Visibility
                      </h4>
                      <p className="text-white/50 text-xs">
                        Control who can see your profile
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/50" />
                </div>
              </div>

              <DataSaverToggle />
            </div>
          )}

          {/* Earnings Tab — Live balance = net revenue (artist 50% share from 50/50 split with platform), not gross */}
          {activeTab === 'earnings' && (
            <div className="space-y-4">
              <div className="relative rounded-3xl overflow-hidden border border-[#00ad74]/20 bg-gradient-to-br from-[#00ad74]/15 via-[#009c68]/10 to-transparent">
                <div className="absolute top-0 right-0 w-36 h-36 bg-[#00ad74]/8 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />
                <div className="relative px-5 py-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#00ad74]/50 mb-0.5">
                        Available Earnings
                      </p>
                      <p
                        className="font-['Inter',sans-serif] font-black text-[#00ad74] leading-none tabular-nums"
                        style={{ fontSize: 'clamp(2rem, 10vw, 3rem)' }}
                      >
                        ${(userProfile?.total_earnings ?? 0).toFixed(2)}
                      </p>
                      {admobRevenueStatus && !admobRevenueStatus.ready && (userProfile?.total_earnings ?? 0) === 0 && (
                        <p className="text-[11px] text-white/40 mt-2 leading-tight">
                          {admobRevenueStatus.message || 'Earnings will appear once confirmed with our ad partner'}
                        </p>
                      )}
                      {admobRevenueStatus && !admobRevenueStatus.ready && (userProfile?.total_earnings ?? 0) > 0 && (
                        <p className="text-[11px] text-white/40 mt-2 leading-tight">
                          Ad earnings pending confirmation. Converted Treats and other balance can be withdrawn.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 pt-1">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3 text-[#00ad74]/50" />
                        <p className="text-[10px] text-white/30 font-semibold">Min. $10</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-[#00ad74]/50" />
                        <p className="text-[10px] text-white/30 font-semibold">1–3 business days</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <ContributionScoreWidget userId={user?.id} />

              <button
                onClick={() => navigate('/withdraw-earnings')}
                disabled={(userProfile?.total_earnings || 0) < 10}
                className="w-full min-h-[48px] bg-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-bold text-black transition-all active:scale-[0.98]"
              >
                Withdraw Earnings
              </button>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60 mb-3 px-1">
                  Users Withdrawal History
                </p>
                <p className="text-white/50 text-[11px] mb-3 px-1">
                  History is automatically deleted every 45 days.
                </p>
                {isLoadingWithdrawalHistory ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
                    ))}
                  </div>
                ) : withdrawalHistory.length === 0 ? (
                  <p className="text-white/60 text-sm px-1">No withdrawal history yet.</p>
                ) : (
                  <div className="space-y-2">
                    {withdrawalHistory.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-white/90 text-sm font-semibold">
                              {formatWithdrawalAmount(row)}
                            </p>
                            <p className="text-white/50 text-[11px]">
                              {formatWithdrawalDate(row.requested_date)}
                              {row.method_type ? ` • ${row.method_type === 'usdt_wallet' ? 'USDT Wallet' : 'Bank'}` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] uppercase tracking-wide text-white/70">{row.status}</p>
                            {row.payment_reference ? (
                              <p className="text-[10px] text-white/40">Ref: {row.payment_reference}</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Analytics Tab - Only visible for creators/artists, not listeners */}
          {activeTab === 'analytics' && userProfile?.role === 'creator' && (
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
