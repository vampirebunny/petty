import { BlendMode, PaintStyle, Skia, StrokeCap, StrokeJoin, TileMode } from '@shopify/react-native-skia';
import type { SkCanvas, SkPaint, SkPath, SkPathBuilder, SkRect } from '@shopify/react-native-skia';

import type { Rgba } from '../../actor/timeOfDay';

// A small paint kit for scenery. Two jobs:
// 1. Paints are cached, so a frame does not allocate hundreds of SkPaint objects.
// 2. The room tint is mixed into each colour as the paint is made. A SrcATop blend of the tint over
//    an opaque fill is exactly mix(color, tint, tint.a), so props get the scene tint without the
//    offscreen layer per prop that drawTinted used to need.

export type RGBA = readonly [number, number, number, number];

const parsed = new Map<string, RGBA>();

function hex2(s: string, i: number): number {
  return parseInt(s.slice(i, i + 2), 16) / 255;
}

export function rgba(color: string): RGBA {
  const hit = parsed.get(color);
  if (hit) {
    return hit;
  }
  let out: RGBA = [0, 0, 0, 1];
  const s = color.trim();
  if (s[0] === '#') {
    const h = s.slice(1);
    if (h.length === 3 || h.length === 4) {
      const full = h
        .split('')
        .map((ch) => ch + ch)
        .join('');
      out = [hex2(full, 0), hex2(full, 2), hex2(full, 4), full.length === 8 ? hex2(full, 6) : 1];
    } else if (h.length === 6 || h.length === 8) {
      out = [hex2(h, 0), hex2(h, 2), hex2(h, 4), h.length === 8 ? hex2(h, 6) : 1];
    }
  } else {
    const m = s.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      const parts = m[1].split(',').map((p) => parseFloat(p));
      out = [(parts[0] ?? 0) / 255, (parts[1] ?? 0) / 255, (parts[2] ?? 0) / 255, parts[3] ?? 1];
    }
  }
  if (parsed.size > 2000) {
    parsed.clear();
  }
  parsed.set(color, out);
  return out;
}

export function css(c: RGBA): string {
  const to = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  if (c[3] >= 0.999) {
    return `#${[c[0], c[1], c[2]].map((v) => to(v).toString(16).padStart(2, '0')).join('')}`;
  }
  return `rgba(${to(c[0])},${to(c[1])},${to(c[2])},${Math.round(c[3] * 1000) / 1000})`;
}

/** Linear mix of two colours, k = 0 gives a, k = 1 gives b. */
export function mixc(a: string, b: string, k: number): string {
  const x = rgba(a);
  const y = rgba(b);
  const t = Math.max(0, Math.min(1, k));
  return css([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t, x[3] + (y[3] - x[3]) * t]);
}

export const lighten = (color: string, k: number): string => mixc(color, '#ffffff', k);
export const darken = (color: string, k: number): string => mixc(color, '#000000', k);

let tint: RGBA | null = null;
let tintKey = '';

/** Run `draw` with the scene tint mixed into every kit paint. Nests; restores the outer tint after. */
export function withTint(next: Rgba | null | undefined, draw: () => void): void {
  const prevTint = tint;
  const prevKey = tintKey;
  if (next && next.a > 0.001) {
    // Quantized, so a tint drifting with the clock reuses paints for many frames.
    const q = (v: number) => Math.round(v / 3) * 3;
    tint = [q(next.r) / 255, q(next.g) / 255, q(next.b) / 255, Math.round(next.a * 100) / 100];
    tintKey = `${q(next.r)},${q(next.g)},${q(next.b)},${tint[3]}`;
  } else {
    tint = null;
    tintKey = '';
  }
  try {
    draw();
  } finally {
    tint = prevTint;
    tintKey = prevKey;
  }
}

/** The tint key in effect, for caches that bake colours (the backdrop picture). */
export function activeTintKey(): string {
  return tintKey;
}

function applyTint(c: RGBA, a: number): Float32Array {
  if (!tint) {
    return Float32Array.of(c[0], c[1], c[2], c[3] * a);
  }
  const k = tint[3];
  return Float32Array.of(c[0] + (tint[0] - c[0]) * k, c[1] + (tint[1] - c[1]) * k, c[2] + (tint[2] - c[2]) * k, c[3] * a);
}

const paints = new Map<string, SkPaint>();

function cached(key: string, make: () => SkPaint): SkPaint {
  const full = `${key}~${tintKey}`;
  const hit = paints.get(full);
  if (hit) {
    return hit;
  }
  if (paints.size > 1500) {
    paints.clear();
  }
  const paint = make();
  paints.set(full, paint);
  return paint;
}

function base(): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  return p;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

export function fill(color: string, a = 1, blend?: BlendMode): SkPaint {
  return cached(`f|${color}|${round3(a)}|${blend ?? ''}`, () => {
    const p = base();
    p.setColor(applyTint(rgba(color), a));
    if (blend !== undefined) {
      p.setBlendMode(blend);
    }
    return p;
  });
}

export function stroke(color: string, width: number, a = 1, cap: StrokeCap = StrokeCap.Round): SkPaint {
  return cached(`s|${color}|${round3(width)}|${round3(a)}|${cap}`, () => {
    const p = base();
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(width);
    p.setStrokeCap(cap);
    p.setStrokeJoin(StrokeJoin.Round);
    p.setColor(applyTint(rgba(color), a));
    return p;
  });
}

export function linear(x0: number, y0: number, x1: number, y1: number, colors: string[], pos: number[] | null = null, a = 1): SkPaint {
  return cached(`l|${round3(x0)},${round3(y0)},${round3(x1)},${round3(y1)}|${colors.join(';')}|${pos?.join(',') ?? ''}|${round3(a)}`, () => {
    const p = base();
    p.setShader(
      Skia.Shader.MakeLinearGradient(
        Skia.Point(x0, y0),
        Skia.Point(x1, y1),
        colors.map((col) => applyTint(rgba(col), a)),
        pos,
        TileMode.Clamp,
      ),
    );
    return p;
  });
}

/** A stroke painted with a linear gradient (rainbow bands fading into the horizon). */
export function linearStroke(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  colors: string[],
  pos: number[] | null,
  width: number,
  a = 1,
): SkPaint {
  return cached(`ls|${round3(x0)},${round3(y0)},${round3(x1)},${round3(y1)}|${colors.join(';')}|${pos?.join(',') ?? ''}|${round3(width)}|${round3(a)}`, () => {
    const p = base();
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(width);
    p.setStrokeCap(StrokeCap.Butt);
    p.setShader(
      Skia.Shader.MakeLinearGradient(
        Skia.Point(x0, y0),
        Skia.Point(x1, y1),
        colors.map((col) => applyTint(rgba(col), a)),
        pos,
        TileMode.Clamp,
      ),
    );
    return p;
  });
}

export function radial(cx: number, cy: number, r: number, colors: string[], pos: number[] | null = null, a = 1, blend?: BlendMode): SkPaint {
  return cached(`r|${round3(cx)},${round3(cy)},${round3(r)}|${colors.join(';')}|${pos?.join(',') ?? ''}|${round3(a)}|${blend ?? ''}`, () => {
    const p = base();
    p.setShader(Skia.Shader.MakeRadialGradient(Skia.Point(cx, cy), Math.max(0.01, r), colors.map((col) => applyTint(rgba(col), a)), pos, TileMode.Clamp));
    if (blend !== undefined) {
      p.setBlendMode(blend);
    }
    return p;
  });
}

// ---- shapes ----

export const ov = (cx: number, cy: number, rx: number, ry: number): SkRect => Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2);

export function ellipse(c: SkCanvas, cx: number, cy: number, rx: number, ry: number, color: string, a = 1): void {
  if (rx > 0 && ry > 0 && a > 0.003) {
    c.drawOval(ov(cx, cy, rx, ry), fill(color, a));
  }
}

export function circle(c: SkCanvas, cx: number, cy: number, r: number, color: string, a = 1): void {
  if (r > 0 && a > 0.003) {
    c.drawCircle(cx, cy, r, fill(color, a));
  }
}

export function rect(c: SkCanvas, x: number, y: number, w: number, h: number, color: string, a = 1): void {
  if (w > 0 && h > 0 && a > 0.003) {
    c.drawRect(Skia.XYWHRect(x, y, w, h), fill(color, a));
  }
}

export function rrect(c: SkCanvas, x: number, y: number, w: number, h: number, r: number, color: string, a = 1): void {
  if (w > 0 && h > 0 && a > 0.003) {
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r), fill(color, a));
  }
}

export function line(c: SkCanvas, x1: number, y1: number, x2: number, y2: number, color: string, width: number, a = 1): void {
  if (a > 0.003) {
    c.drawLine(x1, y1, x2, y2, stroke(color, width, a));
  }
}

/** A closed polygon from flat [x0, y0, x1, y1, ...] points. */
export function poly(c: SkCanvas, pts: readonly number[], color: string, a = 1): void {
  c.drawPath(polyPath(pts), fill(color, a));
}

export function polyPath(pts: readonly number[]): SkPath {
  const p = Skia.PathBuilder.Make();
  p.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) {
    p.lineTo(pts[i], pts[i + 1]);
  }
  p.close();
  return p.detach();
}

export function makePath(build: (p: SkPathBuilder) => void): SkPath {
  const p = Skia.PathBuilder.Make();
  build(p);
  return p.detach();
}

const paths = new Map<string, SkPath>();

/** A path built once and reused, for static outlines keyed by their parameters. */
export function cachedPath(key: string, build: (p: SkPathBuilder) => void): SkPath {
  const hit = paths.get(key);
  if (hit) {
    return hit;
  }
  if (paths.size > 800) {
    paths.clear();
  }
  const p = makePath(build);
  paths.set(key, p);
  return p;
}

/** Vertical gradient fill of a rectangle. */
export function gradRect(c: SkCanvas, x: number, y: number, w: number, h: number, top: string, bottom: string, a = 1): void {
  if (w > 0 && h > 0) {
    c.drawRect(Skia.XYWHRect(x, y, w, h), linear(0, y, 0, y + h, [top, bottom], null, a));
  }
}

/** Untinted additive light: lamp glows, window light, fireflies. */
export function glow(c: SkCanvas, x: number, y: number, r: number, color: string, a: number, blend: BlendMode = BlendMode.Screen): void {
  if (a <= 0.003 || r <= 0) {
    return;
  }
  const saved = tint;
  const savedKey = tintKey;
  tint = null;
  tintKey = '';
  const col = rgba(color);
  const clear = css([col[0], col[1], col[2], 0]);
  c.drawCircle(x, y, r, radial(x, y, r, [color, clear], null, a, blend));
  tint = saved;
  tintKey = savedKey;
}

/** A soft flattened glow, for light pools on the floor. */
export function glowOval(c: SkCanvas, x: number, y: number, rx: number, ry: number, color: string, a: number, blend: BlendMode = BlendMode.Screen): void {
  if (a <= 0.003 || rx <= 0 || ry <= 0) {
    return;
  }
  c.save();
  c.translate(x, y);
  c.scale(1, ry / rx);
  glow(c, 0, 0, rx, color, a, blend);
  c.restore();
}

/** Run `draw` with no tint (light sources, effects drawn after the tint). */
export function untinted(draw: () => void): void {
  withTint(null, draw);
}

// ---- numbers ----

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
export const smooth = (a: number, b: number, x: number): number => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};

/** Stable pseudo-random number in [0, 1) for an integer and a salt. */
export function hash(i: number, salt = 0): number {
  let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((salt | 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Smooth 1D value noise in [-1, 1]. */
export function noise(x: number, salt = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const k = f * f * (3 - 2 * f);
  return (hash(i, salt) * (1 - k) + hash(i + 1, salt) * k) * 2 - 1;
}
