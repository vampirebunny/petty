import type { SoundEvent } from '../actor/types';
import type { Beat, PetSnapshot } from './types';
import type { VoiceCue } from './voice';

export type SfxShot = {
  actor: 'A' | 'B';
  speak: boolean;
  sound: SoundEvent['sound'];
  rateScale: number;
  jaw: boolean;
  skipIfBarking: boolean;
};

type Clip = {
  speak?: boolean;
  sound: SoundEvent['sound'];
  rateScale: number;
  jaw: boolean;
  skipIfBarking: boolean;
  once: boolean;
};

type Row = Clip | { dog: Clip; cat: Clip };

const clip = (sound: SoundEvent['sound'], extra: Partial<Clip> = {}): Clip => ({
  sound,
  rateScale: 1,
  jaw: false,
  skipIfBarking: false,
  once: false,
  ...extra,
});

const speak: Clip = { speak: true, sound: 'bark', rateScale: 1, jaw: false, skipIfBarking: true, once: false };

// One row per beat.sfx name. A name with no clip resolves to silence.
const table: Record<string, Row | null> = {
  bark: speak,
  meow: speak,
  yip: clip('bark', { rateScale: 1.25, jaw: true, skipIfBarking: true }),
  purr: clip('cuddle_purr'),
  happy: clip('cuddle_happy', { jaw: true }),
  pant: clip('cuddle_pant', { jaw: true }),
  sneeze: { dog: clip('sneeze', { jaw: true }), cat: clip('sneeze_cat', { jaw: true }) },
  growl: clip('growl', { jaw: true, once: true }),
  trill: clip('trill', { jaw: true }),
  rest: { dog: clip('cuddle_pant', { jaw: true }), cat: clip('cuddle_purr') },
  squeak: null,
  boing: null,
  whoosh: null,
};

function rowFor(name: string, species: 'dog' | 'cat'): Clip | null {
  const row = table[name];
  if (row == null) {
    return null;
  }
  if ('dog' in row) {
    return species === 'cat' ? row.cat : row.dog;
  }
  return row;
}

export function resolveSfx(name: string, species: 'dog' | 'cat'): Clip | null {
  if (!(name in table)) {
    return null;
  }
  return rowFor(name, species);
}

export function sfxShots(beat: Beat, speciesOf: (actor: 'A' | 'B') => 'dog' | 'cat'): SfxShot[] {
  if (beat.sfx == null) {
    return [];
  }
  const sides: ('A' | 'B')[] = beat.actor === 'both' ? ['A', 'B'] : [beat.actor];
  const shots: SfxShot[] = [];
  for (const actor of sides) {
    const row = rowFor(beat.sfx, speciesOf(actor));
    if (!row) {
      continue;
    }
    shots.push({
      actor,
      speak: row.speak === true,
      sound: row.sound,
      rateScale: row.rateScale,
      jaw: row.jaw,
      skipIfBarking: row.skipIfBarking,
    });
    if (row.once) {
      break;
    }
  }
  return shots;
}

// Every beat whose time has been reached, once. Parallel beats that share t each have an index.
export function crossBeats(beats: readonly { t: number }[], elapsed: number, fired: Set<number>): number[] {
  const hit: number[] = [];
  for (let i = 0; i < beats.length; i += 1) {
    if (beats[i].t > elapsed) {
      break;
    }
    if (fired.has(i)) {
      continue;
    }
    fired.add(i);
    hit.push(i);
  }
  return hit;
}

export function ambientCues(version: number, cues: readonly VoiceCue[], beats: readonly Beat[]): VoiceCue[] {
  if (version < 2) {
    return [...cues];
  }
  const first = cues[0];
  if (!first) {
    return [];
  }
  const near = beats.some((beat) => beat.sfx != null && Math.abs(beat.t - first.t) <= 1500);
  return near ? [] : [first];
}

function voiceFor(species: 'dog' | 'cat', upset: boolean): string {
  if (species === 'cat') {
    return 'meow';
  }
  return upset ? 'yip' : 'bark';
}

// Writes sfx from the action. Leaves a name the step already set, such as sneeze.
export function assignSfx(beats: Beat[], petA: PetSnapshot, petB: PetSnapshot, upset: boolean): void {
  for (const beat of beats) {
    if (beat.sfx != null) {
      continue;
    }
    if (beat.action === 'tug_rope') {
      beat.sfx = 'growl';
      continue;
    }
    if (beat.action === 'nap' || (beat.action === 'flop' && beat.emote === 'zzz')) {
      beat.sfx = 'rest';
      continue;
    }
    if (beat.action === 'celebrate') {
      beat.sfx = 'happy';
      continue;
    }
    if (beat.actor === 'both') {
      continue;
    }
    const species = (beat.actor === 'A' ? petA : petB).species;
    if (beat.action === 'win') {
      beat.sfx = voiceFor(species, upset);
    } else if (beat.gesture === 'startle' || beat.action === 'pounce') {
      beat.sfx = species === 'cat' ? 'meow' : 'yip';
    }
  }
}
