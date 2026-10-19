import * as SecureStore from 'expo-secure-store';

import { loadAgeRecord, saveAgeRecord } from '../storage';

jest.mock('expo-secure-store', () => {
  const mockMemory = new Map<string, string>();
  return {
    getItemAsync: async (key: string) => mockMemory.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      mockMemory.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      mockMemory.delete(key);
    },
    isAvailableAsync: async () => true,
    __memory: mockMemory,
  };
});

const memory = (SecureStore as unknown as { __memory: Map<string, string> }).__memory;

beforeEach(() => {
  memory.clear();
});

it('round-trips an age record and treats a bad read as no record', async () => {
  expect(await loadAgeRecord()).toBeNull();
  await saveAgeRecord({ status: 'teen', source: 'google', updatedAt: 4, confirmed: false });
  await expect(loadAgeRecord()).resolves.toEqual({
    status: 'teen',
    source: 'google',
    updatedAt: 4,
    confirmed: false,
  });

  memory.set('boop.ageRecord', '{');
  await expect(loadAgeRecord()).resolves.toBeNull();
});
