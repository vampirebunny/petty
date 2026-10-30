import { getDb } from '../db/database';

const key = 'analytics.lastBackgroundAt';
const fiveMinutes = 5 * 60 * 1000;

function readMeta(name: string): string | null {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', name);
  return row?.value ?? null;
}

function writeMeta(name: string, value: string): void {
  getDb().runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', name, value);
}

export function readLastBackgroundAt(): number | null {
  const raw = readMeta(key);
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function noteLastBackgroundAt(now: number): void {
  writeMeta(key, String(now));
}

export function readMetaFlag(name: string): boolean {
  return readMeta(name) === '1';
}

export function writeMetaFlag(name: string): void {
  writeMeta(name, '1');
}

function countKey(petId: string, trickId: string): string {
  return `analytics.attempts.${petId}.${trickId}`;
}

function startKey(petId: string, trickId: string): string {
  return `analytics.trickStart.${petId}.${trickId}`;
}

export function noteTrickAttempt(petId: string, trickId: string): number {
  const next = (Number(readMeta(countKey(petId, trickId))) || 0) + 1;
  writeMeta(countKey(petId, trickId), String(next));
  return next;
}

export function trickAttempts(petId: string, trickId: string): number {
  return Number(readMeta(countKey(petId, trickId))) || 0;
}

export function noteTrickStart(petId: string, trickId: string, now: number): void {
  const name = startKey(petId, trickId);
  if (readMeta(name) == null) {
    writeMeta(name, String(now));
  }
}

export function trickStartedAt(petId: string, trickId: string): number | null {
  const raw = readMeta(startKey(petId, trickId));
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** True when a persisted background is at least five minutes old. Consumes the timestamp. */
export function takeAppReturn(now: number): { hours: number } | null {
  const at = readLastBackgroundAt();
  if (at == null || now - at < fiveMinutes) {
    return null;
  }
  noteLastBackgroundAt(now);
  return { hours: (now - at) / 3_600_000 };
}
