import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  loadDraft,
  loadHasSeenSilentModeHint,
  loadSoundEnabled,
  saveDraft,
  saveHasSeenSilentModeHint,
  saveSoundEnabled,
} from '../session';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('returns the same draft seed, species, breed, look, and step', async () => {
  const draft = {
    seed: 42,
    species: 'dog' as const,
    breedId: 'husky',
    look: { coat: '#8a97a6' },
    step: 'offers' as const,
  };
  await saveDraft(draft);
  await expect(loadDraft()).resolves.toEqual(draft);
});

it('keeps a seed saved at the first step and ignores a draft in the old shape', async () => {
  await saveDraft({ seed: 7, species: 'cat', breedId: null, look: null, step: 'design' });
  await expect(loadDraft()).resolves.toEqual({ seed: 7, species: 'cat', breedId: null, look: null, step: 'design' });

  await AsyncStorage.setItem('petty.draft', JSON.stringify({ seed: 42, breedId: 'husky' }));
  await expect(loadDraft()).resolves.toBeNull();
});

it('folds a legacy species, breed, or look step into design', async () => {
  await AsyncStorage.setItem(
    'petty.draft',
    JSON.stringify({ seed: 3, species: 'dog', breedId: 'corgi', look: null, step: 'breed' }),
  );
  await expect(loadDraft()).resolves.toEqual({
    seed: 3,
    species: 'dog',
    breedId: 'corgi',
    look: null,
    step: 'design',
  });
});

it('migrates legacy cat breed ids in a draft', async () => {
  await AsyncStorage.setItem(
    'petty.draft',
    JSON.stringify({ seed: 9, species: 'cat', breedId: 'tabby', look: null, step: 'design' }),
  );
  await expect(loadDraft()).resolves.toEqual({
    seed: 9,
    species: 'cat',
    breedId: 'domesticShorthair',
    look: null,
    step: 'design',
  });
});

it('remembers the silent-mode hint only after it is dismissed', async () => {
  await expect(loadHasSeenSilentModeHint()).resolves.toBe(false);
  await saveHasSeenSilentModeHint();
  await expect(loadHasSeenSilentModeHint()).resolves.toBe(true);
});

it('keeps the sound setting, on by default', async () => {
  await expect(loadSoundEnabled()).resolves.toBe(true);
  await saveSoundEnabled(false);
  await expect(loadSoundEnabled()).resolves.toBe(false);
  await saveSoundEnabled(true);
  await expect(loadSoundEnabled()).resolves.toBe(true);
});
