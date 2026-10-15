import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PetState } from '../sim/types';
import type { PetStorage } from './PetStorage';

const storageKey = 'petty.pet';

function isPetState(value: unknown): value is PetState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const pet = value as PetState;
  return (
    typeof pet.asleep === 'boolean' &&
    typeof pet.lastUpdatedAt === 'number' &&
    typeof pet.rngState === 'number' &&
    !!pet.needs &&
    typeof pet.needs.fullness === 'number' &&
    typeof pet.needs.energy === 'number' &&
    typeof pet.needs.happiness === 'number'
  );
}

export const asyncPetStorage: PetStorage = {
  async load() {
    const raw = await AsyncStorage.getItem(storageKey);
    if (raw == null) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return isPetState(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  async save(state) {
    await AsyncStorage.setItem(storageKey, JSON.stringify(state));
  },
};
