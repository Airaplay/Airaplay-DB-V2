import type { SupabaseClient } from '@supabase/supabase-js';

export const ADMIN_PORTAL_ROLES = ['admin', 'manager', 'editor', 'account'] as const;

export function isAdminPortalRole(role: string | null | undefined): boolean {
  return ADMIN_PORTAL_ROLES.includes((role ?? '') as (typeof ADMIN_PORTAL_ROLES)[number]);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    return JSON.parse(atob(b64 + pad)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Reads Auth JWT `amr` (authentication methods reference).
 * After password + email OTP, Supabase typically includes both `password` and `otp`
 * (or `email` / `magiclink` depending on project templates).
 */
export function parseJwtAmrMethods(accessToken: string | undefined): string[] {
  if (!accessToken) return [];
  const payload = decodeJwtPayload(accessToken);
  const amr = payload?.amr;
  if (!Array.isArray(amr)) return [];
  return amr
    .map((e) => (typeof e === 'object' && e !== null && 'method' in e ? String((e as { method: string }).method) : ''))
    .filter(Boolean)
    .map((m) => m.toLowerCase());
}

export function hasAdminPasswordAndEmailOtpStepUp(accessToken: string | undefined): boolean {
  if (!accessToken) return false;
  const payload = decodeJwtPayload(accessToken);
  const amr = payload?.amr;
  if (!Array.isArray(amr)) return false;
  const methods = parseJwtAmrMethods(accessToken);
  const set = new Set(methods);
  const hasPassword = set.has('password');
  const hasOtpLike =
    set.has('otp') ||
    set.has('email') ||
    set.has('magiclink') ||
    set.has('magic_link') ||
    set.has('totp');
  if (hasPassword && hasOtpLike) return true;
  // Some sessions list multiple `amr` steps; password + email OTP can appear as a two-step chain
  if (hasOtpLike && amr.length >= 2) return true;
  return false;
}

/**
 * Sends a Supabase Auth email OTP (6-digit code) to an existing user.
 * Dashboard Auth → Email templates should be configured for OTP / magic link per your project.
 */
export async function sendAdminLoginEmailOtp(
  client: SupabaseClient,
  email: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    return { ok: false, message: 'Email is required.' };
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const { error } = await client.auth.signInWithOtp({
    email: trimmed,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: origin ? `${origin}/admin/login` : undefined,
    },
  });

  if (error) {
    return { ok: false, message: error.message ?? 'Failed to send email code.' };
  }
  return { ok: true };
}

export async function verifyAdminLoginEmailOtp(
  client: SupabaseClient,
  email: string,
  token: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = token.replace(/\s/g, '');
  if (!/^\d{6}$/.test(trimmed)) {
    return { ok: false, message: 'Enter the 6-digit code from your email.' };
  }

  const { error } = await client.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: trimmed,
    type: 'email',
  });

  if (error) {
    return { ok: false, message: error.message ?? 'Invalid or expired code.' };
  }

  await client.auth.getSession();
  return { ok: true };
}
