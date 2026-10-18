import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadAttestation, loadDraft, saveAttestation, saveDraft } from '../session';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('keeps a blocked attestation across a reload and stores no pet with it', async () => {
  await saveAttestation('blocked');
  await expect(loadAttestation()).resolves.toBe('blocked');
  await expect(AsyncStorage.getItem('petty.pet')).resolves.toBeNull();
});

it('returns the same draft seed and breed', async () => {
  await saveDraft({ seed: 42, breedId: 'husky' });
  await expect(loadDraft()).resolves.toEqual({ seed: 42, breedId: 'husky' });
  await saveAttestation('passed');
  await expect(loadAttestation()).resolves.toBe('passed');
});
