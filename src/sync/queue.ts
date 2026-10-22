import { getSupabase } from '../compliance/supabase';
import { currentOwner } from '../db/currentOwner';
import { getDb } from '../db/database';
import { playerDoc } from '../db/playerHome';
import type { PetState } from '../sim/types';

export const petDocSchema = 2;
export const playerDocSchema = 1;

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

async function send(kind: string, payload: PetPayload | PlayerPayload): Promise<'ok' | 'stale' | 'retry'> {
  const supabase = getSupabase();
  if (!supabase) {
    return 'retry';
  }
  if (kind === 'push_player_state') {
    const body = payload as PlayerPayload;
    const { data, error } = await supabase.rpc('push_player_state', {
      p_doc: body.doc,
      p_doc_schema: body.docSchema,
      p_local_revision: body.localRevision,
      p_client_updated_at: body.clientUpdatedAt,
    });
    if (error) {
      return 'retry';
    }
    return data === 'stale' ? 'stale' : 'ok';
  }
  const body = payload as PetPayload;
  const { data, error } = await supabase.rpc(kind, {
    p_id: body.id,
    p_doc: body.doc,
    p_doc_schema: body.docSchema,
    p_local_revision: body.localRevision,
    p_client_updated_at: body.clientUpdatedAt,
  });
  if (error) {
    return 'retry';
  }
  return data === 'stale' ? 'stale' : 'ok';
}

async function flush(): Promise<void> {
  if (running) {
    return;
  }
  const row = getDb().getFirstSync<{ seq: number; kind: string; payload: string }>(
    'SELECT seq, kind, payload FROM push_queue ORDER BY seq ASC LIMIT 1',
  );
  if (!row) {
    delayMs = 400;
    return;
  }
  running = true;
  let again = false;
  try {
    const result = await send(row.kind, JSON.parse(row.payload) as PetPayload | PlayerPayload);
    if (result === 'ok' || result === 'stale') {
      getDb().runSync('DELETE FROM push_queue WHERE seq = ?', row.seq);
      delayMs = 400;
      again = true;
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
    }
  }
}
