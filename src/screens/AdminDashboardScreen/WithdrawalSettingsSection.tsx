import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  AlertTriangle,
  Check,
  X,
  RefreshCw,
  Power,
  TrendingUp,
  Percent,
  Clock,
  User,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LoadingLogo } from '../../components/LoadingLogo';

interface WithdrawalSettings {
  id: string;
  exchange_rate: number;
  withdrawal_fee_type: 'percentage' | 'fixed';
  withdrawal_fee_value: number;
  withdrawals_enabled: boolean;
  disabled_reason: string | null;
  created_at: string;
  updated_at: string;
  last_updated_by: string | null;
  admin_email: string | null;
  admin_display_name: string | null;
}

interface AuditLogEntry {
  id: string;
  admin_id: string;
  action: string;
  previous_values: any;
  new_values: any;
  created_at: string;
}

export const WithdrawalSettingsSection = (): JSX.Element => {
  const [settings, setSettings] = useState<WithdrawalSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [exchangeRate, setExchangeRate] = useState<string>('1.0');
  const [feeType, setFeeType] = useState<'percentage' | 'fixed'>('percentage');
  const [feeValue, setFeeValue] = useState<string>('0.0');
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState(true);
  const [disabledReason, setDisabledReason] = useState('');

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<any>(null);

  // Audit log state
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc('admin_get_withdrawal_settings');

      if (error) throw error;

      if (data && data.length > 0) {
        const settingsData = data[0];
        setSettings(settingsData);
        setExchangeRate(settingsData.exchange_rate.toString());
        setFeeType(settingsData.withdrawal_fee_type);
        setFeeValue(settingsData.withdrawal_fee_value.toString());
        setWithdrawalsEnabled(settingsData.withdrawals_enabled);
        setDisabledReason(settingsData.disabled_reason || '');
      }
    } catch (err: any) {
      console.error('Error fetching withdrawal settings:', err);
      setError(err.message || 'Failed to load withdrawal settings');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuditLog = async () => {
    try {
      setIsLoadingAudit(true);

      const { data, error } = await supabase
        .from('withdrawal_settings_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setAuditLog(data || []);
    } catch (err) {
      console.error('Error fetching audit log:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const validateInputs = (): string | null => {
    const rate = parseFloat(exchangeRate);
    const fee = parseFloat(feeValue);

    if (isNaN(rate) || rate <= 0) {
      return 'Exchange rate must be a positive number';
    }

    if (isNaN(fee) || fee < 0) {
      return 'Withdrawal fee cannot be negative';
    }

    if (feeType === 'percentage' && fee > 100) {
      return 'Percentage fee cannot exceed 100%';
    }

    if (!withdrawalsEnabled && !disabledReason.trim()) {
      return 'Please provide a reason for disabling withdrawals';
    }

    return null;
  };

  const calculateFeeExample = (amount: number): { fee: number; net: number } => {
    const feeVal = parseFloat(feeValue);
    let fee = 0;

    if (feeType === 'percentage') {
      fee = (amount * feeVal) / 100;
    } else {
      fee = feeVal;
    }

    return {
      fee: Math.max(0, fee),
      net: Math.max(0, amount - fee),
    };
  };

  const handleSubmit = () => {
    const validationError = validateInputs();
    if (validationError) {
      setError(validationError);
      return;
    }

    setPendingChanges({
      exchange_rate: parseFloat(exchangeRate),
      withdrawal_fee_type: feeType,
      withdrawal_fee_value: parseFloat(feeValue),
      withdrawals_enabled: withdrawalsEnabled,
      disabled_reason: !withdrawalsEnabled ? disabledReason : null,
    });

    setShowConfirmModal(true);
  };

  const confirmUpdate = async () => {
    if (!pendingChanges) return;

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const { data, error } = await supabase.rpc('admin_update_withdrawal_settings', {
        p_exchange_rate: pendingChanges.exchange_rate,
        p_withdrawal_fee_type: pendingChanges.withdrawal_fee_type,
        p_withdrawal_fee_value: pendingChanges.withdrawal_fee_value,
        p_withdrawals_enabled: pendingChanges.withdrawals_enabled,
        p_disabled_reason: pendingChanges.disabled_reason,
      });

      if (error) throw error;

      setShowConfirmModal(false);
      setPendingChanges(null);
      setSuccessMessage('Withdrawal settings updated successfully');

      // Auto-clear success message
      setTimeout(() => setSuccessMessage(null), 5000);

      // Refresh settings
      await fetchSettings();
    } catch (err: any) {
      console.error('Error updating withdrawal settings:', err);
      setError(err.message || 'Failed to update withdrawal settings');
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const inputCls = "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-transparent";
  const labelCls = "block text-xs font-medium text-gray-600 mb-1.5";

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-10 justify-center">
        <LoadingLogo variant="pulse" size={24} />
        <p className="text-sm text-gray-500">Loading withdrawal settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 leading-tight">Withdrawal Settings</h3>
            <p className="text-xs text-gray-400 mt-0.5">Configure exchange rates, fees and system toggle</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowAuditLog(!showAuditLog);
              if (!showAuditLog) fetchAuditLog();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-600 transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            Audit Log
          </button>
          <button
            onClick={fetchSettings}
            className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-100 rounded-lg flex items-center gap-2">
          <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Current Settings Summary */}
      {settings && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: 'Status',
              value: settings.withdrawals_enabled ? 'Enabled' : 'Disabled',
              color: settings.withdrawals_enabled ? 'text-green-600' : 'text-red-600',
              icon: <Power className={`w-4 h-4 ${settings.withdrawals_enabled ? 'text-green-500' : 'text-red-500'}`} />,
            },
            {
              label: 'Exchange Rate',
              value: settings.exchange_rate.toFixed(4),
              color: 'text-gray-900',
              icon: <TrendingUp className="w-4 h-4 text-blue-500" />,
            },
            {
              label: 'Withdrawal Fee',
              value: `${settings.withdrawal_fee_value}${settings.withdrawal_fee_type === 'percentage' ? '%' : ' USD'}`,
              color: 'text-gray-900',
              icon: <Percent className="w-4 h-4 text-orange-500" />,
            },
            {
              label: 'Last Updated',
              value: formatDate(settings.updated_at),
              color: 'text-gray-600',
              sub: settings.admin_display_name ? `by ${settings.admin_display_name}` : undefined,
              icon: <Clock className="w-4 h-4 text-gray-400" />,
            },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">{item.label}</span>
                {item.icon}
              </div>
              <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
              {item.sub && <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Settings Form */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="space-y-5">
          {/* Master Toggle */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <Power className="w-3.5 h-3.5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Master Withdrawal Control</p>
                  <p className="text-xs text-gray-400 mt-0.5">Enable or disable all withdrawal requests system-wide</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
                <input
                  type="checkbox"
                  checked={withdrawalsEnabled}
                  onChange={(e) => setWithdrawalsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-red-400 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
              </label>
            </div>
            {!withdrawalsEnabled && (
              <div className="mt-3">
                <label className={labelCls}>Reason for Disabling <span className="text-red-500">*</span></label>
                <textarea
                  value={disabledReason}
                  onChange={(e) => setDisabledReason(e.target.value)}
                  rows={3}
                  placeholder="e.g., System maintenance, security review..."
                  className={`${inputCls} resize-none`}
                />
                <p className="mt-1 text-xs text-gray-400">This reason will be logged and may be shown to users</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Exchange Rate */}
            <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-semibold text-gray-900">Exchange Rate</p>
              </div>
              <label className={labelCls}>Live Balance to USD Rate <span className="text-red-500">*</span></label>
              <input
                type="number"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                min="0.0001"
                step="0.0001"
                className={inputCls}
                placeholder="1.0"
              />
              <p className="mt-2 text-xs text-gray-500">1 Live Balance = ${exchangeRate} USD</p>
              <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs text-blue-700">If rate is 0.50, user with 100 balance withdraws $50</p>
              </div>
            </div>

            {/* Fee Configuration */}
            <div className="p-4 bg-orange-50/50 rounded-lg border border-orange-100">
              <div className="flex items-center gap-2 mb-3">
                <Percent className="w-4 h-4 text-orange-600" />
                <p className="text-sm font-semibold text-gray-900">Withdrawal Fee</p>
              </div>
              <label className={labelCls}>Fee Type <span className="text-red-500">*</span></label>
              <div className="flex gap-4 mb-3">
                {(['percentage', 'fixed'] as const).map((type) => (
                  <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="feeType"
                      value={type}
                      checked={feeType === type}
                      onChange={() => setFeeType(type)}
                      className="w-3.5 h-3.5 text-[#309605] focus:ring-[#309605]"
                    />
                    <span className="text-xs text-gray-700">{type === 'percentage' ? 'Percentage (%)' : 'Fixed (USD)'}</span>
                  </label>
                ))}
              </div>
              <label className={labelCls}>Fee Value <span className="text-red-500">*</span></label>
              <div className="relative">
                {feeType === 'fixed' && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                )}
                <input
                  type="number"
                  value={feeValue}
                  onChange={(e) => setFeeValue(e.target.value)}
                  min="0"
                  step="0.01"
                  max={feeType === 'percentage' ? '100' : undefined}
                  className={`${inputCls} ${feeType === 'fixed' ? 'pl-6' : ''}`}
                  placeholder="0.00"
                />
                {feeType === 'percentage' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
                )}
              </div>
            </div>
          </div>

          {/* Fee Preview */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs font-semibold text-gray-700 mb-3">Fee Impact Preview</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[10, 50, 100, 500].map((amount) => {
                const { fee, net } = calculateFeeExample(amount);
                return (
                  <div key={amount} className="bg-white rounded-lg border border-gray-100 p-2.5 text-center">
                    <p className="text-xs text-gray-500 mb-1">{formatCurrency(amount)} withdraw</p>
                    <p className="text-xs text-red-500">Fee: {formatCurrency(fee)}</p>
                    <p className="text-xs font-semibold text-gray-900">Net: {formatCurrency(net)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                if (settings) {
                  setExchangeRate(settings.exchange_rate.toString());
                  setFeeType(settings.withdrawal_fee_type);
                  setFeeValue(settings.withdrawal_fee_value.toString());
                  setWithdrawalsEnabled(settings.withdrawals_enabled);
                  setDisabledReason(settings.disabled_reason || '');
                  setError(null);
                }
              }}
              className="px-4 py-2 text-sm bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-gray-600 transition-colors"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm bg-[#309605] hover:bg-[#3ba208] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
            >
              {isSubmitting ? 'Saving...' : 'Save Withdrawal Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log Section */}
      {showAuditLog && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-900">Recent Changes (Audit Log)</p>
          </div>
          {isLoadingAudit ? (
            <div className="flex items-center gap-3 py-6 justify-center">
              <LoadingLogo variant="pulse" size={20} />
              <p className="text-sm text-gray-500">Loading audit log...</p>
            </div>
          ) : auditLog.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No audit log entries found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Changes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {auditLog.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-600">{formatDate(entry.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          entry.action === 'create' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <details className="cursor-pointer">
                          <summary className="font-medium text-gray-700 hover:text-[#309605]">View Details</summary>
                          <div className="mt-2 p-2 bg-gray-50 rounded-lg text-xs">
                            <pre className="whitespace-pre-wrap">{JSON.stringify(entry.new_values, null, 2)}</pre>
                          </div>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && pendingChanges && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Confirm Changes</h3>
              <button onClick={() => setShowConfirmModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Review the following changes before saving:</p>
            <div className="bg-gray-50 rounded-lg border border-gray-100 p-4 space-y-2.5 mb-4">
              {[
                { label: 'Status', value: pendingChanges.withdrawals_enabled ? 'Enabled' : 'Disabled', color: pendingChanges.withdrawals_enabled ? 'text-green-600' : 'text-red-600' },
                { label: 'Exchange Rate', value: pendingChanges.exchange_rate.toFixed(4), color: 'text-gray-900' },
                { label: 'Fee Type', value: pendingChanges.withdrawal_fee_type, color: 'text-gray-900', capitalize: true },
                { label: 'Fee Value', value: `${pendingChanges.withdrawal_fee_value}${pendingChanges.withdrawal_fee_type === 'percentage' ? '%' : ' USD'}`, color: 'text-gray-900' },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{row.label}</span>
                  <span className={`font-medium ${row.color} ${row.capitalize ? 'capitalize' : ''}`}>{row.value}</span>
                </div>
              ))}
              {pendingChanges.disabled_reason && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Disabled Reason</p>
                  <p className="text-sm text-gray-900">{pendingChanges.disabled_reason}</p>
                </div>
              )}
            </div>
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg mb-4">
              <p className="text-xs text-amber-700">Changes take effect immediately and will be logged in the audit trail.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 text-sm bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmUpdate}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 text-sm bg-[#309605] hover:bg-[#3ba208] rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Updating...' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
