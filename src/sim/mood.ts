import {
  happyHappinessAtLeast,
  highHungerThreshold,
  lowEnergyThreshold,
  sadHappinessBelow,
} from './config';
import type { Mood, PetState } from './types';

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
