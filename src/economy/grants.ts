import { earn } from '../analytics/analytics';
import type { EarnSource } from '../analytics/events';
import { currentOwner, ownerIsReady } from '../db/currentOwner';
import { getDb, transaction } from '../db/database';
import { writeLedgerEntry } from '../db/ledgerWrite';
import { activeClient } from '../sync/clientScope';
import { acceptedLocalDay } from './dayGate';
import { economyConfig } from './economyConfig';
import { noteBoopBurst } from './pendingBoops';

let notifyWallet = () => {};

export function setWalletNotifier(notify: () => void): void {
  notifyWallet = notify;
}

function ownerId(): string {
  return currentOwner();
}

function deviceOffset(now: number): number | null {
  const bound = activeClient()?.utcOffsetMinutes;
  if (bound != null) {
    return bound;
  }
  const offset = -new Date(now).getTimezoneOffset();
  return Number.isFinite(offset) ? offset : null;
}

function requestId(): string {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject && typeof cryptoObject.randomUUID === 'function') {
    return cryptoObject.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function ensureGrantOwner(now: number): void {
  const owner = ownerId();
  const database = getDb();
  const balanceRow = database.getFirstSync<{ owner_id: string }>('SELECT owner_id FROM balances WHERE owner_id = ?', owner);
  if (!balanceRow) {
    database.runSync(
      'INSERT INTO balances (owner_id, boops, updated_at) VALUES (?, 0, ?)',
      owner,
      new Date(now).toISOString(),
    );
  }
  const stateRow = database.getFirstSync<{ owner_id: string }>('SELECT owner_id FROM owner_state WHERE owner_id = ?', owner);
  if (!stateRow) {
    database.runSync(
      `INSERT INTO owner_state (
        owner_id, time_paid_through, time_capped_day, last_trusted_time, server_time_offset_ms,
        login_streak, login_last_claimed_day, last_open_at
      ) VALUES (?, ?, NULL, ?, 0, 0, NULL, 0)`,
      owner,
      now,
      now,
    );
  }
}

function readClock() {
  const row = getDb().getFirstSync<{
    last_trusted_time: number;
    login_last_claimed_day: string | null;
    utc_offset_minutes: number | null;
    day_accepted_at: number | null;
  }>('SELECT * FROM owner_state WHERE owner_id = ?', ownerId());
  if (!row) {
    throw new Error('missing owner_state');
  }
  return row;
}

function hasKey(key: string): boolean {
  return (
    getDb().getFirstSync<{ id: string }>(
      'SELECT id FROM transactions WHERE owner_id = ? AND idempotency_key = ?',
      ownerId(),
      key,
    ) != null
  );
}

function addBoops(amount: number): void {
  const owner = ownerId();
  const database = getDb();
  const current =
    database.getFirstSync<{ boops: number }>('SELECT boops FROM balances WHERE owner_id = ?', owner)?.boops ?? 0;
  const next = current + amount;
  const existing = database.getFirstSync<{ owner_id: string }>('SELECT owner_id FROM balances WHERE owner_id = ?', owner);
  if (!existing) {
    database.runSync(
      'INSERT INTO balances (owner_id, boops, updated_at) VALUES (?, ?, ?)',
      owner,
      next,
      new Date().toISOString(),
    );
    return;
  }
  database.runSync('UPDATE balances SET boops = ?, updated_at = ? WHERE owner_id = ?', next, new Date().toISOString(), owner);
}

function grantBoops(source: string, key: string, ref: string | null, amount: number, day: string | null): number {
  if (amount <= 0 || hasKey(key)) {
    return 0;
  }
  const owner = ownerId();
  writeLedgerEntry(owner, requestId(), source, key, ref, [{ asset: 'boops', delta: amount }], {
    localDay: day,
    utcOffsetMinutes: deviceOffset(Date.now()),
  });
  addBoops(amount);
  return amount;
}

function boopsFromSource(source: string, day: string): number {
  const row = getDb().getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(l.delta), 0) AS total
     FROM transactions t
     JOIN transaction_lines l ON l.transaction_id = t.id
     WHERE t.owner_id = ? AND t.source = ? AND t.local_day = ? AND l.asset = 'boops'`,
    ownerId(),
    source,
    day,
  );
  return Number(row?.total ?? 0);
}

export function grantCapped(
  source: string,
  key: string,
  ref: string | null,
  amount: number,
  day: string,
  cap: number,
  burst: boolean,
): number {
  const room = cap - boopsFromSource(source, day);
  const pay = Math.min(amount, Math.max(0, room));
  const paid = grantBoops(source, key, ref, pay, day);
  if (burst && paid > 0) {
    noteBoopBurst(paid);
  }
  return paid;
}

function grantOnAcceptedDay(now: number, source: EarnSource, pay: (day: string) => number): number {
  if (!ownerIsReady()) {
    return 0;
  }
  const paid = transaction(() => {
    ensureGrantOwner(now);
    const owner = readClock();
    const day = acceptedLocalDay(now, {
      lastTrustedTime: owner.last_trusted_time,
      loginLastClaimedDay: owner.login_last_claimed_day,
      utcOffset: owner.utc_offset_minutes,
      dayAcceptedAt: owner.day_accepted_at ?? 0,
    });
    if (!day) {
      return 0;
    }
    return pay(day);
  });
  if (paid > 0) {
    earn(source, paid);
    notifyWallet();
  }
  return paid;
}

export function grantActivityBoops(slotId: string, now = Date.now()): number {
  if (slotId.startsWith('tutorial:')) {
    return 0;
  }
  return grantOnAcceptedDay(now, 'activity', (day) =>
    grantCapped(
      'activity',
      `activity:${day}:${slotId}`,
      slotId,
      economyConfig.activities.boops,
      day,
      economyConfig.activities.dailyCap,
      true,
    ),
  );
}

export function grantCompetitionBoops(raceId: string, place: number, didFinish: boolean, now = Date.now()): number {
  if (!raceId) {
    return 0;
  }
  const award = didFinish && place >= 1 ? (place <= 3 ? economyConfig.competition.top3 : economyConfig.competition.finish) : 0;
  if (award <= 0) {
    return 0;
  }
  return grantOnAcceptedDay(now, 'competition', (day) =>
    grantCapped('competition', `competition:${raceId}`, raceId, award, day, economyConfig.competition.dailyCap, true),
  );
}

export function grantParkFindBoops(petId: string, itemId: string, foundAt: number, now = Date.now()): number {
  if (!petId || !itemId) {
    return 0;
  }
  return grantOnAcceptedDay(now, 'park_find', (day) =>
    grantCapped(
      'park_find',
      `park:${petId}:${itemId}:${foundAt}`,
      itemId,
      economyConfig.parkFind.boops,
      day,
      economyConfig.parkFind.dailyCap,
      true,
    ),
  );
}
