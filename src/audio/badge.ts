import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import { soundEnabled } from './voice';

let player: AudioPlayer | null = null;

// A short rising chime for an earned badge. Respects the pet sounds toggle and stays silent on error.
export function playBadgeChime(): void {
  if (!soundEnabled()) {
    return;
  }
  try {
    if (!player) {
      player = createAudioPlayer(require('../../assets/sounds/badge-earned.wav'));
    }
    const active = player;
    void active
      .seekTo(0)
      .catch(() => undefined)
      .then(() => {
        active.play();
      });
  } catch {
    // stay silent
  }
}

export function releaseBadgeChime(): void {
  player?.release();
  player = null;
}
