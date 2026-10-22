import { shownLevel, stageOf } from '../sim/attributes';
import type { PetState, Stage } from '../sim/types';

export const stageOrder: Stage[] = ['puppy', 'olderPuppy', 'adolescent', 'adult', 'senior'];

export function levelsToPay(pet: PetState): number[] {
  const current = shownLevel(pet.xp, stageOf(pet.ageDays));
  const last = pet.lastPaidLevel ?? 1;
  const levels: number[] = [];
  for (let level = last + 1; level <= current; level += 1) {
    levels.push(level);
  }
  return levels;
}

export function stagesToPay(pet: PetState): Stage[] {
  const current = stageOf(pet.ageDays);
  const last = pet.lastPaidStage ?? current;
  const from = stageOrder.indexOf(last);
  const to = stageOrder.indexOf(current);
  if (from < 0 || to <= from) {
    return [];
  }
  return stageOrder.slice(from + 1, to + 1);
}
