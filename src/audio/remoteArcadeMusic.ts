import { Directory, File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';

// Arcade tracks hosted in the public arcade-music bucket. One loop stays bundled in arcadeMusic.ts.
export const arcadeRemoteTracks = [
  'echoes_of_lumen-pixel-art-game-soundtrack-chiptune-588667.mp3',
  'ejah_music-disco-funky-slap-bass-theme-402224.mp3',
  'ejah_music-tense-music-from-game-show-460826.mp3',
  'mfcc-gaming-game-video-game-music-522352.mp3',
  'openmindaudio-cartoon-classic-background-music-bright-journey-short-preview-497390.mp3',
  'openmindaudio-cartoon-epic-cinematic-thriumphal-outro-sunset-signoff-preview-497374.mp3',
  'openmindaudio-cartoon-good-vibes-intro-sunny-spark-497372.mp3',
  'paulyudin-game-game-music-573991.mp3',
  'sergequadrado-big-beat-loop-275479.mp3',
  'serhii_kliets-spaceship-arcade-shooter-game-background-soundtrack-318508.mp3',
];

const bucket = 'arcade-music';

const downloaded: string[] = [];
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

function remember(uri: string): void {
  if (!downloaded.includes(uri)) {
    downloaded.push(uri);
  }
}

export function arcadeDownloaded(): readonly string[] {
  return downloaded;
}

function publishSaved(dir: Directory): void {
  for (const name of arcadeRemoteTracks) {
    const uri = savedUri(dir, name);
    if (uri) {
      remember(uri);
    }
  }
}

async function downloadMissing(): Promise<void> {
  if (downloading) {
    return downloading;
  }
  downloading = (async () => {
    if (!trackUrl(arcadeRemoteTracks[0])) {
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
    for (const name of arcadeRemoteTracks) {
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
          remember(uri);
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
export function syncArcadeMusic(): Promise<void> {
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
