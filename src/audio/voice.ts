import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import type { SoundEvent } from '../actor';

const clips = {
  bark: require('../../assets/sounds/bark.wav'),
  meow: require('../../assets/sounds/meow.wav'),
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
  let pool = pools[sound];
  if (!pool) {
    pool = { players: Array.from({ length: voices }, () => createAudioPlayer(clips[sound])), next: 0 };
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
    const player = pool.players[pool.next];
    pool.next = (pool.next + 1) % pool.players.length;
    player.shouldCorrectPitch = false;
    player.setPlaybackRate(playbackRate(event.rate));
    void player.seekTo(0);
    player.play();
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
