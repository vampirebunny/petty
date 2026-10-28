import * as Network from 'expo-network';

import { remoteTracks, syncRemoteMusic } from '../remoteMusic';

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
      this.uri = `file:///music/${label}`;
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

it('plays tracks already saved and downloads only the missing ones', async () => {
  mockSaved.set(remoteTracks[0], 400);
  const ready: string[] = [];
  await syncRemoteMusic((uri) => ready.push(uri));
  expect(ready[0]).toBe(`file:///music/${remoteTracks[0]}`);
  expect(mockDownloaded.some((name) => name.startsWith(remoteTracks[0]))).toBe(false);
  expect(mockDownloaded).toHaveLength(remoteTracks.length - 1);
  expect(ready).toHaveLength(remoteTracks.length);
});

it('keeps saved tracks and skips the download while offline', async () => {
  mockSaved.set(remoteTracks[1], 400);
  jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({
    isConnected: false,
    isInternetReachable: false,
  });
  const ready: string[] = [];
  await syncRemoteMusic((uri) => ready.push(uri));
  expect(ready).toEqual([`file:///music/${remoteTracks[1]}`]);
  expect(mockDownloaded).toHaveLength(0);
});
