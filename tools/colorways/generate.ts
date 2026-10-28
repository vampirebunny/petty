import {
  KNOWN_PATTERNS,
  KNOWN_SHAPES,
  PART_NAMES,
  type Colorway,
  type WearItem,
} from '../../src/actor/wardrobe';
import { FUR_SAMPLES, hex, type Swatch } from './palette';
import type { Theme, Tier } from './themes';

type Role = 'main' | 'accent' | 'trim' | 'detail';
type Slot = WearItem['slot'];

// How a theme's four roles land on each shape.
// hero: the one part that may take the pattern (big, readable). parts: solid role per other part.
type ShapeMap = { slot: Slot; label: string; hero?: string[]; parts: Record<string, Role> };

const SHAPES: Record<string, ShapeMap> = {
  // hats
  beanie: { slot: 'hat', label: 'Beanie', hero: ['crown'], parts: { cuff: 'trim', pom: 'detail' } },
  party: { slot: 'hat', label: 'Party Hat', parts: { trim: 'accent', pom: 'detail' } },
  top: { slot: 'hat', label: 'Top Hat', hero: ['band'], parts: { crown: 'main', brim: 'main' } },
  cap: { slot: 'hat', label: 'Ball Cap', hero: ['crown'], parts: { brim: 'trim' } },
  bucket: { slot: 'hat', label: 'Bucket Hat', hero: ['crown'], parts: { band: 'trim', brim: 'main' } },
  beret: { slot: 'hat', label: 'Beret', hero: ['crown'], parts: {} },
  // glasses: frame is c, lens tint is d (heart and star only)
  square: { slot: 'glasses', label: 'Round Specs', parts: {} },
  'red-rim': { slot: 'glasses', label: 'Rims', parts: {} },
  heart: { slot: 'glasses', label: 'Heart Shades', parts: {} },
  star: { slot: 'glasses', label: 'Star Shades', parts: {} },
  // neckwear
  collar: { slot: 'neckwear', label: 'Collar', parts: { band: 'main', charm: 'detail' } },
  bandana: { slot: 'neckwear', label: 'Bandana', hero: ['cloth'], parts: {} },
  scarf: { slot: 'neckwear', label: 'Scarf', hero: ['band', 'tail'], parts: {} },
  bow: { slot: 'neckwear', label: 'Bow', hero: ['loop'], parts: {} },
  bowtie: { slot: 'neckwear', label: 'Bow Tie', hero: ['wing'], parts: { knot: 'trim' } },
  // jackets
  sweater: { slot: 'jacket', label: 'Sweater', hero: ['body'], parts: { rib: 'trim' } },
  hoodie: { slot: 'jacket', label: 'Hoodie', hero: ['body'], parts: { rib: 'trim', pocket: 'accent', lining: 'detail' } },
  puffer: { slot: 'jacket', label: 'Puffer', hero: ['body'], parts: { collar: 'accent' } },
  vest: { slot: 'jacket', label: 'Vest', hero: ['body'], parts: { collar: 'trim' } },
  raincoat: { slot: 'jacket', label: 'Raincoat', hero: ['body'], parts: { lining: 'trim' } },
  // boots
  red: { slot: 'boots', label: 'Boots', hero: ['shaft'], parts: { cuff: 'trim' } },
  rain: { slot: 'boots', label: 'Rain Boots', hero: ['shaft'], parts: { sole: 'trim' } },
  sneaker: { slot: 'boots', label: 'Sneakers', parts: { upper: 'main', stripe: 'accent', laces: 'detail' } },
  hightop: { slot: 'boots', label: 'High-Tops', parts: { upper: 'main', stripe: 'accent', laces: 'detail' } },
};

// Never generated: the crown is a one-off, classic shades are always black.
const EXCLUDED = new Set(['crown', 'classic']);

export type Generated = WearItem & {
  theme: string;
  collection?: string;
  season?: string;
  tier: Tier;
};

export type Warning = { id: string; kind: 'fur' | 'pattern' | 'colors' | 'schema'; message: string };

// ---- color math (CIE76 is enough to catch near-identical colors) ----

function lab(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = ch;
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

const FUR_MIN = 14; // hero color closer than this to a coat reads as bare fur
const PATTERN_MIN = 22; // pattern's two colors closer than this and the pattern vanishes at phone size

// ---- recipe ----

function role(theme: Theme, r: Role): string {
  return hex(theme[r] as Swatch);
}

function tierOf(theme: Theme, patterned: boolean, twoTone: boolean): Tier {
  if (theme.tier) return theme.tier;
  if (patterned) return 'rare';
  return twoTone ? 'uncommon' : 'common';
}

function recipe(theme: Theme, shape: string, map: ShapeMap): Generated {
  const pattern = theme.pattern && map.hero ? theme.pattern : undefined;
  const colorway: Colorway = { c: role(theme, 'main'), d: role(theme, 'accent') };
  let patternParts: string[] | undefined;

  if (pattern) {
    colorway.pattern = pattern.id;
    colorway.c = hex(pattern.c ?? theme.main);
    colorway.d = hex(pattern.d ?? theme.accent);
    patternParts = map.hero;
  }

  // Every non-hero part is set explicitly, so it doesn't drift when c/d carry pattern colors.
  const parts: Record<string, string> = {};
  for (const [part, r] of Object.entries(map.parts)) {
    parts[part] = role(theme, r);
  }
  if (Object.keys(parts).length) colorway.parts = parts;

  if (map.slot === 'glasses') {
    // Frames are thin, so take whichever role holds up best against every coat.
    const order: Role[] = shape === 'heart' || shape === 'star' ? ['main', 'trim', 'detail'] : ['trim', 'main', 'detail'];
    const score = (r: Role) => Math.min(...Object.values(FUR_SAMPLES).map((f) => deltaE(role(theme, r), f)));
    colorway.c = role(theme, order.find((r) => score(r) >= FUR_MIN) ?? order.reduce((a, b) => (score(b) > score(a) ? b : a)));
    colorway.d = role(theme, 'accent');
  }
  if (shape === 'collar') colorway.accent = theme.collarAccent ?? 'tag';
  if (shape === 'puffer' && theme.baffles && !pattern) {
    colorway.baffles =
      theme.baffles === 'blocks' ? [role(theme, 'main'), role(theme, 'accent')] : theme.baffles.map((s) => hex(s));
  }

  const twoTone = Object.values(parts).some((v) => v !== colorway.c) || !!colorway.baffles;
  const item: Generated = {
    id: `${shape}.${theme.id}`,
    slot: map.slot,
    label: `${theme.name} ${map.label}`,
    shape,
    colorway,
    theme: theme.id,
    tier: tierOf(theme, !!pattern, twoTone),
  };
  if (patternParts) item.patternParts = patternParts;
  if (theme.collection) item.collection = theme.collection;
  if (theme.season) item.season = theme.season;
  return item;
}

// ---- checks ----

function check(item: Generated, warn: (kind: Warning['kind'], message: string) => void): void {
  const named = PART_NAMES[item.shape] ?? [];
  for (const part of Object.keys(item.colorway.parts ?? {})) {
    if (!named.includes(part)) warn('schema', `part "${part}" is not a named part of ${item.shape}`);
  }
  for (const part of item.patternParts ?? []) {
    if (!named.includes(part)) warn('schema', `pattern part "${part}" is not a named part of ${item.shape}`);
  }
  if (item.colorway.pattern && !KNOWN_PATTERNS.includes(item.colorway.pattern)) {
    warn('schema', `pattern ${item.colorway.pattern} is not in KNOWN_PATTERNS`);
  }
  if (!KNOWN_SHAPES[item.slot].includes(item.shape)) warn('schema', `shape ${item.shape} not in KNOWN_SHAPES.${item.slot}`);

  // Hero color vs every coat. Patterned items are judged on the stronger of their two colors.
  const heroes = item.colorway.pattern ? [item.colorway.c, item.colorway.d!] : [item.colorway.parts?.upper ?? item.colorway.c];
  for (const [fur, coat] of Object.entries(FUR_SAMPLES)) {
    const best = Math.max(...heroes.map((h) => deltaE(h, coat)));
    if (best < FUR_MIN) warn('fur', `blends into ${fur} coat (ΔE ${best.toFixed(1)})`);
  }
  if (item.colorway.pattern) {
    const d = deltaE(item.colorway.c, item.colorway.d!);
    if (d < PATTERN_MIN) warn('pattern', `${item.colorway.pattern} colors too close (ΔE ${d.toFixed(1)})`);
  }
  const partColors = Object.values(item.colorway.parts ?? {}).filter((value): value is string => typeof value === 'string');
  const all = new Set([item.colorway.c, ...partColors]);
  if (item.colorway.pattern) all.add(item.colorway.d!);
  if (all.size > 4) warn('colors', `${all.size} colors; aim for 2–3 plus trim`);
}

export function generate(themes: Theme[]): { items: Generated[]; warnings: Warning[] } {
  const items: Generated[] = [];
  const warnings: Warning[] = [];
  const seen = new Set<string>();
  for (const theme of themes) {
    if (seen.has(theme.id)) throw new Error(`duplicate theme id ${theme.id}`);
    seen.add(theme.id);
    for (const [shape, map] of Object.entries(SHAPES)) {
      if (EXCLUDED.has(shape) || theme.skip?.includes(shape)) continue;
      const item = recipe(theme, shape, map);
      check(item, (kind, message) => warnings.push({ id: item.id, kind, message }));
      items.push(item);
    }
  }
  // Every shipped shape must be mapped (or excluded), so a new shape can't be silently skipped.
  for (const [slot, shapes] of Object.entries(KNOWN_SHAPES)) {
    for (const s of shapes) {
      if (!SHAPES[s] && !EXCLUDED.has(s)) warnings.push({ id: `${slot}.${s}`, kind: 'schema', message: 'shape has no role map in generate.ts' });
    }
  }
  return { items, warnings };
}
