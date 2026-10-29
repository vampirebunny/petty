import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import { configurePlayback } from './session';
import { soundEnabled } from './voice';

const clip = require('../../assets/sounds/transcendedlifting-race-start-beeps-125125.mp3');

let player: AudioPlayer | null = null;

function ensure(): AudioPlayer | null {
  try {
    configurePlayback();
    if (!player) {
      player = createAudioPlayer(clip);
      player.loop = false;
    }
    return player;
  } catch {
    return null;
  }
}

export function preloadRaceStart(): void {
  ensure();
}

// offsetSec is how far into the countdown the screen already is, so a late open still hits 3, 2, 1, Go.
export function playRaceStart(offsetSec: number): void {
  if (!soundEnabled()) {
    return;
  }
  const active = ensure();
  if (!active) {
    return;
  }
  const at = Math.max(0, offsetSec);
  try {
    active.volume = 1;
    active.loop = false;
    void active
      .seekTo(at)
      .catch(() => undefined)
      .then(() => {
        if (!soundEnabled()) {
          return;
        }
        try {
          active.play();
        } catch {
          // stay silent
        }
      });
  } catch {
    // stay silent
  }
}

export function stopRaceStart(): void {
  try {
    player?.pause();
  } catch {
    // already stopped
  }
}
