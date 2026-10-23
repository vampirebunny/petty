import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import type { SoundEvent } from '../actor';

// A sound without a clip here stays silent.
const clips: Partial<Record<SoundEvent['sound'], number>> = {
  bark: require('../../assets/sounds/yodguard-friendly-big-dog-bark-2-535469.mp3'),
  meow: require('../../assets/sounds/sound_garage-cat-meow-8-fx-306184.mp3'),
  cuddle_purr: require('../../assets/sounds/universfield-purring-cat-156459.mp3'),
  cuddle_happy: require('../../assets/sounds/yodguard-friendly-small-dog-bark-1-535470.mp3'),
  // Short cut of the 9 s pant: about 2.2 s with a fade-out. Keep the full file for later idle use.
  cuddle_pant: require('../../assets/sounds/fnx_sound-animated-dog-panting-287307-short.mp3'),
  growl: require('../../assets/sounds/freesound_community-dog-growl-61002-short.mp3'),
  sneeze: require('../../assets/sounds/dragon-studio-sneeze-390286-short.mp3'),
  sneeze_cat: require('../../assets/sounds/arunangshubanerjee-sick-cat-sneezing-realistic-pet-sound-332672-short.mp3'),
  trill: require('../../assets/sounds/arunangshubanerjee-excited-cat-meowing-anticipating-food-331462-short.mp3'),
  bell: require('../../assets/sounds/bell-jingle.wav'),
};

// Two players per clip so the second bark of a pair can start while the first is still ringing.
const voices = 2;
const pools: Partial<Record<SoundEvent['sound'], { players: AudioPlayer[]; next: number }>> = {};
let enabled = true;
let ready = false;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

export function soundEnabled(): boolean {
  return enabled;
}

export function playbackRate(rate: number): number {
  return Math.min(2, Math.max(0.5, rate));
}

function poolFor(sound: SoundEvent['sound']) {
  const clip = clips[sound];
  if (clip == null) {
    return null;
  }
  let pool = pools[sound];
  if (!pool) {
    pool = { players: Array.from({ length: voices }, () => createAudioPlayer(clip)), next: 0 };
    pools[sound] = pool;
  }
  return pool;
}

// Plays the recorded clip. The rate carries breed and age pitch, with pitch correction off.
// A missing clip or an audio error leaves the action silent.
export function playVoice(event: SoundEvent): void {
  if (!enabled) {
    return;
  }
  try {
    if (!ready) {
      ready = true;
      void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
    }
    const pool = poolFor(event.sound);
    if (!pool) {
      return;
    }
    const player = pool.players[pool.next];
    pool.next = (pool.next + 1) % pool.players.length;
    const rate = playbackRate(event.rate);
    player.pause();
    player.shouldCorrectPitch = false;
    player.setPlaybackRate(rate);
    // A finished clip sits at its end, so wait for the rewind before playing or the repeat is dropped.
    // play() runs after the rewind, so a session that is not active yet (common right after
    // the app returns) must be caught here. The try above has already finished.
    void player
      .seekTo(0)
      .catch(() => undefined)
      .then(() => {
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

export function releaseVoices(): void {
  for (const key of Object.keys(pools) as SoundEvent['sound'][]) {
    pools[key]?.players.forEach((player) => player.release());
    delete pools[key];
  }
  ready = false;
}
