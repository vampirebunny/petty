import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSupabase } from '../../compliance/supabase';
import { readAccountLinked, readHandleSaved } from '../../db/accountMeta';

const bestKey = 'petty.acornAttack.best';
const pendingKey = 'petty.acornAttack.pending';
const boardKey = 'petty.acornAttack.board';

export type PendingRun = {
  runId: string;
  score: number;
  level: number;
  distanceM: number;
  squirrels: number;
  treats: number;
  durationMs: number;
  clientVersion: string;
};

export type BoardRow = {
  rank: number;
  handle: string;
  score: number;
  mine: boolean;
};

export type Board = { rows: BoardRow[] };

export type FlushResult = 'sent' | 'kept' | 'skipped';

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

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asPending(value: unknown): PendingRun | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const score = asNumber(record.score);
  const level = asNumber(record.level);
  const distanceM = asNumber(record.distanceM);
  const squirrels = asNumber(record.squirrels);
  const treats = asNumber(record.treats);
  const durationMs = asNumber(record.durationMs);
  if (
    typeof record.runId !== 'string' ||
    score == null ||
    level == null ||
    distanceM == null ||
    squirrels == null ||
    treats == null ||
    durationMs == null ||
    typeof record.clientVersion !== 'string'
  ) {
    return null;
  }
  return {
    runId: record.runId,
    score,
    level,
    distanceM,
    squirrels,
    treats,
    durationMs,
    clientVersion: record.clientVersion,
  };
}

export async function readBest(): Promise<number> {
  const saved = await readJson<unknown>(bestKey);
  return typeof saved === 'number' && saved > 0 ? saved : 0;
}

export async function readPending(): Promise<PendingRun[]> {
  const saved = await readJson<unknown>(pendingKey);
  if (!Array.isArray(saved)) {
    return [];
  }
  return saved.map(asPending).filter((item): item is PendingRun => item != null);
}

export async function recordRun(next: PendingRun): Promise<{ best: number; isBest: boolean }> {
  const previous = await readBest();
  const isBest = next.score > previous;
  const best = isBest ? next.score : previous;
  if (isBest) {
    await AsyncStorage.setItem(bestKey, JSON.stringify(best));
  }
  const pending = await readPending();
  pending.push(next);
  await AsyncStorage.setItem(pendingKey, JSON.stringify(pending));
  return { best, isBest };
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
    rows.push({ rank, handle: record.handle, score, mine: record.mine === true });
  }
  return { rows };
}

export async function readCachedBoard(): Promise<Board | null> {
  const saved = await readJson<Board>(boardKey);
  if (!saved || !Array.isArray(saved.rows)) {
    return null;
  }
  return saved;
}

export async function loadBoard(): Promise<Board | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return readCachedBoard();
  }
  const { data, error } = await supabase.rpc('acorn_attack_leaderboard');
  if (error || !data || typeof data !== 'object') {
    return readCachedBoard();
  }
  const board = asBoard(data as Record<string, unknown>);
  if (!board) {
    return readCachedBoard();
  }
  await AsyncStorage.setItem(boardKey, JSON.stringify(board));
  return board;
}

async function writePending(rows: PendingRun[]): Promise<void> {
  if (rows.length === 0) {
    await AsyncStorage.removeItem(pendingKey);
    return;
  }
  await AsyncStorage.setItem(pendingKey, JSON.stringify(rows));
}

export async function flushAcornAttackScore(): Promise<FlushResult> {
  if (!readAccountLinked() || !readHandleSaved()) {
    return 'skipped';
  }
  const pending = await readPending();
  if (pending.length === 0) {
    return 'skipped';
  }
  const supabase = getSupabase();
  if (!supabase) {
    return 'kept';
  }
  const left: PendingRun[] = [];
  let sent = false;
  for (let index = 0; index < pending.length; index += 1) {
    const run = pending[index];
    if (!run) {
      continue;
    }
    const { data, error } = await supabase.rpc('submit_acorn_attack_score', {
      p_run_id: run.runId,
      p_score: Math.round(run.score),
      p_level: Math.round(run.level),
      p_distance_m: Math.round(run.distanceM),
      p_squirrels: Math.round(run.squirrels),
      p_treats: Math.round(run.treats),
      p_duration_ms: Math.round(run.durationMs),
      p_client_version: run.clientVersion.slice(0, 32),
    });
    if (error || !data || typeof data !== 'object') {
      left.push(...pending.slice(index));
      break;
    }
    const body = data as Record<string, unknown>;
    if (body.ok === true) {
      sent = true;
      continue;
    }
    if (body.error === 'bad') {
      continue;
    }
    left.push(...pending.slice(index));
    break;
  }
  await writePending(left);
  if (left.length > 0) {
    return 'kept';
  }
  return sent ? 'sent' : 'skipped';
}
