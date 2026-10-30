import { getSupabase } from '../compliance/supabase';
import { ownerIsReady, currentOwner } from '../db/currentOwner';
import { getDb, transaction } from '../db/database';
import { writeLedgerEntry, type LedgerLine } from '../db/ledgerWrite';
import { earn } from '../analytics/analytics';
import { newRequestId, reloadWallet } from './service';

const iapSources = ['iap_purchase', 'iap_refund', 'iap_refund_reversed', 'sandbox_wipe'] as const;

export type IapLedgerRow = {
  key: string;
  source: string;
  lines: LedgerLine[];
};

export type AppliedIapCredit = {
  key: string;
  source: string;
  amount: number;
};

type CreditListener = (credits: AppliedIapCredit[]) => void;

const listeners = new Set<CreditListener>();
let tail: Promise<string[]> = Promise.resolve([]);
let warnedPull = false;

/** Fires after a new pack credit or a restored refund is on this phone. */
export function onIapBoops(listener: CreditListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Pull this player's store credits and apply any this phone does not have yet.
 * Returns the idempotency keys applied on this call. Other earn and spend rows stay on reconcile.
 */
export function pullIapCredits(): Promise<string[]> {
  const run = tail.then(pullOnce, pullOnce);
  tail = run.then(
    () => [],
    () => [],
  );
  return run;
}

export function applyIapEntries(rows: IapLedgerRow[]): AppliedIapCredit[] {
  if (!ownerIsReady() || rows.length === 0) {
    return [];
  }
  const owner = currentOwner();
  const applied = transaction(() => {
    const credits: AppliedIapCredit[] = [];
    const database = getDb();
    for (const row of rows) {
      if (!iapSources.includes(row.source as (typeof iapSources)[number])) {
        continue;
      }
      const existing = database.getFirstSync<{ id: string }>(
        'SELECT id FROM transactions WHERE owner_id = ? AND idempotency_key = ?',
        owner,
        row.key,
      );
      if (existing) {
        continue;
      }
      const amount = row.lines.reduce((sum, line) => (line.asset === 'boops' ? sum + line.delta : sum), 0);
      writeLedgerEntry(owner, newRequestId(), row.source, row.key, refundTarget(row), row.lines, {
        outbox: false,
        kind: row.source === 'iap_purchase' || row.source === 'iap_refund_reversed' ? 'earn' : 'reversal',
      });
      addBoops(owner, amount);
      credits.push({ key: row.key, source: row.source, amount });
    }
    return credits;
  });
  if (applied.length > 0) {
    reloadWallet();
    const bursts = applied.filter(
      (credit) => (credit.source === 'iap_purchase' || credit.source === 'iap_refund_reversed') && credit.amount > 0,
    );
    for (const credit of bursts) {
      earn('iap', credit.amount);
    }
    if (bursts.length > 0) {
      for (const listener of listeners) {
        try {
          listener(bursts);
        } catch (error) {
          console.warn(`Boops purchase burst failed. ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }
  return applied;
}

/** Store purchase keys already on this phone. A buy waits until a new one appears. */
export function iapPurchaseKeys(): string[] {
  if (!ownerIsReady()) {
    return [];
  }
  return getDb()
    .getAllSync<{ idempotency_key: string }>(
      'SELECT idempotency_key FROM transactions WHERE owner_id = ? AND source = ?',
      currentOwner(),
      'iap_purchase',
    )
    .map((row) => row.idempotency_key);
}

async function pullOnce(): Promise<string[]> {
  if (!ownerIsReady()) {
    return [];
  }
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }
  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    return [];
  }
  const { data, error } = await supabase
    .from('ledger_entries')
    .select('idempotency_key, source, lines')
    .in('source', [...iapSources])
    .order('server_time', { ascending: true });
  if (error || !data) {
    if (error && !warnedPull) {
      warnedPull = true;
      console.warn(`Boops purchases could not be loaded. ${error.message}`);
    }
    return [];
  }
  const rows: IapLedgerRow[] = data.map((row) => ({
    key: row.idempotency_key,
    source: row.source,
    lines: boopLines(row.lines),
  }));
  return applyIapEntries(rows).map((credit) => credit.key);
}

function refundTarget(row: IapLedgerRow): string | null {
  if (row.source === 'iap_refund') {
    return row.key.endsWith(':refund') ? row.key.slice(0, -':refund'.length) : null;
  }
  if (row.source === 'iap_refund_reversed') {
    return row.key.endsWith(':refund_reversed') ? `${row.key.slice(0, -':refund_reversed'.length)}:refund` : null;
  }
  return null;
}

function addBoops(owner: string, delta: number): void {
  if (delta === 0) {
    return;
  }
  const database = getDb();
  const row = database.getFirstSync<{ boops: number }>('SELECT boops FROM balances WHERE owner_id = ?', owner);
  const next = (row?.boops ?? 0) + delta;
  database.runSync(
    `INSERT INTO balances (owner_id, boops, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(owner_id) DO UPDATE SET boops = excluded.boops, updated_at = excluded.updated_at`,
    owner,
    next,
    new Date().toISOString(),
  );
}

function boopLines(value: unknown): LedgerLine[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((line) => {
    if (!line || typeof line !== 'object' || typeof (line as { asset?: unknown }).asset !== 'string') {
      return [];
    }
    const row = line as { asset: string; qty?: number; delta?: number };
    const delta = typeof row.qty === 'number' ? row.qty : typeof row.delta === 'number' ? row.delta : 0;
    if (row.asset !== 'boops' || delta === 0) {
      return [];
    }
    return [{ asset: 'boops', delta }];
  });
}
