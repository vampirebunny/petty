import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import { configurePlayback } from './session';
import { holdMusic, isMusicEnabled, pickNext } from './music';

// Metro needs static requires, so the track list is explicit.
const tracks: number[] = [
  require('../../assets/arcade-music/ejah_music-disco-funky-slap-bass-theme-402224.mp3'),
  require('../../assets/arcade-music/ejah_music-tense-music-from-game-show-460826.mp3'),
  require('../../assets/arcade-music/openmindaudio-cartoon-classic-background-music-bright-journey-short-preview-497390.mp3'),
  require('../../assets/arcade-music/openmindaudio-cartoon-epic-cinematic-thriumphal-outro-sunset-signoff-preview-497374.mp3'),
  require('../../assets/arcade-music/openmindaudio-cartoon-good-vibes-intro-sunny-spark-497372.mp3'),
  require('../../assets/arcade-music/sergequadrado-big-beat-loop-275479.mp3'),
  require('../../assets/arcade-music/xtremefreddy-game-music-loop-3-144252.mp3'),
];

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

// One looped track for this run. A later call picks a different track.
export function startArcadeRound(): void {
  active = true;
  paused = false;
  if (!isMusicEnabled()) {
    dispose();
    return;
  }
  configurePlayback();
  holdMusic(true);
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
  holdMusic(false);
}
