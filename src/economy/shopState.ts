import { catalog, catalogItem } from './catalog';
import { promoteCatalog, readCatalogCache } from './catalogCache';
import { rememberActiveDefs, remoteItemDefs } from './remoteDefs';
import { localDay } from './clock';
import { stockedSkus } from '../actor/furniture';
import { furnitureOf } from '../db/playerHome';
import { currentOwner } from '../db/currentOwner';
import { getDb } from '../db/database';
import {
  chooseDay,
  collectionTheme,
  itemDefsFromCatalog,
  materializeShop,
  priceCart,
  sellsByCollection,
  shownDeal,
  withHomeShelf,
  withPriceAdjustments,
  withScratchPole,
  type LimitedStock,
  type CartInput,
  type DayPick,
  type PickHistory,
  type PickSlot,
  type RemoteShop,
  type ShopCatalog,
  type SpeciesId,
} from './shop';

export type ShopDay = { date: string; picks: DayPick[]; dealId: string | null };

type ParsedCatalog = { day: string; token: number; catalog: ShopCatalog | null };

let catalogToken = 0;
let catalogCache: ParsedCatalog | null = null;

export function invalidateShopCatalog(): void {
  catalogToken += 1;
}

// A catalog already parsed this session, or undefined when the shop still has to read SQLite.
export function peekShopCatalog(now = Date.now()): ShopCatalog | null | undefined {
  const today = localDay(now);
  if (!catalogCache || catalogCache.day !== today || catalogCache.token !== catalogToken) {
    return undefined;
  }
  return catalogCache.catalog;
}

function defs() {
  return [...itemDefsFromCatalog(catalog), ...remoteItemDefs()];
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
    rememberActiveDefs(remote);
    const catalog = materializeShop(remote, defs());
    return catalog ? withPriceAdjustments(withHomeShelf(withScratchPole(catalog))) : null;
  } catch {
    return null;
  }
}

// The loaded shop catalog. A pending download becomes active at local midnight.
// Nothing is bundled: before the first download this is null.
export function loadShopCatalog(now = Date.now()): ShopCatalog | null {
  const today = localDay(now);
  if (catalogCache && catalogCache.day === today && catalogCache.token === catalogToken) {
    return catalogCache.catalog;
  }
  const row = readCatalogCache();
  let catalog: ShopCatalog | null;
  if (row?.pending_json && row.pending_on && row.pending_on <= today) {
    promoteCatalog(row);
    catalog = parseRemote(row.pending_json);
  } else {
    catalog = parseRemote(row?.active_json ?? null);
  }
  catalogCache = { day: today, token: catalogToken, catalog };
  return catalog;
}

export function listedPrice(itemId: string, now = Date.now()): number | null {
  const catalogNow = loadShopCatalog(now);
  const item = catalogNow?.items.find((entry) => entry.id === itemId);
  if (!catalogNow || !item || item.price == null || item.shop === 'hidden' || item.shop === 'coming_soon' || item.shop === 'featured' || item.tier === 'limited') {
    return null;
  }
  if (sellsByCollection(item) && item.theme !== collectionTheme(catalogNow, now)) {
    return null;
  }
  return item.price;
}

export function applyCatalogNow(): boolean {
  const row = readCatalogCache();
  if (!row?.pending_json) {
    return false;
  }
  promoteCatalog(row);
  invalidateShopCatalog();
  return true;
}

export function loadLimitedStock(): LimitedStock[] {
  const rows = getDb().getAllSync<{ item_id: string; cap: number; units_left: number; sold_out_at: string | null }>(
    'SELECT item_id, cap, units_left, sold_out_at FROM limited_stock_cache ORDER BY item_id',
  );
  return rows.map((row) => ({
    itemId: row.item_id,
    cap: row.cap,
    unitsLeft: row.units_left,
    soldOutAt: row.sold_out_at,
  }));
}

export function saveLimitedStock(rows: LimitedStock[]): void {
  const database = getDb();
  database.runSync('DELETE FROM limited_stock_cache');
  for (const row of rows) {
    database.runSync(
      'INSERT INTO limited_stock_cache (item_id, cap, units_left, sold_out_at) VALUES (?, ?, ?, ?)',
      row.itemId,
      row.cap,
      row.unitsLeft,
      row.soldOutAt,
    );
  }
}

export function saveShopDownload(remote: RemoteShop, now = Date.now()): void {
  const today = localDay(now);
  const row = readCatalogCache();
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
    invalidateShopCatalog();
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
  invalidateShopCatalog();
}

export function remoteVersion(): number | null {
  const row = readCatalogCache();
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
  const furniture = database.getAllSync<{ piece_id: string }>('SELECT piece_id FROM owned_furniture WHERE owner_id = ?', owner);
  for (const piece of furniture) {
    owned.add(piece.piece_id);
  }
  for (const sku of stockedSkus(furnitureOf(owner))) {
    owned.add(sku);
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
  return priceCart(catalogNow, lines, shownDeal(day.dealId, day.picks, ownedIds()), ownedIds(), species, balance, now);
}
