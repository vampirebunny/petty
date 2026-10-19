import * as SecureStore from 'expo-secure-store';

import {
  getOrCreateInstallId,
  resetIdentityCache,
  resolveOwnerId,
} from '../identity';

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

const mockGetSession = jest.fn();
const mockSignInAnonymously = jest.fn();

jest.mock('../supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
    },
  }),
}));

beforeEach(() => {
  memory.clear();
  resetIdentityCache();
  mockGetSession.mockReset();
  mockSignInAnonymously.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: null } });
});

it('creates and persists an install id', async () => {
  const first = await getOrCreateInstallId();
  expect(first).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(memory.get('boop.installId')).toBe(first);

  resetIdentityCache();
  const second = await getOrCreateInstallId();
  expect(second).toBe(first);
});

it('resolveOwnerId uses the install id when there is no session', async () => {
  const ownerId = await resolveOwnerId();
  const installId = await getOrCreateInstallId();
  expect(ownerId).toBe(installId);
  expect(mockSignInAnonymously).not.toHaveBeenCalled();
});

it('resolveOwnerId prefers the session user id over the install id', async () => {
  await getOrCreateInstallId();
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: 'auth-user-1' } } },
  });
  resetIdentityCache();
  await getOrCreateInstallId();

  await expect(resolveOwnerId()).resolves.toBe('auth-user-1');
  expect(mockSignInAnonymously).not.toHaveBeenCalled();
});
