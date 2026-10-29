import type { PetState } from './types';

export const parkFinds = {
  firstVisitFindChance: 1,
  visitFindChance: 0.15,
  noticeMinSec: 5,
  noticeMaxSec: 90,
  idleSec: 1,
  /** 0 = never auto-dismiss; prompt waits for "Let's see!" or another action. */
  promptTimeoutSec: 0,
  bushChance: 0.4,
  rarityWeights: { common: 65, uncommon: 25, rare: 9, legendary: 1 } as const,
  unlockLevel: 6,
  /** Park finds stay available from level 1. A find is one tutorial action and can level the pet at any time before level 10. */
  unlockGated: false,
  spotMinPetDist: 140,
  spotMinPropDist: 70,
  spotPadX: 60,
  spotPadYMin: 30,
  spotPadYMax: 40,
  dropFrontYOffset: 120,
  holeFadeSec: 90,
  maxHoles: 3,
  particlePool: 12,
  itemSceneHeight: 28,
  chestWidth: 110,
  legendaryBeatExtraSec: 0.5,
  modalAfterDropSec: 0.3,
} as const;

export type ParkFindRarity = keyof typeof parkFinds.rarityWeights;

export function isParkFindsUnlocked(pet: PetState): boolean {
  if (!parkFinds.unlockGated) {
    return true;
  }
  return pet.level >= parkFinds.unlockLevel;
}
