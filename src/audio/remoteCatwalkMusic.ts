import { Directory, File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';

import { runwayTracks } from '../runway/catalog';

// Filenames match `runway_tracks.audio_path`. One track is also bundled for offline shows.
export const bundledRunwayFile = 'bearstockmusic-fashion-runway-586679.mp3';
const bundledRunway: number = require('../../assets/runway-music/bearstockmusic-fashion-runway-586679.mp3');

export const catwalkRemoteTracks = runwayTracks.map((track) => track.fileName);

// The downloaded file when it is on disk, the bundled Fashion Runway clip for that one track, or null.
export function runwayClip(fileName: string): number | string | null {
  const local = localCatwalkUri(fileName);
  if (local) {
    return local;
  }
  if (fileName === bundledRunwayFile) {
    return bundledRunway;
  }
  return null;
}

// A show always has music: a missing chosen track loops the bundled Fashion Runway clip.
export function runwayClipOrFallback(fileName: string): number | string {
  return runwayClip(fileName) ?? bundledRunway;
}

const bucket = 'catwalk-music';

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

export function localCatwalkUri(fileName: string): string | null {
  try {
    const file = new File(folder(), fileName);
    if (!file.exists || file.size <= 0) {
      return null;
    }
    return file.uri;
  } catch {
    return null;
  }
}

async function downloadMissing(): Promise<void> {
  if (downloading) {
    return downloading;
  }
  downloading = (async () => {
    if (!trackUrl(catwalkRemoteTracks[0])) {
      return;
    }
    let dir: Directory;
    try {
      dir = folder();
    } catch {
      return;
    }
    try {
      const net = await Network.getNetworkStateAsync();
      if (!net.isConnected || net.isInternetReachable === false) {
        return;
      }
    } catch {
      return;
    }
    for (const name of catwalkRemoteTracks) {
      const existing = new File(dir, name);
      if (existing.exists && existing.size > 0) {
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

// Downloads any runway track not yet on disk. Skips files that already exist (no content hash).
export function syncCatwalkMusic(): Promise<void> {
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
