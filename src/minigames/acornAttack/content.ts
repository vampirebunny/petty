export const WORLD_W = 400;

export const STORY = "The squirrels raided the park's treat stash. Chase them down and win it back!";

export const HOW_TO = [
  'Drag anywhere to steer. The pet follows your finger, it does not jump to it.',
  'Lasers fire on their own. They stop on rocks, stumps, and logs.',
  'Boop squirrels for points. Dodge acorns, and do not get pinned at the bottom.',
];

export const SQUIRREL_CARD: { kind: 'scout' | 'glider' | 'lobber' | 'hoarder'; name: string; role: string; level: number }[] = [
  { kind: 'scout', name: 'Scout', role: 'squads', level: 1 },
  { kind: 'glider', name: 'Glider', role: 'dives', level: 2 },
  { kind: 'lobber', name: 'Lobber', role: 'throws', level: 3 },
  { kind: 'hoarder', name: 'Hoarder', role: 'tough', level: 4 },
];

export type Species = 'dog' | 'cat';

export type Settings = {
  ground: number;
  d: number;
  squad: number;
  glider: number;
  lobberCap: number;
  hoarder: number;
  obstacle: number;
};

export function columnWidth(screenW: number, screenH: number): number {
  return Math.min(screenW, screenH * 0.62);
}

export function treatShape(species: Species): 'bone' | 'fish' {
  return species === 'cat' ? 'fish' : 'bone';
}

// Level L starts after the previous lengths. Length of L is 260 + 40*(L-1).
export function levelStart(level: number): number {
  const n = Math.max(0, level - 1);
  return n * 260 + 20 * n * (n - 1);
}

export function levelAt(meters: number): number {
  let level = 1;
  while (level < 500 && meters >= levelStart(level + 1)) {
    level += 1;
  }
  return level;
}

export function settingsFor(level: number): Settings {
  const k = Math.min(Math.max(level, 1), 12) - 1;
  return {
    ground: 110 + 12 * k,
    d: 1 + 0.07 * k,
    squad: Math.max(1.5, 3.4 - 0.17 * k),
    glider: Math.max(1.1, 4.6 - 0.32 * k),
    lobberCap: Math.min(3, 1 + Math.floor((level - 3) / 3)),
    hoarder: Math.max(12, 24 - 1.2 * k),
    obstacle: Math.max(0.9, 1.6 - 0.06 * k),
  };
}

export const POINTS = { scout: 100, glider: 150, lobber: 250, hoarder: 400 } as const;

export const BEAMS: Record<number, { x: number; a: number }[]> = {
  1: [{ x: 0, a: 0 }],
  2: [
    { x: -6, a: 0 },
    { x: 6, a: 0 },
  ],
  3: [
    { x: -5, a: -0.16 },
    { x: 0, a: 0 },
    { x: 5, a: 0.16 },
  ],
  4: [
    { x: -8, a: -0.28 },
    { x: -4, a: -0.14 },
    { x: 0, a: 0 },
    { x: 4, a: 0.14 },
    { x: 8, a: 0.28 },
  ],
};

export type OfferKind = 'laser' | 'shield' | 'magnet' | 'heart';

export function powerUpOffer(hearts: number, laser: number, rng: () => number): OfferKind[] {
  const extras: OfferKind[] = ['shield', 'magnet'];
  if (hearts < 3) {
    extras.push('heart');
  }
  const need = laser < 4 ? 2 : Math.min(3, extras.length);
  const picked: OfferKind[] = [];
  const pool = extras.slice();
  while (picked.length < need && pool.length > 0) {
    const index = Math.floor(rng() * pool.length);
    const [next] = pool.splice(index, 1);
    if (next) {
      picked.push(next);
    }
  }
  const offer: OfferKind[] = laser < 4 ? ['laser', ...picked] : picked;
  return offer.slice(0, 3);
}
