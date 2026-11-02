import { economyConfig } from './economyConfig';
import { calendarDaysBetween } from './clock';

export type LoginOffer = {
  claimable: boolean;
  streakDay: number;
  reward: number;
};

function rewardFor(streakDay: number): number {
  const base = economyConfig.firstOpen.boops;
  return streakDay === economyConfig.streak.length ? base + economyConfig.streak.bonus : base;
}

export function loginOffer(lastClaimedDay: string | null, streak: number, today: string): LoginOffer {
  const length = economyConfig.streak.length;
  if (!lastClaimedDay) {
    return { claimable: true, streakDay: 1, reward: rewardFor(1) };
  }
  const gap = calendarDaysBetween(lastClaimedDay, today);
  if (gap <= 0) {
    const day = Math.min(length, Math.max(1, streak));
    return { claimable: false, streakDay: day, reward: rewardFor(day) };
  }
  if (gap > economyConfig.streak.graceDays + 1) {
    return { claimable: true, streakDay: 1, reward: rewardFor(1) };
  }
  const next = streak >= length ? 1 : streak + 1;
  return { claimable: true, streakDay: next, reward: rewardFor(next) };
}
