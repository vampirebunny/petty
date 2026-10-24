import { getCachedInstallId } from '../compliance/identity';
import { getSupabase } from '../compliance/supabase';
import {
  readAccountLinked,
  setServerOffsetMs,
  setSyncedRevision,
} from '../db/accountMeta';
import { getDb } from '../db/database';
import type { PetState } from '../sim/types';
import { authTransition, notifyInstallState, setAuthTransition } from '../state/sessionGate';
import { enterStandby, type ClaimResult } from './activeDevice';
import { deviceNow } from './clientScope';

type PullState = {
  pet?: PetState | null;
  server_now?: string;
  server_revision?: number;
  active_device_label?: string | null;
};

/** Replace this device's pet with the server pet when the account is newer. Purchases stay in the outbox. */
export async function reconcileFromServer(claim?: ClaimResult | null): Promise<boolean> {
  if (!readAccountLinked()) {
    return false;
  }
  const supabase = getSupabase();
  const deviceId = getCachedInstallId();
  if (!supabase || !deviceId) {
    return false;
  }
  const heldLock = authTransition() === 'reconciling';
  if (!heldLock) {
    setAuthTransition('reconciling');
  }
  try {
    const database = getDb();
    const outbox = database.getAllSync<{ idempotency_key: string; payload: string }>(
      'SELECT idempotency_key, payload FROM ledger_outbox',
    );
    const replay: unknown[] = [];
    for (const row of outbox) {
      try {
        const parsed = JSON.parse(row.payload) as { kind?: string };
        if (parsed.kind === 'earn' || parsed.kind === 'consume') {
          database.runSync('DELETE FROM ledger_outbox WHERE idempotency_key = ?', row.idempotency_key);
        } else {
          replay.push(parsed);
        }
      } catch {
        database.runSync('DELETE FROM ledger_outbox WHERE idempotency_key = ?', row.idempotency_key);
      }
    }
    if (replay.length > 0) {
      const { data } = await supabase.rpc('append_ledger_entries', {
        p_device_id: deviceId,
        p_entries: replay,
        p_replay: true,
      });
      if (data === 'not_active') {
        await enterStandby(true);
        return false;
      }
    }
    database.runSync('DELETE FROM push_queue');
    const { data, error } = await supabase.rpc('pull_account_state');
    if (error || !data || typeof data !== 'object') {
      return false;
    }
    const pulled = data as PullState;
    if (pulled.pet && pulled.pet.id) {
      database.runSync('DELETE FROM pet');
      database.runSync(
        'INSERT INTO pet (id, json, updated_at) VALUES (?, ?, ?)',
        pulled.pet.id,
        JSON.stringify(pulled.pet),
        deviceNow(),
      );
    }
    const serverNowMs = Date.parse(pulled.server_now ?? claim?.server_now ?? '');
    if (Number.isFinite(serverNowMs)) {
      setServerOffsetMs(serverNowMs - deviceNow());
    }
    if (typeof pulled.server_revision === 'number') {
      setSyncedRevision(pulled.server_revision);
    }
    notifyInstallState();
    return true;
  } finally {
    if (!heldLock) {
      setAuthTransition('idle');
    }
  }
}
