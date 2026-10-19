import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import type { SoundEvent } from '../actor';

// A sound without a clip here stays silent. Cuddle's placeholder ids (cuddle_sneeze, cuddle_purr_loop,
// cuddle_content_sigh, cuddle_whimper_happy, cuddle_shake_off, cuddle_swat, cuddle_flinch_chirp,
// cuddle_kneading_loop) wait for a recorded clip: add `require('../../assets/sounds/<file>.mp3')` under its id.
const clips: Partial<Record<SoundEvent['sound'], number>> = {
  bark: require('../../assets/sounds/yodguard-friendly-big-dog-bark-2-535469.mp3'),
  meow: require('../../assets/sounds/sound_garage-cat-meow-8-fx-306184.mp3'),
};

// Two players per clip so the second bark of a pair can start while the first is still ringing.
const voices = 2;
const pools: Partial<Record<SoundEvent['sound'], { players: AudioPlayer[]; next: number }>> = {};
let enabled = true;
let ready = false;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
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
    void player
      .seekTo(0)
      .catch(() => undefined)
      .then(() => {
        player.play();
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
