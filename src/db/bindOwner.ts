import AsyncStorage from '@react-native-async-storage/async-storage';

import { createUuid } from '../compliance/identity';
import { getDb } from './database';

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
    const lines = database.getAllSync<{ asset: string; delta: number }>(
      'SELECT asset, delta FROM transaction_lines WHERE transaction_id = ?',
      row.id,
    );
    for (const line of lines) {
      database.runSync(
        'INSERT INTO transaction_lines (transaction_id, asset, delta) VALUES (?, ?, ?)',
        id,
        line.asset,
        line.delta,
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

export async function bindInstallToAuth(installId: string, authId: string): Promise<void> {
  if (!installId || !authId || installId === authId) {
    return;
  }
  const database = getDb();
  const done = database.getFirstSync<{ value: string }>("SELECT value FROM meta WHERE key = 'bindAuthId'");
  if (done?.value === authId) {
    return;
  }
  rewritePetTable('pet', installId, authId);
  rewritePetTable('retired_pets', installId, authId);
  copyOwnerRows(installId, authId);
  await movePlaydates(installId, authId);
  database.runSync("INSERT OR REPLACE INTO meta (key, value) VALUES ('bindAuthId', ?)", authId);
}
