import { capAccrualNow } from '../economy/accrual';
import { deviceNow } from '../sync/clientScope';
import { currentOwner } from './currentOwner';
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
  if (!linked) {
    getDb().runSync("DELETE FROM meta WHERE key = 'accountHandle'");
  }
  notifyAccountFlags();
}

export function readAccountHandle(): string | null {
  const handle = readMeta('accountHandle');
  return handle && handle.length > 0 ? handle : null;
}

export function setAccountHandle(handle: string | null): void {
  if (handle === readAccountHandle()) {
    return;
  }
  if (handle) {
    writeMeta('accountHandle', handle);
  } else {
    getDb().runSync("DELETE FROM meta WHERE key = 'accountHandle'");
  }
  notifyAccountFlags();
}

export function readHandleSaved(): boolean {
  return readMeta('handleSaved') === '1';
}

export function setHandleSaved(saved: boolean): void {
  writeMeta('handleSaved', saved ? '1' : '0');
  notifyAccountFlags();
}

export function readAppleTokenMissing(): boolean {
  return readMeta('appleTokenMissing') === '1';
}

export function setAppleTokenMissing(missing: boolean): void {
  writeMeta('appleTokenMissing', missing ? '1' : '0');
  notifyAccountFlags();
}

const accountFlagListeners = new Set<() => void>();

export function onAccountFlags(listener: () => void): () => void {
  accountFlagListeners.add(listener);
  return () => {
    accountFlagListeners.delete(listener);
  };
}

function notifyAccountFlags(): void {
  for (const listener of accountFlagListeners) {
    listener();
  }
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

export function serverNow(now = deviceNow()): number {
  return now + readServerOffsetMs();
}

const serverSampleKey = 'serverTimeSampleMs';
const serverSamplePerfKey = 'serverTimeSamplePerf';
const accrualRewindSlackMs = 2 * 60_000;

function readNumber(key: string): number | null {
  const raw = readMeta(key);
  if (raw == null) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

// Remember this server instant and, if the accrual cursor was pushed ahead of it, bring the cursor back.
export function noteServerTime(serverNowMs: number, perfNow = globalThis.performance?.now() ?? null): void {
  if (!Number.isFinite(serverNowMs)) {
    return;
  }
  setServerOffsetMs(serverNowMs - deviceNow());
  writeMeta(serverSampleKey, String(serverNowMs));
  if (perfNow != null && Number.isFinite(perfNow)) {
    writeMeta(serverSamplePerfKey, String(perfNow));
  }
  let owner: string;
  try {
    owner = currentOwner();
  } catch {
    return;
  }
  const row = getDb().getFirstSync<{ time_paid_through: number; last_trusted_time: number }>(
    'SELECT time_paid_through, last_trusted_time FROM owner_state WHERE owner_id = ?',
    owner,
  );
  if (!row || row.time_paid_through <= serverNowMs + accrualRewindSlackMs) {
    return;
  }
  getDb().runSync(
    'UPDATE owner_state SET time_paid_through = ?, last_trusted_time = ? WHERE owner_id = ?',
    serverNowMs,
    Math.min(row.last_trusted_time, serverNowMs),
    owner,
  );
}

// Null until a server sample exists. After that, wall-clock changes do not extend accrual.
export function accrualNow(wallNow = deviceNow(), perfNow = globalThis.performance?.now() ?? null): number | null {
  return capAccrualNow({
    wallNow,
    offsetMs: readServerOffsetMs(),
    sampleServerMs: readNumber(serverSampleKey),
    samplePerfMs: readNumber(serverSamplePerfKey),
    perfNowMs: perfNow,
  });
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

export function setLocalRevision(revision: number): void {
  writeMeta('localRevision', String(revision));
}

export type RestoreProgress = { startedAt: number; guestUserId: string };

export function readRestoreInProgress(): RestoreProgress | null {
  const raw = readMeta('restoreInProgress');
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as RestoreProgress;
    if (typeof parsed.startedAt !== 'number' || typeof parsed.guestUserId !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setRestoreInProgress(progress: RestoreProgress | null): void {
  if (!progress) {
    getDb().runSync("DELETE FROM meta WHERE key = 'restoreInProgress'");
  } else {
    writeMeta('restoreInProgress', JSON.stringify(progress));
  }
  notifyAccountFlags();
}

export function readSchoolTrickTip(): boolean {
  return readMeta('schoolTrickTip') === '1';
}

export function setSchoolTrickTip(): void {
  writeMeta('schoolTrickTip', '1');
}

export function readShopPreviewTip(): boolean {
  return readMeta('shopPreviewTip') === '1';
}

export function setShopPreviewTip(): void {
  writeMeta('shopPreviewTip', '1');
}
