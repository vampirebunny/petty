import { getDb } from '../db/database';
import { queuePlayer } from '../sync/queue';

const TIP_KEY = 'seen_daily_outfit_tooltip';

export function seenDailyOutfitTooltip(): boolean {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', TIP_KEY);
  return row?.value === '1';
}

export function setSeenDailyOutfitTooltip(value: boolean): void {
  getDb().runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', TIP_KEY, value ? '1' : '0');
  queuePlayer();
}
