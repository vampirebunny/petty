import { adminClient, callerFromRequest, json, readJson } from '../_shared/supabase.ts';

type InviteRow = { player_id: string };
type TokenRow = { token: string; player_id: string };

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'POST required' }, 405);
  }
  const caller = await callerFromRequest(req);
  if (!caller || caller.is_anonymous) {
    return json({ error: 'account required' }, 403);
  }
  const body = await readJson(req);
  const showId = typeof body.showId === 'string' ? body.showId : '';
  const kind = typeof body.kind === 'string' ? body.kind : 'runway_show';
  if (!showId) {
    return json({ error: 'not found' }, 400);
  }
  const admin = adminClient();
  const show = await admin.from('runway_shows').select('id, host_player_id, theme_id').eq('id', showId).maybeSingle();
  if (show.error || !show.data) {
    return json({ error: 'not found' }, 404);
  }
  const invites = await admin
    .from('runway_invites')
    .select('player_id')
    .eq('show_id', showId)
    .in('status', kind === 'runway_show' ? ['invited'] : ['accepted', 'submitted', 'judge', 'invited'])
    .neq('player_id', caller.id);
  const invitees = ((invites.data ?? []) as InviteRow[]).map((row) => row.player_id);
  if (invitees.length === 0) {
    return json({ ok: true });
  }
  const blocks = await admin.from('blocks').select('blocker_id').eq('blocked_id', caller.id).in('blocker_id', invitees);
  const settings = await admin.from('notification_settings').select('user_id, friend_requests').in('user_id', invitees);
  const blocked = new Set((blocks.data ?? []).map((row) => String(row.blocker_id)));
  const muted = new Set(
    (settings.data ?? []).filter((row) => row.friend_requests === false).map((row) => String(row.user_id)),
  );
  const allowed = invitees.filter((id) => !blocked.has(id) && !muted.has(id));
  const profile = await admin.from('profiles').select('handle').eq('user_id', caller.id).maybeSingle();
  const handle = profile.data && typeof profile.data.handle === 'string' ? profile.data.handle : '';
  const bodyText =
    kind === 'runway_vote'
      ? 'Voting is open at The Catwalk!'
      : kind === 'runway_results'
        ? 'Fashion show results are in!'
        : `@${handle || 'A friend'} invited you to a fashion show!`;
  if (allowed.length > 0) {
    const tokens = await admin.from('push_tokens').select('token, player_id').in('player_id', allowed);
    const rows = (tokens.data ?? []) as TokenRow[];
    if (rows.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          rows.map((row) => ({
            to: row.token,
            title: 'Boop Boop',
            body: bodyText,
            data: { kind, showId },
          })),
        ),
      });
    }
  }
  if (kind === 'runway_show') {
    await admin
      .from('runway_invites')
      .update({ notified_at: new Date().toISOString() })
      .eq('show_id', showId)
      .eq('status', 'invited')
      .is('notified_at', null);
  }
  return json({ ok: true });
});
