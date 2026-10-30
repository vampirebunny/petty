import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSupabase } from '../compliance/supabase';
import { bucketFriends, setProp, track } from '../analytics/analytics';
import type { Equipped, Look, OutfitSlot, Stats, Trait } from '../sim/types';
import type { FriendPet, FriendRow, LookupResult } from './types';

const cacheKey = 'petty.friends.cache';
const traits: Trait[] = ['stamina', 'agility', 'intelligence', 'boldness', 'affection', 'obedience'];
const outfitSlots = new Set<OutfitSlot>(['hat', 'glasses', 'neckwear', 'jacket', 'boots']);

function ownedOf(value: unknown): { slot: OutfitSlot; id: string }[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const owned: { slot: OutfitSlot; id: string }[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const row = entry as Record<string, unknown>;
    const slot = row.slot;
    const id = row.id;
    if (typeof slot !== 'string' || !outfitSlots.has(slot as OutfitSlot) || typeof id !== 'string' || !id || id.includes(':')) {
      continue;
    }
    owned.push({ slot: slot as OutfitSlot, id });
  }
  return owned;
}

type Cache = {
  friends: FriendRow[];
  incoming: FriendRow[];
  sent: FriendRow[];
  blocked: FriendRow[];
};

export type FriendBundle = Cache & { offline: boolean; error: string | null };

const emptyCache = (): Cache => ({ friends: [], incoming: [], sent: [], blocked: [] });

function statsOf(value: unknown): Stats {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const stats = {} as Stats;
  for (const trait of traits) {
    const next = raw[trait];
    stats[trait] = typeof next === 'number' ? next : 0;
  }
  return stats;
}

export function petOf(value: unknown): FriendPet | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const name = typeof row.name === 'string' ? row.name : '';
  const breedId = typeof row.breedId === 'string' ? row.breedId : '';
  const look = row.look && typeof row.look === 'object' ? (row.look as Look) : null;
  if (!name || !breedId || !look?.coat) {
    return null;
  }
  const origin = row.originArchetype;
  const equipped = row.equipped && typeof row.equipped === 'object' ? (row.equipped as Equipped) : {};
  return {
    petId: typeof row.petId === 'string' ? row.petId : undefined,
    name,
    breedId,
    look,
    equipped,
    owned: ownedOf(row.owned),
    ageDays: typeof row.ageDays === 'number' ? row.ageDays : 0,
    weight: typeof row.weight === 'number' ? row.weight : 0,
    vitality: typeof row.vitality === 'number' ? row.vitality : 0,
    seed: typeof row.seed === 'number' ? row.seed : 1,
    originArchetype: origin === 'athlete' || origin === 'thinker' || origin === 'charmer' ? origin : 'charmer',
    attributes: statsOf(row.attributes),
    potential: statsOf(row.potential),
  };
}

function rowOf(value: unknown): FriendRow | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.userId !== 'string' || typeof row.handle !== 'string') {
    return null;
  }
  return {
    userId: row.userId,
    handle: row.handle,
    pet: petOf(row.pet),
    requestId: typeof row.requestId === 'string' ? row.requestId : undefined,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
  };
}

function rowsOf(value: unknown): FriendRow[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(rowOf).filter((row): row is FriendRow => row != null);
}

async function readCache(): Promise<Cache> {
  const raw = await AsyncStorage.getItem(cacheKey);
  if (!raw) {
    return emptyCache();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<Cache>;
    return {
      friends: rowsOf(parsed.friends),
      incoming: rowsOf(parsed.incoming),
      sent: rowsOf(parsed.sent),
      blocked: rowsOf(parsed.blocked),
    };
  } catch {
    return emptyCache();
  }
}

async function writeCache(cache: Cache): Promise<void> {
  await AsyncStorage.setItem(cacheKey, JSON.stringify(cache));
}

export async function clearFriendCache(): Promise<void> {
  await AsyncStorage.removeItem(cacheKey);
}

async function rpc(name: string, args?: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.rpc(name, args);
  if (error || !data || typeof data !== 'object') {
    return null;
  }
  return data as Record<string, unknown>;
}

function failed(data: Record<string, unknown> | null): string | null {
  if (!data) {
    return 'offline';
  }
  if (data.ok === false) {
    return typeof data.error === 'string' ? data.error : 'offline';
  }
  return null;
}

export async function loadFriends(): Promise<FriendBundle> {
  const cached = await readCache();
  const [friends, incoming, sent, blocked] = await Promise.all([
    rpc('list_friends'),
    rpc('list_incoming_requests'),
    rpc('list_sent_requests'),
    rpc('list_blocked'),
  ]);
  const error = failed(friends) ?? failed(incoming) ?? failed(sent) ?? failed(blocked);
  if (error) {
    return { ...cached, offline: error === 'offline', error };
  }
  const next = {
    friends: rowsOf(friends?.rows),
    incoming: rowsOf(incoming?.rows),
    sent: rowsOf(sent?.rows),
    blocked: rowsOf(blocked?.rows),
  };
  await writeCache(next);
  return { ...next, offline: false, error: null };
}

export async function lookupHandle(handle: string): Promise<LookupResult> {
  const data = await rpc('lookup_handle', { p_handle: handle });
  const error = failed(data);
  if (error || !data) {
    return { ok: false, error: error ?? 'offline' };
  }
  if (data.found !== true) {
    return { ok: true, found: false };
  }
  const state = data.state;
  if (
    state !== 'none' &&
    state !== 'request_sent' &&
    state !== 'request_received' &&
    state !== 'friends' &&
    state !== 'cooldown'
  ) {
    return { ok: false, error: 'offline' };
  }
  if (typeof data.userId !== 'string' || typeof data.handle !== 'string') {
    return { ok: false, error: 'offline' };
  }
  return {
    ok: true,
    found: true,
    state,
    userId: data.userId,
    handle: data.handle,
    pet: petOf(data.pet),
    requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
  };
}

export async function sendFriendRequest(
  handle: string,
  via: 'handle' | 'qr' = 'handle',
): Promise<{ ok: true; state: 'pending' | 'friends'; requestId?: string } | { ok: false; error: string }> {
  const data = await rpc('send_friend_request', { p_handle: handle });
  const error = failed(data);
  if (error || !data) {
    return { ok: false, error: error ?? 'offline' };
  }
  const state = data.state === 'friends' ? 'friends' : 'pending';
  track('friend_request_sent', { via });
  void loadFriends().then((bundle) => setProp('friend_count_bucket', bucketFriends(bundle.friends.length)));
  return {
    ok: true,
    state,
    requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
  };
}

export async function respondFriendRequest(id: string, action: 'accept' | 'decline'): Promise<{ ok: true } | { ok: false; error: string }> {
  const data = await rpc('respond_friend_request', { p_id: id, p_action: action });
  const error = failed(data);
  if (error) {
    return { ok: false, error };
  }
  track('friend_request_response', { result: action });
  void loadFriends().then((bundle) => setProp('friend_count_bucket', bucketFriends(bundle.friends.length)));
  return { ok: true };
}

export async function cancelFriendRequest(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const data = await rpc('cancel_friend_request', { p_id: id });
  const error = failed(data);
  return error ? { ok: false, error } : { ok: true };
}

export async function removeFriend(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const data = await rpc('remove_friend', { p_user_id: userId });
  const error = failed(data);
  return error ? { ok: false, error } : { ok: true };
}

export async function blockPlayer(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const data = await rpc('block_player', { p_user_id: userId });
  const error = failed(data);
  if (error) {
    return { ok: false, error };
  }
  track('friend_request_response', { result: 'block' });
  void loadFriends().then((bundle) => setProp('friend_count_bucket', bucketFriends(bundle.friends.length)));
  return { ok: true };
}

export async function unblockPlayer(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const data = await rpc('unblock_player', { p_user_id: userId });
  const error = failed(data);
  return error ? { ok: false, error } : { ok: true };
}

export async function reportPlayer(
  userId: string,
  target: 'handle' | 'pet_name',
  reason: 'inappropriate_handle' | 'inappropriate_pet_name' | 'something_else',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const data = await rpc('report_player', { p_user_id: userId, p_target: target, p_reason: reason });
  const error = failed(data);
  return error ? { ok: false, error } : { ok: true };
}

export async function readFriendNotifications(): Promise<boolean> {
  const data = await rpc('friend_request_notifications');
  if (!data || data.ok === false) {
    return true;
  }
  return data.enabled !== false;
}

export async function writeFriendNotifications(enabled: boolean): Promise<boolean> {
  const data = await rpc('set_friend_request_notifications', { p_enabled: enabled });
  return Boolean(data && data.ok !== false);
}

export async function notifyFriendRequest(requestId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    return;
  }
  await supabase.functions.invoke('notify_friend_request', { body: { requestId } }).catch(() => undefined);
}
