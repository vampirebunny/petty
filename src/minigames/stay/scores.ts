import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSupabase } from '../../compliance/supabase';
import { readAccountLinked, readHandleSaved } from '../../db/accountMeta';
import { keepCloser } from './best';
import type { Attempt } from './best';

export type { Attempt } from './best';
export { formatStayTime, gapOf, keepCloser, pickTargetSeconds } from './best';

const pendingKey = 'petty.stay.pending';
const boardKey = 'petty.stay.board';

export type BoardRow = {
  rank: number;
  handle: string;
  targetCs: number;
  actualCs: number;
  mine: boolean;
};

export type BoardMe = {
  rank: number;
  handle: string;
  targetCs: number;
  actualCs: number;
};

export type Board = { rows: BoardRow[]; me: BoardMe | null };

export type FlushResult = 'sent' | 'kept' | 'dropped' | 'skipped';

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

function asAttempt(value: unknown): Attempt | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const targetCs = record.targetCs;
  const actualCs = record.actualCs;
  if (typeof targetCs !== 'number' || typeof actualCs !== 'number') {
    return null;
  }
  if (!Number.isInteger(targetCs) || !Number.isInteger(actualCs)) {
    return null;
  }
  return { targetCs, actualCs };
}

export async function readPending(): Promise<Attempt | null> {
  return asAttempt(await readJson<unknown>(pendingKey));
}

export async function recordRun(next: Attempt): Promise<{ best: Attempt; closer: boolean }> {
  const previous = await readPending();
  const best = keepCloser(previous, next);
  const closer = previous == null || best !== previous;
  if (closer) {
    await AsyncStorage.setItem(pendingKey, JSON.stringify(best));
  }
  return { best, closer };
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
    const targetCs = asNumber(record.targetCs);
    const actualCs = asNumber(record.actualCs);
    if (rank == null || targetCs == null || actualCs == null || typeof record.handle !== 'string') {
      continue;
    }
    rows.push({
      rank,
      handle: record.handle,
      targetCs,
      actualCs,
      mine: record.mine === true,
    });
  }
  let me: BoardMe | null = null;
  if (data.me && typeof data.me === 'object') {
    const record = data.me as Record<string, unknown>;
    const rank = asNumber(record.rank);
    const targetCs = asNumber(record.targetCs);
    const actualCs = asNumber(record.actualCs);
    if (rank != null && targetCs != null && actualCs != null) {
      me = {
        rank,
        handle: typeof record.handle === 'string' ? record.handle : '',
        targetCs,
        actualCs,
      };
    }
  }
  return { rows, me };
}

export async function readCachedBoard(): Promise<Board | null> {
  const saved = await readJson<unknown>(boardKey);
  if (!saved || typeof saved !== 'object') {
    return null;
  }
  return asBoard(saved as Record<string, unknown>);
}

export async function loadBoard(): Promise<Board | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return readCachedBoard();
  }
  const { data, error } = await supabase.rpc('stay_leaderboard');
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

export async function flushStayTime(): Promise<FlushResult> {
  if (!readAccountLinked() || !readHandleSaved()) {
    return 'skipped';
  }
  const pending = await readPending();
  if (!pending) {
    return 'skipped';
  }
  const supabase = getSupabase();
  if (!supabase) {
    return 'kept';
  }
  const { data, error } = await supabase.rpc('submit_stay_time', {
    p_target_cs: pending.targetCs,
    p_actual_cs: pending.actualCs,
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
