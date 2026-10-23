import * as SQLite from 'expo-sqlite';

export const storageVersion = 2;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  source TEXT NOT NULL,
  source_ref TEXT,
  device_time TEXT NOT NULL,
  server_time TEXT,
  device_id TEXT,
  app_version TEXT,
  config_version INTEGER,
  catalog_version INTEGER,
  UNIQUE (owner_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS transaction_lines (
  transaction_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  delta INTEGER NOT NULL,
  unit_price INTEGER,
  deal INTEGER NOT NULL DEFAULT 0,
  serial INTEGER,
  PRIMARY KEY (transaction_id, asset)
);
CREATE TABLE IF NOT EXISTS limited_confirms (
  request_id TEXT PRIMARY KEY NOT NULL,
  item_id TEXT NOT NULL,
  price INTEGER NOT NULL,
  serial INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS limited_stock_cache (
  item_id TEXT PRIMARY KEY NOT NULL,
  cap INTEGER NOT NULL,
  units_left INTEGER NOT NULL,
  sold_out_at TEXT
);
CREATE TABLE IF NOT EXISTS balances (
  owner_id TEXT PRIMARY KEY NOT NULL,
  boops INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory (
  owner_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  first_acquired_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, item_id)
);
CREATE TABLE IF NOT EXISTS owner_state (
  owner_id TEXT PRIMARY KEY NOT NULL,
  time_paid_through INTEGER NOT NULL,
  time_capped_day TEXT,
  last_trusted_time INTEGER NOT NULL,
  server_time_offset_ms INTEGER NOT NULL,
  login_streak INTEGER NOT NULL,
  login_last_claimed_day TEXT,
  last_open_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS daily_counters (
  day TEXT NOT NULL,
  pet_id TEXT NOT NULL,
  key TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (day, pet_id, key)
);
CREATE TABLE IF NOT EXISTS pet (
  id TEXT PRIMARY KEY NOT NULL,
  json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS retired_pets (
  id TEXT PRIMARY KEY NOT NULL,
  json TEXT NOT NULL,
  retired_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS owned_toys (
  owner_id TEXT NOT NULL,
  toy_id TEXT NOT NULL,
  PRIMARY KEY (owner_id, toy_id)
);
CREATE TABLE IF NOT EXISTS owned_furniture (
  owner_id TEXT NOT NULL,
  piece_id TEXT NOT NULL,
  json TEXT NOT NULL,
  PRIMARY KEY (owner_id, piece_id)
);
CREATE TABLE IF NOT EXISTS home_layouts (
  owner_id TEXT NOT NULL,
  species TEXT NOT NULL,
  placements TEXT NOT NULL,
  PRIMARY KEY (owner_id, species)
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS push_queue (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shop_day (
  owner_id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  picks TEXT NOT NULL,
  deal_id TEXT
);
CREATE TABLE IF NOT EXISTS shop_pick_history (
  owner_id TEXT NOT NULL,
  date TEXT NOT NULL,
  slot TEXT NOT NULL,
  item_id TEXT NOT NULL,
  PRIMARY KEY (owner_id, date, slot)
);
CREATE TABLE IF NOT EXISTS shop_catalog_cache (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  active_json TEXT,
  active_version INTEGER,
  pending_json TEXT,
  pending_version INTEGER,
  pending_on TEXT
);
`;

const DROP_LEGACY = `
DROP TABLE IF EXISTS limited_stock_cache;
DROP TABLE IF EXISTS limited_confirms;
DROP TABLE IF EXISTS transaction_lines;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS balances;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS owner_state;
DROP TABLE IF EXISTS daily_counters;
DROP TABLE IF EXISTS pet;
DROP TABLE IF EXISTS retired_pets;
DROP TABLE IF EXISTS owned_toys;
DROP TABLE IF EXISTS owned_furniture;
DROP TABLE IF EXISTS home_layouts;
DROP TABLE IF EXISTS push_queue;
DROP TABLE IF EXISTS shop_day;
DROP TABLE IF EXISTS shop_pick_history;
DROP TABLE IF EXISTS shop_catalog_cache;
DROP TABLE IF EXISTS meta;
`;

function ensureLedgerColumns(database: SQLite.SQLiteDatabase): void {
  const columns = (table: string) =>
    database.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`).map((column) => column.name);
  const transactions = columns('transactions');
  if (!transactions.includes('catalog_version')) {
    database.execSync('ALTER TABLE transactions ADD COLUMN catalog_version INTEGER');
  }
  const lines = columns('transaction_lines');
  if (!lines.includes('unit_price')) {
    database.execSync('ALTER TABLE transaction_lines ADD COLUMN unit_price INTEGER');
  }
  if (!lines.includes('deal')) {
    database.execSync('ALTER TABLE transaction_lines ADD COLUMN deal INTEGER NOT NULL DEFAULT 0');
  }
  if (!lines.includes('serial')) {
    database.execSync('ALTER TABLE transaction_lines ADD COLUMN serial INTEGER');
  }
}

let db: SQLite.SQLiteDatabase | null = null;
let pendingAsyncWipe = false;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('boop.db');
    db.execSync('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
    const row = db.getFirstSync<{ value: string }>("SELECT value FROM meta WHERE key = 'storageVersion'");
    const version = row ? Number(row.value) : 0;
    if (version < storageVersion) {
      db.execSync(DROP_LEGACY);
      db.execSync(SCHEMA);
      db.runSync("INSERT INTO meta (key, value) VALUES ('storageVersion', ?)", String(storageVersion));
      pendingAsyncWipe = true;
    } else {
      db.execSync(SCHEMA);
      ensureLedgerColumns(db);
    }
  }
  return db;
}

export function takeAsyncWipe(): boolean {
  getDb();
  const due = pendingAsyncWipe;
  pendingAsyncWipe = false;
  return due;
}

// withTransactionSync does not return the callback's value, so callers keep the result outside.
export function transaction<T>(run: () => T): T {
  const database = getDb();
  let result!: T;
  database.withTransactionSync(() => {
    result = run();
  });
  return result;
}
