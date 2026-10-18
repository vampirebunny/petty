import { GEN, archetypeStrong, archetypes, traits } from './config';
import type { Archetype, AttributeSet, BreedRanges, PetAttributes, Stats, Trait } from './types';

// Pure and deterministic: the three offered attribute sets are a function of
// (seed, species, breedKey, ranges). No React, Skia, storage, or Math.random here.

function hash(text: string): number {
  // FNV-1a
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(start: number): () => number {
  let a = start;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rng(...parts: (string | number)[]): () => number {
  return mulberry32(hash(parts.join('|')));
}

function emptyStats(): Stats {
  return { stamina: 0, agility: 0, intelligence: 0, boldness: 0, affection: 0, obedience: 0 };
}

// Current starts at a fraction of potential, at least 1, and never above potential.
export function startingCurrent(potential: Stats): Stats {
  const current = emptyStats();
  for (const trait of traits) {
    current[trait] = Math.min(potential[trait], Math.max(1, Math.round(potential[trait] * GEN.START_FRACTION)));
  }
  return current;
}

// Clamp every current score into 0..potential. Use wherever current is written.
export function clampCurrent(current: Stats, potential: Stats): Stats {
  const next = emptyStats();
  for (const trait of traits) {
    next[trait] = Math.max(0, Math.min(potential[trait], current[trait]));
  }
  return next;
}

export function generateOffers(seed: number, species: string, breedKey: string, ranges: BreedRanges): AttributeSet[] {
  const q = rng(seed, species, breedKey, 'quality');
  const target = GEN.BASE_TOTAL + Math.round((q() * 2 - 1) * GEN.QUALITY_SPREAD);

  const j = rng(seed, species, breedKey, 'jitter');
  const jitter = emptyStats();
  for (const a of traits) {
    jitter[a] = (j() * 2 - 1) * GEN.JITTER;
  }

  return archetypes.map((archetype) => {
    const strong = archetypeStrong[archetype];

    // 1. position each attribute within its breed range (0..1)
    const v = emptyStats();
    for (const a of traits) {
      const [mn, mx] = ranges[a];
      let t = 0.5 + jitter[a] + (strong.includes(a) ? GEN.BOOST : -GEN.BOOST / 2);
      t = Math.max(0, Math.min(1, t));
      v[a] = mn + t * (mx - mn);
    }

    // 2. scale to the target total, distributing by available room so nothing leaves its range
    const sum = traits.reduce((s, a) => s + v[a], 0);
    const diff = target - sum;
    const room = (a: Trait) => (diff > 0 ? ranges[a][1] - v[a] : v[a] - ranges[a][0]);
    const totalRoom = traits.reduce((s, a) => s + room(a), 0);
    if (totalRoom > 0) {
      for (const a of traits) {
        v[a] += (diff * room(a)) / totalRoom;
      }
    }

    // 3. integerize, then hand out leftover points by largest remainder (stable tie-break by trait order)
    const potential = emptyStats();
    for (const a of traits) {
      potential[a] = Math.floor(v[a]);
    }
    let rem = target - traits.reduce((s, a) => s + potential[a], 0);
    const order = [...traits].sort(
      (x, y) => v[y] - Math.floor(v[y]) - (v[x] - Math.floor(v[x])) || traits.indexOf(x) - traits.indexOf(y),
    );
    for (const a of order) {
      if (rem <= 0) {
        break;
      }
      if (potential[a] < ranges[a][1]) {
        potential[a] += 1;
        rem -= 1;
      }
    }

    return { archetype, potential, current: startingCurrent(potential), total: target };
  });
}

// The attributes record stored on a new pet: the seed, the rules version, the picked archetype,
// and its potential and starting current. Potential is stored, never recomputed from the seed later.
export function attributesFor(
  seed: number,
  species: string,
  breedKey: string,
  ranges: BreedRanges,
  archetype: Archetype,
): PetAttributes {
  const offers = generateOffers(seed, species, breedKey, ranges);
  const picked = offers.find((offer) => offer.archetype === archetype) ?? offers[0];
  return {
    seed,
    rulesVersion: GEN.RULES_VERSION,
    archetype: picked.archetype,
    potential: { ...picked.potential },
    current: { ...picked.current },
  };
}
