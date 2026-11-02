import { getSupabase } from '../compliance/supabase';
import { loadFriends } from '../friends/api';
import { incomingPlaydateLabel, newPlaydateId, playdateTooNew, recordForServer } from './incoming';
import { markPlaydateSynced, mergeIncomingPlaydate } from './save';
import { snapshotFromFriend } from './snapshot';
import { loadPlaydateSave, savePlaydateSave } from './storage';
import type { PetSnapshot, PlaydateRecord } from './types';

export { incomingPlaydateLabel, newPlaydateId, playdateTooNew, recordForServer };

const refreshMs = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error('timeout'));
      },
    );
  });
}

export async function refreshFriendGuests(guests: readonly PetSnapshot[]): Promise<PetSnapshot[] | null> {
  try {
    const bundle = await withTimeout(loadFriends(), refreshMs);
    return guests.map((guest) => {
      const userId = guest.snapshotId.startsWith('friend:') ? guest.snapshotId.slice('friend:'.length) : '';
      const row = userId ? bundle.friends.find((friend) => friend.userId === userId) : undefined;
      if (!row?.pet) {
        return guest;
      }
      return snapshotFromFriend(row.userId, row.pet) ?? guest;
    });
  } catch {
    return null;
  }
}

type SubmitStatus = 'notify' | 'done' | 'retry';

async function submitFriendPlaydate(record: PlaydateRecord): Promise<SubmitStatus> {
  const supabase = getSupabase();
  if (!supabase) {
    return 'retry';
  }
  const { data, error } = await supabase.rpc('submit_friend_playdate', { p_record: recordForServer(record) });
  if (error || !data || typeof data !== 'object') {
    return 'retry';
  }
  const status = (data as { status?: unknown }).status;
  if (status === 'inserted' || status === 'exists') {
    return 'notify';
  }
  if (status === 'skipped') {
    return 'done';
  }
  return 'retry';
}

async function notifyFriendPlaydate(playdateId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    return false;
  }
  const { error } = await supabase.functions.invoke('notify_friend_playdate', { body: { playdateId } });
  return !error;
}

type RemoteRow = { seenAt?: string | null; record?: unknown; recordVersion?: unknown };

function incomingFromRemote(row: RemoteRow): PlaydateRecord | null {
  const value = row.record;
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as PlaydateRecord;
  if (typeof raw.playdateId !== 'string' || !Array.isArray(raw.beats) || !raw.petA || !raw.petB) {
    return null;
  }
  const stored = typeof row.recordVersion === 'number' ? row.recordVersion : 0;
  const version = Math.max(typeof raw.version === 'number' ? raw.version : 0, stored);
  return {
    ...raw,
    version,
    incoming: true,
    unwatched: row.seenAt == null,
    syncStatus: 'synced',
  };
}

async function uploadPending(ownerId: string): Promise<void> {
  const save = await loadPlaydateSave(ownerId);
  for (const record of save.history) {
    if (record.syncStatus !== 'pending' || record.incoming) {
      continue;
    }
    const result = await submitFriendPlaydate(record);
    if (result === 'retry') {
      continue;
    }
    if (result === 'notify') {
      const sent = await notifyFriendPlaydate(record.playdateId);
      if (!sent) {
        continue;
      }
    }
    const latest = await loadPlaydateSave(ownerId);
    await savePlaydateSave(ownerId, markPlaydateSynced(latest, record.playdateId));
  }
}

async function pullIncoming(ownerId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    return;
  }
  const { data: session } = await supabase.auth.getSession();
  const user = session.session?.user;
  if (!user || user.is_anonymous) {
    return;
  }
  const { data, error } = await supabase.rpc('list_friend_playdates');
  if (error || !Array.isArray(data)) {
    return;
  }
  let save = await loadPlaydateSave(ownerId);
  let changed = false;
  for (const entry of data) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const record = incomingFromRemote(entry as RemoteRow);
    if (!record || save.history.some((item) => item.playdateId === record.playdateId)) {
      continue;
    }
    save = mergeIncomingPlaydate(save, record);
    changed = true;
  }
  if (changed) {
    await savePlaydateSave(ownerId, save);
  }
}

let chain: Promise<void> = Promise.resolve();

export function syncFriendPlaydates(ownerId: string): Promise<void> {
  if (!ownerId) {
    return Promise.resolve();
  }
  chain = chain
    .then(async () => {
      await uploadPending(ownerId);
      await pullIncoming(ownerId);
    })
    .catch(() => undefined);
  return chain;
}

export async function markFriendPlaydateSeen(playdateId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    return;
  }
  await supabase.rpc('mark_playdate_seen', { p_playdate_id: playdateId });
}

export function pendingFriendPlaydate(record: PlaydateRecord | null): boolean {
  return record?.syncStatus === 'pending' && record.incoming !== true;
}
