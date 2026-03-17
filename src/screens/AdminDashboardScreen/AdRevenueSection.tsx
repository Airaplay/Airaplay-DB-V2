import { useState, useEffect } from 'react';
import {
  DollarSign,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
  Upload,
  Lock,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Shield,
  Activity,
  Link2,
  Settings,
  Play,
  Wifi,
  WifiOff,
  History,
  Key
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { adRevenueService } from '../../lib/adRevenueService';
import { format } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';

interface DailyRevenueInput {
  id: string;
  revenue_date: string;
  total_revenue_usd: number;
  banner_revenue: number;
  interstitial_revenue: number;
  rewarded_revenue: number;
  native_revenue: number;
  safety_buffer_percentage: number;
  is_locked: boolean;
  notes: string | null;
  created_at: string;
}

interface ReconciliationLog {
  id: string;
  reconciliation_date: string;
  estimated_total_payout_usd: number;
  actual_admob_revenue_usd: number;
  variance_usd: number;
  variance_percentage: number;
  adjustment_factor: number;
  reconciliation_status: string;
  total_impressions_reconciled: number;
  total_users_affected: number;
  created_at: string;
}

interface AdMobApiConfig {
  id: string;
  publisher_id: string;
  account_name: string | null;
  auth_type: 'service_account' | 'oauth2';
  service_account_email: string | null;
  auto_sync_enabled: boolean;
  sync_frequency_hours: number;
  last_sync_at: string | null;
  next_sync_at: string | null;
  sync_days_back: number;
  apply_safety_buffer: boolean;
  default_safety_buffer_percentage: number;
  connection_status: 'disconnected' | 'connected' | 'error' | 'syncing';
  last_error: string | null;
  is_active: boolean;
  created_at: string;
}

interface AdMobSyncHistory {
  id: string;
  sync_type: string;
  sync_status: string;
  date_range_start: string;
  date_range_end: string;
  records_fetched: number;
  records_processed: number;
  total_revenue_fetched: number;
  banner_revenue: number;
  interstitial_revenue: number;
  rewarded_revenue: number;
  native_revenue: number;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  created_at: string;
}

export const AdRevenueSection = (): JSX.Element => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [revenueEvents, setRevenueEvents] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<any>(null);
  const [isDistributingCreatorPool, setIsDistributingCreatorPool] = useState(false);
  const [creatorPoolDistributionResult, setCreatorPoolDistributionResult] = useState<any>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');

  const [dailyRevenueInputs, setDailyRevenueInputs] = useState<DailyRevenueInput[]>([]);
  const [reconciliationLogs, setReconciliationLogs] = useState<ReconciliationLog[]>([]);
  const [isLoadingInputs, setIsLoadingInputs] = useState(false);
  const [isLoadingReconciliation, setIsLoadingReconciliation] = useState(false);

  const [showInputForm, setShowInputForm] = useState(false);
  const [isSubmittingInput, setIsSubmittingInput] = useState(false);
  const [newRevenueInput, setNewRevenueInput] = useState({
    revenue_date: format(new Date(), 'yyyy-MM-dd'),
    total_revenue_usd: '',
    banner_revenue: '',
    interstitial_revenue: '',
    rewarded_revenue: '',
    native_revenue: '',
    safety_buffer_percentage: '75',
    notes: ''
  });

  const [admobConfig, setAdmobConfig] = useState<AdMobApiConfig | null>(null);
  const [admobSyncHistory, setAdmobSyncHistory] = useState<AdMobSyncHistory[]>([]);
  const [isLoadingAdmob, setIsLoadingAdmob] = useState(false);
  const [showAdmobSetup, setShowAdmobSetup] = useState(false);
  const [isSavingAdmob, setIsSavingAdmob] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [admobFormData, setAdmobFormData] = useState({
    publisher_id: '',
    account_name: '',
    auth_type: 'service_account' as 'service_account' | 'oauth2',
    service_account_email: '',
    service_account_key: '',
    auto_sync_enabled: false,
    sync_frequency_hours: 24,
    sync_days_back: 7,
    apply_safety_buffer: true,
    default_safety_buffer_percentage: 75
  });

  const COLORS = ['#4ade80', '#60a5fa', '#f472b6', '#facc15', '#a78bfa', '#fb923c'];

  useEffect(() => {
    fetchRevenueData();
    fetchDailyRevenueInputs();
    fetchReconciliationLogs();
    fetchAdmobConfig();
  }, [timeRange]);

  const fetchRevenueData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const endDate = new Date();
      let startDate;

      switch (timeRange) {
        case '7d':
          startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
      }

      const { data: summaryData, error: summaryError } = await supabase.rpc(
        'admin_get_revenue_summary',
        {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        }
      );

      if (summaryError) throw summaryError;

      const { data: eventsData, error: eventsError } = await supabase
        .from('ad_revenue_events')
        .select(`
          id,
          revenue_amount,
          currency,
          user_id,
          artist_id,
          content_id,
          processed_at,
          status,
          metadata
        `)
        .order('processed_at', { ascending: false })
        .limit(10);

      if (eventsError) throw eventsError;

      if (eventsData && eventsData.length > 0) {
        const userIds = [...new Set(eventsData.map(e => e.user_id).filter(Boolean))];
        const artistIds = [...new Set(eventsData.map(e => e.artist_id).filter(Boolean))];

        const userMap = new Map();
        const artistMap = new Map();

        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from('users')
            .select('id, display_name, email')
            .in('id', userIds);

          if (usersData) {
            usersData.forEach(u => userMap.set(u.id, u));
          }
        }

        if (artistIds.length > 0) {
          const { data: artistsData } = await supabase
            .from('artist_profiles')
            .select('artist_id, name')
            .in('artist_id', artistIds);

          if (artistsData) {
            artistsData.forEach(a => artistMap.set(a.artist_id, a));
          }
        }

        const enrichedEvents = eventsData.map(event => ({
          ...event,
          users: event.user_id ? userMap.get(event.user_id) : null,
          artists: event.artist_id ? artistMap.get(event.artist_id) : null
        }));

        setRevenueEvents(enrichedEvents);
      } else {
        setRevenueEvents([]);
      }

      setRevenueData(summaryData);
    } catch (err) {
      console.error('Error fetching revenue data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load revenue data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDailyRevenueInputs = async () => {
    setIsLoadingInputs(true);
    try {
      const { data, error } = await supabase
        .from('ad_daily_revenue_input')
        .select('*')
        .order('revenue_date', { ascending: false })
        .limit(30);

      if (error) throw error;
      setDailyRevenueInputs(data || []);
    } catch (err) {
      console.error('Error fetching daily revenue inputs:', err);
    } finally {
      setIsLoadingInputs(false);
    }
  };

  const fetchReconciliationLogs = async () => {
    setIsLoadingReconciliation(true);
    try {
      const { data, error } = await supabase
        .from('ad_reconciliation_log')
        .select('*')
        .order('reconciliation_date', { ascending: false })
        .limit(30);

      if (error) throw error;
      setReconciliationLogs(data || []);
    } catch (err) {
      console.error('Error fetching reconciliation logs:', err);
    } finally {
      setIsLoadingReconciliation(false);
    }
  };

  const fetchAdmobConfig = async () => {
    setIsLoadingAdmob(true);
    try {
      const { data, error } = await supabase
        .from('admob_api_config')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setAdmobConfig(data);
        setAdmobFormData({
          publisher_id: data.publisher_id || '',
          account_name: data.account_name || '',
          auth_type: data.auth_type || 'service_account',
          service_account_email: data.service_account_email || '',
          service_account_key: '',
          auto_sync_enabled: data.auto_sync_enabled || false,
          sync_frequency_hours: data.sync_frequency_hours || 24,
          sync_days_back: data.sync_days_back || 7,
          apply_safety_buffer: data.apply_safety_buffer ?? true,
          default_safety_buffer_percentage: data.default_safety_buffer_percentage || 75
        });

        const { data: historyData } = await supabase
          .from('admob_sync_history')
          .select('*')
          .eq('config_id', data.id)
          .order('created_at', { ascending: false })
          .limit(10);

        setAdmobSyncHistory(historyData || []);
      }
    } catch (err) {
      console.error('Error fetching AdMob config:', err);
    } finally {
      setIsLoadingAdmob(false);
    }
  };

  const handleSaveAdmobConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAdmob(true);
    setError(null);
    setSuccess(null);

    try {
      if (!admobFormData.publisher_id) {
        setError('Publisher ID is required');
        return;
      }

      const configData: any = {
        publisher_id: admobFormData.publisher_id,
        account_name: admobFormData.account_name || null,
        auth_type: admobFormData.auth_type,
        service_account_email: admobFormData.service_account_email || null,
        auto_sync_enabled: admobFormData.auto_sync_enabled,
        sync_frequency_hours: admobFormData.sync_frequency_hours,
        sync_days_back: admobFormData.sync_days_back,
        apply_safety_buffer: admobFormData.apply_safety_buffer,
        default_safety_buffer_percentage: admobFormData.default_safety_buffer_percentage,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      if (admobFormData.service_account_key) {
        configData.credentials_encrypted = admobFormData.service_account_key;
      }

      if (admobConfig) {
        const { error: updateError } = await supabase
          .from('admob_api_config')
          .update(configData)
          .eq('id', admobConfig.id);

        if (updateError) throw updateError;
        setSuccess('AdMob API configuration updated successfully');
      } else {
        configData.connection_status = 'disconnected';
        const { error: insertError } = await supabase
          .from('admob_api_config')
          .insert([configData]);

        if (insertError) throw insertError;
        setSuccess('AdMob API configuration saved successfully');
      }

      setShowAdmobSetup(false);
      fetchAdmobConfig();
    } catch (err) {
      console.error('Error saving AdMob config:', err);
      setError(err instanceof Error ? err.message : 'Failed to save AdMob configuration');
    } finally {
      setIsSavingAdmob(false);
    }
  };

  const handleTestAdmobConnection = async () => {
    if (!admobConfig) return;

    setIsSyncing(true);
    setError(null);

    try {
      await supabase.rpc('update_admob_connection_status', {
        p_config_id: admobConfig.id,
        p_status: 'syncing'
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admob-sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            config_id: admobConfig.id,
            sync_type: 'test'
          })
        }
      );

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Connection test failed');
      }

      setSuccess('Connection test successful! AdMob API is properly configured.');
      fetchAdmobConfig();
    } catch (err) {
      console.error('Error testing AdMob connection:', err);
      setError(err instanceof Error ? err.message : 'Failed to test AdMob connection');

      if (admobConfig) {
        await supabase.rpc('update_admob_connection_status', {
          p_config_id: admobConfig.id,
          p_status: 'error',
          p_error: err instanceof Error ? err.message : 'Connection test failed'
        });
        fetchAdmobConfig();
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncAdmobRevenue = async () => {
    if (!admobConfig) return;

    setIsSyncing(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admob-sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            config_id: admobConfig.id,
            sync_type: 'manual'
          })
        }
      );

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Sync failed');
      }

      setSuccess(`Sync completed! Fetched ${result.records_processed || 0} records.`);
      fetchAdmobConfig();
      fetchDailyRevenueInputs();
      fetchRevenueData();
    } catch (err) {
      console.error('Error syncing AdMob revenue:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync AdMob revenue');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnectAdmob = async () => {
    if (!admobConfig) return;

    if (!confirm('Are you sure you want to disconnect the AdMob API? This will disable automatic sync.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('admob_api_config')
        .update({
          connection_status: 'disconnected',
          auto_sync_enabled: false,
          credentials_encrypted: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', admobConfig.id);

      if (error) throw error;

      setSuccess('AdMob API disconnected successfully');
      fetchAdmobConfig();
    } catch (err) {
      console.error('Error disconnecting AdMob:', err);
      setError('Failed to disconnect AdMob API');
    }
  };

  const getConnectionStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <Wifi className="w-3 h-3" />
            Connected
          </span>
        );
      case 'syncing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Syncing
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <AlertTriangle className="w-3 h-3" />
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            <WifiOff className="w-3 h-3" />
            Disconnected
          </span>
        );
    }
  };

  const handleProcessPendingRevenue = async () => {
    setIsProcessing(true);
    setProcessingResult(null);

    try {
      const result = await adRevenueService.processBatchAdRevenue({
        limit: 50
      });

      setProcessingResult(result);
      fetchRevenueData();
    } catch (err) {
      console.error('Error processing pending revenue:', err);
      setError(err instanceof Error ? err.message : 'Failed to process pending revenue');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunAdmobReconciliation = async () => {
    setIsProcessing(true);
    setProcessingResult(null);
    setError(null);
    setSuccess(null);

    try {
      const { data, error } = await supabase.rpc('admin_reconcile_daily_admob_revenue', {
        p_revenue_date: null,
      });

      if (error) throw error;

      const count = Array.isArray(data) ? data.length : 0;
      setSuccess(`Reconciliation complete. ${count} day(s) updated in the Reconciliation Log.`);
      fetchReconciliationLogs();
    } catch (err) {
      console.error('Error running AdMob reconciliation:', err);
      setError(err instanceof Error ? err.message : 'Failed to run AdMob reconciliation');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitDailyRevenue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingInput(true);
    setError(null);
    setSuccess(null);

    try {
      const totalRevenue = parseFloat(newRevenueInput.total_revenue_usd) || 0;
      const bannerRevenue = parseFloat(newRevenueInput.banner_revenue) || 0;
      const interstitialRevenue = parseFloat(newRevenueInput.interstitial_revenue) || 0;
      const rewardedRevenue = parseFloat(newRevenueInput.rewarded_revenue) || 0;
      const nativeRevenue = parseFloat(newRevenueInput.native_revenue) || 0;
      const safetyBuffer = parseFloat(newRevenueInput.safety_buffer_percentage) || 75;

      if (totalRevenue <= 0) {
        setError('Total revenue must be greater than 0');
        return;
      }

      if (safetyBuffer < 50 || safetyBuffer > 90) {
        setError('Safety buffer must be between 50% and 90%');
        return;
      }

      const { data, error: rpcError } = await supabase.rpc('admin_input_daily_admob_revenue', {
        p_revenue_date: newRevenueInput.revenue_date,
        p_total_revenue_usd: totalRevenue,
        p_banner_revenue: bannerRevenue,
        p_interstitial_revenue: interstitialRevenue,
        p_rewarded_revenue: rewardedRevenue,
        p_native_revenue: nativeRevenue,
        p_safety_buffer_pct: safetyBuffer,
        p_notes: newRevenueInput.notes || null
      });

      if (rpcError) throw rpcError;

      if (data?.error) {
        setError(data.error);
        return;
      }

      setSuccess(`Daily revenue for ${newRevenueInput.revenue_date} recorded successfully. Usable revenue: $${(totalRevenue * safetyBuffer / 100).toFixed(2)}`);
      setShowInputForm(false);
      setNewRevenueInput({
        revenue_date: format(new Date(), 'yyyy-MM-dd'),
        total_revenue_usd: '',
        banner_revenue: '',
        interstitial_revenue: '',
        rewarded_revenue: '',
        native_revenue: '',
        safety_buffer_percentage: '75',
        notes: ''
      });
      fetchDailyRevenueInputs();
      fetchRevenueData();
    } catch (err) {
      console.error('Error submitting daily revenue:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit daily revenue');
    } finally {
      setIsSubmittingInput(false);
    }
  };

  const handleLockRevenueEntry = async (id: string, date: string) => {
    if (!confirm(`Are you sure you want to lock the revenue entry for ${date}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ad_daily_revenue_input')
        .update({ is_locked: true, locked_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setSuccess(`Revenue entry for ${date} has been locked`);
      fetchDailyRevenueInputs();
    } catch (err) {
      console.error('Error locking revenue entry:', err);
      setError('Failed to lock revenue entry');
    }
  };

  const handleDistributeCreatorPool = async (date: string) => {
    if (!confirm(`Distribute the Creator Pool for ${date}? This will credit creator earnings based on weighted impressions for that day.`)) {
      return;
    }

    setIsDistributingCreatorPool(true);
    setError(null);
    setSuccess(null);
    setCreatorPoolDistributionResult(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('admin_distribute_creator_pool_for_date', {
        p_revenue_date: date
      });

      if (rpcError) throw rpcError;

      setCreatorPoolDistributionResult(data);

      if (data?.ok) {
        setSuccess(
          `Creator pool distribution: ${data.status} for ${date}` +
            (data.creator_pool_usd !== undefined ? ` (Pool: $${Number(data.creator_pool_usd).toFixed(6)})` : '')
        );
      } else {
        setError(data?.message || `Creator pool distribution failed for ${date}`);
      }

      // Refresh summary + events so admin sees updated earnings and latest activity
      fetchRevenueData();
      fetchDailyRevenueInputs();
    } catch (err) {
      console.error('Error distributing creator pool:', err);
      setError(err instanceof Error ? err.message : 'Failed to distribute creator pool');
    } finally {
      setIsDistributingCreatorPool(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };

  const formatDateTime = (dateString: string): string => {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };

  const getVarianceColor = (variance: number): string => {
    if (variance > 5) return 'text-green-600';
    if (variance < -5) return 'text-red-600';
    return 'text-yellow-600';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'processing': return 'bg-blue-100 text-blue-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Ad Revenue Management</h2>

        <div className="flex items-center gap-4">
          <div className="flex bg-white rounded-lg shadow p-1 border border-gray-200">
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1 rounded-md text-sm ${
                timeRange === '7d'
                  ? 'bg-[#309605] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1 rounded-md text-sm ${
                timeRange === '30d'
                  ? 'bg-[#309605] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setTimeRange('90d')}
              className={`px-3 py-1 rounded-md text-sm ${
                timeRange === '90d'
                  ? 'bg-[#309605] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              90 Days
            </button>
          </div>

          <button
            onClick={() => {
              fetchRevenueData();
              fetchDailyRevenueInputs();
              fetchReconciliationLogs();
            }}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {processingResult && (
        <div className="p-4 bg-green-100 border border-green-200 rounded-lg">
          <p className="text-green-700">
            {processingResult.message || `Processed ${processingResult.processed_count} ad impressions successfully`}
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-100 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-100 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          {null}
          <p className="ml-4 text-gray-700">Loading revenue data...</p>
        </div>
      ) : revenueData ? (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-700 font-medium">Total Revenue</h3>
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(revenueData.total_revenue || 0)}</p>
                <p className="text-green-600 text-sm">+{formatCurrency(revenueData.revenue_today || 0)} today</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-700 font-medium">Artist Payouts</h3>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(revenueData.artist_revenue || 0)}</p>
                <p className="text-blue-600 text-sm">{revenueData.artist_count || 0} artists</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-700 font-medium">Listener Payouts</h3>
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-teal-600" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(revenueData.listener_revenue || 0)}</p>
                <p className="text-teal-600 text-sm">{revenueData.listener_count || 0} listeners</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-700 font-medium">Platform Revenue</h3>
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(revenueData.platform_revenue || 0)}</p>
                <p className="text-orange-600 text-sm">{Math.round(revenueData.platform_percentage || 0)}% of total</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-gray-100 rounded-lg text-center">
          <p className="text-gray-700">No revenue data available</p>
        </div>
      )}

      <div className="flex justify-between gap-4">
        <button
          onClick={() => setShowInputForm(!showInputForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
        >
          <Upload className="w-5 h-5" />
          <span>Input Daily AdMob Revenue</span>
        </button>

        <button
          onClick={handleProcessPendingRevenue}
          disabled={isProcessing}
          className="px-4 py-2 bg-[#309605] hover:bg-[#3ba208] text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              {null}
              <span>Processing...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              <span>Process Pending Ad Revenue</span>
            </>
          )}
        </button>
      </div>

      {showInputForm && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Input Daily AdMob Revenue
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Enter the actual revenue from your AdMob dashboard. A safety buffer will be applied to prevent overpaying.
          </p>

          <form onSubmit={handleSubmitDailyRevenue} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Revenue Date
                </label>
                <input
                  type="date"
                  value={newRevenueInput.revenue_date}
                  onChange={(e) => setNewRevenueInput(prev => ({ ...prev, revenue_date: e.target.value }))}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Revenue (USD) *
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={newRevenueInput.total_revenue_usd}
                  onChange={(e) => setNewRevenueInput(prev => ({ ...prev, total_revenue_usd: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Banner Revenue
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={newRevenueInput.banner_revenue}
                  onChange={(e) => setNewRevenueInput(prev => ({ ...prev, banner_revenue: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interstitial Revenue
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={newRevenueInput.interstitial_revenue}
                  onChange={(e) => setNewRevenueInput(prev => ({ ...prev, interstitial_revenue: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rewarded Revenue
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={newRevenueInput.rewarded_revenue}
                  onChange={(e) => setNewRevenueInput(prev => ({ ...prev, rewarded_revenue: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Native Revenue
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={newRevenueInput.native_revenue}
                  onChange={(e) => setNewRevenueInput(prev => ({ ...prev, native_revenue: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Safety Buffer (%)
                </label>
                <input
                  type="number"
                  min="50"
                  max="90"
                  value={newRevenueInput.safety_buffer_percentage}
                  onChange={(e) => setNewRevenueInput(prev => ({ ...prev, safety_buffer_percentage: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Usable: {formatCurrency((parseFloat(newRevenueInput.total_revenue_usd) || 0) * (parseFloat(newRevenueInput.safety_buffer_percentage) || 75) / 100)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={newRevenueInput.notes}
                  onChange={(e) => setNewRevenueInput(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any notes about this entry"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>
                  <strong>Safety Buffer:</strong> Only {newRevenueInput.safety_buffer_percentage}% of the total revenue will be available for distribution.
                  This protects the platform from overpaying due to revenue fluctuations.
                </span>
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowInputForm(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingInput}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmittingInput ? 'Submitting...' : 'Submit Revenue'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Google AdMob API Connection Section */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl border border-blue-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-green-500 rounded-xl flex items-center justify-center shadow-lg">
              <Link2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Google AdMob Reporting API</h3>
              <p className="text-sm text-gray-600">
                {admobConfig ? 'Automatically sync revenue data from AdMob' : 'Connect to fetch revenue data automatically'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {admobConfig && getConnectionStatusBadge(admobConfig.connection_status)}
            <button
              onClick={() => setShowAdmobSetup(!showAdmobSetup)}
              className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg flex items-center gap-2 shadow-sm"
            >
              <Settings className="w-4 h-4" />
              <span>{admobConfig ? 'Configure' : 'Connect'}</span>
            </button>
          </div>
        </div>

        {admobConfig && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-blue-200">
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Publisher ID</p>
                <p className="font-medium text-gray-900">{admobConfig.publisher_id}</p>
              </div>
              <div>
                <p className="text-gray-500">Auto Sync</p>
                <p className="font-medium text-gray-900">
                  {admobConfig.auto_sync_enabled ? `Every ${admobConfig.sync_frequency_hours}h` : 'Disabled'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Last Sync</p>
                <p className="font-medium text-gray-900">
                  {admobConfig.last_sync_at ? formatDateTime(admobConfig.last_sync_at) : 'Never'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Safety Buffer</p>
                <p className="font-medium text-gray-900">{admobConfig.default_safety_buffer_percentage}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {admobConfig.connection_status === 'connected' && (
                <button
                  onClick={handleSyncAdmobRevenue}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {isSyncing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  <span>Sync Now</span>
                </button>
              )}
              {admobConfig.connection_status !== 'connected' && admobConfig.credentials_encrypted && (
                <button
                  onClick={handleTestAdmobConnection}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {isSyncing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wifi className="w-4 h-4" />
                  )}
                  <span>Test Connection</span>
                </button>
              )}
            </div>
          </div>
        )}

        {admobConfig?.last_error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{admobConfig.last_error}</span>
            </p>
          </div>
        )}
      </div>

      {/* AdMob Setup Form */}
      {showAdmobSetup && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" />
            Configure AdMob Reporting API
          </h3>

          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Prerequisites:</strong> You need a Google Cloud service account with AdMob Reporting API access.
              <a
                href="https://developers.google.com/admob/api/v1/getting-started"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 underline"
              >
                Learn more
              </a>
            </p>
          </div>

          <form onSubmit={handleSaveAdmobConfig} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Publisher ID *
                </label>
                <input
                  type="text"
                  value={admobFormData.publisher_id}
                  onChange={(e) => setAdmobFormData(prev => ({ ...prev, publisher_id: e.target.value }))}
                  placeholder="pub-XXXXXXXXXXXXXXXX"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name (Optional)
                </label>
                <input
                  type="text"
                  value={admobFormData.account_name}
                  onChange={(e) => setAdmobFormData(prev => ({ ...prev, account_name: e.target.value }))}
                  placeholder="My AdMob Account"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Account Email
              </label>
              <input
                type="email"
                value={admobFormData.service_account_email}
                onChange={(e) => setAdmobFormData(prev => ({ ...prev, service_account_email: e.target.value }))}
                placeholder="your-service-account@project-id.iam.gserviceaccount.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Account JSON Key {admobConfig ? '(Leave empty to keep existing)' : '*'}
              </label>
              <textarea
                value={admobFormData.service_account_key}
                onChange={(e) => setAdmobFormData(prev => ({ ...prev, service_account_key: e.target.value }))}
                placeholder='Paste your service account JSON key here...'
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                The JSON key from Google Cloud Console. This will be stored securely.
              </p>
            </div>

            <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sync Frequency (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={admobFormData.sync_frequency_hours}
                  onChange={(e) => setAdmobFormData(prev => ({ ...prev, sync_frequency_hours: parseInt(e.target.value) || 24 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Days to Sync
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={admobFormData.sync_days_back}
                  onChange={(e) => setAdmobFormData(prev => ({ ...prev, sync_days_back: parseInt(e.target.value) || 7 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Safety Buffer (%)
                </label>
                <input
                  type="number"
                  min="50"
                  max="90"
                  value={admobFormData.default_safety_buffer_percentage}
                  onChange={(e) => setAdmobFormData(prev => ({ ...prev, default_safety_buffer_percentage: parseInt(e.target.value) || 75 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={admobFormData.auto_sync_enabled}
                  onChange={(e) => setAdmobFormData(prev => ({ ...prev, auto_sync_enabled: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enable automatic sync</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={admobFormData.apply_safety_buffer}
                  onChange={(e) => setAdmobFormData(prev => ({ ...prev, apply_safety_buffer: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Apply safety buffer to synced data</span>
              </label>
            </div>

            <div className="flex justify-between pt-4 border-t border-gray-200">
              <div>
                {admobConfig && (
                  <button
                    type="button"
                    onClick={handleDisconnectAdmob}
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg"
                  >
                    Disconnect API
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdmobSetup(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAdmob}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {isSavingAdmob ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* AdMob Sync History */}
      {admobConfig && admobSyncHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div
            className="flex items-center justify-between p-6 cursor-pointer"
            onClick={() => setExpandedSection(expandedSection === 'sync_history' ? null : 'sync_history')}
          >
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <History className="w-5 h-5 mr-2 text-blue-600" />
              AdMob Sync History ({admobSyncHistory.length})
            </h3>
            {expandedSection === 'sync_history' ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>

          {expandedSection === 'sync_history' && (
            <div className="p-6 pt-0 border-t border-gray-100">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-left">
                      <th className="p-3 text-gray-700 font-medium">Date</th>
                      <th className="p-3 text-gray-700 font-medium">Type</th>
                      <th className="p-3 text-gray-700 font-medium">Status</th>
                      <th className="p-3 text-gray-700 font-medium">Records</th>
                      <th className="p-3 text-gray-700 font-medium">Revenue Fetched</th>
                      <th className="p-3 text-gray-700 font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admobSyncHistory.map((sync) => (
                      <tr key={sync.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="p-3 text-gray-700">
                          {sync.started_at ? formatDateTime(sync.started_at) : formatDateTime(sync.created_at)}
                        </td>
                        <td className="p-3 text-gray-700 capitalize">{sync.sync_type}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            sync.sync_status === 'completed' ? 'bg-green-100 text-green-700' :
                            sync.sync_status === 'failed' ? 'bg-red-100 text-red-700' :
                            sync.sync_status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {sync.sync_status}
                          </span>
                        </td>
                        <td className="p-3 text-gray-700">{sync.records_processed} / {sync.records_fetched}</td>
                        <td className="p-3 text-gray-900 font-medium">{formatCurrency(sync.total_revenue_fetched)}</td>
                        <td className="p-3 text-gray-700">{sync.duration_seconds ? `${sync.duration_seconds}s` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div
            className="flex items-center justify-between p-6 cursor-pointer"
            onClick={() => setExpandedSection(expandedSection === 'daily_inputs' ? null : 'daily_inputs')}
          >
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-blue-600" />
              Daily AdMob Revenue Inputs ({dailyRevenueInputs.length})
            </h3>
            {expandedSection === 'daily_inputs' ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>

          {expandedSection === 'daily_inputs' && (
            <div className="p-6 pt-0 border-t border-gray-100">
              {isLoadingInputs ? (
                <div className="flex items-center justify-center py-8">
                  {null}
                </div>
              ) : dailyRevenueInputs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-left">
                        <th className="p-3 text-gray-700 font-medium">Date</th>
                        <th className="p-3 text-gray-700 font-medium">Total Revenue</th>
                        <th className="p-3 text-gray-700 font-medium">Safety Buffer</th>
                        <th className="p-3 text-gray-700 font-medium">Usable Revenue</th>
                        <th className="p-3 text-gray-700 font-medium">Status</th>
                        <th className="p-3 text-gray-700 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyRevenueInputs.map((input) => (
                        <tr key={input.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-3 text-gray-700 font-medium">{formatDate(input.revenue_date)}</td>
                          <td className="p-3 text-gray-900">{formatCurrency(input.total_revenue_usd)}</td>
                          <td className="p-3 text-gray-700">{input.safety_buffer_percentage}%</td>
                          <td className="p-3 text-green-600 font-medium">
                            {formatCurrency(input.total_revenue_usd * input.safety_buffer_percentage / 100)}
                          </td>
                          <td className="p-3">
                            {input.is_locked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                                <Lock className="w-3 h-3" />
                                Locked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {!input.is_locked && (
                              <button
                                onClick={() => handleLockRevenueEntry(input.id, input.revenue_date)}
                                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                              >
                                <Lock className="w-3 h-3" />
                                Lock
                              </button>
                            )}
                            {input.is_locked && (
                              <button
                                onClick={() => handleDistributeCreatorPool(input.revenue_date)}
                                disabled={isDistributingCreatorPool}
                                className="text-sm text-green-700 hover:text-green-900 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <DollarSign className="w-3 h-3" />
                                {isDistributingCreatorPool ? 'Distributing…' : 'Distribute Creator Pool'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {creatorPoolDistributionResult && (
                    <div className="mt-4 p-4 rounded-lg border border-gray-200 bg-gray-50">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Creator Pool Distribution Result</p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            Status: <span className="font-medium">{String(creatorPoolDistributionResult.status || 'unknown')}</span>
                          </p>
                        </div>
                        <div className="text-xs text-gray-600 text-right">
                          {creatorPoolDistributionResult.revenue_date && (
                            <div>Date: <span className="font-medium">{String(creatorPoolDistributionResult.revenue_date)}</span></div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-2 bg-white rounded border border-gray-100">
                          <div className="text-[11px] text-gray-500">Creator Pool</div>
                          <div className="text-sm font-semibold text-gray-900">
                            {creatorPoolDistributionResult.creator_pool_usd !== undefined
                              ? formatCurrency(Number(creatorPoolDistributionResult.creator_pool_usd))
                              : '—'}
                          </div>
                        </div>
                        <div className="p-2 bg-white rounded border border-gray-100">
                          <div className="text-[11px] text-gray-500">Total Weight</div>
                          <div className="text-sm font-semibold text-gray-900">
                            {creatorPoolDistributionResult.total_weight !== undefined
                              ? Number(creatorPoolDistributionResult.total_weight).toFixed(6)
                              : '—'}
                          </div>
                        </div>
                        <div className="p-2 bg-white rounded border border-gray-100">
                          <div className="text-[11px] text-gray-500">Artists Paid</div>
                          <div className="text-sm font-semibold text-gray-900">
                            {creatorPoolDistributionResult.artists_paid !== undefined
                              ? String(creatorPoolDistributionResult.artists_paid)
                              : '—'}
                          </div>
                        </div>
                        <div className="p-2 bg-white rounded border border-gray-100">
                          <div className="text-[11px] text-gray-500">Users Credited</div>
                          <div className="text-sm font-semibold text-gray-900">
                            {creatorPoolDistributionResult.users_credited !== undefined
                              ? String(creatorPoolDistributionResult.users_credited)
                              : '—'}
                          </div>
                        </div>
                      </div>

                      <details className="mt-3">
                        <summary className="text-xs text-gray-600 cursor-pointer select-none">Show raw response</summary>
                        <pre className="mt-2 text-[11px] bg-white border border-gray-200 rounded p-3 overflow-auto max-h-56">
{JSON.stringify(creatorPoolDistributionResult, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-gray-100 rounded-lg text-center">
                  <p className="text-gray-700">No daily revenue inputs recorded yet</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div
            className="flex items-center justify-between p-6 cursor-pointer"
            onClick={() => setExpandedSection(expandedSection === 'reconciliation' ? null : 'reconciliation')}
          >
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-green-600" />
              Reconciliation Log
            </h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRunAdmobReconciliation();
                }}
                disabled={isProcessing}
                className="px-3 py-1.5 text-xs bg-[#309605] hover:bg-[#3ba208] text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Reconciling…' : 'Run AdMob Reconciliation'}
              </button>
              {expandedSection === 'reconciliation' ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </div>
          </div>

          {expandedSection === 'reconciliation' && (
            <div className="p-6 pt-0 border-t border-gray-100">
              {isLoadingReconciliation ? (
                <div className="flex items-center justify-center py-8">
                  {null}
                </div>
              ) : reconciliationLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-left">
                        <th className="p-3 text-gray-700 font-medium">Date</th>
                        <th className="p-3 text-gray-700 font-medium">Estimated Payout</th>
                        <th className="p-3 text-gray-700 font-medium">Actual Revenue</th>
                        <th className="p-3 text-gray-700 font-medium">Variance</th>
                        <th className="p-3 text-gray-700 font-medium">Adjustment Factor</th>
                        <th className="p-3 text-gray-700 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliationLogs.map((log) => (
                        <tr key={log.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-3 text-gray-700 font-medium">{formatDate(log.reconciliation_date)}</td>
                          <td className="p-3 text-gray-900">{formatCurrency(log.estimated_total_payout_usd)}</td>
                          <td className="p-3 text-gray-900">{formatCurrency(log.actual_admob_revenue_usd)}</td>
                          <td className="p-3">
                            <div className={`flex items-center gap-1 ${getVarianceColor(log.variance_percentage)}`}>
                              {log.variance_usd >= 0 ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                              <span>{formatCurrency(log.variance_usd)}</span>
                              <span className="text-xs">({log.variance_percentage.toFixed(2)}%)</span>
                            </div>
                          </td>
                          <td className="p-3 text-gray-700">{log.adjustment_factor.toFixed(4)}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(log.reconciliation_status)}`}>
                              {log.reconciliation_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-gray-100 rounded-lg text-center">
                  <p className="text-gray-700">No reconciliation logs yet</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div
            className="flex items-center justify-between p-6 cursor-pointer"
            onClick={() => setExpandedSection(expandedSection === 'overview' ? null : 'overview')}
          >
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
              Revenue Overview
            </h3>
            {expandedSection === 'overview' ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>

          {expandedSection === 'overview' && revenueData && (
            <div className="p-6 pt-0 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Revenue by Content Type</h4>
                  {revenueData.by_content_type && revenueData.by_content_type.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={revenueData.by_content_type}
                          margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                          <XAxis
                            dataKey="content_type"
                            tick={{ fill: '#4B5563' }}
                            tickMargin={10}
                            axisLine={{ stroke: '#D1D5DB' }}
                            tickFormatter={(value) => value ? value.charAt(0).toUpperCase() + value.slice(1) : ''}
                          />
                          <YAxis
                            tick={{ fill: '#4B5563' }}
                            axisLine={{ stroke: '#D1D5DB' }}
                            tickFormatter={(value) => `$${value}`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#FFFFFF',
                              borderColor: '#D1D5DB',
                              borderRadius: '0.5rem',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                            itemStyle={{ color: '#111827' }}
                            labelStyle={{ color: '#4B5563', fontWeight: 'bold', marginBottom: '0.5rem' }}
                            formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                            labelFormatter={(label) => `Content Type: ${label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Unknown'}`}
                          />
                          <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                            {revenueData.by_content_type.map((_entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-100 rounded-lg text-center h-80 flex items-center justify-center">
                      <p className="text-gray-700">No content type data available</p>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Revenue by Ad Type</h4>
                  {revenueData.by_ad_type && revenueData.by_ad_type.length > 0 ? (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={revenueData.by_ad_type}
                          margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                          <XAxis
                            dataKey="ad_type"
                            tick={{ fill: '#4B5563' }}
                            tickMargin={10}
                            axisLine={{ stroke: '#D1D5DB' }}
                            tickFormatter={(value) => value ? value.charAt(0).toUpperCase() + value.slice(1) : ''}
                          />
                          <YAxis
                            tick={{ fill: '#4B5563' }}
                            axisLine={{ stroke: '#D1D5DB' }}
                            tickFormatter={(value) => `$${value}`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#FFFFFF',
                              borderColor: '#D1D5DB',
                              borderRadius: '0.5rem',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                            itemStyle={{ color: '#111827' }}
                            labelStyle={{ color: '#4B5563', fontWeight: 'bold', marginBottom: '0.5rem' }}
                            formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                            labelFormatter={(label) => `Ad Type: ${label ? label.charAt(0).toUpperCase() + label.slice(1) : 'Unknown'}`}
                          />
                          <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                            {revenueData.by_ad_type.map((_entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-100 rounded-lg text-center h-80 flex items-center justify-center">
                      <p className="text-gray-700">No ad type data available</p>
                    </div>
                  )}
                </div>
              </div>

              {revenueData.daily_revenue && revenueData.daily_revenue.length > 0 && (
                <div className="mt-8">
                  <h4 className="font-medium text-gray-900 mb-4">Daily Revenue Trend</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={revenueData.daily_revenue}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: '#4B5563' }}
                          tickFormatter={(value) => format(new Date(value), 'MMM d')}
                        />
                        <YAxis
                          tick={{ fill: '#4B5563' }}
                          tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#FFFFFF',
                            borderColor: '#D1D5DB',
                            borderRadius: '0.5rem'
                          }}
                          formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                          labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="#309605"
                          strokeWidth={2}
                          dot={{ fill: '#309605', strokeWidth: 2 }}
                          name="Daily Revenue"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div
            className="flex items-center justify-between p-6 cursor-pointer"
            onClick={() => setExpandedSection(expandedSection === 'events' ? null : 'events')}
          >
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-teal-600" />
              Recent Revenue Events
            </h3>
            {expandedSection === 'events' ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>

          {expandedSection === 'events' && (
            <div className="p-6 pt-0 border-t border-gray-100">
              {revenueEvents.length > 0 ? (
                <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-left">
                        <th className="p-3 text-gray-700 font-medium">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Date & Time
                          </div>
                        </th>
                        <th className="p-3 text-gray-700 font-medium">Amount</th>
                        <th className="p-3 text-gray-700 font-medium">User</th>
                        <th className="p-3 text-gray-700 font-medium">Artist</th>
                        <th className="p-3 text-gray-700 font-medium">Ad Type</th>
                        <th className="p-3 text-gray-700 font-medium">Content Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueEvents.map((event) => (
                        <tr key={event.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="p-3 text-gray-700">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-500" />
                              <span className="font-mono text-sm">{formatDateTime(event.processed_at)}</span>
                            </div>
                          </td>
                          <td className="p-3 font-medium text-gray-900">{formatCurrency(event.revenue_amount)}</td>
                          <td className="p-3 text-gray-700">
                            {event.users?.display_name || event.users?.email || 'N/A'}
                          </td>
                          <td className="p-3 text-gray-700">
                            {event.artists?.name || 'N/A'}
                          </td>
                          <td className="p-3 text-gray-700 capitalize">
                            {event.metadata?.ad_type || 'Unknown'}
                          </td>
                          <td className="p-3 text-gray-700 capitalize">
                            {event.metadata?.content_type || 'Unknown'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 bg-gray-100 rounded-lg text-center">
                  <p className="text-gray-700">No revenue events found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
