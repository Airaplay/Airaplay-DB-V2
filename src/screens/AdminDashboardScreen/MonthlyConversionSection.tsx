import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, TrendingUp, Users, Zap, AlertCircle, CheckCircle, Info, Settings, Eye, PlayCircle, RefreshCw, RefreshCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ConversionSettings {
  id: string;
  conversion_rate: number;
  conversion_rate_description: string;
  is_active: boolean;
  max_payout_per_user_usd: number | null;
  minimum_points_for_payout: number;
  updated_at: string;
}

interface ConversionHistory {
  id: string;
  conversion_date: string;
  reward_pool_usd: number;
  total_points_converted: number;
  total_users_paid: number;
  conversion_rate_used: number;
  actual_rate_applied: number;
  scaling_applied: boolean;
  total_distributed_usd: number;
  status: string;
  created_at: string;
}

interface ConversionPreview {
  total_eligible_points: number;
  estimated_payout_usd: number;
  eligible_users_count: number;
  conversion_rate: number;
  minimum_points_required: number;
}

export const MonthlyConversionSection: React.FC = () => {
  const [settings, setSettings] = useState<ConversionSettings | null>(null);
  const [preview, setPreview] = useState<ConversionPreview | null>(null);
  const [history, setHistory] = useState<ConversionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Conversion form state
  const [rewardPoolAmount, setRewardPoolAmount] = useState<string>('');
  const [conversionDate, setConversionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Settings form state
  const [editingSettings, setEditingSettings] = useState(false);
  const [newConversionRate, setNewConversionRate] = useState<string>('');
  const [rateDescription, setRateDescription] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 7000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load conversion settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('contribution_conversion_settings')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;
      setSettings(settingsData);

      if (settingsData) {
        setNewConversionRate(settingsData.conversion_rate.toString());
        setRateDescription(settingsData.conversion_rate_description || '');
      }

      // Load conversion preview
      const { data: previewData, error: previewError } = await supabase
        .rpc('get_conversion_preview');

      if (previewError) throw previewError;
      if (previewData && previewData.length > 0) {
        setPreview(previewData[0]);
      }

      // Load conversion history
      const { data: historyData, error: historyError } = await supabase
        .from('contribution_conversion_history')
        .select('*')
        .order('conversion_date', { ascending: false })
        .limit(10);

      if (historyError) throw historyError;
      setHistory(historyData || []);

    } catch (err) {
      console.error('Error loading conversion data:', err);
      setError('Failed to load conversion data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConversionRate = async () => {
    if (!newConversionRate || parseFloat(newConversionRate) <= 0) {
      setError('Conversion rate must be greater than zero');
      return;
    }

    try {
      setProcessing(true);
      setError(null);
      setSuccess(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in');
      }

      const { error: updateError } = await supabase.rpc('admin_update_conversion_rate', {
        p_new_rate: parseFloat(newConversionRate),
        p_description: rateDescription || null
      });

      if (updateError) throw updateError;

      setSuccess('Conversion rate updated successfully');
      setEditingSettings(false);
      await loadData();

    } catch (err) {
      console.error('Error updating conversion rate:', err);
      setError(err instanceof Error ? err.message : 'Failed to update conversion rate');
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessConversion = async () => {
    if (!rewardPoolAmount || parseFloat(rewardPoolAmount) <= 0) {
      setError('Reward pool amount must be greater than zero');
      return;
    }

    if (!conversionDate) {
      setError('Please select a conversion date');
      return;
    }

    try {
      setProcessing(true);
      setError(null);
      setSuccess(null);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('Auth user error:', userError);
        throw new Error('You must be logged in. Please refresh the page and try again.');
      }

      // Verify user is admin
      const { data: userData, error: userDataError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userDataError || !userData) {
        console.error('User data error:', userDataError);
        throw new Error('Unable to verify user permissions. Please try again.');
      }

      if (userData.role !== 'admin') {
        throw new Error('Admin access required to perform this action.');
      }

      // Get fresh session to ensure auth context
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('Session error:', sessionError);
        throw new Error('No active session found. Please log out and log back in.');
      }

      console.log('Processing conversion with:', {
        userId: user.id,
        userRole: userData.role,
        date: conversionDate,
        amount: parseFloat(rewardPoolAmount)
      });

      const { data, error: conversionError } = await supabase
        .rpc('admin_distribute_contribution_rewards', {
          p_period_date: conversionDate,
          p_reward_pool_usd: parseFloat(rewardPoolAmount)
        });

      if (conversionError) {
        console.error('Conversion error details:', {
          message: conversionError.message,
          details: conversionError.details,
          hint: conversionError.hint,
          code: conversionError.code
        });
        throw new Error(conversionError.message || 'Failed to process conversion');
      }

      if (data && data.length > 0) {
        const result = data[0];
        setSuccess(
          `Conversion completed! Distributed $${result.total_distributed_usd} USD to ${result.distributed_count} users. ` +
          `${result.scaling_applied ? 'Proportional scaling was applied.' : 'No scaling needed.'}`
        );
        setRewardPoolAmount('');
        await loadData();
      } else {
        setSuccess('Conversion completed but no users were eligible for rewards.');
        await loadData();
      }

    } catch (err) {
      console.error('Error processing conversion:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to process conversion';
      setError(`Conversion failed: ${errorMessage}`);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
        <p className="ml-3 text-gray-600">Loading conversion data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 min-h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
          <RefreshCcw className="w-4 h-4 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 leading-tight">Monthly Conversion</h2>
          <p className="text-sm text-gray-400 mt-0.5">Manage monthly contribution reward conversions</p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="p-4 bg-green-50 border-l-4 border-green-600 rounded-r-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-green-900 text-sm">Success</p>
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-600 rounded-r-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-900 text-sm">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Conversion Settings */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Conversion Settings</h3>
              <p className="text-xs text-gray-500">Configure the points-to-Treats conversion rate</p>
            </div>
          </div>
          {!editingSettings && (
            <button
              onClick={() => setEditingSettings(true)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium transition-colors"
            >
              Edit Settings
            </button>
          )}
        </div>

        {settings && !editingSettings && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-600 uppercase tracking-wider mb-1">Conversion Rate</p>
              <p className="text-2xl font-bold text-gray-900">{settings.conversion_rate}</p>
              <p className="text-xs text-gray-600 mt-1">USD per point</p>
            </div>
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-[#309605] uppercase tracking-wider mb-1">Minimum Points</p>
              <p className="text-2xl font-bold text-gray-900">{settings.minimum_points_for_payout}</p>
              <p className="text-xs text-gray-600 mt-1">Required for payout</p>
            </div>
          </div>
        )}

        {editingSettings && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Conversion Rate (USD per point)
              </label>
              <input
                type="number"
                step="0.000001"
                value={newConversionRate}
                onChange={(e) => setNewConversionRate(e.target.value)}
                placeholder="e.g., 0.001"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600 focus:ring-opacity-20"
              />
              <p className="text-xs text-gray-500 mt-1">
                Example: 0.001 means 1 point = 0.001 USD = 1 Treat
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description (Optional)
              </label>
              <input
                type="text"
                value={rateDescription}
                onChange={(e) => setRateDescription(e.target.value)}
                placeholder="e.g., Points to Treats conversion rate"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600 focus:ring-opacity-20"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleUpdateConversionRate}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-white text-sm font-medium transition-colors"
              >
                {processing ? 'Updating...' : 'Save Settings'}
              </button>
              <button
                onClick={() => {
                  setEditingSettings(false);
                  if (settings) {
                    setNewConversionRate(settings.conversion_rate.toString());
                    setRateDescription(settings.conversion_rate_description || '');
                  }
                }}
                disabled={processing}
                className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Current Period Preview */}
      {preview && (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Eye className="w-5 h-5 text-[#309605]" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Current Period Preview</h3>
              <p className="text-xs text-gray-500">Real-time overview of eligible contributions</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Zap className="w-5 h-5 text-blue-600" />
                <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">Points</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{preview.total_eligible_points.toLocaleString()}</p>
              <p className="text-xs text-gray-600 mt-0.5">Eligible</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-5 h-5 text-green-600" />
                <span className="text-xs font-medium text-green-600 uppercase tracking-wider">Users</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{preview.eligible_users_count}</p>
              <p className="text-xs text-gray-600 mt-0.5">Qualified</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-orange-600" />
                <span className="text-xs font-medium text-orange-600 uppercase tracking-wider">Estimated</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">${preview.estimated_payout_usd.toFixed(2)}</p>
              <p className="text-xs text-gray-600 mt-0.5">At current rate</p>
            </div>

            <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-[#309605]" />
                <span className="text-xs font-medium text-[#309605] uppercase tracking-wider">Rate</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{preview.conversion_rate}</p>
              <p className="text-xs text-gray-600 mt-0.5">USD/point</p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This is an estimate at the current conversion rate. Actual payouts may vary if proportional scaling is applied based on the reward pool amount.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Process Conversion */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-100 rounded-lg">
            <PlayCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Process Monthly Conversion</h3>
            <p className="text-xs text-gray-500">Execute the conversion and distribute rewards</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Conversion Date
              </label>
              <input
                type="date"
                value={conversionDate}
                onChange={(e) => setConversionDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600 focus:ring-opacity-20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Reward Pool (USD)
              </label>
              <input
                type="number"
                step="0.01"
                value={rewardPoolAmount}
                onChange={(e) => setRewardPoolAmount(e.target.value)}
                placeholder="e.g., 5000"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600 focus:ring-opacity-20"
              />
            </div>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-yellow-900 text-sm mb-1">Important</p>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• Rewards will be credited to users' earned_balance in Treat Wallets</li>
                  <li>• Current period points will be reset to 0 after conversion</li>
                  <li>• Total points remain intact for historical tracking</li>
                  <li>• If total exceeds reward pool, proportional scaling will be applied</li>
                  <li>• This action cannot be undone</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={handleProcessConversion}
            disabled={processing || !rewardPoolAmount || !conversionDate}
            className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Processing Conversion...
              </>
            ) : (
              <>
                <PlayCircle className="w-5 h-5" />
                Execute Conversion
              </>
            )}
          </button>
        </div>
      </div>

      {/* Conversion History */}
      {history.length > 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Conversion History</h3>
                <p className="text-xs text-gray-500">Past monthly conversions</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pool</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distributed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scaling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(record.conversion_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${record.reward_pool_usd.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.total_points_converted.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.total_users_paid}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      ${record.total_distributed_usd.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {record.actual_rate_applied.toFixed(6)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.scaling_applied ? (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                          Applied
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                          No
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Info className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-base">How Monthly Conversion Works</h3>
            <p className="text-xs text-gray-600 mt-0.5">Step-by-step process</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
              <h4 className="font-medium text-gray-900 text-sm">Set Conversion Rate</h4>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Admin configures the conversion rate (e.g., 0.001 USD per point). This determines the base value of each point.
            </p>
          </div>

          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
              <h4 className="font-medium text-gray-900 text-sm">Input Reward Pool</h4>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              At month end, admin enters the total reward pool budget to be distributed among contributors.
            </p>
          </div>

          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
              <h4 className="font-medium text-gray-900 text-sm">Calculate Payouts</h4>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              System calculates: payout = user_points × rate. If total exceeds pool, proportional scaling is applied.
            </p>
          </div>

          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
              <h4 className="font-medium text-gray-900 text-sm">Distribute & Reset</h4>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Payouts added to Treat Wallets, current period points reset to 0, ready for next month.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
