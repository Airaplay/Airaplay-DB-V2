import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, HelpCircle, BarChart, Settings, LogOut, ChevronRight, Home, DollarSign, BarChart2, Bell, UserCog, Zap, Image, Coins, Wallet, Calendar, UserPlus, Megaphone, Flag, Star, Music, Tags, Sparkles, ListMusic, Shield, Award, Trophy, TrendingUp, Activity, Gift, Globe, BookOpen } from 'lucide-react';
import { supabase, getUserRole } from '../../lib/supabase';
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
import { AdminNotificationBell } from '../../components/AdminNotificationBell';
import { SupportTicketsSection } from './SupportTicketsSection';
import { BlogManagementSection } from './BlogManagementSection';

type SectionType = 'users' | 'content' | 'faqs' | 'analytics' | 'country_performance' | 'settings' | 'earnings' | 'analysis' | 'announcements' | 'admin_settings' | 'ad_management' | 'native_ads' | 'feature_banners' | 'treat_manager' | 'daily_checkin' | 'referral_management' | 'promotion_manager' | 'reports' | 'featured_artists' | 'mix_manager' | 'daily_mix_manager' | 'genre_manager' | 'payment_monitoring' | 'mood_analysis' | 'listener_curations' | 'contribution_rewards' | 'content_thresholds' | 'financial_controls' | 'promotional_credits' | 'support' | 'blog';

export const AdminDashboardScreen = (): JSX.Element => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SectionType>('analytics');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    setRenderError(null);
  }, [activeSection]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const checkAdminAccess = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if user is authenticated
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError || !session) {
        if (authError) {
          console.error('Authentication error:', authError);
        } else {
          console.log('No active user session found');
        }
        setError('You must be signed in to access this page');
        navigate('/admin/login');
        return;
      }

      // Get user role
      const role = await getUserRole();
      setUserRole(role);

      // Check if user is an admin
      if (role !== 'admin' && role !== 'manager' && role !== 'editor' && role !== 'account') {
        setError('You do not have permission to access the admin dashboard');
        navigate('/admin/login');
        return;
      }

      // Get user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (userError) {
        console.error('Error fetching user profile:', userError);
      } else {
        setUserProfile(userData);
      }
    } catch (err) {
      console.error('Error checking admin access:', err);
      setError('An error occurred while checking permissions');
      navigate('/admin/login');
    } finally {
      setIsLoading(false);
    }
  };

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

  const renderSection = () => {
    try {
      switch (activeSection) {
        case 'users':
          return <UserManagementSection />;
        case 'content':
          return <ContentManagementSection />;
        case 'faqs':
          return <FaqManagementSection />;
        case 'analytics':
          return <AnalyticsOverviewSection />;
        case 'country_performance':
          return <CountryPerformanceSection />;
        case 'earnings':
          return <EarningsPayoutSettingsSection />;
        case 'support':
          return <SupportTicketsSection />;
        case 'blog':
          return <BlogManagementSection />;
        case 'analysis':
          return <AnalysisSection />;
        case 'announcements':
          return <AnnouncementsSection />;
        case 'admin_settings':
          return <AdminSettingsSection />;
        case 'ad_management':
          return <AdManagementSection />;
        case 'native_ads':
          return <NativeAdsSection />;
        case 'feature_banners':
          return <FeatureBannerSection />;
        case 'treat_manager':
          return <TreatManagerSection />;
        case 'daily_checkin':
          return <DailyCheckinSection />;
        case 'referral_management':
          return <ReferralManagementSection />;
        case 'promotion_manager':
          return <PromotionManagerSection />;
        case 'reports':
          return <ReportManagementSection />;
        case 'featured_artists':
          return <FeaturedArtistsSection />;
        case 'mix_manager':
          return <MixManagerSection />;
        case 'daily_mix_manager':
          return <DailyMixManagerSection />;
        case 'genre_manager':
          return <GenreManagerSection />;
        case 'mood_analysis':
          return <MoodAnalysisSection />;
        case 'payment_monitoring':
          return <PaymentMonitoringSection />;
        case 'listener_curations':
          return <ListenerCurationsSection />;
        case 'contribution_rewards':
          return <ContributionRewardsSection />;
        case 'content_thresholds':
          return <ContentSectionThresholdsManager />;
        case 'financial_controls':
          return <FinancialControlsSection />;
        case 'promotional_credits':
          return <PromotionalCreditsSection />;
        case 'settings':
          return (
            <div className="p-6 bg-white rounded-lg shadow">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Settings</h2>
              <p className="text-gray-700">Admin settings will be implemented in a future update.</p>
            </div>
          );
        default:
          return <AnalyticsOverviewSection />;
      }
    } catch (error) {
      console.error('Error rendering section:', error);
      return (
        <div className="p-6 bg-white rounded-lg shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-500 font-bold">!</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Section Error</h2>
          </div>
          <p className="text-gray-700 mb-4">
            An error occurred while loading this section: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <button
            onClick={() => setActiveSection('analytics')}
            className="px-4 py-2 bg-[#309605] text-white rounded-lg hover:bg-[#3ba208] transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      );
    }
  };

  // Check if user has access to a specific section based on their role
  const hasAccessToSection = (section: SectionType): boolean => {
    if (userRole === 'admin') return true; // Admins have access to everything

    if (userRole === 'manager') {
      // Managers can access everything except admin settings, financial controls, and country performance
      return section !== 'admin_settings' && section !== 'treat_manager' && section !== 'payment_monitoring' && section !== 'financial_controls' && section !== 'promotional_credits' && section !== 'country_performance';
    }

    if (userRole === 'editor') {
      // Editors can only access content, FAQs, and blog
      return ['content', 'faqs', 'blog'].includes(section);
    }

    if (userRole === 'account') {
      // Account role can only access financial/accounting sections
      return [
        'analytics',
        'earnings',
        'support',
        'payment_monitoring',
        'financial_controls',
        'promotional_credits',
        'treat_manager',
        'country_performance'
      ].includes(section);
    }

    return false;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#309605]"></div>
        <p className="ml-4 text-gray-900 font-medium">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-red-500 text-2xl">!</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-700 mb-6 text-center">{error}</p>
        <button
          onClick={() => navigate('/admin/login')}
          className="px-4 py-2 bg-[#309605] text-white rounded-lg hover:bg-[#3ba208] transition-colors"
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#309605] mx-auto mb-4"></div>
          <p className="text-gray-900 font-medium">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Fixed on desktop, sliding on mobile */}
      <div className={`
        w-64 h-screen bg-white border-r border-gray-200 flex flex-col fixed z-50
        transition-transform duration-300 ease-in-out
        ${isMobile ? (sidebarOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
      `}>
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <img
            src="/official_airaplay_logo.png"
            alt="Airaplay Admin"
            className="h-8 object-contain"
          />
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {hasAccessToSection('analytics') && (
              <li>
                <button
                  onClick={() => setActiveSection('analytics')}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'analytics'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <BarChart className="w-5 h-5 mr-3" />
                    <span>Dashboard</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('country_performance') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('country_performance');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'country_performance'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Globe className="w-5 h-5 mr-3" />
                    <span>Country Performance</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('analysis') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('analysis');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'analysis' 
                      ? 'bg-[#309605] text-white' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <BarChart2 className="w-5 h-5 mr-3" />
                    <span>Analysis</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}
            
            {hasAccessToSection('users') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('users');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'users'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Users className="w-5 h-5 mr-3" />
                    <span>Users</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}
            
            {hasAccessToSection('content') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('content');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'content' 
                      ? 'bg-[#309605] text-white' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 mr-3" />
                    <span>Content</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('content_thresholds') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('content_thresholds');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'content_thresholds'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Tags className="w-5 h-5 mr-3" />
                    <span>Section Thresholds</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('feature_banners') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('feature_banners');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'feature_banners' 
                      ? 'bg-[#309605] text-white' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Image className="w-5 h-5 mr-3" />
                    <span>Feature Banners</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}
            
            {hasAccessToSection('treat_manager') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('treat_manager');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'treat_manager'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Coins className="w-5 h-5 mr-3" />
                    <span>Treat Manager</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('payment_monitoring') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('payment_monitoring');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'payment_monitoring'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <DollarSign className="w-5 h-5 mr-3" />
                    <span>Payment Monitoring</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}
            
            {hasAccessToSection('announcements') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('announcements');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'announcements' 
                      ? 'bg-[#309605] text-white' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Bell className="w-5 h-5 mr-3" />
                    <span>Announcements</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}
            
            {hasAccessToSection('earnings') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('earnings');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'earnings'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <DollarSign className="w-5 h-5 mr-3" />
                    <span>Earnings/Payouts</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('financial_controls') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('financial_controls');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'financial_controls'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Shield className="w-5 h-5 mr-3" />
                    <span>Financial Controls</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('promotional_credits') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('promotional_credits');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'promotional_credits'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Gift className="w-5 h-5 mr-3" />
                    <span>Promotional Credits</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('ad_management') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('ad_management');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'ad_management' 
                      ? 'bg-[#309605] text-white' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Zap className="w-5 h-5 mr-3" />
                    <span>Ad Management</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}
            
            {hasAccessToSection('native_ads') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('native_ads');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'native_ads'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Image className="w-5 h-5 mr-3" />
                    <span>Native Ads</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}
            
            {hasAccessToSection('faqs') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('faqs');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'faqs' 
                      ? 'bg-[#309605] text-white' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <HelpCircle className="w-5 h-5 mr-3" />
                    <span>FAQs</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('blog') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('blog');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'blog'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <BookOpen className="w-5 h-5 mr-3" />
                    <span>Blog</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}
            
            {hasAccessToSection('daily_checkin') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('daily_checkin');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'daily_checkin'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Calendar className="w-5 h-5 mr-3" />
                    <span>Daily Check-in</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('referral_management') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('referral_management');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'referral_management'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <UserPlus className="w-5 h-5 mr-3" />
                    <span>Referral Management</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('promotion_manager') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('promotion_manager');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'promotion_manager'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Megaphone className="w-5 h-5 mr-3" />
                    <span>Promotion Manager</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('reports') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('reports');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'reports'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Flag className="w-5 h-5 mr-3" />
                    <span>Reports</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('featured_artists') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('featured_artists');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'featured_artists'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Star className="w-5 h-5 mr-3" />
                    <span>Featured Artists</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('listener_curations') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('listener_curations');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'listener_curations'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Users className="w-5 h-5 mr-3" />
                    <span>Listener Curations</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('contribution_rewards') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('contribution_rewards');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'contribution_rewards'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Award className="w-5 h-5 mr-3" />
                    <span>Contribution System</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('mix_manager') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('mix_manager');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'mix_manager'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Music className="w-5 h-5 mr-3" />
                    <span>Mix Manager</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('daily_mix_manager') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('daily_mix_manager');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'daily_mix_manager'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Sparkles className="w-5 h-5 mr-3" />
                    <span>Daily Mix AI</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('genre_manager') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('genre_manager');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'genre_manager'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Tags className="w-5 h-5 mr-3" />
                    <span>Genre Manager</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('admin_settings') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('admin_settings');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'admin_settings'
                      ? 'bg-[#309605] text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <UserCog className="w-5 h-5 mr-3" />
                    <span>Admin Settings</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}

            {hasAccessToSection('settings') && (
              <li>
                <button
                  onClick={() => {
                    setActiveSection('settings');
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                    activeSection === 'settings' 
                      ? 'bg-[#309605] text-white' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center">
                    <Settings className="w-5 h-5 mr-3" />
                    <span>Settings</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </li>
            )}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-3">
              {userProfile?.avatar_url ? (
                <img 
                  src={userProfile.avatar_url} 
                  alt="Profile" 
                  className="w-full h-full rounded-full object-cover" 
                />
              ) : (
                <span className="text-gray-700 font-semibold">
                  {userProfile?.display_name?.charAt(0) || 'A'}
                </span>
              )}
            </div>
            <div>
              <p className="text-gray-900 font-medium">{userProfile?.display_name || 'Admin User'}</p>
              <p className="text-xs text-gray-600">{userProfile?.email || ''}</p>
            </div>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <Home className="w-4 h-4 mr-2" />
              <span>Back to App</span>
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Responsive width */}
      <div className={`flex-1 flex flex-col overflow-auto ${isMobile ? 'ml-0' : 'ml-64'}`}>
        {/* Header with Notification Bell and Mobile Menu Button */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 md:px-6 py-4">
          <div className="max-w-[1200px] w-full flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                {activeSection === 'analytics' && 'Dashboard Overview'}
                {activeSection === 'users' && 'User Management'}
                {activeSection === 'content' && 'Content Management'}
                {activeSection === 'faqs' && 'FAQs'}
                {activeSection === 'blog' && 'Blog'}
                {activeSection === 'earnings' && 'Earnings & Payouts'}
                {activeSection === 'support' && 'Withdrawal Requests & Support'}
                {activeSection === 'payment_monitoring' && 'Payment Monitoring'}
                {activeSection === 'reports' && 'Reports & Flagged Content'}
                {activeSection === 'admin_settings' && 'Admin Settings'}
                {activeSection === 'financial_controls' && 'Financial Controls'}
              </h1>
            </div>
            <AdminNotificationBell onNavigateToSection={(section) => setActiveSection(section as SectionType)} />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-4 md:p-6">
          <div className="max-w-[1200px] w-full">
          {renderError ? (
            <div className="p-6 bg-white rounded-lg shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-500 font-bold">!</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Section Error</h2>
              </div>
              <p className="text-gray-700 mb-4">{renderError}</p>
              <button
                onClick={() => {
                  setRenderError(null);
                  setActiveSection('analytics');
                }}
                className="px-4 py-2 bg-[#309605] text-white rounded-lg hover:bg-[#3ba208] transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            <ErrorBoundary
              key={activeSection}
              fallback={(error, resetError) => (
                <div className="p-6 bg-white rounded-lg shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-red-500 font-bold">!</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Section Error</h2>
                  </div>
                  <p className="text-gray-700 mb-4">
                    An error occurred while loading the {activeSection} section: {error.message}
                  </p>
                  <div className="space-x-2">
                    <button
                      onClick={resetError}
                      className="px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={() => setActiveSection('analytics')}
                      className="px-4 py-2 bg-[#309605] text-white rounded-lg hover:bg-[#3ba208] transition-colors"
                    >
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
        </div>
      </div>
    </div>
  );
};
