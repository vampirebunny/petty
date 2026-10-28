import * as Network from 'expo-network';

import { remoteTracks, syncRemoteMusic } from '../remoteMusic';

const saved = new Map<string, number>();
const downloaded: string[] = [];

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
    constructor(_dir: Directory, public name: string) {
      this.uri = `file:///music/${name}`;
    }
    get exists(): boolean {
      return saved.has(this.name);
    }
    get size(): number {
      return saved.get(this.name) ?? 0;
    }
    delete(): void {
      saved.delete(this.name);
    }
    moveSync(dest: File): void {
      saved.set(dest.name, this.size);
      saved.delete(this.name);
    }
    static async downloadFileAsync(_url: string, dest: File): Promise<File> {
      downloaded.push(dest.name);
      saved.set(dest.name, 128);
      return dest;
    }
  }
  return { Directory, File, Paths: { document: 'documents' } };
});

beforeEach(() => {
  saved.clear();
  downloaded.length = 0;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  });
});

it('plays tracks already saved and downloads only the missing ones', async () => {
  saved.set(remoteTracks[0], 400);
  const ready: string[] = [];
  await syncRemoteMusic((uri) => ready.push(uri));
  expect(ready[0]).toBe(`file:///music/${remoteTracks[0]}`);
  expect(downloaded.some((name) => name.startsWith(remoteTracks[0]))).toBe(false);
  expect(downloaded).toHaveLength(remoteTracks.length - 1);
  expect(ready).toHaveLength(remoteTracks.length);
});

it('keeps saved tracks and skips the download while offline', async () => {
  saved.set(remoteTracks[1], 400);
  jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({
    isConnected: false,
    isInternetReachable: false,
  });
  const ready: string[] = [];
  await syncRemoteMusic((uri) => ready.push(uri));
  expect(ready).toEqual([`file:///music/${remoteTracks[1]}`]);
  expect(downloaded).toHaveLength(0);
});
