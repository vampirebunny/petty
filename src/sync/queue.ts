import { getCachedInstallId, getSessionUserId } from '../compliance/identity';
import { getSupabase } from '../compliance/supabase';
import { readLocalRevision, readStandby, setLocalRevision, setSyncedRevision } from '../db/accountMeta';
import { currentOwner } from '../db/currentOwner';
import { getDb } from '../db/database';
import { playerDoc } from '../db/playerHome';
import type { PetState } from '../sim/types';
import { authTransition } from '../state/sessionGate';
import { enterStandby } from './activeDevice';
import { activeClient, enterClient, leaveClient, type ClientBinding } from './clientScope';

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
let flushRequested = false;
let preferLocalPet = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let delayMs = 400;
let finishSeq = 0;

type SendResult = 'ok' | 'stale' | 'not_active' | 'retry' | 'drop' | 'name' | 'owner' | 'auth' | 'retired';

const finishes = new Map<string, { outcome: SendResult; seq: number }>();

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function noteFinish(key: string, outcome: SendResult): void {
  finishSeq += 1;
  finishes.set(key, { outcome, seq: finishSeq });
}

async function waitForPush(key: string, since: number, timeoutMs: number): Promise<SendResult> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const done = finishes.get(key);
    if (done && done.seq > since && done.outcome !== 'retry') {
      return done.outcome;
    }
    await sleep(50);
  }
  return 'retry';
}

function prepareRevisionAbove(floor: number): void {
  setLocalRevision(Math.max(readLocalRevision(), floor));
  turnRevision = null;
  if (turnTimer) {
    clearTimeout(turnTimer);
    turnTimer = null;
  }
}

async function serverActivePet(): Promise<{ id: string | null; revision: number } | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.rpc('pull_account_state');
  if (error || !data || typeof data !== 'object') {
    return null;
  }
  const body = data as { pet?: { id?: string } | null; server_revision?: number };
  const revision = typeof body.server_revision === 'number' ? body.server_revision : 0;
  const id = body.pet && typeof body.pet.id === 'string' ? body.pet.id : null;
  return { id, revision };
}

export type PetPush = { pet: PetState; reason: string | null };

// Save this pet on the server before a reader such as the Stadium asks for it.
export async function pushPetBeforeRead(pet: PetState): Promise<PetPush> {
  const started = Date.now();
  while (Date.now() - started < 8000) {
    if (authTransition() === 'idle' && !readStandby() && getSupabase()) {
      break;
    }
    await sleep(50);
  }
  if (readStandby()) {
    return { pet, reason: 'not_active' };
  }
  if (authTransition() !== 'idle' || !getSupabase()) {
    return { pet, reason: 'not authenticated' };
  }
  const userId = await getSessionUserId();
  const stamped = userId && pet.ownerId !== userId ? { ...pet, ownerId: userId } : pet;
  const key = `pet:${stamped.id}`;
  preferLocalPet = true;
  try {
    let since = finishSeq;
    queuePet(stamped);
    kick(true);
    let outcome = await waitForPush(key, since, 8000);
    if (outcome === 'stale') {
      const server = await serverActivePet();
      if (server?.id === stamped.id) {
        return { pet: stamped, reason: null };
      }
      if (server && server.id !== stamped.id) {
        prepareRevisionAbove(server.revision);
        since = finishSeq;
        queuePet(stamped);
        kick(true);
        outcome = await waitForPush(key, since, 8000);
      }
    }
    if (outcome === 'ok') {
      return { pet: stamped, reason: null };
    }
    if (outcome === 'name') {
      return { pet: stamped, reason: 'name' };
    }
    if (outcome === 'owner') {
      return { pet: stamped, reason: 'owner mismatch' };
    }
    if (outcome === 'auth') {
      return { pet: stamped, reason: 'not authenticated' };
    }
    if (outcome === 'not_active') {
      return { pet: stamped, reason: 'not_active' };
    }
    if (outcome === 'retired') {
      return { pet: stamped, reason: 'retired' };
    }
    return { pet: stamped, reason: 'pet not synced' };
  } finally {
    preferLocalPet = false;
  }
}

export function kick(immediate = false): void {
  // A harness client must stay entered across the flush, so don't defer to a timer.
  if (activeClient()) {
    void flush();
    return;
  }
  if (timer) {
    clearTimeout(timer);
  }
  timer = setTimeout(() => {
    void flush();
  }, immediate ? 0 : delayMs);
}

async function send(kind: string, payload: PetPayload | PlayerPayload): Promise<SendResult> {
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
    if (/owner mismatch/i.test(error.message)) {
      return 'owner';
    }
    if (/not authenticated/i.test(error.message)) {
      return 'auth';
    }
    if (/retired/i.test(error.message)) {
      return 'retired';
    }
    return 'retry';
  }
  if (data === 'stale' || data === 'not_active') {
    return data;
  }
  if (data === 'name') {
    return 'name';
  }
  return 'ok';
}

function resumeBound(bound: ClientBinding | null): boolean {
  if (bound && activeClient() == null) {
    enterClient(bound);
    return true;
  }
  return false;
}

async function flush(): Promise<void> {
  const bound = activeClient();
  if (running) {
    flushRequested = true;
    return;
  }
  if (authTransition() !== 'idle' || readStandby()) {
    return;
  }
  const row = getDb().getFirstSync<{ seq: number; entity_key: string; kind: string; payload: string }>(
    'SELECT seq, entity_key, kind, payload FROM push_queue ORDER BY seq ASC LIMIT 1',
  );
  if (!row) {
    delayMs = 400;
    void flushOutbox();
    return;
  }
  running = true;
  let again = false;
  let paused = false;
  try {
    const result = await send(row.kind, JSON.parse(row.payload) as PetPayload | PlayerPayload);
    noteFinish(row.entity_key, result);
    paused = resumeBound(bound);
    if (result === 'ok' || result === 'drop' || result === 'name' || result === 'owner' || result === 'auth' || result === 'retired') {
      if (result !== 'ok') {
        console.warn('dropping the queued push', result);
      }
      getDb().runSync('DELETE FROM push_queue WHERE seq = ?', row.seq);
      const sent = JSON.parse(row.payload) as { localRevision?: number };
      if (result === 'ok' && typeof sent.localRevision === 'number') {
        setSyncedRevision(sent.localRevision);
      }
      delayMs = 400;
      again = true;
    } else if (result === 'not_active') {
      void enterStandby(true);
    } else if (result === 'stale') {
      if (!preferLocalPet) {
        const { reconcileFromServer } = await import('./reconcile');
        void reconcileFromServer();
      }
    } else {
      delayMs = Math.min(delayMs * 2, 60_000);
      again = true;
    }
  } catch {
    delayMs = Math.min(delayMs * 2, 60_000);
    again = true;
    paused = paused || resumeBound(bound);
  } finally {
    running = false;
    const follow = flushRequested;
    flushRequested = false;
    if (again) {
      const more = getDb().getFirstSync<{ seq: number }>('SELECT seq FROM push_queue LIMIT 1');
      if (more) {
        kick();
      } else {
        void flushOutbox();
      }
    } else if (follow) {
      kick(true);
    }
    if (paused) {
      leaveClient();
    }
  }
}

async function flushOutbox(): Promise<void> {
  const bound = activeClient();
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
  const paused = resumeBound(bound);
  try {
    if (error) {
      return;
    }
    if (data === 'not_active') {
      void enterStandby(true);
      return;
    }
    const results = Array.isArray(data) ? data : [];
    const rejectedTime = rows.filter((row) => {
      const match = results.find((item) => {
        if (!item || typeof item !== 'object') {
          return false;
        }
        return (item as { idempotency_key?: string }).idempotency_key === row.idempotency_key;
      }) as { status?: string } | undefined;
      if (match?.status !== 'invalid') {
        return false;
      }
      try {
        const payload = JSON.parse(row.payload) as { source?: string };
        return payload.source === 'time_payout';
      } catch {
        return false;
      }
    });
    if (rejectedTime.length > 0) {
      const { dropRejectedTimePayout } = await import('../economy/service');
      for (const row of rejectedTime) {
        dropRejectedTimePayout(row.idempotency_key);
      }
    }
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
  } finally {
    if (paused) {
      leaveClient();
    }
  }
}
