import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import { configurePlayback } from './session';
import { soundEnabled } from './voice';

// One second of applause with the fade-out baked into the file.
const clip = require('../../assets/sounds/vvqne-applause-383901.mp3');

const volume = 0.6;

let player: AudioPlayer | null = null;

/** End-of-show applause. */
export function playRunwayApplause(): void {
  if (!soundEnabled()) {
    return;
  }
  try {
    configurePlayback();
    if (!player) {
      player = createAudioPlayer(clip);
      player.loop = false;
    }
    const next = player;
    next.pause();
    next.volume = volume;
    void next
      .seekTo(0)
      .catch(() => undefined)
      .then(() => {
        try {
          next.play();
        } catch {
          // stay silent
        }
      });
  } catch {
    // stay silent
  }
}

export function releaseRunwayApplause(): void {
  try {
    player?.release();
  } catch {
    // already released
  }
  player = null;
}
