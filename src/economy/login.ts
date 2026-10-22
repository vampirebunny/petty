import { economyConfig } from './economyConfig';
import { calendarDaysBetween } from './clock';

export type LoginOffer = {
  claimable: boolean;
  streakDay: number;
  reward: number;
};

export function loginOffer(lastClaimedDay: string | null, streak: number, today: string): LoginOffer {
  const rewards = economyConfig.dailyLogin.rewards;
  if (!lastClaimedDay) {
    return { claimable: true, streakDay: 1, reward: rewards[0] };
  }
  const gap = calendarDaysBetween(lastClaimedDay, today);
  if (gap <= 0) {
    const day = Math.min(rewards.length, Math.max(1, streak));
    return { claimable: false, streakDay: day, reward: rewards[day - 1] };
  }
  if (gap >= 3) {
    return { claimable: true, streakDay: 1, reward: rewards[0] };
  }
  const next = streak >= rewards.length ? 1 : streak + 1;
  return { claimable: true, streakDay: next, reward: rewards[next - 1] };
}
