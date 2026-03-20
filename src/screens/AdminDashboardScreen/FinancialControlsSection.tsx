import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { FinancialMonitoringSection } from './FinancialMonitoringSection';

interface FinancialControl {
  control_name: string;
  is_active: boolean;
  reason: string | null;
  activated_at: string | null;
  deactivated_at: string | null;
}

export const FinancialControlsSection = () => {
  const [activeTab, setActiveTab] = useState<'controls' | 'monitoring'>('controls');
  const [controls, setControls] = useState<FinancialControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadControls();
  }, []);

  const loadControls = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .rpc('admin_get_financial_controls');

      if (error) throw error;
      setControls(data || []);
    } catch (error) {
      console.error('Error loading controls:', error);
      setMessage({ type: 'error', text: 'Failed to load financial controls' });
    } finally {
      setLoading(false);
    }
  };

  const toggleControl = async (controlName: string, currentStatus: boolean) => {
    try {
      setUpdating(controlName);
      setMessage(null);

      const { error } = await supabase
        .from('platform_financial_controls')
        .update({
          is_active: !currentStatus,
          activated_at: !currentStatus ? new Date().toISOString() : null,
          deactivated_at: currentStatus ? new Date().toISOString() : null
        })
        .eq('control_name', controlName);

      if (error) throw error;

      setMessage({
        type: 'success',
        text: `${controlName.replace(/_/g, ' ')} ${!currentStatus ? 'activated' : 'deactivated'} successfully`
      });

      await loadControls();
    } catch (error) {
      console.error('Error toggling control:', error);
      setMessage({ type: 'error', text: 'Failed to update control' });
    } finally {
      setUpdating(null);
    }
  };

  const getControlIcon = (controlName: string, isActive: boolean) => {
    return isActive ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-gray-400" />;
  };

  const getControlDescription = (controlName: string): string => {
    switch (controlName) {
      case 'contribution_rewards_active':
        return 'Controls whether users can earn contribution rewards. Rate limits and caps still apply.';
      case 'monthly_conversion_active':
        return 'Controls whether monthly conversion of contribution points to cash occurs.';
      default:
        return '';
    }
  };

  const getControlRecommendation = (controlName: string, isActive: boolean): string => {
    switch (controlName) {
      case 'contribution_rewards_active':
        return isActive
          ? 'ACTIVE: Users can earn contribution rewards with rate limits.'
          : 'INACTIVE: Contribution rewards are paused.';
      case 'monthly_conversion_active':
        return isActive
          ? 'ACTIVE: Points will convert to cash monthly.'
          : 'INACTIVE: Points remain as promotional credits only.';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4 min-h-full">
      {/* Header with Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 pt-5 pb-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-[#309605]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">Financial Controls & Monitoring</h2>
              <p className="text-sm text-gray-400 mt-0.5">Manage emergency controls and monitor platform financial activity</p>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1">
            {([
              { key: 'controls', label: 'Financial Controls' },
              { key: 'monitoring', label: 'Financial Monitoring' },
            ] as const).map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key ? 'border-[#309605] text-[#309605]' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                }`}>{tab.label}</button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-5">
          {activeTab === 'controls' && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 text-[#309605] animate-spin mr-3" />
                  <span className="text-gray-600">Loading financial controls...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {message && (
                    <div
                      className={`p-4 rounded-lg mb-4 ${
                        message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                      }`}
                    >
                      {message.text}
                    </div>
                  )}

                  {/* Warning Banner */}
                  <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg mb-4">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-yellow-900">Critical System Controls</p>
                        <p className="text-xs text-yellow-800 mt-0.5">These controls affect the entire platform and take effect immediately. Only toggle if you understand the implications.</p>
                      </div>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="grid gap-3">
                    {controls.filter(c => c.control_name !== 'withdrawal_freeze').map((control) => (
                      <div key={control.control_name}
                        className="bg-gray-50 rounded-lg p-4 border border-gray-100 border-l-4"
                        style={{ borderLeftColor: control.is_active ? '#10b981' : '#9ca3af' }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-2.5">
                            {getControlIcon(control.control_name, control.is_active)}
                            <div>
                              <p className="text-sm font-semibold text-gray-900 capitalize">{control.control_name.replace(/_/g, ' ')}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{getControlDescription(control.control_name)}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => toggleControl(control.control_name, control.is_active)}
                            disabled={updating === control.control_name}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              control.is_active ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-100'
                            } disabled:opacity-50`}>
                            {updating === control.control_name ? (
                              <><RefreshCw className="w-3 h-3 animate-spin" />Updating...</>
                            ) : (
                              control.is_active ? 'Deactivate' : 'Activate'
                            )}
                          </button>
                        </div>

                        <div className="p-2.5 bg-white rounded border border-gray-100 mb-2.5">
                          <p className="text-xs text-gray-500 mb-0.5">Current Status</p>
                          <p className="text-xs font-medium text-gray-900">{getControlRecommendation(control.control_name, control.is_active)}</p>
                        </div>

                        {(control.reason || control.activated_at) && (
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            {control.reason && (
                              <div><span className="text-gray-400">Reason: </span><span className="text-gray-700 font-medium">{control.reason}</span></div>
                            )}
                            {control.activated_at && (
                              <div><span className="text-gray-400">Last Activated: </span><span className="text-gray-700 font-medium">{new Date(control.activated_at).toLocaleString()}</span></div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Status Guide */}
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-xs font-semibold text-blue-900 mb-1.5">Contribution System Status</p>
                    <div className="space-y-1 text-xs text-blue-800">
                      <p>Rate limiting active (20 actions per activity per day)</p>
                      <p>Daily earning caps active (100 points per day maximum)</p>
                      <p>Promotional credits system ready (run conversion when ready)</p>
                      <p className="pt-1.5 border-t border-blue-200"><strong>Note:</strong> To control withdrawal access, use Earnings & Payout Settings → Withdrawal Settings.</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'monitoring' && (
            <FinancialMonitoringSection />
          )}
        </div>
      </div>
    </div>
  );
};
