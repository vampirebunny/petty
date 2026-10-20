import {
  happyHappinessAtLeast,
  highHungerThreshold,
  lowEnergyThreshold,
  moodNeedFloor,
  sadHappinessBelow,
} from './config';
import type { Mood, Needs, PetState } from './types';

export function tummyOf(needs: Needs): number {
  return 100 - needs.hunger;
}

export function canRaiseMood(needs: Needs): boolean {
  return tummyOf(needs) >= moodNeedFloor && needs.energy >= moodNeedFloor;
}

export function needsMoodDrain(needs: Needs): boolean {
  return tummyOf(needs) < moodNeedFloor || needs.energy < moodNeedFloor;
}

export function deriveMood(state: PetState): Mood {
  if (state.asleep) {
    return 'sleeping';
  }
  if (state.needs.hunger > highHungerThreshold) {
    return 'hungry';
  }
  if (state.needs.energy < lowEnergyThreshold) {
    return 'sleepy';
  }
  if (state.needs.happiness >= happyHappinessAtLeast) {
    return 'happy';
  }
  if (state.needs.happiness < sadHappinessBelow) {
    return 'sad';
  }
  return 'content';
}
