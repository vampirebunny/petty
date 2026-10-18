import AsyncStorage from '@react-native-async-storage/async-storage';

import { createPet } from '../../sim/createPet';
import { dayMs } from '../../sim/config';
import { asyncPetStorage } from '../asyncStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('returns the same state after saving and loading', async () => {
  const pet = createPet(3, 'retriever', 0, 50, 'Pup', 'pet');
  await asyncPetStorage.save(pet);
  await expect(asyncPetStorage.load()).resolves.toEqual(pet);
});

it('maps an old weight and keeps a saved age', async () => {
  const pet = createPet(3, 'retriever', 0, 50, 'Pup', 'pet');
  const saved = JSON.parse(JSON.stringify(pet)) as Record<string, unknown>;
  saved.weight = 50;
  saved.ageDays = 10;
  delete saved.weightAppliedAt;
  delete saved.bornAt;
  await AsyncStorage.setItem('petty.pet', JSON.stringify(saved));

  const loaded = await asyncPetStorage.load();
  expect(loaded?.weight).toBe(0);
  expect(loaded?.ageDays).toBe(10);
  expect(loaded?.bornAt).toBe(50 - 10 * dayMs);
  expect(loaded?.sceneId).toBe('livingroom');
});

it('drops a phase 0 pet that is missing the new fields', async () => {
  await AsyncStorage.setItem(
    'petty.pet',
    JSON.stringify({
      needs: { fullness: 80, energy: 70, happiness: 60 },
      asleep: false,
      lastUpdatedAt: 50,
      rngState: 3,
    }),
  );

  await expect(asyncPetStorage.load()).resolves.toBeNull();
});

it('returns null when nothing is stored or the json is unreadable', async () => {
  await expect(asyncPetStorage.load()).resolves.toBeNull();
  await AsyncStorage.setItem('petty.pet', '{');
  await expect(asyncPetStorage.load()).resolves.toBeNull();
  await AsyncStorage.setItem('petty.pet', JSON.stringify({ asleep: true }));
  await expect(asyncPetStorage.load()).resolves.toBeNull();
});
