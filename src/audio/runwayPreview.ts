import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import { localCatwalkUri } from './remoteCatwalkMusic';
import { configurePlayback } from './session';
import { holdMusic, isMusicEnabled } from './music';
import { trackById } from '../runway/catalog';

const volume = 0.22;
const previewSeconds = 10;

let player: AudioPlayer | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let activeId: string | null = null;
let onChange: ((id: string | null) => void) | null = null;

function clearTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function dispose(): void {
  clearTimer();
  try {
    player?.pause();
  } catch {
    // stay silent
  }
  player?.release();
  player = null;
  if (activeId) {
    activeId = null;
    onChange?.(null);
  }
  holdMusic(false);
}

export function previewingTrackId(): string | null {
  return activeId;
}

export function listenPreview(listener: (id: string | null) => void): () => void {
  onChange = listener;
  return () => {
    if (onChange === listener) {
      onChange = null;
    }
  };
}

export function stopRunwayPreview(): void {
  dispose();
}

/** Play ~10 seconds of a downloaded track. Missing file or muted music → no-op. */
export function previewRunwayTrack(trackId: string): void {
  if (activeId === trackId) {
    dispose();
    return;
  }
  dispose();
  if (!isMusicEnabled()) {
    return;
  }
  const track = trackById(trackId);
  const uri = track ? localCatwalkUri(track.fileName) : null;
  if (!uri) {
    return;
  }
  try {
    configurePlayback();
    holdMusic(true);
    const next = createAudioPlayer(uri, { keepAudioSessionActive: true });
    next.loop = false;
    next.volume = volume;
    player = next;
    activeId = trackId;
    onChange?.(trackId);
    next.play();
    timer = setTimeout(() => {
      dispose();
    }, previewSeconds * 1000);
  } catch {
    dispose();
  }
}
