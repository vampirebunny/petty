import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import { soundEnabled } from './voice';

let badgePlayer: AudioPlayer | null = null;
let popPlayer: AudioPlayer | null = null;

function playClip(player: AudioPlayer | null, load: () => AudioPlayer): void {
  if (!soundEnabled()) {
    return;
  }
  try {
    const active = player ?? load();
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

// A short rising chime for an earned badge. Respects the pet sounds toggle and stays silent on error.
export function playBadgeChime(): void {
  playClip(badgePlayer, () => {
    badgePlayer = createAudioPlayer(require('../../assets/sounds/badge-earned.wav'));
    return badgePlayer;
  });
}

// The +energy / +tummy burst. Same toggle as the other pet sounds.
export function playPointPop(): void {
  playClip(popPlayer, () => {
    popPlayer = createAudioPlayer(
      require('../../assets/sounds/vadim_makes_sound-achievement-badge-pop-sound-1-547860.mp3'),
    );
    return popPlayer;
  });
}

export function releaseBadgeChime(): void {
  badgePlayer?.release();
  popPlayer?.release();
  badgePlayer = null;
  popPlayer = null;
}
