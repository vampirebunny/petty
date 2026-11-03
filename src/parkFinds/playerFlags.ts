import {
  chestIntroShown,
  chestTooltipDone,
  parkFindPlayerFlags,
  resetChestIntroFlags as clearChestIntroFlags,
  setChestIntroShown as writeChestIntroShown,
  setChestTooltipDone as writeChestTooltipDone,
} from '../db/docFlags';
import { queuePlayer } from '../sync/queue';

export { chestIntroShown, chestTooltipDone, parkFindPlayerFlags };

export function setChestIntroShown(value: boolean): void {
  writeChestIntroShown(value);
  queuePlayer();
}

export function setChestTooltipDone(value: boolean): void {
  writeChestTooltipDone(value);
  queuePlayer();
}

export function resetChestIntroFlags(): void {
  clearChestIntroFlags();
  queuePlayer();
}
