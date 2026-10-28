import {
  catalogForDay,
  chooseDay,
  collectionAt,
  collectionEndsAt,
  collectionTheme,
  collectionWindowMs,
  dealFor,
  discounted,
  featuredLimited,
  limitedBuyLabel,
  materializeShop,
  priceCart,
  tabItems,
  type ShopCatalog,
  type ShopListing,
} from '../shop';
import { shopPetScene } from '../../ui/shop/shopFloor';

function item(partial: Pick<ShopListing, 'id'> & Partial<ShopListing>): ShopListing {
  return {
    name: partial.id,
    category: 'clothes',
    shop: 'always',
    price: 100,
    sort: 0,
    stackable: false,
    tier: 'standard' as const,
    ...partial,
  };
}

function shop(items: ShopListing[], extra: Partial<ShopCatalog> = {}): ShopCatalog {
  return {
    version: 1,
    items,
    bundles: [],
    pickSlots: ['clothes', 'toys', 'treats_or_boosts'],
    noRepeatDays: 5,
    dealPct: 20,
    ...extra,
  };
}

const today = '2026-10-23';

it('prefers a rotation item and skips one shown in the last 5 days', () => {
  const catalog = shop([
    item({ id: 'hat:party', shop: 'always' }),
    item({ id: 'hat:top', shop: 'rotation' }),
    item({ id: 'hat:bow', shop: 'rotation', name: 'Bow' }),
  ]);
  const open = chooseDay(catalog, 'dog', new Set(), today, []);
  expect(open.picks.map((pick) => pick.itemId)).toEqual([open.picks[0]?.itemId]);
  expect(open.picks[0]?.shop).toBe('rotation');
  expect(open.picks[0]?.itemId === 'hat:top' || open.picks[0]?.itemId === 'hat:bow').toBe(true);

  const again = chooseDay(catalog, 'dog', new Set(), today, []);
  expect(again.picks[0]?.itemId).toBe(open.picks[0]?.itemId);

  const fresh = chooseDay(catalog, 'dog', new Set(), today, [
    { date: '2026-10-18', slot: 'clothes', itemId: open.picks[0]!.itemId },
  ]);
  expect(fresh.picks[0]?.itemId).not.toBe(open.picks[0]?.itemId);
  expect(fresh.picks[0]?.shop).toBe('rotation');
});

it('ignores history when that would leave the slot empty, and drops a slot the player owns out', () => {
  const only = shop([item({ id: 'hat:top', shop: 'rotation' })]);
  const repeated = chooseDay(only, 'dog', new Set(), today, [{ date: '2026-10-22', slot: 'clothes', itemId: 'hat:top' }]);
  expect(repeated.picks.map((pick) => pick.itemId)).toEqual(['hat:top']);

  const owned = chooseDay(only, 'dog', new Set(['hat:top']), today, []);
  expect(owned.picks).toEqual([]);
  expect(owned.dealId).toBeNull();
});

it('hides the other species toys and never discounts a consumable', () => {
  const catalog = shop([
    item({ id: 'frisbee', category: 'toys', shop: 'always', species: ['dog'] }),
    item({ id: 'yarn', category: 'toys', shop: 'rotation', species: ['cat'] }),
    item({ id: 'biscuit', category: 'treats', shop: 'always', stackable: true, price: 30 }),
  ]);
  const cat = chooseDay(catalog, 'cat', new Set(), today, []);
  expect(cat.picks.map((pick) => pick.itemId)).toEqual(['yarn', 'biscuit']);
  expect(cat.dealId).toBe('yarn');
  const dog = chooseDay(catalog, 'dog', new Set(), today, []);
  expect(dog.picks.some((pick) => pick.itemId === 'yarn')).toBe(false);
  expect(dog.dealId).toBe('frisbee');
});

it('picks the deal from clothes, then toys, preferring rotation', () => {
  expect(
    dealFor([
      { slot: 'clothes', itemId: 'hat', shop: 'rotation' },
      { slot: 'toys', itemId: 'toy', shop: 'rotation' },
    ]),
  ).toBe('hat');
  expect(
    dealFor([
      { slot: 'clothes', itemId: 'hat', shop: 'always' },
      { slot: 'toys', itemId: 'toy', shop: 'rotation' },
    ]),
  ).toBe('toy');
  expect(dealFor([{ slot: 'clothes', itemId: 'hat', shop: 'always' }])).toBe('hat');
  expect(dealFor([{ slot: 'toys', itemId: 'toy', shop: 'always' }])).toBe('toy');
  expect(dealFor([{ slot: 'treats_or_boosts', itemId: 'biscuit', shop: 'always' }])).toBeNull();
});

it('rounds the deal and merges a bundle with loose biscuits', () => {
  expect(discounted(120, 20)).toBe(96);
  expect(discounted(101, 20)).toBe(81);
  const biscuit = item({ id: 'biscuit', category: 'treats', shop: 'always', stackable: true, price: 30, name: 'Treats' });
  const catalog = shop([biscuit], {
    bundles: [
      { id: 'treat_bag', name: 'Treat Bag ×10', price: 240, contents: [{ itemId: 'biscuit', qty: 10 }], sort: 0 },
    ],
  });
  const priced = priceCart(
    catalog,
    [
      { id: 'treat_bag', kind: 'bundle', qty: 1 },
      { id: 'biscuit', kind: 'item', qty: 3 },
    ],
    null,
    new Set(),
    'dog',
    1000,
  );
  expect(priced.ok).toBe(true);
  if (!priced.ok) {
    return;
  }
  expect(priced.charge).toBe(330);
  expect(priced.inventory).toEqual([{ asset: 'biscuit', delta: 13 }]);
  expect(priced.toys).toEqual([]);
});

it('charges the deal price for a toy and refuses a second copy', () => {
  const catalog = shop([item({ id: 'frisbee', category: 'toys', shop: 'rotation', price: 400, species: ['dog'], name: 'Frisbee' })]);
  const priced = priceCart(catalog, [{ id: 'frisbee', kind: 'item', qty: 1 }], 'frisbee', new Set(), 'dog', 1000);
  expect(priced.ok && priced.charge).toBe(320);
  expect(priced.ok && priced.toys).toEqual(['frisbee']);
  const owned = priceCart(catalog, [{ id: 'frisbee', kind: 'item', qty: 1 }], 'frisbee', new Set(['frisbee']), 'dog', 1000);
  expect(owned).toEqual({ ok: false, reason: 'already_owned' });
  const cat = priceCart(catalog, [{ id: 'frisbee', kind: 'item', qty: 1 }], null, new Set(), 'cat', 1000);
  expect(cat).toEqual({ ok: false, reason: 'not_available' });
});

it('keeps a pending catalog until its day, and skips items the build cannot use', () => {
  const pending = shop([]);
  const active = shop([item({ id: 'keep' })]);
  const waiting = catalogForDay({ active, pending, pendingOn: '2026-10-24' }, '2026-10-23');
  expect(waiting.catalog).toBe(active);
  const due = catalogForDay({ active, pending, pendingOn: '2026-10-24' }, '2026-10-24');
  expect(due.catalog).toBe(pending);
  expect(due.cache.pending).toBeNull();

  const built = materializeShop(
    {
      version: 4,
      pickSlots: ['clothes', 'toys', 'treats_or_boosts'],
      noRepeatDays: 5,
      dealPct: 20,
      items: [
        {
          id: 'mystery',
          name: 'Mystery',
          category: 'toys',
          price: 10,
          shop: 'always',
          species: null,
          isNewUntil: null,
          description: null,
          sort: 0,
          active: true,
        },
        {
          id: 'vitamins',
          name: 'Vitamins',
          category: 'boosts',
          price: null,
          shop: 'coming_soon',
          species: null,
          isNewUntil: null,
          description: 'Coming soon',
          sort: 1,
          active: true,
        },
      ],
      bundles: [],
    },
    [],
  );
  expect(built.items.map((entry) => entry.id)).toEqual(['vitamins']);
  expect(built.items[0]?.price).toBeNull();
});

it('keeps a limited edition in the featured spot until a day after it sells out', () => {
  const onSale = { itemId: 'hat:crown', cap: 500, unitsLeft: 12, soldOutAt: null };
  expect(featuredLimited([onSale], Date.parse('2026-10-23T12:00:00Z'))).toBe(onSale);
  expect(limitedBuyLabel(onSale, false)).toBe('offline');
  expect(limitedBuyLabel({ ...onSale, unitsLeft: 0 }, true)).toBe('held');
  const sold = { ...onSale, unitsLeft: 0, soldOutAt: '2026-10-23T00:00:00Z' };
  const noon = Date.parse('2026-10-23T12:00:00Z');
  expect(featuredLimited([sold], noon)?.itemId).toBe('hat:crown');
  expect(limitedBuyLabel(sold, true)).toBe('sold_out');
  expect(featuredLimited([sold], noon + 25 * 60 * 60 * 1000)).toBeNull();
});

it('keeps the shop pet on one ground line', () => {
  expect(shopPetScene.floor.yMax - shopPetScene.floor.yMin).toBeLessThan(1);
  expect(shopPetScene.floor.xMax).toBeGreaterThan(shopPetScene.floor.xMin);
});

it('rejects a negative price, a fractional price, and an empty bundle', () => {
  const negative = shop([item({ id: 'hat:party', price: -5 })]);
  expect(priceCart(negative, [{ id: 'hat:party', kind: 'item', qty: 1 }], null, new Set(), 'dog', 100).ok).toBe(false);
  const fraction = shop([item({ id: 'hat:party', price: 10.5 })]);
  expect(priceCart(fraction, [{ id: 'hat:party', kind: 'item', qty: 1 }], null, new Set(), 'dog', 100).ok).toBe(false);
  const empty = shop([], {
    bundles: [{ id: 'bag', name: 'Bag', price: 10, contents: [], sort: 0 }],
  });
  expect(priceCart(empty, [{ id: 'bag', kind: 'bundle', qty: 1 }], null, new Set(), 'dog', 100).ok).toBe(false);
});

it('lists furniture from cheapest to most expensive', () => {
  const catalog = shop([
    item({ id: 'catTree', category: 'home', price: 10000, sort: 1, species: ['cat'] }),
    item({ id: 'scratcher', category: 'home', price: 5000, sort: 2, species: ['cat'] }),
    item({ id: 'bowl_food', category: 'home', price: 700, sort: 10 }),
    item({ id: 'bed_standard', category: 'home', price: 3000, sort: 20 }),
    item({ id: 'bed_kitty_cave', category: 'home', price: 5500, sort: 23, species: ['cat'] }),
    item({ id: 'vitamins', category: 'home', shop: 'coming_soon', price: null, sort: 0 }),
  ]);
  expect(tabItems(catalog, 'home', 'cat').map((entry) => entry.id)).toEqual([
    'bowl_food',
    'bed_standard',
    'scratcher',
    'bed_kitty_cave',
    'catTree',
    'vitamins',
  ]);
});

it('keeps exclusives off the always shelf and out of the always pick pool', () => {
  const catalog = shop([
    item({ id: 'glasses:star', tier: 'exclusive', shop: 'always' }),
    item({ id: 'glasses:heart', shop: 'always' }),
    item({ id: 'hat:top-velvet', tier: 'exclusive', shop: 'coming_soon', price: null }),
  ]);
  expect(tabItems(catalog, 'clothes', 'dog').map((entry) => entry.id)).toEqual(['glasses:heart', 'hat:top-velvet']);
  const picks = chooseDay(
    shop([item({ id: 'glasses:star', tier: 'exclusive', shop: 'always', category: 'clothes' })]),
    'dog',
    new Set(),
    today,
    [],
  );
  expect(picks.picks).toEqual([]);
});

describe('collection rotation', () => {
  const themed = shop([
    item({ id: 'hat:top' }),
    item({ id: 'hat:beanie.autumn-plaid', theme: 'autumn-plaid', sort: 1 }),
    item({ id: 'hat:cap.autumn-plaid', theme: 'autumn-plaid', sort: 0 }),
    item({ id: 'hat:beanie.mint-choc', theme: 'mint-choc' }),
    item({ id: 'hat:beanie.strawberry-milk', theme: 'strawberry-milk', species: ['cat'] }),
    item({ id: 'hat:beanie.rainbow-sherbet', theme: 'rainbow-sherbet', shop: 'rotation', tier: 'exclusive' }),
    item({ id: 'hat:beanie.midnight-stars', theme: 'midnight-stars', shop: 'featured', tier: 'limited' }),
  ]);

  const hours = collectionWindowMs;
  const start = Math.floor(Date.parse('2026-10-23T00:00:00Z') / hours) * hours;
  const when = (theme: string, catalog = themed) => {
    for (let step = 0; step < 64; step += 1) {
      if (collectionTheme(catalog, start + step * hours) === theme) {
        return start + step * hours;
      }
    }
    throw new Error(`no window for ${theme}`);
  };

  it('holds one theme for three hours, then moves to the next', () => {
    const first = collectionTheme(themed, start);
    expect(collectionTheme(themed, start + hours - 1)).toBe(first);
    expect(collectionTheme(themed, start + hours)).not.toBe(first);
    expect(collectionEndsAt(start + 5)).toBe(start + hours);
    const seen = new Set([0, 1, 2].map((step) => collectionTheme(themed, start + step * hours)));
    expect(seen).toEqual(new Set(['autumn-plaid', 'mint-choc', 'strawberry-milk']));
  });

  it('shifts each theme to different hours the next day', () => {
    const eight = shop(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((theme) => item({ id: `hat:beanie.${theme}`, theme })),
    );
    for (let step = 0; step < 8; step += 1) {
      const at = start + step * hours;
      expect(collectionTheme(eight, at + 8 * hours)).not.toBe(collectionTheme(eight, at));
    }
  });

  it('leaves exclusive and limited themes out of the rotation', () => {
    for (let step = 0; step < 24; step += 1) {
      expect(['rainbow-sherbet', 'midnight-stars']).not.toContain(collectionTheme(themed, start + step * hours));
    }
  });

  it('lists the current theme in sort order and respects species', () => {
    const at = when('autumn-plaid');
    expect(collectionAt(themed, at + 60_000, 'dog')).toEqual({
      theme: 'autumn-plaid',
      name: 'Autumn Plaid',
      items: [expect.objectContaining({ id: 'hat:cap.autumn-plaid' }), expect.objectContaining({ id: 'hat:beanie.autumn-plaid' })],
      endsAt: at + hours,
    });
    const catTime = when('strawberry-milk');
    expect(collectionAt(themed, catTime, 'dog')).toBeNull();
    expect(collectionAt(themed, catTime, 'cat')?.items.map((entry) => entry.id)).toEqual(['hat:beanie.strawberry-milk']);
  });

  it('keeps collection pieces off the Clothes shelf and out of the daily picks', () => {
    expect(tabItems(themed, 'clothes', 'dog').map((entry) => entry.id)).toEqual(['hat:top']);
    const picks = chooseDay(themed, 'dog', new Set(), today, []);
    expect(picks.picks.map((pick) => pick.itemId)).toEqual(['hat:beanie.rainbow-sherbet']);
  });

  it('sells a collection piece only while its collection is up', () => {
    const live = when('mint-choc');
    const other = when('autumn-plaid');
    const line = [{ id: 'hat:beanie.mint-choc', kind: 'item' as const, qty: 1 }];
    expect(priceCart(themed, line, null, new Set(), 'dog', 1000, live).ok).toBe(true);
    expect(priceCart(themed, line, null, new Set(), 'dog', 1000, other)).toEqual({ ok: false, reason: 'not_available' });
    expect(priceCart(themed, line, null, new Set(), 'dog', 1000).ok).toBe(false);
    expect(priceCart(themed, [{ id: 'hat:top', kind: 'item', qty: 1 }], null, new Set(), 'dog', 1000, other).ok).toBe(true);
  });

  it('reads the theme from a generated id when a cached download predates the column', () => {
    const built = materializeShop(
      {
        version: 1,
        pickSlots: ['clothes'],
        noRepeatDays: 5,
        dealPct: 20,
        items: [
          { id: 'hat:beanie.mint-choc', name: 'Mint Choc Beanie', category: 'clothes', price: 1100, shop: 'always', species: null, isNewUntil: null, description: null, sort: 0, active: true },
          { id: 'hat:top', name: 'Top Hat', category: 'clothes', price: 1800, shop: 'always', species: null, isNewUntil: null, description: null, sort: 0, active: true },
        ],
        bundles: [],
      },
      [
        { id: 'hat:beanie.mint-choc', name: 'Mint Choc Beanie', kind: 'outfit', slot: 'hat', wearId: 'beanie.mint-choc' },
        { id: 'hat:top', name: 'Top Hat', kind: 'outfit', slot: 'hat', wearId: 'top' },
      ],
    );
    expect(built.items.map((entry) => [entry.id, entry.theme])).toEqual([
      ['hat:beanie.mint-choc', 'mint-choc'],
      ['hat:top', undefined],
    ]);
  });
});
