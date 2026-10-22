import { planTimePayout, type OwnerClock } from '../accrual';

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

it('pays a live step of 10 and an exact return amount', () => {
  const start = new Date(2026, 9, 22, 9, 0, 0).getTime();
  const tenMinutes = planTimePayout(start + 10 * 60_000, owner({ timePaidThrough: start, lastTrustedTime: start }), 0, 'live');
  expect(tenMinutes.amount).toBe(10);
  expect(tenMinutes.save).toBe(true);
  const nineMinutes = planTimePayout(start + 9 * 60_000, owner({ timePaidThrough: start, lastTrustedTime: start }), 0, 'live');
  expect(nineMinutes.amount).toBe(0);
  expect(nineMinutes.save).toBe(true);
  expect(nineMinutes.owner.lastTrustedTime).toBe(start + 9 * 60_000);
  const away = planTimePayout(start + 9 * hour, owner({ timePaidThrough: start, lastTrustedTime: start }), 0, 'return');
  expect(away.amount).toBe(8 * 60);
  expect(away.owner.timePaidThrough).toBe(start + 9 * hour);
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
