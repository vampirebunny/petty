import { getCachedInstallId } from '../compliance/identity';
import { getSupabase } from '../compliance/supabase';
import { readStandby, setStandby, setSyncedRevision } from '../db/accountMeta';
import { currentOwner } from '../db/currentOwner';
import { getDb } from '../db/database';
import { playerDoc } from '../db/playerHome';
import type { PetState } from '../sim/types';
import { authTransition } from '../state/sessionGate';

export const petDocSchema = 2;
export const playerDocSchema = 2;

type PetPayload = {
  id: string;
  doc: PetState;
  docSchema: number;
  localRevision: number;
  clientUpdatedAt: string;
};

type PlayerPayload = {
  doc: ReturnType<typeof playerDoc>;
  docSchema: number;
  localRevision: number;
  clientUpdatedAt: string;
};

let turnRevision: number | null = null;
let turnTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let delayMs = 400;

function bumpRevision(): number {
  const database = getDb();
  const row = database.getFirstSync<{ value: string }>("SELECT value FROM meta WHERE key = 'localRevision'");
  const next = (row ? Number(row.value) : 0) + 1;
  database.runSync("INSERT OR REPLACE INTO meta (key, value) VALUES ('localRevision', ?)", String(next));
  return next;
}

function revisionForThisTurn(): number {
  if (turnRevision == null) {
    turnRevision = bumpRevision();
    if (turnTimer) {
      clearTimeout(turnTimer);
    }
    turnTimer = setTimeout(() => {
      turnRevision = null;
      turnTimer = null;
    }, 0);
  }
  return turnRevision;
}

function upsert(entityKey: string, kind: string, payload: PetPayload | PlayerPayload): void {
  const database = getDb();
  const body = JSON.stringify(payload);
  const existing = database.getFirstSync<{ seq: number }>('SELECT seq FROM push_queue WHERE entity_key = ?', entityKey);
  if (existing) {
    database.runSync('UPDATE push_queue SET kind = ?, payload = ? WHERE entity_key = ?', kind, body, entityKey);
  } else {
    database.runSync('INSERT INTO push_queue (entity_key, kind, payload) VALUES (?, ?, ?)', entityKey, kind, body);
  }
  kick();
}

export function queuePet(pet: PetState): void {
  const localRevision = revisionForThisTurn();
  upsert(`pet:${pet.id}`, 'push_active_pet', {
    id: pet.id,
    doc: pet,
    docSchema: petDocSchema,
    localRevision,
    clientUpdatedAt: new Date().toISOString(),
  });
}

export function queuePlayer(): void {
  const localRevision = revisionForThisTurn();
  upsert('player', 'push_player_state', {
    doc: playerDoc(currentOwner()),
    docSchema: playerDocSchema,
    localRevision,
    clientUpdatedAt: new Date().toISOString(),
  });
}

export function queueCoupled(pet: PetState): void {
  queuePet(pet);
  queuePlayer();
}

export function queueRetire(pet: PetState): void {
  const database = getDb();
  database.runSync('DELETE FROM push_queue WHERE entity_key = ?', `pet:${pet.id}`);
  const localRevision = bumpRevision();
  database.runSync(
    'INSERT INTO push_queue (entity_key, kind, payload) VALUES (?, ?, ?)',
    `pet:${pet.id}`,
    'retire_pet',
    JSON.stringify({
      id: pet.id,
      doc: pet,
      docSchema: petDocSchema,
      localRevision,
      clientUpdatedAt: new Date().toISOString(),
    } satisfies PetPayload),
  );
  kick(true);
}

export function kick(immediate = false): void {
  if (timer) {
    clearTimeout(timer);
  }
  timer = setTimeout(() => {
    void flush();
  }, immediate ? 0 : delayMs);
}

async function send(kind: string, payload: PetPayload | PlayerPayload): Promise<'ok' | 'stale' | 'not_active' | 'retry' | 'drop'> {
  const supabase = getSupabase();
  const deviceId = getCachedInstallId();
  if (!supabase || !deviceId) {
    return 'retry';
  }
  if (kind === 'push_player_state') {
    const body = payload as PlayerPayload;
    const { data, error } = await supabase.rpc('push_player_state', {
      p_device_id: deviceId,
      p_doc: body.doc,
      p_doc_schema: body.docSchema,
      p_local_revision: body.localRevision,
      p_client_updated_at: body.clientUpdatedAt,
    });
    if (error) {
      return /owner mismatch/i.test(error.message) ? 'drop' : 'retry';
    }
    if (data === 'stale' || data === 'not_active') {
      return data;
    }
    return 'ok';
  }
  const body = payload as PetPayload;
  const { data, error } = await supabase.rpc(kind, {
    p_device_id: deviceId,
    p_id: body.id,
    p_doc: body.doc,
    p_doc_schema: body.docSchema,
    p_local_revision: body.localRevision,
    p_client_updated_at: body.clientUpdatedAt,
  });
  if (error) {
    return /owner mismatch/i.test(error.message) ? 'drop' : 'retry';
  }
  if (data === 'stale' || data === 'not_active') {
    return data;
  }
  return 'ok';
}

async function flush(): Promise<void> {
  if (running || authTransition() !== 'idle' || readStandby()) {
    return;
  }
  const row = getDb().getFirstSync<{ seq: number; kind: string; payload: string }>(
    'SELECT seq, kind, payload FROM push_queue ORDER BY seq ASC LIMIT 1',
  );
  if (!row) {
    delayMs = 400;
    void flushOutbox();
    return;
  }
  running = true;
  let again = false;
  try {
    const result = await send(row.kind, JSON.parse(row.payload) as PetPayload | PlayerPayload);
    if (result === 'ok' || result === 'drop') {
      if (result === 'drop') {
        console.warn('owner mismatch on push; dropping the queued row');
      }
      getDb().runSync('DELETE FROM push_queue WHERE seq = ?', row.seq);
      const sent = JSON.parse(row.payload) as { localRevision?: number };
      if (result === 'ok' && typeof sent.localRevision === 'number') {
        setSyncedRevision(sent.localRevision);
      }
      delayMs = 400;
      again = true;
    } else if (result === 'not_active') {
      setStandby(true);
    } else if (result === 'stale') {
      const { reconcileFromServer } = await import('./reconcile');
      void reconcileFromServer();
    } else {
      delayMs = Math.min(delayMs * 2, 60_000);
      again = true;
    }
  } catch {
    delayMs = Math.min(delayMs * 2, 60_000);
    again = true;
  } finally {
    running = false;
  }
  if (again) {
    const more = getDb().getFirstSync<{ seq: number }>('SELECT seq FROM push_queue LIMIT 1');
    if (more) {
      kick();
    } else {
      void flushOutbox();
    }
  }
}

async function flushOutbox(): Promise<void> {
  if (authTransition() !== 'idle' || readStandby()) {
    return;
  }
  const supabase = getSupabase();
  const deviceId = getCachedInstallId();
  if (!supabase || !deviceId) {
    return;
  }
  const rows = getDb().getAllSync<{ idempotency_key: string; payload: string }>(
    'SELECT idempotency_key, payload FROM ledger_outbox',
  );
  if (rows.length === 0) {
    return;
  }
  const entries = rows.map((row) => JSON.parse(row.payload) as unknown);
  const { data, error } = await supabase.rpc('append_ledger_entries', {
    p_device_id: deviceId,
    p_entries: entries,
    p_replay: false,
  });
  if (error) {
    return;
  }
  if (data === 'not_active') {
    setStandby(true);
    return;
  }
  const results = Array.isArray(data) ? data : [];
  for (const row of rows) {
    const match = results.find((item) => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      const key = (item as { idempotency_key?: string }).idempotency_key;
      return key === row.idempotency_key;
    }) as { status?: string } | undefined;
    if (match?.status === 'ok' || match?.status === 'duplicate' || match?.status === 'invalid') {
      getDb().runSync('DELETE FROM ledger_outbox WHERE idempotency_key = ?', row.idempotency_key);
    }
  }
}
