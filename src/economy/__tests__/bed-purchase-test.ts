import { furnitureOf, layoutOf } from '../../db/playerHome';
import { getDb } from '../../db/database';
import { enterClient, leaveClient, type ClientBinding } from '../../sync/clientScope';
import { openClientDatabase } from '../../sync/harnessDb';
import { purchaseCart } from '../service';

jest.mock('../../sync/queue', () => ({
  queuePlayer: () => undefined,
  queueCoupled: () => undefined,
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const { activeClient: current } = require('../../sync/clientScope') as typeof import('../../sync/clientScope');
  return {
    __esModule: true,
    default: {
      getItem: async (key: string) => current()?.asyncStorage.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        current()?.asyncStorage.set(key, value);
      },
      removeItem: async (key: string) => {
        current()?.asyncStorage.delete(key);
      },
      getAllKeys: async () => [...(current()?.asyncStorage.keys() ?? [])],
      multiRemove: async (keys: string[]) => {
        for (const key of keys) {
          current()?.asyncStorage.delete(key);
        }
      },
    },
  };
});

function client(): ClientBinding {
  const opened = openClientDatabase();
  return {
    ...opened,
    ownerId: 'owner-1',
    installId: 'install-1',
    supabase: null,
    now: () => Date.parse('2026-10-26T12:00:00Z'),
    timezone: 'UTC',
    utcOffsetMinutes: 0,
    secure: new Map(),
    asyncStorage: new Map(),
  };
}

const remote = {
  version: 1,
  pickSlots: ['clothes', 'toys', 'treats_or_boosts'],
  noRepeatDays: 5,
  dealPct: 20,
  items: [
    {
      id: 'bed_cloud_puff',
      name: 'Marshmallow Mat',
      category: 'home',
      price: 4500,
      shop: 'always',
      tier: 'standard',
      species: ['dog'],
      isNewUntil: null,
      description: '2× faster rest',
      sort: 21,
      active: true,
    },
    {
      id: 'bed_standard',
      name: 'Standard Bed',
      category: 'home',
      price: 2500,
      shop: 'always',
      tier: 'standard',
      species: null,
      isNewUntil: null,
      description: null,
      sort: 20,
      active: true,
    },
  ],
  bundles: [],
};

it('puts a bought bed in owned furniture without a placement', () => {
  const phone = client();
  enterClient(phone);
  try {
    const db = getDb();
    db.runSync(
      `INSERT INTO shop_catalog_cache (id, active_json, active_version, pending_json, pending_version, pending_on)
       VALUES (1, ?, 1, NULL, NULL, NULL)`,
      JSON.stringify(remote),
    );
    db.runSync('INSERT INTO balances (owner_id, boops, updated_at) VALUES (?, 20000, ?)', 'owner-1', '2026-10-26T12:00:00Z');
    db.runSync(
      `INSERT INTO owner_state (
        owner_id, time_paid_through, time_capped_day, last_trusted_time, server_time_offset_ms,
        login_streak, login_last_claimed_day, last_open_at
      ) VALUES ('owner-1', 0, NULL, 0, 0, 0, NULL, 0)`,
    );
    db.runSync(
      'INSERT INTO owned_furniture (owner_id, piece_id, json) VALUES (?, ?, ?)',
      'owner-1',
      'livingroom-bed',
      JSON.stringify({ id: 'livingroom-bed', kind: 'bed', color: '#c2653d', w: 112 }),
    );
    db.runSync(
      'INSERT INTO home_layouts (owner_id, species, placements) VALUES (?, ?, ?)',
      'owner-1',
      'dog',
      JSON.stringify([{ pieceId: 'livingroom-bed', sceneId: 'livingroom', x: 110, y: 540 }]),
    );
    const bought = purchaseCart([{ id: 'bed_cloud_puff', kind: 'item', qty: 1 }], 'req-bed', 'dog', 'livingroom');
    const standard = purchaseCart([{ id: 'bed_standard', kind: 'item', qty: 1 }], 'req-standard', 'dog', 'livingroom');
    const pieces = furnitureOf('owner-1');
    const placed = layoutOf('owner-1', 'dog');
    const unplaced = pieces.filter((piece) => !placed.some((place) => place.pieceId === piece.id)).map((piece) => piece.id);
    expect(bought.ok && standard.ok).toBe(true);
    expect(unplaced).toEqual(expect.arrayContaining(['bed_cloud_puff', 'bed_standard:1']));
    expect(placed.map((place) => place.pieceId)).toEqual(['livingroom-bed']);
  } finally {
    leaveClient();
  }
});
