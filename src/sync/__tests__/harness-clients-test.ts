import { createUuid, getCachedInstallId } from '../../compliance/identity';
import { rebindOwner } from '../../db/bindOwner';
import { serverNow } from '../../db/accountMeta';
import { currentOwner } from '../../db/currentOwner';
import { getDb } from '../../db/database';
import { writeLedgerEntry } from '../../db/ledgerWrite';
import { localDay } from '../../economy/clock';
import { deviceNow, enterClient, leaveClient, type ClientBinding } from '../clientScope';
import { assertClientsDiffer, createHarnessClient } from '../harness';
import { openClientDatabase } from '../harnessDb';

jest.mock('@react-native-async-storage/async-storage', () => {
  const { activeClient: current } = require('../clientScope') as typeof import('../clientScope');
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

function client(ownerId: string, installId: string, timezone: string, utcOffsetMinutes: number): ClientBinding {
  const opened = openClientDatabase();
  return {
    ...opened,
    ownerId,
    installId,
    supabase: null,
    now: () => Date.parse('2026-10-24T03:30:00Z'),
    timezone,
    utcOffsetMinutes,
    secure: new Map(),
    asyncStorage: new Map(),
  };
}

afterEach(() => {
  leaveClient();
});

it('keeps two clients on different databases, owners, and clocks', async () => {
  const phone = client('phone-owner', 'phone-install', 'America/New_York', -240);
  const tablet = client('tablet-owner', 'tablet-install', 'Asia/Tokyo', 540);
  assertClientsDiffer(
    createHarnessClient({
      databasePath: phone.databasePath,
      ownerId: phone.ownerId,
      installId: phone.installId,
    }),
    createHarnessClient({
      databasePath: tablet.databasePath,
      ownerId: tablet.ownerId,
      installId: tablet.installId,
    }),
  );

  enterClient(phone);
  getDb().runSync("INSERT INTO meta (key, value) VALUES ('mark', 'phone')");
  expect(currentOwner()).toBe('phone-owner');
  expect(getCachedInstallId()).toBe('phone-install');
  expect(localDay(deviceNow())).toBe('2026-10-23');
  leaveClient();

  enterClient(tablet);
  expect(getDb().getFirstSync("SELECT value FROM meta WHERE key = 'mark'")).toBeNull();
  expect(currentOwner()).toBe('tablet-owner');
  expect(localDay(deviceNow())).toBe('2026-10-24');
  getDb().runSync("INSERT INTO meta (key, value) VALUES ('mark', 'tablet')");
  leaveClient();

  enterClient(phone);
  const mark = getDb().getFirstSync<{ value: string }>("SELECT value FROM meta WHERE key = 'mark'");
  expect(mark?.value).toBe('phone');
  leaveClient();
});

it('uses the entered clock for serverNow', () => {
  const phone = client('phone-owner', 'phone-install', 'UTC', 0);
  const real = Date.now();
  phone.now = () => real + 5 * 60_000;
  enterClient(phone);
  expect(deviceNow() - real).toBe(5 * 60_000);
  expect(serverNow()).toBe(phone.now());
});

it('rebinds every owner table onto the account and keeps the ledger sum', async () => {
  const phone = client('install-1', 'install-1', 'UTC', 0);
  enterClient(phone);
  getDb().runSync(
    'INSERT INTO balances (owner_id, boops, updated_at) VALUES (?, ?, ?)',
    'install-1',
    40,
    't',
  );
  writeLedgerEntry(phone.ownerId, createUuid(), 'starter_grant', 'starter', null, [
    { asset: 'boops', delta: 100 },
    { asset: 'boops', delta: 20 },
  ]);
  const sum = getDb().getFirstSync<{ total: number }>(
    "SELECT COALESCE(SUM(delta), 0) AS total FROM transaction_lines WHERE asset = 'boops'",
  );
  expect(Number(sum?.total)).toBe(120);
  await rebindOwner('install-1', 'user-1');
  const moved = getDb().getFirstSync<{ boops: number }>('SELECT boops FROM balances WHERE owner_id = ?', 'user-1');
  expect(moved?.boops).toBe(40);
  expect(getDb().getFirstSync('SELECT boops FROM balances WHERE owner_id = ?', 'install-1')).toBeNull();
});
