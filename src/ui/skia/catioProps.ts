import type { SkCanvas } from '@shopify/react-native-skia';

import { catTreeLayout, poleMint, polePink, poleSisal } from '../../actor/furnitureUse';
import type { Prop } from '../../actor/scenes';
import { stageWidth } from '../../actor/geometry';
import type { Env } from './env';
import { snowOn, weatherOf } from './env';
import { cachedPath, circle, clamp01, darken, ellipse, fill, hash, lighten, line, makePath, mixc, poly, rect, rrect, stroke } from './ink';
import { castShadow } from './light';
import { drawBush, foliageOf } from './nature';
import { extras, pawPrint, petNear, registerProp } from './props';
import { drawRoofDrips } from './weatherFx';

// The catio: a screened, roofed porch for cats, with a garden beyond the mesh where birds visit.

/** Seconds into the bird cycle when a bird is at the birdbath, or null. Lets cat behaviour watch it. */
export function birdVisit(t: number, env?: Env): { x: number; k: number } | null {
  if (env && (env.tod.dark > 0.55 || weatherOf(env).precip)) {
    return null;
  }
  const period = 38;
  const n = Math.floor(t / period);
  const k = (t % period) / 9;
  if (k > 1 || hash(n, 301) < 0.25) {
    return null;
  }
  return { x: hash(n, 302) < 0.5 ? -1 : 1, k };
}

function drawGarden(c: SkCanvas, prop: Prop, env: Env): void {
  // Drawn at the far edge of the deck: hedges, flowers, and a birdbath with the odd visitor.
  const bleed = env.bleed ?? 0;
  const w = (prop.w ?? stageWidth) + bleed * 2;
  const left = -w / 2;
  const f = foliageOf(env);
  const snow = snowOn(env);
  rect(c, left, -6, w, 10, snow > 0.2 ? '#eef3fb' : mixc('#6fae5e', '#b8a874', 1 - f.lush));
  for (let i = 0; i < Math.ceil(w / 52) + 1; i += 1) {
    c.save();
    c.translate(left + i * 52 + (hash(i, 311) - 0.5) * 12, 0);
    const s = 0.85 + hash(i, 312) * 0.35;
    c.scale(s, s);
    drawBush(c, env, i % 3 === 0 ? '#4f9450' : '#5aa65a', 0, i);
    c.restore();
  }
  if (f.season !== 'winter') {
    for (let i = 0; i < 18; i += 1) {
      const fx = left + hash(i, 313) * w;
      const col = ['#f6b9d0', '#fff1a8', '#ffffff', '#c9a8ff', '#ff8f6b'][i % 5];
      line(c, fx, 0, fx, -8 - hash(i, 314) * 6, '#5e9447', 1);
      circle(c, fx, -9 - hash(i, 314) * 6, 2.3, col, f.season === 'autumn' ? 0.5 : 1);
    }
  }
  // Birdbath.
  const bx = (prop.w ?? stageWidth) * 0.18;
  rect(c, bx - 2.5, -28, 5, 26, '#b9b4a8');
  ellipse(c, bx, -2, 9, 3, '#a9a397');
  ellipse(c, bx, -29, 15, 4, '#c9c4b8');
  ellipse(c, bx, -29.5, 11, 2.5, snow > 0.4 ? '#ffffff' : '#8fc7e6');
  const bird = birdVisit(env.t, env);
  if (bird && !env.reduced) {
    const fly = bird.k < 0.15 ? 1 - bird.k / 0.15 : bird.k > 0.85 ? (bird.k - 0.85) / 0.15 : 0;
    const hop = Math.abs(Math.sin(env.t * 5)) * (fly > 0 ? 0 : 2);
    const px = bx + bird.x * (8 + fly * 70);
    const py = -33 - hop - fly * 50;
    const dir = -bird.x;
    ellipse(c, px, py, 5, 3.6, '#c4553a');
    ellipse(c, px + dir * 1, py + 1.2, 3.4, 2.2, '#f2c3a0');
    circle(c, px + dir * 4, py - 2.5, 2.6, '#c4553a');
    circle(c, px + dir * 5, py - 3, 0.6, '#1a1a1a');
    poly(c, [px + dir * 6.4, py - 2.8, px + dir * 8.6, py - 2.2, px + dir * 6.4, py - 1.8], '#e0a93a');
    poly(c, [px - dir * 4, py - 0.5, px - dir * 9, py - 2.5, px - dir * 8, py + 1], '#9a3f2a');
    if (fly > 0) {
      const flap = Math.sin(env.t * 30) * 4;
      poly(c, [px - 2, py - 1, px + 2, py - 1, px, py - 5 - flap], '#9a3f2a');
    }
  }
}

function drawCatioScreen(c: SkCanvas, prop: Prop, env: Env): void {
  // Local origin is the deck edge (stage centre, horizon). h is the mesh height up to the roof beam.
  const bleed = env.bleed ?? 0;
  const w = (prop.w ?? stageWidth) + bleed * 2;
  const h = prop.h ?? 220;
  const left = -w / 2;
  const wood = prop.color ?? '#a8774f';
  const snow = snowOn(env);
  // Roof panels from the beam up to the top of the stage, translucent so the sky glows through.
  const roofTop = -h - 400;
  rect(c, left, roofTop, w, 400, '#e6eef2', 0.42);
  if (snow > 0.05) {
    rect(c, left, roofTop, w, 400, '#f4f7ff', snow * 0.55);
  }
  for (let x = left - (left % 14); x < left + w; x += 14) {
    line(c, x, roofTop, x + 5, -h, '#ffffff', 1, 0.25);
  }
  // Mesh.
  const grid = 9;
  const mesh = cachedPath(`mesh|${Math.round(left)}|${Math.round(w)}|${Math.round(h)}`, (p) => {
    for (let x = left - (left % grid); x <= left + w; x += grid) {
      p.moveTo(x, -h);
      p.lineTo(x, -12);
    }
    for (let y = -h; y <= -12; y += grid) {
      p.moveTo(left, y);
      p.lineTo(left + w, y);
    }
  });
  c.drawPath(mesh, stroke('#2d3436', 0.7, 0.2));
  // Rails, posts and the roof beam.
  rect(c, left, -14, w, 14, darken(wood, 0.1));
  rect(c, left, -14, w, 3, lighten(wood, 0.2), 0.7);
  rect(c, left, -h * 0.5 - 3, w, 6, wood);
  const postGap = stageWidth / 3;
  const start = -stageWidth / 2 - Math.ceil(bleed / postGap) * postGap;
  for (let x = start; x <= w / 2 + 1; x += postGap) {
    rect(c, x - 5, -h, 10, h, wood);
    rect(c, x - 5, -h, 3, h, lighten(wood, 0.18), 0.7);
    rect(c, x + 3, -h, 2, h, darken(wood, 0.25), 0.8);
  }
  rect(c, left, -h - 6, w, 12, darken(wood, 0.08));
  rect(c, left, -h - 6, w, 3, lighten(wood, 0.2), 0.7);
  drawRoofDrips(c, left, left + w, -h + 6, env);
}

function drawCatioPost(c: SkCanvas, prop: Prop): void {
  const h = prop.h ?? 600;
  const wood = prop.color ?? '#a8774f';
  rect(c, -7, -h, 14, h, wood);
  rect(c, -7, -h, 4, h, lighten(wood, 0.18), 0.7);
  rect(c, 4, -h, 3, h, darken(wood, 0.25));
}

function sisal(c: SkCanvas, x: number, top: number, bottom: number, w: number): void {
  rect(c, x - w / 2, top, w, bottom - top, '#d9c49a');
  rect(c, x - w / 2, top, w * 0.3, bottom - top, '#e9d9b6', 0.7);
  for (let y = top + 3; y < bottom; y += 4) {
    line(c, x - w / 2, y, x + w / 2, y + 1.5, '#b39d6f', 0.8, 0.8);
  }
}

function scratchDust(c: SkCanvas, prop: Prop, env: Env): void {
  for (const speck of env.scratches ?? []) {
    if (speck.id !== prop.id || speck.a <= 0) {
      continue;
    }
    circle(c, speck.x - prop.x, speck.y - prop.y, 1.7, poleSisal, 0.85 * speck.a);
  }
}

function carpetPad(c: SkCanvas, x: number, y: number, w: number, color: string): void {
  rrect(c, x, y, w, 11, 5, darken(color, 0.15));
  rrect(c, x, y - 1, w, 8, 4, color);
  rect(c, x + 4, y, w - 8, 2, lighten(color, 0.2), 0.7);
}

function drawCatTree(c: SkCanvas, prop: Prop, env: Env): void {
  const mint = poleMint;
  castShadow(c, env, 0, 4, 90, 8, 200);
  carpetPad(c, catTreeLayout.pad.x0, catTreeLayout.pad.y, catTreeLayout.pad.x1 - catTreeLayout.pad.x0, mint);
  for (const post of catTreeLayout.posts) {
    sisal(c, post.x, post.yTop, post.yBottom, post.w);
  }
  for (const platform of catTreeLayout.platforms) {
    carpetPad(c, platform.x0, platform.y, platform.x1 - platform.x0, mint);
  }
  const top = catTreeLayout.platforms[2];
  ellipse(c, (top.x0 + top.x1) / 2, top.y - 4, 22, 6, darken(mint, 0.12));
  ellipse(c, (top.x0 + top.x1) / 2, top.y - 6, 16, 4, '#fff6fb');
  const sway = env.reduced ? 0 : Math.sin(env.t * 1.9) * 6 + (petNear(env, prop, 0.6, 40).near > 0.5 ? Math.sin(env.t * 9) * 6 : 0);
  const hang = catTreeLayout.platforms[1];
  line(c, hang.x0 + 16, hang.y, hang.x0 + 16 + sway, hang.y + 28, '#8a8a8a', 1);
  circle(c, hang.x0 + 16 + sway, hang.y + 32, 5.5, polePink);
  circle(c, hang.x0 + 14 + sway, hang.y + 30, 2, '#fff6fb', 0.8);
  scratchDust(c, prop, env);
}

function drawShelf(c: SkCanvas, prop: Prop): void {
  const w = prop.w ?? 70;
  const col = prop.color ?? '#b98a5e';
  // Brackets, plank, a carpet pad on top.
  for (const side of [-1, 1]) {
    poly(c, [side * (w / 2 - 12) - 2, 0, side * (w / 2 - 12) + 2, 0, side * (w / 2 - 12) + 2, 20, side * (w / 2 - 12) - 2, 12], darken(col, 0.3));
  }
  rect(c, -w / 2, -2, w, 8, col);
  rect(c, -w / 2, -2, w, 2, lighten(col, 0.25));
  rrect(c, -w / 2 + 4, -6, w - 8, 5, 2.5, '#9fb7a6');
}

function drawHammock(c: SkCanvas, prop: Prop, env: Env): void {
  const w = prop.w ?? 90;
  const col = prop.color ?? '#e09a6a';
  const frame = '#8a6a4c';
  castShadow(c, env, 0, 2, w / 2 + 6, 6, 40);
  // A-frame stand with a sling between the tops.
  for (const side of [-1, 1]) {
    const x = side * (w / 2);
    line(c, x - 8, 0, x, -46, frame, 4);
    line(c, x + 8, 0, x, -46, frame, 4);
  }
  line(c, -w / 2, -2, w / 2, -2, darken(frame, 0.1), 4);
  const { near } = petNear(env, prop, 0.8, 30);
  const sag = 22 + near * 6;
  const sling = makePath((p) => {
    p.moveTo(-w / 2, -44);
    p.quadTo(0, -44 + sag * 2, w / 2, -44);
    p.quadTo(0, -44 + sag * 0.9, -w / 2, -44);
    p.close();
  });
  c.drawPath(sling, fill(col));
  c.drawPath(
    makePath((p) => {
      p.moveTo(-w / 2 + 6, -42);
      p.quadTo(0, -44 + sag * 1.6, w / 2 - 6, -42);
    }),
    stroke(lighten(col, 0.3), 1.4, 0.7),
  );
  pawPrint(c, 0, -44 + sag * 1.25, 4, darken(col, 0.18), 0.8);
}

function drawPlanter(c: SkCanvas, prop: Prop, env: Env): void {
  const w = prop.w ?? 60;
  const col = prop.color ?? '#a8774f';
  const plant = extras(prop).plant ?? 'catgrass';
  const f = foliageOf(env);
  castShadow(c, env, 0, 2, w / 2 + 3, 5, 20);
  const wind = env.reduced ? 0 : (env.wind ?? 0.2) * 3;
  const { near, speed } = petNear(env, prop, 1, 30);
  const nibble = near * clamp01(speed / 40);
  if (plant === 'catgrass' || plant === 'catnip') {
    const green = plant === 'catgrass' ? '#7fc35a' : '#6aa86a';
    const n = Math.round(w / 2.2);
    for (let i = 0; i < n; i += 1) {
      const x = -w / 2 + 4 + (i / n) * (w - 8);
      const tall = plant === 'catgrass' ? 20 + hash(i, 321) * 14 : 12 + hash(i, 321) * 6;
      const sway = wind + Math.sin(env.t * 1.6 + i * 0.7) * (1.5 + nibble * 5) * (env.reduced ? 0 : 1);
      const blade = makePath((p) => {
        p.moveTo(x - 1.2, -18);
        p.quadTo(x + sway * 0.4, -18 - tall * 0.6, x + sway, -18 - tall);
        p.quadTo(x + sway * 0.4 + 1, -18 - tall * 0.5, x + 1.2, -18);
        p.close();
      });
      c.drawPath(blade, fill(i % 3 ? green : darken(green, 0.15)));
      if (plant === 'catnip' && i % 3 === 0) {
        ellipse(c, x + sway, -18 - tall, 3.4, 2.4, lighten(green, 0.1));
      }
    }
  } else {
    const colors = f.season === 'autumn' ? ['#e9a93b', '#c94a32'] : ['#f6b9d0', '#fff1a8', '#ffffff'];
    for (let i = 0; i < 7; i += 1) {
      const x = -w / 2 + 8 + (i / 6) * (w - 16);
      const sway = env.reduced ? 0 : wind + Math.sin(env.t * 1.3 + i) * 1.4;
      line(c, x, -18, x + sway, -32 - (i % 3) * 4, '#5e9447', 1.4);
      circle(c, x + sway, -33 - (i % 3) * 4, 3.4, colors[i % colors.length]);
    }
  }
  // The box: front face, top rim, planks.
  rect(c, -w / 2, -20, w, 20, col);
  rect(c, -w / 2 - 2, -22, w + 4, 4, lighten(col, 0.18));
  line(c, -w / 2, -10, w / 2, -10, darken(col, 0.22), 1);
  rect(c, -w / 2, -20, 3, 20, darken(col, 0.15));
  rect(c, w / 2 - 3, -20, 3, 20, darken(col, 0.15));
}

function drawScratcher(c: SkCanvas, prop: Prop, env: Env): void {
  const h = prop.h ?? 74;
  castShadow(c, env, 0, 2, 28, 6, h);
  carpetPad(c, -34, -8, 68, poleMint);
  sisal(c, 0, -h, -8, 16);
  ellipse(c, 0, -h, 12, 4, darken(poleSisal, 0.08));
  ellipse(c, 0, -h - 1, 10, 3, '#fff6fb');
  const sway = env.reduced ? 0 : Math.sin(env.t * 1.6) * 3;
  circle(c, 10 + sway, -h + 2, 5, polePink);
  const wear = petNear(env, prop, 1, 30).near;
  if (wear > 0.4) {
    for (let i = 0; i < 3; i += 1) {
      line(c, -4 + i * 3, -h * 0.6, -2 + i * 3, -h * 0.35, '#f2e6c8', 0.8, 0.8);
    }
  }
  scratchDust(c, prop, env);
}

registerProp('garden', drawGarden);
registerProp('catioScreen', drawCatioScreen);
registerProp('catioPost', (c, prop) => drawCatioPost(c, prop));
registerProp('catTree', drawCatTree);
registerProp('shelf', (c, prop) => drawShelf(c, prop));
registerProp('hammock', drawHammock);
registerProp('planter', drawPlanter);
registerProp('scratcher', drawScratcher);
