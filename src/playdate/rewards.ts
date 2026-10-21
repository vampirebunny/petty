import { addFlatTrained, attributeScore, withDerived } from '../sim/attributes';
import { clampMax, clampMin, traits } from '../sim/config';
import { canRaiseMood } from '../sim/mood';
import type { PetState, Trait } from '../sim/types';
import { playdateConfig } from './config';
import type { PartyTrick, PlaydateOutcome, RareEvent } from './types';

function clampNeed(value: number): number {
  return Math.min(clampMax, Math.max(clampMin, value));
}

// Flat happiness and flat attribute points. No training taper, no level XP, no pet.bond.
export function applyPlaydateRewards(pet: PetState, outcome: PlaydateOutcome): PetState {
  const granted = addFlatTrained(pet, outcome.attributeXp);
  return withDerived({
    ...granted,
    needs: {
      ...granted.needs,
      happiness: clampNeed(
        pet.needs.happiness + (outcome.moodDelta > 0 && !canRaiseMood(pet.needs) ? 0 : outcome.moodDelta),
      ),
    },
  });
}

export const traitName: Record<Trait, string> = {
  stamina: 'Stamina',
  agility: 'Agility',
  intelligence: 'Intelligence',
  boldness: 'Boldness',
  affection: 'Affection',
  obedience: 'Obedience',
};

export type AttributeGain = {
  trait: Trait;
  // The score the pet showed before the playdate, the score it shows now, and the cap.
  before: number;
  after: number;
  potential: number;
  // What the playdate actually added to the shown score. Aging or a cap can make it smaller than the grant.
  gain: number;
};

// The shown score before and after a playdate for each attribute it trained. Work it out from the pet
// as it was before the rewards were paid, with the same rules the home screen uses for its numbers.
export function attributeGains(pet: PetState, outcome: PlaydateOutcome): AttributeGain[] {
  const next = applyPlaydateRewards(pet, outcome);
  return traits
    .filter((trait) => (outcome.attributeXp[trait] ?? 0) > 0)
    .map((trait) => {
      const before = attributeScore(pet, trait);
      const after = attributeScore(next, trait);
      return { trait, before, after, potential: pet.attributes.potential[trait], gain: Math.max(0, after - before) };
    });
}

const trickLabel: Record<PartyTrick, string> = {
  sit: 'a sit',
  paw: 'a paw',
  speak: 'a speak',
};

export function rareEventLine(event: RareEvent, petName: string, partnerName: string): string {
  if (event.type === 'upset') {
    return `An upset. The underdog took it, and ${petName} is still thinking about it.`;
  }
  return `${partnerName} showed off ${trickLabel[event.trickId]}. ${petName} is watching.`;
}

export function bondHint(bond: number): string {
  if (bond >= 48) {
    return 'Best pals';
  }
  if (bond >= 24) {
    return 'Pals';
  }
  if (bond >= playdateConfig.bondGain) {
    return 'Getting to know';
  }
  return 'New friend';
}
