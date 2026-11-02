import { noteServerTime } from '../../db/accountMeta';
import { getDb } from '../../db/database';
import { activeClient, enterClient, leaveClient, type ClientBinding } from '../../sync/clientScope';
import { openClientDatabase } from '../../sync/harnessDb';
import { acceptedLocalDay } from '../dayGate';
import { grantActivityBoops, grantCompetitionBoops, grantParkFindBoops } from '../grants';
import { claimDailyLogin } from '../service';
import { noteBoopBurst, takeBoopBurst } from '../pendingBoops';
import { secondWindEnergy, tierPrice } from '../rewards';

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

function client(offset = 0): ClientBinding {
  const opened = openClientDatabase();
  return {
    ...opened,
    ownerId: 'owner-1',
    installId: 'install-1',
    supabase: null,
    now: () => Date.parse('2026-11-02T12:00:00Z'),
    timezone: 'UTC',
    utcOffsetMinutes: offset,
    secure: new Map(),
    asyncStorage: new Map(),
  };
}

const owner = {
  lastTrustedTime: 0,
  loginLastClaimedDay: '2026-11-02',
  utcOffset: 0,
  dayAcceptedAt: 0,
};

afterEach(() => {
  takeBoopBurst();
  if (activeClient()) {
    leaveClient();
  }
});

it('rounds exclusive and limited prices half-up to 50', () => {
  expect(tierPrice(500, 'exclusive')).toBe(650);
  expect(tierPrice(1800, 'exclusive')).toBe(2250);
  expect(tierPrice(1800, 'limited')).toBe(2700);
  expect(tierPrice(3200, 'exclusive')).toBe(4000);
  expect(tierPrice(900, 'standard')).toBe(900);
});

it('adds at most the energy that fits under 100', () => {
  expect(secondWindEnergy(40)).toEqual({ next: 50, gained: 10 });
  expect(secondWindEnergy(95)).toEqual({ next: 100, gained: 5 });
  expect(secondWindEnergy(100)).toEqual({ next: 100, gained: 0 });
});

it('rejects a backward clock, a timezone jump, and a skipped offline day', () => {
  enterClient(client(0));
  const noon = Date.parse('2026-11-02T12:00:00Z');
  expect(
    acceptedLocalDay(noon, { ...owner, lastTrustedTime: noon + 3_600_000, loginLastClaimedDay: null }),
  ).toBeNull();
  expect(acceptedLocalDay(Date.parse('2026-11-03T00:05:00Z'), owner)).toBe('2026-11-03');
  expect(acceptedLocalDay(Date.parse('2026-11-05T12:00:00Z'), owner)).toBeNull();
  leaveClient();

  enterClient(client(540));
  expect(
    acceptedLocalDay(Date.parse('2026-11-02T20:00:00Z'), { ...owner, utcOffset: 0, dayAcceptedAt: Date.parse('2026-11-02T19:00:00Z') }),
  ).toBe('2026-11-02');
});

it('accepts a later day once trusted time has reached it', () => {
  enterClient(client(0));
  const later = Date.parse('2026-11-05T12:00:00Z');
  noteServerTime(later, performance.now());
  expect(
    acceptedLocalDay(Date.parse('2026-11-02T12:00:00Z'), {
      ...owner,
      loginLastClaimedDay: '2026-11-01',
      dayAcceptedAt: Date.parse('2026-11-01T12:00:00Z'),
    }),
  ).toBe('2026-11-05');
});

it('caps activities, competitions, and park finds, and stacks them into one burst', () => {
  enterClient(client(0));
  const now = Date.parse('2026-11-02T12:00:00Z');
  expect(grantActivityBoops('tutorial:meet', now)).toBe(0);
  expect([1, 2, 3].map((n) => grantActivityBoops(`walk-${n}`, now))).toEqual([40, 40, 40]);
  expect(grantActivityBoops('walk-4', now)).toBe(0);

  expect(grantCompetitionBoops('race-1', 1, true, now)).toBe(30);
  expect(grantCompetitionBoops('race-2', 2, true, now)).toBe(30);
  expect(grantCompetitionBoops('race-3', 3, true, now)).toBe(30);
  expect(grantCompetitionBoops('race-4', 8, true, now)).toBe(10);
  expect(grantCompetitionBoops('race-5', 1, true, now)).toBe(0);
  expect(grantCompetitionBoops('race-dnf', 1, false, now)).toBe(0);

  expect(grantParkFindBoops('pet', 'acorn', 1, now)).toBe(25);
  expect(grantParkFindBoops('pet', 'acorn', 2, now)).toBe(25);
  expect(grantParkFindBoops('pet', 'leaf', 3, now)).toBe(25);
  expect(grantParkFindBoops('pet', 'stone', 4, now)).toBe(0);
  expect(takeBoopBurst()).toBe(120 + 100 + 75);
});

it('pays the day-7 bonus and keeps one missed day', () => {
  enterClient(client(0));
  const first = Date.parse('2026-11-01T12:00:00Z');
  expect(claimDailyLogin(first)).toMatchObject({ ok: true, amount: 50, streakDay: 1 });
  expect(claimDailyLogin(first).ok).toBe(false);

  getDb().runSync(
    'UPDATE owner_state SET login_streak = 6, login_last_claimed_day = ? WHERE owner_id = ?',
    '2026-11-01',
    'owner-1',
  );
  expect(claimDailyLogin(Date.parse('2026-11-02T00:05:00Z'))).toMatchObject({ ok: true, amount: 200, streakDay: 7 });

  getDb().runSync(
    'UPDATE owner_state SET login_streak = 3, login_last_claimed_day = ?, utc_offset_minutes = 0 WHERE owner_id = ?',
    '2026-11-02',
    'owner-1',
  );
  noteServerTime(Date.parse('2026-11-04T12:00:00Z'), performance.now());
  expect(claimDailyLogin(Date.parse('2026-11-04T12:00:00Z'))).toMatchObject({ ok: true, amount: 50, streakDay: 4 });

  getDb().runSync(
    'UPDATE owner_state SET login_streak = 4, login_last_claimed_day = ? WHERE owner_id = ?',
    '2026-11-04',
    'owner-1',
  );
  noteServerTime(Date.parse('2026-11-07T12:00:00Z'), performance.now());
  expect(claimDailyLogin(Date.parse('2026-11-07T12:00:00Z'))).toMatchObject({ ok: true, amount: 50, streakDay: 1 });
});

it('adds two same-moment grants into one burst total', () => {
  noteBoopBurst(40);
  noteBoopBurst(30);
  expect(takeBoopBurst()).toBe(70);
});
