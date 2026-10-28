import type { SkCanvas } from '@shopify/react-native-skia';

import type { Scene } from '../../actor';
import { stageWidth } from '../../actor/geometry';
import type { DecorTheme } from '../../actor/sky';
import type { Env } from './env';
import { snowOn } from './env';
import { circle, clamp01, darken, ellipse, fill, glow, hash, lighten, line, makePath, ov, poly, rect, rrect, stroke } from './ink';
import { footprint, windowDims } from './layout';
import { castShadow } from './light';

// Seasonal decor, placed automatically so every scene (including ones not designed yet) gets it.
// Everything is pet-themed: paw-print stockings, bone and fish ornaments, a snowman with ears.

export type DecorPlan = {
  /** Wall garlands and hanging things, drawn right after the backdrop. */
  wall: (c: SkCanvas) => void;
  /** Floor pieces, depth-sorted with props and pets. */
  floor: { y: number; draw: (c: SkCanvas) => void }[];
  /** Untinted night lights and fliers (fireflies, bats), drawn last. */
  ambient: (c: SkCanvas) => void;
};

function themes(env: Env): DecorTheme[] {
  return env.sky?.season.decor ?? [];
}

// Placement is stable for a scene and theme. Draw callbacks read this so a cached plan still
// follows the live clock (fireflies, balloon bob, pumpkin glow).
let decorEnv: Env | undefined;

function decorNow(): Env {
  return decorEnv as Env;
}

const decorPlans = new WeakMap<Scene, { key: string; plan: DecorPlan }>();

// ---- pieces ----

export function drawPumpkin(c: SkCanvas, x: number, y: number, s: number, env: Env, face = false): void {
  const orange = '#e8822e';
  ellipse(c, x, y + 1, 14 * s, 3.5 * s, '#000000', 0.15);
  for (const [dx, r] of [
    [-6, 8],
    [6, 8],
    [0, 9.5],
  ] as const) {
    ellipse(c, x + dx * s, y - 9 * s, r * s, 9 * s, dx === 0 ? orange : darken(orange, 0.12));
  }
  ellipse(c, x - 3 * s, y - 13 * s, 3 * s, 3.5 * s, lighten(orange, 0.3), 0.6);
  rrect(c, x - 1.5 * s, y - 21 * s, 3 * s, 5 * s, 1 * s, '#5e7a33');
  line(c, x + 1 * s, y - 19 * s, x + 6 * s, y - 22 * s, '#6f9a3d', 1.2 * s);
  if (face) {
    const lit = clamp01((env.tod.dark - 0.3) * 2);
    const col = lit > 0.05 ? '#ffd35a' : '#5a2e10';
    poly(c, [x - 6 * s, y - 11 * s, x - 2.5 * s, y - 11 * s, x - 4.2 * s, y - 14.5 * s], col);
    poly(c, [x + 2.5 * s, y - 11 * s, x + 6 * s, y - 11 * s, x + 4.2 * s, y - 14.5 * s], col);
    // A cat-whisker grin.
    poly(c, [x - 6 * s, y - 7.5 * s, x + 6 * s, y - 7.5 * s, x + 4 * s, y - 4.5 * s, x + 1.5 * s, y - 6 * s, x, y - 4 * s, x - 1.5 * s, y - 6 * s, x - 4 * s, y - 4.5 * s], col);
    if (lit > 0.05) {
      // Glows are in stage coordinates; this may be drawn inside a prop's local space.
      env.glows.push({ x: x + (env.anchor?.x ?? 0), y: y - 9 * s + (env.anchor?.y ?? 0), r: 34 * s, a: lit });
    }
  }
}

function drawGourds(c: SkCanvas, x: number, y: number, env: Env): void {
  ellipse(c, x, y + 1, 22, 4, '#000000', 0.14);
  drawPumpkin(c, x - 8, y, 0.8, env);
  ellipse(c, x + 10, y - 6, 7, 6, '#e9d36a');
  rrect(c, x + 8, y - 20, 4, 9, 2, '#d9c25a');
  ellipse(c, x + 1, y - 3, 6, 4, '#9bb35a');
  circle(c, x + 15, y - 3, 4, '#f3efe2');
}

function drawPetTree(c: SkCanvas, x: number, y: number, env: Env): void {
  // A little potted pine with bone and fish ornaments and a paw star.
  ellipse(c, x, y + 1, 18, 4, '#000000', 0.15);
  poly(c, [x - 10, y, x + 10, y, x + 13, y - 14, x - 13, y - 14], '#b5643f');
  rect(c, x - 14, y - 17, 28, 4, '#c9764d');
  const green = '#2f7d4a';
  poly(c, [x - 26, y - 18, x + 26, y - 18, x, y - 52], darken(green, 0.1));
  poly(c, [x - 21, y - 38, x + 21, y - 38, x, y - 70], green);
  poly(c, [x - 15, y - 58, x + 15, y - 58, x, y - 86], lighten(green, 0.08));
  const twinkle = env.reduced ? 1 : 0.6 + 0.4 * Math.sin(env.t * 3);
  const bulbs: [number, number, string][] = [
    [-12, -24, '#ff5a5a'],
    [10, -28, '#ffd35a'],
    [-6, -44, '#4fb6ff'],
    [9, -48, '#ff8ad8'],
    [0, -64, '#7be08a'],
    [-8, -62, '#ffd35a'],
  ];
  bulbs.forEach(([bx, by, col], i) => {
    circle(c, x + bx, y + by, 2.4, col);
    if (env.tod.dark > 0.3) {
      glow(c, x + bx, y + by, 8, col, 0.5 * (i % 2 ? twinkle : 1.6 - twinkle) * env.tod.dark);
    }
  });
  // Bone ornament.
  rect(c, x + 3, y - 34, 9, 2.4, '#f6efe0');
  circle(c, x + 3, y - 34.4, 1.8, '#f6efe0');
  circle(c, x + 3, y - 32.2, 1.8, '#f6efe0');
  circle(c, x + 12, y - 34.4, 1.8, '#f6efe0');
  circle(c, x + 12, y - 32.2, 1.8, '#f6efe0');
  // Fish ornament.
  ellipse(c, x - 12, y - 52, 5, 2.6, '#7fd0e8');
  poly(c, [x - 7, y - 52, x - 3, y - 55, x - 3, y - 49], '#7fd0e8');
  pawStar(c, x, y - 89, 5.5);
  // Gifts.
  drawGift(c, x + 24, y, 11, '#d94a4a', '#f6d36a');
  drawGift(c, x - 24, y, 9, '#4f8fd9', '#ffffff');
}

function pawStar(c: SkCanvas, x: number, y: number, s: number): void {
  ellipse(c, x, y + s * 0.3, s * 0.7, s * 0.55, '#ffd35a');
  for (const [dx, dy] of [
    [-0.7, -0.3],
    [-0.25, -0.75],
    [0.25, -0.75],
    [0.7, -0.3],
  ]) {
    circle(c, x + dx * s, y + dy * s, s * 0.28, '#ffd35a');
  }
}

function drawGift(c: SkCanvas, x: number, y: number, s: number, box: string, ribbon: string): void {
  rect(c, x - s, y - s * 1.6, s * 2, s * 1.6, box);
  rect(c, x - s, y - s * 1.6, s * 0.6, s * 1.6, darken(box, 0.12), 0.6);
  rect(c, x - s * 0.18, y - s * 1.6, s * 0.36, s * 1.6, ribbon);
  rect(c, x - s * 1.05, y - s * 1.75, s * 2.1, s * 0.4, lighten(box, 0.1));
  ellipse(c, x - s * 0.4, y - s * 1.95, s * 0.4, s * 0.25, ribbon);
  ellipse(c, x + s * 0.4, y - s * 1.95, s * 0.4, s * 0.25, ribbon);
}

function drawStocking(c: SkCanvas, x: number, y: number): void {
  line(c, x, y - 6, x, y, '#8a6a4c', 1.2);
  const sock = makePath((p) => {
    p.moveTo(x - 7, y);
    p.lineTo(x + 7, y);
    p.lineTo(x + 7, y + 22);
    p.quadTo(x + 18, y + 24, x + 16, y + 32);
    p.quadTo(x + 6, y + 36, x - 7, y + 30);
    p.close();
  });
  c.drawPath(sock, fill('#c93b3b'));
  rrect(c, x - 9, y - 1, 18, 7, 3, '#f6f2ea');
  pawStar(c, x + 1, y + 18, 4.2);
}

function drawHeartBalloon(c: SkCanvas, x: number, y: number, env: Env): void {
  const bob = env.reduced ? 0 : Math.sin(env.t * 1.3 + x) * 3;
  const sway = env.reduced ? 0 : Math.sin(env.t * 0.9 + x) * 3;
  const hx = x + sway;
  const hy = y - 70 + bob;
  c.drawPath(
    makePath((p) => {
      p.moveTo(x, y - 4);
      p.quadTo(x + sway * 0.3, y - 36, hx, hy + 10);
    }),
    stroke('#8a8a8a', 0.9),
  );
  rrect(c, x - 3, y - 5, 6, 5, 1.5, '#d94a6a');
  heart(c, hx, hy, 12, '#ee4d6e');
  ellipse(c, hx - 4, hy - 5, 2.5, 1.6, '#ffffff', 0.6);
}

function heart(c: SkCanvas, x: number, y: number, s: number, color: string, a = 1): void {
  circle(c, x - s * 0.3, y - s * 0.12, s * 0.34, color, a);
  circle(c, x + s * 0.3, y - s * 0.12, s * 0.34, color, a);
  poly(c, [x - s * 0.62, y, x + s * 0.62, y, x, y + s * 0.7], color, a);
}

function drawEggBasket(c: SkCanvas, x: number, y: number): void {
  ellipse(c, x, y + 1, 20, 4, '#000000', 0.15);
  const eggs: [number, number, string][] = [
    [-9, -11, '#ffc6dc'],
    [0, -14, '#b8e3ff'],
    [9, -11, '#fff1a8'],
    [-4, -9, '#c9f0c2'],
    [5, -9, '#e3ccff'],
  ];
  for (const [ex, ey, col] of eggs) {
    ellipse(c, x + ex, y + ey, 5, 6.5, col);
    line(c, x + ex - 4, y + ey, x + ex + 4, y + ey, darken(col, 0.18), 1.2);
  }
  poly(c, [x - 17, y - 9, x + 17, y - 9, x + 13, y, x - 13, y], '#c99a5b');
  for (let i = -2; i <= 2; i += 1) {
    line(c, x + i * 6, y - 9, x + i * 5, y, darken('#c99a5b', 0.2), 1);
  }
  c.drawPath(makePath((p) => p.addArc(ov(x, y - 10, 15, 20), 180, 180)), stroke('#b08447', 2));
}

function drawFlowerPot(c: SkCanvas, x: number, y: number, env: Env, kind: 'tulips' | 'sunflower'): void {
  ellipse(c, x, y + 1, 12, 3, '#000000', 0.15);
  poly(c, [x - 9, y, x + 9, y, x + 11, y - 14, x - 11, y - 14], '#c9764d');
  rect(c, x - 12, y - 16, 24, 3.5, '#d98a5f');
  const sway = env.reduced ? 0 : Math.sin(env.t * 1.2 + x) * 1.2;
  if (kind === 'sunflower') {
    line(c, x, y - 15, x + sway, y - 52, '#5e9447', 2.2);
    ellipse(c, x - 5 + sway * 0.5, y - 32, 5, 2.2, '#6faa50');
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      ellipse(c, x + sway + Math.cos(a) * 7, y - 54 + Math.sin(a) * 7, 3.4, 3.4, '#f6c83a');
    }
    circle(c, x + sway, y - 54, 5, '#7a4a24');
    return;
  }
  const colors = ['#ee5a6e', '#f6c83a', '#f39ac0'];
  colors.forEach((col, i) => {
    const sx = x - 5 + i * 5;
    const top = y - 30 - (i === 1 ? 6 : 0);
    line(c, sx, y - 15, sx + sway, top, '#5e9447', 1.6);
    ellipse(c, sx + sway, top - 3, 3.4, 4.4, col);
    poly(c, [sx + sway - 3.4, top - 4, sx + sway - 1.4, top - 9, sx + sway, top - 5, sx + sway + 1.4, top - 9, sx + sway + 3.4, top - 4], col);
  });
}

function drawSnowPup(c: SkCanvas, x: number, y: number): void {
  ellipse(c, x, y + 1, 22, 5, '#9fb0c8', 0.35);
  circle(c, x, y - 16, 18, '#f7f9ff');
  circle(c, x, y - 42, 13, '#ffffff');
  // Floppy ears and a scarf.
  ellipse(c, x - 12, y - 50, 4.5, 8, '#e9eef8');
  ellipse(c, x + 12, y - 50, 4.5, 8, '#e9eef8');
  rrect(c, x - 13, y - 32, 26, 5, 2, '#d94a4a');
  rect(c, x + 6, y - 30, 5, 12, '#d94a4a');
  circle(c, x - 4.5, y - 45, 1.6, '#2a2a33');
  circle(c, x + 4.5, y - 45, 1.6, '#2a2a33');
  ellipse(c, x, y - 40, 3.4, 2.6, '#2a2a33');
  line(c, x - 2, y - 36, x, y - 35, '#2a2a33', 1);
  line(c, x + 2, y - 36, x, y - 35, '#2a2a33', 1);
  circle(c, x, y - 20, 1.6, '#2a2a33');
  circle(c, x, y - 12, 1.6, '#2a2a33');
}

function drawHayBale(c: SkCanvas, x: number, y: number, env: Env): void {
  ellipse(c, x, y + 1, 28, 5, '#000000', 0.15);
  rrect(c, x - 26, y - 24, 52, 24, 4, '#e2c36a');
  rect(c, x - 26, y - 24, 52, 5, '#f0d888');
  line(c, x - 12, y - 24, x - 12, y, '#b8963d', 1.6);
  line(c, x + 12, y - 24, x + 12, y, '#b8963d', 1.6);
  for (let i = 0; i < 10; i += 1) {
    line(c, x - 22 + hash(i, 1) * 44, y - 20 + hash(i, 2) * 16, x - 18 + hash(i, 1) * 44, y - 21 + hash(i, 2) * 16, '#c9a54a', 0.8);
  }
  drawPumpkin(c, x + 8, y - 24, 0.7, env);
}

// ---- garlands ----

type GarlandItem = (c: SkCanvas, x: number, y: number, i: number, env: Env) => void;

function bat(c: SkCanvas, x: number, y: number, s: number, color = '#2b2233', flap = 0): void {
  ellipse(c, x, y, 3 * s, 3.6 * s, color);
  const wing = 1 + flap * 0.5;
  poly(c, [x - 2 * s, y - 1 * s, x - 11 * s, y - 4 * s * wing, x - 8 * s, y + 1 * s, x - 5 * s, y + 0.5 * s, x - 3 * s, y + 2 * s], color);
  poly(c, [x + 2 * s, y - 1 * s, x + 11 * s, y - 4 * s * wing, x + 8 * s, y + 1 * s, x + 5 * s, y + 0.5 * s, x + 3 * s, y + 2 * s], color);
  poly(c, [x - 2.4 * s, y - 2.5 * s, x - 1.6 * s, y - 5.5 * s, x - 0.6 * s, y - 3 * s], color);
  poly(c, [x + 2.4 * s, y - 2.5 * s, x + 1.6 * s, y - 5.5 * s, x + 0.6 * s, y - 3 * s], color);
}

const garlandItems: Partial<Record<DecorTheme, GarlandItem>> = {
  halloween: (c, x, y, i) => {
    if (i % 2) {
      bat(c, x, y + 6, 0.9);
    } else {
      poly(c, [x - 6, y, x + 6, y, x, y + 12], '#ee8a2e');
    }
  },
  harvest: (c, x, y, i) => {
    const col = ['#e9a93b', '#dd6a2e', '#c94a32', '#e8c04a'][i % 4];
    c.save();
    c.rotate(i % 2 ? 25 : -25, x, y + 5);
    ellipse(c, x, y + 6, 4, 7, col);
    line(c, x, y, x, y + 12, darken(col, 0.3), 0.8);
    c.restore();
  },
  winterHolidays: (c, x, y, i, env) => {
    const col = ['#ff5a5a', '#ffd35a', '#4fb6ff', '#7be08a', '#ff8ad8'][i % 5];
    rect(c, x - 1.4, y - 1, 2.8, 3, '#3a4a3a');
    ellipse(c, x, y + 5, 2.6, 3.8, col);
    const on = env.tod.dark > 0.25 ? 1 : 0.45;
    const tw = env.reduced ? 1 : 0.55 + 0.45 * Math.sin(env.t * 2.4 + i * 1.7);
    glow(c, x, y + 5, 10, col, 0.55 * on * tw);
  },
  valentines: (c, x, y, i) => heart(c, x, y + 4, 9, i % 2 ? '#ee4d6e' : '#f6a3bd'),
  spring: (c, x, y, i) => poly(c, [x - 6, y, x + 6, y, x, y + 12], ['#f6b9d0', '#b8e3ff', '#fff1a8', '#c9f0c2'][i % 4]),
  easter: (c, x, y, i) => ellipse(c, x, y + 6, 4.5, 6, ['#ffc6dc', '#b8e3ff', '#fff1a8', '#e3ccff'][i % 4]),
  summer: (c, x, y, i) => poly(c, [x - 6, y, x + 6, y, x, y + 12], ['#f6c83a', '#4fc1b8', '#ee6b4d'][i % 3]),
};

/** A garland swagged between hooks across the stage at height y, with items hung along it. */
function drawGarland(c: SkCanvas, theme: DecorTheme, y: number, sag: number, env: Env, x0 = 8, x1 = stageWidth - 8): void {
  const item = garlandItems[theme];
  if (!item) {
    return;
  }
  const hooks = 3;
  const span = (x1 - x0) / (hooks - 1);
  const cord = theme === 'winterHolidays' ? '#2f4a36' : '#7a6a58';
  for (let h = 0; h < hooks - 1; h += 1) {
    const a = x0 + h * span;
    const b = a + span;
    c.drawPath(
      makePath((p) => {
        p.moveTo(a, y);
        p.quadTo((a + b) / 2, y + sag * 2, b, y);
      }),
      stroke(cord, 1.2),
    );
    const n = Math.max(3, Math.round(span / 24));
    for (let i = 1; i < n; i += 1) {
      const k = i / n;
      const px = a + (b - a) * k;
      const py = y + 4 * sag * k * (1 - k);
      item(c, px, py, i + h * n, env);
    }
  }
  for (let h = 0; h < hooks; h += 1) {
    circle(c, x0 + h * span, y, 2, '#8a7a68');
  }
}

/** Decor on a window: clings on the glass, lights round the frame, something on the sill. */
export function drawWindowDecor(c: SkCanvas, w: number, h: number, env: Env): void {
  const set = themes(env);
  const px = -w / 2;
  const py = -h;
  if (set.includes('halloween')) {
    bat(c, px + w * 0.2, py + h * 0.18, 0.8);
    bat(c, px + w * 0.32, py + h * 0.1, 0.6);
    drawPumpkin(c, px + w - 10, -1, 0.65, env, true);
  }
  if (set.includes('harvest')) {
    drawGourds(c, px + w - 14, -1, env);
  }
  if (set.includes('winterHolidays')) {
    const n = Math.round(w / 16);
    for (let i = 0; i <= n; i += 1) {
      garlandItems.winterHolidays?.(c, px - 6 + ((w + 12) * i) / n, py - 10 + Math.sin((i / n) * Math.PI) * 4, i, env);
    }
    // A paper snowflake on the glass.
    const sx = px + w * 0.78;
    const sy = py + h * 0.22;
    for (let k = 0; k < 3; k += 1) {
      const a = (k * Math.PI) / 3;
      line(c, sx - Math.cos(a) * 7, sy - Math.sin(a) * 7, sx + Math.cos(a) * 7, sy + Math.sin(a) * 7, '#ffffff', 1.4, 0.85);
    }
  }
  if (set.includes('valentines')) {
    heart(c, px + w * 0.24, py + h * 0.22, 11, '#ee4d6e', 0.9);
  }
  if (set.includes('spring') || set.includes('easter')) {
    drawFlowerPot(c, px + 14, -1, env, 'tulips');
  }
  if (set.includes('summer')) {
    drawFlowerPot(c, px + 14, -1, env, 'sunflower');
  }
}

// ---- placement ----

function freeSlot(scene: Scene, used: number[], x: number, y: number, pad: number): boolean {
  for (const u of used) {
    if (Math.abs(u - x) < pad * 2) {
      return false;
    }
  }
  for (const prop of scene.props) {
    const layer = prop.layer ?? 'sorted';
    if (layer !== 'sorted' || prop.kind === 'rug') {
      continue;
    }
    if (Math.abs(prop.x - x) < footprint(prop) + pad && Math.abs(prop.y - y) < 46) {
      return false;
    }
  }
  return true;
}

export function buildDecor(scene: Scene, env: Env): DecorPlan {
  decorEnv = env;
  const set = themes(env);
  const snowPup = snowOn(env) > 0.3;
  const key = `${set.join(',')}|${snowPup ? 1 : 0}`;
  const cached = decorPlans.get(scene);
  if (cached?.key === key) {
    return cached.plan;
  }
  const plan: DecorPlan = { wall: () => {}, floor: [], ambient: () => {} };
  const outdoor = scene.time === 'outdoor';
  const roofed = scene.shelter === 'roofed';
  const floor = scene.floor;
  const used: number[] = [];
  const backY = floor.yMin + 4;
  const candidates = [34, stageWidth - 34, 70, stageWidth - 70, stageWidth * 0.3, stageWidth * 0.7];
  const place = (pad: number, y = backY): number | null => {
    for (const x of candidates) {
      if (freeSlot(scene, used, x, y, pad)) {
        used.push(x);
        return x;
      }
    }
    return null;
  };
  const addFloor = (pad: number, draw: (c: SkCanvas, x: number, y: number) => void) => {
    const x = place(pad);
    if (x !== null) {
      plan.floor.push({
        y: backY,
        draw: (c) => {
          const live = decorNow();
          const saved = live.anchor;
          live.anchor = { x: 0, y: 0 };
          draw(c, x, backY);
          live.anchor = saved;
        },
      });
    }
  };

  // Garland: high on the wall indoors, along the roof beam in the catio, along a fence outdoors.
  const garlandTheme = set.find((t) => t !== 'easter') ?? set[0];
  const wallOk = !outdoor && floor.horizon > 140;
  const fence = outdoor ? scene.props.find((p) => p.kind === 'fence') : undefined;
  const stockingXs: number[] = [];
  const stockingY = floor.horizon * 0.42;
  if (set.includes('winterHolidays') && wallOk) {
    // Two stockings on bare wall, clear of windows. Wall art in the scene layers (small rects) is avoided too.
    const art = scene.layers.filter((l) => l.t === 'rect' && l.w != null && l.h != null && l.w < stageWidth * 0.6 && l.h < floor.horizon * 0.6);
    const clear = (x: number) =>
      !art.some((l) => x > (l.x ?? 0) - 24 && x < (l.x ?? 0) + (l.w ?? 0) + 24 && stockingY + 36 > (l.y ?? 0) && stockingY < (l.y ?? 0) + (l.h ?? 0)) &&
      !scene.props.some((p) => {
        if (p.kind !== 'window') {
          return false;
        }
        const { w, h } = windowDims(p);
        const s = p.scale ?? 1;
        return Math.abs(p.x - x) < (w * s) / 2 + 44 && stockingY + 36 > p.y - h * s - 20 && stockingY < p.y + 20;
      });
    for (let k = 0.08; k <= 0.93 && stockingXs.length < 2; k += 0.04) {
      const x = stageWidth * k;
      if (clear(x) && stockingXs.every((h) => Math.abs(h - x) > 60)) {
        stockingXs.push(x);
      }
    }
  }
  plan.wall = (c) => {
    const live = decorNow();
    if (garlandTheme && wallOk) {
      drawGarland(c, garlandTheme, floor.horizon * 0.09, 9, live);
    }
    if (garlandTheme && roofed) {
      drawGarland(c, garlandTheme, scene.roofY ?? floor.horizon * 0.16, 7, live);
    }
    for (const x of stockingXs) {
      drawStocking(c, x, stockingY);
    }
  };
  if (fence && garlandTheme === 'winterHolidays') {
    const fw = fence.w ?? 300;
    plan.floor.push({
      y: fence.y - 0.5,
      draw: (c) => drawGarland(c, 'winterHolidays', fence.y - 30, 3, decorNow(), fence.x - fw / 2, fence.x + fw / 2),
    });
  }

  if (set.includes('halloween')) {
    addFloor(18, (c, x, y) => {
      const live = decorNow();
      castShadow(c, live, x, y + 1, 18, 4, 18);
      drawPumpkin(c, x - 7, y, 1.1, live, true);
      drawPumpkin(c, x + 10, y + 3, 0.75, live);
    });
  }
  if (set.includes('harvest')) {
    addFloor(26, (c, x, y) => {
      const live = decorNow();
      if (outdoor) {
        drawHayBale(c, x, y, live);
      } else {
        drawGourds(c, x, y, live);
      }
    });
  }
  if (set.includes('winterHolidays')) {
    if (outdoor && !roofed) {
      if (snowPup) {
        addFloor(24, (c, x, y) => drawSnowPup(c, x, y));
      }
    } else {
      addFloor(32, (c, x, y) => drawPetTree(c, x, y, decorNow()));
    }
  }
  if (set.includes('valentines')) {
    addFloor(14, (c, x, y) => drawHeartBalloon(c, x, y, decorNow()));
  }
  if (set.includes('easter')) {
    addFloor(20, (c, x, y) => drawEggBasket(c, x, y));
  }
  if (set.includes('spring') && !set.includes('easter')) {
    addFloor(14, (c, x, y) => drawFlowerPot(c, x, y, decorNow(), 'tulips'));
  }
  if (set.includes('summer')) {
    addFloor(14, (c, x, y) => drawFlowerPot(c, x, y, decorNow(), 'sunflower'));
  }

  plan.ambient = (c) => {
    const live = decorNow();
    const dark = live.tod.dark;
    const season = live.sky?.season.season;
    if (outdoor && season === 'summer' && dark > 0.45 && !live.reduced) {
      // Fireflies over the lawn on summer nights.
      for (let i = 0; i < 10; i += 1) {
        const fx = (hash(i, 201) * stageWidth + Math.sin(live.t * 0.3 + i) * 30 + stageWidth) % stageWidth;
        const fy = floor.horizon + 10 + hash(i, 202) * (floor.yMax - floor.horizon) * 0.8 + Math.sin(live.t * 0.5 + i * 2) * 12;
        const blink = Math.max(0, Math.sin(live.t * (0.8 + hash(i, 203)) + i * 3)) ** 3;
        glow(c, fx, fy, 9, '#e8ff8a', 0.8 * blink * dark);
        circle(c, fx, fy, 1.2, '#f6ffc8', blink);
      }
    }
    if (outdoor && set.includes('halloween') && dark > 0.5 && !live.reduced) {
      // Two bats crossing the night sky now and then.
      for (let i = 0; i < 2; i += 1) {
        const period = 14 + i * 5;
        const k = ((live.t + i * 7) % period) / 6;
        if (k < 1) {
          const bx = -30 + k * (stageWidth + 60);
          const by = floor.horizon * (0.25 + i * 0.15) + Math.sin(k * 12) * 10;
          bat(c, bx, by, 0.9, '#15111c', Math.sin(live.t * 18));
        }
      }
    }
  };
  decorPlans.set(scene, { key, plan });
  return plan;
}
