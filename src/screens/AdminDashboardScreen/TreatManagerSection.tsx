import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Card } from '../../components/ui/card';
import { DollarSign, Settings, CreditCard, Package, BarChart, Download, Clock, Coins, RefreshCw, TrendingUp, AlertTriangle, Users, Wallet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEffect } from 'react';
import { RevenueBreakdownChart } from '../../components/RevenueBreakdownChart';
import { CollabSettingsTab } from './CollabSettingsTab';
import { TreatUsersSection } from './TreatUsersSection';
import { LoadingLogo } from '../../components/LoadingLogo';

// Withdrawal Settings Tab Component
const WithdrawalSettingsTab = () => {
  const [settings, setSettings] = useState({
    is_withdrawal_enabled: false,
    minimum_withdrawal_amount: 10.0,
    withdrawal_fee_percentage: 0.0,
    withdrawal_fee_fixed: 0.0,
    treat_to_usd_rate: 1.0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchWithdrawalSettings();
  }, []);

  const fetchWithdrawalSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('treat_withdrawal_settings')
        .select('*')
        .limit(1);

      if (fetchError) {
        throw new Error(`Failed to fetch withdrawal settings: ${fetchError.message}`);
      }

      if (data && data.length > 0) {
        const settingsData = data[0];
        setSettings({
          is_withdrawal_enabled: settingsData.is_withdrawal_enabled || false,
          minimum_withdrawal_amount: Number(settingsData.minimum_withdrawal_amount) || 10.0,
          withdrawal_fee_percentage: Number(settingsData.withdrawal_fee_percentage) || 0.0,
          withdrawal_fee_fixed: Number(settingsData.withdrawal_fee_fixed) || 0.0,
          treat_to_usd_rate: Number(settingsData.treat_to_usd_rate) || 1.0
        });
      } else {
        // No settings found, use defaults
        setSettings({
          is_withdrawal_enabled: false,
          minimum_withdrawal_amount: 10.0,
          withdrawal_fee_percentage: 0.0,
          withdrawal_fee_fixed: 0.0,
          treat_to_usd_rate: 1.0
        });
      }
    } catch (err) {
      console.error('Error fetching withdrawal settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load withdrawal settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setSettings(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) || value === '') {
        setSettings(prev => ({
          ...prev,
          [name]: value === '' ? 0 : numValue
        }));
      }
    }
  };

  const validateSettings = (): string | null => {
    if (settings.minimum_withdrawal_amount < 1) {
      return 'Minimum withdrawal amount must be at least $1.00';
    }
    
    if (settings.withdrawal_fee_percentage < 0 || settings.withdrawal_fee_percentage > 100) {
      return 'Withdrawal fee percentage must be between 0% and 100%';
    }
    
    if (settings.withdrawal_fee_fixed < 0) {
      return 'Fixed withdrawal fee cannot be negative';
    }
    
    if (settings.treat_to_usd_rate <= 0) {
      return 'Treat to USD rate must be greater than 0';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate settings
    const validationError = validateSettings();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication required');
      }

      // Use upsert to handle both insert and update
      const { error: upsertError } = await supabase
        .from('treat_withdrawal_settings')
        .upsert({
          is_withdrawal_enabled: settings.is_withdrawal_enabled,
          minimum_withdrawal_amount: settings.minimum_withdrawal_amount,
          withdrawal_fee_percentage: settings.withdrawal_fee_percentage,
          withdrawal_fee_fixed: settings.withdrawal_fee_fixed,
          treat_to_usd_rate: settings.treat_to_usd_rate,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
          singleton_key: true // Ensure singleton constraint
        }, {
          onConflict: 'singleton_key' // Handle conflict on singleton key
        });

      if (upsertError) {
        throw new Error(`Failed to save withdrawal settings: ${upsertError.message}`);
      }

      setSuccess('Withdrawal settings saved successfully');
      
      // Refresh settings to ensure we have the latest data
      await fetchWithdrawalSettings();
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error saving withdrawal settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save withdrawal settings');
    } finally {
      setIsSubmitting(false);
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

  const inputCls = "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-transparent";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1.5";

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-48 bg-gray-100 rounded-xl" />
        <div className="h-32 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-green-50 flex items-center justify-center">
            <Settings className="w-3.5 h-3.5 text-[#309605]" />
          </div>
          <p className="text-sm font-semibold text-gray-800">Withdrawal Settings</p>
        </div>
        <button
          onClick={fetchWithdrawalSettings}
          className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-500 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {(success || error) && (
        <div className={`p-3 rounded-lg text-xs font-medium ${
          error ? 'bg-red-50 border border-red-100 text-red-700' : 'bg-green-50 border border-green-100 text-green-700'
        }`}>
          {error || success}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-800">Enable Withdrawals</p>
              <p className="text-xs text-gray-500 mt-0.5">Allow users to withdraw treat earnings to USD</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                name="is_withdrawal_enabled"
                checked={settings.is_withdrawal_enabled}
                onChange={handleInputChange}
                className="sr-only"
              />
              <div className={`w-10 h-5.5 rounded-full transition-colors duration-200 ${
                settings.is_withdrawal_enabled ? 'bg-[#309605]' : 'bg-gray-300'
              }`} style={{ height: '22px', width: '40px' }}>
                <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 ${
                  settings.is_withdrawal_enabled ? 'translate-x-5' : 'translate-x-0.5'
                } mt-[3px] ml-[3px]`} />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Minimum Withdrawal Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  name="minimum_withdrawal_amount"
                  value={settings.minimum_withdrawal_amount}
                  onChange={handleInputChange}
                  min="1"
                  step="0.01"
                  required
                  className={`${inputCls} pl-7`}
                  placeholder="10.00"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">Minimum before users can request withdrawal</p>
            </div>

            <div>
              <label className={labelCls}>Treat to USD Rate</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  name="treat_to_usd_rate"
                  value={settings.treat_to_usd_rate}
                  onChange={handleInputChange}
                  min="0.001"
                  step="0.001"
                  required
                  className={`${inputCls} pl-7`}
                  placeholder="1.000"
                />
              </div>
              <p className="mt-1 text-xs text-[#309605] font-medium">1 Treat = {formatCurrency(settings.treat_to_usd_rate)} · 100 treats = {formatCurrency(100 * settings.treat_to_usd_rate)}</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-yellow-50 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 text-yellow-600" />
              </div>
              <p className="text-xs font-semibold text-gray-700">Withdrawal Fees</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Percentage Fee (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    name="withdrawal_fee_percentage"
                    value={settings.withdrawal_fee_percentage}
                    onChange={handleInputChange}
                    min="0"
                    max="100"
                    step="0.1"
                    className={`${inputCls} pr-7`}
                    placeholder="0.0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">Percentage of withdrawal amount</p>
              </div>

              <div>
                <label className={labelCls}>Fixed Fee (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    name="withdrawal_fee_fixed"
                    value={settings.withdrawal_fee_fixed}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    className={`${inputCls} pl-7`}
                    placeholder="0.00"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">Fixed amount per withdrawal</p>
              </div>
            </div>

            <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-xs font-medium text-amber-700 mb-1">Fee example for $100.00 withdrawal:</p>
              <div className="text-xs text-amber-600 space-y-0.5">
                <p>Percentage fee: {formatCurrency(100 * (settings.withdrawal_fee_percentage / 100))} · Fixed fee: {formatCurrency(settings.withdrawal_fee_fixed)}</p>
                <p className="font-semibold">User receives: {formatCurrency(100 - ((100 * (settings.withdrawal_fee_percentage / 100)) + settings.withdrawal_fee_fixed))}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-600 mb-3">Current Settings Summary</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`w-2 h-2 rounded-full ${settings.is_withdrawal_enabled ? 'bg-green-500' : 'bg-red-400'}`} />
                  <span className="text-xs font-medium text-gray-600">Status</span>
                </div>
                <p className={`text-xs font-semibold ${settings.is_withdrawal_enabled ? 'text-green-700' : 'text-red-600'}`}>
                  {settings.is_withdrawal_enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>

              <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="w-3 h-3 text-blue-500" />
                  <span className="text-xs font-medium text-gray-600">Minimum</span>
                </div>
                <p className="text-xs font-semibold text-gray-800">{formatCurrency(settings.minimum_withdrawal_amount)}</p>
              </div>

              <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <Coins className="w-3 h-3 text-yellow-500" />
                  <span className="text-xs font-medium text-gray-600">Rate</span>
                </div>
                <p className="text-xs font-semibold text-gray-800">1 = {formatCurrency(settings.treat_to_usd_rate)}</p>
              </div>
              </div>
            </div>

          <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-[#309605] hover:bg-[#3ba208] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <LoadingLogo variant="pulse" size={16} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Settings className="w-4 h-4" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
        </form>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-xs font-semibold text-blue-700 mb-1.5">Important Information</p>
        <ul className="space-y-1 text-xs text-blue-600">
          <li>• Withdrawal settings apply globally to all users</li>
          <li>• Disabling withdrawals prevents all new withdrawal requests</li>
          <li>• Existing pending withdrawals will not be affected by changes</li>
          <li>• The treat-to-USD rate affects how much users receive when withdrawing</li>
          <li>• Changes take effect immediately after saving</li>
        </ul>
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = () => {
  const [overviewData, setOverviewData] = useState({
    totalTreatsRevenue: 0,
    totalTreatsSold: 0,
    totalTreatsSentOut: 0,
    totalTreatsSpentOnPromotions: 0,
    totalBonusTreatsGiven: 0,
    pendingWithdrawals: 0,
    pendingWithdrawalAmount: 0,
    totalActiveUsers: 0,
    totalTransactions: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchOverviewData();

    const interval = setInterval(() => {
      fetchOverviewData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchOverviewData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [
        paymentsResult,
        walletsResult,
        spentResult,
        promotionResult,
        bonusResult,
        withdrawalResult,
        usersResult,
        transactionsResult
      ] = await Promise.all([
        supabase
          .from('treat_payments')
          .select('amount, currency, amount_usd, completed_at')
          .eq('status', 'completed'),
        supabase
          .from('treat_wallets')
          .select('total_purchased, total_spent, total_earned, total_withdrawn'),
        supabase
          .from('treat_transactions')
          .select('amount')
          .in('transaction_type', ['spend', 'tip_sent'])
          .eq('status', 'completed'),
        supabase
          .from('treat_promotions')
          .select('treats_spent'),
        supabase
          .from('treat_transactions')
          .select('metadata')
          .eq('transaction_type', 'purchase')
          .eq('status', 'completed')
          .not('metadata->>bonus_treats', 'is', null),
        supabase
          .from('withdrawal_requests')
          .select('amount')
          .eq('status', 'pending'),
        supabase
          .from('treat_wallets')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('treat_transactions')
          .select('*', { count: 'exact', head: true })
      ]);

      if (paymentsResult.error) throw paymentsResult.error;
      if (walletsResult.error) throw walletsResult.error;
      if (spentResult.error) throw spentResult.error;
      if (promotionResult.error) throw promotionResult.error;
      if (bonusResult.error) throw bonusResult.error;
      if (withdrawalResult.error) throw withdrawalResult.error;
      if (usersResult.error) throw usersResult.error;
      if (transactionsResult.error) throw transactionsResult.error;

      const totalTreatsSold = walletsResult.data?.reduce(
        (sum, wallet) => sum + (Number(wallet.total_purchased) || 0),
        0
      ) || 0;

      const totalTreatsRevenue = paymentsResult.data?.reduce(
        (sum, payment) => sum + (Number(payment.amount_usd) || Number(payment.amount) || 0),
        0
      ) || 0;

      const totalTreatsSentOut = spentResult.data?.reduce(
        (sum, transaction) => sum + (Number(transaction.amount) || 0),
        0
      ) || 0;

      const totalBonusTreatsGiven = bonusResult.data?.reduce(
        (sum, transaction) => {
          const bonusTreats = transaction.metadata?.bonus_treats;
          return sum + (Number(bonusTreats) || 0);
        },
        0
      ) || 0;

      const totalTreatsSpentOnPromotions = promotionResult.data?.reduce(
        (sum, promotion) => sum + (Number(promotion.treats_spent) || 0),
        0
      ) || 0;

      const totalPromotionSpending = totalBonusTreatsGiven + totalTreatsSpentOnPromotions;

      const pendingWithdrawals = withdrawalResult.data?.length || 0;
      const pendingWithdrawalAmount = withdrawalResult.data?.reduce(
        (sum, withdrawal) => sum + (Number(withdrawal.amount) || 0),
        0
      ) || 0;

      setOverviewData({
        totalTreatsRevenue,
        totalTreatsSold,
        totalTreatsSentOut,
        totalTreatsSpentOnPromotions: totalPromotionSpending,
        totalBonusTreatsGiven,
        pendingWithdrawals,
        pendingWithdrawalAmount,
        totalActiveUsers: usersResult.count || 0,
        totalTransactions: transactionsResult.count || 0
      });
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching treat overview data:', err);
      setError('Failed to load treat overview data');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount * 0.01); // Assuming 1 treat = $0.01
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  const generateRevenueReport = async () => {
    try {
      const { data: payments, error: paymentsError } = await supabase
        .from('treat_payments')
        .select('*')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      const { data: transactions, error: transactionsError } = await supabase
        .from('treat_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (transactionsError) throw transactionsError;

      const reportData = {
        generatedAt: new Date().toISOString(),
        summary: {
          totalRevenue: overviewData.totalTreatsRevenue,
          totalTreatsSold: overviewData.totalTreatsSold,
          totalTreatsSpent: overviewData.totalTreatsSentOut,
          totalPromotionSpending: overviewData.totalTreatsSpentOnPromotions,
          totalBonusTreats: overviewData.totalBonusTreatsGiven,
          circulationRate: overviewData.totalTreatsSold > 0
            ? ((overviewData.totalTreatsSentOut / overviewData.totalTreatsSold) * 100).toFixed(2) + '%'
            : '0%'
        },
        payments: payments || [],
        transactions: transactions || []
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `revenue-report-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating revenue report:', err);
      alert('Failed to generate revenue report. Please try again.');
    }
  };

  const exportTransactionData = async () => {
    try {
      const { data: transactions, error } = await supabase
        .from('treat_transactions')
        .select(`
          id,
          user_id,
          transaction_type,
          amount,
          balance_before,
          balance_after,
          description,
          status,
          payment_method,
          payment_reference,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const csvHeader = 'ID,User ID,Transaction Type,Amount,Balance Before,Balance After,Description,Status,Payment Method,Payment Reference,Created At\n';
      const csvRows = (transactions || []).map(t =>
        `"${t.id}","${t.user_id}","${t.transaction_type}",${t.amount},${t.balance_before},${t.balance_after},"${t.description || ''}","${t.status}","${t.payment_method || ''}","${t.payment_reference || ''}","${t.created_at}"`
      ).join('\n');

      const csvContent = csvHeader + csvRows;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transaction-data-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting transaction data:', err);
      alert('Failed to export transaction data. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="bg-gray-100 rounded-xl h-24" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1,2].map(i => <div key={i} className="bg-gray-100 rounded-xl h-40" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
        <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
        </div>
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <button onClick={fetchOverviewData} className="px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-100 transition-colors">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-green-50 flex items-center justify-center">
            <DollarSign className="w-3.5 h-3.5 text-[#309605]" />
          </div>
          <p className="text-sm font-semibold text-gray-800">Treat System Overview</p>
          {lastUpdated && (
            <span className="text-xs text-gray-400">· Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
        </div>
        <button
          onClick={fetchOverviewData}
          className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-500 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Revenue', value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(overviewData.totalTreatsRevenue), sub: `${formatNumber(overviewData.totalTreatsSold)} treats sold`, icon: <DollarSign className="w-3.5 h-3.5 text-green-600" />, bg: 'bg-green-50' },
          { label: 'Treats Sent Out', value: formatNumber(overviewData.totalTreatsSentOut), sub: 'Tips and purchases', icon: <TrendingUp className="w-3.5 h-3.5 text-blue-600" />, bg: 'bg-blue-50' },
          { label: 'Promotion Spending', value: formatNumber(overviewData.totalTreatsSpentOnPromotions), sub: `${formatNumber(overviewData.totalBonusTreatsGiven)} bonuses`, icon: <BarChart className="w-3.5 h-3.5 text-orange-600" />, bg: 'bg-orange-50' },
          { label: 'Pending Withdrawals', value: overviewData.pendingWithdrawals.toString(), sub: `${formatCurrency(overviewData.pendingWithdrawalAmount)} pending`, icon: <Clock className="w-3.5 h-3.5 text-yellow-600" />, bg: 'bg-yellow-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-6 h-6 rounded-md ${stat.bg} flex items-center justify-center`}>{stat.icon}</div>
              <p className="text-xs font-medium text-gray-500 leading-tight">{stat.label}</p>
            </div>
            <p className="text-xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-yellow-50 flex items-center justify-center">
              <Coins className="w-3.5 h-3.5 text-yellow-600" />
            </div>
            <p className="text-xs font-semibold text-gray-700">System Health</p>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Active Users with Wallets', value: formatNumber(overviewData.totalActiveUsers) },
              { label: 'Total Transactions', value: formatNumber(overviewData.totalTransactions) },
              { label: 'Circulation Rate', value: overviewData.totalTreatsSold > 0 ? `${((overviewData.totalTreatsSentOut / overviewData.totalTreatsSold) * 100).toFixed(1)}%` : '0%' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-lg">
                <span className="text-xs text-gray-600">{label}</span>
                <span className="text-xs font-semibold text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center">
              <Download className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="text-xs font-semibold text-gray-700">Quick Actions</p>
          </div>
          <div className="space-y-2">
            <button onClick={generateRevenueReport} className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition-colors">
              <span className="text-xs font-medium text-blue-700">Generate Revenue Report</span>
              <Download className="w-3.5 h-3.5 text-blue-600" />
            </button>
            <button onClick={exportTransactionData} className="w-full flex items-center justify-between px-3 py-2 bg-green-50 hover:bg-green-100 border border-green-100 rounded-lg transition-colors">
              <span className="text-xs font-medium text-green-700">Export Transaction Data</span>
              <Download className="w-3.5 h-3.5 text-[#309605]" />
            </button>
            <button onClick={() => { const s = document.querySelector('[data-section="analytics"]'); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-lg transition-colors">
              <span className="text-xs font-medium text-gray-700">View Analytics Dashboard</span>
              <BarChart className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>
        </div>
      </div>

      <div data-section="analytics">
        <RevenueBreakdownChart />
      </div>
    </div>
  );
};

const PaymentChannelsTab = () => {
  const [channels, setChannels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingChannel, setEditingChannel] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchPaymentChannels();
  }, []);

  const fetchPaymentChannels = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('treat_payment_channels')
        .select('*')
        .order('display_order', { ascending: true });

      if (fetchError) throw fetchError;
      setChannels(data || []);
    } catch (err) {
      console.error('Error fetching payment channels:', err);
      setError('Failed to load payment channels');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleChannel = async (channelId: string, currentStatus: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('treat_payment_channels')
        .update({ is_enabled: !currentStatus })
        .eq('id', channelId);

      if (updateError) throw updateError;

      setSuccess(`Channel ${!currentStatus ? 'enabled' : 'disabled'} successfully`);
      fetchPaymentChannels();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error toggling channel:', err);
      setError('Failed to update channel status');
    }
  };

  const handleSaveChannel = async (channelData: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (editingChannel) {
        const { error: updateError } = await supabase
          .from('treat_payment_channels')
          .update({
            ...channelData,
            updated_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingChannel.id);

        if (updateError) throw updateError;
        setSuccess('Channel updated successfully');
      } else {
        const { error: insertError } = await supabase
          .from('treat_payment_channels')
          .insert({
            ...channelData,
            created_by: user.id
          });

        if (insertError) throw insertError;
        setSuccess('Channel added successfully');
      }

      setEditingChannel(null);
      setShowAddModal(false);
      fetchPaymentChannels();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving channel:', err);
      setError('Failed to save channel');
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!confirm('Are you sure you want to delete this payment channel?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('treat_payment_channels')
        .delete()
        .eq('id', channelId);

      if (deleteError) throw deleteError;

      setSuccess('Channel deleted successfully');
      fetchPaymentChannels();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error deleting channel:', err);
      setError('Failed to delete channel');
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-12">
          <LoadingLogo variant="pulse" size={32} />
          <p className="ml-4 text-gray-700">Loading payment channels...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">Payment Channels</h3>
        <div className="flex gap-2">
          <button
            onClick={fetchPaymentChannels}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              setEditingChannel(null);
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-[#309605] to-[#3ba208] hover:from-[#3ba208] hover:to-[#309605] rounded-lg text-white font-medium transition-all duration-200 shadow-lg shadow-[#309605]/25 flex items-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            Add Channel
          </button>
        </div>
      </div>

      {(success || error) && (
        <div className={`p-4 rounded-lg ${
          error ? 'bg-red-100 border border-red-200' : 'bg-green-100 border border-green-200'
        }`}>
          <p className={`${error ? 'text-red-700' : 'text-green-700'}`}>
            {error || success}
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {channels.map((channel) => (
          <Card key={channel.id} className="bg-white rounded-lg shadow">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                    {channel.icon_url ? (
                      <img src={channel.icon_url} alt={channel.channel_name} className="w-8 h-8 object-contain" />
                    ) : (
                      <CreditCard className="w-6 h-6 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{channel.channel_name}</h4>
                    <p className="text-sm text-gray-500">{channel.channel_type}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channel.is_enabled}
                    onChange={() => handleToggleChannel(channel.id, channel.is_enabled)}
                    className="sr-only"
                  />
                  <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                    channel.is_enabled ? 'bg-[#309605]' : 'bg-gray-300'
                  }`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ${
                      channel.is_enabled ? 'translate-x-5' : 'translate-x-0'
                    } mt-0.5 ml-0.5`}></div>
                  </div>
                </label>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Status</span>
                  <span className={`font-medium ${channel.is_enabled ? 'text-green-600' : 'text-gray-500'}`}>
                    {channel.is_enabled ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Display Order</span>
                  <span className="font-medium text-gray-900">{channel.display_order}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingChannel(channel);
                    setShowAddModal(true);
                  }}
                  className="flex-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors duration-200 text-sm font-medium"
                >
                  Configure
                </button>
                <button
                  onClick={() => handleDeleteChannel(channel.id)}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors duration-200 text-sm font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {channels.length === 0 && !isLoading && (
        <Card className="bg-white rounded-lg shadow p-12 text-center">
          <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Payment Channels</h3>
          <p className="text-gray-600 mb-6">Add your first payment channel to start accepting treat purchases</p>
          <button
            onClick={() => {
              setEditingChannel(null);
              setShowAddModal(true);
            }}
            className="px-6 py-3 bg-gradient-to-r from-[#309605] to-[#3ba208] hover:from-[#3ba208] hover:to-[#309605] rounded-lg text-white font-medium transition-all duration-200 shadow-lg shadow-[#309605]/25"
          >
            Add Payment Channel
          </button>
        </Card>
      )}

      {showAddModal && (
        <PaymentChannelModal
          channel={editingChannel}
          onClose={() => {
            setShowAddModal(false);
            setEditingChannel(null);
          }}
          onSave={handleSaveChannel}
        />
      )}

      <Card className="bg-blue-50 border border-blue-200">
        <div className="p-6">
          <h4 className="font-medium text-blue-800 mb-3 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Payment Channel Information
          </h4>
          <ul className="space-y-2 text-blue-700 text-sm">
            <li>• Configure payment channels to allow users to purchase treats</li>
            <li>• Each channel requires specific credentials (API keys, wallet addresses, etc.)</li>
            <li>• Only enabled channels will be shown to users during checkout</li>
            <li>• Display order determines the order channels appear to users</li>
            <li>• Keep your API keys and secrets secure</li>
            <li>• Test channels thoroughly before enabling for production use</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

const PaymentChannelModal = ({ channel, onClose, onSave }: {
  channel: any | null;
  onClose: () => void;
  onSave: (data: any) => void;
}) => {
  const [formData, setFormData] = useState({
    channel_name: channel?.channel_name || '',
    channel_type: channel?.channel_type || '',
    is_enabled: channel?.is_enabled ?? false,
    icon_url: channel?.icon_url || '',
    display_order: channel?.display_order || 0,
    configuration: channel?.configuration || {}
  });

  const [configFields, setConfigFields] = useState<any[]>([]);

  useEffect(() => {
    const fields = getConfigFieldsForType(formData.channel_type);
    setConfigFields(fields);
  }, [formData.channel_type, formData.configuration.api_version]);

  const getConfigFieldsForType = (type: string) => {
    const fieldMap: any = {
      'paystack': [
        { key: 'public_key', label: 'Public Key', type: 'text' },
        { key: 'secret_key', label: 'Secret Key', type: 'password' },
        { key: 'currency', label: 'Currency', type: 'text', default: 'NGN' }
      ],
      'flutterwave': [
        { key: 'api_version', label: 'API Version', type: 'select', options: [{ value: 'v3', label: 'V3 API (Legacy)' }, { value: 'v4', label: 'V4 API (New)' }], default: 'v3' },
        { key: 'public_key', label: 'Public Key', type: 'text', placeholder: formData.configuration?.api_version === 'v4' ? 'FLWPUBK-...' : 'FLWPUBK_TEST-...' },
        { key: 'secret_key', label: 'Secret Key', type: 'password', placeholder: formData.configuration?.api_version === 'v4' ? 'FLWSECK-...' : 'FLWSECK_TEST-...' },
        { key: 'encryption_key', label: 'Encryption Key (V4 only)', type: 'password', placeholder: 'FLWSECK_ENC-...', conditional: (config: any) => config.api_version === 'v4' },
        { key: 'currency', label: 'Currency', type: 'text', default: 'NGN' }
      ],
      'stripe': [
        { key: 'publishable_key', label: 'Publishable Key', type: 'text' },
        { key: 'secret_key', label: 'Secret Key', type: 'password' },
        { key: 'currency', label: 'Currency', type: 'text', default: 'USD' }
      ],
      'google_pay': [
        { key: 'merchant_id', label: 'Google Merchant ID', type: 'text', placeholder: 'BCR2DN4T...' },
        { key: 'merchant_name', label: 'Merchant Name', type: 'text', placeholder: 'Airaplay', default: 'Airaplay' },
        { key: 'gateway', label: 'Gateway Provider', type: 'text', placeholder: 'example', default: 'example' },
        { key: 'gateway_merchant_id', label: 'Gateway Merchant ID', type: 'text', placeholder: 'exampleGatewayMerchantId' },
        { key: 'environment', label: 'Environment', type: 'select', options: [
          { value: 'TEST', label: 'Test' },
          { value: 'PRODUCTION', label: 'Production' }
        ], default: 'TEST' },
        { key: 'allowed_auth_methods', label: 'Auth Methods', type: 'text', default: 'PAN_ONLY,CRYPTOGRAM_3DS', placeholder: 'PAN_ONLY,CRYPTOGRAM_3DS' },
        { key: 'allowed_card_networks', label: 'Card Networks', type: 'text', default: 'AMEX,DISCOVER,MASTERCARD,VISA', placeholder: 'Comma-separated' },
        { key: 'total_price_status', label: 'Price Status', type: 'select', options: [
          { value: 'FINAL', label: 'Final' },
          { value: 'ESTIMATED', label: 'Estimated' }
        ], default: 'FINAL' },
        { key: 'currency', label: 'Currency Code', type: 'text', default: 'USD', placeholder: 'USD, NGN, EUR, etc.' },
        { key: 'country_code', label: 'Country Code', type: 'text', default: 'US', placeholder: 'US, NG, etc.' }
      ],
      'usdt_trc20': [
        { key: 'wallet_address', label: 'Wallet Address', type: 'text' },
        { key: 'network', label: 'Network', type: 'text', default: 'TRC20' }
      ],
      'usdt_erc20': [
        { key: 'wallet_address', label: 'Wallet Address', type: 'text' },
        { key: 'network', label: 'Network', type: 'text', default: 'ERC20' }
      ]
    };
    return fieldMap[type] || [];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleConfigChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      configuration: {
        ...prev.configuration,
        [key]: value
      }
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">
            {channel ? 'Edit Payment Channel' : 'Add Payment Channel'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Channel Name *
              </label>
              <input
                type="text"
                value={formData.channel_name}
                onChange={(e) => setFormData({ ...formData, channel_name: e.target.value })}
                required
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
                placeholder="e.g., Paystack"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Channel Type *
              </label>
              <select
                value={formData.channel_type}
                onChange={(e) => setFormData({ ...formData, channel_type: e.target.value })}
                required
                disabled={!!channel}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605] disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Select type</option>
                <option value="paystack">Paystack</option>
                <option value="flutterwave">Flutterwave</option>
                <option value="stripe">Stripe</option>
                <option value="google_pay">Google Pay</option>
                <option value="usdt_trc20">USDT (TRC20)</option>
                <option value="usdt_erc20">USDT (ERC20)</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Icon URL (Optional)
            </label>
            <input
              type="url"
              value={formData.icon_url}
              onChange={(e) => setFormData({ ...formData, icon_url: e.target.value })}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
              placeholder="https://example.com/icon.png"
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Display Order
            </label>
            <input
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
              placeholder="0"
            />
            <p className="mt-1 text-xs text-gray-500">
              Lower numbers appear first in the list
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900 mb-1">Enable Channel</h4>
              <p className="text-gray-600 text-sm">
                Allow users to purchase treats using this channel
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_enabled}
                onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                className="sr-only"
              />
              <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                formData.is_enabled ? 'bg-[#309605]' : 'bg-gray-300'
              }`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ${
                  formData.is_enabled ? 'translate-x-5' : 'translate-x-0'
                } mt-0.5 ml-0.5`}></div>
              </div>
            </label>
          </div>

          {configFields.length > 0 && (
            <div className="border-t border-gray-200 pt-6">
              <h4 className="font-medium text-gray-900 mb-4">Channel Configuration</h4>
              <div className="space-y-4">
                {configFields.map((field) => {
                  if (field.conditional && !field.conditional(formData.configuration)) {
                    return null;
                  }

                  return (
                    <div key={field.key}>
                      <label className="block text-gray-700 text-sm font-medium mb-2">
                        {field.label}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          value={formData.configuration[field.key] || field.default || ''}
                          onChange={(e) => handleConfigChange(field.key, e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
                        >
                          {field.options?.map((opt: any) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          value={formData.configuration[field.key] || field.default || ''}
                          onChange={(e) => handleConfigChange(field.key, e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
                          placeholder={field.placeholder || field.label}
                        />
                      )}
                      {field.key === 'encryption_key' && formData.configuration.api_version === 'v4' && (
                        <p className="mt-1 text-xs text-gray-500">
                          V4 API requires an encryption key for enhanced security
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-[#309605] to-[#3ba208] hover:from-[#3ba208] hover:to-[#309605] text-white rounded-lg font-medium transition-all duration-200 shadow-lg shadow-[#309605]/25"
            >
              {channel ? 'Update Channel' : 'Add Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TreatPackageTab = () => {
  const [packages, setPackages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingPackage, setEditingPackage] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchTreatPackages();
  }, []);

  const fetchTreatPackages = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('treat_packages')
        .select('*')
        .order('display_order', { ascending: true });

      if (fetchError) throw fetchError;
      setPackages(data || []);
    } catch (err) {
      console.error('Error fetching treat packages:', err);
      setError('Failed to load treat packages');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePackage = async (packageId: string, currentStatus: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('treat_packages')
        .update({ is_active: !currentStatus })
        .eq('id', packageId);

      if (updateError) throw updateError;

      setSuccess(`Package ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchTreatPackages();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error toggling package:', err);
      setError('Failed to update package status');
    }
  };

  const handleSavePackage = async (packageData: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (editingPackage) {
        const { error: updateError } = await supabase
          .from('treat_packages')
          .update({
            ...packageData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingPackage.id);

        if (updateError) throw updateError;
        setSuccess('Package updated successfully');
      } else {
        const { error: insertError } = await supabase
          .from('treat_packages')
          .insert(packageData);

        if (insertError) throw insertError;
        setSuccess('Package added successfully');
      }

      setEditingPackage(null);
      setShowAddModal(false);
      fetchTreatPackages();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving package:', err);
      setError('Failed to save package');
    }
  };

  const handleDeletePackage = async (packageId: string) => {
    if (!confirm('Are you sure you want to delete this treat package?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('treat_packages')
        .delete()
        .eq('id', packageId);

      if (deleteError) throw deleteError;

      setSuccess('Package deleted successfully');
      fetchTreatPackages();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error deleting package:', err);
      setError('Failed to delete package');
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-12">
          <LoadingLogo variant="pulse" size={32} />
          <p className="ml-4 text-gray-700">Loading treat packages...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">Treat Packages</h3>
        <div className="flex gap-2">
          <button
            onClick={fetchTreatPackages}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              setEditingPackage(null);
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-[#309605] to-[#3ba208] hover:from-[#3ba208] hover:to-[#309605] rounded-lg text-white font-medium transition-all duration-200 shadow-lg shadow-[#309605]/25 flex items-center gap-2"
          >
            <Package className="w-4 h-4" />
            Add Package
          </button>
        </div>
      </div>

      {(success || error) && (
        <div className={`p-4 rounded-lg ${
          error ? 'bg-red-100 border border-red-200' : 'bg-green-100 border border-green-200'
        }`}>
          <p className={`${error ? 'text-red-700' : 'text-green-700'}`}>
            {error || success}
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {packages.map((pkg) => (
          <Card key={pkg.id} className={`rounded-lg shadow transition-all duration-200 ${
            pkg.is_popular ? 'ring-2 ring-[#309605] bg-gradient-to-br from-white to-[#e6f7f1]' : 'bg-white'
          }`}>
            <div className="p-6">
              {pkg.is_popular && (
                <div className="mb-3 inline-flex items-center px-3 py-1 bg-[#309605] text-white text-xs font-semibold rounded-full">
                  Most Popular
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-bold text-xl text-gray-900 mb-1">{pkg.name}</h4>
                  <p className="text-sm text-gray-500">{pkg.treats} Treats</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pkg.is_active}
                    onChange={() => handleTogglePackage(pkg.id, pkg.is_active)}
                    className="sr-only"
                  />
                  <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                    pkg.is_active ? 'bg-[#309605]' : 'bg-gray-300'
                  }`}>
                    <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ${
                      pkg.is_active ? 'translate-x-5' : 'translate-x-0'
                    } mt-0.5 ml-0.5`}></div>
                  </div>
                </label>
              </div>

              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-baseline justify-center mb-2">
                  <span className="text-3xl font-bold text-[#309605]">${Number(pkg.price).toFixed(2)}</span>
                  <span className="text-gray-500 ml-1">USD</span>
                </div>
                <div className="text-center text-sm text-gray-600">
                  ${(Number(pkg.price) / Number(pkg.treats)).toFixed(4)} per treat
                </div>
              </div>

              {Number(pkg.bonus) > 0 && (
                <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                  <span className="text-yellow-700 text-sm font-medium">
                    +{pkg.bonus} Bonus Treats
                  </span>
                </div>
              )}

              {pkg.description && (
                <p className="text-gray-600 text-sm mb-4 text-center">
                  {pkg.description}
                </p>
              )}

              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Status</span>
                  <span className={`font-medium ${pkg.is_active ? 'text-green-600' : 'text-gray-500'}`}>
                    {pkg.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Display Order</span>
                  <span className="font-medium text-gray-900">{pkg.display_order}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingPackage(pkg);
                    setShowAddModal(true);
                  }}
                  className="flex-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors duration-200 text-sm font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeletePackage(pkg.id)}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors duration-200 text-sm font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {packages.length === 0 && !isLoading && (
        <Card className="bg-white rounded-lg shadow p-12 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Treat Packages</h3>
          <p className="text-gray-600 mb-6">Create your first treat package to let users purchase treats</p>
          <button
            onClick={() => {
              setEditingPackage(null);
              setShowAddModal(true);
            }}
            className="px-6 py-3 bg-gradient-to-r from-[#309605] to-[#3ba208] hover:from-[#3ba208] hover:to-[#309605] rounded-lg text-white font-medium transition-all duration-200 shadow-lg shadow-[#309605]/25"
          >
            Create Package
          </button>
        </Card>
      )}

      {showAddModal && (
        <TreatPackageModal
          package={editingPackage}
          onClose={() => {
            setShowAddModal(false);
            setEditingPackage(null);
          }}
          onSave={handleSavePackage}
        />
      )}

      <Card className="bg-blue-50 border border-blue-200">
        <div className="p-6">
          <h4 className="font-medium text-blue-800 mb-3 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Treat Package Information
          </h4>
          <ul className="space-y-2 text-blue-700 text-sm">
            <li>• Packages define how many treats users can purchase and at what price</li>
            <li>• The price per treat is calculated automatically based on package size</li>
            <li>• Add bonus treats to create attractive bundle deals</li>
            <li>• Only active packages will be shown to users during purchase</li>
            <li>• Display order determines the order packages appear to users</li>
            <li>• Mark a package as popular to highlight it with special styling</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

const TreatPackageModal = ({ package: pkg, onClose, onSave }: {
  package: any | null;
  onClose: () => void;
  onSave: (data: any) => void;
}) => {
  const [formData, setFormData] = useState({
    name: pkg?.name || '',
    treats: pkg?.treats || 0,
    price: pkg?.price || 0,
    bonus: pkg?.bonus || 0,
    description: pkg?.description || '',
    is_active: pkg?.is_active ?? true,
    is_popular: pkg?.is_popular ?? false,
    is_best_value: pkg?.is_best_value ?? false,
    display_order: pkg?.display_order || 0
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const validateForm = (): boolean => {
    const errors: string[] = [];

    if (!formData.name.trim()) {
      errors.push('Package name is required');
    }

    if (formData.treats <= 0) {
      errors.push('Treats amount must be greater than 0');
    }

    if (formData.price <= 0) {
      errors.push('Price must be greater than 0');
    }

    if (formData.bonus < 0) {
      errors.push('Bonus treats cannot be negative');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSave(formData);
  };

  const totalTreats = Number(formData.treats) + Number(formData.bonus);
  const pricePerTreat = Number(formData.treats) > 0 ? Number(formData.price) / Number(formData.treats) : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">
            {pkg ? 'Edit Treat Package' : 'Add Treat Package'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {validationErrors.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Package Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
              placeholder="e.g., Starter Pack"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Treats Amount *
              </label>
              <input
                type="number"
                value={formData.treats}
                onChange={(e) => setFormData({ ...formData, treats: parseFloat(e.target.value) || 0 })}
                min="1"
                step="1"
                required
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
                placeholder="100"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-medium mb-2">
                Price (USD) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  min="0.01"
                  step="0.01"
                  required
                  className="w-full pl-8 pr-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
                  placeholder="9.99"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Bonus Treats
            </label>
            <input
              type="number"
              value={formData.bonus}
              onChange={(e) => setFormData({ ...formData, bonus: parseFloat(e.target.value) || 0 })}
              min="0"
              step="1"
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
              placeholder="0"
            />
            <p className="mt-1 text-xs text-gray-500">
              Extra treats added to the package as a bonus
            </p>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
              placeholder="Brief description of this package..."
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Display Order
            </label>
            <input
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
              placeholder="0"
            />
            <p className="mt-1 text-xs text-gray-500">
              Lower numbers appear first in the list
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Active Package</h4>
                <p className="text-gray-600 text-sm">
                  Allow users to purchase this package
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                  formData.is_active ? 'bg-[#309605]' : 'bg-gray-300'
                }`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ${
                    formData.is_active ? 'translate-x-5' : 'translate-x-0'
                  } mt-0.5 ml-0.5`}></div>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Popular Package</h4>
                <p className="text-gray-600 text-sm">
                  Highlight this package as most popular
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_popular}
                  onChange={(e) => setFormData({ ...formData, is_popular: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                  formData.is_popular ? 'bg-[#309605]' : 'bg-gray-300'
                }`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ${
                    formData.is_popular ? 'translate-x-5' : 'translate-x-0'
                  } mt-0.5 ml-0.5`}></div>
                </div>
              </label>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-medium text-gray-900 mb-4">Package Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-4 h-4 text-[#309605]" />
                  <span className="font-medium text-gray-900">Total Treats</span>
                </div>
                <p className="text-2xl font-bold text-[#309605]">
                  {totalTreats}
                </p>
                {Number(formData.bonus) > 0 && (
                  <p className="text-xs text-gray-600 mt-1">
                    {formData.treats} + {formData.bonus} bonus
                  </p>
                )}
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-gray-900">Price</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  ${Number(formData.price).toFixed(2)}
                </p>
                <p className="text-xs text-gray-600 mt-1">USD</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-yellow-600" />
                  <span className="font-medium text-gray-900">Per Treat</span>
                </div>
                <p className="text-2xl font-bold text-yellow-600">
                  ${pricePerTreat.toFixed(4)}
                </p>
                <p className="text-xs text-gray-600 mt-1">Base rate</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-[#309605] to-[#3ba208] hover:from-[#3ba208] hover:to-[#309605] text-white rounded-lg font-medium transition-all duration-200 shadow-lg shadow-[#309605]/25"
            >
              {pkg ? 'Update Package' : 'Add Package'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AnalyticsTab = () => {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(30);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      // Fetch top spenders (users who spent the most treats on tips and promotions)
      const { data: topSpenders, error: spendersError } = await supabase
        .from('treat_transactions')
        .select('user_id, amount, users!inner(display_name, email, avatar_url)')
        .in('transaction_type', ['tip_sent', 'spend'])
        .eq('status', 'completed')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (spendersError) throw spendersError;

      // Aggregate top spenders
      const spendersMap = new Map();
      topSpenders?.forEach(transaction => {
        const userId = transaction.user_id;
        const user = Array.isArray(transaction.users) ? transaction.users[0] : transaction.users;
        if (!spendersMap.has(userId)) {
          spendersMap.set(userId, {
            user_id: userId,
            display_name: user?.display_name || user?.email || 'Unknown',
            avatar_url: user?.avatar_url,
            total_spent: 0
          });
        }
        spendersMap.get(userId).total_spent += Number(transaction.amount) || 0;
      });

      const topSpendersArray = Array.from(spendersMap.values())
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 10);

      // Fetch most tipped users (users who received the most tips)
      const { data: topTipped, error: tippedError } = await supabase
        .from('treat_transactions')
        .select('user_id, amount, users!inner(display_name, email, avatar_url)')
        .eq('transaction_type', 'tip_received')
        .eq('status', 'completed')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (tippedError) throw tippedError;

      // Aggregate most tipped users
      const tippedMap = new Map();
      topTipped?.forEach(transaction => {
        const userId = transaction.user_id;
        const user = Array.isArray(transaction.users) ? transaction.users[0] : transaction.users;
        if (!tippedMap.has(userId)) {
          tippedMap.set(userId, {
            user_id: userId,
            display_name: user?.display_name || user?.email || 'Unknown',
            avatar_url: user?.avatar_url,
            total_received: 0,
            tip_count: 0
          });
        }
        tippedMap.get(userId).total_received += Number(transaction.amount) || 0;
        tippedMap.get(userId).tip_count += 1;
      });

      const topTippedArray = Array.from(tippedMap.values())
        .sort((a, b) => b.total_received - a.total_received)
        .slice(0, 10);

      // Fetch promotion spending statistics
      const { data: promotionStats, error: promoError } = await supabase
        .from('treat_promotions')
        .select('user_id, treats_spent, users!inner(display_name, email)')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (promoError) throw promoError;

      const promoMap = new Map();
      promotionStats?.forEach(promo => {
        const userId = promo.user_id;
        const user = Array.isArray(promo.users) ? promo.users[0] : promo.users;
        if (!promoMap.has(userId)) {
          promoMap.set(userId, {
            user_id: userId,
            display_name: user?.display_name || user?.email || 'Unknown',
            total_promotion_spent: 0
          });
        }
        promoMap.get(userId).total_promotion_spent += Number(promo.treats_spent) || 0;
      });

      const topPromoSpenders = Array.from(promoMap.values())
        .sort((a, b) => b.total_promotion_spent - a.total_promotion_spent)
        .slice(0, 10);

      setAnalyticsData({
        topSpenders: topSpendersArray,
        topTipped: topTippedArray,
        topPromoSpenders
      });
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  if (isLoading) {
    return (
      <Card className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-12">
          <LoadingLogo variant="pulse" size={32} />
          <p className="ml-4 text-gray-700">Loading analytics...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white rounded-lg shadow p-6">
        <div className="p-6 bg-red-100 border border-red-200 rounded-lg text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg"
          >
            Try Again
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">Treat Analytics</h3>
        <div className="flex gap-2 items-center">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <button
            onClick={fetchAnalytics}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Top Spenders Section */}
      <Card className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
            Top Spenders
          </h4>
          {analyticsData?.topSpenders?.length > 0 ? (
            <div className="space-y-3">
              {analyticsData.topSpenders.map((user: any, index: number) => (
                <div key={user.user_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                      {index + 1}
                    </div>
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.display_name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold">
                        {user.display_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{user.display_name}</p>
                      <p className="text-sm text-gray-500">Total spent</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-600">{formatNumber(user.total_spent)}</p>
                    <p className="text-xs text-gray-500">treats</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No spending data available for this period</p>
            </div>
          )}
        </div>
      </Card>

      {/* Most Tipped Users Section */}
      <Card className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Coins className="w-5 h-5 mr-2 text-yellow-600" />
            Most Tipped Users
          </h4>
          {analyticsData?.topTipped?.length > 0 ? (
            <div className="space-y-3">
              {analyticsData.topTipped.map((user: any, index: number) => (
                <div key={user.user_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 font-bold text-sm">
                      {index + 1}
                    </div>
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.display_name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold">
                        {user.display_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{user.display_name}</p>
                      <p className="text-sm text-gray-500">{user.tip_count} tips received</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-yellow-600">{formatNumber(user.total_received)}</p>
                    <p className="text-xs text-gray-500">treats</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No tipping data available for this period</p>
            </div>
          )}
        </div>
      </Card>

      {/* Top Promotion Spenders Section */}
      <Card className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart className="w-5 h-5 mr-2 text-[#309605]" />
            Top Promotion Spenders
          </h4>
          {analyticsData?.topPromoSpenders?.length > 0 ? (
            <div className="space-y-3">
              {analyticsData.topPromoSpenders.map((user: any, index: number) => (
                <div key={user.user_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{user.display_name}</p>
                      <p className="text-sm text-gray-500">Promotion spending</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#309605]">{formatNumber(user.total_promotion_spent)}</p>
                    <p className="text-xs text-gray-500">treats</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No promotion spending data available for this period</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

const TransactionsTab = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const itemsPerPage = 20;

  useEffect(() => {
    fetchTransactions();
  }, [currentPage, typeFilter, statusFilter, searchQuery]);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from('treat_transactions')
        .select(`
          *,
          users!treat_transactions_user_id_fkey (
            id,
            email,
            display_name,
            avatar_url
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (typeFilter !== 'all') {
        query = query.eq('transaction_type', typeFilter);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (searchQuery) {
        query = query.or(`description.ilike.%${searchQuery}%`);
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      setTransactions(data || []);
      setTotalTransactions(count || 0);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      setDeletingId(transactionId);
      setError(null);

      const { error: deleteError } = await supabase
        .from('treat_transactions')
        .delete()
        .eq('id', transactionId);

      if (deleteError) throw deleteError;

      setSuccess('Transaction deleted successfully');
      setShowDeleteConfirm(false);
      setSelectedTransaction(null);
      fetchTransactions();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error deleting transaction:', err);
      setError('Failed to delete transaction');
    } finally {
      setDeletingId(null);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return '🛒';
      case 'spend':
        return '💸';
      case 'earn':
        return '💰';
      case 'withdraw':
        return '💳';
      case 'tip_sent':
        return '🎁';
      case 'tip_received':
        return '🎉';
      default:
        return '📝';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'purchase':
      case 'earn':
      case 'tip_received':
        return 'text-green-600 bg-green-50';
      case 'spend':
      case 'withdraw':
      case 'tip_sent':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTransactionType = (type: string): string => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const totalPages = Math.ceil(totalTransactions / itemsPerPage);

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      <Card className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Transaction History</h3>
              <p className="text-gray-600 text-sm mt-1">
                View and manage all treat transactions across the platform
              </p>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#309605]" />
              <span className="text-2xl font-bold text-gray-900">
                {totalTransactions.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search description..."
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
              >
                <option value="all">All Types</option>
                <option value="purchase">Purchase</option>
                <option value="spend">Spend</option>
                <option value="earn">Earn</option>
                <option value="withdraw">Withdraw</option>
                <option value="tip_sent">Treat Sent</option>
                <option value="tip_received">Treat Received</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                  setStatusFilter('all');
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingLogo variant="pulse" size={32} />
              <span className="ml-3 text-gray-600">Loading transactions...</span>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Transactions Found</h4>
              <p className="text-gray-600">
                {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No transactions have been recorded yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gradient-to-r from-[#309605] to-[#309605] rounded-full flex items-center justify-center text-white font-medium text-sm">
                            {transaction.users?.display_name?.[0] || transaction.users?.email?.[0] || '?'}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {transaction.users?.display_name || 'Unknown User'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {transaction.users?.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getTransactionColor(transaction.transaction_type)}`}>
                          <span className="mr-1">{getTransactionIcon(transaction.transaction_type)}</span>
                          {formatTransactionType(transaction.transaction_type)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-sm font-semibold ${
                          ['purchase', 'earn', 'tip_received'].includes(transaction.transaction_type)
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {['purchase', 'earn', 'tip_received'].includes(transaction.transaction_type) ? '+' : '-'}
                          {transaction.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {transaction.description}
                        </div>
                        {transaction.payment_method && (
                          <div className="text-xs text-gray-500 mt-1">
                            via {transaction.payment_method}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadge(transaction.status)}`}>
                          {transaction.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-gray-900">
                          {new Date(transaction.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(transaction.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => {
                            setSelectedTransaction(transaction);
                            setShowDeleteConfirm(true);
                          }}
                          className="text-red-600 hover:text-red-800 font-medium text-sm transition-colors duration-200"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalTransactions)} of {totalTransactions} transactions
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                          currentPage === pageNum
                            ? 'bg-[#309605] text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {showDeleteConfirm && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
                Delete Transaction
              </h3>
              <p className="text-gray-600 text-center mb-6">
                Are you sure you want to delete this transaction? This action cannot be undone.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">User:</span>
                    <div className="font-medium text-gray-900">{selectedTransaction.users?.display_name || 'Unknown'}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Amount:</span>
                    <div className="font-medium text-gray-900">{selectedTransaction.amount} treats</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Type:</span>
                    <div className="font-medium text-gray-900">{formatTransactionType(selectedTransaction.transaction_type)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <div className="font-medium text-gray-900">{selectedTransaction.status}</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedTransaction(null);
                  }}
                  disabled={deletingId !== null}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteTransaction(selectedTransaction.id)}
                  disabled={deletingId !== null}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingId ? (
                    <div className="flex items-center justify-center gap-2">
                      <LoadingLogo variant="pulse" size={20} />
                      <span>Deleting...</span>
                    </div>
                  ) : (
                    'Delete Transaction'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const TreatManagerSection = (): JSX.Element => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0">
          <Coins className="w-4 h-4 text-yellow-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 leading-tight">Treat Manager</h2>
          <p className="text-sm text-gray-400 mt-0.5">Manage treat packages, withdrawals, and payment channels</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto scrollbar-hide mb-4">
          <TabsList className="flex justify-start bg-gray-50 border border-gray-100 p-1 rounded-xl shadow-sm min-w-full gap-0.5">
            <TabsTrigger value="overview" className="flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-[#309605] data-[state=active]:text-white data-[state=active]:shadow-sm inline-flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="withdrawal-settings" className="flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-[#309605] data-[state=active]:text-white data-[state=active]:shadow-sm inline-flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" /> Withdrawal
            </TabsTrigger>
            <TabsTrigger value="payment-channels" className="flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-[#309605] data-[state=active]:text-white data-[state=active]:shadow-sm inline-flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Channels
            </TabsTrigger>
            <TabsTrigger value="treat-package" className="flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-[#309605] data-[state=active]:text-white data-[state=active]:shadow-sm inline-flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Packages
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-[#309605] data-[state=active]:text-white data-[state=active]:shadow-sm inline-flex items-center gap-1.5">
              <BarChart className="w-3.5 h-3.5" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-[#309605] data-[state=active]:text-white data-[state=active]:shadow-sm inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Transactions
            </TabsTrigger>
            <TabsTrigger value="collab" className="flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-[#309605] data-[state=active]:text-white data-[state=active]:shadow-sm inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Collab
            </TabsTrigger>
            <TabsTrigger value="treat-users" className="flex-shrink-0 px-3 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-[#309605] data-[state=active]:text-white data-[state=active]:shadow-sm inline-flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Users
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="withdrawal-settings">
          <WithdrawalSettingsTab />
        </TabsContent>
        <TabsContent value="payment-channels">
          <PaymentChannelsTab />
        </TabsContent>
        <TabsContent value="treat-package">
          <TreatPackageTab />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsTab />
        </TabsContent>
        <TabsContent value="transactions">
          <TransactionsTab />
        </TabsContent>
        <TabsContent value="collab">
          <CollabSettingsTab />
        </TabsContent>
        <TabsContent value="treat-users">
          <TreatUsersSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

