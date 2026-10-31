import { getSupabase } from '../compliance/supabase';

export type RunwayRpcError =
  | 'auth'
  | 'deadline_past'
  | 'invitees'
  | 'theme'
  | 'track'
  | 'invite'
  | 'action'
  | 'show'
  | 'closed'
  | 'already'
  | 'costume_taken'
  | 'contestant'
  | 'voted'
  | 'offline'
  | 'unknown';

type RpcResult<T> = { ok: true; data: T } | { ok: false; error: RunwayRpcError; costumeId?: string };

function parseRow<T>(data: unknown): RpcResult<T> {
  const row = data as { ok?: boolean; error?: string; costume_id?: string } | null;
  if (!row || row.error) {
    const code = (row?.error as RunwayRpcError | undefined) ?? 'unknown';
    return { ok: false, error: code, costumeId: row?.costume_id };
  }
  return { ok: true, data: row as T };
}

export async function createRunwayShow(
  themeId: string,
  trackId: string,
  deadlineIso: string,
  invitees: string[],
): Promise<RpcResult<{ show_id: string }>> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: 'offline' };
  }
  try {
    const { data, error } = await supabase.rpc('create_runway_show', {
      p_theme_id: themeId,
      p_track_id: trackId,
      p_deadline: deadlineIso,
      p_invitees: invitees,
    });
    if (error) {
      return { ok: false, error: 'unknown' };
    }
    return parseRow(data);
  } catch {
    return { ok: false, error: 'offline' };
  }
}

export async function respondRunwayInvite(showId: string, action: 'accept' | 'decline'): Promise<RpcResult<{ ok: true }>> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: 'offline' };
  }
  try {
    const { data, error } = await supabase.rpc('respond_runway_invite', { p_show_id: showId, p_action: action });
    if (error) {
      return { ok: false, error: 'unknown' };
    }
    return parseRow(data);
  } catch {
    return { ok: false, error: 'offline' };
  }
}

export async function submitRunwayLooks(
  showId: string,
  petSnapshot: object,
  petName: string,
  looks: object[],
  costumeIds: string[],
): Promise<RpcResult<{ submission_id: string }>> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: 'offline' };
  }
  try {
    const { data, error } = await supabase.rpc('submit_runway_looks', {
      p_show_id: showId,
      p_pet_snapshot: petSnapshot,
      p_pet_name: petName,
      p_looks: looks,
      p_costume_ids: costumeIds,
    });
    if (error) {
      return { ok: false, error: 'unknown' };
    }
    return parseRow(data);
  } catch {
    return { ok: false, error: 'offline' };
  }
}

export async function castRunwayVote(showId: string, submissionId: string): Promise<RpcResult<{ ok: true }>> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: 'offline' };
  }
  try {
    const { data, error } = await supabase.rpc('cast_runway_vote', { p_show_id: showId, p_submission_id: submissionId });
    if (error) {
      return { ok: false, error: 'unknown' };
    }
    return parseRow(data);
  } catch {
    return { ok: false, error: 'offline' };
  }
}

export async function hideRunwayShowRemote(showId: string): Promise<RpcResult<{ deleted: boolean }>> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: 'offline' };
  }
  try {
    const { data, error } = await supabase.rpc('hide_runway_show', { p_show_id: showId });
    if (error) {
      return { ok: false, error: 'unknown' };
    }
    return parseRow(data);
  } catch {
    return { ok: false, error: 'offline' };
  }
}

export function runwayErrorCopy(error: RunwayRpcError): string {
  switch (error) {
    case 'deadline_past':
      return 'Pick a deadline in the future.';
    case 'costume_taken':
      return 'Someone already claimed that costume. Pick another piece.';
    case 'voted':
      return 'You already voted.';
    case 'closed':
      return 'That show is closed.';
    case 'auth':
      return 'Sign in to invite friends.';
    case 'offline':
      return 'You are offline.';
    default:
      return 'Something went wrong. Try again.';
  }
}
