import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import { playbackRate, soundEnabled } from './voice';

const clip = require('../../assets/sounds/floraphonic-marimba-bloop-2-188149.mp3');
const poolSize = 10;
const volumes = [1, 0.9, 0.85, 0.8, 0.8];

let players: AudioPlayer[] = [];
let next = 0;
let muted = false;

function arm(player: AudioPlayer): void {
  player.shouldCorrectPitch = false;
  void player.seekTo(0).catch(() => undefined);
  player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) {
      void player.seekTo(0).catch(() => undefined);
    }
  });
}

// Built when the home screen mounts so the first coin does not wait on the decoder.
export function preloadBloops(): void {
  if (players.length > 0) {
    return;
  }
  try {
    void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
    players = Array.from({ length: poolSize }, () => {
      const player = createAudioPlayer(clip);
      arm(player);
      return player;
    });
  } catch {
    players = [];
  }
}

// Coin index picks the volume. The pool cursor is separate, so overlaps keep their own player.
export function playBloop(coinIndex: number): void {
  if (muted || !soundEnabled() || players.length === 0) {
    return;
  }
  try {
    const player = players[next];
    next = (next + 1) % players.length;
    player.pause();
    player.volume = volumes[coinIndex] ?? volumes[volumes.length - 1];
    player.shouldCorrectPitch = false;
    player.setPlaybackRate(playbackRate(1 + (Math.random() * 2 - 1) * 0.03));
    void player.seekTo(0).then(() => player.play());
  } catch {
    // stay silent
  }
}

export function silenceBloops(): void {
  muted = true;
  for (const player of players) {
    try {
      player.pause();
    } catch {
      // already stopped
    }
  }
}

export function unmuteBloops(): void {
  muted = false;
}

export function releaseBloops(): void {
  for (const player of players) {
    try {
      player.release();
    } catch {
      // already released
    }
  }
  players = [];
  next = 0;
  muted = false;
}
