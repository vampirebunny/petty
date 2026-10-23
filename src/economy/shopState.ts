import { catalog, catalogItem } from './catalog';
import { localDay } from './clock';
import { currentOwner } from '../db/currentOwner';
import { getDb } from '../db/database';
import {
  chooseDay,
  itemDefsFromCatalog,
  materializeShop,
  priceCart,
  shownDeal,
  type CartInput,
  type DayPick,
  type PickHistory,
  type PickSlot,
  type RemoteShop,
  type ShopCatalog,
  type SpeciesId,
} from './shop';

type CacheRow = {
  active_json: string | null;
  active_version: number | null;
  pending_json: string | null;
  pending_version: number | null;
  pending_on: string | null;
};

export type ShopDay = { date: string; picks: DayPick[]; dealId: string | null };

function defs() {
  return itemDefsFromCatalog(catalog);
}

function parseRemote(json: string | null): ShopCatalog | null {
  if (!json) {
    return null;
  }
  try {
    const remote = JSON.parse(json) as RemoteShop;
    if (!remote || !Array.isArray(remote.items)) {
      return null;
    }
    return materializeShop(remote, defs());
  } catch {
    return null;
  }
}

function readCache(): CacheRow | null {
  return getDb().getFirstSync<CacheRow>('SELECT * FROM shop_catalog_cache WHERE id = 1');
}

function promote(row: CacheRow): void {
  getDb().runSync(
    `INSERT INTO shop_catalog_cache (id, active_json, active_version, pending_json, pending_version, pending_on)
     VALUES (1, ?, ?, NULL, NULL, NULL)
     ON CONFLICT(id) DO UPDATE SET
       active_json = excluded.active_json,
       active_version = excluded.active_version,
       pending_json = NULL,
       pending_version = NULL,
       pending_on = NULL`,
    row.pending_json,
    row.pending_version,
  );
}

// The loaded shop catalog. A pending download becomes active at local midnight.
// Nothing is bundled: before the first download this is null.
export function loadShopCatalog(now = Date.now()): ShopCatalog | null {
  const today = localDay(now);
  const row = readCache();
  if (row?.pending_json && row.pending_on && row.pending_on <= today) {
    promote(row);
    return parseRemote(row.pending_json);
  }
  return parseRemote(row?.active_json ?? null);
}

export function listedPrice(itemId: string, now = Date.now()): number | null {
  const item = loadShopCatalog(now)?.items.find((entry) => entry.id === itemId);
  if (!item || item.price == null || item.shop === 'hidden' || item.shop === 'coming_soon') {
    return null;
  }
  return item.price;
}

export function saveShopDownload(remote: RemoteShop, now = Date.now()): void {
  const today = localDay(now);
  const row = readCache();
  const json = JSON.stringify(remote);
  const database = getDb();
  if (!row?.active_json) {
    database.runSync(
      `INSERT INTO shop_catalog_cache (id, active_json, active_version, pending_json, pending_version, pending_on)
       VALUES (1, ?, ?, NULL, NULL, NULL)
       ON CONFLICT(id) DO UPDATE SET
         active_json = excluded.active_json,
         active_version = excluded.active_version,
         pending_json = NULL,
         pending_version = NULL,
         pending_on = NULL`,
      json,
      remote.version,
    );
    return;
  }
  if (row.active_version === remote.version || row.pending_version === remote.version) {
    return;
  }
  const [year, month, date] = today.split('-').map((part) => Number(part));
  const tomorrow = localDay(new Date(year, month - 1, date + 1, 12).getTime());
  database.runSync(
    `UPDATE shop_catalog_cache SET pending_json = ?, pending_version = ?, pending_on = ? WHERE id = 1`,
    json,
    remote.version,
    tomorrow,
  );
}

export function remoteVersion(): number | null {
  const row = readCache();
  return row?.pending_version ?? row?.active_version ?? null;
}

function shiftDay(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map((part) => Number(part));
  return localDay(new Date(year, month - 1, date + delta, 12).getTime());
}

function ownedIds(): Set<string> {
  const owner = currentOwner();
  const database = getDb();
  const owned = new Set<string>();
  const rows = database.getAllSync<{ item_id: string; quantity: number }>(
    'SELECT item_id, quantity FROM inventory WHERE owner_id = ? AND quantity > 0',
    owner,
  );
  for (const row of rows) {
    const item = catalogItem(row.item_id);
    if (item?.kind === 'outfit' || item?.kind === 'toy') {
      owned.add(row.item_id);
    }
  }
  const toys = database.getAllSync<{ toy_id: string }>('SELECT toy_id FROM owned_toys WHERE owner_id = ?', owner);
  for (const toy of toys) {
    owned.add(toy.toy_id);
  }
  return owned;
}

function readHistory(owner: string): PickHistory[] {
  const rows = getDb().getAllSync<{ date: string; slot: string; item_id: string }>(
    'SELECT date, slot, item_id FROM shop_pick_history WHERE owner_id = ?',
    owner,
  );
  return rows
    .filter((row) => row.slot === 'clothes' || row.slot === 'toys' || row.slot === 'treats_or_boosts')
    .map((row) => ({ date: row.date, slot: row.slot as PickSlot, itemId: row.item_id }));
}

function parseDay(date: string, picksJson: string, dealId: string | null): ShopDay | null {
  try {
    const picks = JSON.parse(picksJson) as DayPick[];
    if (!Array.isArray(picks)) {
      return null;
    }
    return { date, picks, dealId };
  } catch {
    return null;
  }
}

export function ensureShopDay(species: SpeciesId, now = Date.now()): ShopDay | null {
  const catalogNow = loadShopCatalog(now);
  if (!catalogNow) {
    return null;
  }
  const owner = currentOwner();
  const today = localDay(now);
  const database = getDb();
  const row = database.getFirstSync<{ date: string; picks: string; deal_id: string | null }>(
    'SELECT date, picks, deal_id FROM shop_day WHERE owner_id = ?',
    owner,
  );
  if (row?.date === today) {
    return parseDay(today, row.picks, row.deal_id) ?? { date: today, picks: [], dealId: null };
  }
  const day = chooseDay(catalogNow, species, ownedIds(), today, readHistory(owner));
  database.runSync(
    `INSERT INTO shop_day (owner_id, date, picks, deal_id) VALUES (?, ?, ?, ?)
     ON CONFLICT(owner_id) DO UPDATE SET date = excluded.date, picks = excluded.picks, deal_id = excluded.deal_id`,
    owner,
    today,
    JSON.stringify(day.picks),
    day.dealId,
  );
  for (const pick of day.picks) {
    database.runSync(
      `INSERT INTO shop_pick_history (owner_id, date, slot, item_id) VALUES (?, ?, ?, ?)
       ON CONFLICT(owner_id, date, slot) DO UPDATE SET item_id = excluded.item_id`,
      owner,
      today,
      pick.slot,
      pick.itemId,
    );
  }
  const cutoff = shiftDay(today, -(catalogNow.noRepeatDays + 1));
  database.runSync('DELETE FROM shop_pick_history WHERE owner_id = ? AND date < ?', owner, cutoff);
  return { date: today, picks: day.picks, dealId: day.dealId };
}

export function quoteCart(lines: CartInput[], species: SpeciesId, balance: number, now = Date.now()) {
  const day = ensureShopDay(species, now);
  const catalogNow = loadShopCatalog(now);
  if (!day || !catalogNow) {
    return { ok: false as const, reason: 'not_available' };
  }
  return priceCart(catalogNow, lines, shownDeal(day.dealId, day.picks, ownedIds()), ownedIds(), species, balance);
}
