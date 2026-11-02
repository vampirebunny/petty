import type { PetState } from './types';

// The old pet leaves the player's view. Worn clothes, an open signup, and an
// unrevealed park find go with it. The collection itself is copied onto the new pet.
export function restartedSnapshot(pet: PetState, now: number): PetState {
  return {
    ...pet,
    equipped: {},
    restartedAt: now,
    parkFinds: {
      firstFindVisitDone: pet.parkFinds?.firstFindVisitDone ?? false,
      items: pet.parkFinds?.items ?? [],
      pendingRevealModal: null,
    },
    races: pet.races
      ? { ...pet.races, signup: null, signups: [], entered: false, friendGame: null }
      : pet.races,
  };
}

// Player-owned facts that happen to live on the pet document. Stats, tricks,
// name, and look stay on the new pet createPet just built.
export function carryRestartedPet(created: PetState, old: PetState): PetState {
  return {
    ...created,
    dailyOutfitEnabled: old.dailyOutfitEnabled === true ? true : created.dailyOutfitEnabled,
    tutorialSeen: [...(old.tutorialSeen ?? [])],
    seenCoachMarks: [...(old.seenCoachMarks ?? [])],
    parkFinds: {
      firstFindVisitDone: old.parkFinds?.firstFindVisitDone ?? false,
      items: [...(old.parkFinds?.items ?? [])],
      pendingRevealModal: null,
    },
  };
}
