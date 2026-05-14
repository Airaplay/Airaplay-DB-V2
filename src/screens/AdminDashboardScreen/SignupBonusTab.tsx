import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Gift,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Users,
  DollarSign,
  Coins,
  Calendar,
  Mail,
  StopCircle,
  PlayCircle,
  Clock,
  Wallet,
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import { supabase } from '../../lib/supabase';
import { LoadingLogo } from '../../components/LoadingLogo';

interface SignupBonusSettings {
  is_enabled: boolean;
  bonus_amount_treats: number;
  min_signup_date: string | null;
  end_at: string | null;
  max_total_users: number | null;
  require_email_verified: boolean;
  total_users_awarded: number;
  total_treats_awarded: number;
  updated_at: string | null;
  updated_by: string | null;
}

interface SignupBonusStats {
  users_awarded: number;
  users_awarded_today: number;
  users_awarded_this_month: number;
  total_treats_given: number;
  total_usd_cost: number;
  current_treat_to_usd_rate: number;
  projected_usd_cost_per_new_user: number;
  remaining_budget_users: number | null;
  promo_outstanding_treats: number;
  promo_outstanding_usd: number;
}

interface ClaimRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  treats_awarded: number;
  usd_cost_at_award: number;
  treat_to_usd_rate_at_award: number;
  claimed_at: string;
}

const RECENT_LIMIT = 25;

const toIsoOrNull = (local: string): string | null => {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const toLocalInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatUsd = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(Number.isFinite(amount) ? amount : 0);

const formatNumber = (n: number): string =>
  new Intl.NumberFormat('en-US').format(Number.isFinite(n) ? n : 0);

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
};

export const SignupBonusTab = (): JSX.Element => {
  const [settings, setSettings] = useState<SignupBonusSettings | null>(null);
  const [stats, setStats] = useState<SignupBonusStats | null>(null);
  const [recent, setRecent] = useState<ClaimRow[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state (separate from settings so we can edit without overwriting stats).
  const [form, setForm] = useState({
    is_enabled: false,
    bonus_amount_treats: 50,
    min_signup_date: '',
    end_at: '',
    max_total_users: '' as string,
    require_email_verified: false,
  });

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsRes, recentRes] = await Promise.all([
        supabase.rpc('admin_get_signup_bonus_stats'),
        supabase.rpc('admin_get_signup_bonus_recent_claims', {
          p_limit: RECENT_LIMIT,
          p_offset: 0,
        }),
      ]);

      if (statsRes.error) throw statsRes.error;
      if (recentRes.error) throw recentRes.error;

      const payload = statsRes.data as { settings: SignupBonusSettings; stats: SignupBonusStats };

      setSettings(payload.settings);
      setStats(payload.stats);
      setRecent((recentRes.data as ClaimRow[]) ?? []);

      setForm({
        is_enabled: payload.settings.is_enabled,
        bonus_amount_treats: payload.settings.bonus_amount_treats ?? 0,
        min_signup_date: toLocalInput(payload.settings.min_signup_date),
        end_at: toLocalInput(payload.settings.end_at),
        max_total_users:
          payload.settings.max_total_users === null || payload.settings.max_total_users === undefined
            ? ''
            : String(payload.settings.max_total_users),
        require_email_verified: payload.settings.require_email_verified,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load sign-up bonus data';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const saveSettings = useCallback(
    async (overrideIsEnabled?: boolean) => {
      setIsSaving(true);
      setError(null);
      setSuccess(null);
      try {
        const parsedAmount = Number(form.bonus_amount_treats);
        if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
          throw new Error('Bonus amount must be a non-negative number.');
        }

        let parsedCap: number | null = null;
        if (form.max_total_users.trim() !== '') {
          const n = Number(form.max_total_users);
          if (!Number.isFinite(n) || n < 0) {
            throw new Error('Maximum total users must be a non-negative number, or blank for no cap.');
          }
          parsedCap = Math.floor(n);
        }

        const { error: rpcError } = await supabase.rpc('admin_update_signup_bonus_settings', {
          p_is_enabled: overrideIsEnabled ?? form.is_enabled,
          p_bonus_amount_treats: Math.floor(parsedAmount),
          p_min_signup_date: toIsoOrNull(form.min_signup_date),
          p_end_at: toIsoOrNull(form.end_at),
          p_max_total_users: parsedCap,
          p_require_email_verified: form.require_email_verified,
        });

        if (rpcError) throw rpcError;

        setSuccess('Sign-up bonus settings saved.');
        await loadAll();
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to save settings';
        setError(msg);
      } finally {
        setIsSaving(false);
      }
    },
    [form, loadAll],
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void saveSettings();
  };

  const handleStopNow = useCallback(async () => {
    if (
      !window.confirm(
        'Stop the sign-up bonus now? Users signing up afterwards will NOT receive any bonus until you re-enable it.',
      )
    ) {
      return;
    }
    setIsStopping(true);
    try {
      await saveSettings(false);
    } finally {
      setIsStopping(false);
    }
  }, [saveSettings]);

  const handleResumeNow = useCallback(async () => {
    setIsStopping(true);
    try {
      await saveSettings(true);
    } finally {
      setIsStopping(false);
    }
  }, [saveSettings]);

  const campaignStatus = useMemo(() => {
    if (!settings) return null;
    if (!settings.is_enabled) return { label: 'Stopped', color: 'bg-gray-100 text-gray-700' };
    if (settings.end_at && new Date(settings.end_at).getTime() < Date.now()) {
      return { label: 'Ended (auto-stopped)', color: 'bg-amber-100 text-amber-800' };
    }
    if (
      settings.max_total_users !== null &&
      settings.max_total_users !== undefined &&
      settings.total_users_awarded >= settings.max_total_users
    ) {
      return { label: 'Cap reached', color: 'bg-amber-100 text-amber-800' };
    }
    return { label: 'Active', color: 'bg-green-100 text-green-800' };
  }, [settings]);

  if (isLoading) {
    return (
      <Card className="bg-white p-6">
        <div className="flex items-center justify-center py-12">
          <LoadingLogo variant="pulse" size={32} />
          <p className="ml-4 text-gray-700">Loading sign-up bonus data...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
            <Gift className="w-5 h-5 text-[#309605]" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 leading-tight">Sign-up Treat Bonus</h3>
            <p className="text-sm text-gray-500">
              Give new users a configurable amount of Treats. Non-withdrawable. Admin can stop at any time.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {campaignStatus && (
            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${campaignStatus.color}`}>
              {campaignStatus.label}
            </span>
          )}
          <button
            onClick={() => void loadAll()}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">How this works</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Bonus treats are credited as <strong>non-withdrawable promotional credits</strong>. Users can spend them inside the platform but cannot cash them out.</li>
              <li>Each user can receive the bonus <strong>only once, ever</strong>. Repeated attempts are silently ignored.</li>
              <li>Only users created on/after <em>Min sign-up date</em> are eligible — so flipping the toggle on does not retroactively reward every existing user.</li>
              <li>The bonus stops automatically when you reach <em>End date</em> or <em>Max total users</em> — or instantly when you press <strong>Stop now</strong>.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Messages */}
      {(error || success) && (
        <div
          className={`p-4 rounded-lg border ${
            error ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'
          }`}
        >
          {error ?? success}
        </div>
      )}

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white p-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-600">Users awarded</h4>
              <Users className="w-4 h-4 text-[#309605]" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.users_awarded)}</p>
            <p className="text-xs text-gray-500 mt-1">
              Today: {formatNumber(stats.users_awarded_today)} · This month: {formatNumber(stats.users_awarded_this_month)}
            </p>
          </Card>

          <Card className="bg-white p-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-600">Treats given</h4>
              <Coins className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_treats_given)}</p>
            <p className="text-xs text-gray-500 mt-1">Total bonus treats credited</p>
          </Card>

          <Card className="bg-white p-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-600">Cost spent (USD)</h4>
              <DollarSign className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">{formatUsd(stats.total_usd_cost)}</p>
            <p className="text-xs text-gray-500 mt-1">
              Per new user: {formatUsd(stats.projected_usd_cost_per_new_user)} at current rate
            </p>
          </Card>

          <Card className="bg-white p-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-600">Outstanding liability</h4>
              <Wallet className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-700">{formatUsd(stats.promo_outstanding_usd)}</p>
            <p className="text-xs text-gray-500 mt-1">
              {formatNumber(stats.promo_outstanding_treats)} promo treats still unspent
            </p>
          </Card>
        </div>
      )}

      {/* Cap progress / remaining budget */}
      {stats && settings && settings.max_total_users !== null && settings.max_total_users !== undefined && (
        <Card className="bg-white p-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">Campaign cap</h4>
            <span className="text-xs text-gray-500">
              {formatNumber(stats.users_awarded)} / {formatNumber(settings.max_total_users)} users
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-[#309605] h-2 rounded-full transition-all"
              style={{
                width: `${
                  settings.max_total_users > 0
                    ? Math.min(100, (stats.users_awarded / settings.max_total_users) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {stats.remaining_budget_users !== null
              ? `${formatNumber(stats.remaining_budget_users)} new users remaining before the bonus auto-stops.`
              : 'No cap configured.'}
          </p>
        </Card>
      )}

      {/* Settings form */}
      <Card className="bg-white">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <h4 className="text-lg font-semibold text-gray-900">Configuration</h4>

          {/* Master switch + Stop now */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="pr-4">
              <h5 className="font-medium text-gray-900 mb-1">Enable sign-up bonus</h5>
              <p className="text-gray-600 text-sm">
                New eligible users will be credited automatically on their first session.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_enabled}
                onChange={(e) => setForm((f) => ({ ...f, is_enabled: e.target.checked }))}
                className="sr-only"
              />
              <div
                className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                  form.is_enabled ? 'bg-[#309605]' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ${
                    form.is_enabled ? 'translate-x-5' : 'translate-x-0'
                  } mt-0.5 ml-0.5`}
                />
              </div>
            </label>
          </div>

          {/* Bonus amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bonus amount (treats) *
            </label>
            <div className="relative max-w-xs">
              <Coins className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min={0}
                step={1}
                value={form.bonus_amount_treats}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bonus_amount_treats: Number(e.target.value) }))
                }
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
              />
            </div>
            {stats && (
              <p className="text-xs text-gray-500 mt-1">
                ≈ {formatUsd(form.bonus_amount_treats * stats.current_treat_to_usd_rate)} per new user at the
                current rate of {formatUsd(stats.current_treat_to_usd_rate)} / treat.
              </p>
            )}
          </div>

          {/* Eligibility row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1 text-gray-500" />
                Min sign-up date (eligibility)
              </label>
              <input
                type="datetime-local"
                value={form.min_signup_date}
                onChange={(e) => setForm((f) => ({ ...f, min_signup_date: e.target.value }))}
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Only users registered on/after this time receive the bonus. Defaults to "now".
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-1 text-gray-500" />
                End date (optional)
              </label>
              <input
                type="datetime-local"
                value={form.end_at}
                onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Bonus auto-stops at this time. Leave blank for no end date.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="w-4 h-4 inline mr-1 text-gray-500" />
                Max total users (optional cap)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.max_total_users}
                onChange={(e) => setForm((f) => ({ ...f, max_total_users: e.target.value }))}
                placeholder="No cap"
                className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Bonus auto-stops once this many users have been awarded. Leave blank for unlimited.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-1 text-gray-500" />
                Require email verification
              </label>
              <label className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.require_email_verified}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, require_email_verified: e.target.checked }))
                  }
                  className="w-4 h-4 text-[#309605] rounded"
                />
                <span className="text-sm text-gray-700">
                  Only credit users whose email is confirmed
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Helps prevent throwaway-email abuse.
              </p>
            </div>
          </div>

          {/* Action row */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-[#309605] text-white rounded-lg text-sm font-medium hover:bg-[#3ba208] disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save settings'}
            </button>

            {settings?.is_enabled ? (
              <button
                type="button"
                onClick={handleStopNow}
                disabled={isStopping}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
              >
                <StopCircle className="w-4 h-4" />
                {isStopping ? 'Stopping…' : 'Stop now'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResumeNow}
                disabled={isStopping}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-2"
              >
                <PlayCircle className="w-4 h-4" />
                {isStopping ? 'Resuming…' : 'Resume now'}
              </button>
            )}

            <button
              type="button"
              onClick={() => void loadAll()}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Reload
            </button>
          </div>
        </form>
      </Card>

      {/* Recent claims */}
      <Card className="bg-white">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">Recent grants</h4>
            <span className="text-xs text-gray-500">Showing latest {RECENT_LIMIT}</span>
          </div>
          {recent.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              <CheckCircle className="w-6 h-6 mx-auto text-gray-300 mb-2" />
              No sign-up bonuses have been awarded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4 text-right">Treats</th>
                    <th className="py-2 pr-4 text-right">Cost</th>
                    <th className="py-2 pr-4 text-right">Rate @ award</th>
                    <th className="py-2 pr-0 text-right">Claimed at</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr
                      key={row.user_id}
                      className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60"
                    >
                      <td className="py-2 pr-4 text-gray-900">{row.display_name || '—'}</td>
                      <td className="py-2 pr-4 text-gray-600">{row.email || '—'}</td>
                      <td className="py-2 pr-4 text-right text-gray-900 font-medium">
                        {formatNumber(row.treats_awarded)}
                      </td>
                      <td className="py-2 pr-4 text-right text-red-600 font-medium">
                        {formatUsd(row.usd_cost_at_award)}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-500">
                        {formatUsd(row.treat_to_usd_rate_at_award)}
                      </td>
                      <td className="py-2 pr-0 text-right text-gray-500">
                        {formatDate(row.claimed_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
