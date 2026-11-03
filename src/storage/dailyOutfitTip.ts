import { seenDailyOutfitTooltip, setSeenDailyOutfitTooltip as writeSeenDailyOutfitTooltip } from '../db/docFlags';
import { queuePlayer } from '../sync/queue';

export { seenDailyOutfitTooltip };

export function setSeenDailyOutfitTooltip(value: boolean): void {
  writeSeenDailyOutfitTooltip(value);
  queuePlayer();
}
