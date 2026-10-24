import { deleteGuestOnly, guestFromAccessToken } from '../_shared/guest.ts';
import { callerFromRequest, json, readJson } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'POST required' }, 405);
  }
  const caller = await callerFromRequest(req);
  if (!caller || caller.is_anonymous === true) {
    return json({ error: 'account session required' }, 401);
  }
  const body = await readJson(req);
  const guestToken = typeof body.guest_access_token === 'string' ? body.guest_access_token : '';
  if (!guestToken) {
    return json({ error: 'guest_access_token required' }, 400);
  }
  const guest = await guestFromAccessToken(guestToken, caller.id);
  if ('error' in guest) {
    return json({ error: guest.error }, 400);
  }
  const failed = await deleteGuestOnly(guest.id);
  if (failed) {
    return json({ error: failed.error }, 500);
  }
  return json({ ok: true });
});
