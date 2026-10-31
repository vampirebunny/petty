import { getSupabase } from '../compliance/supabase';
import { petOf } from '../friends/api';
import type { FriendPet } from '../friends/types';
import { gameplayConfig } from '../sim/gameplayConfig';
import { eventLabel, formatSlot, type RaceEvent } from '../sim/stadium';
import { call, parseRace, type RaceStatus, type RaceView, type StadiumResult } from './api';

export type FriendGameEvent = (typeof gameplayConfig.friendGames.events)[number];

export type FriendCandidate = {
  userId: string;
  handle: string;
  pet: FriendPet | null;
  hasPet: boolean;
  /** Leftover from older servers. Friend games ignore it; open and veteran races still require tricks. */
  missingTrick: string | null;
  lastInvitedAt: number | null;
};

export type FriendGameConflict = {
  entryId: string;
  raceId: string;
  event: RaceEvent | null;
  cup: string;
  startsAt: number | null;
  hosting: boolean;
};

export type FriendGameError =
  | { error: 'conflict'; conflict: FriendGameConflict }
  | { error: 'missing_trick'; trick: string | null }
  | { error: string };

export type FriendGameCreated = { raceId: string; startsAt: number };

export type FriendGameMember = {
  userId: string;
  handle: string;
  host: boolean;
  petName: string | null;
  status: 'host' | 'pending' | 'accepted' | 'declined' | 'withdrawn';
  mine: boolean;
  joined: boolean;
};

export type FriendGameState = {
  raceId: string;
  status: RaceStatus;
  event: RaceEvent | null;
  startsAt: number;
  hostId: string;
  mineHost: boolean;
  hostHandle: string | null;
  cancelReason: 'host_left' | 'not_enough' | null;
  race: RaceView | null;
  members: FriendGameMember[];
};

export type FriendGameInvite = {
  raceId: string;
  hostId: string;
  hostHandle: string;
  hostPetName: string | null;
  event: RaceEvent | null;
  startsAt: number;
};

export type FriendGameReply<T> =
  | { ok: true; data: T }
  | ({ ok: false; offline: boolean } & FriendGameError);

type Row = Record<string, unknown>;

const rowOf = (value: unknown): Row => (value && typeof value === 'object' ? (value as Row) : {});
const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

function time(value: unknown): number | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

const raceEvents: RaceEvent[] = ['funRun', 'hurdles', 'obstacle', 'dockDive'];
const eventOf = (value: unknown): RaceEvent | null =>
  raceEvents.includes(value as RaceEvent) ? (value as RaceEvent) : null;

const raceStatuses: RaceStatus[] = ['open', 'locked', 'countdown', 'running', 'finished', 'cancelled'];
const memberStatuses: FriendGameMember['status'][] = ['host', 'pending', 'accepted', 'declined', 'withdrawn'];

export function parseCandidates(value: unknown): FriendCandidate[] {
  const rows = rowOf(value).rows;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((item) => {
    const row = rowOf(item);
    const userId = text(row.userId);
    const handle = text(row.handle);
    if (!userId || !handle) return [];
    return [
      {
        userId,
        handle,
        pet: petOf(row.pet),
        hasPet: row.hasPet === true,
        missingTrick: text(row.missingTrick),
        lastInvitedAt: time(row.lastInvitedAt),
      },
    ];
  });
}

/** The most recently invited friends first, then everyone by handle. */
export function splitRecent(rows: FriendCandidate[]): { recent: FriendCandidate[]; rest: FriendCandidate[] } {
  const recent = rows
    .filter((row) => row.lastInvitedAt != null)
    .sort((a, b) => (b.lastInvitedAt ?? 0) - (a.lastInvitedAt ?? 0))
    .slice(0, gameplayConfig.friendGames.recentShown);
  const shown = new Set(recent.map((row) => row.userId));
  return { recent, rest: rows.filter((row) => !shown.has(row.userId)) };
}

export function parseConflict(value: unknown): FriendGameConflict | null {
  const row = rowOf(value);
  const entryId = text(row.entry_id);
  const raceId = text(row.race_id);
  if (!entryId || !raceId) return null;
  return {
    entryId,
    raceId,
    event: eventOf(row.event_type),
    cup: text(row.cup) ?? 'open',
    startsAt: time(row.starts_at),
    hosting: row.hosting === true,
  };
}

function errorOf(row: Row): FriendGameError {
  const error = text(row.error) ?? 'unknown';
  if (error === 'conflict') {
    const conflict = parseConflict(row.conflict);
    if (conflict) return { error, conflict };
  }
  if (error === 'missing_trick') {
    return { error, trick: text(row.trick) };
  }
  return { error };
}

export function parseFriendGameState(value: unknown): FriendGameState | null {
  const row = rowOf(value);
  const raceId = text(row.race_id);
  const startsAt = time(row.starts_at);
  const hostId = text(row.host_id);
  if (row.ok !== true || !raceId || startsAt == null || !hostId) return null;
  const members = Array.isArray(row.members) ? row.members : [];
  return {
    raceId,
    status: raceStatuses.includes(row.status as RaceStatus) ? (row.status as RaceStatus) : 'open',
    event: eventOf(row.event_type),
    startsAt,
    hostId,
    mineHost: row.mine_host === true,
    hostHandle: text(row.host_handle),
    cancelReason: row.cancel_reason === 'host_left' || row.cancel_reason === 'not_enough' ? row.cancel_reason : null,
    race: row.race ? parseRace(row.race) : null,
    members: members.flatMap((item) => {
      const member = rowOf(item);
      const userId = text(member.userId);
      if (!userId) return [];
      const status = memberStatuses.includes(member.status as FriendGameMember['status'])
        ? (member.status as FriendGameMember['status'])
        : 'pending';
      return [
        {
          userId,
          handle: text(member.handle) ?? 'friend',
          host: member.host === true,
          petName: text(member.petName),
          status,
          mine: member.mine === true,
          joined: member.joined === true,
        },
      ];
    }),
  };
}

export function parseInvites(value: unknown): FriendGameInvite[] {
  const rows = rowOf(value).rows;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((item) => {
    const row = rowOf(item);
    const raceId = text(row.raceId);
    const hostId = text(row.hostId);
    const startsAt = time(row.startsAt);
    if (!raceId || !hostId || startsAt == null) return [];
    return [
      {
        raceId,
        hostId,
        hostHandle: text(row.hostHandle) ?? 'friend',
        hostPetName: text(row.hostPetName),
        event: eventOf(row.eventType),
        startsAt,
      },
    ];
  });
}

async function reply<T>(fn: string, args: Record<string, unknown>, parse: (row: Row) => T | null): Promise<FriendGameReply<T>> {
  const result: StadiumResult<unknown> = await call(fn, args);
  if (!result.ok) {
    return { ok: false, offline: result.offline, error: result.offline ? 'offline' : result.reason };
  }
  const row = rowOf(result.data);
  if (row.ok !== true) {
    return { ok: false, offline: false, ...errorOf(row) };
  }
  const data = parse(row);
  return data == null ? { ok: false, offline: false, error: 'bad_reply' } : { ok: true, data };
}

export function fetchCandidates(event: FriendGameEvent): Promise<FriendGameReply<FriendCandidate[]>> {
  return reply('friend_game_candidates', { p_event_type: event }, parseCandidates);
}

const createdOf = (row: Row): FriendGameCreated | null => {
  const raceId = text(row.race_id);
  const startsAt = time(row.starts_at);
  return raceId && startsAt != null ? { raceId, startsAt } : null;
};

export async function createFriendGame(
  petId: string,
  event: FriendGameEvent,
  delayMin: number,
  invitees: string[],
  replace: boolean,
): Promise<FriendGameReply<FriendGameCreated>> {
  const result = await reply(
    'create_friend_game',
    { p_pet_id: petId, p_event_type: event, p_delay_minutes: delayMin, p_invitees: invitees, p_replace: replace },
    createdOf,
  );
  if (result.ok) {
    void notifyFriendGame(result.data.raceId);
  }
  return result;
}

export function fetchInvites(): Promise<FriendGameReply<FriendGameInvite[]>> {
  return reply('list_friend_game_invites', {}, parseInvites);
}

export function respondInvite(
  raceId: string,
  action: 'accept' | 'decline',
  petId: string | null,
  replace: boolean,
): Promise<FriendGameReply<{ game: FriendGameCreated | null }>> {
  return reply(
    'respond_friend_game_invite',
    { p_race_id: raceId, p_action: action, p_pet_id: petId, p_replace: replace },
    (row) => ({ game: createdOf(row) }),
  );
}

export function fetchFriendGame(raceId: string): Promise<FriendGameReply<FriendGameState>> {
  return reply('friend_game_state', { p_race_id: raceId }, parseFriendGameState);
}

export function friendGameHeartbeat(raceId: string): Promise<FriendGameReply<FriendGameState>> {
  return reply('friend_game_heartbeat', { p_race_id: raceId }, parseFriendGameState);
}

export function leaveFriendGame(raceId: string): Promise<FriendGameReply<{ cancelled: boolean }>> {
  return reply('leave_friend_game', { p_race_id: raceId }, (row) => ({ cancelled: row.cancelled === true }));
}

export async function notifyFriendGame(raceId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.functions.invoke('notify_friend_game', { body: { raceId } });
  } catch {
    // Friends still see the invite the next time they open the app.
  }
}

export function conflictCopy(conflict: FriendGameConflict, petName: string, action: 'start' | 'join'): string {
  const verb = action === 'start' ? 'Starting' : 'Joining';
  if (conflict.cup === 'friends') {
    return conflict.hosting
      ? `You're hosting another friend game. ${verb} this one cancels that game for everyone.`
      : `${petName} is in another friend game. ${verb} this one takes ${petName} out of it.`;
  }
  const race = conflict.event ? eventLabel(conflict.event) : 'a race';
  const at = conflict.startsAt != null ? ` at ${formatSlot(conflict.startsAt)}` : '';
  return `${petName} is signed up for ${race}${at}. ${verb} this game withdraws ${petName} from that race.`;
}

export function friendGameErrorCopy(error: string): string {
  if (error === 'offline') return 'Friend games need a connection. Try again when you’re online.';
  if (error === 'account_required') return 'Friend games need an account.';
  if (error === 'cancelled') return 'This game was cancelled.';
  if (error === 'started') return 'This game already started.';
  if (error === 'race_starting') return 'Your other race is about to start, so you can’t switch now.';
  if (error === 'not_friends') return 'You can only invite friends.';
  if (error === 'too_many') return `You can invite up to ${gameplayConfig.friendGames.maxInvites} friends.`;
  if (error === 'no_friends') return 'Pick at least one friend.';
  if (error === 'full') return 'This game is full.';
  if (error === 'not_found') return 'This invite is no longer open.';
  if (error === 'missing_trick') return 'Your pet needs a new trick for this race.';
  if (/pet not synced/i.test(error)) return 'Your pet is still syncing. Try again in a moment.';
  return 'Something went wrong. Try again.';
}
