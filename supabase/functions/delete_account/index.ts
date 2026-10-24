import { exchangeAuthorizationCode, revokeRefreshToken } from '../_shared/apple.ts';
import { deleteGuestOnly, guestFromAccessToken } from '../_shared/guest.ts';
import { adminClient, callerFromRequest, json, readJson } from '../_shared/supabase.ts';

function hasApple(user: { identities?: { provider: string }[] }): boolean {
  return (user.identities ?? []).some((identity) => identity.provider === 'apple');
}

function hasGoogle(user: { identities?: { provider: string }[] }): boolean {
  return (user.identities ?? []).some((identity) => identity.provider === 'google');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'POST required' }, 405);
  }
  const caller = await callerFromRequest(req);
  if (!caller) {
    return json({ error: 'not authenticated' }, 401);
  }
  const body = await readJson(req);
  const authorizationCode = typeof body.authorizationCode === 'string' ? body.authorizationCode : '';
  const skipApple = body.p_skip_apple_revoke === true;
  const guestToken = typeof body.guest_access_token === 'string' ? body.guest_access_token : '';
  const admin = adminClient();

  let refreshToken: string | null = null;
  if (authorizationCode) {
    refreshToken = await exchangeAuthorizationCode(authorizationCode);
    if (!refreshToken) {
      console.error('apple authorization code could not be exchanged; continuing deletion');
    }
  } else {
    const stored = await admin.rpc('read_apple_refresh_token', { p_user_id: caller.id });
    if (stored.error) {
      return json({ error: stored.error.message }, 500);
    }
    refreshToken = typeof stored.data === 'string' ? stored.data : null;
  }

  if (refreshToken) {
    const revoked = await revokeRefreshToken(refreshToken, 'native');
    if (!revoked) {
      await revokeRefreshToken(refreshToken, 'web');
    }
  } else if (!authorizationCode && hasApple(caller) && !skipApple) {
    return json({ needs_apple_reauth: true });
  } else if (hasApple(caller)) {
    console.error('no Apple token stored; deletion continues with revoke skipped');
  }

  if (hasGoogle(caller)) {
    console.error('no Google token stored; revoke skipped');
  }

  if (guestToken) {
    const guest = await guestFromAccessToken(guestToken, caller.id);
    if ('error' in guest) {
      return json({ error: guest.error }, 400);
    }
    const failed = await deleteGuestOnly(guest.id);
    if (failed) {
      return json({ error: failed.error }, 500);
    }
  }

  const retired = await admin.rpc('retire_limited_units', { p_user_id: caller.id });
  if (retired.error) {
    return json({ error: retired.error.message }, 500);
  }
  const deleted = await admin.auth.admin.deleteUser(caller.id);
  if (deleted.error) {
    return json({ error: deleted.error.message }, 500);
  }
  return json({ ok: true });
});
