import { capAccrualNow, planTimePayout, type OwnerClock } from '../accrual';

const hour = 3_600_000;

function owner(partial: Partial<OwnerClock> = {}): OwnerClock {
  return {
    timePaidThrough: 0,
    timeCappedDay: null,
    lastTrustedTime: 0,
    ...partial,
  };
}

it('pays nothing and writes nothing when the clock moves backward', () => {
  const now = 10 * hour;
  const clock = owner({ timePaidThrough: now, lastTrustedTime: now + hour });
  const planned = planTimePayout(now, clock, 0, 'return');
  expect(planned.amount).toBe(0);
  expect(planned.save).toBe(false);
  expect(planned.owner).toBe(clock);
});

it('pays a live step of 15 and an exact return amount', () => {
  const start = new Date(2026, 9, 22, 9, 0, 0).getTime();
  const fifteenMinutes = planTimePayout(start + 15 * 60_000, owner({ timePaidThrough: start, lastTrustedTime: start }), 0, 'live');
  expect(fifteenMinutes.amount).toBe(15);
  expect(fifteenMinutes.save).toBe(true);
  const fourteenMinutes = planTimePayout(start + 14 * 60_000, owner({ timePaidThrough: start, lastTrustedTime: start }), 0, 'live');
  expect(fourteenMinutes.amount).toBe(0);
  expect(fourteenMinutes.save).toBe(true);
  expect(fourteenMinutes.owner.lastTrustedTime).toBe(start + 14 * 60_000);
  const away = planTimePayout(start + 9 * hour, owner({ timePaidThrough: start, lastTrustedTime: start }), 0, 'return');
  expect(away.amount).toBe(8 * 60);
  expect(away.owner.timePaidThrough).toBe(start + 9 * hour);
});

it('caps accrual at the server sample plus monotonic time', () => {
  const sample = 1_700_000_000_000;
  expect(
    capAccrualNow({
      wallNow: sample,
      offsetMs: 0,
      sampleServerMs: null,
      samplePerfMs: null,
      perfNowMs: 0,
    }),
  ).toBeNull();
  expect(
    capAccrualNow({
      wallNow: sample + 10 * 24 * hour,
      offsetMs: 0,
      sampleServerMs: sample,
      samplePerfMs: 0,
      perfNowMs: 60_000,
    }),
  ).toBe(sample + 60_000);
  expect(
    capAccrualNow({
      wallNow: sample + 10 * 24 * hour,
      offsetMs: 0,
      sampleServerMs: sample,
      samplePerfMs: 5_000_000,
      perfNowMs: 10,
    }),
  ).toBe(sample);
  expect(
    capAccrualNow({
      wallNow: sample + 60_000,
      offsetMs: 0,
      sampleServerMs: sample,
      samplePerfMs: 0,
      perfNowMs: 10 * 60_000,
    }),
  ).toBe(sample + 60_000);
});

it('stops at the daily cap without jumping the paid-through clock to now', () => {
  const start = new Date(2026, 9, 22, 8, 0, 0).getTime();
  const planned = planTimePayout(start + 3 * hour, owner({ timePaidThrough: start, lastTrustedTime: start }), 580, 'return');
  expect(planned.amount).toBe(20);
  expect(planned.owner.timeCappedDay).toBe('2026-10-22');
  expect(planned.owner.timePaidThrough).toBe(start + 20 * 60_000);
  const blocked = planTimePayout(start + 4 * hour, planned.owner, 600, 'live');
  expect(blocked.amount).toBe(0);
  expect(blocked.save).toBe(true);
  expect(blocked.owner.timePaidThrough).toBe(planned.owner.timePaidThrough);
});
