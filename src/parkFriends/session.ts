import { getSupabase } from '../compliance/supabase';
import { petOf } from '../friends/api';
import type { FriendPet } from '../friends/types';
import { parkFriendRules } from './rules';

export type ParkMember = {
  userId: string;
  handle: string;
  pet: FriendPet;
  enteredAt: number;
  lastSeen: number;
  settled: boolean;
};

type Row = Record<string, unknown>;

function rowOf(value: unknown): Row {
  return value && typeof value === 'object' ? (value as Row) : {};
}

function timeOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function memberFromRow(value: unknown, settled: boolean, now = Date.now()): ParkMember | null {
  const row = rowOf(value);
  const userId = typeof row.userId === 'string' ? row.userId : typeof row.user_id === 'string' ? row.user_id : '';
  const handle = typeof row.handle === 'string' ? row.handle : '';
  const pet = petOf(row.pet);
  const enteredAt = timeOf(row.enteredAt ?? row.entered_at);
  const lastSeen = timeOf(row.lastSeen ?? row.last_seen) ?? enteredAt;
  if (!userId || !handle || !pet || enteredAt == null || lastSeen == null) {
    return null;
  }
  if (now - lastSeen > parkFriendRules.staleMs) {
    return null;
  }
  return { userId, handle, pet, enteredAt, lastSeen, settled };
}

async function rpc(name: string, args?: Record<string, unknown>): Promise<Row | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return null;
    }
    const { data, error } = await supabase.rpc(name, args);
    if (error || !data || typeof data !== 'object') {
      return null;
    }
    return data as Row;
  } catch {
    return null;
  }
}

export function openParkSession(input: {
  handle: string;
  pet: FriendPet;
  onRoster: (members: ParkMember[]) => void;
}): { updatePet: (pet: FriendPet) => void; close: () => void } {
  const supabase = getSupabase();
  let closed = false;
  let selfId = '';
  const roster = new Map<string, ParkMember>();
  const openedAt = Date.now();

  const publish = () => {
    if (!closed) {
      input.onRoster([...roster.values()]);
    }
  };

  const remember = (member: ParkMember | null) => {
    if (!member || member.userId === selfId) {
      return;
    }
    const existing = roster.get(member.userId);
    const petId = member.pet.petId;
    if (!existing && petId && [...roster.values()].some((row) => row.pet.petId === petId)) {
      return;
    }
    const settled = existing?.settled ?? Date.now() - openedAt <= parkFriendRules.listWaitMs;
    roster.set(member.userId, { ...member, settled });
    publish();
  };

  const forget = (userId: string) => {
    if (!roster.delete(userId)) {
      return;
    }
    publish();
  };

  const otherId = (a: unknown, b: unknown): string | null => {
    if (a === selfId && typeof b === 'string') {
      return b;
    }
    if (b === selfId && typeof a === 'string') {
      return a;
    }
    return null;
  };

  let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
  const listen = () => {
    if (!supabase || channel) {
      return;
    }
    channel = supabase
          .channel('park-friends')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'park_presence' }, (payload) => {
            const event = payload.eventType;
            if (event === 'DELETE') {
              const id = rowOf(payload.old).user_id;
              if (typeof id === 'string') {
                forget(id);
              }
              return;
            }
            remember(memberFromRow(payload.new, false));
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'friendships' }, (payload) => {
            const row = rowOf(payload.old);
            const id = otherId(row.user_a_id, row.user_b_id);
            if (id) {
              forget(id);
            }
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'blocks' }, (payload) => {
            const row = rowOf(payload.new);
            const id = otherId(row.blocker_id, row.blocked_id);
            if (id) {
              forget(id);
            }
          })
          .subscribe();
  };

  const heartbeat = setInterval(() => {
    if (closed) {
      return;
    }
    const now = Date.now();
    let dropped = false;
    for (const [id, member] of roster) {
      if (now - member.lastSeen > parkFriendRules.staleMs) {
        roster.delete(id);
        dropped = true;
      }
    }
    if (dropped) {
      publish();
    }
    void rpc('park_presence_touch');
  }, parkFriendRules.heartbeatMs);

  void (async () => {
    const session = await getSupabase()?.auth.getSession();
    selfId = session?.data.session?.user.id ?? '';
    if (closed || !selfId) {
      return;
    }
    listen();
    const data = await rpc('park_presence_enter', { p_handle: input.handle, p_pet: input.pet });
    if (closed || !data || data.ok === false) {
      return;
    }
    roster.delete(selfId);
    const rows = Array.isArray(data.rows) ? data.rows : [];
    for (const row of rows) {
      remember(memberFromRow(row, true));
    }
  })();

  return {
    updatePet(pet: FriendPet) {
      if (!closed) {
        void rpc('park_presence_pet', { p_pet: pet });
      }
    },
    close() {
      if (closed) {
        return;
      }
      closed = true;
      clearInterval(heartbeat);
      if (channel && supabase) {
        void supabase.removeChannel(channel);
      }
      void rpc('park_presence_leave');
      roster.clear();
    },
  };
}
