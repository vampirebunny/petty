import { mulberry, seedOf } from '../actor/mulberry';
import type { ItemKind } from './catalog';
import { explainRemoteRow, remoteItemDef, versionAllows, type RemoteDefRow } from './remoteDefs';
import { calendarDaysBetween } from './clock';
import type { OutfitSlot } from '../sim/types';

export type ShopFlag = 'always' | 'rotation' | 'coming_soon' | 'hidden' | 'featured';
export type ShopCategory = 'treats' | 'clothes' | 'toys' | 'home' | 'boosts';
export type ItemTier = 'standard' | 'exclusive' | 'limited';
export type SpeciesId = 'dog' | 'cat';
export type PickSlot = 'clothes' | 'toys' | 'treats_or_boosts';

export type ShopItemConfig = {
  shop: ShopFlag;
  category?: ShopCategory;
  tier?: ItemTier;
  species?: SpeciesId[];
  price?: number | null;
  name?: string;
  isNewUntil?: string;
  description?: string;
  sort: number;
};

export type ShopBundleConfig = {
  id: string;
  name: string;
  price: number;
  contents: { itemId: string; qty: number }[];
  description?: string;
  sort: number;
};

export type ShopListing = {
  id: string;
  name: string;
  category: ShopCategory;
  shop: ShopFlag;
  tier: ItemTier;
  species?: SpeciesId[];
  price: number | null;
  description?: string;
  sort: number;
  stackable: boolean;
  slot?: OutfitSlot;
  wearId?: string;
  isNewUntil?: string;
  restMultiplier?: number;
  // Colorway theme slug. A themed item is only sold on its collection's day.
  theme?: string;
};

export type ShopBundle = ShopBundleConfig;

export type ShopCatalog = {
  version: number;
  items: ShopListing[];
  bundles: ShopBundle[];
  pickSlots: PickSlot[];
  noRepeatDays: number;
  dealPct: number;
};

export type ItemDef = {
  id: string;
  name: string;
  kind: ItemKind;
  slot?: OutfitSlot;
  wearId?: string;
  species?: SpeciesId[];
};

export type DayPick = { slot: PickSlot; itemId: string; shop: ShopFlag };

export type PickHistory = { date: string; slot: PickSlot; itemId: string };

export type CartInput = { id: string; kind: 'item' | 'bundle'; qty: number };

export type PricedLine = {
  id: string;
  kind: 'item' | 'bundle';
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  deal: boolean;
  place: 'Pantry' | 'Closet' | 'Toy Box' | 'Home' | 'Storage';
};

export type PricedCart =
  | {
      ok: true;
      charge: number;
      lines: PricedLine[];
      inventory: { asset: string; delta: number }[];
      toys: string[];
      furniture: string[];
      includesClothes: boolean;
    }
  | { ok: false; reason: string };

export type CatalogCache = {
  active: ShopCatalog | null;
  pending: ShopCatalog | null;
  pendingOn: string | null;
};

const slotCategories: Record<PickSlot, ShopCategory[]> = {
  clothes: ['clothes'],
  toys: ['toys'],
  treats_or_boosts: ['treats', 'boosts'],
};

const pickSlots: PickSlot[] = ['clothes', 'toys', 'treats_or_boosts'];

function categoryOf(kind: ItemKind): ShopCategory {
  if (kind === 'treat' || kind === 'food') {
    return 'treats';
  }
  if (kind === 'outfit') {
    return 'clothes';
  }
  if (kind === 'toy') {
    return 'toys';
  }
  if (kind === 'furniture') {
    return 'home';
  }
  return 'boosts';
}

function stackableKind(kind: ItemKind): boolean {
  return kind === 'treat' || kind === 'food' || kind === 'second_wind';
}

export function fitsSpecies(species: SpeciesId[] | undefined, pet: SpeciesId): boolean {
  return species == null || species.length === 0 || species.includes(pet);
}

export function discounted(price: number, dealPct: number): number {
  return Math.round((price * (100 - dealPct)) / 100);
}

export function isNewItem(item: ShopListing, date: string): boolean {
  return item.isNewUntil != null && date <= item.isNewUntil;
}

function roll(ids: string[], seedText: string): string {
  const sorted = [...ids].sort();
  const rng = mulberry(seedOf(seedText));
  return sorted[Math.floor(rng() * sorted.length)] ?? sorted[0];
}

function recentIds(history: PickHistory[], slot: PickSlot, date: string, days: number): Set<string> {
  const ids = new Set<string>();
  for (const row of history) {
    if (row.slot !== slot) {
      continue;
    }
    const gap = calendarDaysBetween(row.date, date);
    if (gap >= 1 && gap <= days) {
      ids.add(row.itemId);
    }
  }
  return ids;
}

export function chooseDay(
  catalog: ShopCatalog,
  species: SpeciesId,
  owned: ReadonlySet<string>,
  date: string,
  history: PickHistory[],
): { picks: DayPick[]; dealId: string | null } {
  const picks: DayPick[] = [];
  const taken = new Set<string>();
  for (const slot of catalog.pickSlots) {
    const categories = slotCategories[slot];
    const eligible = catalog.items.filter(
      (item) =>
        categories.includes(item.category) &&
        !sellsByCollection(item) &&
        item.tier !== 'limited' &&
        item.shop !== 'featured' &&
        (item.shop === 'rotation' || (item.shop === 'always' && item.tier !== 'exclusive')) &&
        fitsSpecies(item.species, species) &&
        (item.stackable || !owned.has(item.id)) &&
        !taken.has(item.id),
    );
    if (eligible.length === 0) {
      continue;
    }
    const recent = recentIds(history, slot, date, catalog.noRepeatDays);
    const fresh = eligible.filter((item) => !recent.has(item.id));
    const pool = fresh.length > 0 ? fresh : eligible;
    const rotation = pool.filter((item) => item.shop === 'rotation');
    const choice = rotation.length > 0 ? rotation : pool.filter((item) => item.shop === 'always');
    if (choice.length === 0) {
      continue;
    }
    const itemId = roll(
      choice.map((item) => item.id),
      `${date}${slot}`,
    );
    const item = choice.find((entry) => entry.id === itemId);
    if (!item) {
      continue;
    }
    taken.add(item.id);
    picks.push({ slot, itemId: item.id, shop: item.shop });
  }
  return { picks, dealId: dealFor(picks) };
}

export function dealFor(picks: DayPick[]): string | null {
  const clothes = picks.find((pick) => pick.slot === 'clothes');
  const toys = picks.find((pick) => pick.slot === 'toys');
  if (clothes?.shop === 'rotation') {
    return clothes.itemId;
  }
  if (toys?.shop === 'rotation') {
    return toys.itemId;
  }
  if (clothes) {
    return clothes.itemId;
  }
  if (toys) {
    return toys.itemId;
  }
  return null;
}

export function shownPicks(picks: DayPick[], owned: ReadonlySet<string>): DayPick[] {
  return picks.filter((pick) => !owned.has(pick.itemId));
}

export function shownDeal(dealId: string | null, picks: DayPick[], owned: ReadonlySet<string>): string | null {
  if (!dealId || owned.has(dealId) || !picks.some((pick) => pick.itemId === dealId)) {
    return null;
  }
  return dealId;
}

export function tabItems(catalog: ShopCatalog, category: ShopCategory, species: SpeciesId): ShopListing[] {
  return catalog.items
    .filter(
      (item) =>
        item.category === category &&
        !sellsByCollection(item) &&
        ((item.shop === 'always' && item.tier !== 'exclusive') || item.shop === 'coming_soon') &&
        fitsSpecies(item.species, species),
    )
    .sort((a, b) => {
      const soon = Number(a.shop === 'coming_soon') - Number(b.shop === 'coming_soon');
      if (soon !== 0) {
        return soon;
      }
      if (category === 'home') {
        const price = (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY);
        if (price !== 0) {
          return price;
        }
      }
      return a.sort - b.sort || a.id.localeCompare(b.id);
    });
}

export function featuredBundle(catalog: ShopCatalog, date: string): ShopBundle | null {
  const bundles = [...catalog.bundles].sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
  if (bundles.length === 0) {
    return null;
  }
  const index = calendarDaysBetween('2026-01-01', date);
  const mod = ((index % bundles.length) + bundles.length) % bundles.length;
  return bundles[mod] ?? null;
}

export function sellsByCollection(item: ShopListing): item is ShopListing & { theme: string } {
  return (
    item.theme != null &&
    item.category === 'clothes' &&
    item.shop === 'always' &&
    item.tier === 'standard' &&
    item.price != null
  );
}

export type ShopCollection = { theme: string; name: string; items: ShopListing[]; endsAt: number };

export const collectionWindowMs = 3 * 60 * 60 * 1000;
const windowsPerDay = 24 / 3;

export function collectionEndsAt(now: number): number {
  return (Math.floor(now / collectionWindowMs) + 1) * collectionWindowMs;
}

// Windows are cut from the epoch, so they ignore the local clock. The extra step each day
// keeps a theme from landing on the same hours every day when there are 8 themes.
export function collectionTheme(catalog: ShopCatalog, now: number): string | null {
  const themes = [...new Set(catalog.items.filter(sellsByCollection).map((item) => item.theme))].sort();
  if (themes.length === 0) {
    return null;
  }
  const window = Math.floor(now / collectionWindowMs);
  const index = window + Math.floor(window / windowsPerDay);
  return themes[index % themes.length] ?? null;
}

export function themeName(theme: string): string {
  return theme
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function collectionAt(catalog: ShopCatalog, now: number, species: SpeciesId): ShopCollection | null {
  const theme = collectionTheme(catalog, now);
  if (!theme) {
    return null;
  }
  const items = catalog.items
    .filter((item) => sellsByCollection(item) && item.theme === theme && fitsSpecies(item.species, species))
    .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
  return items.length > 0 ? { theme, name: themeName(theme), items, endsAt: collectionEndsAt(now) } : null;
}

export function contentsValue(bundle: ShopBundle, items: ShopListing[]): number {
  let total = 0;
  for (const part of bundle.contents) {
    const item = items.find((entry) => entry.id === part.itemId);
    total += (item?.price ?? 0) * part.qty;
  }
  return total;
}

export function savePercent(price: number, was: number): number {
  if (was <= 0) {
    return 0;
  }
  return Math.round(((was - price) / was) * 100);
}

export function countdownLabel(ms: number, lead = 'New stock in'): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${lead} ${hours}h ${minutes}m ${seconds}s`;
}

function placeFor(item: ShopListing): PricedLine['place'] {
  if (item.category === 'clothes') {
    return 'Closet';
  }
  if (item.category === 'toys') {
    return 'Toy Box';
  }
  if (item.id.startsWith('bed_')) {
    return 'Storage';
  }
  if (item.category === 'home') {
    return 'Home';
  }
  return 'Pantry';
}

export type LimitedStock = {
  itemId: string;
  cap: number;
  unitsLeft: number;
  soldOutAt: string | null;
};

const soldOutWindowMs = 24 * 60 * 60 * 1000;

// The crown stays in the featured spot while it is on sale, and for 24 hours after it sells out.
export function featuredLimited(stock: readonly LimitedStock[], now: number): LimitedStock | null {
  for (const row of stock) {
    if (row.soldOutAt == null) {
      return row;
    }
    const soldAt = Date.parse(row.soldOutAt);
    if (Number.isFinite(soldAt) && now < soldAt + soldOutWindowMs) {
      return row;
    }
  }
  return null;
}

export function limitedBuyLabel(row: LimitedStock | null, online: boolean): 'buy' | 'offline' | 'held' | 'sold_out' {
  if (!online) {
    return 'offline';
  }
  if (!row || row.soldOutAt != null) {
    return 'sold_out';
  }
  if (row.unitsLeft <= 0) {
    return 'held';
  }
  return 'buy';
}

function listing(catalog: ShopCatalog, id: string): ShopListing | null {
  return catalog.items.find((item) => item.id === id) ?? null;
}

function payable(price: number): boolean {
  return Number.isInteger(price) && price >= 0;
}

export function priceCart(
  catalog: ShopCatalog,
  lines: CartInput[],
  dealId: string | null,
  owned: ReadonlySet<string>,
  species: SpeciesId,
  balance: number,
  now: number | null = null,
): PricedCart {
  if (lines.length === 0) {
    return { ok: false, reason: 'not_available' };
  }
  const liveTheme = now == null ? null : collectionTheme(catalog, now);
  const merged = new Map<string, CartInput>();
  for (const line of lines) {
    if (line.qty < 1) {
      return { ok: false, reason: 'not_available' };
    }
    const key = `${line.kind}:${line.id}`;
    const prev = merged.get(key);
    merged.set(key, { ...line, qty: (prev?.qty ?? 0) + line.qty });
  }
  const priced: PricedLine[] = [];
  const inventory = new Map<string, number>();
  const toys = new Map<string, number>();
  const furniture = new Set<string>();
  let charge = 0;
  let includesClothes = false;

  const grant = (item: ShopListing, qty: number): string | null => {
    if (item.stackable) {
      inventory.set(item.id, (inventory.get(item.id) ?? 0) + qty);
      return null;
    }
    if (qty !== 1 || owned.has(item.id)) {
      return 'already_owned';
    }
    if (item.category === 'toys') {
      toys.set(item.id, (toys.get(item.id) ?? 0) + qty);
    } else if (item.category === 'home') {
      furniture.add(item.id);
    } else {
      inventory.set(item.id, (inventory.get(item.id) ?? 0) + qty);
    }
    if ((toys.get(item.id) ?? 0) > 1 || (inventory.get(item.id) ?? 0) > 1) {
      return 'already_owned';
    }
    return null;
  };

  for (const line of merged.values()) {
    if (line.kind === 'bundle') {
      const bundle = catalog.bundles.find((entry) => entry.id === line.id);
      if (!bundle || bundle.contents.length === 0 || !payable(bundle.price)) {
        return { ok: false, reason: 'not_available' };
      }
      for (const part of bundle.contents) {
        const item = listing(catalog, part.itemId);
        if (!item || item.shop === 'hidden' || item.shop === 'coming_soon' || !fitsSpecies(item.species, species)) {
          return { ok: false, reason: 'not_available' };
        }
        const reason = grant(item, part.qty * line.qty);
        if (reason) {
          return { ok: false, reason };
        }
        if (item.category === 'clothes') {
          includesClothes = true;
        }
      }
      const lineTotal = bundle.price * line.qty;
      charge += lineTotal;
      priced.push({
        id: bundle.id,
        kind: 'bundle',
        name: bundle.name,
        qty: line.qty,
        unitPrice: bundle.price,
        lineTotal,
        deal: false,
        place: 'Pantry',
      });
      continue;
    }
    const item = listing(catalog, line.id);
    if (
      !item ||
      item.shop === 'hidden' ||
      item.shop === 'coming_soon' ||
      item.shop === 'featured' ||
      item.tier === 'limited' ||
      (sellsByCollection(item) && item.theme !== liveTheme) ||
      item.price == null ||
      !payable(item.price) ||
      !fitsSpecies(item.species, species)
    ) {
      return { ok: false, reason: 'not_available' };
    }
    if (!item.stackable && line.qty !== 1) {
      return { ok: false, reason: 'already_owned' };
    }
    const reason = grant(item, line.qty);
    if (reason) {
      return { ok: false, reason };
    }
    const deal = item.id === dealId && !item.stackable;
    const unitPrice = deal ? discounted(item.price, catalog.dealPct) : item.price;
    const lineTotal = unitPrice * line.qty;
    charge += lineTotal;
    if (item.category === 'clothes') {
      includesClothes = true;
    }
    priced.push({
      id: item.id,
      kind: 'item',
      name: item.name,
      qty: line.qty,
      unitPrice,
      lineTotal,
      deal,
      place: placeFor(item),
    });
  }
  for (const qty of inventory.values()) {
    if (qty > 1) {
      const id = [...inventory.entries()].find((entry) => entry[1] === qty)?.[0];
      const item = id ? listing(catalog, id) : null;
      if (item && !item.stackable) {
        return { ok: false, reason: 'already_owned' };
      }
    }
  }
  if (charge > balance) {
    return { ok: false, reason: 'insufficient_boops' };
  }
  return {
    ok: true,
    charge,
    lines: priced,
    inventory: [...inventory.entries()].map(([asset, delta]) => ({ asset, delta })),
    toys: [...toys.keys()],
    furniture: [...furniture],
    includesClothes,
  };
}

export function catalogForDay(cache: CatalogCache, today: string): { cache: CatalogCache; catalog: ShopCatalog | null } {
  if (cache.pending && cache.pendingOn && cache.pendingOn <= today) {
    const next = { active: cache.pending, pending: null, pendingOn: null };
    return { cache: next, catalog: next.active };
  }
  return { cache, catalog: cache.active };
}

export type RemoteShopItem = {
  id: string;
  name: string;
  category: ShopCategory;
  price: number | null;
  shop: ShopFlag;
  tier?: ItemTier;
  species: SpeciesId[] | null;
  isNewUntil: string | null;
  description: string | null;
  sort: number;
  active: boolean;
  def?: unknown;
  minAppVersion?: string | null;
  theme?: string | null;
};

export type RemoteShop = {
  version: number;
  pickSlots: PickSlot[];
  noRepeatDays: number;
  dealPct: number;
  items: RemoteShopItem[];
  bundles: ShopBundle[];
};

// A download cached before the theme column was read has no theme. Generated colorway ids end in ".<theme>".
function themeFromId(id: string): string | undefined {
  const dot = id.lastIndexOf('.');
  return id.includes(':') && dot > id.indexOf(':') ? id.slice(dot + 1) || undefined : undefined;
}

export function materializeShop(remote: RemoteShop, defs: ItemDef[]): ShopCatalog {
  const byId = new Map(defs.map((def) => [def.id, def]));
  const items: ShopListing[] = [];
  for (const row of remote.items) {
    if (!row.active || row.shop === 'hidden') {
      continue;
    }
    const bundled = byId.get(row.id);
    const remoteRow: RemoteDefRow = {
      id: row.id,
      name: row.name,
      species: row.species,
      def: row.def,
      minAppVersion: row.minAppVersion,
    };
    if (!versionAllows(row.minAppVersion)) {
      continue;
    }
    const extra = remoteItemDef(remoteRow);
    if (!bundled && explainRemoteRow(remoteRow) === 'omit') {
      continue;
    }
    const def = bundled ?? extra;
    if (!def && row.shop !== 'coming_soon') {
      continue;
    }
    if (!def) {
      items.push({
        id: row.id,
        name: row.name,
        category: row.category,
        shop: 'coming_soon',
        tier: row.tier ?? 'standard',
        species: row.species ?? undefined,
        price: null,
        description: row.description ?? undefined,
        sort: row.sort,
        stackable: false,
        isNewUntil: row.isNewUntil ?? undefined,
      });
      continue;
    }
    items.push({
      id: row.id,
      name: row.name || def.name,
      category: row.category || categoryOf(def.kind),
      shop: row.shop,
      tier: row.tier ?? 'standard',
      species: (row.species && row.species.length > 0 ? row.species : def.species),
      price: row.shop === 'coming_soon' ? null : row.price,
      description: row.description ?? undefined,
      sort: row.sort,
      stackable: stackableKind(def.kind),
      slot: def.slot,
      wearId: def.wearId,
      isNewUntil: row.isNewUntil ?? undefined,
      theme: row.theme ?? themeFromId(row.id),
    });
  }
  const slots = remote.pickSlots.filter((slot) => pickSlots.includes(slot));
  return {
    version: remote.version,
    items,
    bundles: remote.bundles.filter((bundle) => bundle.price >= 0),
    pickSlots: slots.length > 0 ? slots : pickSlots,
    noRepeatDays: remote.noRepeatDays,
    dealPct: remote.dealPct,
  };
}

export function shopFromConfig(
  items: Record<string, ShopItemConfig>,
  bundles: ShopBundleConfig[],
  settings: { pickSlots: PickSlot[]; noRepeatDays: number; dealPct: number },
  defs: ItemDef[],
  version = 0,
): ShopCatalog {
  const remoteItems: RemoteShopItem[] = Object.entries(items).map(([id, item]) => {
    const def = defs.find((entry) => entry.id === id);
    return {
      id,
      name: item.name ?? def?.name ?? id,
      category: item.category ?? (def ? categoryOf(def.kind) : 'boosts'),
      price: item.price ?? null,
      shop: item.shop,
      tier: item.tier,
      species: item.species ?? null,
      isNewUntil: item.isNewUntil ?? null,
      description: item.description ?? null,
      sort: item.sort,
      active: true,
    };
  });
  return materializeShop(
    {
      version,
      pickSlots: settings.pickSlots,
      noRepeatDays: settings.noRepeatDays,
      dealPct: settings.dealPct,
      items: remoteItems,
      bundles,
    },
    defs,
  );
}

const scratchPole: ShopListing = {
  id: 'scratcher',
  name: 'Scratch Pole',
  category: 'home',
  shop: 'always',
  tier: 'standard',
  species: ['cat'],
  price: 5000,
  sort: 2,
  stackable: false,
};

// A downloaded catalog from before this item existed still shows it on the Furniture shelf.
const furnitureShelfPrices: Record<string, number> = {
  scratcher: 5000,
  catTree: 10000,
  dogHouse: 9000,
};

// October 2026 list. Pins a downloaded catalog that still has the previous prices.
const priceAdjustments: Record<string, number> = {
  'glasses:classic': 900,
  'glasses:square': 900,
  'glasses:heart': 1200,
  'glasses:heart-sky': 1200,
  'hat:beanie-pink': 1100,
  'hat:beanie-stripe': 1200,
  'hat:cap': 1200,
  'hat:cap-sky': 1200,
  'hat:bucket': 1300,
  'hat:party': 1400,
  'hat:beret': 1500,
  'hat:bucket-daisy': 1600,
  'hat:top': 1800,
  'boots:rain': 2000,
  'boots:sneaker': 2000,
  'boots:rain-blue': 2000,
  'boots:sneaker-pink': 2100,
  'jacket:sweater': 3000,
  'jacket:vest': 3000,
  'jacket:puffer-mint': 3000,
  'jacket:sweater-lilac': 3000,
  'jacket:hoodie': 3200,
  'jacket:rain': 3500,
  'glasses:star': 900,
  'hat:top-velvet': 4500,
  'boots:sneaker-gold': 2000,
  'jacket:puffer-rainbow': 6000,
  'hat:crown': 20000,
  squeaky: 900,
  bone: 1000,
  rope: 1200,
  frisbee: 1500,
  crinkle: 800,
  yarn: 900,
  mouse: 900,
  wand: 1700,
  laser: 2500,
  bowl_food: 700,
  bowl_water: 700,
  bed_standard: 3000,
  scratcher: 5000,
  bed_cloud_puff: 5500,
  bed_kitty_cave: 5500,
  bed_bone_sofa: 8000,
  bed_moon_cradle: 8000,
  dogHouse: 9000,
  catTree: 10000,
  special: 200,
  treat_jerky: 250,
  treat_tuna: 250,
  food_gourmet: 300,
  food_steak: 300,
  food_fish: 300,
  second_wind: 500,
};

const homeShelf: ShopListing[] = [
  { id: 'bowl_food', name: 'Extra food bowl', category: 'home', shop: 'always', tier: 'standard', price: 700, sort: 10, stackable: false },
  { id: 'bowl_water', name: 'Extra water bowl', category: 'home', shop: 'always', tier: 'standard', price: 700, sort: 11, stackable: false },
  {
    id: 'dogHouse',
    name: 'Pup Cabana',
    category: 'home',
    shop: 'always',
    tier: 'standard',
    species: ['dog'],
    price: 9000,
    sort: 22,
    stackable: false,
    restMultiplier: 2,
    description: '2× faster rest',
  },
  { id: 'bed_standard', name: 'Standard Bed', category: 'home', shop: 'always', tier: 'standard', price: 3000, sort: 20, stackable: false, restMultiplier: 1 },
  {
    id: 'bed_cloud_puff',
    name: 'Marshmallow Mat',
    category: 'home',
    shop: 'always',
    tier: 'standard',
    species: ['dog'],
    price: 5500,
    sort: 21,
    stackable: false,
    restMultiplier: 2,
    description: '2× faster rest',
  },
  {
    id: 'bed_bone_sofa',
    name: 'Peach Chaise',
    category: 'home',
    shop: 'always',
    tier: 'standard',
    species: ['dog'],
    price: 8000,
    sort: 22,
    stackable: false,
    restMultiplier: 2.5,
    description: '2.5× faster rest',
  },
  {
    id: 'bed_kitty_cave',
    name: 'Cushion Stack',
    category: 'home',
    shop: 'always',
    tier: 'standard',
    species: ['cat'],
    price: 5500,
    sort: 23,
    stackable: false,
    restMultiplier: 2,
    description: '2× faster rest',
  },
  {
    id: 'bed_moon_cradle',
    name: 'Sultan Pillow',
    category: 'home',
    shop: 'always',
    tier: 'standard',
    species: ['cat'],
    price: 8000,
    sort: 24,
    stackable: false,
    restMultiplier: 2.5,
    description: '2.5× faster rest',
  },
];

// Beds and bowls stay on the shelf even when a downloaded catalog predates them.
export function withHomeShelf(catalog: ShopCatalog): ShopCatalog {
  const present = new Set(catalog.items.map((item) => item.id));
  const extra = homeShelf.filter((item) => !present.has(item.id));
  const items = catalog.items.map((item) => {
    const shelf = homeShelf.find((row) => row.id === item.id);
    if (!shelf) {
      return item;
    }
    return {
      ...item,
      name: shelf.name,
      price: shelf.price ?? item.price,
      restMultiplier: shelf.restMultiplier ?? item.restMultiplier,
      description: shelf.description ?? item.description,
      sort: shelf.sort,
    };
  });
  if (extra.length === 0) {
    return items === catalog.items ? catalog : { ...catalog, items };
  }
  return { ...catalog, items: [...items, ...extra] };
}

export function withPriceAdjustments(catalog: ShopCatalog): ShopCatalog {
  let changed = false;
  const items = catalog.items.map((item) => {
    const price = priceAdjustments[item.id];
    if (price == null || item.price === price) {
      return item;
    }
    changed = true;
    return { ...item, price };
  });
  return changed ? { ...catalog, items } : catalog;
}

export function withScratchPole(catalog: ShopCatalog): ShopCatalog {
  let changed = false;
  const items = catalog.items.map((item) => {
    const price = furnitureShelfPrices[item.id];
    if (price == null || item.price === price) {
      return item;
    }
    changed = true;
    return { ...item, price };
  });
  if (!items.some((item) => item.id === scratchPole.id)) {
    return { ...catalog, items: [...items, scratchPole] };
  }
  return changed ? { ...catalog, items } : catalog;
}

export function itemDefsFromCatalog(
  rows: { id: string; name: string; kind: ItemKind; slot?: OutfitSlot; wearId?: string }[],
): ItemDef[] {
  return rows.map((row) => ({ id: row.id, name: row.name, kind: row.kind, slot: row.slot, wearId: row.wearId }));
}
