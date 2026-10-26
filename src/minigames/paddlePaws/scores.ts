import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSupabase } from '../../compliance/supabase';
import { emptyBest, enqueueRun, keepBest, mergeLocal } from './queue';
import type { Board, BoardRow, LocalBest, QueuedRun } from './queue';

export type { Board, BoardRow, LocalBest, QueuedRun } from './queue';
export { enqueueRun, keepBest, mergeLocal, rankThisRun } from './queue';

const bestKey = 'petty.paddlePaws.best';
const queueKey = 'petty.paddlePaws.queue';
const boardKey = 'petty.paddlePaws.board';

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
    return emptyBest;
  }
  return {
    score: saved.score,
    meters: saved.meters ?? 0,
    farthest: saved.farthest ?? saved.meters ?? 0,
  };
}

export async function readQueue(): Promise<QueuedRun[]> {
  const saved = await readJson<QueuedRun[]>(queueKey);
  if (!Array.isArray(saved)) {
    return [];
  }
  return saved.filter((row) => row && typeof row.clientRunId === 'string' && typeof row.score === 'number');
}

export async function recordRun(next: QueuedRun): Promise<{ best: LocalBest; isBest: boolean }> {
  const previous = await readBest();
  const saved = keepBest(previous, next);
  await AsyncStorage.setItem(bestKey, JSON.stringify(saved.best));
  const queue = enqueueRun(await readQueue(), next);
  await AsyncStorage.setItem(queueKey, JSON.stringify(queue));
  return saved;
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
    const meters = asNumber(record.meters);
    if (rank == null || score == null || meters == null) {
      continue;
    }
    rows.push({
      rank,
      handle: typeof record.handle === 'string' ? record.handle : '',
      score,
      meters,
      at: typeof record.at === 'string' ? record.at : '',
      mine: record.mine === true,
    });
  }
  return { rows };
}

export async function readCachedBoard(): Promise<Board | null> {
  return readJson<Board>(boardKey);
}

export async function loadBoard(): Promise<Board | null> {
  const cached = await readCachedBoard();
  const best = await readBest();
  const supabase = getSupabase();
  if (!supabase) {
    return cached ? { rows: mergeLocal(cached.rows, best) } : { rows: mergeLocal([], best) };
  }
  const { data, error } = await supabase.rpc('minigame_leaderboard', { p_game: 'paddle_paws' });
  if (error || !data || typeof data !== 'object') {
    return cached ? { rows: mergeLocal(cached.rows, best) } : { rows: mergeLocal([], best) };
  }
  const board = asBoard(data as Record<string, unknown>);
  if (!board) {
    return cached ? { rows: mergeLocal(cached.rows, best) } : { rows: mergeLocal([], best) };
  }
  const merged = { rows: mergeLocal(board.rows, best) };
  await AsyncStorage.setItem(boardKey, JSON.stringify(merged));
  return merged;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function flushPaddleScores(): Promise<'sent' | 'kept' | 'skipped'> {
  let queue = await readQueue();
  if (queue.length === 0) {
    return 'skipped';
  }
  const supabase = getSupabase();
  if (!supabase) {
    return 'kept';
  }
  const { data } = await supabase.auth.getSession();
  const playerId = data.session?.user.id;
  if (!playerId) {
    return 'kept';
  }
  const remain: QueuedRun[] = [];
  let sent = false;
  for (const row of queue) {
    if (row.score < 0 || row.meters < 0 || row.score > row.meters * 3 + 50) {
      continue;
    }
    const { error } = await supabase.from('minigame_runs').insert({
      player_id: playerId,
      game: 'paddle_paws',
      score: Math.round(row.score),
      meters: Math.round(row.meters),
      pet_id: row.petId && isUuid(row.petId) ? row.petId : null,
      client_run_id: row.clientRunId,
    });
    if (!error) {
      sent = true;
      continue;
    }
    const code = 'code' in error ? String(error.code) : '';
    if (code === '23505' || code === '23514') {
      continue;
    }
    remain.push(row);
  }
  queue = remain;
  if (queue.length === 0) {
    await AsyncStorage.removeItem(queueKey);
  } else {
    await AsyncStorage.setItem(queueKey, JSON.stringify(queue));
  }
  return queue.length > 0 ? 'kept' : sent ? 'sent' : 'skipped';
}
