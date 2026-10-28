import { getSupabase } from '../compliance/supabase';
import { remoteVersion, saveLimitedStock, saveShopDownload } from './shopState';
import type { ItemTier, LimitedStock, PickSlot, RemoteShop, RemoteShopItem, ShopBundle, ShopCategory, ShopFlag, SpeciesId } from './shop';

const slots = new Set<PickSlot>(['clothes', 'toys', 'treats_or_boosts']);
const flags = new Set<ShopFlag>(['always', 'rotation', 'coming_soon', 'hidden', 'featured']);
const categories = new Set<ShopCategory>(['treats', 'clothes', 'toys', 'home', 'boosts']);
const tiers = new Set<ItemTier>(['standard', 'exclusive', 'limited']);

function asSpecies(value: unknown): SpeciesId[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const species = value.filter((entry): entry is SpeciesId => entry === 'dog' || entry === 'cat');
  return species.length > 0 ? species : null;
}

function asContents(value: unknown): { itemId: string; qty: number }[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const contents: { itemId: string; qty: number }[] = [];
  for (const part of value) {
    if (!part || typeof part !== 'object') {
      continue;
    }
    const row = part as { itemId?: unknown; qty?: unknown };
    if (typeof row.itemId !== 'string' || typeof row.qty !== 'number' || row.qty < 1) {
      continue;
    }
    contents.push({ itemId: row.itemId, qty: row.qty });
  }
  return contents;
}

function asItem(row: Record<string, unknown>): RemoteShopItem | null {
  const shop = row.shop;
  const category = row.category;
  if (typeof row.id !== 'string' || typeof row.name !== 'string' || !flags.has(shop as ShopFlag) || !categories.has(category as ShopCategory)) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    category: category as ShopCategory,
    price: typeof row.price === 'number' ? row.price : null,
    shop: shop as ShopFlag,
    tier: tiers.has(row.tier as ItemTier) ? (row.tier as ItemTier) : 'standard',
    species: asSpecies(row.species),
    isNewUntil: typeof row.is_new_until === 'string' ? row.is_new_until : null,
    description: typeof row.description === 'string' ? row.description : null,
    sort: typeof row.sort === 'number' ? row.sort : 0,
    active: row.active !== false,
    def: row.def,
    minAppVersion: typeof row.min_app_version === 'string' ? row.min_app_version : null,
    theme: typeof row.theme === 'string' && row.theme.length > 0 ? row.theme : null,
  };
}

function asBundle(row: Record<string, unknown>): ShopBundle | null {
  if (typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.price !== 'number') {
    return null;
  }
  if (row.active === false) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    contents: asContents(row.contents),
    description: typeof row.description === 'string' ? row.description : undefined,
    sort: typeof row.sort === 'number' ? row.sort : 0,
  };
}

function asStock(row: Record<string, unknown>): LimitedStock | null {
  if (typeof row.item_id !== 'string' || typeof row.cap !== 'number' || typeof row.units_left !== 'number') {
    return null;
  }
  return {
    itemId: row.item_id,
    cap: row.cap,
    unitsLeft: row.units_left,
    soldOutAt: typeof row.sold_out_at === 'string' ? row.sold_out_at : null,
  };
}

export async function refreshLimitedStock(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    return false;
  }
  const { data, error } = await supabase.from('limited_stock').select('item_id, cap, units_left, sold_out_at');
  if (error || !data) {
    return false;
  }
  saveLimitedStock(data.flatMap((row) => {
    const stock = asStock(row as Record<string, unknown>);
    return stock ? [stock] : [];
  }));
  return true;
}

// Downloads the shop catalog. The first download applies immediately. A later one waits for local midnight.
export async function refreshShopCatalog(now = Date.now()): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    return false;
  }
  await refreshLimitedStock();
  const { data: config, error } = await supabase
    .from('shop_config')
    .select('pick_slots, no_repeat_days, deal_pct, version')
    .eq('id', 1)
    .maybeSingle();
  if (error || !config) {
    return false;
  }
  const version = Number(config.version);
  if (!Number.isFinite(version) || remoteVersion() === version) {
    return remoteVersion() === version;
  }
  const [{ data: items, error: itemError }, { data: bundles, error: bundleError }] = await Promise.all([
    supabase.from('shop_items').select('*'),
    supabase.from('shop_bundles').select('*'),
  ]);
  if (itemError || bundleError || !items || !bundles) {
    return false;
  }
  const remote: RemoteShop = {
    version,
    pickSlots: Array.isArray(config.pick_slots)
      ? config.pick_slots.filter((slot: unknown): slot is PickSlot => slots.has(slot as PickSlot))
      : [],
    noRepeatDays: typeof config.no_repeat_days === 'number' ? config.no_repeat_days : 5,
    dealPct: typeof config.deal_pct === 'number' ? config.deal_pct : 20,
    items: items.flatMap((row) => {
      const item = asItem(row as Record<string, unknown>);
      return item ? [item] : [];
    }),
    bundles: bundles.flatMap((row) => {
      const bundle = asBundle(row as Record<string, unknown>);
      return bundle ? [bundle] : [];
    }),
  };
  saveShopDownload(remote, now);
  return true;
}
