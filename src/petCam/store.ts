import { getDb } from '../db/database';

import { clipVersion, type ClipRecord } from './types';
import { gameplayConfig } from '../sim/gameplayConfig';

const seenKey = 'petCam.seen';
const historyKey = 'petCam.history';
const backgroundKey = 'petCam.backgroundAt';

function readMeta(key: string): string | null {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value ?? null;
}

function writeMeta(key: string, value: string): void {
  getDb().runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
}

export function readCamSeen(): boolean {
  return readMeta(seenKey) === '1';
}

export function markCamSeen(): void {
  writeMeta(seenKey, '1');
}

export function readBackgroundAt(): number | null {
  const raw = readMeta(backgroundKey);
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function noteBackgroundAt(now: number): void {
  writeMeta(backgroundKey, String(now));
}

export function readCamHistory(): ClipRecord[] {
  const raw = readMeta(historyKey);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (row): row is ClipRecord =>
        !!row && typeof row === 'object' && (row as ClipRecord).clipVersion === clipVersion && typeof (row as ClipRecord).clipId === 'string',
    );
  } catch {
    return [];
  }
}

export function lastClipId(): string | null {
  const history = readCamHistory();
  return history.length > 0 ? history[history.length - 1].clipId : null;
}

export function pushCamHistory(record: ClipRecord): void {
  const history = readCamHistory();
  history.push(record);
  const cap = gameplayConfig.petCam.history;
  const kept = history.slice(Math.max(0, history.length - cap));
  writeMeta(historyKey, JSON.stringify(kept));
}
