import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, HelpCircle, BarChart, Settings, LogOut, Home, DollarSign, BarChart2, Bell, UserCog, Zap, Image, Coins, Wallet, Calendar, UserPlus, Megaphone, Flag, Star, Music, Tags, Sparkles, ListMusic, Shield, Award, Trophy, TrendingUp, Activity, Gift, Globe, Monitor, ChevronDown, ChevronRight, Menu, X, BookOpen, ScrollText } from 'lucide-react';
import { supabase, getUserRole } from '../../lib/supabase';
import { cacheInvalidation } from '../../lib/enhancedDataFetching';
import { performCompleteLogout } from '../../lib/logoutService';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { UserManagementSection } from './UserManagementSection';
import { ContentManagementSection } from './ContentManagementSection';
import { FaqManagementSection } from './FaqManagementSection';
import { AnalyticsOverviewSection } from './AnalyticsOverviewSection';
import { CountryPerformanceSection } from './CountryPerformanceSection';
import { EarningsPayoutSettingsSection } from './EarningsPayoutSettingsSection';
import { AnalysisSection } from './AnalysisSection';
import { AnnouncementsSection } from './AnnouncementsSection';
import { AdminSettingsSection } from './AdminSettingsSection';
import { AdManagementSection } from './AdManagementSection';
import { FeatureBannerSection } from './FeatureBannerSection';
import { TreatManagerSection } from './TreatManagerSection';
import { DailyCheckinSection } from './DailyCheckinSection';
import { ReferralManagementSection } from './ReferralManagementSection';
import { PromotionManagerSection } from './PromotionManagerSection';
import { ReportManagementSection } from './ReportManagementSection';
import { FeaturedArtistsSection } from './FeaturedArtistsSection';
import { MixManagerSection } from './MixManagerSection';
import { GenreManagerSection } from './GenreManagerSection';
import { PaymentMonitoringSection } from './PaymentMonitoringSection';
import { NativeAdsSection } from './NativeAdsSection';
import { MoodAnalysisSection } from './MoodAnalysisSection';
import { ListenerCurationsSection } from './ListenerCurationsSection';
import { ContributionRewardsSection } from './ContributionRewardsSection';
import { ContentSectionThresholdsManager } from './ContentSectionThresholdsManager';
import { FinancialControlsSection } from './FinancialControlsSection';
import { PromotionalCreditsSection } from './PromotionalCreditsSection';
import { DailyMixManagerSection } from './DailyMixManagerSection';
import { GlobalDailyMixManagerSection } from './GlobalDailyMixManagerSection';
import { AdminNotificationBell } from '../../components/AdminNotificationBell';
import { SupportTicketsSection } from './SupportTicketsSection';
import { WebAdsSection } from './WebAdsSection';
import { BlogManagementSection } from './BlogManagementSection';
import { AccountingSection } from './AccountingSection';
import { ArtistEarningsLedgerSection } from './ArtistEarningsLedgerSection';

type SectionType = 'users' | 'content' | 'faqs' | 'analytics' | 'country_performance' | 'settings' | 'earnings' | 'analysis' | 'announcements' | 'admin_settings' | 'ad_management' | 'native_ads' | 'web_ads' | 'feature_banners' | 'treat_manager' | 'daily_checkin' | 'referral_management' | 'promotion_manager' | 'reports' | 'featured_artists' | 'mix_manager' | 'daily_mix_manager' | 'global_daily_mix_manager' | 'genre_manager' | 'payment_monitoring' | 'mood_analysis' | 'listener_curations' | 'contribution_rewards' | 'content_thresholds' | 'financial_controls' | 'promotional_credits' | 'support' | 'blog' | 'accounting' | 'artist_earnings_ledger';

const ADMIN_ROLES = ['admin', 'manager', 'editor', 'account'];

const getDeviceInfo = () => ({
  userAgent: navigator.userAgent || '',
});

interface NavGroup {
  label: string;
  items: { section: SectionType; label: string; icon: React.ReactNode }[];
}

const getSectionLabel = (section: SectionType): string => {
  const labels: Partial<Record<SectionType, string>> = {
    analytics: 'Dashboard',
    users: 'User Management',
    content: 'Content Management',
    earnings: 'Earnings & Payouts',
    support: 'Support & Withdrawals',
    payment_monitoring: 'Payment Monitoring',
    reports: 'Reports',
    admin_settings: 'Admin Settings',
    financial_controls: 'Financial Controls',
    web_ads: 'Web Ads',
    country_performance: 'Country Performance',
    analysis: 'Ad Analysis',
    content_thresholds: 'Section Thresholds',
    feature_banners: 'Feature Banners',
    treat_manager: 'Treat Manager',
    daily_checkin: 'Daily Check-in',
    referral_management: 'Referral Management',
    promotion_manager: 'Promotions',
    featured_artists: 'Featured Artists',
    listener_curations: 'Listener Curations',
    contribution_rewards: 'Contribution System',
    mix_manager: 'Mix Manager',
    daily_mix_manager: 'Daily Mix AI',
    global_daily_mix_manager: 'Global Daily Mix',
    genre_manager: 'Genre Manager',
    native_ads: 'Native Ads',
    ad_management: 'Ad Management',
    announcements: 'Announcements',
    faqs: 'FAQs',
    blog: 'Blog',
      accounting: 'Accounting',
    artist_earnings_ledger: 'Artist Earnings Ledger',
    mood_analysis: 'Mood Analysis',
    promotional_credits: 'Promo Credits',
    settings: 'Settings',
  };
  return labels[section] || section;
};

export const AdminDashboardScreen = (): JSX.Element => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SectionType>('analytics');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1025);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    overview: true,
    users: true,
    content: false,
    monetization: false,
    advertising: false,
    engagement: false,
    system: false,
  });
  const lastRoleCheckRef = useRef<number>(0);
  const ROLE_RECHECK_INTERVAL = 5 * 60 * 1000;

  const logAdminAction = useCallback(async (actionType: string, details: Record<string, unknown> = {}) => {
    try {
      const { userAgent } = getDeviceInfo();
      await supabase.rpc('log_admin_activity_with_context', {
        action_type_param: actionType,
        details_param: details,
        ip_address_param: '',
        user_agent_param: userAgent,
      });
    } catch {
      // Non-critical
    }
  }, []);

  const reVerifyRole = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return false;

      const { data, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (roleError || !data) return false;

      const freshRole = data.role ?? null;

      if (!ADMIN_ROLES.includes(freshRole ?? '')) {
        await cacheInvalidation.byTags(['user', 'auth']);
        navigate('/admin/login');
        return false;
      }

      setUserRole(freshRole);
      lastRoleCheckRef.current = Date.now();
      return true;
    } catch {
      return false;
    }
  }, [navigate]);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    setRenderError(null);
  }, [activeSection]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1025);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const checkAdminAccess = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError || !session) {
        if (authError) console.error('Authentication error:', authError);
        setError('You must be signed in to access this page');
        navigate('/admin/login');
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (userError || !userData) {
        setError('Unable to verify your account');
        navigate('/admin/login');
        return;
      }

      const role = userData.role ?? null;

      if (!ADMIN_ROLES.includes(role ?? '')) {
        setError('You do not have permission to access the admin dashboard');
        navigate('/admin/login');
        return;
      }

      setUserRole(role);
      setUserProfile(userData);
      lastRoleCheckRef.current = Date.now();
    } catch (err) {
      console.error('Error checking admin access:', err);
      setError('An error occurred while checking permissions');
      navigate('/admin/login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSectionChange = useCallback(async (section: SectionType) => {
    const now = Date.now();
    if (now - lastRoleCheckRef.current > ROLE_RECHECK_INTERVAL) {
      const stillValid = await reVerifyRole();
      if (!stillValid) return;
    }
    setActiveSection(section);
    setSidebarOpen(false);
    logAdminAction('view_section', { section });
  }, [reVerifyRole, logAdminAction, ROLE_RECHECK_INTERVAL]);

  const handleSignOut = async () => {
    try {
      setUserRole(null);
      setUserProfile(null);
      await performCompleteLogout();
      navigate('/admin/login', { replace: true });
    } catch (error) {
      console.error('Error signing out:', error);
      setUserRole(null);
      setUserProfile(null);
      navigate('/admin/login', { replace: true });
    }
  };

  const hasAccessToSection = (section: SectionType): boolean => {
    if (userRole === 'admin') return true;
    if (userRole === 'manager') {
      return section !== 'admin_settings' && section !== 'treat_manager' && section !== 'payment_monitoring' && section !== 'financial_controls' && section !== 'promotional_credits' && section !== 'country_performance';
    }
    if (userRole === 'editor') {
      return ['content', 'faqs', 'blog'].includes(section);
    }
    if (userRole === 'account') {
      return ['analytics', 'earnings', 'support', 'payment_monitoring', 'financial_controls', 'promotional_credits', 'treat_manager', 'country_performance', 'accounting', 'artist_earnings_ledger'].includes(section);
    }
    return false;
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const renderSection = () => {
    try {
      switch (activeSection) {
        case 'users': return <UserManagementSection />;
        case 'content': return <ContentManagementSection />;
        case 'faqs': return <FaqManagementSection />;
        case 'blog': return <BlogManagementSection />;
        case 'analytics': return <AnalyticsOverviewSection />;
        case 'country_performance': return <CountryPerformanceSection />;
        case 'earnings': return <EarningsPayoutSettingsSection />;
        case 'support': return <SupportTicketsSection />;
        case 'analysis': return <AnalysisSection />;
        case 'announcements': return <AnnouncementsSection />;
        case 'admin_settings': return <AdminSettingsSection />;
        case 'ad_management': return <AdManagementSection />;
        case 'native_ads': return <NativeAdsSection />;
        case 'web_ads': return <WebAdsSection />;
        case 'feature_banners': return <FeatureBannerSection />;
        case 'treat_manager': return <TreatManagerSection />;
        case 'daily_checkin': return <DailyCheckinSection />;
        case 'referral_management': return <ReferralManagementSection />;
        case 'promotion_manager': return <PromotionManagerSection />;
        case 'reports': return <ReportManagementSection />;
        case 'featured_artists': return <FeaturedArtistsSection />;
        case 'mix_manager': return <MixManagerSection />;
        case 'daily_mix_manager': return <DailyMixManagerSection />;
        case 'global_daily_mix_manager': return <GlobalDailyMixManagerSection />;
        case 'genre_manager': return <GenreManagerSection />;
        case 'mood_analysis': return <MoodAnalysisSection />;
        case 'payment_monitoring': return <PaymentMonitoringSection />;
        case 'listener_curations': return <ListenerCurationsSection />;
        case 'contribution_rewards': return <ContributionRewardsSection />;
        case 'content_thresholds': return <ContentSectionThresholdsManager />;
        case 'financial_controls': return <FinancialControlsSection />;
        case 'promotional_credits': return <PromotionalCreditsSection />;
        case 'accounting': return <AccountingSection />;
        case 'artist_earnings_ledger': return <ArtistEarningsLedgerSection />;
        case 'settings':
          return (
            <div className="p-6 bg-white rounded-xl border border-gray-100 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Settings</h2>
              <p className="text-gray-500">Admin settings will be implemented in a future update.</p>
            </div>
          );
        default: return <AnalyticsOverviewSection />;
      }
    } catch (error) {
      console.error('Error rendering section:', error);
      return (
        <div className="p-6 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
              <span className="text-red-500 font-bold">!</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Section Error</h2>
          </div>
          <p className="text-gray-500 mb-4">
            An error occurred: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <button
            onClick={() => handleSectionChange('analytics')}
            className="px-4 py-2 bg-[#309605] text-white rounded-lg hover:bg-[#3ba208] transition-colors text-sm font-medium"
          >
            Go to Dashboard
          </button>
        </div>
      );
    }
  };

  const NavItem = ({ section, icon, label }: { section: SectionType; icon: React.ReactNode; label: string }) => {
    if (!hasAccessToSection(section)) return null;
    const isActive = activeSection === section;
    return (
      <button
        onClick={() => handleSectionChange(section)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
          isActive
            ? 'bg-[#309605] text-white font-medium shadow-sm'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
      >
        <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`}>{icon}</span>
        <span className="truncate">{label}</span>
      </button>
    );
  };

  const NavGroup = ({ groupKey, label, children }: { groupKey: string; label: string; children: React.ReactNode }) => (
    <div className="mb-1">
      <button
        onClick={() => toggleGroup(groupKey)}
        className="w-full flex items-center justify-between px-3 py-1.5 mb-1"
      >
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{label}</span>
        {expandedGroups[groupKey]
          ? <ChevronDown className="w-3 h-3 text-gray-400" />
          : <ChevronRight className="w-3 h-3 text-gray-400" />
        }
      </button>
      {expandedGroups[groupKey] && (
        <div className="space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#309605] border-t-transparent"></div>
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4 border border-red-100">
          <span className="text-red-500 text-2xl font-bold">!</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-500 mb-6 text-center text-sm max-w-sm">{error}</p>
        <button
          onClick={() => navigate('/admin/login')}
          className="px-5 py-2.5 bg-[#309605] text-white rounded-lg hover:bg-[#3ba208] transition-colors text-sm font-medium"
        >
          Go to Login
        </button>
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#309605] border-t-transparent mx-auto mb-3"></div>
          <p className="text-gray-600 font-medium text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout flex h-screen overflow-hidden bg-gray-50 w-full">
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-[220px] h-screen bg-white border-r border-gray-100 flex flex-col fixed z-50
        transition-transform duration-300 ease-in-out
        ${isMobile ? (sidebarOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <img src="/Black_logo.fw.png" alt="Airaplay Admin" className="h-9 object-contain" />
          {isMobile && (
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
          <NavGroup groupKey="overview" label="Overview">
            <NavItem section="analytics" icon={<BarChart className="w-4 h-4" />} label="Dashboard" />
            <NavItem section="country_performance" icon={<Globe className="w-4 h-4" />} label="Country Performance" />
            <NavItem section="analysis" icon={<BarChart2 className="w-4 h-4" />} label="Ad Analysis" />
          </NavGroup>

          <NavGroup groupKey="users" label="Users & Content">
            <NavItem section="users" icon={<Users className="w-4 h-4" />} label="Users" />
            <NavItem section="content" icon={<FileText className="w-4 h-4" />} label="Content" />
            <NavItem section="content_thresholds" icon={<Tags className="w-4 h-4" />} label="Section Thresholds" />
            <NavItem section="featured_artists" icon={<Star className="w-4 h-4" />} label="Featured Artists" />
            <NavItem section="reports" icon={<Flag className="w-4 h-4" />} label="Reports" />
          </NavGroup>

          <NavGroup groupKey="monetization" label="Monetization">
            <NavItem section="earnings" icon={<DollarSign className="w-4 h-4" />} label="Earnings & Payouts" />
            <NavItem section="artist_earnings_ledger" icon={<ScrollText className="w-4 h-4" />} label="Artist Earnings Ledger" />
            <NavItem section="support" icon={<Wallet className="w-4 h-4" />} label="Support & Withdrawals" />
            <NavItem section="payment_monitoring" icon={<Activity className="w-4 h-4" />} label="Payment Monitoring" />
            <NavItem section="financial_controls" icon={<Shield className="w-4 h-4" />} label="Financial Controls" />
            <NavItem section="accounting" icon={<BookOpen className="w-4 h-4" />} label="Accounting" />
            <NavItem section="treat_manager" icon={<Coins className="w-4 h-4" />} label="Treat Manager" />
            <NavItem section="promotional_credits" icon={<Gift className="w-4 h-4" />} label="Promo Credits" />
          </NavGroup>

          <NavGroup groupKey="advertising" label="Advertising">
            <NavItem section="ad_management" icon={<Zap className="w-4 h-4" />} label="Ad Management" />
            <NavItem section="native_ads" icon={<Image className="w-4 h-4" />} label="Native Ads" />
            <NavItem section="web_ads" icon={<Monitor className="w-4 h-4" />} label="Web Ads" />
            <NavItem section="feature_banners" icon={<Image className="w-4 h-4" />} label="Feature Banners" />
          </NavGroup>

          <NavGroup groupKey="engagement" label="Engagement">
            <NavItem section="promotion_manager" icon={<Megaphone className="w-4 h-4" />} label="Promotions" />
            <NavItem section="listener_curations" icon={<ListMusic className="w-4 h-4" />} label="Listener Curations" />
            <NavItem section="contribution_rewards" icon={<Award className="w-4 h-4" />} label="Contribution System" />
            <NavItem section="daily_checkin" icon={<Calendar className="w-4 h-4" />} label="Daily Check-in" />
            <NavItem section="referral_management" icon={<UserPlus className="w-4 h-4" />} label="Referrals" />
            <NavItem section="announcements" icon={<Bell className="w-4 h-4" />} label="Announcements" />
          </NavGroup>

          <NavGroup groupKey="system" label="System">
            <NavItem section="mix_manager" icon={<Music className="w-4 h-4" />} label="Mix Manager" />
            <NavItem section="daily_mix_manager" icon={<Sparkles className="w-4 h-4" />} label="Daily Mix AI" />
            <NavItem section="global_daily_mix_manager" icon={<Globe className="w-4 h-4" />} label="Global Daily Mix" />
            <NavItem section="genre_manager" icon={<Tags className="w-4 h-4" />} label="Genre Manager" />
            <NavItem section="mood_analysis" icon={<TrendingUp className="w-4 h-4" />} label="Mood Analysis" />
            <NavItem section="faqs" icon={<HelpCircle className="w-4 h-4" />} label="FAQs" />
            <NavItem section="blog" icon={<BookOpen className="w-4 h-4" />} label="Blog" />
            <NavItem section="admin_settings" icon={<UserCog className="w-4 h-4" />} label="Admin Settings" />
          </NavGroup>
        </nav>

        {/* User Footer */}
        <div className="px-3 py-3 border-t border-gray-100">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#e6f7f1] flex items-center justify-center flex-shrink-0">
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-[#309605] text-sm font-semibold">
                  {userProfile?.display_name?.charAt(0) || 'A'}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-gray-900 font-medium text-sm truncate">{userProfile?.display_name || 'Admin'}</p>
              <p className="text-xs text-gray-400 truncate capitalize">{userRole}</p>
            </div>
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors text-sm"
            >
              <Home className="w-4 h-4" />
              <span>Back to App</span>
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col overflow-hidden ${isMobile ? 'ml-0' : 'ml-[220px]'}`}>
        {/* Top Header */}
        <header className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Menu className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <div>
                <h1 className="text-base font-semibold text-gray-900 leading-tight">
                  {getSectionLabel(activeSection)}
              </h1>
                <p className="text-xs text-gray-400 leading-tight">Airaplay Admin</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AdminNotificationBell onNavigateToSection={(section) => handleSectionChange(section as SectionType)} />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="p-6 w-full min-h-full">
          {renderError ? (
              <div className="p-6 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                  <span className="text-red-500 font-bold">!</span>
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">Section Error</h2>
                </div>
                <p className="text-gray-500 mb-4 text-sm">{renderError}</p>
              <button
                  onClick={() => { setRenderError(null); handleSectionChange('analytics'); }}
                  className="px-4 py-2 bg-[#309605] text-white rounded-lg hover:bg-[#3ba208] transition-colors text-sm font-medium"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <ErrorBoundary
              key={activeSection}
              fallback={(error, resetError) => (
                  <div className="p-6 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                      <span className="text-red-500 font-bold">!</span>
                      </div>
                      <h2 className="text-lg font-bold text-gray-900">Section Error</h2>
                    </div>
                    <p className="text-gray-500 mb-4 text-sm">
                      Failed to load {activeSection}: {error.message}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={resetError} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                      Try Again
                    </button>
                      <button onClick={() => handleSectionChange('analytics')} className="px-4 py-2 bg-[#309605] text-white rounded-lg hover:bg-[#3ba208] transition-colors text-sm font-medium">
                      Go to Dashboard
                    </button>
                  </div>
                </div>
              )}
            >
              {renderSection()}
            </ErrorBoundary>
          )}
          </div>
        </main>
      </div>
    </div>
  );
};
