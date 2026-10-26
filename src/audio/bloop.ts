import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import { configurePlayback } from './session';
import { playbackRate, soundEnabled } from './voice';

const clip = require('../../assets/sounds/floraphonic-marimba-bloop-2-188149.mp3');
const poolSize = 10;
const volumes = [1, 0.9, 0.85, 0.8, 0.8];

let players: AudioPlayer[] = [];
let next = 0;
let muted = false;
let silenced = 0;
const tokens: number[] = [];

function stop(player: AudioPlayer): void {
  try {
    player.pause();
  } catch {
    // already stopped
  }
}

function arm(player: AudioPlayer, index: number): void {
  player.loop = false;
  player.shouldCorrectPitch = false;
  player.addListener('playbackStatusUpdate', (status) => {
    if (!status.didJustFinish) {
      return;
    }
    const ended = tokens[index] ?? 0;
    // ExoPlayer leaves playWhenReady set after a clip ends. Seeking to 0 from that
    // state starts the bloop again, so a collected coin keeps chiming. Pause instead.
    queueMicrotask(() => {
      if ((tokens[index] ?? 0) !== ended) {
        return;
      }
      stop(player);
    });
  });
}

// Built when the home screen mounts so the first coin does not wait on the decoder.
export function preloadBloops(): void {
  if (players.length > 0) {
    return;
  }
  try {
    configurePlayback();
    players = Array.from({ length: poolSize }, () => createAudioPlayer(clip));
    players.forEach(arm);
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
    const index = next;
    const player = players[index];
    next = (index + 1) % players.length;
    const mine = (tokens[index] ?? 0) + 1;
    tokens[index] = mine;
    const epoch = silenced;
    stop(player);
    player.loop = false;
    player.volume = volumes[coinIndex] ?? volumes[volumes.length - 1];
    player.shouldCorrectPitch = false;
    player.setPlaybackRate(playbackRate(1 + (Math.random() * 2 - 1) * 0.03));
    void player
      .seekTo(0)
      .catch(() => undefined)
      .then(() => {
        if (tokens[index] !== mine || epoch !== silenced || muted || !soundEnabled()) {
          return;
        }
        try {
          player.play();
        } catch {
          // stay silent
        }
      });
  } catch {
    // stay silent
  }
}

export function silenceBloops(): void {
  muted = true;
  silenced += 1;
  for (const player of players) {
    stop(player);
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
  silenced += 1;
  tokens.length = 0;
}
