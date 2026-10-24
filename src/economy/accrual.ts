import { economyConfig } from './economyConfig';
import { localDay, nextLocalMidnight } from './clock';

export type OwnerClock = {
  timePaidThrough: number;
  timeCappedDay: string | null;
  lastTrustedTime: number;
};

export type TimePayout = {
  owner: OwnerClock;
  amount: number;
  // False when the clock was rejected and nothing should be written.
  save: boolean;
  day: string;
};

export function planTimePayout(
  now: number,
  owner: OwnerClock,
  dailyCount: number,
  mode: 'live' | 'return',
): TimePayout {
  const cfg = economyConfig.timeAccrual;
  const hourMs = 3_600_000;
  const msPerBoop = hourMs / cfg.boopsPerHour;
  if (now <= owner.timePaidThrough) {
    return { owner, amount: 0, save: false, day: localDay(now) };
  }
  const next = { ...owner, lastTrustedTime: now };
  const today = localDay(now);
  let start = next.timePaidThrough;
  if (next.timeCappedDay && localDay(start) === next.timeCappedDay) {
    start = nextLocalMidnight(next.timeCappedDay);
  }
  if (now <= start) {
    return { owner: next, amount: 0, save: true, day: today };
  }
  const room = cfg.dailyCap - dailyCount;
  if (room <= 0) {
    return { owner: { ...next, timeCappedDay: today }, amount: 0, save: true, day: today };
  }
  const elapsed = now - start;
  const awayCapped = elapsed > cfg.awayCapHours * hourMs;
  const counted = Math.min(elapsed, cfg.awayCapHours * hourMs);
  const earned = Math.min(Math.floor(counted / msPerBoop), room);
  const amount = mode === 'return' ? earned : Math.floor(earned / cfg.payoutStep) * cfg.payoutStep;
  if (amount === 0) {
    return { owner: next, amount: 0, save: true, day: today };
  }
  return {
    owner: {
      ...next,
      timeCappedDay: amount >= room ? today : next.timeCappedDay,
      timePaidThrough: awayCapped ? now : start + amount * msPerBoop,
    },
    amount,
    save: true,
    day: today,
  };
}

export function nextPayoutAt(now: number, owner: OwnerClock, dailyCount: number): number | null {
  const cfg = economyConfig.timeAccrual;
  const hourMs = 3_600_000;
  const msPerBoop = hourMs / cfg.boopsPerHour;
  if (dailyCount >= cfg.dailyCap) {
    const day = owner.timeCappedDay ?? localDay(now);
    return nextLocalMidnight(day);
  }
  const start = owner.timePaidThrough;
  const paid = Math.floor((now - start) / msPerBoop);
  const nextStep = (Math.floor(paid / cfg.payoutStep) + 1) * cfg.payoutStep;
  return start + nextStep * msPerBoop;
}
