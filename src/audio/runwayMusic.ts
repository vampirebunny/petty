import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import { configurePlayback } from './session';
import { holdMusic, isMusicEnabled } from './music';
import { trackById } from '../runway/catalog';

const volume = 0.18;

let player: AudioPlayer | null = null;
let active = false;
let paused = false;
let suspended = false;
let currentTrackId: string | null = null;

function dispose(): void {
  player?.release();
  player = null;
}

function playLoop(trackId: string): void {
  const track = trackById(trackId);
  if (!track) {
    dispose();
    return;
  }
  try {
    dispose();
    const next = createAudioPlayer(track.asset, { keepAudioSessionActive: true });
    next.loop = true;
    next.volume = volume;
    player = next;
    currentTrackId = trackId;
    if (!paused && !suspended) {
      next.play();
    }
  } catch {
    dispose();
  }
}

export function startRunwayTrack(trackId: string): void {
  active = true;
  paused = false;
  if (!isMusicEnabled()) {
    dispose();
    return;
  }
  configurePlayback();
  holdMusic(true);
  playLoop(trackId);
}

export function pauseRunwayTrack(): void {
  if (!active) {
    return;
  }
  paused = true;
  try {
    player?.pause();
  } catch {
    // stay silent
  }
}

export function resumeRunwayTrack(): void {
  if (!active) {
    return;
  }
  paused = false;
  if (suspended || !isMusicEnabled()) {
    return;
  }
  try {
    player?.play();
  } catch {
    // stay silent
  }
}

export function suspendRunway(off: boolean): void {
  suspended = off;
  try {
    if (off) {
      player?.pause();
    } else if (active && !paused && isMusicEnabled() && currentTrackId) {
      player?.play();
    }
  } catch {
    // stay silent
  }
}

export function stopRunwayTrack(): void {
  if (!active && !player) {
    return;
  }
  active = false;
  paused = false;
  currentTrackId = null;
  dispose();
  holdMusic(false);
}
