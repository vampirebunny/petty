import { Skia, TileMode } from '@shopify/react-native-skia';
import type { SkCanvas, SkFont } from '@shopify/react-native-skia';

import { sideOctant } from '../../actor/facing';
import type { Actor, Breed } from '../../actor/types';
import { fillCircle, fillOval, fillRect, paintOf, strokeLine, strokeOval } from '../../ui/skia/draw';
import { drawActor } from '../../ui/skia/pet';
import { COLLECT, WORLD_W } from './content';
import type { CollectKind } from './content';
import { birdPoints } from './generator';
import type { Cloud, Item, Run } from './types';

const SKY: [number, string, string][] = [
  [0, '#ffd6ea', '#c9ecff'],
  [2500, '#d9c4ff', '#ffd6ee'],
  [6000, '#7d5fc0', '#f3a3cf'],
  [10000, '#241d55', '#6a4a9e'],
  [16000, '#0f0c2e', '#2c2160'],
];

const CLOUD_COL: Record<Cloud['type'], [string, string]> = {
  normal: ['#ffffff', '#e28cc8'],
  bouncy: ['#ffc4e4', '#e2569b'],
  rain: ['#d3e3f0', '#6e8cb4'],
  elevator: ['#eef3ff', '#8c96dc'],
  thunder: ['#a998d0', '#463278'],
};

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function hexOf(value: number): string {
  return value.toString(16).padStart(2, '0');
}

function mixHex(a: string, b: string, k: number): string {
  const parse = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const from = parse(a);
  const to = parse(b);
  return `#${from.map((channel, index) => hexOf(Math.round(channel + (to[index] - channel) * k))).join('')}`;
}

function skyAt(altitude: number): [string, string] {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [a0, top0, bot0] = SKY[i];
    const [a1, top1, bot1] = SKY[i + 1];
    if (altitude <= a1) {
      const k = clamp((altitude - a0) / (a1 - a0), 0, 1);
      return [mixHex(top0, top1, k), mixHex(bot0, bot1, k)];
    }
  }
  const last = SKY[SKY.length - 1];
  return [last[1], last[2]];
}

function puff(c: SkCanvas, x: number, y: number, w: number, color: string, alpha = 1): void {
  const r = Math.min(w, 110) * 0.17;
  const n = Math.max(3, Math.round(w / 36));
  const span = w / 2 - r * 1.05;
  fillOval(c, x, y + r * 0.35, w / 2, r * 0.9, color, alpha);
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : i / (n - 1);
    const px = x - span + k * span * 2;
    const mid = 1 - Math.abs(k - 0.5) * 2;
    const s = 0.95 + mid * 0.5 + Math.sin(i * 2.3 + w) * 0.08;
    fillCircle(c, px, y - r * 0.3 * mid, r * s, color, alpha);
  }
}

function drawCloud(c: SkCanvas, cloud: Cloud, camY: number, t: number, H: number): void {
  const y = cloud.y - camY;
  if (y < -50 || y > H + 50) {
    return;
  }
  const w = cloud.w * (1 + cloud.sq * 0.25);
  const [top, shade] = CLOUD_COL[cloud.type];
  c.save();
  c.translate(cloud.x, y);
  c.scale(1, 1 - cloud.sq * 0.4);
  c.translate(-cloud.x, -y);
  if (cloud.type === 'thunder' && (cloud.warn || cloud.zap)) {
    puff(c, cloud.x, y, w + 18, '#ffe65a', cloud.zap ? 0.8 : 0.45);
  }
  puff(c, cloud.x, y + 6, w, shade, 0.45 * cloud.alpha);
  puff(c, cloud.x, y, w, cloud.zap ? '#fff6c2' : top, cloud.alpha);
  fillOval(c, cloud.x - w * 0.15, y - w * 0.06, w * 0.16, w * 0.05, '#ffffff', 0.85 * cloud.alpha);
  c.restore();
  if (cloud.type === 'rain' && cloud.timer >= 0) {
    for (let i = 0; i < 4; i++) {
      const dx = cloud.x - cloud.w * 0.3 + i * cloud.w * 0.2;
      const ph = (t * 3 + i * 0.37) % 1;
      strokeLine(c, dx, y + 10 + ph * 30, dx, y + 16 + ph * 30, '#6e96d2', 2, 0.8);
    }
  }
  if (cloud.type === 'thunder' && cloud.zap) {
    strokeLine(c, cloud.x, y + 8, cloud.x - 8, y + 28, '#ffe35a', 3.5);
    strokeLine(c, cloud.x - 8, y + 28, cloud.x + 5, y + 30, '#ffe35a', 3.5);
    strokeLine(c, cloud.x + 5, y + 30, cloud.x - 4, y + 58, '#ffe35a', 3.5);
  }
  if (cloud.type === 'bouncy') {
    strokeOval(c, cloud.x + w * 0.05, y - 2, w * 0.12, w * 0.12, '#e2569b', 3, 0.45);
  }
}

function drawCoin(c: SkCanvas, item: Item, camY: number, t: number): void {
  const y = item.y - camY + Math.sin(t * 3 + item.ph) * 3;
  fillCircle(c, item.x, y + 1.5, 11, '#c93d84');
  fillCircle(c, item.x, y, 11, '#ff9fcc');
  fillCircle(c, item.x, y - 2, 5, '#ffe3f1', 0.7);
  fillCircle(c, item.x, y + 2.5, 3.2, '#c93d84');
  for (const [dx, dy] of [
    [-4.6, -2.4],
    [-1.6, -5],
    [1.6, -5],
    [4.6, -2.4],
  ] as const) {
    fillCircle(c, item.x + dx, y + dy, 1.6, '#c93d84');
  }
}

function drawCollectible(c: SkCanvas, item: Item, camY: number, t: number): void {
  const y = item.y - camY + Math.sin(t * 2.4 + item.ph) * 4;
  const kind = item.k as CollectKind;
  const color = COLLECT[kind].col;
  fillCircle(c, item.x, y, 16, color, 0.28);
  if (kind === 'biscuit') {
    fillCircle(c, item.x, y, 12, '#eeb06a');
    fillCircle(c, item.x, y, 10, '#f3c48a');
  } else if (kind === 'yarn') {
    fillCircle(c, item.x, y, 11, '#ff9fcc');
    strokeOval(c, item.x, y, 10, 4, '#e2569b', 1.5);
  } else if (kind === 'duck') {
    fillOval(c, item.x - 1, y + 3, 12, 8, '#ffd23f');
    fillCircle(c, item.x + 5, y - 5, 7, '#ffd23f');
    fillOval(c, item.x + 12, y - 3, 4, 2.4, '#ff8a3d');
  } else if (kind === 'bell') {
    fillCircle(c, item.x, y, 11, '#f5c23a');
    fillRect(c, item.x - 12, y + 6, 24, 4, '#c98a12');
  } else {
    fillCircle(c, item.x, y, 12, '#c9b6ff');
    fillCircle(c, item.x, y, 5, '#fff4bf');
  }
}

function drawPickup(c: SkCanvas, item: Item, camY: number, t: number): void {
  const y = item.y - camY + Math.sin(t * 2 + item.x) * 4;
  fillCircle(c, item.x, y, 16, '#ffffff', 0.55);
  strokeOval(c, item.x, y, 16, 16, '#ffffff', 2);
  if (item.k === 'balloon') {
    fillOval(c, item.x, y - 2, 8, 10, '#ff6fa8');
  } else if (item.k === 'umbrella') {
    fillOval(c, item.x, y - 2, 12, 7, '#8fd0ff');
    strokeLine(c, item.x, y, item.x, y + 12, '#4a2f5e', 1.6);
  } else {
    strokeOval(c, item.x, y - 2, 7, 7, '#ef5b7c', 4);
  }
}

function drawBird(c: SkCanvas, x: number, y: number, dir: number, kind: string, warn: boolean, t: number): void {
  const body = kind === 'crow' ? '#2e2a3d' : kind === 'diver' ? '#6a4f8a' : '#4f5d80';
  if (warn) {
    fillCircle(c, x, y, 22, '#ff5a78', 0.4);
  }
  c.save();
  c.translate(x, y);
  c.scale(dir, 1);
  fillOval(c, 0, 0, 15, 9, body);
  fillOval(c, -16, 0, 6, 4, body);
  fillOval(c, 2, -6, 8, 4, kind === 'crow' ? '#47425c' : '#6e7ea6');
  fillCircle(c, 8, -3, 3.2, '#ffffff');
  fillCircle(c, 9, -3, 1.7, '#1d1b33');
  c.restore();
  if (warn) {
    fillCircle(c, x, y - 22, 4, '#e2365f');
  }
  void t;
}

function drawText(c: SkCanvas, text: string, x: number, y: number, color: string, font: SkFont, alpha: number): void {
  const width = font.getTextWidth(text);
  const paint = paintOf(color, alpha);
  c.drawText(text, x - width / 2, y, paint, font);
}

function drawPet(
  c: SkCanvas,
  run: Run,
  actor: Actor,
  breed: Breed,
): void {
  const pet = run.pet;
  const py = pet.y - run.camY;
  const side = sideOctant(pet.face);
  actor.x = 0;
  actor.y = 0;
  actor.face = pet.face;
  actor.octant = side;
  actor.octantFrom = side;
  actor.octantTarget = side;
  actor.octantBlend = 1;
  actor.pose.tuck = pet.on || pet.dead ? 0 : 1;
  actor.jump = null;
  c.save();
  c.translate(pet.x, py);
  if (pet.rot) {
    c.rotate((pet.rot * 180) / Math.PI, 0, -18);
  }
  const squashX = 1 + pet.sq * 0.5;
  const squashY = Math.max(0.45, 1 - pet.sq);
  c.scale(squashX * 0.42, squashY * 0.42);
  const blink = pet.inv > 0 && Math.floor(run.t * 14) % 2 === 0;
  if (blink) {
    const veil = Skia.Paint();
    veil.setAlphaf(0.45);
    c.saveLayer(veil);
  }
  drawActor(c, actor, breed, { yMin: 0, yMax: 40 }, run.t, null);
  if (blink) {
    c.restore();
  }
  c.restore();
}

export function drawCloudHop(
  c: SkCanvas,
  run: Run,
  actor: Actor | null,
  breed: Breed | null,
  font: SkFont | null,
  fontLg: SkFont | null,
  screenW: number,
  screenH: number,
): void {
  const scale = screenW / WORLD_W;
  c.save();
  c.scale(scale, scale);
  const altitude = run.startY - run.camY;
  const [top, bottom] = skyAt(altitude);
  const sky = Skia.Paint();
  sky.setAntiAlias(true);
  sky.setShader(
    Skia.Shader.MakeLinearGradient(
      Skia.Point(0, 0),
      Skia.Point(0, run.H),
      [Skia.Color(top), Skia.Color(bottom)],
      null,
      TileMode.Clamp,
    ),
  );
  c.drawRect(Skia.XYWHRect(0, 0, WORLD_W, run.H), sky);
  const starAlpha = clamp((altitude - 5000) / 4000, 0, 1);
  if (starAlpha > 0) {
    for (const star of run.stars) {
      fillCircle(c, star.x, star.y * run.H, star.r, '#ffffff', starAlpha * (0.5 + 0.5 * Math.sin(run.t * 2 + star.p)));
    }
  }
  for (const puffCloud of run.far) {
    const span = 260 * run.far.length;
    const y = (((puffCloud.y - run.camY * 0.3) % span) + span) % span - 80;
    puff(c, puffCloud.x, y, puffCloud.w, '#ffffff', 0.3 * (1 - starAlpha * 0.6));
  }
  for (const wind of run.winds) {
    const y0 = wind.y0 - run.camY;
    const y1 = wind.y1 - run.camY;
    if (y1 < -10 || y0 > run.H + 10) {
      continue;
    }
    fillRect(c, 0, y0, WORLD_W, y1 - y0, '#ffffff', 0.1);
    for (let i = 0; i < 7; i++) {
      const span = WORLD_W + 80;
      const x = (((run.t * 170 * wind.dir + i * 63 + wind.seed) % span) + span) % span - 40;
      const y = y0 + (y1 - y0) * ((i * 0.37 + 0.15) % 1);
      strokeLine(c, x, y, x - wind.dir * 26, y, '#ffffff', 2, 0.65);
    }
  }
  for (const cloud of run.clouds) {
    drawCloud(c, cloud, run.camY, run.t, run.H);
  }
  for (const item of run.items) {
    if (item.got) {
      continue;
    }
    const sy = item.y - run.camY;
    if (sy < -30 || sy > run.H + 30) {
      continue;
    }
    if (item.k === 'coin') {
      drawCoin(c, item, run.camY, run.t);
    } else if (item.k in COLLECT) {
      drawCollectible(c, item, run.camY, run.t);
    } else {
      drawPickup(c, item, run.camY, run.t);
    }
  }
  for (const bird of run.birds) {
    if (bird.kind === 'flock') {
      for (const point of birdPoints(bird)) {
        const sy = point.y - run.camY;
        if (sy > -30 && sy < run.H + 30) {
          drawBird(c, point.x, sy, bird.vx > 0 ? 1 : -1, 'bird', false, run.t);
        }
      }
      continue;
    }
    const dir = bird.st === 'dive' ? Math.sign(bird.dx || 1) || 1 : bird.vx > 0 ? 1 : -1;
    drawBird(c, bird.x, bird.y - run.camY, dir, bird.kind, bird.st === 'warn', run.t);
  }
  const py = run.pet.y - run.camY;
  if (run.pet.balloon > 0) {
    fillOval(c, run.pet.x - 4, py - 74, 10, 12.5, '#ff6fa8');
    strokeLine(c, run.pet.x - 4, py - 60, run.pet.x - 4, py - 44, '#4a2f5e', 1.2, 0.6);
  }
  if (run.pet.umbAnim > 0) {
    fillOval(c, run.pet.x, py - 56, 18, 10, '#8fd0ff');
    strokeLine(c, run.pet.x, py - 50, run.pet.x, py - 32, '#4a2f5e', 1.6);
  }
  if (run.pet.magnet > 0) {
    strokeOval(
      c,
      run.pet.x,
      py - 18,
      34 + 4 * Math.sin(run.t * 6),
      34 + 4 * Math.sin(run.t * 6),
      '#ef5b7c',
      2,
      0.25 + 0.15 * Math.sin(run.t * 8),
    );
  }
  if (actor && breed) {
    drawPet(c, run, actor, breed);
  }
  const fy = run.fogY - run.camY;
  if (fy < run.H + 10) {
    const fog = Skia.Paint();
    fog.setAntiAlias(true);
    fog.setShader(
      Skia.Shader.MakeLinearGradient(
        Skia.Point(0, fy - 90),
        Skia.Point(0, fy + 10),
        [Skia.Color('rgba(255,182,220,0)'), Skia.Color('rgba(255,170,215,0.7)')],
        null,
        TileMode.Clamp,
      ),
    );
    c.drawRect(Skia.XYWHRect(0, fy - 90, WORLD_W, run.H - (fy - 90) + 20), fog);
    fillRect(c, 0, fy, WORLD_W, run.H - fy + 30, '#ffa8d6', 0.95);
  }
  for (const floater of run.fx) {
    const face = floater.size >= 22 ? fontLg : font;
    if (!face) {
      continue;
    }
    const alpha = clamp(floater.life / 0.5, 0, 1);
    drawText(c, floater.txt, floater.x, floater.y - run.camY, '#ffffff', face, alpha);
    drawText(c, floater.txt, floater.x, floater.y - run.camY, floater.col, face, alpha);
  }
  if (run.hitboxes) {
    strokeOval(c, run.pet.x, py - 18, 12, 16, '#ff4d6a', 1.5);
    for (const bird of run.birds) {
      for (const point of birdPoints(bird)) {
        strokeOval(c, point.x, point.y - run.camY, 21, 16, '#ffd23f', 1);
      }
    }
  }
  c.restore();
  void screenH;
}
