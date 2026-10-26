import { ClipOp, Skia } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import type { Prop } from '../../actor/scenes';
import { paintPupCabana } from './cabana';
import { drawWindowDecor } from './decor';
import type { Env } from './env';
import { snowOn, weatherOf } from './env';
import {
  circle,
  clamp01,
  darken,
  ellipse,
  fill,
  hash,
  lighten,
  line,
  linear,
  makePath,
  mixc,
  ov,
  poly,
  rect,
  rrect,
  stroke,
} from './ink';
import { castShadow, lampGlow } from './light';
import { footprint, windowDims } from './layout';
import { drawBush, drawTree } from './nature';
import { drawOutsideView } from './outside';
import { drawShapes } from './shapes';
import { drawGlassWeather } from './weatherFx';

// Every prop kind is a renderer in this registry, drawn in local coordinates with the prop's base
// at (0, 0). New kinds (catio pieces, decor, future furniture) register themselves the same way.

export type PropRenderer = (c: SkCanvas, prop: Prop, env: Env) => void;

const renderers: Record<string, PropRenderer> = {};

export function registerProp(kind: string, renderer: PropRenderer): void {
  renderers[kind] = renderer;
}

export function hasPropRenderer(kind: string): boolean {
  return kind in renderers;
}

/** Extra optional fields some props read. Add them to the Prop type in scenes.ts. */
export type PropExtras = {
  /** Trees: keep leaves all year. */
  foliage?: 'evergreen' | 'deciduous';
  /** Windows: curtain colour, or false for none. */
  curtain?: string | false;
  /** Planters: what grows in them. */
  plant?: 'catgrass' | 'flowers' | 'catnip';
  /** Mirror the prop left to right. */
  flip?: boolean;
};

export function extras(prop: Prop): PropExtras {
  return { foliage: prop.foliage, curtain: prop.curtain, plant: prop.plant, flip: prop.flip };
}

/** The pet nearest a prop's footprint: how close (0 far, 1 on it) and how fast it is moving. */
export function petNear(env: Env, prop: Prop, reach = 1, depth = 36): { near: number; speed: number } {
  let near = 0;
  let speed = 0;
  const half = footprint(prop) * reach;
  for (const pet of env.contacts ?? []) {
    const dx = Math.abs(pet.x - prop.x);
    const dy = Math.abs(pet.y - prop.y);
    if (dx < half + 20 && dy < depth) {
      const k = clamp01(1 - Math.max(0, dx - half) / 20) * clamp01(1 - dy / depth);
      if (k > near) {
        near = k;
        speed = pet.speed;
      }
    }
  }
  return { near, speed };
}

/** A small paw print, used as an emblem on pet things. */
export function pawPrint(c: SkCanvas, x: number, y: number, s: number, color: string, a = 1): void {
  ellipse(c, x, y + s * 0.35, s * 0.62, s * 0.5, color, a);
  circle(c, x - s * 0.62, y - s * 0.22, s * 0.24, color, a);
  circle(c, x - s * 0.22, y - s * 0.58, s * 0.26, color, a);
  circle(c, x + s * 0.22, y - s * 0.58, s * 0.26, color, a);
  circle(c, x + s * 0.62, y - s * 0.22, s * 0.24, color, a);
}

function drawBowl(c: SkCanvas, prop: Prop, env: Env): void {
  const accent = prop.color ?? '#2f7d5b';
  castShadow(c, env, 0, 2, 34, 6.5, 14);
  // Body: lit from the upper left, flaring out to the rim.
  const body = makePath((p) => {
    p.moveTo(-30, -16);
    p.lineTo(-23, -1);
    p.quadTo(0, 5, 23, -1);
    p.lineTo(30, -16);
    p.close();
  });
  c.drawPath(body, linear(-30, 0, 30, 0, [lighten(accent, 0.12), accent, darken(accent, 0.3)], [0, 0.45, 1]));
  pawPrint(c, 0, -8, 5, lighten(accent, 0.42), 0.85);
  ellipse(c, 0, -16, 30.5, 7.2, lighten(accent, 0.1));
  ellipse(c, 0, -16, 25, 5, darken(accent, 0.5));
  c.drawPath(
    makePath((p) => p.addArc(ov(0, -16, 28.5, 6.2), 190, 120)),
    stroke('#ffffff', 1.4, 0.45),
  );
  if (prop.contents === 'water') {
    const level = clamp01(env.waterLevel);
    if (level > 0.02) {
      const k = 0.55 + 0.45 * level;
      ellipse(c, 0, -16 + (1 - level) * 1.5, 25 * k, 5 * k, '#7ec3e6', 0.4 + 0.6 * level);
      ellipse(c, -8 * k, -17.2, 8 * k, 1.4 * k, '#ffffff', 0.4 * level);
      const lapped = env.feeding.some((f) => f.kind === 'drink' && f.x === prop.x && f.y === prop.y);
      if (lapped && !env.reduced) {
        // Rings spread from where the tongue hits the water.
        for (let i = 0; i < 2; i += 1) {
          const t = (env.t * 1.6 + i * 0.5) % 1;
          c.drawOval(ov(3, -16, 3 + t * 16 * k, 0.7 + t * 3.2 * k), stroke('#ffffff', 1.4, 0.7 * (1 - t)));
        }
      }
    }
    return;
  }
  const count = Math.round(18 * clamp01(env.bowlFill));
  const heap = clamp01((env.bowlFill - 0.5) * 2);
  const eating = env.feeding.some((f) => f.kind === 'eat' && f.x === prop.x && f.y === prop.y);
  for (let i = 0; i < count; i += 1) {
    const angle = i * 2.4;
    const radius = 3 + (i % 6) * 3.6;
    const lift = heap * (1 - radius / 24) * 6;
    const jiggle = eating && !env.reduced ? Math.sin(env.t * 18 + i) * 0.6 : 0;
    const kx = Math.cos(angle) * radius + jiggle;
    const ky = -17 + Math.sin(angle) * 2.2 - (i % 3) - lift;
    const tone = i % 3 === 0 ? '#9a6440' : i % 3 === 1 ? '#8a5a3a' : '#a8734a';
    ellipse(c, kx, ky + 0.6, 3.1, 2.2, darken(tone, 0.3));
    ellipse(c, kx, ky, 3, 2.1, tone);
    circle(c, kx - 0.9, ky - 0.6, 0.8, '#d9a77c', 0.7);
  }
}

function drawLitterbox(c: SkCanvas, prop: Prop, env: Env): void {
  const w = prop.w ?? 78;
  const col = prop.color ?? '#d9d3c7';
  castShadow(c, env, 0, 5, w / 2 + 4, 9, 16);
  // High back, low front lip, so the sand shows.
  rrect(c, -w / 2, -26, w, 20, 7, darken(col, 0.12));
  rrect(c, -w / 2 + 5, -22, w - 10, 12, 5, '#cdbb9d');
  for (let i = 0; i < 16; i += 1) {
    circle(c, -w / 2 + 9 + hash(i, 1) * (w - 18), -20 + hash(i, 2) * 8, 0.9, i % 2 ? '#b19d7e' : '#e4d6bc', 0.9);
  }
  rrect(c, -w / 2 - 2, -14, w + 4, 20, 7, col);
  c.drawRect(Skia.XYWHRect(-w / 2 + 2, -13, w - 4, 2), fill(lighten(col, 0.35), 0.8));
  rrect(c, -w / 2 + 8, -4, w - 16, 4, 2, darken(col, 0.08), 0.6);
  pawPrint(c, 0, -5, 3.8, darken(col, 0.18), 0.8);
  // The scoop leans on the side.
  c.save();
  c.translate(w / 2 + 2, -6);
  c.rotate(-24, 0, 0);
  rect(c, -1.5, -26, 3, 18, '#5aa1c9');
  rrect(c, -6, -10, 12, 10, 3, '#5aa1c9');
  c.restore();
  const { near, speed } = petNear(env, prop, 0.8, 26);
  if (near > 0.5 && speed > 10 && !env.reduced) {
    for (let i = 0; i < 6; i += 1) {
      const k = (env.t * 2.2 + hash(i, 5)) % 1;
      const side = hash(Math.floor(env.t * 2.2 + hash(i, 5)) + i, 6) < 0.5 ? -1 : 1;
      circle(c, side * (8 + k * 26), -22 - Math.sin(k * Math.PI) * 14, 1.3, '#d8c7a6', 1 - k);
    }
  }
}

function drawBed(c: SkCanvas, prop: Prop, env: Env): void {
  const w = prop.w ?? 110;
  const col = prop.color ?? '#4d7fa8';
  const rx = w / 2;
  const { near } = petNear(env, prop, 0.7, 30);
  const dip = near;
  const cushion = mixc(col, '#f4ead8', 0.55);
  castShadow(c, env, 0, 4, rx + 4, 9, 22);
  // Donut bed: a plush bolster all round and a cushion in the hollow that sinks under a pet.
  ellipse(c, 0, -12, rx, 18, darken(col, 0.3));
  ellipse(c, 0, -17, rx - 2, 14, col);
  ellipse(c, 0, -18.5, rx - 6, 11, lighten(col, 0.12));
  ellipse(c, 0, -15 + dip * 1.5, rx - 15, 7.5 - dip, darken(cushion, dip * 0.12));
  ellipse(c, 0, -17.5 + dip * 1.5, rx - 18, 4, '#000000', 0.12 + dip * 0.08);
  // Front of the bolster: a fat crescent over the cushion's front edge.
  const front = Skia.PathBuilder.Make()
    .addArc(ov(0, -11, rx - 1, 14), 0, 180)
    .arcToOval(ov(0, -15 + dip * 1.5, rx - 14 + dip * 2, 8), 180, -180, false)
    .close()
    .detach();
  c.drawPath(front, linear(0, -16, 0, 3, [lighten(col, 0.16), col, darken(col, 0.18)], [0, 0.45, 1]));
  c.drawPath(
    makePath((p) => p.addArc(ov(0, -13.5 + dip, rx - 7, 9.5), 25, 130)),
    stroke(lighten(col, 0.32), 2, 0.55),
  );
  // Stitching along the base seam.
  for (let i = -5; i <= 5; i += 1) {
    const x = i * (rx / 6.2);
    const y = -12 + Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) * 17;
    line(c, x - 2, y, x + 2, y, lighten(col, 0.4), 1, 0.7);
  }
  pawPrint(c, 0, -2, 3.8, lighten(col, 0.45), 0.9);
}

function drawRug(c: SkCanvas, prop: Prop): void {
  const w = prop.w ?? 280;
  const h = prop.h ?? 60;
  const col = prop.color ?? '#7c5a8a';
  // A braided oval: rings of three tones with short stitches across each ring.
  const rings = [
    [1, darken(col, 0.18)],
    [0.86, lighten(col, 0.18)],
    [0.72, col],
    [0.58, mixc(col, '#f2d9a8', 0.35)],
    [0.42, darken(col, 0.08)],
    [0.26, lighten(col, 0.26)],
  ] as const;
  for (const [k, ringCol] of rings) {
    ellipse(c, 0, 0, (w / 2) * k, (h / 2) * k, ringCol);
  }
  for (const [k] of rings) {
    const n = Math.round(28 * k);
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * (w / 2) * (k - 0.07);
      const y = Math.sin(a) * (h / 2) * (k - 0.07);
      const tx = -Math.sin(a) * 2.2;
      const ty = Math.cos(a) * 0.7;
      line(c, x - tx, y - ty, x + tx, y + ty, '#000000', 1, 0.08);
    }
  }
}

function drawCouch(c: SkCanvas, prop: Prop, env: Env): void {
  const w = prop.w ?? 190;
  const col = prop.color ?? '#4f7c8a';
  const dark = darken(col, 0.22);
  castShadow(c, env, 0, 3, w / 2 + 8, 8, 44);
  // Tapered wooden legs.
  for (const lx of [-w / 2 + 12, w / 2 - 12]) {
    poly(c, [lx - 4, -8, lx + 4, -8, lx + 2, 2, lx - 2, 2], '#6b4a30');
  }
  // Back with two (or three) plump back cushions.
  rrect(c, -w / 2 + 6, -76, w - 12, 54, 14, darken(col, 0.14));
  const backs = w > 210 ? 3 : 2;
  const bw = (w - 44) / backs;
  for (let i = 0; i < backs; i += 1) {
    const bx = -w / 2 + 22 + i * bw;
    rrect(c, bx + 1, -70, bw - 2, 34, 12, col);
    rrect(c, bx + 6, -67, bw - 12, 9, 5, lighten(col, 0.14), 0.75);
  }
  // Seat base and cushions with a top face and a front face.
  rrect(c, -w / 2 + 4, -26, w - 8, 20, 6, dark);
  const seats = backs;
  const sw = (w - 36) / seats;
  for (let i = 0; i < seats; i += 1) {
    const sx = -w / 2 + 18 + i * sw;
    rrect(c, sx + 1, -42, sw - 2, 11, 5, lighten(col, 0.1));
    rrect(c, sx + 1, -34, sw - 2, 16, 6, col);
    line(c, sx + 6, -19, sx + sw - 6, -19, lighten(col, 0.24), 1.4, 0.6);
  }
  // Rolled arms.
  for (const side of [-1, 1]) {
    const ax = side < 0 ? -w / 2 - 6 : w / 2 - 20;
    rrect(c, ax, -56, 26, 50, 11, darken(col, 0.18));
    ellipse(c, ax + 13, -53, 13, 6, lighten(col, 0.05));
    ellipse(c, ax + 11, -54.5, 7, 2.6, lighten(col, 0.3), 0.6);
  }
  // A paw-print throw pillow, tipped into the corner.
  c.save();
  c.translate(-w / 2 + 34, -50);
  c.rotate(-14, 0, 0);
  rrect(c, -13, -13, 26, 26, 8, '#f3d6a6');
  rrect(c, -13, -13, 26, 6, 5, lighten('#f3d6a6', 0.3), 0.6);
  pawPrint(c, 0, 1, 5, '#d99a5b');
  c.restore();
}

function drawWindow(c: SkCanvas, prop: Prop, env: Env): void {
  const { w, h } = windowDims(prop);
  const scale = prop.scale ?? 1;
  const trim = '#f3ede2';
  const trimShade = '#d8cfbf';
  const px = -w / 2;
  const py = -h;
  // Curtain rod and drapes behind the frame edges.
  const curtain = extras(prop).curtain;
  if (curtain !== false) {
    const cc = curtain ?? '#e6b8a2';
    line(c, px - 26, py - 14, px + w + 26, py - 14, '#8a6a4c', 3);
    circle(c, px - 28, py - 14, 3.5, '#8a6a4c');
    circle(c, px + w + 28, py - 14, 3.5, '#8a6a4c');
    for (const side of [-1, 1]) {
      const edge = side < 0 ? px - 4 : px + w + 4;
      const out = side * 24;
      const drape = makePath((p) => {
        p.moveTo(edge - out * 0.1, py - 14);
        p.lineTo(edge + out, py - 14);
        p.quadTo(edge + out * 1.1, py + h * 0.5, edge + out * 0.9, py + h + 18);
        p.lineTo(edge + out * 0.2, py + h + 18);
        p.quadTo(edge - out * 0.25, py + h * 0.62, edge + out * 0.15, py + h * 0.5);
        p.quadTo(edge - out * 0.2, py + h * 0.2, edge - out * 0.1, py - 14);
        p.close();
      });
      c.drawPath(drape, fill(cc));
      for (let k = 1; k <= 2; k += 1) {
        const fx = edge + out * (0.25 + k * 0.25);
        line(c, fx, py - 12, fx + out * 0.05, py + h + 16, darken(cc, 0.16), 1.6, 0.7);
      }
      // Tie-back.
      line(c, edge - out * 0.15, py + h * 0.5, edge + out * 0.95, py + h * 0.52, darken(cc, 0.3), 3);
    }
  }
  // Frame with a shaded reveal, so the window sits into the wall.
  rrect(c, px - 9, py - 9, w + 18, h + 18, 3, trim);
  rect(c, px - 9, py + h + 4, w + 18, 5, trimShade, 0.6);
  rect(c, px - 3, py - 3, w + 6, h + 6, trimShade);
  drawOutsideView(c, px, py, w, h, env, (env.anchor?.x ?? 0) + px * scale, scale);
  drawGlassWeather(c, px, py, w, h, env);
  // A soft reflection streak on the glass.
  c.save();
  c.clipRect(Skia.XYWHRect(px, py, w, h), ClipOp.Intersect, true);
  poly(c, [px + w * 0.12, py + h, px + w * 0.32, py + h, px + w * 0.72, py, px + w * 0.52, py], '#ffffff', 0.06 + 0.04 * (1 - env.tod.dark));
  c.restore();
  // Mullions.
  rect(c, -2.5, py, 5, h, trim);
  rect(c, px, py + h / 2 - 2.5, w, 5, trim);
  rect(c, 1, py, 1.5, h, trimShade, 0.7);
  rect(c, px, py + h / 2 + 1, w, 1.5, trimShade, 0.7);
  // Sill.
  rrect(c, px - 16, -1, w + 32, 8, 2, '#e3d9c6');
  rect(c, px - 16, 5, w + 32, 3, darken('#e3d9c6', 0.2));
  drawWindowDecor(c, w, h, env);
}

function drawLamp(c: SkCanvas, prop: Prop, env: Env): void {
  const scale = prop.scale ?? 1;
  const on = lampGlow(prop.glow, env.tod.dark);
  if (on > 0.01) {
    env.glows.push({ x: prop.x, y: prop.y - 74 * scale, r: 84 * scale, a: on });
  }
  const shade = prop.color ?? '#f1d58a';
  castShadow(c, env, 0, 2, 16, 4, 80, 0.8);
  // Weighted base, pole, harp.
  ellipse(c, 0, -2, 13, 4.5, '#4a3b2e');
  ellipse(c, 0, -3.5, 10, 3, '#6a5442');
  rect(c, -1.6, -66, 3.2, 64, '#5a4a3a');
  rect(c, -1.6, -66, 1.1, 64, '#8a7460', 0.8);
  // Shade, glowing from inside when lit.
  const lit = mixc(shade, '#fff4cf', on * 0.6);
  c.drawPath(
    makePath((p) => {
      p.moveTo(-16, -63);
      p.lineTo(16, -63);
      p.lineTo(10.5, -87);
      p.lineTo(-10.5, -87);
      p.close();
    }),
    linear(-16, 0, 16, 0, [lighten(lit, 0.15), lit, darken(lit, 0.2 * (1 - on))]),
  );
  rect(c, -16.5, -64.5, 33, 2.5, darken(shade, 0.25));
  rect(c, -11, -88, 22, 2, darken(shade, 0.25));
  if (on > 0.01) {
    ellipse(c, 0, -63.5, 15, 2.5, '#fff6d8', on);
  }
}

function drawBench(c: SkCanvas, prop: Prop, env: Env): void {
  const w = prop.w ?? 96;
  const col = prop.color ?? '#8a5a3a';
  const snow = snowOn(env);
  const wet = weatherOf(env).wetness;
  castShadow(c, env, 0, 2, w / 2 + 4, 5, 44);
  const iron = '#3e3e46';
  // Cast-iron legs with a curl.
  for (const side of [-1, 1]) {
    const lx = side * (w / 2 - 10);
    line(c, lx, 0, lx, -50, iron, 3.4);
    line(c, lx, -26, lx + side * 6, 0, iron, 3);
    c.drawPath(
      makePath((p) => p.addArc(ov(lx + side * 4, -34, 4, 5), side < 0 ? 0 : 180, 270)),
      stroke(iron, 2.2),
    );
  }
  const slats = [-52, -42, -30, -24];
  slats.forEach((sy, i) => {
    const slat = i < 2 ? col : lighten(col, 0.06);
    rrect(c, -w / 2, sy, w, 7, 2, slat);
    rect(c, -w / 2 + 2, sy + 1, w - 4, 1.6, lighten(col, 0.28), 0.6);
    line(c, -w / 2 + 10 + i * 9, sy + 4.5, -w / 2 + 34 + i * 9, sy + 4.5, darken(col, 0.25), 0.8, 0.5);
    if (wet > 0.2) {
      rect(c, -w / 2 + 4, sy + 1, w - 8, 1.2, '#ffffff', 0.25 * wet);
    }
    if (snow > 0.05) {
      rrect(c, -w / 2 - 1, sy - 3 * snow, w + 2, 3.5 * snow + 1, 2, '#f6f9ff', snow);
    }
  });
}

function drawPond(c: SkCanvas, prop: Prop, env: Env): void {
  const w = prop.w ?? 150;
  const h = prop.h ?? 34;
  const weather = weatherOf(env);
  const f = env.sky?.season;
  const frozen = weather.snowCover > 0.45 && f?.season === 'winter';
  // Stones around the rim.
  ellipse(c, 0, 1, w / 2 + 8, h / 2 + 5, '#8e8a80');
  for (let i = 0; i < 22; i += 1) {
    const a = (i / 22) * Math.PI * 2;
    const sx = Math.cos(a) * (w / 2 + 3);
    const sy = Math.sin(a) * (h / 2 + 2) + 1;
    ellipse(c, sx, sy, 7 + hash(i, 3) * 3, 3.6 + hash(i, 4) * 1.5, mixc('#a7a397', '#c9c4b6', hash(i, 5)));
  }
  if (frozen) {
    ellipse(c, 0, 0, w / 2, h / 2, '#cfe6f2');
    line(c, -w * 0.25, -h * 0.1, w * 0.05, h * 0.15, '#ffffff', 1, 0.8);
    line(c, w * 0.05, h * 0.15, w * 0.28, -h * 0.05, '#ffffff', 1, 0.8);
    ellipse(c, -w * 0.12, -h * 0.18, w * 0.18, h * 0.08, '#ffffff', 0.5);
    return;
  }
  c.drawOval(ov(0, 0, w / 2, h / 2), linear(0, -h / 2, 0, h / 2, [mixc('#69b6de', env.tod.top, 0.35), '#3f8fbd']));
  ellipse(c, -w * 0.12, -h * 0.16, w * 0.22, h * 0.1, '#ffffff', 0.2);
  // Lily pads (and a flower in summer).
  if (f?.season !== 'winter') {
    for (const [lx, ly, r] of [
      [-w * 0.22, h * 0.05, 9],
      [w * 0.2, -h * 0.08, 7],
      [w * 0.05, h * 0.18, 6],
    ] as const) {
      c.drawPath(
        makePath((p) => {
          p.moveTo(lx, ly);
          p.addArc(ov(lx, ly, r, r * 0.42), 20, 320);
          p.close();
        }),
        fill('#4f9a58'),
      );
      ellipse(c, lx - r * 0.3, ly - r * 0.12, r * 0.4, r * 0.12, '#7cc480', 0.8);
    }
    if (f?.season === 'summer' || f?.season === 'spring') {
      circle(c, w * 0.2, -h * 0.12, 3.2, '#f6b9d0');
      circle(c, w * 0.2, -h * 0.12, 1.4, '#f6dd6a');
    }
  }
  const rings = weather.precip === 'rain' ? 4 : 1;
  for (let i = 0; i < rings; i += 1) {
    const speed = weather.precip === 'rain' ? 1.2 : 0.35;
    const k = (env.t * speed + i / rings) % 1;
    const n = Math.floor(env.t * speed + i / rings);
    const rx0 = rings > 1 ? (hash(n * 5 + i, 7) - 0.5) * w * 0.6 : w * 0.1;
    const ry0 = rings > 1 ? (hash(n * 5 + i, 8) - 0.5) * h * 0.5 : -2;
    c.drawOval(ov(rx0, ry0, w * 0.1 * (0.4 + k), h * 0.1 * (0.4 + k) + 1), stroke('#ffffff', 1.3, 0.55 * (1 - k)));
  }
  // A pet splashing at the edge.
  const { near, speed } = petNear(env, prop, 1, 24);
  if (near > 0.3 && speed > 15 && !env.reduced) {
    const k = (env.t * 1.8) % 1;
    c.drawOval(ov(0, 0, w * 0.45 * k + 4, h * 0.45 * k + 1), stroke('#ffffff', 1.5, 0.5 * (1 - k)));
  }
  // Reeds at one end.
  for (let i = 0; i < 5; i += 1) {
    const rx = w / 2 - 6 + i * 3;
    const sway = env.reduced ? 0 : Math.sin(env.t * 1.4 + i) * 1.5 + (env.wind ?? 0) * 3;
    const tall = 22 + hash(i, 9) * 14;
    line(c, rx, -2, rx + sway, -tall, f?.season === 'winter' ? '#b39c6a' : '#5e9447', 1.6);
    if (i % 2 === 0) {
      rrect(c, rx + sway - 1.8, -tall - 2, 3.6, 9, 1.8, '#7a5233');
    }
  }
}

function drawFence(c: SkCanvas, prop: Prop, env: Env): void {
  const w = prop.w ?? 300;
  const col = prop.color ?? '#f1ede4';
  const snow = snowOn(env);
  const shade = darken(col, 0.14);
  castShadow(c, env, 0, 1, w / 2, 3, 20, 0.6);
  rect(c, -w / 2, -24, w, 4, shade);
  rect(c, -w / 2, -11, w, 4, shade);
  let i = 0;
  for (let x = -w / 2; x <= w / 2 - 6; x += 13) {
    const post = i % 5 === 0;
    const pw = post ? 9 : 8;
    const top = post ? -38 : -33;
    poly(c, [x, 0, x, top + 4, x + pw / 2, top, x + pw, top + 4, x + pw, 0], col);
    rect(c, x + pw - 2, top + 4, 2, -top - 4, shade, 0.7);
    if (snow > 0.05) {
      poly(c, [x - 0.5, top + 4.5, x + pw / 2, top - 1.5 * snow, x + pw + 0.5, top + 4.5, x + pw / 2, top + 2.5], '#f7f9ff', snow);
    }
    i += 1;
  }
  if (snow > 0.05) {
    rect(c, -w / 2, -25.5, w, 2 * snow + 0.5, '#f7f9ff', snow);
    rect(c, -w / 2, -12.5, w, 2 * snow + 0.5, '#f7f9ff', snow);
  }
}

registerProp('shape', (c, prop, env) => drawShapes(c, prop.shapes ?? [], env));
registerProp('bowl', drawBowl);
registerProp('litterbox', drawLitterbox);
registerProp('bed', drawBed);
registerProp('dogHouse', (c, prop) => paintPupCabana(c, prop));
registerProp('rug', (c, prop) => drawRug(c, prop));
registerProp('couch', drawCouch);
registerProp('window', drawWindow);
registerProp('lamp', drawLamp);
registerProp('tree', (c, prop, env) => {
  castShadow(c, env, 0, 2, 40, 7, 140);
  drawTree(c, env, prop.color ?? '#4f9d55', { seed: Math.round(prop.x), evergreen: extras(prop).foliage === 'evergreen' });
});
registerProp('bench', drawBench);
registerProp('pond', drawPond);
registerProp('bush', (c, prop, env) => {
  castShadow(c, env, 0, 2, 32, 5.5, 34);
  const { near, speed } = petNear(env, prop, 1, 30);
  drawBush(c, env, prop.color ?? '#5aa65a', near * clamp01(speed / 60), Math.round(prop.x));
});
registerProp('fence', drawFence);

// Goal posts at the far end of the training field. Snow settles on the crossbar, rain leaves a sheen,
// and the little pennants on top flap with the wind.
function drawGoalPost(c: SkCanvas, prop: Prop, env: Env): void {
  const w = prop.w ?? 96;
  const h = prop.h ?? 100;
  const col = prop.color ?? '#f5c542';
  const shade = darken(col, 0.22);
  const bar = -h * 0.38;
  const snow = snowOn(env);
  const wet = weatherOf(env).wetness;
  castShadow(c, env, 0, 2, w / 2 + 6, 4, h, 0.5);
  line(c, 0, 0, 0, bar, shade, 6);
  line(c, -1, 0, -1, bar, col, 3.6);
  line(c, -w / 2, bar, w / 2, bar, col, 5);
  line(c, -w / 2, bar + 1.6, w / 2, bar + 1.6, shade, 1.4, 0.8);
  for (const side of [-1, 1]) {
    const x = (side * w) / 2;
    line(c, x, bar, x, -h, col, 5);
    line(c, x - 1, bar, x - 1, -h, lighten(col, 0.35), 1.2, 0.7);
    circle(c, x, -h, 3.2, col);
    const flap = env.reduced ? 0 : Math.sin(env.t * 3 + side) * 2.2 + (env.wind ?? 0.2) * 5;
    poly(c, [x, -h - 2, x + 15 + flap, -h + 3, x, -h + 9], side < 0 ? '#ff9eb5' : '#a9dbff');
    line(c, x, -h + 10, x, -h - 3, darken(col, 0.3), 1.4);
    if (snow > 0.05) {
      ellipse(c, x, -h - 2.5 * snow, 4, 1.6 + 1.6 * snow, '#f7f9ff', snow);
    }
  }
  if (wet > 0.2) {
    line(c, -w / 2 + 3, bar - 1.4, w / 2 - 3, bar - 1.4, '#ffffff', 1, 0.35 * wet);
  }
  if (snow > 0.05) {
    rrect(c, -w / 2 - 2, bar - 3 - 2.5 * snow, w + 4, 3 + 2.5 * snow, 2, '#f7f9ff', snow);
  }
}

// Chalk lines painted on the grass in stage coordinates. They fade as snow covers the field and
// darken a little when the turf is wet. Draw on the `back` layer, at x 0, y 0.
function drawFieldLines(c: SkCanvas, _prop: Prop, env: Env): void {
  const weather = weatherOf(env);
  const show = clamp01(1 - weather.snowCover * 1.15);
  if (show < 0.02) {
    return;
  }
  const a = 0.6 * show * (1 - weather.wetness * 0.25);
  const chalk = '#ffffff';
  const left = (y: number) => 60 - (y - 200) * 0.208;
  const right = (y: number) => 580 + (y - 200) * 0.208;
  const ys = [232, 280, 350, 470, 600, 700];
  for (let i = 0; i < ys.length - 1; i += 2) {
    const y0 = ys[i];
    const y1 = ys[i + 1];
    poly(c, [left(y0), y0, right(y0), y0, right(y1), y1, left(y1), y1], '#ffffff', 0.07 * show);
  }
  line(c, left(200), 200, left(700), 700, chalk, 2.8, a);
  line(c, right(200), 200, right(700), 700, chalk, 2.8, a);
  line(c, left(200), 200, right(200), 200, chalk, 1.4, a);
  ys.slice(0, 5).forEach((y, i) => {
    const lw = 1.6 + i * 0.6;
    if (y === 470) {
      line(c, left(y), y, 262, y, chalk, lw, a);
      line(c, 398, y, right(y), y, chalk, lw, a);
    } else {
      line(c, left(y), y, right(y), y, chalk, lw, a);
    }
  });
  c.drawOval(ov(330, 468, 66, 22), stroke(chalk, 3, a));
  c.save();
  c.translate(330, 468);
  c.scale(1.7, 0.62);
  pawPrint(c, 0, 0, 15, chalk, a * 1.1);
  c.restore();
}

registerProp('goalPost', drawGoalPost);
registerProp('fieldLines', drawFieldLines);

export function drawPropBody(c: SkCanvas, prop: Prop, env: Env): void {
  const renderer = renderers[prop.kind as string];
  if (renderer) {
    renderer(c, prop, env);
  }
}
