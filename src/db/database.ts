import * as SQLite from 'expo-sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  source_ref TEXT,
  device_time TEXT NOT NULL,
  server_time TEXT,
  device_id TEXT,
  app_version TEXT,
  config_version INTEGER,
  metadata TEXT
);
CREATE TABLE IF NOT EXISTS transaction_lines (
  transaction_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  delta INTEGER NOT NULL,
  PRIMARY KEY (transaction_id, asset)
);
CREATE TABLE IF NOT EXISTS balances (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  boops INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory (
  item_id TEXT PRIMARY KEY NOT NULL,
  quantity INTEGER NOT NULL,
  first_acquired_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS owner_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
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
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('boop.db');
    db.execSync(SCHEMA);
    const balance = db.getFirstSync<{ id: number }>('SELECT id FROM balances WHERE id = 1');
    if (!balance) {
      const now = new Date().toISOString();
      const ms = Date.now();
      db.runSync('INSERT INTO balances (id, boops, updated_at) VALUES (1, 0, ?)', now);
      db.runSync(
        `INSERT INTO owner_state (
          id, time_paid_through, time_capped_day, last_trusted_time, server_time_offset_ms,
          login_streak, login_last_claimed_day, last_open_at
        ) VALUES (1, ?, NULL, ?, 0, 0, NULL, 0)`,
        ms,
        ms,
      );
    }
  }
  return db;
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
