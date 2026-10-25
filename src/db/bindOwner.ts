import AsyncStorage from '@react-native-async-storage/async-storage';

import { createUuid } from '../compliance/identity';
import { notifyInstallState } from '../state/sessionGate';
import { getDb, transaction } from './database';
import { ownerIdTables } from './ownerTables';

export { ownerIdTables };

function copyRowIfMissing(sqlCount: string, sqlCopy: () => void, from: string, to: string): void {
  const database = getDb();
  const existing = database.getFirstSync<{ n: number }>(sqlCount, to);
  if ((existing?.n ?? 0) > 0) {
    return;
  }
  const source = database.getFirstSync<{ n: number }>(sqlCount, from);
  if ((source?.n ?? 0) === 0) {
    return;
  }
  sqlCopy();
}

export function copyOwnerRows(from: string, to: string): void {
  if (from === to) {
    return;
  }
  const database = getDb();
  copyRowIfMissing(
    'SELECT COUNT(*) AS n FROM balances WHERE owner_id = ?',
    () => {
      database.runSync(
        `INSERT INTO balances (owner_id, boops, updated_at)
         SELECT ?, boops, updated_at FROM balances WHERE owner_id = ?`,
        to,
        from,
      );
    },
    from,
    to,
  );
  copyRowIfMissing(
    'SELECT COUNT(*) AS n FROM owner_state WHERE owner_id = ?',
    () => {
      database.runSync(
        `INSERT INTO owner_state (
           owner_id, time_paid_through, time_capped_day, last_trusted_time, server_time_offset_ms,
           login_streak, login_last_claimed_day, last_open_at
         )
         SELECT ?, time_paid_through, time_capped_day, last_trusted_time, server_time_offset_ms,
           login_streak, login_last_claimed_day, last_open_at
         FROM owner_state WHERE owner_id = ?`,
        to,
        from,
      );
    },
    from,
    to,
  );
  const inventory = database.getAllSync<{ item_id: string; quantity: number; first_acquired_at: string }>(
    'SELECT item_id, quantity, first_acquired_at FROM inventory WHERE owner_id = ?',
    from,
  );
  for (const row of inventory) {
    database.runSync(
      'INSERT OR IGNORE INTO inventory (owner_id, item_id, quantity, first_acquired_at) VALUES (?, ?, ?, ?)',
      to,
      row.item_id,
      row.quantity,
      row.first_acquired_at,
    );
  }
  const toys = database.getAllSync<{ toy_id: string }>('SELECT toy_id FROM owned_toys WHERE owner_id = ?', from);
  for (const row of toys) {
    database.runSync('INSERT OR IGNORE INTO owned_toys (owner_id, toy_id) VALUES (?, ?)', to, row.toy_id);
  }
  copyRowIfMissing(
    'SELECT COUNT(*) AS n FROM shop_day WHERE owner_id = ?',
    () => {
      database.runSync(
        `INSERT INTO shop_day (owner_id, date, picks, deal_id)
         SELECT ?, date, picks, deal_id FROM shop_day WHERE owner_id = ?`,
        to,
        from,
      );
    },
    from,
    to,
  );
  const history = database.getAllSync<{ date: string; slot: string; item_id: string }>(
    'SELECT date, slot, item_id FROM shop_pick_history WHERE owner_id = ?',
    from,
  );
  for (const row of history) {
    database.runSync(
      'INSERT OR IGNORE INTO shop_pick_history (owner_id, date, slot, item_id) VALUES (?, ?, ?, ?)',
      to,
      row.date,
      row.slot,
      row.item_id,
    );
  }
  const pieces = database.getAllSync<{ piece_id: string; json: string }>(
    'SELECT piece_id, json FROM owned_furniture WHERE owner_id = ?',
    from,
  );
  for (const row of pieces) {
    database.runSync(
      'INSERT OR IGNORE INTO owned_furniture (owner_id, piece_id, json) VALUES (?, ?, ?)',
      to,
      row.piece_id,
      row.json,
    );
  }
  const trickProps = database.getAllSync<{ instance_id: string; prop_type: string; source_trick_id: string }>(
    'SELECT instance_id, prop_type, source_trick_id FROM owned_trick_props WHERE owner_id = ?',
    from,
  );
  for (const row of trickProps) {
    database.runSync(
      'INSERT OR IGNORE INTO owned_trick_props (owner_id, instance_id, prop_type, source_trick_id) VALUES (?, ?, ?, ?)',
      to,
      row.instance_id,
      row.prop_type,
      row.source_trick_id,
    );
  }
  const layouts = database.getAllSync<{ species: string; placements: string }>(
    'SELECT species, placements FROM home_layouts WHERE owner_id = ?',
    from,
  );
  for (const row of layouts) {
    database.runSync(
      'INSERT OR IGNORE INTO home_layouts (owner_id, species, placements) VALUES (?, ?, ?)',
      to,
      row.species,
      row.placements,
    );
  }
  const transactions = database.getAllSync<{
    id: string;
    idempotency_key: string;
    source: string;
    source_ref: string | null;
    device_time: string;
    server_time: string | null;
    device_id: string | null;
    app_version: string | null;
    config_version: number | null;
  }>('SELECT * FROM transactions WHERE owner_id = ?', from);
  for (const row of transactions) {
    const taken = database.getFirstSync<{ id: string }>(
      'SELECT id FROM transactions WHERE owner_id = ? AND idempotency_key = ?',
      to,
      row.idempotency_key,
    );
    if (taken) {
      continue;
    }
    const id = createUuid();
    database.runSync(
      `INSERT INTO transactions (
         id, owner_id, idempotency_key, source, source_ref, device_time, server_time, device_id, app_version, config_version
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      to,
      row.idempotency_key,
      row.source,
      row.source_ref,
      row.device_time,
      row.server_time,
      row.device_id,
      row.app_version,
      row.config_version,
    );
    const lines = database.getAllSync<{
      line_no: number;
      asset: string;
      delta: number;
      unit_price: number | null;
      deal: number;
      serial: number | null;
      toy_id: string | null;
      furniture_id: string | null;
      scene: string | null;
    }>(
      'SELECT line_no, asset, delta, unit_price, deal, serial, toy_id, furniture_id, scene FROM transaction_lines WHERE transaction_id = ?',
      row.id,
    );
    for (const line of lines) {
      database.runSync(
        `INSERT INTO transaction_lines (
           transaction_id, line_no, asset, delta, unit_price, deal, serial, toy_id, furniture_id, scene
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        line.line_no,
        line.asset,
        line.delta,
        line.unit_price,
        line.deal,
        line.serial,
        line.toy_id,
        line.furniture_id,
        line.scene,
      );
    }
  }
}

function rewritePetTable(table: 'pet' | 'retired_pets', from: string, to: string): void {
  const database = getDb();
  const rows = database.getAllSync<{ id: string; json: string }>(`SELECT id, json FROM ${table}`);
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.json) as { ownerId?: string };
      if (parsed.ownerId !== from) {
        continue;
      }
      parsed.ownerId = to;
      database.runSync(`UPDATE ${table} SET json = ? WHERE id = ?`, JSON.stringify(parsed), row.id);
    } catch {
      // Leave a row that is not JSON alone.
    }
  }
}

async function movePlaydates(from: string, to: string): Promise<void> {
  const sourceKey = `petty.playdates.${from}`;
  const destKey = `petty.playdates.${to}`;
  const dest = await AsyncStorage.getItem(destKey);
  if (dest != null) {
    return;
  }
  const source = await AsyncStorage.getItem(sourceKey);
  if (source == null) {
    return;
  }
  try {
    const parsed = JSON.parse(source) as { history?: { ownerId?: string }[] };
    if (Array.isArray(parsed.history)) {
      parsed.history = parsed.history.map((record) => ({ ...record, ownerId: to }));
    }
    await AsyncStorage.setItem(destKey, JSON.stringify(parsed));
    await AsyncStorage.removeItem(sourceKey);
  } catch {
    // A broken playdate save stays on the install key.
  }
}

function rewriteOwnerColumn(table: (typeof ownerIdTables)[number], from: string, to: string): void {
  const database = getDb();
  database.runSync(`UPDATE ${table} SET owner_id = ? WHERE owner_id = ?`, to, from);
}

function rewriteQueuePayloads(from: string, to: string): void {
  const database = getDb();
  const rows = database.getAllSync<{ seq: number; payload: string }>('SELECT seq, payload FROM push_queue');
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.payload) as { doc?: { ownerId?: string }; id?: string };
      if (parsed.doc?.ownerId !== from) {
        continue;
      }
      parsed.doc.ownerId = to;
      database.runSync('UPDATE push_queue SET payload = ? WHERE seq = ?', JSON.stringify(parsed), row.seq);
    } catch {
      // A payload that is not JSON stays queued.
    }
  }
}

async function moveOwnerKey(prefix: string, from: string, to: string): Promise<void> {
  const sourceKey = `${prefix}${from}`;
  const destKey = `${prefix}${to}`;
  const dest = await AsyncStorage.getItem(destKey);
  if (dest != null) {
    await AsyncStorage.removeItem(sourceKey);
    return;
  }
  const source = await AsyncStorage.getItem(sourceKey);
  if (source == null) {
    return;
  }
  await AsyncStorage.setItem(destKey, source);
  await AsyncStorage.removeItem(sourceKey);
}

/** One transaction. Rewrites every owner-keyed row from `from` to `to`, then installs that state. */
export async function rebindOwner(from: string, to: string): Promise<void> {
  if (!from || !to || from === to) {
    return;
  }
  transaction(() => {
    for (const table of ownerIdTables) {
      rewriteOwnerColumn(table, from, to);
    }
    rewritePetTable('pet', from, to);
    rewritePetTable('retired_pets', from, to);
    rewriteQueuePayloads(from, to);
  });
  await movePlaydates(from, to);
  await moveOwnerKey('petty.wardrobe.', from, to);
  notifyInstallState();
}

export async function bindInstallToAuth(installId: string, authId: string): Promise<void> {
  await rebindOwner(installId, authId);
}
