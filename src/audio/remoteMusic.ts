import { Directory, File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';

// Scene tracks hosted in the public background-music bucket. Bundled tracks stay in music.ts.
export const remoteTracks = [
  'good_b_music-perfect-beauty-191271.mp3',
  'denys_brodovskyi-ethereal-vistas-191254.mp3',
  'ilyatruhanov-for-p-453681.mp3',
  'twisterium-beautiful-uplifting-music-618490.mp3',
  'syouki_takahashi-midnight-forest-184304.mp3',
  'soulprodmusic-movement-200697.mp3',
  'mickeyscat-moment-of-peace-mickeyscat-554494.mp3',
  'ikoliks_aj-background-music-320427.mp3',
  'andriig-happy-happy-guitar-music-618748.mp3',
  '34910776-for-her-chill-upbeat-summel-travel-vlog-and-ig-music-royalty-free-use-202298.mp3',
  'alexgrohl-no-copyright-music-bounce-on-it-184234.mp3',
  'lexin_music-science-documentary-169621.mp3',
  'kornevmusic-upbeat-happy-corporate-487426.mp3',
  'gr0za-happy-happy-music-569345.mp3',
  'paulyudin-happy-happy-music-477929.mp3',
  'alexgrohl-sad-soul-hip-hop-185750.mp3',
  'atlasaudio-background-happy-562628.mp3',
  'tatamusic-happy-happy-music-595647.mp3',
  'sigmamusicart-happy-happy-kids-music-537737.mp3',
  'the_mountain-happy-happy-music-496549.mp3',
];

const bucket = 'background-music';

let onCached: ((uri: string) => void) | null = null;
let downloading: Promise<void> | null = null;
let listening = false;

function trackUrl(name: string): string | null {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!base) {
    return null;
  }
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${encodeURIComponent(name)}`;
}

function folder(): Directory {
  const dir = new Directory(Paths.document, bucket);
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

function savedUri(dir: Directory, name: string): string | null {
  const file = new File(dir, name);
  if (!file.exists || file.size <= 0) {
    return null;
  }
  return file.uri;
}

function publishSaved(dir: Directory): void {
  for (const name of remoteTracks) {
    const uri = savedUri(dir, name);
    if (uri) {
      onCached?.(uri);
    }
  }
}

async function downloadMissing(): Promise<void> {
  if (downloading) {
    return downloading;
  }
  downloading = (async () => {
    const baseReady = trackUrl(remoteTracks[0]);
    if (!baseReady) {
      return;
    }
    let dir: Directory;
    try {
      dir = folder();
    } catch {
      return;
    }
    publishSaved(dir);
    try {
      const net = await Network.getNetworkStateAsync();
      if (!net.isConnected || net.isInternetReachable === false) {
        return;
      }
    } catch {
      return;
    }
    for (const name of remoteTracks) {
      if (savedUri(dir, name)) {
        continue;
      }
      const url = trackUrl(name);
      if (!url) {
        return;
      }
      const partial = new File(dir, `${name}.part`);
      const final = new File(dir, name);
      try {
        await File.downloadFileAsync(url, partial, { idempotent: true });
        if (partial.size <= 0) {
          partial.delete();
          continue;
        }
        partial.moveSync(final, { overwrite: true });
        const uri = savedUri(dir, name);
        if (uri) {
          onCached?.(uri);
        }
      } catch {
        try {
          if (partial.exists) {
            partial.delete();
          }
        } catch {
          // leave the next launch to retry
        }
      }
    }
  })().finally(() => {
    downloading = null;
  });
  return downloading;
}

// Reports tracks already on disk, then downloads the rest on any connection.
export function syncRemoteMusic(ready: (uri: string) => void): Promise<void> {
  onCached = ready;
  if (!listening) {
    listening = true;
    try {
      Network.addNetworkStateListener((state) => {
        if (state.isConnected && state.isInternetReachable !== false) {
          void downloadMissing();
        }
      });
    } catch {
      // still try the one-shot download below
    }
  }
  return downloadMissing();
}
