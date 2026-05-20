import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle,
  RefreshCw,
  Search,
  Settings,
  Target,
  Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent } from '../../components/ui/card';
import { LoadingLogo } from '../../components/LoadingLogo';

interface MilestoneSettings {
  is_enabled: boolean;
  program_active: boolean;
  required_qualified_referrals: number;
  min_active_days: number;
  reward_amount_ngn: number;
  reward_amount_usd: number;
  detect_abuse: boolean;
  detect_shared_device: boolean;
  max_accounts_per_device: number;
  program_start_at: string | null;
}

interface MilestoneStats {
  referrers_tracking: number;
  referrers_ready_for_review: number;
  referrers_paid: number;
}

interface LeaderboardRow {
  referrer_id: string;
  display_name: string | null;
  email: string | null;
  referral_code: string | null;
  qualified_count: number;
  pending_count: number;
  disqualified_count: number;
  target_count: number;
  progress_percent: number;
  payout_status: string;
}

interface QualificationRow {
  referral_id: string;
  referred_name: string;
  status: string;
  active_days: number;
  min_active_days_required: number;
  disqualified_reason: string | null;
  qualified_at: string | null;
  referral_created_at: string;
  flagged_for_abuse: boolean;
}

interface SettingsForm {
  is_enabled: boolean;
  program_active: boolean;
  required_qualified_referrals: number;
  min_active_days: number;
  reward_amount_ngn: number;
  reward_amount_usd: number;
  detect_abuse: boolean;
  detect_shared_device: boolean;
  max_accounts_per_device: number;
}

const formatNgn = (amount: number): string =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);

const formatUsd = (amount: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const payoutStatusClass = (status: string): string => {
  switch (status) {
    case 'ready_for_review':
      return 'bg-amber-100 text-amber-800';
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'rejected':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const qualStatusClass = (status: string): string => {
  switch (status) {
    case 'qualified':
      return 'bg-green-100 text-green-700';
    case 'disqualified':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-yellow-100 text-yellow-800';
  }
};

function ProgressBar({ qualified, target, percent }: { qualified: number; target: number; percent: number }): JSX.Element {
  const pct = Math.min(100, percent);
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>
          {qualified}/{target}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-[#309605] rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  accent: string;
  sub?: string;
}): JSX.Element {
  return (
    <Card>
      <CardContent className="p-6">
        <Icon className={`w-8 h-8 mb-2 ${accent}`} />
        <h3 className="text-gray-600 text-sm font-medium mb-1">{label}</h3>
        <p className={`text-2xl font-bold ${accent}`}>{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SettingsFormPanel({
  formData,
  setFormData,
  isSaving,
  onSave,
}: {
  formData: SettingsForm;
  setFormData: Dispatch<SetStateAction<SettingsForm>>;
  isSaving: boolean;
  onSave: () => void;
}): JSX.Element {
  return (
    <>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={formData.is_enabled}
          onChange={(e) => setFormData((f) => ({ ...f, is_enabled: e.target.checked }))}
        />
        <span className="text-sm font-medium">Enable milestone program</span>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={formData.program_active}
          onChange={(e) => setFormData((f) => ({ ...f, program_active: e.target.checked }))}
        />
        <span className="text-sm font-medium">Program active</span>
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { key: 'required_qualified_referrals' as const, label: 'Required qualified referrals' },
          { key: 'min_active_days' as const, label: 'Min active days per referred user' },
          { key: 'reward_amount_ngn' as const, label: 'Reward (NGN)' },
          { key: 'max_accounts_per_device' as const, label: 'Max accounts per device' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
            <input
              type="number"
              min={1}
              value={formData[key]}
              onChange={(e) => setFormData((f) => ({ ...f, [key]: parseInt(e.target.value, 10) || 0 }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Reward (USD)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={formData.reward_amount_usd}
            onChange={(e) => setFormData((f) => ({ ...f, reward_amount_usd: parseFloat(e.target.value) || 0 }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={formData.detect_abuse}
          onChange={(e) => setFormData((f) => ({ ...f, detect_abuse: e.target.checked }))}
        />
        <span className="text-sm">Use referral abuse detection</span>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={formData.detect_shared_device}
          onChange={(e) => setFormData((f) => ({ ...f, detect_shared_device: e.target.checked }))}
        />
        <span className="text-sm">Block shared-device / multi-account farming</span>
      </label>
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className="px-6 py-3 bg-[#309605] text-white rounded-lg font-medium disabled:opacity-50"
      >
        {isSaving ? 'Saving...' : 'Save settings'}
      </button>
    </>
  );
}

export const ReferralMilestoneProgramTab = (): JSX.Element => {
  const [settings, setSettings] = useState<MilestoneSettings | null>(null);
  const [stats, setStats] = useState<MilestoneStats | null>(null);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready_for_review' | 'tracking' | 'paid'>('all');
  const [selectedReferrerId, setSelectedReferrerId] = useState<string | null>(null);
  const [detailQualifications, setDetailQualifications] = useState<QualificationRow[]>([]);
  const [detailPayout, setDetailPayout] = useState<Record<string, unknown> | null>(null);
  const [detailReferrer, setDetailReferrer] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [formData, setFormData] = useState<SettingsForm>({
    is_enabled: false,
    program_active: true,
    required_qualified_referrals: 10,
    min_active_days: 3,
    reward_amount_ngn: 5000,
    reward_amount_usd: 4,
    detect_abuse: true,
    detect_shared_device: true,
    max_accounts_per_device: 1,
  });

  const loadOverview = useCallback(async () => {
    const [statsRes, boardRes] = await Promise.all([
      supabase.rpc('admin_get_referral_milestone_stats'),
      supabase.rpc('admin_get_referral_milestone_leaderboard', {
        p_limit: 100,
        p_offset: 0,
        p_search: searchQuery.trim() || null,
      }),
    ]);
    if (statsRes.error) throw statsRes.error;
    if (boardRes.error) throw boardRes.error;
    const payload = statsRes.data as { settings: MilestoneSettings; stats: MilestoneStats };
    setSettings(payload.settings);
    setStats(payload.stats);
    setFormData({
      is_enabled: payload.settings.is_enabled,
      program_active: payload.settings.program_active,
      required_qualified_referrals: payload.settings.required_qualified_referrals,
      min_active_days: payload.settings.min_active_days,
      reward_amount_ngn: payload.settings.reward_amount_ngn,
      reward_amount_usd: Number(payload.settings.reward_amount_usd),
      detect_abuse: payload.settings.detect_abuse,
      detect_shared_device: payload.settings.detect_shared_device,
      max_accounts_per_device: payload.settings.max_accounts_per_device,
    });
    const board = boardRes.data as { rows: LeaderboardRow[]; total: number };
    setRows(board.rows ?? []);
    setTotalRows(board.total ?? 0);
  }, [searchQuery]);

  const loadDetail = useCallback(async (referrerId: string) => {
    const { data, error: rpcError } = await supabase.rpc('admin_get_referral_milestone_referrer_detail', {
      p_referrer_id: referrerId,
    });
    if (rpcError) throw rpcError;
    const payload = data as {
      referrer: Record<string, unknown>;
      payout: Record<string, unknown>;
      qualifications: QualificationRow[];
    };
    setDetailReferrer(payload.referrer);
    setDetailPayout(payload.payout);
    setDetailQualifications(payload.qualifications ?? []);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await loadOverview();
      if (selectedReferrerId) await loadDetail(selectedReferrerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load milestone program');
    } finally {
      setIsLoading(false);
    }
  }, [loadOverview, loadDetail, selectedReferrerId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return rows;
    return rows.filter((r) => r.payout_status === statusFilter);
  }, [rows, statusFilter]);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await supabase.rpc('admin_refresh_referral_milestone_all');
      await loadAll();
    } catch {
      alert('Failed to refresh qualifications');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await supabase.rpc('admin_update_referral_milestone_settings', {
        p_is_enabled: formData.is_enabled,
        p_program_active: formData.program_active,
        p_required_qualified_referrals: formData.required_qualified_referrals,
        p_min_active_days: formData.min_active_days,
        p_reward_amount_ngn: formData.reward_amount_ngn,
        p_reward_amount_usd: formData.reward_amount_usd,
        p_detect_abuse: formData.detect_abuse,
        p_detect_shared_device: formData.detect_shared_device,
        p_max_accounts_per_device: formData.max_accounts_per_device,
        p_program_start_at: settings?.program_start_at ?? new Date().toISOString(),
      });
      if (formData.is_enabled) await supabase.rpc('admin_refresh_referral_milestone_all');
      await loadAll();
      setShowSettings(false);
    } catch {
      alert('Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handlePayoutAction = async (referrerId: string, status: string) => {
    try {
      await supabase.rpc('admin_update_referral_milestone_payout_status', {
        p_referrer_id: referrerId,
        p_payout_status: status,
        p_admin_notes: status === 'paid' ? 'Marked paid by admin' : status === 'rejected' ? 'Rejected' : null,
      });
      await loadAll();
    } catch {
      alert('Failed to update payout status');
    }
  };

  if (isLoading && !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingLogo variant="pulse" size={32} />
        <p className="ml-4 text-gray-700">Loading milestone program...</p>
      </div>
    );
  }

  const target = settings?.required_qualified_referrals ?? 10;
  const minDays = settings?.min_active_days ?? 3;
  const rewardNgn = settings?.reward_amount_ngn ?? 5000;
  const rewardUsd = Number(settings?.reward_amount_usd ?? 4);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Program 2 — Cash milestone.</strong> Invite {target} users active {minDays}+ days each →{' '}
        {formatNgn(rewardNgn)} ({formatUsd(rewardUsd)}). Admin-only tracking; not shown in the consumer app.
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowSettings((v) => !v)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium flex items-center gap-2">
            <Settings className="w-4 h-4" /> Settings
          </button>
          <button type="button" onClick={() => void handleRefreshAll()} disabled={isRefreshing} className="px-4 py-2 rounded-lg bg-[#309605] text-white font-medium flex items-center gap-2 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Re-evaluate all
          </button>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${settings?.is_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {settings?.is_enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {showSettings && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Milestone program settings</h3>
            <SettingsFormPanel formData={formData} setFormData={setFormData} isSaving={isSavingSettings} onSave={() => void handleSaveSettings()} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Target} label="Ready for review" value={stats?.referrers_ready_for_review ?? 0} accent="text-amber-600" />
        <StatCard icon={Users} label="Tracking" value={stats?.referrers_tracking ?? 0} accent="text-blue-600" />
        <StatCard icon={CheckCircle} label="Paid out" value={stats?.referrers_paid ?? 0} accent="text-green-600" />
        <StatCard icon={Banknote} label="Reward" value={formatNgn(rewardNgn)} accent="text-[#309605]" sub={formatUsd(rewardUsd)} />
      </div>

      {!selectedReferrerId ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search referrer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void loadOverview()} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg" />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="px-4 py-2 border border-gray-300 rounded-lg">
                <option value="all">All</option>
                <option value="tracking">Tracking</option>
                <option value="ready_for_review">Ready for review</option>
                <option value="paid">Paid</option>
              </select>
              <button type="button" onClick={() => void loadOverview()} className="px-4 py-2 bg-gray-100 rounded-lg">Search</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{totalRows} referrer(s)</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Referrer</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Progress</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Qualified</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Pending</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Disqualified</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.referrer_id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium">{row.display_name || row.email || 'Unknown'}</div>
                        <div className="text-xs text-gray-500 font-mono">{row.referral_code || '—'}</div>
                      </td>
                      <td className="py-3 px-4"><ProgressBar qualified={row.qualified_count} target={row.target_count} percent={row.progress_percent} /></td>
                      <td className="py-3 px-4 text-sm text-green-700 font-medium">{row.qualified_count}</td>
                      <td className="py-3 px-4 text-sm text-yellow-700">{row.pending_count}</td>
                      <td className="py-3 px-4 text-sm text-red-600">{row.disqualified_count}</td>
                      <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${payoutStatusClass(row.payout_status)}`}>{row.payout_status.replace(/_/g, ' ')}</span></td>
                      <td className="py-3 px-4">
                        <button type="button" onClick={() => { setSelectedReferrerId(row.referrer_id); void loadDetail(row.referrer_id); }} className="px-3 py-1 bg-[#309605] text-white rounded-lg text-sm">View</button>
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-gray-500">No data yet. Enable program and re-evaluate.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <button type="button" onClick={() => setSelectedReferrerId(null)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg"><ArrowLeft className="w-4 h-4" /> Back</button>
              {detailPayout?.payout_status === 'ready_for_review' && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => void handlePayoutAction(selectedReferrerId, 'approved')} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">Approve</button>
                  <button type="button" onClick={() => void handlePayoutAction(selectedReferrerId, 'paid')} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm">Mark paid</button>
                  <button type="button" onClick={() => void handlePayoutAction(selectedReferrerId, 'rejected')} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm">Reject</button>
                </div>
              )}
            </div>
            <div className="bg-amber-50 p-6 rounded-lg mb-6">
              <h3 className="text-xl font-bold mb-2">{(detailReferrer?.display_name as string) || (detailReferrer?.email as string)}</h3>
              <p className="text-sm font-mono text-gray-600 mb-4">{(detailReferrer?.referral_code as string) || '—'}</p>
              <p className="text-lg font-semibold text-[#309605]">
                {Number(detailPayout?.qualified_count ?? 0)}/{Number(detailPayout?.target_count ?? target)} qualified → {formatNgn(rewardNgn)}
              </p>
            </div>
            <h4 className="text-lg font-semibold mb-4">Referred users</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm">User</th>
                    <th className="text-left py-3 px-4 text-sm">Active days</th>
                    <th className="text-left py-3 px-4 text-sm">Status</th>
                    <th className="text-left py-3 px-4 text-sm">Notes</th>
                    <th className="text-left py-3 px-4 text-sm">Referred</th>
                  </tr>
                </thead>
                <tbody>
                  {detailQualifications.map((q) => (
                    <tr key={q.referral_id} className="border-b border-gray-100">
                      <td className="py-3 px-4 text-sm">
                        {q.referred_name}
                        {q.flagged_for_abuse && <span className="block text-xs text-red-600 mt-1"><AlertTriangle className="w-3 h-3 inline" /> Treat program flagged</span>}
                      </td>
                      <td className="py-3 px-4 text-sm">{q.active_days} / {q.min_active_days_required}</td>
                      <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs ${qualStatusClass(q.status)}`}>{q.status}</span></td>
                      <td className="py-3 px-4 text-sm text-gray-600">{q.disqualified_reason || '—'}</td>
                      <td className="py-3 px-4 text-sm">{new Date(q.referral_created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
