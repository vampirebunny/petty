import { getDb } from '../../db/database';
import { enterClient, leaveClient, type ClientBinding } from '../../sync/clientScope';
import { openClientDatabase } from '../../sync/harnessDb';
import { applyIapEntries, onIapBoops } from '../iapApply';

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
    now: () => Date.parse('2026-10-28T12:00:00Z'),
    timezone: 'UTC',
    utcOffsetMinutes: 0,
    secure: new Map(),
    asyncStorage: new Map(),
  };
}

function boops(): number {
  return getDb().getFirstSync<{ boops: number }>('SELECT boops FROM balances WHERE owner_id = ?', 'owner-1')?.boops ?? 0;
}

it('credits a pack once, allows a refund below zero, and skips the outbox', () => {
  const phone = client();
  enterClient(phone);
  const bursts: number[] = [];
  const stop = onIapBoops((credits) => {
    bursts.push(...credits.map((credit) => credit.amount));
  });
  try {
    getDb().runSync('INSERT INTO balances (owner_id, boops, updated_at) VALUES (?, 100, ?)', 'owner-1', '2026-10-28T12:00:00Z');
    const purchase = { key: 'GPA.1', source: 'iap_purchase', lines: [{ asset: 'boops', delta: 600 }] };
    applyIapEntries([purchase]);
    applyIapEntries([purchase]);
    expect(boops()).toBe(700);
    expect(bursts).toEqual([600]);
    expect(getDb().getFirstSync('SELECT idempotency_key FROM ledger_outbox')).toBeNull();

    applyIapEntries([{ key: 'GPA.1:refund', source: 'iap_refund', lines: [{ asset: 'boops', delta: -800 }] }]);
    expect(boops()).toBe(-100);
    expect(bursts).toEqual([600]);

    applyIapEntries([{ key: 'GPA.1:refund_reversed', source: 'iap_refund_reversed', lines: [{ asset: 'boops', delta: 800 }] }]);
    expect(boops()).toBe(700);
    expect(bursts).toEqual([600, 800]);

    const row = getDb().getFirstSync<{ kind: string }>(
      'SELECT kind FROM transactions WHERE owner_id = ? AND idempotency_key = ?',
      'owner-1',
      'GPA.1:refund',
    );
    expect(row?.kind).toBe('reversal');
  } finally {
    stop();
    leaveClient();
  }
});
