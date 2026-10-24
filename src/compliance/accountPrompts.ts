import { readAccountLinked } from '../db/accountMeta';
import { getDb } from '../db/database';

export const ACCOUNT_PROMPT_FRIENDS = false;
export const ACCOUNT_PROMPT_PURCHASE = false;

const daysKey = 'promptDays';
const showsKey = 'promptDay3Shows';
const dismissedKey = 'promptDismissedDay';

const listeners = new Set<() => void>();

function readMeta(key: string): string | null {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value ?? null;
}

function writeMeta(key: string, value: string): void {
  getDb().runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function onAccountPrompts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function promptShips(prompt: 'friends' | 'purchase' | 'day3'): boolean {
  if (prompt === 'friends') {
    return ACCOUNT_PROMPT_FRIENDS;
  }
  if (prompt === 'purchase') {
    return ACCOUNT_PROMPT_PURCHASE;
  }
  return true;
}

export function localDay(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(day: string, count: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const next = new Date(year, month - 1, date);
  next.setDate(next.getDate() + count);
  return localDay(next);
}

function readDays(): string[] {
  const raw = readMeta(daysKey);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((day): day is string => typeof day === 'string');
  } catch {
    return [];
  }
}

function readShows(): number {
  const raw = readMeta(showsKey);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function noteForegroundDay(now = new Date()): void {
  const today = localDay(now);
  const days = readDays();
  if (days.includes(today) || days.length >= 3) {
    return;
  }
  days.push(today);
  writeMeta(daysKey, JSON.stringify(days));
  notify();
}

export function day3Due(now = new Date()): boolean {
  if (!promptShips('day3') || readAccountLinked() || readDays().length < 3 || readShows() >= 2) {
    return false;
  }
  const dismissed = readMeta(dismissedKey);
  if (dismissed && localDay(now) < addDays(dismissed, 3)) {
    return false;
  }
  return true;
}

export function dismissDay3(now = new Date()): void {
  writeMeta(showsKey, String(readShows() + 1));
  writeMeta(dismissedKey, localDay(now));
  notify();
}
