import { wearItem } from '../../actor/wardrobe';
import { catalogItem } from '../catalog';
import {
  rememberActiveDefs,
  reloadRetainedForTest,
  resetRemoteDefsForTest,
  setAppVersionForTest,
} from '../remoteDefs';
import { materializeShop, priceCart, type RemoteShopItem } from '../shop';
import { treatTemplateFor } from '../treatArt';

const collar = {
  v: 1,
  kind: 'outfit',
  slot: 'neckwear',
  shape: 'collar',
  label: 'Sky Collar',
  colorway: { c: '#5AA9E6', d: '#F0C94A', accent: 'bell' },
};

const treat = {
  v: 1,
  kind: 'treat',
  reaction: 'hop',
  species: ['dog'],
  art: { template: 'chew_stick', c: '#C9842F', d: '#8A5A32' },
  effects: { casual: { hunger: -10, weight: 0.04, mood: 0 }, training: null, fill: 'energy' },
};

function row(partial: Partial<RemoteShopItem> & Pick<RemoteShopItem, 'id'>): RemoteShopItem {
  return {
    name: partial.id,
    category: 'clothes',
    price: 100,
    shop: 'always',
    species: null,
    isNewUntil: null,
    description: null,
    sort: 0,
    active: true,
    ...partial,
  };
}

function build(items: RemoteShopItem[]) {
  return materializeShop(
    {
      version: 2,
      pickSlots: ['clothes', 'toys', 'treats_or_boosts'],
      noRepeatDays: 5,
      dealPct: 20,
      items,
      bundles: [],
    },
    [],
  );
}

beforeEach(() => {
  resetRemoteDefsForTest();
  setAppVersionForTest('1.0.0');
});

it('sells a remote outfit and treat, then keeps them after the row is gone', () => {
  const journal: { id: string; def_json: string }[] = [];
  const items = [
    row({ id: 'neckwear:sky', name: 'Sky Collar', def: collar }),
    row({ id: 'treat_maple', name: 'Maple Stick', category: 'treats', def: treat, species: ['dog'] }),
  ];
  rememberActiveDefs({ version: 2, items }, (id, json) => {
    if (!journal.some((entry) => entry.id === id)) {
      journal.push({ id, def_json: json });
    }
  });
  const catalog = build(items);
  expect(catalog.items.map((entry) => entry.id)).toEqual(['neckwear:sky', 'treat_maple']);
  expect(wearItem('neckwear', 'sky')?.colorway).toMatchObject({ c: '#5AA9E6', accent: 'bell' });
  expect(catalogItem('treat_maple')?.effects?.fill).toBe('energy');
  const quote = priceCart(
    catalog,
    [
      { id: 'neckwear:sky', kind: 'item', qty: 1 },
      { id: 'treat_maple', kind: 'item', qty: 2 },
    ],
    null,
    new Set(),
    'dog',
    1000,
  );
  expect(quote.ok).toBe(true);

  const later = build([]);
  expect(later.items).toEqual([]);
  expect(wearItem('neckwear', 'sky')?.label).toBe('Sky Collar');
  expect(catalogItem('treat_maple')?.name).toBe('Maple Stick');

  resetRemoteDefsForTest();
  expect(wearItem('neckwear', 'sky')).toBeNull();
  reloadRetainedForTest(journal);
  expect(wearItem('neckwear', 'sky')?.shape).toBe('collar');
  expect(catalogItem('treat_maple')?.kind).toBe('treat');
});

it('drops an unknown shape, pattern, or schema version, and keeps a coming-soon placeholder', () => {
  const unknown = build([
    row({ id: 'hat:cape', def: { ...collar, slot: 'hat', shape: 'cape' } }),
    row({
      id: 'hat:stripe',
      def: { v: 1, kind: 'outfit', slot: 'hat', shape: 'party', label: 'Nope', colorway: { c: '#111111', pattern: 'stripes' } },
    }),
    row({ id: 'neckwear:next', def: { ...collar, v: 2 } }),
    row({ id: 'soon:thing', name: 'Soon', shop: 'coming_soon', price: null, def: { v: 1, kind: 'outfit', shape: 'nope' } }),
  ]);
  expect(unknown.items.map((entry) => entry.id)).toEqual(['soon:thing']);
  expect(unknown.items[0]?.shop).toBe('coming_soon');
  expect(unknown.items[0]?.price).toBeNull();
});

it('ignores a remote def for a bundled id', () => {
  const journal: string[] = [];
  rememberActiveDefs(
    { version: 3, items: [row({ id: 'neckwear:bell', def: collar })] },
    (id) => {
      journal.push(id);
    },
  );
  expect(journal).toEqual([]);
  expect(catalogItem('neckwear:bell')?.name).toBe('Bell Collar');
  expect(wearItem('neckwear', 'bell')?.colorway.c).toBe('#6b3a2a');
});

it('hides a row whose min_app_version is newer than this binary', () => {
  const hidden = build([row({ id: 'neckwear:sky', def: collar, minAppVersion: '9.0.0' })]);
  expect(hidden.items).toEqual([]);
  setAppVersionForTest('9.0.0');
  const shown = build([row({ id: 'neckwear:sky', def: collar, minAppVersion: '9.0.0' })]);
  expect(shown.items.map((entry) => entry.id)).toEqual(['neckwear:sky']);
});

it('keeps biscuit and special on their original templates', () => {
  expect(treatTemplateFor('biscuit', 'dog')).toBe('bone');
  expect(treatTemplateFor('biscuit', 'cat')).toBe('fish');
  expect(treatTemplateFor('special')).toBe('cookie_center');
  expect(treatTemplateFor('treat_jerky')).toBe('chew_stick');
  expect(treatTemplateFor('treat_tuna')).toBe('can');
});
