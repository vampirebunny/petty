import AsyncStorage from '@react-native-async-storage/async-storage';

import { createPet } from '../../sim/createPet';
import { asyncPetStorage } from '../asyncStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('returns the same state after saving and loading', async () => {
  const pet = createPet(3, 50);
  await asyncPetStorage.save(pet);
  await expect(asyncPetStorage.load()).resolves.toEqual(pet);
});

it('returns null when nothing is stored or the json is unreadable', async () => {
  await expect(asyncPetStorage.load()).resolves.toBeNull();
  await AsyncStorage.setItem('petty.pet', '{');
  await expect(asyncPetStorage.load()).resolves.toBeNull();
  await AsyncStorage.setItem('petty.pet', JSON.stringify({ asleep: true }));
  await expect(asyncPetStorage.load()).resolves.toBeNull();
});
