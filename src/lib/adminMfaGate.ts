import type { SupabaseClient } from '@supabase/supabase-js';

export const ADMIN_PORTAL_ROLES = ['admin', 'manager', 'editor', 'account'] as const;

export function isAdminPortalRole(role: string | null | undefined): boolean {
  return ADMIN_PORTAL_ROLES.includes((role ?? '') as (typeof ADMIN_PORTAL_ROLES)[number]);
}

export type AdminMfaSessionState =
  | { kind: 'aal2' }
  | { kind: 'enroll_start' }
  | { kind: 'enroll_finish'; factorId: string }
  | { kind: 'verify'; factorId: string }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string };

/**
 * Supabase MFA: require AAL2 for admin dashboard access.
 * https://supabase.com/docs/guides/auth/auth-mfa
 */
export async function getAdminMfaSessionState(client: SupabaseClient): Promise<AdminMfaSessionState> {
  const mfa = client.auth.mfa;
  if (!mfa?.getAuthenticatorAssuranceLevel || !mfa.listFactors) {
    return { kind: 'unavailable' };
  }

  const { data: aal, error: aalErr } = await mfa.getAuthenticatorAssuranceLevel();
  if (aalErr) return { kind: 'error', message: aalErr.message };
  if (aal?.currentLevel === 'aal2') {
    return { kind: 'aal2' };
  }

  const { data: fac, error: facErr } = await mfa.listFactors();
  if (facErr) return { kind: 'error', message: facErr.message };

  const totp = (fac?.totp ?? []) as { id: string; status: string }[];
  const verified = totp.filter((t) => t.status === 'verified');
  if (verified.length > 0) {
    return { kind: 'verify', factorId: verified[0].id };
  }

  const unverified = totp.find((t) => t.status === 'unverified');
  if (unverified) {
    return { kind: 'enroll_finish', factorId: unverified.id };
  }

  return { kind: 'enroll_start' };
}

export async function startTotpEnrollment(
  client: SupabaseClient,
  friendlyName = 'Airaplay Admin'
): Promise<
  | { ok: true; factorId: string; qrCode: string; secret: string }
  | { ok: false; message: string }
> {
  const mfa = client.auth.mfa;
  if (!mfa?.enroll) {
    return { ok: false, message: 'MFA enrollment is not available.' };
  }
  const { data, error } = await mfa.enroll({ factorType: 'totp', friendlyName });
  if (error || !data?.id || !data.totp) {
    return { ok: false, message: error?.message ?? 'Failed to start MFA enrollment.' };
  }
  return {
    ok: true,
    factorId: data.id,
    qrCode: data.totp.qr_code ?? '',
    secret: data.totp.secret ?? '',
  };
}

export async function verifyTotpCode(
  client: SupabaseClient,
  factorId: string,
  code: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(trimmed)) {
    return { ok: false, message: 'Enter the 6-digit code from your authenticator app.' };
  }

  const mfa = client.auth.mfa;
  if (!mfa?.challenge || !mfa.verify) {
    return { ok: false, message: 'MFA verification is not available.' };
  }

  const { data: ch, error: chErr } = await mfa.challenge({ factorId });
  if (chErr || !ch?.id) {
    return { ok: false, message: chErr?.message ?? 'MFA challenge failed.' };
  }

  const { error: vErr } = await mfa.verify({
    factorId,
    challengeId: ch.id,
    code: trimmed,
  });
  if (vErr) {
    return { ok: false, message: vErr.message ?? 'Invalid code.' };
  }

  await client.auth.getSession();
  return { ok: true };
}
