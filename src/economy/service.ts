import { canRaiseMood } from '../sim/mood';
import { clampWeight } from '../sim/care';
import { clampMax, clampMin, startingToys } from '../sim/config';
import { isResting } from '../sim/training';
import type { PetState } from '../sim/types';
import { readLegacyCloset, writePetNow } from '../db/sqlitePetStorage';
import { getDb, transaction } from '../db/database';
import { currentOwner, ownerIsReady } from '../db/currentOwner';
import { catalog, catalogItem, starterOutfits, storeItems, type CatalogItem, type TreatEffects } from './catalog';
import { buySpot, furnitureDefinition, grantPieces, nextFurnitureId } from '../actor/furniture';
import { writeLedgerEntry, type LedgerLine } from '../db/ledgerWrite';
import { furnitureOf, markBedStorageTip, moveOwnedPiece, touchPlayerHome, trickPropsOf } from '../db/playerHome';
import { masteredTrickIds, speciesOf } from '../sim/tracks';
import { awardedBadgeIds, syncBadges } from '../sim/badges';
import { prepareTrickPurchase, trickMilestoneKey } from '../sim/tricks';
import { listedPrice, quoteCart } from './shopState';
import type { CartInput, PricedLine, SpeciesId } from './shop';
import { accrualNow } from '../db/accountMeta';
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
export type OpenRewards = { pet: PetState; bursts: Burst[]; login: LoginOffer; awardedBadges: string[] };

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
  const soft = database.getFirstSync<{ quantity: number }>(
    'SELECT quantity FROM inventory WHERE owner_id = ? AND item_id = ? AND quantity > 0',
    owner,
    'softchew',
  );
  if (soft) {
    const biscuits = database.getFirstSync<{ quantity: number }>(
      'SELECT quantity FROM inventory WHERE owner_id = ? AND item_id = ?',
      owner,
      'biscuit',
    );
    if (biscuits) {
      database.runSync(
        'UPDATE inventory SET quantity = ? WHERE owner_id = ? AND item_id = ?',
        biscuits.quantity + soft.quantity,
        owner,
        'biscuit',
      );
    } else {
      database.runSync(
        'INSERT INTO inventory (owner_id, item_id, quantity, first_acquired_at) VALUES (?, ?, ?, ?)',
        owner,
        'biscuit',
        soft.quantity,
        new Date(now).toISOString(),
      );
    }
    database.runSync('DELETE FROM inventory WHERE owner_id = ? AND item_id = ?', owner, 'softchew');
  }
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

function applyLedgerLine(owner: string, line: LedgerLine): void {
  if (line.delta === 0) {
    return;
  }
  if (line.asset === 'boops') {
    setBalance(balance() + line.delta);
  } else if (line.asset === 'toy' && line.toyId) {
    if (line.delta > 0) {
      db().runSync('INSERT OR IGNORE INTO owned_toys (owner_id, toy_id) VALUES (?, ?)', owner, line.toyId);
    }
  } else if (line.asset === 'trick_prop' && line.furnitureId && line.scene && line.toyId && line.delta > 0) {
    db().runSync(
      'INSERT OR IGNORE INTO owned_trick_props (owner_id, instance_id, prop_type, source_trick_id) VALUES (?, ?, ?, ?)',
      owner,
      line.furnitureId,
      line.scene,
      line.toyId,
    );
  } else if (line.asset === 'furniture' && line.furnitureId) {
    if (line.delta > 0) {
      const defined = furnitureDefinition(line.furnitureId);
      const piece = defined ?? { id: line.furnitureId, kind: 'bed' as const };
      db().runSync(
        'INSERT OR IGNORE INTO owned_furniture (owner_id, piece_id, json) VALUES (?, ?, ?)',
        owner,
        line.furnitureId,
        JSON.stringify(piece),
      );
    }
  } else {
    setQuantity(line.asset, quantity(line.asset) + line.delta);
  }
}

function insertTransaction(source: string, key: string, sourceRef: string | null, lines: LedgerLine[]): void {
  const owner = ownerId();
  writeLedgerEntry(owner, newRequestId(), source, key, sourceRef, lines);
  for (const line of lines) {
    applyLedgerLine(owner, line);
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

export function reloadWallet(): void {
  emit();
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
  const price = listedPrice(itemId);
  if (!item || !item.available || price == null || item.kind === 'toy') {
    return { ok: false, reason: 'not_available' };
  }
  if (qty < 1) {
    return { ok: false, reason: 'not_available' };
  }
  if (item.kind === 'outfit' && (quantity(itemId) > 0 || qty > 1)) {
    return { ok: false, reason: 'already_owned' };
  }
  if (balance() < price * qty) {
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
    const fillOnly = opts.context !== 'training' && item.effects?.fill != null;
    if (!effects && !fillOnly) {
      return { ok: false, reason: 'not_available' };
    }
    if (opts.context !== 'training' && item.effects?.fill === 'energy' && pet.needs.energy >= 95) {
      return { ok: false, reason: 'energy_full' };
    }
    if (opts.context !== 'training' && item.effects?.fill === 'mood' && pet.needs.happiness >= 95) {
      return { ok: false, reason: 'mood_full' };
    }
    if (effects && opts.context !== 'training' && item.effects?.fill == null && pet.needs.hunger <= 0) {
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
    if (!item.effects?.endRest) {
      return { ok: false, reason: 'not_available' };
    }
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

// What the break sheet can offer. The daily limit hides both use and the shop.
export function secondWindOffer(pet: PetState, trickId: string, owned: number, now = Date.now()): 'use' | 'shop' | 'wait' {
  const track = pet.training[trickId];
  if (!track || !isResting(track, now)) {
    return 'wait';
  }
  if (dailyCount(localDay(now), pet.id, 'second_wind') >= economyConfig.secondWind.dailyLimitPerPet) {
    return 'wait';
  }
  return owned > 0 ? 'use' : 'shop';
}

function commitPurchase(item: CatalogItem, qty: number, key: string): void {
  const price = listedPrice(item.id);
  if (price == null || item.kind === 'toy') {
    throw new Error('not_available');
  }
  insertTransaction('purchase', key, item.id, [
    { asset: 'boops', delta: -price * qty },
    { asset: item.id, delta: qty, unitPrice: price, deal: false },
  ]);
}

function commitUse(pet: PetState, item: CatalogItem, opts: UseOpts, key: string, now: number): PetState {
  insertTransaction('consume', key, opts.trickId ? `${pet.id}:${opts.trickId}:rest` : pet.id, [
    { asset: item.id, delta: -1 },
  ]);
  if (item.kind === 'treat') {
    const effects = opts.context === 'training' ? item.effects?.training : item.effects?.casual;
    let next = pet;
    if (effects) {
      const applied = applyTreatEffects(pet, effects, opts.context !== 'training' && item.effects?.fill == null);
      if (!applied.ok || !applied.pet) {
        throw new Error(applied.ok ? 'unknown' : applied.reason);
      }
      next = applied.pet;
    } else if (item.effects?.fill == null || opts.context === 'training') {
      throw new Error('not_available');
    } else {
      next = { ...pet, needs: { ...pet.needs } };
    }
    if (item.effects?.fill === 'energy') {
      next.needs.energy = 100;
    }
    if (item.effects?.fill === 'mood') {
      next.needs.happiness = 100;
    }
    return next;
  }
  if (item.kind === 'food') {
    return { ...pet, foodInBowl: true, bowlItemId: item.id };
  }
  if (item.kind === 'second_wind') {
    if (!item.effects?.endRest) {
      throw new Error('not_available');
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
  throw new Error('not_available');
}

export function purchaseCart(
  lines: CartInput[],
  requestId: string,
  species: SpeciesId,
  sceneId = 'livingroom',
): Check & { charge?: number; lines?: PricedLine[]; includesClothes?: boolean } {
  try {
    const result = transaction(() => {
      ensureOwnerRows();
      if (hasKey(requestId)) {
        return { ok: true as const };
      }
      const priced = quoteCart(lines, species, balance());
      if (!priced.ok) {
        return priced;
      }
      const ledger: LedgerLine[] = [
        { asset: 'boops', delta: -priced.charge },
      ];
      for (const line of priced.lines) {
        if (line.kind === 'bundle') {
          ledger.push({ asset: line.id, delta: 0, unitPrice: line.unitPrice, deal: false });
        }
      }
      for (const entry of priced.inventory) {
        const match = priced.lines.find((line) => line.kind === 'item' && line.id === entry.asset);
        ledger.push({
          asset: entry.asset,
          delta: entry.delta,
          unitPrice: match?.unitPrice ?? null,
          deal: match?.deal ?? false,
        });
      }
      for (const toyId of priced.toys) {
        ledger.push({ asset: 'toy', delta: 1, toyId });
      }
      const owner = ownerId();
      const ownedPieces = furnitureOf(owner);
      const granted: { sku: string; pieceId: string }[] = [];
      for (const kind of priced.furniture) {
        const pieceId = nextFurnitureId(kind, [...ownedPieces, ...granted.map((row) => ({ id: row.pieceId, kind: 'bed' as const }))]);
        granted.push({ sku: kind, pieceId });
        ledger.push({ asset: 'furniture', delta: 1, furnitureId: pieceId, scene: sceneId });
      }
      insertTransaction('purchase', requestId, 'cart', ledger);
      for (const row of granted) {
        const spot = buySpot(row.sku, sceneId);
        if (!spot) {
          if (row.sku.startsWith('bed_')) {
            markBedStorageTip();
          }
          continue;
        }
        moveOwnedPiece(owner, species, row.pieceId, spot.sceneId, spot.x, spot.y);
      }
      return {
        ok: true as const,
        charge: priced.charge,
        lines: priced.lines,
        includesClothes: priced.includesClothes,
      };
    });
    emit();
    if (result.ok) {
      touchPlayerHome();
      queuePlayer();
    }
    return result;
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'unknown' };
  }
}

export function purchaseLimited(itemId: string, price: number, serial: number, requestId: string): Check {
  try {
    const result = transaction(() => {
      ensureOwnerRows();
      if (hasKey(requestId) || quantity(itemId) > 0) {
        return { ok: true as const };
      }
      if (balance() < price) {
        return { ok: false as const, reason: 'insufficient_boops' };
      }
      insertTransaction('purchase', requestId, itemId, [
        { asset: 'boops', delta: -price, unitPrice: price, deal: false },
        { asset: itemId, delta: 1, unitPrice: price, deal: false, serial },
      ]);
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

export function reverseLimited(itemId: string, price: number, requestId: string): boolean {
  const key = `${requestId}:lost`;
  let reversed = false;
  try {
    transaction(() => {
      ensureOwnerRows();
      if (hasKey(key) || !hasKey(requestId)) {
        return;
      }
      insertTransaction('reversal', key, itemId, [
        { asset: 'boops', delta: price },
        { asset: itemId, delta: -1 },
      ]);
      reversed = true;
    });
  } catch {
    return false;
  }
  if (reversed) {
    emit();
    queuePlayer();
  }
  return reversed;
}

export function rememberLimitedConfirm(requestId: string, itemId: string, price: number, serial: number): void {
  db().runSync(
    'INSERT OR REPLACE INTO limited_confirms (request_id, item_id, price, serial) VALUES (?, ?, ?, ?)',
    requestId,
    itemId,
    price,
    serial,
  );
}

export function forgetLimitedConfirm(requestId: string): void {
  db().runSync('DELETE FROM limited_confirms WHERE request_id = ?', requestId);
}

export function pendingLimitedConfirms(): { requestId: string; itemId: string; price: number; serial: number }[] {
  return db()
    .getAllSync<{ request_id: string; item_id: string; price: number; serial: number }>(
      'SELECT request_id, item_id, price, serial FROM limited_confirms',
    )
    .map((row) => ({ requestId: row.request_id, itemId: row.item_id, price: row.price, serial: row.serial }));
}

export function limitedSerial(itemId: string): number | null {
  if (quantity(itemId) <= 0) {
    return null;
  }
  const row = db().getFirstSync<{ serial: number }>(
    `SELECT lines.serial AS serial
     FROM transaction_lines lines
     JOIN transactions tx ON tx.id = lines.transaction_id
     WHERE tx.owner_id = ? AND lines.asset = ? AND lines.serial IS NOT NULL
     ORDER BY tx.device_time DESC
     LIMIT 1`,
    ownerId(),
    itemId,
  );
  return row?.serial ?? null;
}

export function buyTrick(
  pet: PetState,
  trickId: string,
  requestId: string,
  now = Date.now(),
): Check & { pet?: PetState } {
  try {
    const result = transaction(() => {
      ensureOwnerRows(now);
      if (hasKey(requestId)) {
        return { ok: true as const, pet };
      }
      const ownedProps = trickPropsOf(ownerId()).map((prop) => prop.type);
      const quoted = prepareTrickPurchase(pet, speciesOf(pet.breedId), trickId, balance(), ownedProps);
      if (!quoted.ok) {
        return quoted;
      }
      const lines: LedgerLine[] = [{ asset: 'boops', delta: -quoted.price, unitPrice: quoted.price, deal: false }];
      if (quoted.prop) {
        lines.push({
          asset: 'trick_prop',
          delta: 1,
          furnitureId: quoted.prop.instanceId,
          scene: quoted.prop.type,
          toyId: quoted.prop.sourceTrickId,
        });
      }
      insertTransaction('purchase', requestId, trickId, lines);
      writePetNow(quoted.pet);
      return { ok: true as const, pet: quoted.pet };
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
    const lines: LedgerLine[] = [{ asset: 'boops', delta: economyConfig.starter.boops }];
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

/** Local test credit. Stays on this device and is not sent to the server ledger. */
export function grantDevBoops(amount = 10_000): void {
  if (amount <= 0 || !ownerIsReady()) {
    return;
  }
  transaction(() => {
    ensureOwnerRows();
    const owner = ownerId();
    writeLedgerEntry(owner, newRequestId(), 'dev_grant', `dev:${newRequestId()}`, null, [{ asset: 'boops', delta: amount }], {
      outbox: false,
    });
    setBalance(balance() + amount);
  });
  emit();
}

export function payoutTimeAccrual(mode: 'live' | 'return', wallNow?: number): number {
  const payable = accrualNow(wallNow);
  if (payable == null) {
    return 0;
  }
  let wrote = false;
  const amount = transaction(() => {
    ensureOwnerRows(payable);
    const owner = readOwner();
    const day = localDay(payable);
    const planned = planTimePayout(
      payable,
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

export function dropRejectedTimePayout(key: string): void {
  if (!ownerIsReady()) {
    return;
  }
  const owner = ownerId();
  let changed = false;
  transaction(() => {
    const row = db().getFirstSync<{ id: string; device_time: string }>(
      'SELECT id, device_time FROM transactions WHERE owner_id = ? AND idempotency_key = ? AND source = ?',
      owner,
      key,
      'time_payout',
    );
    if (row) {
      const sum = db().getFirstSync<{ total: number }>(
        "SELECT COALESCE(SUM(delta), 0) AS total FROM transaction_lines WHERE transaction_id = ? AND asset = 'boops'",
        row.id,
      );
      const amount = Number(sum?.total ?? 0);
      if (amount > 0) {
        db().runSync(
          'UPDATE balances SET boops = MAX(0, boops - ?), updated_at = ? WHERE owner_id = ?',
          amount,
          new Date().toISOString(),
          owner,
        );
        const paidAt = Date.parse(row.device_time);
        const day = localDay(Number.isFinite(paidAt) ? paidAt : Date.now());
        const count = dailyCount(day, '', 'time_boops');
        if (count > 0) {
          setDaily(day, '', 'time_boops', Math.max(0, count - amount));
        }
      }
      db().runSync('DELETE FROM transaction_lines WHERE transaction_id = ?', row.id);
      db().runSync('DELETE FROM transactions WHERE id = ?', row.id);
      changed = true;
    }
    const state = db().getFirstSync<{ owner_id: string }>('SELECT owner_id FROM owner_state WHERE owner_id = ?', owner);
    const payable = accrualNow();
    if (state && payable != null) {
      const ownerRow = readOwner();
      if (ownerRow.time_paid_through > payable) {
        ownerRow.time_paid_through = payable;
        ownerRow.last_trusted_time = Math.min(ownerRow.last_trusted_time, payable);
        writeOwner(ownerRow);
        changed = true;
      }
    }
  });
  if (changed) {
    emit();
  }
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

function payLevelsAndStages(pet: PetState): {
  pet: PetState;
  boops: number;
  label: string | null;
  payouts: { label: string; amount: number }[];
} {
  let boops = 0;
  const payouts: { label: string; amount: number }[] = [];
  const levels = levelsToPay(pet);
  for (const level of levels) {
    const paid = grantBoops('level_up', `level:${pet.id}:${level}`, pet.id, economyConfig.levelUp.boops);
    boops += paid;
    if (paid > 0) {
      payouts.push({ label: `Level ${level}!`, amount: paid });
    }
  }
  const stages = stagesToPay(pet);
  let rest = 0;
  for (const stage of stages) {
    rest += grantBoops('milestone', `stage:${pet.id}:${stage}`, pet.id, economyConfig.milestones.lifeStage);
  }
  const tricks = masteredTrickIds(pet);
  let trickLabel: string | null = null;
  for (const trickId of tricks) {
    const paid = grantBoops(
      'milestone',
      trickMilestoneKey(pet.id, trickId),
      pet.id,
      economyConfig.milestones.trickMastered,
    );
    rest += paid;
    if (paid > 0 && !trickLabel) {
      trickLabel = trickId;
    }
  }
  boops += rest;
  if (rest > 0) {
    payouts.push({ label: trickLabel ? `${trickLabel}!` : 'Boops', amount: rest });
  }
  const next = {
    ...pet,
    lastPaidLevel: levels.length > 0 ? levels[levels.length - 1] : (pet.lastPaidLevel ?? 1),
    lastPaidStage: stages.length > 0 ? stages[stages.length - 1] : (pet.lastPaidStage ?? 'puppy'),
  };
  const label = levels.length > 0 ? `Level ${levels[levels.length - 1]}!` : trickLabel ? `${trickLabel}!` : boops > 0 ? 'Boops' : null;
  return { pet: next, boops, label, payouts };
}

export function settleProgress(
  pet: PetState,
  now = Date.now(),
  extra?: { playdateId?: string; find?: PlayFindKind },
): { pet: PetState; boops: number; label: string | null; payouts: { label: string; amount: number }[] } {
  const result = transaction(() => {
    ensureOwnerRows(now);
    let boops = 0;
    let label: string | null = null;
    const progressed = payLevelsAndStages(pet);
    let next = progressed.pet;
    boops += progressed.boops;
    label = progressed.label;
    const payouts = [...progressed.payouts];
    if (extra?.playdateId) {
      const paid = grantBoops('playdate', `playdate:${extra.playdateId}`, extra.playdateId, economyConfig.playdate.boops);
      boops += paid;
      if (paid > 0) {
        payouts.push({ label: 'Boops', amount: paid });
        if (!label) {
          label = 'Boops';
        }
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
          payouts.push({ label: 'Boops', amount: paid });
          if (!label) {
            label = 'Boops';
          }
        }
      }
    }
    if (next !== pet) {
      writePetNow(next);
    }
    return { pet: next, boops, label, payouts };
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
      const lines: LedgerLine[] = [{ asset: 'boops', delta: economyConfig.starter.boops }];
      for (const [itemId, qty] of Object.entries(economyConfig.starter.items)) {
        lines.push({ asset: itemId, delta: qty });
      }
      for (const outfit of starterOutfits()) {
        lines.push({ asset: outfit.id, delta: 1 });
      }
      lines.push({ asset: 'toy', delta: 1, toyId: startingToys[0] });
      for (const place of grantPieces(speciesOf(pet.breedId), 'shared').placed) {
        lines.push({ asset: 'furniture', delta: 1, furnitureId: place.pieceId, scene: place.sceneId });
      }
      grantLines('starter_grant', 'starter', null, lines);
      const seeded = readOwner();
      const cursor = accrualNow() ?? now;
      seeded.time_paid_through = cursor;
      seeded.last_trusted_time = cursor;
      writeOwner(seeded);
    }
    importLegacyOutfits();
    const owner = readOwner();
    const payable = accrualNow() ?? owner.time_paid_through;
    const planned = planTimePayout(
      payable,
      {
        timePaidThrough: owner.time_paid_through,
        timeCappedDay: owner.time_capped_day,
        lastTrustedTime: owner.last_trusted_time,
      },
      dailyCount(localDay(payable), '', 'time_boops'),
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
    for (const payout of progressed.payouts) {
      bursts.push({ label: payout.label, amount: payout.amount, coinCount: 5 });
    }
    const synced = syncBadges(progressed.pet, now);
    const awardedBadges = awardedBadgeIds(progressed.pet, synced);
    owner.last_open_at = now;
    writeOwner(owner);
    writePetNow(synced);
    return {
      pet: synced,
      bursts,
      login: loginOffer(owner.login_last_claimed_day, owner.login_streak, localDay(now)),
      awardedBadges,
    };
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
