import { adminClient, callerFromRequest, json, readJson } from '../_shared/supabase.ts';

type InviteRow = { invitee_id: string };
type TokenRow = { token: string; player_id: string };

type ExpoTicket = {
  status?: string;
  details?: { error?: string };
};

const eventNames: Record<string, string> = {
  funRun: 'Fun Run',
  hurdles: 'Hurdles',
  obstacle: 'Obstacle Course',
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
  const raceId = typeof body.raceId === 'string' ? body.raceId : '';
  if (!raceId) {
    return json({ error: 'not found' }, 400);
  }
  const admin = adminClient();
  const race = await admin
    .from('races')
    .select('id, status, host_player_id, event_id')
    .eq('id', raceId)
    .maybeSingle();
  if (race.error || !race.data || race.data.host_player_id !== caller.id || race.data.status !== 'open') {
    return json({ error: 'not found' }, 404);
  }
  const event = await admin.from('competition_events').select('event_type').eq('id', race.data.event_id).maybeSingle();
  const eventName = eventNames[String(event.data?.event_type ?? '')] ?? 'a race';
  const invites = await admin
    .from('friend_game_invites')
    .select('invitee_id')
    .eq('race_id', raceId)
    .eq('status', 'pending')
    .is('notified_at', null);
  const invitees = ((invites.data ?? []) as InviteRow[]).map((row) => row.invitee_id);
  if (invitees.length === 0) {
    return json({ ok: true });
  }
  const blocks = await admin.from('blocks').select('blocker_id').eq('blocked_id', caller.id).in('blocker_id', invitees);
  const settings = await admin
    .from('notification_settings')
    .select('user_id, friend_requests')
    .in('user_id', invitees);
  const blocked = new Set((blocks.data ?? []).map((row) => String(row.blocker_id)));
  const muted = new Set(
    (settings.data ?? []).filter((row) => row.friend_requests === false).map((row) => String(row.user_id)),
  );
  const allowed = invitees.filter((id) => !blocked.has(id) && !muted.has(id));
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
            body: `@${handle} invited you to a friend game: ${eventName}!`,
            data: { kind: 'friend_game', raceId },
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
  await admin
    .from('friend_game_invites')
    .update({ notified_at: new Date().toISOString() })
    .eq('race_id', raceId)
    .in('invitee_id', invitees);
  return json({ ok: true });
});
