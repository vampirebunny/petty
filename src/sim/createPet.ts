import { rngSeed, withDerived, zeroStats } from './attributes';
import { bathToleranceFor, blankCare, blankTraining } from './game';
import { speciesOf } from './tracks';
import {
  agingCalendar,
  defaultSceneId,
  startingAsleep,
  startingAttention,
  startingDietQuality,
  startingNeeds,
  startingHydration,
  startingWeight,
} from './config';
import { vitalityTarget } from './care';
import { startingCurrent } from './offers';
import type { Look, PetAttributes, PetState } from './types';

export type NewPet = {
  id: string;
  ownerId: string;
  name: string;
  breedId: string;
  look: Look;
  // The picked attribute set from `attributesFor`. Potential is stored and never recomputed.
  attributes: PetAttributes;
  now: number;
};

// A brand-new pet from the adoption choices. Pure: the same inputs always return the same pet.
// Current restarts at the starting fraction of the stored potential, so a debug reset can reuse
// the stored attributes without regenerating them from today's breed ranges.
export function createPet({ id, ownerId, name, breedId, look, attributes, now }: NewPet): PetState {
  const careWindow = [
    {
      day: 0,
      dietQuality: startingDietQuality,
      exercise: 0,
      play: 0,
      attention: startingAttention,
    },
  ];
  const species = speciesOf(breedId);
  const tolerance = bathToleranceFor(attributes.potential.boldness, breedId, species);
  return withDerived({
    id,
    ownerId,
    name,
    breedId,
    ageDays: 0,
    agingCalendar,
    maturity: 0,
    vitality: vitalityTarget(careWindow),
    careWindow,
    weight: startingWeight,
    weightAppliedAt: now,
    bornAt: now,
    sceneId: defaultSceneId,
    equipped: {},
    look: { ...look },
    attributes: {
      seed: attributes.seed,
      rulesVersion: attributes.rulesVersion,
      archetype: attributes.archetype,
      potential: { ...attributes.potential },
      current: startingCurrent(attributes.potential),
      trained: zeroStats(),
    },
    drift: zeroStats(),
    level: 1,
    xpTotal: 0,
    xpIntoLevel: 0,
    xpDailyEveryday: 0,
    xpDailyDay: '',
    tutorialSeen: [],
    parkFindGoalAt: null,
    lastPaidLevel: 1,
    lastPaidStage: 'puppy',
    bond: 0,
    needs: { ...startingNeeds },
    asleep: startingAsleep,
    lastUpdatedAt: now,
    rngState: rngSeed(attributes.seed, attributes.archetype),
    foodInBowl: false,
    bowlItemId: null,
    waterLevel: 0,
    waterEmptySince: now,
    hydration: startingHydration,
    boosts: [],
    care: blankCare(now, tolerance),
    training: blankTraining(species),
    milestones: [],
    seenCoachMarks: [],
    parkFinds: { firstFindVisitDone: false, items: [], pendingRevealModal: null },
  });
}
