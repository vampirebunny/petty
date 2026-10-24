import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5';

import { adminClient } from './supabase.ts';

const TEN_YEARS_SECONDS = 60 * 60 * 24 * 365 * 10;

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function projectJwks() {
  if (!jwks) {
    const url = Deno.env.get('SUPABASE_URL');
    if (!url) {
      throw new Error('SUPABASE_URL is not set');
    }
    jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

export type GuestCheck =
  | { id: string; alreadyGone: boolean }
  | { error: string };

/** Verify a guest access token with the project JWKS. Expired tokens still pass. */
export async function guestFromAccessToken(token: string, callerId: string): Promise<GuestCheck> {
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) {
    return { error: 'SUPABASE_URL is not set' };
  }
  let subject: string;
  try {
    const { payload } = await jwtVerify(token, projectJwks(), {
      issuer: `${url}/auth/v1`,
      audience: 'authenticated',
      clockTolerance: TEN_YEARS_SECONDS,
    });
    if (typeof payload.sub !== 'string') {
      return { error: 'guest token has no subject' };
    }
    subject = payload.sub;
  } catch (error) {
    console.error('guest token verification failed', error);
    return { error: 'guest token failed verification' };
  }
  if (subject === callerId) {
    return { error: 'guest token is the caller' };
  }

  const { data, error } = await adminClient().auth.admin.getUserById(subject);
  if (error || !data.user) {
    return { id: subject, alreadyGone: true };
  }
  const user = data.user;
  if (user.is_anonymous !== true) {
    return { error: 'not an anonymous user' };
  }
  const linked = (user.identities ?? []).some(
    (identity: { provider: string }) => identity.provider !== 'anonymous',
  );
  if (linked) {
    return { error: 'guest has a linked identity' };
  }
  return { id: subject, alreadyGone: false };
}

/**
 * Record the guest, retire their limited units, then admin-delete them.
 * Does not revoke Apple or Google, and does not look for a nested guest token.
 */
export async function deleteGuestOnly(guestId: string): Promise<{ error: string } | null> {
  const admin = adminClient();
  const recorded = await admin.from('pending_guest_deletes').upsert({ user_id: guestId });
  if (recorded.error) {
    return { error: recorded.error.message };
  }
  const retired = await admin.rpc('retire_limited_units', { p_user_id: guestId });
  if (retired.error) {
    return { error: retired.error.message };
  }
  const deleted = await admin.auth.admin.deleteUser(guestId);
  if (deleted.error && !/not found/i.test(deleted.error.message)) {
    return { error: deleted.error.message };
  }
  const cleared = await admin.from('pending_guest_deletes').delete().eq('user_id', guestId);
  if (cleared.error) {
    console.error('pending guest row stayed after delete', cleared.error.message);
  }
  return null;
}
