import type { SkCanvas } from '@shopify/react-native-skia';

import type { Foliage } from '../../actor/sky';
import type { Env } from './env';
import { snowOn } from './env';
import { circle, clamp01, darken, ellipse, hash, lighten, line, mixc, poly } from './ink';

// Trees, bushes and grass that follow the seasons: buds and blossom in spring, full green in
// summer, turning and dropping in autumn, bare (and maybe snowy) in winter.

const SUMMER: Foliage = { season: 'summer', leaves: 1, turn: 0, blossom: 0, lush: 1 };

export function foliageOf(env: Env, evergreen = false): Foliage {
  const f = env.sky?.season ?? SUMMER;
  if (evergreen) {
    return { ...f, leaves: 1, turn: 0, blossom: 0 };
  }
  return f;
}

/** A leaf colour for this blob of the canopy: summer green turning toward one of the autumn colours. */
export function leafColor(base: string, f: Foliage, seed: number): string {
  const autumn = ['#e9a93b', '#dd6a2e', '#c94a32', '#e8c04a', '#b8562f'];
  const target = autumn[Math.floor(hash(seed, 11) * autumn.length)];
  const springy = f.season === 'spring' ? mixc(base, '#9fd36a', 0.35 * (1 - f.leaves)) : base;
  const k = clamp01(f.turn * (0.75 + hash(seed, 12) * 0.5));
  return mixc(springy, target, k);
}

/** Grass tone for the season: dormant in winter, yellowing in late autumn. */
export function grassTone(color: string, f: Foliage): string {
  const dull = mixc(color, '#b8a874', 0.5);
  return mixc(color, dull, 1 - f.lush);
}

const CANOPY: readonly [number, number, number][] = [
  [-36, -76, 17],
  [36, -76, 17],
  [-28, -94, 24],
  [28, -94, 24],
  [0, -86, 26],
  [0, -110, 30],
  [-17, -124, 20],
  [18, -126, 19],
];

/**
 * A round deciduous tree, base at (0, 0), about 150 units tall at scale 1. Wind sways the crown;
 * bare branches show through as the leaves thin.
 */
export function drawTree(c: SkCanvas, env: Env, color: string, opts: { seed?: number; evergreen?: boolean; sway?: boolean } = {}): void {
  const seed = opts.seed ?? 0;
  const f = foliageOf(env, opts.evergreen);
  const snow = snowOn(env);
  const bark = '#7a5535';
  const wind = env.wind ?? 0.2;
  const sway = opts.sway === false || env.reduced ? 0 : wind * 2.2 + Math.sin(env.t * 1.1 + seed) * (0.5 + Math.abs(wind));
  // Trunk, tapering up, with root flares and a shaded side.
  poly(c, [-10, 0, 10, 0, 6, -66, -6, -66], bark);
  poly(c, [3, 0, 10, 0, 6, -66, 2, -66], darken(bark, 0.22));
  ellipse(c, -11, -1, 7, 3, bark);
  ellipse(c, 11, -1, 7, 3, darken(bark, 0.15));
  line(c, -3, -18, -1, -30, darken(bark, 0.3), 1.2, 0.6);
  c.save();
  c.rotate(sway, 0, -66);
  const leafy = f.leaves;
  if (leafy < 0.85) {
    // Branches, stronger the barer the tree.
    const a = 1 - leafy * 0.9;
    const branch = (x1: number, y1: number, x2: number, y2: number, w: number) => line(c, x1, y1, x2, y2, bark, w, a);
    branch(0, -64, -30, -102, 5);
    branch(0, -64, 28, -106, 5);
    branch(0, -64, 2, -128, 4.5);
    branch(-18, -86, -44, -94, 2.6);
    branch(16, -88, 42, -86, 2.6);
    branch(-26, -98, -20, -126, 2.2);
    branch(24, -102, 22, -132, 2.2);
    branch(2, -118, -12, -138, 1.8);
    branch(2, -118, 16, -140, 1.8);
    if (snow > 0.05) {
      const s = snow * a;
      line(c, -30, -104, -12, -82, '#f5f8ff', 2.2, s);
      line(c, 28, -108, 12, -84, '#f5f8ff', 2.2, s);
      line(c, -44, -96, -26, -90, '#f5f8ff', 1.6, s);
      line(c, 42, -88, 22, -90, '#f5f8ff', 1.6, s);
    }
  }
  if (leafy > 0.02) {
    const grow = 0.55 + 0.45 * leafy;
    CANOPY.forEach(([x, y, r], i) => {
      // As leaves fall, blobs drop out one by one instead of all shrinking together.
      if (hash(i + seed * 13, 21) > leafy * 1.15) {
        return;
      }
      const col = leafColor(color, f, i + seed * 7);
      circle(c, x + 3, y + 4, r * grow, darken(col, 0.28));
    });
    CANOPY.forEach(([x, y, r], i) => {
      if (hash(i + seed * 13, 21) > leafy * 1.15) {
        return;
      }
      const col = leafColor(color, f, i + seed * 7);
      circle(c, x, y, r * grow, col);
      circle(c, x - r * 0.28, y - r * 0.32, r * 0.5 * grow, lighten(col, 0.16), 0.9);
      if (snow > 0.05) {
        ellipse(c, x - r * 0.08, y - r * 0.62 * grow, r * 0.78 * grow, r * 0.3 * grow, '#f6f9ff', snow);
      }
    });
  }
  if (f.blossom > 0.02) {
    for (let i = 0; i < 22; i += 1) {
      const [x, y, r] = CANOPY[i % CANOPY.length];
      const ang = hash(i, 31 + seed) * Math.PI * 2;
      const d = r * (0.2 + hash(i, 32 + seed) * 0.75);
      const px = x + Math.cos(ang) * d;
      const py = y + Math.sin(ang) * d;
      circle(c, px, py, 3.2, i % 3 === 0 ? '#ffffff' : '#f7b9cf', f.blossom);
      circle(c, px, py, 1.1, '#f2d86a', f.blossom);
    }
  }
  c.restore();
}

/** A rounded shrub. Keeps its leaves but dulls in winter; flowers in spring, berries in winter. */
export function drawBush(c: SkCanvas, env: Env, color: string, rustle = 0, seed = 0): void {
  const f = foliageOf(env, true);
  const snow = snowOn(env);
  const base = mixc(color, '#7b8a5a', (1 - f.lush) * 0.45);
  const shake = env.reduced ? 0 : Math.sin(env.t * 32) * rustle * 2.2;
  const wind = env.reduced ? 0 : (env.wind ?? 0.2) * 1.2 + Math.sin(env.t * 1.5 + seed) * 0.4;
  c.save();
  c.skew(Math.tan(((wind + shake) * Math.PI) / 180), 0);
  const blobs: [number, number, number][] = [
    [-22, -12, 13],
    [22, -11, 12],
    [-12, -20, 16],
    [12, -21, 16],
    [0, -26, 18],
  ];
  for (const [x, y, r] of blobs) {
    circle(c, x + 2, y + 3, r, darken(base, 0.3));
  }
  for (const [x, y, r] of blobs) {
    circle(c, x, y, r, base);
    circle(c, x - r * 0.3, y - r * 0.32, r * 0.48, lighten(base, 0.17), 0.85);
  }
  if (f.season === 'spring' || f.blossom > 0) {
    const bloom = Math.max(f.blossom, f.season === 'spring' ? 0.6 : 0);
    for (let i = 0; i < 9; i += 1) {
      circle(c, -24 + hash(i, 41 + seed) * 48, -30 + hash(i, 42 + seed) * 22, 2.4, i % 2 ? '#ffffff' : '#ffc6dc', bloom);
    }
  }
  if (f.season === 'winter') {
    for (let i = 0; i < 6; i += 1) {
      circle(c, -20 + hash(i, 43 + seed) * 40, -26 + hash(i, 44 + seed) * 18, 2, '#d23b3b');
    }
  }
  if (snow > 0.05) {
    for (const [x, y, r] of blobs) {
      ellipse(c, x, y - r * 0.6, r * 0.82, r * 0.32, '#f6f9ff', snow);
    }
  }
  c.restore();
}
