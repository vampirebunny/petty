import { adminClient, callerFromRequest, json, readJson } from '../_shared/supabase.ts';

type GuestRow = { player_id: string };
type TokenRow = { token: string; player_id: string };

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
  const playdateId = typeof body.playdateId === 'string' ? body.playdateId : '';
  if (!playdateId) {
    return json({ error: 'not found' }, 400);
  }
  const admin = adminClient();
  const playdate = await admin
    .from('playdates')
    .select('id, initiator_id, notified_at')
    .eq('id', playdateId)
    .maybeSingle();
  if (playdate.error || !playdate.data || playdate.data.initiator_id !== caller.id) {
    return json({ error: 'not found' }, 404);
  }
  if (playdate.data.notified_at) {
    return json({ ok: true });
  }
  const guests = await admin
    .from('playdate_participants')
    .select('player_id')
    .eq('playdate_id', playdateId)
    .eq('role', 'guest');
  const guestIds = ((guests.data ?? []) as GuestRow[]).map((row) => row.player_id);
  const blockedByThem = guestIds.length
    ? await admin.from('blocks').select('blocker_id').eq('blocked_id', caller.id).in('blocker_id', guestIds)
    : { data: [] as { blocker_id: string }[] };
  const blockedByUs = guestIds.length
    ? await admin.from('blocks').select('blocked_id').eq('blocker_id', caller.id).in('blocked_id', guestIds)
    : { data: [] as { blocked_id: string }[] };
  const settings = guestIds.length
    ? await admin.from('notification_settings').select('user_id, friend_requests').in('user_id', guestIds)
    : { data: [] as { user_id: string; friend_requests: boolean }[] };
  const blocked = new Set<string>([
    ...(blockedByThem.data ?? []).map((row) => String(row.blocker_id)),
    ...(blockedByUs.data ?? []).map((row) => String(row.blocked_id)),
  ]);
  const muted = new Set(
    (settings.data ?? []).filter((row) => row.friend_requests === false).map((row) => String(row.user_id)),
  );
  const allowed = guestIds.filter((id) => !blocked.has(id) && !muted.has(id));
  const profile = await admin.from('profiles').select('handle').eq('user_id', caller.id).maybeSingle();
  const handle = profile.data && typeof profile.data.handle === 'string' ? profile.data.handle : '';
  if (allowed.length > 0 && handle) {
    const tokens = await admin.from('push_tokens').select('token, player_id').in('player_id', allowed);
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
            body: `@${handle} arranged a playdate!`,
            data: { kind: 'friend_playdate', playdateId },
          })),
        ),
      });
      if (response.ok) {
        const payload = (await response.json()) as { data?: ExpoTicket[] };
        const invalid = (payload.data ?? [])
          .map((ticket, index) => (ticket.details?.error === 'DeviceNotRegistered' ? rows[index] : null))
          .filter((row): row is TokenRow => Boolean(row));
        for (const row of invalid) {
          await admin.from('push_tokens').delete().eq('player_id', row.player_id).eq('token', row.token);
        }
      }
    }
  }
  await admin.from('playdates').update({ notified_at: new Date().toISOString() }).eq('id', playdateId).is('notified_at', null);
  return json({ ok: true });
});
