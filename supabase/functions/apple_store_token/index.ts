import { appleClientId, exchangeAuthorizationCode } from '../_shared/apple.ts';
import { adminClient, callerFromRequest, json, readJson } from '../_shared/supabase.ts';

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
  const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : '';

  let stored = refreshToken;
  if (authorizationCode) {
    const exchanged = await exchangeAuthorizationCode(authorizationCode);
    if (!exchanged) {
      return json({ error: 'apple token exchange failed' }, 502);
    }
    stored = exchanged;
  }
  if (!stored) {
    return json({ error: 'authorizationCode or refresh_token required' }, 400);
  }
  if (refreshToken && !authorizationCode) {
    appleClientId('web');
  }

  const saved = await adminClient().rpc('store_apple_refresh_token', {
    p_user_id: caller.id,
    p_refresh_token: stored,
  });
  if (saved.error) {
    return json({ error: saved.error.message }, 500);
  }
  return json({ ok: true });
});
