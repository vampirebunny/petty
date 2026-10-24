import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { schemaSql, storageVersion } from '../db/database';
import type { BoundDatabase } from './clientScope';

type NodeStatement = {
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
  run: (...params: unknown[]) => { changes: number | bigint; lastInsertRowId: number | bigint };
};

type NodeDatabase = {
  exec: (source: string) => void;
  prepare: (source: string) => NodeStatement;
};

function openNode(filePath: string): BoundDatabase {
  const loaded = require('node:sqlite') as { DatabaseSync: new (path: string) => NodeDatabase };
  const raw = new loaded.DatabaseSync(filePath);
  return {
    execSync: (source) => {
      raw.exec(source);
    },
    getFirstSync: (source, ...params) => {
      const row = raw.prepare(source).get(...params);
      return (row ?? null) as never;
    },
    getAllSync: (source, ...params) => raw.prepare(source).all(...params) as never[],
    runSync: (source, ...params) => {
      const result = raw.prepare(source).run(...params);
      return {
        changes: Number(result.changes),
        lastInsertRowId: Number(result.lastInsertRowId),
      };
    },
    withTransactionSync: (task) => {
      raw.exec('BEGIN');
      try {
        task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

function probe(db: BoundDatabase): boolean {
  try {
    db.execSync('CREATE TABLE IF NOT EXISTS harness_probe (id INTEGER)');
    db.runSync('DELETE FROM harness_probe');
    db.runSync('INSERT INTO harness_probe (id) VALUES (?)', 7);
    const row = db.getFirstSync<{ id: number }>('SELECT id FROM harness_probe');
    db.execSync('DROP TABLE harness_probe');
    return row?.id === 7;
  } catch {
    return false;
  }
}

function tryExpo(filePath: string): BoundDatabase | null {
  try {
    const sqlite = require('expo-sqlite') as {
      openDatabaseSync: (name: string) => BoundDatabase;
    };
    const opened = sqlite.openDatabaseSync(filePath);
    return probe(opened) ? opened : null;
  } catch {
    return null;
  }
}

function prepare(db: BoundDatabase): void {
  db.execSync(schemaSql);
  db.runSync("INSERT OR REPLACE INTO meta (key, value) VALUES ('storageVersion', ?)", String(storageVersion));
}

/** A fresh database file. Expo SQLite is used when this process can open one; otherwise node:sqlite. */
export function openClientDatabase(directory = mkdtempSync(join(tmpdir(), 'boop-client-'))): {
  db: BoundDatabase;
  databasePath: string;
} {
  const databasePath = join(directory, 'boop.db');
  const expo = tryExpo(databasePath);
  const db = expo ?? openNode(databasePath);
  prepare(db);
  return { db, databasePath };
}
