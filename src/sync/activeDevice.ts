import { createUuid, getCachedInstallId, getOrCreateInstallId } from '../compliance/identity';
import { getSupabase } from '../compliance/supabase';
import { cancelReminders } from '../reminders/notifications';
import {
  readLocalRevision,
  readSyncedRevision,
  setHandleSaved,
  setOtherDeviceLabel,
  setServerOffsetMs,
  setStandby,
} from '../db/accountMeta';
import { getDb } from '../db/database';
import { deviceNow } from './clientScope';
import { deviceLabel } from './deviceLabel';

export type ClaimResult = {
  active_device_id_before: string | null;
  last_seen_before: string | null;
  server_now: string;
  server_revision: number;
  has_handle: boolean;
};

export type PeekResult = {
  active_device_id: string | null;
  active_device_label: string | null;
  last_seen: string | null;
};

export function hasUnsentPlay(): boolean {
  if (readLocalRevision() > readSyncedRevision()) {
    return true;
  }
  const queued = getDb().getFirstSync<{ seq: number }>('SELECT seq FROM push_queue LIMIT 1');
  if (queued) {
    return true;
  }
  const rows = getDb().getAllSync<{ payload: string }>('SELECT payload FROM ledger_outbox');
  return rows.some((row) => {
    try {
      const parsed = JSON.parse(row.payload) as { kind?: string };
      return parsed.kind === 'earn' || parsed.kind === 'consume';
    } catch {
      return false;
    }
  });
}

export async function peekActiveDevice(): Promise<PeekResult | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.rpc('peek_active_device');
  if (error || !data || typeof data !== 'object') {
    return null;
  }
  const row = data as PeekResult;
  if (row.active_device_label) {
    setOtherDeviceLabel(row.active_device_label);
  }
  return row;
}

export async function claimDevice(options?: { claimId?: string; timeoutMs?: number }): Promise<ClaimResult | null> {
  const supabase = getSupabase();
  const deviceId = await getOrCreateInstallId();
  if (!supabase || !deviceId) {
    return null;
  }
  const claimId = options?.claimId ?? createUuid();
  let stale = false;
  const run = async (): Promise<ClaimResult | null> => {
    const { data, error } = await supabase.rpc('claim_device', {
      p_device_id: deviceId,
      p_claim_id: claimId,
      p_device_label: deviceLabel(),
    });
    if (stale || error || !data || typeof data !== 'object') {
      return null;
    }
    const claim = data as ClaimResult;
    if (claim.has_handle) {
      setHandleSaved(true);
    }
    const serverNowMs = Date.parse(claim.server_now);
    if (Number.isFinite(serverNowMs)) {
      setServerOffsetMs(serverNowMs - deviceNow());
    }
    return claim;
  };
  if (!options?.timeoutMs) {
    return run();
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timed = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      stale = true;
      resolve(null);
    }, options.timeoutMs);
  });
  const result = await Promise.race([run(), timed]);
  if (timer) {
    clearTimeout(timer);
  }
  return result;
}

/** Standby until Play here. A label peek does not claim. */
export async function enterStandby(peekLabel: boolean): Promise<void> {
  setStandby(true);
  await cancelReminders();
  if (peekLabel) {
    await peekActiveDevice();
    setStandby(true);
  }
}

export async function touchLastSeen(): Promise<void> {
  const supabase = getSupabase();
  const deviceId = getCachedInstallId();
  if (!supabase || !deviceId) {
    return;
  }
  await supabase.rpc('touch_last_seen', { p_device_id: deviceId });
}
