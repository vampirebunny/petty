import * as Network from 'expo-network';

import { catwalkRemoteTracks, localCatwalkUri, syncCatwalkMusic } from '../remoteCatwalkMusic';

const mockSaved = new Map<string, number>();
const mockDownloaded: string[] = [];

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('expo-file-system', () => {
  class Directory {
    exists = false;
    create(): void {
      this.exists = true;
    }
  }
  class File {
    uri: string;
    label: string;
    constructor(_dir: Directory, label: string) {
      this.label = label;
      this.uri = `file:///catwalk-music/${label}`;
    }
    get exists(): boolean {
      return mockSaved.has(this.label);
    }
    get size(): number {
      return mockSaved.get(this.label) ?? 0;
    }
    delete(): void {
      mockSaved.delete(this.label);
    }
    moveSync(dest: File): void {
      mockSaved.set(dest.label, this.size);
      mockSaved.delete(this.label);
    }
    static async downloadFileAsync(_url: string, dest: File): Promise<File> {
      mockDownloaded.push(dest.label);
      mockSaved.set(dest.label, 128);
      return dest;
    }
  }
  return { Directory, File, Paths: { document: 'documents' } };
});

beforeEach(() => {
  mockSaved.clear();
  mockDownloaded.length = 0;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  });
});

it('downloads only missing catwalk tracks and leaves saved ones alone', async () => {
  mockSaved.set(catwalkRemoteTracks[0], 400);
  await syncCatwalkMusic();
  expect(mockDownloaded.some((name) => name.startsWith(catwalkRemoteTracks[0]))).toBe(false);
  expect(mockDownloaded).toHaveLength(catwalkRemoteTracks.length - 1);
  expect(localCatwalkUri(catwalkRemoteTracks[0])).toBe(`file:///catwalk-music/${catwalkRemoteTracks[0]}`);
  expect(localCatwalkUri(catwalkRemoteTracks[1])).toBe(`file:///catwalk-music/${catwalkRemoteTracks[1]}`);
});

it('skips downloads while offline and still reports saved uris', async () => {
  mockSaved.set(catwalkRemoteTracks[2], 400);
  jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({
    isConnected: false,
    isInternetReachable: false,
  });
  await syncCatwalkMusic();
  expect(mockDownloaded).toHaveLength(0);
  expect(localCatwalkUri(catwalkRemoteTracks[2])).toBe(`file:///catwalk-music/${catwalkRemoteTracks[2]}`);
  expect(localCatwalkUri(catwalkRemoteTracks[0])).toBeNull();
});
