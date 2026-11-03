import { createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

import { configurePlayback } from './session';
import { soundEnabled } from './voice';

export type AcornSfx = 'laser' | 'impact' | 'explode' | 'powerUp';

type Pool = { players: AudioPlayer[]; next: number; tokens: number[] };

// Voices cover clip length against how often each one fires: a 0.37 s laser every 0.14 s, a 1.8 s impact on
// rapid hits, a 1.3 s explode, and a rare 4 s power-up. A full pool restarts its oldest voice.
const specs: Record<AcornSfx, { clip: number; voices: number; volume: number }> = {
  laser: { clip: require('../../assets/sounds/freesound_community-laser-104024.mp3'), voices: 4, volume: 0.32 },
  impact: { clip: require('../../assets/sounds/universfield-cartoon-impact-02-278820.mp3'), voices: 6, volume: 0.7 },
  explode: { clip: require('../../assets/sounds/freesound_gamestudio-explode-408427.mp3'), voices: 3, volume: 0.85 },
  powerUp: { clip: require('../../assets/sounds/freesound_community-power_up_grab-88510.mp3'), voices: 2, volume: 0.8 },
};

const pools: Partial<Record<AcornSfx, Pool>> = {};

function stop(player: AudioPlayer): void {
  try {
    player.pause();
  } catch {
    // already stopped
  }
}

function build(name: AcornSfx): Pool | null {
  const existing = pools[name];
  if (existing) {
    return existing;
  }
  const spec = specs[name];
  try {
    configurePlayback();
    const pool: Pool = { players: [], next: 0, tokens: [] };
    for (let index = 0; index < spec.voices; index += 1) {
      const player = createAudioPlayer(spec.clip);
      player.loop = false;
      player.volume = spec.volume;
      // ExoPlayer keeps playWhenReady after a clip ends, so a later seek would replay it. Pause on finish.
      player.addListener?.('playbackStatusUpdate', (status) => {
        if (!status.didJustFinish) {
          return;
        }
        const ended = pool.tokens[index] ?? 0;
        queueMicrotask(() => {
          if ((pool.tokens[index] ?? 0) === ended) {
            stop(player);
          }
        });
      });
      pool.players.push(player);
    }
    pools[name] = pool;
    return pool;
  } catch {
    return null;
  }
}

// Built when the game mounts so the first laser does not wait on the decoder.
export function preloadAcornSfx(): void {
  for (const name of Object.keys(specs) as AcornSfx[]) {
    build(name);
  }
}

export function playAcornSfx(name: AcornSfx): void {
  if (!soundEnabled()) {
    return;
  }
  const pool = build(name);
  if (!pool || pool.players.length === 0) {
    return;
  }
  try {
    const index = pool.next;
    const player = pool.players[index];
    pool.next = (index + 1) % pool.players.length;
    const mine = (pool.tokens[index] ?? 0) + 1;
    pool.tokens[index] = mine;
    stop(player);
    void player
      .seekTo(0)
      .catch(() => undefined)
      .then(() => {
        if (pool.tokens[index] !== mine || !soundEnabled()) {
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

export function releaseAcornSfx(): void {
  for (const name of Object.keys(pools) as AcornSfx[]) {
    const pool = pools[name];
    if (!pool) {
      continue;
    }
    for (const player of pool.players) {
      try {
        player.release();
      } catch {
        // already released
      }
    }
    delete pools[name];
  }
}
