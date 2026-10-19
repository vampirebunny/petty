import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadDraft, saveDraft } from '../session';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: async (key: string) => store.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: async (key: string) => {
        store.delete(key);
      },
    },
  };
});

const base = { seed: 7, species: 'dog' as const, breedId: 'husky', look: null };

it('round-trips the name step, the picked pup and the typed name', async () => {
  await saveDraft({ ...base, step: 'name', archetype: 'thinker', name: 'Maple' });
  expect(await loadDraft()).toEqual({ ...base, step: 'name', archetype: 'thinker', name: 'Maple' });
});

it('loads an older draft without a pup or name', async () => {
  await AsyncStorage.setItem('petty.draft', JSON.stringify({ ...base, step: 'offers' }));
  expect(await loadDraft()).toEqual({ ...base, step: 'offers' });
});

it('drops an invalid archetype', async () => {
  await AsyncStorage.setItem('petty.draft', JSON.stringify({ ...base, step: 'name', archetype: 'wizard', name: 3 }));
  expect(await loadDraft()).toEqual({ ...base, step: 'name' });
});
