import { canRaiseMood } from '../sim/mood';
import { clampWeight } from '../sim/care';
import { clampMax, clampMin } from '../sim/config';
import { isResting } from '../sim/training';
import type { PetState } from '../sim/types';
import { readLegacyCloset, writePetNow } from '../db/sqlitePetStorage';
import { getDb, transaction } from '../db/database';
import { currentOwner, ownerIsReady } from '../db/currentOwner';
import { catalog, catalogItem, starterOutfits, storeItems, type CatalogItem, type TreatEffects } from './catalog';
import { queueCoupled, queuePlayer } from '../sync/queue';
import { economyConfig, type PlayFindKind } from './economyConfig';
import { localDay } from './clock';
import { planTimePayout } from './accrual';
import { loginOffer, type LoginOffer } from './login';
import { levelsToPay, stagesToPay } from './levels';

export type Check = { ok: true } | { ok: false; reason: string };
export type UseOpts = { context?: 'casual' | 'training'; trickId?: string };
export type InventoryRow = { itemId: string; qty: number };
export type WalletSnapshot = { balance: number; inventory: InventoryRow[] };
export type Burst = {
  label: string;
  amount: number;
  coinCount: 1 | 5;
  origin?: { x: number; y: number };
  id?: number;
};
export type OpenRewards = { pet: PetState; bursts: Burst[]; login: LoginOffer };

const listeners = new Set<(snapshot: WalletSnapshot) => void>();

export function newRequestId(): string {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject && typeof cryptoObject.randomUUID === 'function') {
    return cryptoObject.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function db() {
  return getDb();
}

function ownerId(): string {
  return currentOwner();
}

function ensureOwnerRows(now = Date.now()): void {
  if (!ownerIsReady()) {
    throw new Error('owner not ready');
  }
  const owner = ownerId();
  const database = db();
  const balanceRow = database.getFirstSync<{ owner_id: string }>(
    'SELECT owner_id FROM balances WHERE owner_id = ?',
    owner,
  );
  if (!balanceRow) {
    database.runSync(
      'INSERT INTO balances (owner_id, boops, updated_at) VALUES (?, 0, ?)',
      owner,
      new Date(now).toISOString(),
    );
  }
  const stateRow = database.getFirstSync<{ owner_id: string }>(
    'SELECT owner_id FROM owner_state WHERE owner_id = ?',
    owner,
  );
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

function balance(): number {
  return db().getFirstSync<{ boops: number }>('SELECT boops FROM balances WHERE owner_id = ?', ownerId())?.boops ?? 0;
}

function setBalance(next: number): void {
  if (next < 0) {
    throw new Error('insufficient_boops');
  }
  const owner = ownerId();
  const database = db();
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

function quantity(itemId: string): number {
  return (
    db().getFirstSync<{ quantity: number }>(
      'SELECT quantity FROM inventory WHERE owner_id = ? AND item_id = ?',
      ownerId(),
      itemId,
    )?.quantity ?? 0
  );
}

function setQuantity(itemId: string, next: number): void {
  if (next < 0) {
    throw new Error('insufficient_items');
  }
  const owner = ownerId();
  if (next === 0) {
    db().runSync('DELETE FROM inventory WHERE owner_id = ? AND item_id = ?', owner, itemId);
    return;
  }
  const existing = quantity(itemId);
  if (existing === 0) {
    db().runSync(
      'INSERT INTO inventory (owner_id, item_id, quantity, first_acquired_at) VALUES (?, ?, ?, ?)',
      owner,
      itemId,
      next,
      new Date().toISOString(),
    );
    return;
  }
  db().runSync('UPDATE inventory SET quantity = ? WHERE owner_id = ? AND item_id = ?', next, owner, itemId);
}

function hasKey(key: string): boolean {
  return (
    db().getFirstSync<{ id: string }>(
      'SELECT id FROM transactions WHERE owner_id = ? AND idempotency_key = ?',
      ownerId(),
      key,
    ) != null
  );
}

function dailyCount(day: string, petId: string, key: string): number {
  return (
    db().getFirstSync<{ count: number }>(
      'SELECT count FROM daily_counters WHERE day = ? AND pet_id = ? AND key = ?',
      day,
      petId,
      key,
    )?.count ?? 0
  );
}

function setDaily(day: string, petId: string, key: string, count: number): void {
  db().runSync(
    `INSERT INTO daily_counters (day, pet_id, key, count) VALUES (?, ?, ?, ?)
     ON CONFLICT(day, pet_id, key) DO UPDATE SET count = excluded.count`,
    day,
    petId,
    key,
    count,
  );
}

function readOwner() {
  const row = db().getFirstSync<{
    time_paid_through: number;
    time_capped_day: string | null;
    last_trusted_time: number;
    server_time_offset_ms: number;
    login_streak: number;
    login_last_claimed_day: string | null;
    last_open_at: number;
  }>('SELECT * FROM owner_state WHERE owner_id = ?', ownerId());
  if (!row) {
    throw new Error('missing owner_state');
  }
  return row;
}

function writeOwner(row: ReturnType<typeof readOwner>): void {
  db().runSync(
    `UPDATE owner_state SET
      time_paid_through = ?, time_capped_day = ?, last_trusted_time = ?, server_time_offset_ms = ?,
      login_streak = ?, login_last_claimed_day = ?, last_open_at = ?
     WHERE owner_id = ?`,
    row.time_paid_through,
    row.time_capped_day,
    row.last_trusted_time,
    row.server_time_offset_ms,
    row.login_streak,
    row.login_last_claimed_day,
    row.last_open_at,
    ownerId(),
  );
}

function insertTransaction(source: string, key: string, sourceRef: string | null, lines: { asset: string; delta: number }[]): void {
  const id = newRequestId();
  const owner = ownerId();
  db().runSync(
    `INSERT INTO transactions (id, owner_id, idempotency_key, source, source_ref, device_time, config_version)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    owner,
    key,
    source,
    sourceRef,
    new Date().toISOString(),
    economyConfig.version,
  );
  for (const line of lines) {
    db().runSync(
      'INSERT INTO transaction_lines (transaction_id, asset, delta) VALUES (?, ?, ?)',
      id,
      line.asset,
      line.delta,
    );
    if (line.asset === 'boops') {
      setBalance(balance() + line.delta);
    } else {
      setQuantity(line.asset, quantity(line.asset) + line.delta);
    }
  }
}

function snapshot(): WalletSnapshot {
  const inventory = db().getAllSync<{ item_id: string; quantity: number }>(
    'SELECT item_id, quantity FROM inventory WHERE owner_id = ? AND quantity > 0',
    ownerId(),
  );
  return {
    balance: balance(),
    inventory: inventory.map((row) => ({ itemId: row.item_id, qty: row.quantity })),
  };
}

function emit(): void {
  const next = snapshot();
  for (const listener of listeners) {
    listener(next);
  }
}

export function subscribe(listener: (snapshot: WalletSnapshot) => void): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => listeners.delete(listener);
}

export function getBalance(): number {
  return balance();
}

export function getInventory(): InventoryRow[] {
  return snapshot().inventory;
}

export function getQuantity(itemId: string): number {
  return quantity(itemId);
}

export function getCatalog(): CatalogItem[] {
  return storeItems();
}

function clampNeed(value: number): number {
  return Math.min(clampMax, Math.max(clampMin, value));
}

function applyTreatEffects(pet: PetState, effects: TreatEffects, gateHunger: boolean): Check & { pet?: PetState } {
  if (gateHunger && pet.needs.hunger <= 0) {
    return { ok: false, reason: 'full' };
  }
  const next: PetState = { ...pet, needs: { ...pet.needs } };
  next.needs.hunger = clampNeed(next.needs.hunger + effects.hunger);
  next.weight = clampWeight(next.weight + effects.weight);
  if (effects.mood < 0 || canRaiseMood(next.needs)) {
    next.needs.happiness = clampNeed(next.needs.happiness + effects.mood);
  }
  return { ok: true, pet: next };
}

export function canAfford(itemId: string, qty = 1): Check {
  const item = catalogItem(itemId);
  if (!item || !item.available || item.price == null) {
    return { ok: false, reason: 'not_available' };
  }
  if (qty < 1) {
    return { ok: false, reason: 'not_available' };
  }
  if (item.kind === 'outfit' && (quantity(itemId) > 0 || qty > 1)) {
    return { ok: false, reason: 'already_owned' };
  }
  if (balance() < item.price * qty) {
    return { ok: false, reason: 'insufficient_boops' };
  }
  return { ok: true };
}

export function canUse(pet: PetState, itemId: string, opts: UseOpts = {}, now = Date.now()): Check {
  const item = catalogItem(itemId);
  if (!item) {
    return { ok: false, reason: 'unknown' };
  }
  if (quantity(itemId) <= 0) {
    return { ok: false, reason: 'insufficient_items' };
  }
  if (item.kind === 'treat') {
    const effects = opts.context === 'training' ? item.effects?.training : item.effects?.casual;
    if (!effects) {
      return { ok: false, reason: 'not_available' };
    }
    if (opts.context !== 'training' && pet.needs.hunger <= 0) {
      return { ok: false, reason: 'full' };
    }
    return { ok: true };
  }
  if (item.kind === 'food') {
    if (pet.needs.hunger <= 0) {
      return { ok: false, reason: 'full' };
    }
    if (pet.foodInBowl) {
      return { ok: false, reason: 'bowl_full' };
    }
    return { ok: true };
  }
  if (item.kind === 'second_wind') {
    const trickId = opts.trickId;
    const track = trickId ? pet.training[trickId] : undefined;
    if (!trickId || !track || !isResting(track, now)) {
      return { ok: false, reason: 'not_resting' };
    }
    if (dailyCount(localDay(now), pet.id, 'second_wind') >= economyConfig.secondWind.dailyLimitPerPet) {
      return { ok: false, reason: 'daily_limit' };
    }
    return { ok: true };
  }
  return { ok: false, reason: 'not_available' };
}

function commitPurchase(item: CatalogItem, qty: number, key: string): void {
  const price = item.price ?? 0;
  insertTransaction('purchase', key, item.id, [
    { asset: 'boops', delta: -price * qty },
    { asset: item.id, delta: qty },
  ]);
}

function commitUse(pet: PetState, item: CatalogItem, opts: UseOpts, key: string, now: number): PetState {
  insertTransaction('consume', key, opts.trickId ? `${pet.id}:${opts.trickId}:rest` : pet.id, [
    { asset: item.id, delta: -1 },
  ]);
  if (item.kind === 'treat') {
    const effects = (opts.context === 'training' ? item.effects?.training : item.effects?.casual) as TreatEffects;
    const applied = applyTreatEffects(pet, effects, opts.context !== 'training');
    if (!applied.ok || !applied.pet) {
      throw new Error(applied.ok ? 'unknown' : applied.reason);
    }
    return applied.pet;
  }
  if (item.kind === 'food') {
    return { ...pet, foodInBowl: true, bowlItemId: item.id };
  }
  const trickId = opts.trickId as string;
  const day = localDay(now);
  setDaily(day, pet.id, 'second_wind', dailyCount(day, pet.id, 'second_wind') + 1);
  const track = pet.training[trickId];
  return {
    ...pet,
    training: {
      ...pet.training,
      [trickId]: { ...track, restUntil: null, focusUsed: 0, hadNoTreat: false },
    },
  };
}

export function purchase(itemId: string, qty: number, requestId: string): Check {
  try {
    const result = transaction(() => {
      ensureOwnerRows();
      if (hasKey(requestId)) {
        return { ok: true as const };
      }
      const check = canAfford(itemId, qty);
      if (!check.ok) {
        return check;
      }
      commitPurchase(catalogItem(itemId) as CatalogItem, qty, requestId);
      return { ok: true as const };
    });
    emit();
    if (result.ok) {
      queuePlayer();
    }
    return result;
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown' };
  }
}

export function useItem(pet: PetState, itemId: string, opts: UseOpts, requestId: string, now = Date.now()): Check & { pet?: PetState } {
  try {
    const result = transaction(() => {
      ensureOwnerRows(now);
      if (hasKey(requestId)) {
        return { ok: true as const, pet };
      }
      const check = canUse(pet, itemId, opts, now);
      if (!check.ok) {
        return check;
      }
      const next = commitUse(pet, catalogItem(itemId) as CatalogItem, opts, requestId, now);
      writePetNow(next);
      return { ok: true as const, pet: next };
    });
    emit();
    if (result.ok && result.pet) {
      queueCoupled(result.pet);
    }
    return result;
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown' };
  }
}

export function buyAndUse(pet: PetState, itemId: string, opts: UseOpts, requestId: string, now = Date.now()): Check & { pet?: PetState } {
  try {
    const result = transaction(() => {
      ensureOwnerRows(now);
      if (hasKey(`${requestId}:use`)) {
        return { ok: true as const, pet };
      }
      let current = pet;
      if (quantity(itemId) < 1) {
        if (hasKey(requestId)) {
          return { ok: false as const, reason: 'unknown' };
        }
        const check = canAfford(itemId, 1);
        if (!check.ok) {
          return check;
        }
        commitPurchase(catalogItem(itemId) as CatalogItem, 1, requestId);
      }
      const check = canUse(current, itemId, opts, now);
      if (!check.ok) {
        throw new Error(check.reason);
      }
      current = commitUse(current, catalogItem(itemId) as CatalogItem, opts, `${requestId}:use`, now);
      writePetNow(current);
      return { ok: true as const, pet: current };
    });
    emit();
    if (result.ok && result.pet) {
      queueCoupled(result.pet);
    }
    return result;
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown' };
  }
}

function grantLines(source: string, key: string, ref: string | null, lines: { asset: string; delta: number }[]): boolean {
  if (hasKey(key) || lines.every((line) => line.delta === 0)) {
    return false;
  }
  insertTransaction(source, key, ref, lines);
  return true;
}

export function ensureStarter(now = Date.now()): void {
  transaction(() => {
    ensureOwnerRows(now);
    if (hasKey('starter')) {
      return;
    }
    const lines: { asset: string; delta: number }[] = [{ asset: 'boops', delta: economyConfig.starter.boops }];
    for (const [itemId, qty] of Object.entries(economyConfig.starter.items)) {
      lines.push({ asset: itemId, delta: qty });
    }
    for (const outfit of starterOutfits()) {
      lines.push({ asset: outfit.id, delta: 1 });
    }
    grantLines('starter_grant', 'starter', null, lines);
    const owner = readOwner();
    owner.time_paid_through = now;
    owner.last_trusted_time = now;
    writeOwner(owner);
  });
  emit();
  queuePlayer();
}

function grantBoops(source: string, key: string, ref: string | null, amount: number): number {
  if (amount <= 0 || hasKey(key)) {
    return 0;
  }
  insertTransaction(source, key, ref, [{ asset: 'boops', delta: amount }]);
  return amount;
}

export function payoutTimeAccrual(mode: 'live' | 'return', now = Date.now()): number {
  let wrote = false;
  const amount = transaction(() => {
    ensureOwnerRows(now);
    const owner = readOwner();
    const day = localDay(now);
    const planned = planTimePayout(
      now,
      {
        timePaidThrough: owner.time_paid_through,
        timeCappedDay: owner.time_capped_day,
        lastTrustedTime: owner.last_trusted_time,
      },
      dailyCount(day, '', 'time_boops'),
      mode,
    );
    if (!planned.save) {
      return 0;
    }
    wrote = true;
    owner.time_paid_through = planned.owner.timePaidThrough;
    owner.time_capped_day = planned.owner.timeCappedDay;
    owner.last_trusted_time = planned.owner.lastTrustedTime;
    writeOwner(owner);
    if (planned.amount > 0) {
      const paid = grantBoops('time_payout', `time:${planned.owner.timePaidThrough}`, null, planned.amount);
      if (paid > 0) {
        setDaily(planned.day, '', 'time_boops', dailyCount(planned.day, '', 'time_boops') + paid);
      }
      return paid;
    }
    return 0;
  });
  emit();
  if (wrote) {
    queuePlayer();
  }
  return amount;
}

export function getDailyLogin(now = Date.now()): LoginOffer {
  ensureOwnerRows(now);
  const owner = readOwner();
  return loginOffer(owner.login_last_claimed_day, owner.login_streak, localDay(now));
}

export function claimDailyLogin(now = Date.now()): Check & { amount?: number; streakDay?: number } {
  try {
    const result = transaction(() => {
      ensureOwnerRows(now);
      const owner = readOwner();
      const today = localDay(now);
      const offer = loginOffer(owner.login_last_claimed_day, owner.login_streak, today);
      if (!offer.claimable) {
        return { ok: false as const, reason: 'already_claimed' };
      }
      const key = `login:${today}`;
      const amount = grantBoops('daily_login', key, today, offer.reward);
      owner.login_streak = offer.streakDay;
      owner.login_last_claimed_day = today;
      writeOwner(owner);
      return { ok: true as const, amount, streakDay: offer.streakDay };
    });
    emit();
    if (result.ok) {
      queuePlayer();
    }
    return result;
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown' };
  }
}

function payLevelsAndStages(pet: PetState): { pet: PetState; boops: number; label: string | null } {
  let boops = 0;
  const levels = levelsToPay(pet);
  for (const level of levels) {
    boops += grantBoops('level_up', `level:${pet.id}:${level}`, pet.id, economyConfig.levelUp.boops);
  }
  const stages = stagesToPay(pet);
  for (const stage of stages) {
    boops += grantBoops('milestone', `stage:${pet.id}:${stage}`, pet.id, economyConfig.milestones.lifeStage);
  }
  const tricks = ['sit', 'speak', 'paw'].filter((id) => pet.milestones.includes(id));
  let trickLabel: string | null = null;
  for (const trickId of tricks) {
    const paid = grantBoops(
      'milestone',
      `milestone:trick:${trickId}:${pet.id}`,
      pet.id,
      economyConfig.milestones.trickMastered,
    );
    boops += paid;
    if (paid > 0 && !trickLabel) {
      trickLabel = trickId;
    }
  }
  const next = {
    ...pet,
    lastPaidLevel: levels.length > 0 ? levels[levels.length - 1] : (pet.lastPaidLevel ?? 1),
    lastPaidStage: stages.length > 0 ? stages[stages.length - 1] : (pet.lastPaidStage ?? 'puppy'),
  };
  const label = levels.length > 0 ? `Level ${levels[levels.length - 1]}!` : trickLabel ? `${trickLabel}!` : boops > 0 ? 'Boops' : null;
  return { pet: next, boops, label };
}

export function settleProgress(
  pet: PetState,
  now = Date.now(),
  extra?: { playdateId?: string; find?: PlayFindKind },
): { pet: PetState; boops: number; label: string | null } {
  const result = transaction(() => {
    ensureOwnerRows(now);
    let boops = 0;
    let label: string | null = null;
    const progressed = payLevelsAndStages(pet);
    let next = progressed.pet;
    boops += progressed.boops;
    label = progressed.label;
    if (extra?.playdateId) {
      const paid = grantBoops('playdate', `playdate:${extra.playdateId}`, extra.playdateId, economyConfig.playdate.boops);
      boops += paid;
      if (paid > 0 && !label) {
        label = 'Boops';
      }
    }
    if (extra?.find) {
      const day = localDay(now);
      const room = economyConfig.playFinds.dailyCap - dailyCount(day, '', 'play_finds');
      const chance = economyConfig.playFinds.chanceByAction[extra.find];
      if (room > 0 && Math.random() < chance) {
        const span = economyConfig.playFinds.maxBoops - economyConfig.playFinds.minBoops + 1;
        const rolled = economyConfig.playFinds.minBoops + Math.floor(Math.random() * span);
        const amount = Math.min(room, rolled);
        const paid = grantBoops('play_find', `find:${newRequestId()}`, extra.find, amount);
        if (paid > 0) {
          setDaily(day, '', 'play_finds', dailyCount(day, '', 'play_finds') + paid);
          boops += paid;
          if (!label) {
            label = 'Boops';
          }
        }
      }
    }
    if (next !== pet) {
      writePetNow(next);
    }
    return { pet: next, boops, label };
  });
  if (result.boops > 0) {
    emit();
  }
  queueCoupled(result.pet);
  return result;
}

export function onAppOpen(pet: PetState, now = Date.now()): OpenRewards {
  const rewards = transaction(() => {
    ensureOwnerRows(now);
    if (!hasKey('starter')) {
      const lines: { asset: string; delta: number }[] = [{ asset: 'boops', delta: economyConfig.starter.boops }];
      for (const [itemId, qty] of Object.entries(economyConfig.starter.items)) {
        lines.push({ asset: itemId, delta: qty });
      }
      for (const outfit of starterOutfits()) {
        lines.push({ asset: outfit.id, delta: 1 });
      }
      grantLines('starter_grant', 'starter', null, lines);
      const seeded = readOwner();
      seeded.time_paid_through = now;
      seeded.last_trusted_time = now;
      writeOwner(seeded);
    }
    importLegacyOutfits();
    const owner = readOwner();
    const planned = planTimePayout(
      now,
      {
        timePaidThrough: owner.time_paid_through,
        timeCappedDay: owner.time_capped_day,
        lastTrustedTime: owner.last_trusted_time,
      },
      dailyCount(localDay(now), '', 'time_boops'),
      'return',
    );
    const bursts: Burst[] = [];
    if (planned.save) {
      owner.time_paid_through = planned.owner.timePaidThrough;
      owner.time_capped_day = planned.owner.timeCappedDay;
      owner.last_trusted_time = planned.owner.lastTrustedTime;
      if (planned.amount > 0) {
        const paid = grantBoops('time_payout', `time:${planned.owner.timePaidThrough}`, null, planned.amount);
        if (paid > 0) {
          setDaily(planned.day, '', 'time_boops', dailyCount(planned.day, '', 'time_boops') + paid);
          bursts.push({ label: 'Boops', amount: paid, coinCount: 5 });
        }
      }
    }
    const away = owner.last_open_at > 0 ? now - owner.last_open_at : 0;
    if (away >= economyConfig.welcomeBack.minDaysAway * 86_400_000) {
      const welcomeKey = `welcome:${localDay(now)}`;
      const paid = grantBoops('welcome_back', welcomeKey, null, economyConfig.welcomeBack.boops);
      if (paid > 0) {
        bursts.push({ label: 'Welcome back!', amount: paid, coinCount: 5 });
      }
    }
    const progressed = payLevelsAndStages(pet);
    if (progressed.boops > 0 && progressed.label) {
      bursts.push({ label: progressed.label, amount: progressed.boops, coinCount: 5 });
    }
    owner.last_open_at = now;
    writeOwner(owner);
    writePetNow(progressed.pet);
    return { pet: progressed.pet, bursts, login: loginOffer(owner.login_last_claimed_day, owner.login_streak, localDay(now)) };
  });
  emit();
  queueCoupled(rewards.pet);
  return rewards;
}

function importLegacyOutfits(): void {
  if (hasKey('closet_import')) {
    return;
  }
  const raw = readLegacyCloset();
  const lines: { asset: string; delta: number }[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { owned?: { slot?: string; id?: string }[] };
      for (const item of parsed.owned ?? []) {
        if (!item.slot || !item.id) {
          continue;
        }
        const itemId = `${item.slot}:${item.id}`;
        if (catalogItem(itemId) && quantity(itemId) <= 0) {
          lines.push({ asset: itemId, delta: 1 });
        }
      }
    } catch {
      // A broken closet snapshot is skipped. The marker still records that the copy ran.
    }
  }
  insertTransaction('starter_grant', 'closet_import', null, lines);
}

export function outfitsOwned(): { slot: NonNullable<CatalogItem['slot']>; id: string }[] {
  const owned: { slot: NonNullable<CatalogItem['slot']>; id: string }[] = [];
  for (const row of getInventory()) {
    const item = catalogItem(row.itemId);
    if (item?.kind === 'outfit' && item.slot && item.wearId && row.qty > 0) {
      owned.push({ slot: item.slot, id: item.wearId });
    }
  }
  return owned;
}

export { catalog };
