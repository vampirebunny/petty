import { adminClient, callerFromRequest, json, readJson } from '../_shared/supabase.ts';

type TokenRow = { token: string };

type ExpoTicket = {
  status?: string;
  details?: { error?: string };
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'POST required' }, 405);
  }
  const caller = await callerFromRequest(req);
  if (!caller || caller.is_anonymous) {
    return json({ error: 'account required' }, 403);
  }
  const body = await readJson(req);
  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  if (!requestId) {
    return json({ error: 'not found' }, 400);
  }
  const admin = adminClient();
  const request = await admin
    .from('friend_requests')
    .select('id, requester_id, addressee_id, status, notified_at')
    .eq('id', requestId)
    .maybeSingle();
  if (request.error || !request.data || request.data.requester_id !== caller.id || request.data.status !== 'pending') {
    return json({ error: 'not found' }, 404);
  }
  if (request.data.notified_at) {
    return json({ ok: true });
  }
  const addressee = request.data.addressee_id as string;
  const blocked = await admin
    .from('blocks')
    .select('blocker_id')
    .eq('blocker_id', addressee)
    .eq('blocked_id', caller.id)
    .maybeSingle();
  const settings = await admin
    .from('notification_settings')
    .select('friend_requests')
    .eq('user_id', addressee)
    .maybeSingle();
  const allowed = settings.data?.friend_requests !== false && !blocked.data;
  const profile = await admin.from('profiles').select('handle').eq('user_id', caller.id).maybeSingle();
  const handle = profile.data && typeof profile.data.handle === 'string' ? profile.data.handle : '';
  if (allowed && handle) {
    const tokens = await admin.from('push_tokens').select('token').eq('player_id', addressee);
    const rows = (tokens.data ?? []) as TokenRow[];
    if (rows.length > 0) {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          rows.map((row) => ({
            to: row.token,
            title: 'Boop Boop',
            body: `@${handle} wants to be friends!`,
            data: { kind: 'friend_request', requestId },
          })),
        ),
      });
      if (response.ok) {
        const payload = (await response.json()) as { data?: ExpoTicket[] };
        const invalid = (payload.data ?? [])
          .map((ticket, index) => (ticket.details?.error === 'DeviceNotRegistered' ? rows[index]?.token : null))
          .filter((token): token is string => Boolean(token));
        if (invalid.length > 0) {
          await admin.from('push_tokens').delete().eq('player_id', addressee).in('token', invalid);
        }
      }
    }
  }
  await admin.from('friend_requests').update({ notified_at: new Date().toISOString() }).eq('id', requestId);
  return json({ ok: true });
});
