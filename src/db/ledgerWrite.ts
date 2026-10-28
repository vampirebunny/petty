import { activeCatalogVersion } from '../economy/catalogCache';
import { economyConfig } from '../economy/economyConfig';
import { appVersion } from '../economy/remoteDefs';
import { getDb } from './database';

export type LedgerLine = {
  asset: string;
  delta: number;
  unitPrice?: number | null;
  deal?: boolean;
  serial?: number | null;
  toyId?: string | null;
  furnitureId?: string | null;
  scene?: string | null;
};

function ledgerKind(source: string): string {
  if (source === 'purchase' || source === 'spend' || source === 'consume' || source === 'reversal') {
    return source;
  }
  return 'earn';
}

export function writeLedgerEntry(
  ownerId: string,
  id: string,
  source: string,
  key: string,
  sourceRef: string | null,
  lines: LedgerLine[],
  options?: { outbox?: boolean; kind?: string },
): void {
  const database = getDb();
  const kind = options?.kind ?? ledgerKind(source);
  const deviceTime = new Date().toISOString();
  const catalogVersion = activeCatalogVersion();
  database.runSync(
    `INSERT INTO transactions (
       id, owner_id, idempotency_key, source, kind, source_ref, device_time, app_version, config_version, catalog_version
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ownerId,
    key,
    source,
    kind,
    sourceRef,
    deviceTime,
    appVersion(),
    economyConfig.version,
    catalogVersion,
  );
  lines.forEach((line, index) => {
    database.runSync(
      `INSERT INTO transaction_lines (
         transaction_id, line_no, asset, delta, unit_price, deal, serial, toy_id, furniture_id, scene
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      index + 1,
      line.asset,
      line.delta,
      line.unitPrice ?? null,
      line.deal ? 1 : 0,
      line.serial ?? null,
      line.toyId ?? null,
      line.furnitureId ?? null,
      line.scene ?? null,
    );
  });
  if (options?.outbox === false) {
    return;
  }
  database.runSync(
    'INSERT OR REPLACE INTO ledger_outbox (idempotency_key, payload) VALUES (?, ?)',
    key,
    JSON.stringify({
      idempotency_key: key,
      kind,
      source,
      lines: lines.map((line) => ({
        asset: line.asset,
        qty: line.delta,
        unit_price: line.unitPrice ?? null,
        deal: Boolean(line.deal),
        serial: line.serial ?? null,
        toy_id: line.toyId ?? null,
        furniture_id: line.furnitureId ?? null,
        scene: line.scene ?? null,
      })),
      reverses_key: source === 'reversal' ? sourceRef : null,
      local_day: null,
      device_time: deviceTime,
    }),
  );
}
