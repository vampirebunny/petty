import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import { configurePlayback } from './session';
import { playbackRate, soundEnabled } from './voice';

// No dedicated thud clip yet: the clip sound is the marimba bloop slowed down and quiet.
const clips = {
  boing: require('../../assets/sounds/freesound_community-squeeze-toy-104733.mp3'),
  chime: require('../../assets/sounds/floraphonic-marimba-bloop-2-188149.mp3'),
} as const;

type Clip = keyof typeof clips;

const players = new Map<Clip, AudioPlayer>();

function playerFor(name: Clip): AudioPlayer | null {
  try {
    configurePlayback();
    let player = players.get(name);
    if (!player) {
      player = createAudioPlayer(clips[name]);
      player.loop = false;
      player.shouldCorrectPitch = false;
      players.set(name, player);
    }
    return player;
  } catch {
    return null;
  }
}

function play(name: Clip, rate: number, volume: number): void {
  if (!soundEnabled()) return;
  const player = playerFor(name);
  if (!player) return;
  try {
    player.pause();
    player.volume = volume;
    player.setPlaybackRate(playbackRate(rate));
    void player
      .seekTo(0)
      .catch(() => undefined)
      .then(() => {
        if (!soundEnabled()) return;
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

export function preloadRaceSfx(): void {
  playerFor('boing');
  playerFor('chime');
}

export function playJumpBoing(): void {
  play('boing', 1.15, 0.7);
}

export function playClearChime(perfect: boolean): void {
  play('chime', perfect ? 1.5 : 1.1, 0.9);
}

export function playClipThud(): void {
  play('chime', 0.5, 0.45);
}

export function releaseRaceSfx(): void {
  for (const player of players.values()) {
    try {
      player.release();
    } catch {
      // already released
    }
  }
  players.clear();
}
