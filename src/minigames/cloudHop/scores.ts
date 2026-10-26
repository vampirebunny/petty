import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSupabase } from '../../compliance/supabase';
import { readAccountLinked, readHandleSaved } from '../../db/accountMeta';
import { keepBest } from './best';
import type { PendingScore } from './best';

export type { PendingScore } from './best';
export { keepBest } from './best';

const bestKey = 'petty.cloudHop.best';
const pendingKey = 'petty.cloudHop.pending';
const seenKey = 'petty.cloudHop.seen';
const boardKey = 'petty.cloudHop.board';

export type LocalBest = { score: number; meters: number };

export type BoardRow = {
  rank: number;
  handle: string;
  petName: string;
  score: number;
  mine: boolean;
};

export type BoardMe = { rank: number; score: number; petName: string };

export type Board = { rows: BoardRow[]; me: BoardMe | null };

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function readBest(): Promise<LocalBest> {
  const saved = await readJson<LocalBest>(bestKey);
  if (!saved || typeof saved.score !== 'number') {
    return { score: 0, meters: 0 };
  }
  return { score: saved.score, meters: saved.meters ?? 0 };
}

export async function readSeen(): Promise<string[]> {
  const saved = await readJson<string[]>(seenKey);
  return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : [];
}

export async function rememberSeen(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const seen = new Set(await readSeen());
  for (const id of ids) {
    seen.add(id);
  }
  await AsyncStorage.setItem(seenKey, JSON.stringify([...seen]));
}

export async function recordRun(next: PendingScore): Promise<{ best: LocalBest; isBest: boolean }> {
  const previous = await readBest();
  const isBest = next.score > previous.score;
  const best: LocalBest = isBest ? { score: next.score, meters: next.meters } : previous;
  if (isBest) {
    await AsyncStorage.setItem(bestKey, JSON.stringify(best));
  }
  const pending = keepBest(await readJson<PendingScore>(pendingKey), next);
  await AsyncStorage.setItem(pendingKey, JSON.stringify(pending));
  return { best, isBest };
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoard(data: Record<string, unknown>): Board | null {
  if (!Array.isArray(data.rows)) {
    return null;
  }
  const rows: BoardRow[] = [];
  for (const row of data.rows) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const record = row as Record<string, unknown>;
    const rank = asNumber(record.rank);
    const score = asNumber(record.score);
    if (rank == null || score == null || typeof record.handle !== 'string') {
      continue;
    }
    rows.push({
      rank,
      handle: record.handle,
      petName: typeof record.petName === 'string' ? record.petName : '',
      score,
      mine: record.mine === true,
    });
  }
  let me: BoardMe | null = null;
  if (data.me && typeof data.me === 'object') {
    const record = data.me as Record<string, unknown>;
    const rank = asNumber(record.rank);
    const score = asNumber(record.score);
    if (rank != null && score != null) {
      me = { rank, score, petName: typeof record.petName === 'string' ? record.petName : '' };
    }
  }
  return { rows, me };
}

async function rememberBoard(board: Board): Promise<void> {
  await AsyncStorage.setItem(boardKey, JSON.stringify(board));
}

export async function readCachedBoard(): Promise<Board | null> {
  return readJson<Board>(boardKey);
}

export async function loadBoard(): Promise<Board | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return readCachedBoard();
  }
  const { data, error } = await supabase.rpc('cloud_hop_leaderboard');
  if (error || !data || typeof data !== 'object') {
    return readCachedBoard();
  }
  const board = asBoard(data as Record<string, unknown>);
  if (!board) {
    return readCachedBoard();
  }
  await rememberBoard(board);
  return board;
}

export type FlushResult = 'sent' | 'kept' | 'dropped' | 'skipped';

export async function flushCloudHopScore(): Promise<FlushResult> {
  if (!readAccountLinked() || !readHandleSaved()) {
    return 'skipped';
  }
  const pending = await readJson<PendingScore>(pendingKey);
  if (!pending || pending.score <= 0) {
    return 'skipped';
  }
  const supabase = getSupabase();
  if (!supabase) {
    return 'kept';
  }
  const { data, error } = await supabase.rpc('submit_cloud_hop_score', {
    p_score: Math.round(pending.score),
    p_meters: Math.round(pending.meters),
    p_pet_name: pending.petName.slice(0, 24),
    p_duration_s: Math.max(0, pending.durationS),
  });
  if (error || !data || typeof data !== 'object') {
    return 'kept';
  }
  const body = data as Record<string, unknown>;
  if (body.ok === false) {
    if (body.error === 'cheat') {
      await AsyncStorage.removeItem(pendingKey);
      return 'dropped';
    }
    return 'kept';
  }
  await AsyncStorage.removeItem(pendingKey);
  return 'sent';
}
