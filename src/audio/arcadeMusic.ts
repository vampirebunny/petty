import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import { arcadeDownloaded } from './remoteArcadeMusic';
import { configurePlayback } from './session';
import { holdMusic, isMusicEnabled, pickNext } from './music';

type Track = number | string;

// The one loop that plays with no connection. The rest join once they are on disk.
const bundled: Track[] = [require('../../assets/arcade-music/xtremefreddy-game-music-loop-3-144252.mp3')];

function playlist(): Track[] {
  const extra = arcadeDownloaded();
  return extra.length === 0 ? bundled : bundled.concat(extra);
}

const volume = 0.15;

let player: AudioPlayer | null = null;
let last = -1;
let active = false;
let paused = false;
let suspended = false;

function dispose(): void {
  player?.release();
  player = null;
}

function playLoop(): void {
  try {
    dispose();
    const tracks = playlist();
    last = pickNext(tracks.length, last);
    const next = createAudioPlayer(tracks[last], { keepAudioSessionActive: true });
    next.loop = true;
    next.volume = volume;
    player = next;
    if (!paused && !suspended) {
      next.play();
    }
  } catch {
    // stay silent
  }
}

/** True while a mini-game run is in progress and not paused. */
export function arcadeRoundRunning(): boolean {
  return active && !paused;
}

// One looped track for this run. A later call picks a different track.
export function startArcadeRound(): void {
  active = true;
  paused = false;
  if (!isMusicEnabled()) {
    dispose();
    return;
  }
  configurePlayback();
  holdMusic(true, 'arcade');
  playLoop();
}

export function pauseArcadeRound(): void {
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

export function resumeArcadeRound(): void {
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

// Pauses with the app and resumes the same track if the round is still going.
export function suspendArcade(off: boolean): void {
  suspended = off;
  try {
    if (off) {
      player?.pause();
    } else if (active && !paused && isMusicEnabled()) {
      player?.play();
    }
  } catch {
    // stay silent
  }
}

export function stopArcadeRound(): void {
  if (!active && !player) {
    return;
  }
  active = false;
  paused = false;
  dispose();
  holdMusic(false, 'arcade');
}
