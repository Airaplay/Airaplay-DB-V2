import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Globe, Eye, EyeOff, Chrome, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { countries } from '../lib/countries';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const navigate = useNavigate();
  const { location } = useLocation(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    display_name: '',
    country: '',
    gender: '',
    referral_code: '',
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [isValidatingReferral, setIsValidatingReferral] = useState(false);
  const [referralValidationMessage, setReferralValidationMessage] = useState<string | null>(null);

  const validateReferralCode = async (code: string) => {
    if (!code || code.trim() === '') {
      setReferralValidationMessage(null);
      return true;
    }

    setIsValidatingReferral(true);
    setReferralValidationMessage(null);

    try {
      const { data: referralData, error: referralError } = await supabase
        .from('referral_codes')
        .select('user_id, code')
        .eq('code', code.trim())
        .maybeSingle();

      if (referralError) {
        setReferralValidationMessage('Error validating referral code');
        return false;
      }

      if (!referralData) {
        setReferralValidationMessage('Invalid referral code');
        return false;
      }

      const { data: limitCheck, error: limitError } = await supabase.rpc('check_referral_limit', {
        p_user_id: referralData.user_id,
      });

      if (limitError) {
        console.error('Error checking referral limit:', limitError);
        setReferralValidationMessage('Valid referral code');
        return true;
      }

      const canRefer = limitCheck?.can_refer ?? true;

      if (!canRefer) {
        const reason = limitCheck?.reason || 'Referrer has reached their limit';
        setReferralValidationMessage(reason);
        return false;
      }

      setReferralValidationMessage('Valid referral code');
      return true;
    } catch (err) {
      console.error('Error validating referral code:', err);
      setReferralValidationMessage('Error validating referral code');
      return false;
    } finally {
      setIsValidatingReferral(false);
    }
  };

  const handleReferralCodeBlur = () => {
    const code = formData.referral_code.trim();
    if (code) {
      validateReferralCode(code);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    if (refCode) {
      setIsSignUp(true);
      setReferralCode(refCode);
      setFormData(prev => ({ ...prev, referral_code: refCode }));
      sessionStorage.setItem('referralCode', refCode);
      validateReferralCode(refCode);
    } else {
      const savedRefCode = sessionStorage.getItem('referralCode');
      if (savedRefCode) {
        setReferralCode(savedRefCode);
        setFormData(prev => ({ ...prev, referral_code: savedRefCode }));
      }
    }
  }, []);

  useEffect(() => {
    if (location?.detected && location.location.countryCode) {
      setFormData(prev => ({ ...prev, country: location.location.countryCode }));
    }
  }, [location]);

  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const validatePassword = (password: string): { valid: boolean; message: string } => {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    if (password.length > 128) {
      return { valid: false, message: 'Password must be less than 128 characters' };
    }
    // Check for at least one letter and one number
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      return { valid: false, message: 'Password must contain at least one letter and one number' };
    }
    return { valid: true, message: '' };
  };

  const validateDisplayName = (name: string): { valid: boolean; message: string } => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      return { valid: false, message: 'Display name must be at least 2 characters long' };
    }
    if (trimmed.length > 50) {
      return { valid: false, message: 'Display name must be less than 50 characters' };
    }
    // Allow letters, numbers, spaces, hyphens, and underscores
    const nameRegex = /^[a-zA-Z0-9\s\-_]+$/;
    if (!nameRegex.test(trimmed)) {
      return { valid: false, message: 'Display name can only contain letters, numbers, spaces, hyphens, and underscores' };
    }
    return { valid: true, message: '' };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    if (name === 'referral_code') {
      setReferralValidationMessage(null);
    }

    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const handleTermsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAgreedToTerms(e.target.checked);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setResetEmailSent(true);
    } catch (err) {
      console.error('Password reset error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isForgotPassword) {
      return handleForgotPassword(e);
    }

    // Validate email
    if (!formData.email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (!formData.password) {
      setError('Please enter your password');
      return;
    }

    if (isSignUp) {
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.valid) {
        setError(passwordValidation.message);
        return;
      }

      // Validate display name for signup
      if (formData.display_name.trim()) {
        const nameValidation = validateDisplayName(formData.display_name);
        if (!nameValidation.valid) {
          setError(nameValidation.message);
          return;
        }
      }

      if (!agreedToTerms) {
        setError('You must agree to the terms and conditions to continue');
        return;
      }

      if (!formData.country) {
        setError('Please select your country');
        return;
      }

      if (!formData.gender) {
        setError('Please select your gender');
        return;
      }

      if (formData.referral_code.trim()) {
        const isValid = await validateReferralCode(formData.referral_code.trim());
        if (!isValid) {
          setError('Please enter a valid referral code or leave it empty');
          return;
        }
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isSignUp) {
        const detectedCountry = location?.location?.countryCode || formData.country;
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              display_name: formData.display_name,
              country: detectedCountry,
            },
          },
        });
        if (signUpError) throw signUpError;
        if (data.user) {
          const finalCountry = detectedCountry || formData.country;
          await supabase.from('users').insert({
            id: data.user.id,
            email: data.user.email || '',
            display_name: formData.display_name || null,
            role: 'listener',
            country: finalCountry,
            gender: formData.gender,
            country_last_changed_at: new Date().toISOString(),
          });

          const finalReferralCode = formData.referral_code.trim() || referralCode;

          if (finalReferralCode) {
            const { data: referrerData } = await supabase
              .from('referral_codes')
              .select('user_id')
              .eq('code', finalReferralCode)
              .maybeSingle();

            if (referrerData) {
              const { data: limitCheck } = await supabase.rpc('check_referral_limit', {
                p_user_id: referrerData.user_id,
              });

              const canRefer = limitCheck?.can_refer ?? true;

              const { error: referralInsertError } = await supabase.from('referrals').insert({
                referrer_id: referrerData.user_id,
                referred_id: data.user.id,
                referral_code: finalReferralCode,
                status: 'pending',
              });

              if (referralInsertError) {
                console.error('Failed to create referral record:', referralInsertError);
              } else if (canRefer) {
                await supabase.rpc('increment_referral_counts', {
                  p_user_id: referrerData.user_id,
                });
              }

              sessionStorage.removeItem('referralCode');
            }
          }
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (signInError) throw signInError;
      }
      onSuccess();
    } catch (err) {
      console.error('Auth error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      let redirectUrl = `${window.location.origin}/`;
      if (referralCode) {
        redirectUrl += `?ref=${referralCode}`;
      }

      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (googleError) throw googleError;
    } catch (err) {
      console.error('Google auth error:', err);
      setError(err instanceof Error ? err.message : 'Google authentication failed');
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-[110] p-4 overflow-y-auto scrollbar-hide">
      <Card className="w-full max-w-sm bg-black border border-white/15 rounded-2xl shadow-xl overflow-hidden my-auto">
        <CardContent className="p-6 space-y-6 max-h-[90vh] overflow-y-auto scrollbar-hide">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold text-xl tracking-tight">
              {isForgotPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white/70" />
            </button>
          </div>

          {!isForgotPassword && (
            <>
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isGoogleLoading || isSubmitting}
                className="w-full h-12 bg-white rounded-lg flex items-center justify-center gap-3 font-medium text-gray-900 shadow hover:bg-gray-100 transition-all"
              >
                {isGoogleLoading ? (
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Chrome className="w-5 h-5" />
                )}
                {isGoogleLoading ? 'Connecting...' : 'Continue with Google'}
              </button>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-white/20" />
                <span className="text-white/60 text-sm">or</span>
                <div className="flex-1 h-px bg-white/20" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {resetEmailSent ? (
              <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">
                Password reset email sent! Please check your inbox and follow the instructions.
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center gap-2 text-white/70 text-sm mb-1">
                    <Mail className="w-4 h-4" />
                    Email
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your email"
                    className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-[#3ba208]/60 outline-none"
                  />
                </div>

                {!isForgotPassword && (
                  <div>
                    <div className="flex items-center justify-between text-white/70 text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        Password
                      </div>
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgotPassword(true);
                            setError(null);
                          }}
                          className="text-[#3ba208] hover:underline text-xs"
                        >
                          Forgot?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        placeholder="Enter your password"
                        className="w-full h-12 px-4 pr-12 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-[#3ba208]/60 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5 text-white/60" />
                        ) : (
                          <Eye className="w-5 h-5 text-white/60" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {isSignUp && (
                  <>
                    <div>
                      <div className="flex items-center gap-2 text-white/70 text-sm mb-1">
                        <User className="w-4 h-4" />
                        Display Name
                      </div>
                      <input
                        type="text"
                        name="display_name"
                        value={formData.display_name}
                        onChange={handleInputChange}
                        placeholder="Your display name"
                        className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-[#3ba208]/60 outline-none"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-white/70 text-sm mb-1">
                        <Globe className="w-4 h-4" />
                        Country <span className="text-red-400">*</span>
                      </div>
                      <div className="relative">
                        <select
                          name="country"
                          value={formData.country}
                          onChange={handleInputChange}
                          required
                          className="w-full h-12 px-4 pr-10 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-[#3ba208]/60 outline-none appearance-none"
                        >
                          <option value="" className="bg-black text-white/50">
                            Select your country
                          </option>
                          {countries.map((country) => (
                            <option
                              key={country.code}
                              value={country.code}
                              className="bg-black text-white"
                            >
                              {country.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-white/70 text-sm mb-1">
                        <User className="w-4 h-4" />
                        Gender <span className="text-red-400">*</span>
                      </div>
                      <div className="relative">
                        <select
                          name="gender"
                          value={formData.gender}
                          onChange={handleInputChange}
                          required
                          className="w-full h-12 px-4 pr-10 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-[#3ba208]/60 outline-none appearance-none"
                        >
                          <option value="" className="bg-black text-white/50">
                            Select your gender
                          </option>
                          <option value="male" className="bg-black text-white">
                            Male
                          </option>
                          <option value="female" className="bg-black text-white">
                            Female
                          </option>
                          <option value="other" className="bg-black text-white">
                            Other
                          </option>
                          <option value="prefer_not_to_say" className="bg-black text-white">
                            Prefer not to say
                          </option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-white/70 text-sm mb-1">
                        <User className="w-4 h-4" />
                        Referral Code (Optional)
                      </div>
                      <input
                        type="text"
                        name="referral_code"
                        value={formData.referral_code}
                        onChange={handleInputChange}
                        onBlur={handleReferralCodeBlur}
                        placeholder="Enter referral code"
                        className="w-full h-12 px-4 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:ring-2 focus:ring-[#3ba208]/60 outline-none"
                      />
                      {isValidatingReferral && (
                        <p className="text-white/60 text-xs mt-1">Validating...</p>
                      )}
                      {referralValidationMessage && (
                        <p
                          className={`text-xs mt-1 ${
                            referralValidationMessage === 'Valid referral code'
                              ? 'text-green-400'
                              : 'text-red-400'
                          }`}
                        >
                          {referralValidationMessage}
                        </p>
                      )}
                    </div>

                    <label className="flex items-start gap-3 text-sm text-white/70 cursor-pointer mt-2">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={handleTermsChange}
                        className="mt-1 w-5 h-5 accent-[#3ba208]"
                      />
                      <span>
                        By signing up, you agree to our{' '}
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate('/terms/user-signup');
                          }}
                          className="text-[#3ba208] underline"
                        >
                          Terms & Conditions
                        </button>
                      </span>
                    </label>
                  </>
                )}

                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-md text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || (isSignUp && !agreedToTerms)}
                  className="w-full h-12 rounded-lg font-medium text-black bg-white shadow-lg hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting
                    ? isForgotPassword
                      ? 'Sending...'
                      : isSignUp
                      ? 'Creating...'
                      : 'Signing in...'
                    : isForgotPassword
                    ? 'Send Reset Link'
                    : isSignUp
                    ? 'Sign Up'
                    : 'Sign In'}
                </button>
              </>
            )}
          </form>

          <div className="text-center space-y-2">
            {isForgotPassword ? (
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setResetEmailSent(false);
                  setError(null);
                }}
                className="text-white/70 text-sm hover:text-white transition-colors"
              >
                Back to Sign In
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                  const currentReferralCode = formData.referral_code;
                  setFormData({ email: '', password: '', display_name: '', country: '', gender: '', referral_code: currentReferralCode });
                  setAgreedToTerms(false);
                  setReferralValidationMessage(null);
                }}
                className="text-white/70 text-sm hover:text-white transition-colors"
              >
                {isSignUp
                  ? 'Already have an account? Sign In'
                  : "Don't have an account? Create one"}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
