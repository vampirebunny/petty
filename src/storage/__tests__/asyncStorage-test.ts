import AsyncStorage from '@react-native-async-storage/async-storage';

import { testPet } from '../../sim/__fixtures__/pets';
import { dayMs, startingThirst } from '../../sim/config';
import { asyncPetStorage } from '../asyncStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('returns the same state after saving and loading', async () => {
  const pet = testPet(3, 'retriever', 50, 'Pup', 'pet');
  await asyncPetStorage.save(pet);
  await expect(asyncPetStorage.load()).resolves.toEqual(pet);
});

it('forgets the pet after clearing', async () => {
  const pet = testPet(3, 'retriever', 50, 'Pup', 'pet');
  await asyncPetStorage.save(pet);
  await asyncPetStorage.clear();
  await expect(asyncPetStorage.load()).resolves.toBeNull();
  await expect(AsyncStorage.getItem('petty.pet')).resolves.toBeNull();
});

it('maps an old weight and keeps a saved age', async () => {
  const pet = testPet(3, 'retriever', 50, 'Pup', 'pet');
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
      needs: { hunger: 20, energy: 70, happiness: 60 },
      asleep: false,
      lastUpdatedAt: 50,
      rngState: 3,
    }),
  );

  await expect(asyncPetStorage.load()).resolves.toBeNull();
});

it('drops a pet saved with litter variants and temperament, and one with a bad look', async () => {
  const pet = testPet(3, 'retriever', 50, 'Pup', 'pet');
  const old = JSON.parse(JSON.stringify(pet)) as Record<string, unknown>;
  delete old.attributes;
  delete old.look;
  Object.assign(old, {
    seed: 3,
    variant: 1,
    potential: pet.attributes.potential,
    trained: pet.attributes.current,
    temperament: { boosts: 'stamina', dampens: 'agility', label: 'steady pacer' },
  });
  await AsyncStorage.setItem('petty.pet', JSON.stringify(old));
  await expect(asyncPetStorage.load()).resolves.toBeNull();

  const badLook = JSON.parse(JSON.stringify(pet)) as Record<string, unknown>;
  badLook.look = { coat: 3 };
  await AsyncStorage.setItem('petty.pet', JSON.stringify(badLook));
  await expect(asyncPetStorage.load()).resolves.toBeNull();
});

it('keeps stored potential, current, archetype, seed, and look across a save', async () => {
  const pet = testPet(9, 'pug', 50, 'Pup', 'pet', 'charmer');
  await asyncPetStorage.save(pet);
  const loaded = await asyncPetStorage.load();
  expect(loaded?.attributes).toEqual(pet.attributes);
  expect(loaded?.look).toEqual(pet.look);
});

it('returns null when nothing is stored or the json is unreadable', async () => {
  await expect(asyncPetStorage.load()).resolves.toBeNull();
  await AsyncStorage.setItem('petty.pet', '{');
  await expect(asyncPetStorage.load()).resolves.toBeNull();
  await AsyncStorage.setItem('petty.pet', JSON.stringify({ asleep: true }));
  await expect(asyncPetStorage.load()).resolves.toBeNull();
});

it('migrates legacy breed ids and fullness into hunger', async () => {
  const pet = testPet(3, 'scottishFold', 50, 'Kit', 'pet');
  const saved = JSON.parse(JSON.stringify(pet)) as Record<string, unknown>;
  saved.breedId = 'black';
  saved.needs = { fullness: 70, energy: 70, happiness: 60 };
  delete saved.waterLevel;
  delete saved.thirst;
  delete saved.toys;
  await AsyncStorage.setItem('petty.pet', JSON.stringify(saved));

  const loaded = await asyncPetStorage.load();
  expect(loaded?.breedId).toBe('scottishFold');
  expect(loaded?.needs.hunger).toBe(30);
  expect(loaded?.waterLevel).toBe(1);
  expect(loaded?.thirst).toBe(startingThirst);
  expect(loaded?.toys).toEqual(['ball']);
});

it('drops legacy ear and tail choices from a saved look, so the pet takes its breed ears and tail', async () => {
  const pet = testPet(3, 'husky', 50, 'Pup', 'pet');
  const old = JSON.parse(JSON.stringify(pet)) as { look: Record<string, unknown> };
  old.look = { coat: '#ffffff', ear: 'floppy', tail: 'stub' };
  await AsyncStorage.setItem('petty.pet', JSON.stringify(old));
  const loaded = await asyncPetStorage.load();
  expect(loaded?.look).toEqual({ coat: '#ffffff' });
});

it('loads a pet saved without ownerId and round-trips one that has it', async () => {
  const pet = testPet(3, 'retriever', 50, 'Pup', 'pet');
  const legacy = JSON.parse(JSON.stringify(pet)) as Record<string, unknown>;
  delete legacy.ownerId;
  await AsyncStorage.setItem('petty.pet', JSON.stringify(legacy));
  const loadedLegacy = await asyncPetStorage.load();
  expect(loadedLegacy?.ownerId).toBeUndefined();
  expect(loadedLegacy?.id).toBe(pet.id);

  const owned = { ...pet, ownerId: 'guest-abc' };
  await asyncPetStorage.save(owned);
  await expect(asyncPetStorage.load()).resolves.toEqual(owned);
});
