import { ClipOp, Skia } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import type { Scene } from '../../actor';
import { stageHeight, stageWidth } from '../../actor/geometry';
import type { Env } from './env';
import { weatherOf } from './env';
import { circle, clamp01, ellipse, fill, gradRect, hash, line, mixc, stroke } from './ink';
import { footprint } from './layout';
import { skyColors } from './sky';

// Rain and snow are drawn from the clock, not simulated: each drop's position is a function of
// its index and the time, so there is no particle state and every frame is one path per kind.

export type PrecipOptions = {
  /** Size of drops and flakes relative to the stage (windows use a smaller view). */
  scale?: number;
  /** Density multiplier. */
  density?: number;
  salt?: number;
};

export function drawPrecip(c: SkCanvas, x: number, y: number, w: number, h: number, env: Env, opts: PrecipOptions = {}): void {
  const weather = weatherOf(env);
  if (!weather.precip || weather.intensity < 0.02 || w <= 0 || h <= 0) {
    return;
  }
  const scale = opts.scale ?? 1;
  const density = opts.density ?? 1;
  const salt = opts.salt ?? 0;
  const t = env.reduced ? 0 : env.t;
  const wind = env.wind ?? weather.wind;
  if (weather.precip === 'rain') {
    const count = Math.min(240, Math.round(((w * h) / 1300) * weather.intensity * density));
    const slant = wind * 0.32;
    const path = Skia.PathBuilder.Make();
    for (let i = 0; i < count; i += 1) {
      const len = 13 * scale * (0.7 + hash(i, salt + 3) * 0.6);
      const speed = 560 * scale * (0.85 + hash(i, salt + 1) * 0.3);
      const span = h + len;
      const fy = (((hash(i, salt + 2) * span + t * speed) % span) + span) % span;
      const py = y + fy - len * 0.5;
      const fx = (((hash(i, salt) * w + slant * fy) % w) + w) % w;
      const px = x + fx;
      path.moveTo(px, py);
      path.lineTo(px - slant * len, py - len);
    }
    c.drawPath(path.build(), stroke('rgba(214,228,244,0.62)', 1.15 * scale, 0.55 + 0.35 * weather.intensity));
    return;
  }
  const count = Math.min(200, Math.round(((w * h) / 1500) * weather.intensity * density));
  const near = Skia.PathBuilder.Make();
  const far = Skia.PathBuilder.Make();
  for (let i = 0; i < count; i += 1) {
    const depth = hash(i, salt + 5);
    const r = scale * (0.9 + depth * 2.1);
    const speed = scale * (22 + depth * 38);
    const span = h + 10;
    const fy = (((hash(i, salt + 2) * span + t * speed) % span) + span) % span;
    const sway = Math.sin(t * (0.6 + hash(i, salt + 6)) + i) * 7 * scale;
    const fx = (((hash(i, salt) * w + wind * 26 * scale * t * (0.5 + depth) + sway) % w) + w) % w;
    (depth > 0.55 ? near : far).addCircle(x + fx, y + fy - 5, r);
  }
  c.drawPath(far.build(), fill('#e9f0ff', 0.7));
  c.drawPath(near.build(), fill('#ffffff', 0.95));
}

/** Little splash rings where rain hits the ground. */
export function drawSplashes(c: SkCanvas, scene: Scene, env: Env): void {
  const weather = weatherOf(env);
  if (weather.precip !== 'rain' || env.reduced) {
    return;
  }
  const floor = scene.floor;
  const bleed = env.bleed ?? 0;
  const count = Math.round(30 * weather.intensity);
  const path = Skia.PathBuilder.Make();
  for (let i = 0; i < count; i += 1) {
    const period = 0.45 + hash(i, 41) * 0.4;
    const phase = env.t / period + hash(i, 42);
    const n = Math.floor(phase);
    const k = phase - n;
    const fx = hash(n * 97 + i, 43);
    const fy = hash(n * 89 + i, 44);
    const px = -bleed + fx * (stageWidth + bleed * 2);
    const py = floor.horizon + 8 + fy * (stageHeight - floor.horizon - 8);
    const depth = 0.5 + 0.5 * ((py - floor.horizon) / (stageHeight - floor.horizon));
    const r = (1.5 + k * 6) * depth;
    path.addOval(Skia.XYWHRect(px - r, py - r * 0.3, r * 2, r * 0.6));
  }
  c.drawPath(path.build(), stroke('#e4eef8', 1, 0.45));
}

function freeSpot(scene: Scene, x: number, y: number, pad: number): boolean {
  for (const prop of scene.props) {
    const layer = prop.layer ?? 'sorted';
    if (layer !== 'sorted') {
      continue;
    }
    if (Math.abs(prop.x - x) < footprint(prop) + pad && Math.abs(prop.y - y) < 34) {
      return false;
    }
  }
  return true;
}

/** Puddles on outdoor ground after rain, reflecting the sky, rippling while it still rains. */
export function drawPuddles(c: SkCanvas, scene: Scene, env: Env): void {
  const weather = weatherOf(env);
  if (scene.time !== 'outdoor' || weather.wetness < 0.04 || (scene as { shelter?: string }).shelter === 'roofed') {
    return;
  }
  const floor = scene.floor;
  const [, skyBottom] = skyColors(env);
  const ground = floor.color[1];
  for (let i = 0; i < 6; i += 1) {
    const px = 30 + hash(i, 61) * (stageWidth - 60);
    const py = floor.horizon + 24 + hash(i, 62) * (stageHeight - floor.horizon - 50);
    if (!freeSpot(scene, px, py, 30)) {
      continue;
    }
    const depth = 0.55 + 0.45 * ((py - floor.horizon) / (stageHeight - floor.horizon));
    const rx = (22 + hash(i, 63) * 26) * depth * (0.5 + weather.wetness * 0.5);
    const ry = rx * 0.26;
    const a = clamp01(weather.wetness * 1.3);
    ellipse(c, px, py, rx + 3, ry + 1.5, mixc(ground, '#000000', 0.25), 0.35 * a);
    ellipse(c, px, py, rx, ry, mixc(skyBottom, ground, 0.35), 0.8 * a);
    ellipse(c, px - rx * 0.25, py - ry * 0.25, rx * 0.45, ry * 0.3, '#ffffff', 0.22 * a);
    if (weather.precip === 'rain' && !env.reduced) {
      for (let j = 0; j < 3; j += 1) {
        const k = (env.t * 1.3 + hash(i * 7 + j, 64)) % 1;
        const ox = (hash(Math.floor(env.t * 1.3 + hash(i * 7 + j, 64)) * 13 + j, 65) - 0.5) * rx;
        c.drawOval(Skia.XYWHRect(px + ox - k * 6, py - k * 1.6, k * 12, k * 3.2), stroke('#ffffff', 0.9, 0.55 * (1 - k) * a));
      }
    }
  }
}

/** Settled snow over outdoor ground, with soft drifts along the horizon. */
export function drawGroundSnow(c: SkCanvas, scene: Scene, env: Env): void {
  const cover = weatherOf(env).snowCover;
  if (scene.time !== 'outdoor' || cover < 0.03) {
    return;
  }
  const bleed = env.bleed ?? 0;
  const floor = scene.floor;
  const left = -bleed;
  const span = stageWidth + bleed * 2;
  gradRect(c, left, floor.horizon, span, stageHeight - floor.horizon, '#f4f7ff', '#e4ebf7', clamp01(cover * 1.1) * 0.92);
  const drift = Skia.PathBuilder.Make();
  drift.moveTo(left, floor.horizon + 6);
  for (let x = left; x <= left + span + 20; x += 20) {
    drift.lineTo(x, floor.horizon - 2 - hash(Math.round(x / 20), 71) * 5 * cover);
  }
  drift.lineTo(left + span, floor.horizon + 6);
  drift.close();
  c.drawPath(drift.build(), fill('#f7f9ff', clamp01(cover * 1.2)));
  // A few blue-grey hollows so the snow reads as a surface, not a flat fill.
  for (let i = 0; i < 9; i += 1) {
    const px = left + hash(i, 72) * span;
    const py = floor.horizon + 20 + hash(i, 73) * (stageHeight - floor.horizon - 30);
    ellipse(c, px, py, 26 + hash(i, 74) * 30, 4 + hash(i, 75) * 3, '#c9d6ea', 0.35 * cover);
  }
}

/** Raindrops running down a pane of glass, and snow piling in its lower corners. */
export function drawGlassWeather(c: SkCanvas, x: number, y: number, w: number, h: number, env: Env): void {
  const weather = weatherOf(env);
  c.save();
  c.clipRect(Skia.XYWHRect(x, y, w, h), ClipOp.Intersect, true);
  if (weather.precip === 'rain' || weather.wetness > 0.3) {
    const amount = weather.precip === 'rain' ? weather.intensity : (weather.wetness - 0.3) * 0.6;
    const count = Math.round(14 * amount);
    for (let i = 0; i < count; i += 1) {
      const speed = 6 + hash(i, 81) * 14;
      // Drops hang, then slide: a sawtooth with a pause at the top of each run.
      const cycle = ((env.reduced ? 0 : env.t) * speed) / h + hash(i, 82);
      const k = cycle % 1;
      const run = Math.max(0, (k - 0.35) / 0.65);
      const px = x + hash(i, 83) * w;
      const top = y + hash(Math.floor(cycle) + i, 84) * h * 0.5;
      const py = top + run * run * h;
      const r = 1.2 + hash(i, 85) * 1.6;
      if (run > 0.02) {
        line(c, px, Math.max(y, py - run * 22), px, py - r, '#dfe9f5', r * 0.6, 0.35);
      }
      circle(c, px, py, r, '#e9f2fb', 0.7);
      circle(c, px - r * 0.3, py - r * 0.35, r * 0.35, '#ffffff', 0.9);
    }
  }
  if (weather.snowCover > 0.05) {
    const s = weather.snowCover;
    const pile = Skia.PathBuilder.Make();
    pile.moveTo(x, y + h);
    pile.quadTo(x + w * 0.08, y + h - 12 * s, x + w * 0.3, y + h - 3 * s);
    pile.lineTo(x + w * 0.7, y + h - 3 * s);
    pile.quadTo(x + w * 0.92, y + h - 12 * s, x + w, y + h);
    pile.close();
    c.drawPath(pile.build(), fill('#f5f8ff', 0.95));
  }
  c.restore();
}

/** Drips falling from a roof edge (the catio roof in the rain). */
export function drawRoofDrips(c: SkCanvas, x0: number, x1: number, roofY: number, env: Env): void {
  const weather = weatherOf(env);
  if (weather.precip !== 'rain' || env.reduced) {
    return;
  }
  const count = Math.round(((x1 - x0) / 26) * weather.intensity);
  for (let i = 0; i < count; i += 1) {
    const px = x0 + (i + 0.5) * ((x1 - x0) / count) + (hash(i, 91) - 0.5) * 8;
    const k = (env.t * (0.9 + hash(i, 92) * 0.6) + hash(i, 93)) % 1;
    const fall = k * k * 90;
    circle(c, px, roofY + 2, 1.6, '#d9e8f6', 0.8 * (1 - k * 0.5));
    if (k > 0.25) {
      line(c, px, roofY + fall - 6, px, roofY + fall, '#d9e8f6', 1.2, 0.7);
    }
  }
}
