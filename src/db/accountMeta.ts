import { getDb } from './database';

const standbyListeners = new Set<() => void>();

function readMeta(key: string): string | null {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value ?? null;
}

function writeMeta(key: string, value: string): void {
  getDb().runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
}

export function readAccountLinked(): boolean {
  return readMeta('accountLinked') === '1';
}

export function setAccountLinked(linked: boolean): void {
  writeMeta('accountLinked', linked ? '1' : '0');
}

export function readStandby(): boolean {
  return readMeta('standby') === '1';
}

export function setStandby(standby: boolean): void {
  writeMeta('standby', standby ? '1' : '0');
  for (const listener of standbyListeners) {
    listener();
  }
}

export function onStandbyChange(listener: () => void): () => void {
  standbyListeners.add(listener);
  return () => {
    standbyListeners.delete(listener);
  };
}

export function readServerOffsetMs(): number {
  const raw = readMeta('serverTimeOffsetMs');
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function setServerOffsetMs(offsetMs: number): void {
  writeMeta('serverTimeOffsetMs', String(offsetMs));
}

export function serverNow(now = Date.now()): number {
  return now + readServerOffsetMs();
}

export function readSyncedRevision(): number {
  const raw = readMeta('syncedRevision');
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function setSyncedRevision(revision: number): void {
  writeMeta('syncedRevision', String(revision));
}

export function readOtherDeviceLabel(): string | null {
  return readMeta('otherDeviceLabel');
}

export function setOtherDeviceLabel(label: string | null): void {
  if (label) {
    writeMeta('otherDeviceLabel', label);
  } else {
    getDb().runSync("DELETE FROM meta WHERE key = 'otherDeviceLabel'");
  }
}

export function readLocalRevision(): number {
  const raw = readMeta('localRevision');
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}
