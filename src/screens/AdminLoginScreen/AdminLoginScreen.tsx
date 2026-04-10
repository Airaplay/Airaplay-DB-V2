import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Clock, Shield } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { supabase, getUserRole } from '../../lib/supabase';
import { LoadingLogo } from '../../components/LoadingLogo';
import { cacheInvalidation } from '../../lib/enhancedDataFetching';
import {
  getAdminMfaSessionState,
  startTotpEnrollment,
  verifyTotpCode,
} from '../../lib/adminMfaGate';

const ADMIN_ROLES = ['admin', 'manager', 'editor', 'account'];

const getClientInfo = () => ({
  userAgent: navigator.userAgent || '',
  ip: '',
});

type MfaPhase = 'idle' | 'enroll' | 'verify';

export const AdminLoginScreen = (): JSX.Element => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [failuresRemaining, setFailuresRemaining] = useState<number | null>(null);
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [mfaPhase, setMfaPhase] = useState<MfaPhase>('idle');
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaQrCode, setMfaQrCode] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  useEffect(() => {
    checkExistingAuth();
    return () => {
      if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
    };
  }, []);

  const startLockoutTimer = (seconds: number) => {
    setLockoutSeconds(seconds);
    if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
    lockoutTimerRef.current = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(lockoutTimerRef.current!);
          setError(null);
          setFailuresRemaining(5);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const getSessionEmail = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    return (session?.user?.email ?? formData.email).trim();
  };

  const finishLoginSuccess = async () => {
    const email = (await getSessionEmail()).toLowerCase();
    await clearAttempts(email);
    await recordAttempt(email, true);

    try {
      const { userAgent } = getClientInfo();
      const role = await getUserRole();
      await supabase.rpc('log_admin_activity_with_context', {
        action_type_param: 'admin_login',
        details_param: { role, email },
        ip_address_param: '',
        user_agent_param: userAgent,
      });
    } catch {
      // Non-critical
    }

    await cacheInvalidation.byTags(['user', 'auth']);
    setMfaPhase('idle');
    navigate('/admin');
  };

  const applyMfaGate = async (): Promise<'complete' | 'mfa_ui' | 'abort'> => {
    const state = await getAdminMfaSessionState(supabase);
    if (state.kind === 'aal2') {
      return 'complete';
    }
    if (state.kind === 'error') {
      setError(state.message);
      return 'abort';
    }
    if (state.kind === 'unavailable') {
      setError(
        'Multi-factor authentication is required for admin access, but MFA APIs are unavailable. Update @supabase/supabase-js and ensure MFA is enabled for your Supabase project.'
      );
      await supabase.auth.signOut();
      return 'abort';
    }
    if (state.kind === 'verify') {
      setMfaFactorId(state.factorId);
      setMfaPhase('verify');
      setMfaCode('');
      return 'mfa_ui';
    }
    if (state.kind === 'enroll_finish') {
      setMfaFactorId(state.factorId);
      setMfaQrCode('');
      setMfaSecret('');
      setMfaPhase('enroll');
      setMfaCode('');
      return 'mfa_ui';
    }
    if (state.kind === 'enroll_start') {
      const started = await startTotpEnrollment(supabase);
      if (!started.ok) {
        setError(started.message);
        await supabase.auth.signOut();
        return 'abort';
      }
      setMfaFactorId(started.factorId);
      setMfaQrCode(started.qrCode);
      setMfaSecret(started.secret);
      setMfaPhase('enroll');
      setMfaCode('');
      return 'mfa_ui';
    }
    return 'abort';
  };

  const checkExistingAuth = async () => {
    try {
      setIsCheckingAuth(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) return;

      const role = await getUserRole();
      if (!ADMIN_ROLES.includes(role ?? '')) return;

      const gate = await applyMfaGate();
      if (gate === 'complete') {
        navigate('/admin');
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const checkRateLimit = async (email: string): Promise<{ locked: boolean; secondsRemaining: number; attemptsRemaining: number | null }> => {
    try {
      const { data, error } = await supabase.rpc('check_admin_login_rate_limit', {
        email_param: email.toLowerCase().trim(),
      });
      if (error || !data) return { locked: false, secondsRemaining: 0, attemptsRemaining: null };
      return {
        locked: data.locked ?? false,
        secondsRemaining: data.seconds_remaining ?? 0,
        attemptsRemaining: typeof data.attempts_remaining === 'number' ? data.attempts_remaining : null,
      };
    } catch {
      return { locked: false, secondsRemaining: 0, attemptsRemaining: null };
    }
  };

  const recordAttempt = async (email: string, success: boolean) => {
    try {
      const { userAgent } = getClientInfo();
      await supabase.rpc('record_admin_login_attempt', {
        email_param: email.toLowerCase().trim(),
        success_param: success,
        ip_address_param: '',
        user_agent_param: userAgent,
      });
    } catch {
      // Non-critical - don't block login on this failure
    }
  };

  const clearAttempts = async (email: string) => {
    try {
      await supabase.rpc('clear_admin_login_attempts', {
        email_param: email.toLowerCase().trim(),
      });
    } catch {
      // Non-critical
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error && lockoutSeconds === 0) setError(null);
  };

  const handleCancelMfa = async () => {
    setMfaPhase('idle');
    setMfaFactorId(null);
    setMfaQrCode('');
    setMfaSecret('');
    setMfaCode('');
    setError(null);
    await supabase.auth.signOut();
  };

  const handleMfaConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const v = await verifyTotpCode(supabase, mfaFactorId, mfaCode);
      if (!v.ok) {
        setError(v.message);
        setIsSubmitting(false);
        return;
      }
      const again = await getAdminMfaSessionState(supabase);
      if (again.kind !== 'aal2') {
        setError('MFA step incomplete. Try again.');
        setIsSubmitting(false);
        return;
      }
      await finishLoginSuccess();
    } catch (err) {
      console.error('MFA error:', err);
      setError(err instanceof Error ? err.message : 'MFA verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email.trim() || !formData.password.trim()) {
      setError('Please enter both email and password');
      return;
    }

    if (lockoutSeconds > 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const rateLimit = await checkRateLimit(formData.email);
      if (rateLimit.locked) {
        startLockoutTimer(rateLimit.secondsRemaining);
        setError(`Too many failed attempts. Please wait ${Math.ceil(rateLimit.secondsRemaining / 60)} minute(s) before trying again.`);
        setIsSubmitting(false);
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        await recordAttempt(formData.email, false);

        const updatedLimit = await checkRateLimit(formData.email);
        if (updatedLimit.locked) {
          startLockoutTimer(updatedLimit.secondsRemaining);
          setError(`Too many failed attempts. Account locked for 15 minutes.`);
        } else {
          const remaining = updatedLimit.attemptsRemaining;
          setFailuresRemaining(remaining);
          if (remaining !== null && remaining <= 2) {
            setError(`Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`);
          } else {
            setError('Invalid email or password. Please try again.');
          }
        }
        throw new Error('skip');
      }

      if (!data.user) {
        await recordAttempt(formData.email, false);
        throw new Error('Authentication failed');
      }

      const role = await getUserRole();

      if (!ADMIN_ROLES.includes(role ?? '')) {
        await supabase.auth.signOut();
        await recordAttempt(formData.email, false);
        setError('Access denied. You do not have admin privileges.');
        setIsSubmitting(false);
        return;
      }

      const gate = await applyMfaGate();
      if (gate === 'complete') {
        await finishLoginSuccess();
        setIsSubmitting(false);
        return;
      }
      if (gate === 'abort') {
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    } catch (err) {
      if (err instanceof Error && err.message !== 'skip') {
        console.error('Login error:', err);
        setError(err.message || 'An error occurred during login');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatLockoutTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) return `${m}:${s.toString().padStart(2, '0')}`;
    return `${s}s`;
  };

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <LoadingLogo variant="pulse" size={32} />
        <p className="ml-4 text-gray-900 font-medium">Checking authentication...</p>
      </div>
    );
  }

  const isLocked = lockoutSeconds > 0;

  if (mfaPhase !== 'idle' && mfaFactorId) {
    return (
      <div className="admin-layout flex items-center justify-center min-h-screen bg-gray-50 p-4 w-full">
        <div className="w-full flex items-center justify-center">
          <Card className="w-full max-w-md bg-white border border-gray-200 shadow-xl">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <img src="/Black_logo.fw.png" alt="Airaplay Admin" className="h-10 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {mfaPhase === 'enroll' ? 'Set up authenticator' : 'Two-factor verification'}
                </h1>
                <p className="text-gray-600 text-sm">
                  {mfaPhase === 'enroll'
                    ? (mfaQrCode
                        ? 'Scan the QR code in your authenticator app, then enter the 6-digit code to finish.'
                        : 'Enter the 6-digit code from your authenticator app to verify this device.')
                    : 'Enter the 6-digit code from your authenticator app.'}
                </p>
              </div>

              <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[#e6f7f1] border border-[#b0e6d4] rounded-lg">
                <Shield className="w-4 h-4 text-[#009c68] flex-shrink-0" />
                <p className="text-xs text-[#008257]">Admin access requires MFA (TOTP).</p>
              </div>

              <form onSubmit={handleMfaConfirm} className="space-y-4">
                {mfaPhase === 'enroll' && mfaQrCode ? (
                  <div className="flex justify-center">
                    <img src={mfaQrCode} alt="Authenticator QR" className="max-w-[200px] rounded-lg border border-gray-200" />
                  </div>
                ) : null}
                {mfaPhase === 'enroll' && mfaSecret ? (
                  <p className="text-xs text-gray-500 break-all text-center font-mono bg-gray-50 p-2 rounded border border-gray-100">
                    {mfaSecret}
                  </p>
                ) : null}

                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-2">6-digit code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 tracking-widest text-center text-lg"
                    placeholder="••••••"
                    maxLength={6}
                    required
                  />
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || mfaCode.length !== 6}
                  className="w-full py-3 bg-gradient-to-r from-[#309605] to-[#3ba208] hover:from-[#3ba208] hover:to-[#309605] rounded-lg text-white font-medium transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Verifying...' : 'Continue'}
                </button>

                <button
                  type="button"
                  onClick={() => handleCancelMfa()}
                  className="w-full py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Cancel and sign out
                </button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout flex items-center justify-center min-h-screen bg-gray-50 p-4 w-full">
      <div className="w-full flex items-center justify-center">
        <Card className="w-full max-w-md bg-white border border-gray-200 shadow-xl">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <img
                src="/Black_logo.fw.png"
                alt="Airaplay Admin"
                className="h-10 mx-auto mb-4"
              />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Login</h1>
              <p className="text-gray-600">Sign in to access the admin dashboard</p>
            </div>

            <div className="flex items-center gap-2 mb-6 px-3 py-2 bg-[#e6f7f1] border border-[#b0e6d4] rounded-lg">
              <Shield className="w-4 h-4 text-[#009c68] flex-shrink-0" />
              <p className="text-xs text-[#008257]">Protected area. Admin accounts require MFA (TOTP).</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="flex items-center gap-2 text-gray-700 text-sm font-medium mb-2">
                  <Mail className="w-4 h-4" />
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  disabled={isLocked}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-gray-700 text-sm font-medium mb-2">
                  <Lock className="w-4 h-4" />
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    disabled={isLocked}
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {isLocked && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3">
                  <Clock className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-orange-800 text-sm font-medium">Account temporarily locked</p>
                    <p className="text-orange-700 text-sm mt-1">
                      Too many failed attempts. Try again in{' '}
                      <span className="font-bold tabular-nums">{formatLockoutTime(lockoutSeconds)}</span>
                    </p>
                  </div>
                </div>
              )}

              {error && !isLocked && (
                <div className={`p-4 border rounded-lg flex items-start gap-3 ${
                  failuresRemaining !== null && failuresRemaining <= 2
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    failuresRemaining !== null && failuresRemaining <= 2 ? 'text-orange-500' : 'text-red-500'
                  }`} />
                  <p className={`text-sm ${
                    failuresRemaining !== null && failuresRemaining <= 2 ? 'text-orange-800' : 'text-red-700'
                  }`}>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || isLocked}
                className="w-full py-3 bg-gradient-to-r from-[#309605] to-[#3ba208] hover:from-[#3ba208] hover:to-[#309605] rounded-lg text-white font-medium transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Signing In...' : isLocked ? `Locked (${formatLockoutTime(lockoutSeconds)})` : 'Sign In'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-gray-600 hover:text-gray-900 text-sm transition-colors duration-200"
                >
                  Back to Home
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
