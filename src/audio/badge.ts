import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import { soundEnabled } from './voice';

let badgePlayer: AudioPlayer | null = null;
const popVoices = 4;
const popPool: (AudioPlayer | null)[] = [null, null, null, null];
let popCursor = 0;

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

// One voice per in-flight point add, so a tummy pop and the energy pop after it both play.
export function playPointPop(): void {
  const index = popCursor;
  popCursor = (popCursor + 1) % popVoices;
  playClip(popPool[index] ?? null, () => {
    const player = createAudioPlayer(
      require('../../assets/sounds/vadim_makes_sound-achievement-badge-pop-sound-1-547860.mp3'),
    );
    popPool[index] = player;
    return player;
  });
}

export function releaseBadgeChime(): void {
  badgePlayer?.release();
  badgePlayer = null;
  for (let i = 0; i < popPool.length; i += 1) {
    popPool[i]?.release();
    popPool[i] = null;
  }
  popCursor = 0;
}
