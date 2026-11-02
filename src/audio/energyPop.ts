import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import { configurePlayback } from './session';
import { playbackRate, soundEnabled } from './voice';

// Placeholder until the final Second Wind clip is added. Not the paw-coin sound.
const clip = require('../../assets/sounds/floraphonic-marimba-bloop-2-188149.mp3');

let player: AudioPlayer | null = null;

export function playEnergyPop(): void {
  if (!soundEnabled()) {
    return;
  }
  try {
    configurePlayback();
    if (!player) {
      player = createAudioPlayer(clip);
      player.loop = false;
      player.shouldCorrectPitch = false;
    }
    player.pause();
    player.volume = 0.8;
    player.setPlaybackRate(playbackRate(1));
    void player
      .seekTo(0)
      .catch(() => undefined)
      .then(() => {
        if (!soundEnabled() || !player) {
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
