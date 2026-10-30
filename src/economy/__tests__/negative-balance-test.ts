import { noteServerTime } from '../../db/accountMeta';
import { getDb } from '../../db/database';
import { enterClient, leaveClient, type ClientBinding } from '../../sync/clientScope';
import { openClientDatabase } from '../../sync/harnessDb';
import { getBalance, payoutTimeAccrual, purchaseLimited } from '../service';

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
    now: () => Date.parse('2026-10-30T16:00:00Z'),
    timezone: 'UTC',
    utcOffsetMinutes: 0,
    secure: new Map(),
    asyncStorage: new Map(),
  };
}

it('credits time Boops while the balance is below zero and still blocks spending', () => {
  const phone = client();
  enterClient(phone);
  try {
    const now = phone.now();
    noteServerTime(now, 0);
    const db = getDb();
    db.runSync('INSERT INTO balances (owner_id, boops, updated_at) VALUES (?, -100, ?)', 'owner-1', '2026-10-30T16:00:00Z');
    db.runSync(
      `INSERT INTO owner_state (
        owner_id, time_paid_through, time_capped_day, last_trusted_time, server_time_offset_ms,
        login_streak, login_last_claimed_day, last_open_at
      ) VALUES (?, ?, NULL, ?, 0, 0, NULL, 0)`,
      'owner-1',
      now - 20 * 60_000,
      now - 20 * 60_000,
    );

    const paid = payoutTimeAccrual('live', now);
    expect(paid).toBe(15);
    expect(getBalance()).toBe(-85);
    expect(payoutTimeAccrual('live', now)).toBe(0);
    expect(getBalance()).toBe(-85);

    const spent = purchaseLimited('crown', 1, 1, 'req-crown');
    expect(spent).toEqual({ ok: false, reason: 'insufficient_boops' });
    expect(getBalance()).toBe(-85);
  } finally {
    leaveClient();
  }
});
