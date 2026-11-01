import { adminClient, callerFromRequest, json, readJson } from '../_shared/supabase.ts';

type InviteRow = { invitee_id: string; status: string };
type TokenRow = { token: string; player_id: string };

type ExpoTicket = {
  status?: string;
  details?: { error?: string };
};

const eventNames: Record<string, string> = {
  funRun: 'Fun Run',
  meters800: '800 Meters',
  hurdles: 'Hurdles',
  obstacle: 'Obstacle Course',
};

const liveStatuses = new Set(['open', 'locked', 'countdown']);

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
  if (race.error || !race.data || !liveStatuses.has(String(race.data.status))) {
    return json({ ok: true });
  }
  const invites = await admin
    .from('friend_game_invites')
    .select('invitee_id, status')
    .eq('race_id', raceId)
    .in('status', ['pending', 'accepted']);
  if (invites.error) {
    return json({ ok: true });
  }
  const rows = (invites.data ?? []) as InviteRow[];
  const accepted = rows.some((row) => row.invitee_id === caller.id && row.status === 'accepted');
  if (!accepted) {
    return json({ error: 'not found' }, 404);
  }
  const hostId = String(race.data.host_player_id);
  const alreadyIn = new Set(rows.filter((row) => row.status === 'accepted').map((row) => row.invitee_id));
  const recipients = [
    ...new Set([hostId, ...rows.map((row) => row.invitee_id)].filter((id) => id && id !== caller.id)),
  ];
  if (recipients.length === 0) {
    return json({ ok: true });
  }
  const blocks = await admin.from('blocks').select('blocker_id').eq('blocked_id', caller.id).in('blocker_id', recipients);
  const settings = await admin
    .from('notification_settings')
    .select('user_id, friend_requests')
    .in('user_id', recipients);
  const blocked = new Set((blocks.data ?? []).map((row) => String(row.blocker_id)));
  const muted = new Set(
    (settings.data ?? []).filter((row) => row.friend_requests === false).map((row) => String(row.user_id)),
  );
  const allowed = recipients.filter((id) => !blocked.has(id) && !muted.has(id));
  const profile = await admin.from('profiles').select('handle').eq('user_id', caller.id).maybeSingle();
  const handle = profile.data && typeof profile.data.handle === 'string' ? profile.data.handle : '';
  if (allowed.length === 0 || !handle) {
    return json({ ok: true });
  }
  const event = await admin.from('competition_events').select('event_type').eq('id', race.data.event_id).maybeSingle();
  const eventName = eventNames[String(event.data?.event_type ?? '')];
  const message = eventName
    ? `@${handle} joined the ${eventName} friend game!`
    : `@${handle} joined the friend game!`;
  const tokens = await admin.from('push_tokens').select('token, player_id').in('player_id', allowed);
  const tokenRows = (tokens.data ?? []) as TokenRow[];
  if (tokenRows.length === 0) {
    return json({ ok: true });
  }
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(
      tokenRows.map((row) => ({
        to: row.token,
        title: 'Boop Boop',
        body: message,
        data: {
          kind: 'friend_game_accepted',
          raceId,
          joined: row.player_id === hostId || alreadyIn.has(row.player_id),
        },
      })),
    ),
  });
  if (response.ok) {
    const payload = (await response.json()) as { data?: ExpoTicket[] };
    const invalid = (payload.data ?? [])
      .map((ticket, index) => (ticket.details?.error === 'DeviceNotRegistered' ? tokenRows[index] : null))
      .filter((row): row is TokenRow => Boolean(row));
    for (const row of invalid) {
      await admin.from('push_tokens').delete().eq('player_id', row.player_id).eq('token', row.token);
    }
  }
  return json({ ok: true });
});
