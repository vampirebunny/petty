import { loadFriends } from '../api';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
}));

const mockGetSession = jest.fn();
const mockRpc = jest.fn();

jest.mock('../../compliance/supabase', () => ({
  getSupabase: () => ({
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

jest.mock('../../analytics/analytics', () => ({
  bucketFriends: () => '0',
  setProp: () => undefined,
  track: () => undefined,
}));

beforeEach(() => {
  mockGetSession.mockReset();
  mockRpc.mockReset();
});

it('skips friend RPCs when there is no session', async () => {
  mockGetSession.mockResolvedValue({ data: { session: null } });

  const bundle = await loadFriends();

  expect(mockRpc).not.toHaveBeenCalled();
  expect(bundle.offline).toBe(false);
  expect(bundle.error).toBe('account_required');
});

it('calls friend RPCs once a session exists', async () => {
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
  mockRpc.mockResolvedValue({ data: { ok: true, rows: [] }, error: null });

  const bundle = await loadFriends();

  expect(mockRpc).toHaveBeenCalledWith('list_incoming_requests', undefined);
  expect(bundle.offline).toBe(false);
  expect(bundle.error).toBeNull();
});
