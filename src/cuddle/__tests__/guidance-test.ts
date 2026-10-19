import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  coachClosing,
  coachSteps,
  ghostEligible,
  helpItems,
  loadCoachSeen,
  loadCuddleSessions,
  saveCoachSeen,
  startCuddleSession,
} from '../guidance';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('shows the coach marks until they have been seen once', async () => {
  await expect(loadCoachSeen()).resolves.toBe(false);
  await saveCoachSeen();
  await expect(loadCoachSeen()).resolves.toBe(true);
});

it('puts the pet name into the coach steps', () => {
  expect(coachSteps('Biscuit')).toEqual([
    "Stroke Biscuit's back or head with your finger.",
    'Tap the nose for a boop!',
    'Keep going and Biscuit might roll over for a belly rub.',
  ]);
  expect(coachClosing).toBe("Tap Cuddle again when you're done.");
});

it('counts sessions and offers the ghost finger for the first three only', async () => {
  await expect(loadCuddleSessions()).resolves.toBe(0);
  const numbers = [];
  for (let i = 0; i < 4; i += 1) {
    numbers.push(await startCuddleSession());
  }
  expect(numbers).toEqual([1, 2, 3, 4]);
  expect(numbers.map(ghostEligible)).toEqual([true, true, true, false]);
  expect(ghostEligible(0)).toBe(false);
});

it('keeps the help copy in step with the brief', () => {
  expect(helpItems.map((item) => item.title)).toEqual([
    'Stroke',
    'Scratch',
    'Boop',
    'Belly rub',
    'Every pet is different',
    'Done?',
  ]);
});
