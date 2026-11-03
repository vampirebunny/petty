import { PaintStyle, Skia, StrokeCap, StrokeJoin, TileMode } from '@shopify/react-native-skia';
import type { SkCanvas, SkFont, SkPaint, SkPath } from '@shopify/react-native-skia';

import type { Actor, Breed } from '../../actor/types';
import { deg, fillCircle, fillOval, fillRect, oval, paintOf, strokeLine } from '../../ui/skia/draw';
import { drawActor } from '../../ui/skia/pet';
import { columnWidth, WORLD_W, type OfferKind } from './content';
import { PAW_Y, PET_FLOOR, petFit, petHead, type PetDrive } from './petDrive';
import type { Obstacle, Pickup, Run, Squirrel } from './types';

const TAU = Math.PI * 2;
const SHADOW = '#1e3c14';

const SQ: Record<Squirrel['kind'], { body: string; tail: string }> = {
  scout: { body: '#b8743f', tail: '#d6955a' },
  glider: { body: '#9c8466', tail: '#bba283' },
  lobber: { body: '#8a5634', tail: '#a8703f' },
  hoarder: { body: '#c27f45', tail: '#dc9d62' },
};

const GATE: Record<OfferKind, { color: string; shade: string; label: string }> = {
  laser: { color: '#ff4f7a', shade: '#c9244c', label: 'Laser +' },
  shield: { color: '#53a8ff', shade: '#2a6fc4', label: 'Shield' },
  magnet: { color: '#a57cff', shade: '#6b46c9', label: 'Magnet' },
  heart: { color: '#ff6fae', shade: '#d23c82', label: 'Heart' },
};

function hr(n: number, k: number): number {
  const x = Math.sin(n * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function ell(c: SkCanvas, x: number, y: number, rx: number, ry: number, color: string, rot = 0, alpha = 1): void {
  if (!rot) {
    fillOval(c, x, y, rx, ry, color, alpha);
    return;
  }
  c.save();
  c.translate(x, y);
  c.rotate(deg(rot), 0, 0);
  fillOval(c, 0, 0, rx, ry, color, alpha);
  c.restore();
}

function fillPath(c: SkCanvas, path: SkPath, color: string, alpha = 1): void {
  c.drawPath(path, paintOf(color, alpha));
}

function strokePath(c: SkCanvas, path: SkPath, color: string, width: number, alpha = 1): void {
  c.drawPath(path, paintOf(color, alpha, width));
}

const layers = new Map<number, SkPaint>();

// Group opacity, like canvas globalAlpha over a whole drawing.
function layered(c: SkCanvas, alpha: number, draw: () => void): void {
  if (alpha >= 0.999) {
    draw();
    return;
  }
  if (alpha <= 0.001) {
    return;
  }
  const key = Math.round(alpha * 100);
  let paint = layers.get(key);
  if (!paint) {
    paint = Skia.Paint();
    paint.setAlphaf(key / 100);
    layers.set(key, paint);
  }
  c.saveLayer(paint);
  draw();
  c.restore();
}

function star(c: SkCanvas, x: number, y: number, r: number, color: string): void {
  const path = Skia.PathBuilder.Make();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    if (i === 0) {
      path.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    } else {
      path.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
  }
  path.close();
  fillPath(c, path.detach(), color);
}

// Canvas `arc(x, y, r, from, to)` drawn clockwise.
function arcPath(x: number, y: number, r: number, from: number, to: number): SkPath {
  const path = Skia.PathBuilder.Make();
  path.addArc(oval(x, y, r, r), deg(from), deg(to - from));
  return path.detach();
}

function drawGround(c: SkCanvas, scroll: number, H: number, x0: number, x1: number): void {
  fillRect(c, x0 - 10, -10, x1 - x0 + 20, H + 20, '#7cc96b');
  const band = 96;
  const off = scroll % (band * 2);
  for (let y = -band * 2 + off; y < H + band; y += band * 2) {
    fillRect(c, x0 - 10, y, x1 - x0 + 20, band, '#86d374');
  }
  const cell = 58;
  const base = scroll % cell;
  const rowBase = Math.floor(scroll / cell);
  const first = Math.floor(x0 / WORLD_W);
  const last = Math.ceil(x1 / WORLD_W);
  const tufts = Skia.PathBuilder.Make();
  for (let panel = first; panel < last; panel += 1) {
    const px = panel * WORLD_W;
    const salt = panel * 97;
    for (let r = -1; r < H / cell + 1; r += 1) {
      const y = r * cell + base;
      const id = r - rowBase + salt;
      for (let k = 0; k < 3; k += 1) {
        const x = px + hr(id, k) * WORLD_W;
        const yy = y + hr(id, k + 7) * cell;
        tufts.moveTo(x - 4, yy + 3);
        tufts.lineTo(x - 6, yy - 4);
        tufts.moveTo(x, yy + 3);
        tufts.lineTo(x, yy - 6);
        tufts.moveTo(x + 4, yy + 3);
        tufts.lineTo(x + 6, yy - 4);
      }
      if (hr(id, 20) < 0.32) {
        const x = px + hr(id, 21) * WORLD_W;
        const yy = y + hr(id, 22) * cell;
        const petal = hr(id, 23) < 0.5 ? '#ff9fc5' : '#ffd35c';
        for (let p = 0; p < 5; p += 1) {
          const a = (p / 5) * TAU;
          fillCircle(c, x + Math.cos(a) * 3.6, yy + Math.sin(a) * 3.6, 2.8, petal);
        }
        fillCircle(c, x, yy, 2.2, '#ff8a3d');
      }
      if (hr(id, 30) < 0.22) {
        const x = px + hr(id, 31) * WORLD_W;
        const yy = y + hr(id, 32) * cell;
        for (let p = 0; p < 3; p += 1) {
          const a = (p / 3) * TAU - 1.57;
          fillCircle(c, x + Math.cos(a) * 3.4, yy + Math.sin(a) * 3.4, 3.4, '#5aa94f');
        }
      }
    }
  }
  strokePath(c, tufts.detach(), '#5fae55', 2);
}

function drawAcorn(c: SkCanvas, x: number, y: number, s: number, rot = 0): void {
  c.save();
  c.translate(x, y);
  if (rot) {
    c.rotate(deg(rot), 0, 0);
  }
  c.scale(s, s);
  fillOval(c, 0, 1.5, 4, 5, '#c98a4b');
  fillOval(c, -1.2, 0.5, 1.2, 2.4, '#dda46a');
  fillOval(c, 0, -2.5, 4.8, 2.4, '#7d4c27');
  fillRect(c, -0.6, -6, 1.2, 2.2, '#5f3819');
  c.restore();
}

// The prototype squirrel, 16 units to a radius of 16.
export function drawSquirrelArt(
  c: SkCanvas,
  kind: Squirrel['kind'],
  x: number,
  y: number,
  r: number,
  t: number,
  flash: number,
  rot: number,
): void {
  const P = SQ[kind];
  const s = r / 16;
  c.save();
  c.translate(x, y);
  if (rot) {
    c.rotate(deg(rot), 0, 0);
  }
  c.scale(s, s);
  if (!rot) {
    fillOval(c, 2, 17, 11, 3.6, SHADOW, 0.22);
  }
  if (kind === 'glider') {
    const wing = Skia.PathBuilder.Make();
    wing.moveTo(-6, -2);
    wing.quadTo(-25, -1, -21, 12);
    wing.quadTo(-9, 9, 0, 14);
    wing.quadTo(9, 9, 21, 12);
    wing.quadTo(25, -1, 6, -2);
    wing.close();
    fillPath(c, wing.detach(), '#c7ae8e');
  }
  const w = Math.sin(t * 6) * 2;
  const tail = Skia.PathBuilder.Make();
  tail.moveTo(3, 8);
  tail.cubicTo(22 + w, 6, 24 + w, -22, 8 + w, -26);
  tail.cubicTo(3 + w, -27, -1, -24, 2, -20);
  tail.cubicTo(14, -16, 12, -2, -1, 4);
  tail.close();
  fillPath(c, tail.detach(), P.tail);
  fillOval(c, 0, 7, 10, 10.5, P.body);
  fillOval(c, 0, 9, 6, 7, '#f4dcb8');
  fillOval(c, -5, 16, 3.5, 2.2, P.body);
  fillOval(c, 5, 16, 3.5, 2.2, P.body);
  if (kind === 'lobber') {
    drawAcorn(c, 0, 6, 1.15);
    fillOval(c, -4.5, 6, 2.6, 2, P.body);
    fillOval(c, 4.5, 6, 2.6, 2, P.body);
  }
  fillCircle(c, 0, -6, 10, P.body);
  ell(c, -7, -14.5, 3, 4.5, P.body, -0.3);
  ell(c, 7, -14.5, 3, 4.5, P.body, 0.3);
  ell(c, -7, -14, 1.5, 2.6, '#f1a8a0', -0.3);
  ell(c, 7, -14, 1.5, 2.6, '#f1a8a0', 0.3);
  if (kind === 'hoarder') {
    fillOval(c, -7.4, -2, 5.8, 5, '#f0c48e');
    fillOval(c, 7.4, -2, 5.8, 5, '#f0c48e');
  }
  fillOval(c, 0, -2.5, 4.5, 3.2, '#f4dcb8');
  fillCircle(c, -3.8, -7.5, 2.3, '#2c1d33');
  fillCircle(c, 3.8, -7.5, 2.3, '#2c1d33');
  fillCircle(c, -3.1, -8.3, 0.8, '#ffffff');
  fillCircle(c, 4.5, -8.3, 0.8, '#ffffff');
  strokeLine(c, -6.6, -11.6, -2, -10.2, '#4a2c1c', 1.3);
  strokeLine(c, 6.6, -11.6, 2, -10.2, '#4a2c1c', 1.3);
  fillOval(c, 0, -4.2, 1.4, 1, '#5a3324');
  fillRect(c, -1.3, -2.4, 2.6, 2.2, '#fffaf0');
  if (kind === 'scout') {
    fillOval(c, 0, -14.2, 8.6, 3.8, '#7d4c27');
    const hatch = Skia.PathBuilder.Make();
    for (let i = -6; i <= 6; i += 3) {
      hatch.moveTo(i - 1.5, -16.6);
      hatch.lineTo(i + 1.5, -12);
    }
    strokePath(c, hatch.detach(), '#5f3819', 0.7);
    fillRect(c, -0.7, -19.6, 1.4, 3, '#5f3819');
  }
  if (flash > 0) {
    fillOval(c, 0, -2, 13, 18, '#ffffff', 0.55);
  }
  c.restore();
}

function drawTreat(c: SkCanvas, item: Pickup): void {
  c.save();
  c.translate(item.x, item.y + Math.sin(item.t * 5) * 1.5);
  fillOval(c, 1, 7, 9, 2.4, SHADOW, 0.22);
  if (item.shape === 'fish') {
    const fish = Skia.PathBuilder.Make();
    fish.addOval(oval(-2, 0, 8.5, 5.2));
    fish.moveTo(5, 0);
    fish.lineTo(11.5, -5.2);
    fish.quadTo(10, 0, 11.5, 5.2);
    fish.close();
    fillPath(c, fish.detach(), '#e8ad66');
    fillOval(c, -3, -2.3, 5, 1.2, '#f6cf95');
    fillCircle(c, -6.4, -0.8, 1.1, '#8a5634');
    strokePath(c, arcPath(-1, 0, 3.4, -0.9, 0.9), '#c98a4b', 1.1);
  } else {
    const bone = Skia.PathBuilder.Make();
    for (const [a, b] of [
      [-8, -3],
      [-8, 3],
      [8, -3],
      [8, 3],
    ]) {
      bone.addCircle(a, b, 3.6);
    }
    bone.addRect(Skia.XYWHRect(-8, -2.6, 16, 5.2));
    fillPath(c, bone.detach(), '#e8ad66');
    fillRect(c, -7, -2.2, 14, 1.6, '#f6cf95');
  }
  c.restore();
}

const gatePaints = new Map<OfferKind, SkPaint>();

function gatePaint(kind: OfferKind): SkPaint {
  const hit = gatePaints.get(kind);
  if (hit) {
    return hit;
  }
  const gate = GATE[kind];
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setShader(
    Skia.Shader.MakeTwoPointConicalGradient(
      { x: -7, y: -8 },
      1,
      { x: 0, y: 0 },
      21,
      [Skia.Color('#ffffff'), Skia.Color(gate.color), Skia.Color(gate.shade)],
      [0, 0.3, 1],
      TileMode.Clamp,
    ),
  );
  gatePaints.set(kind, paint);
  return paint;
}

const labelStroke = (() => {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeJoin(StrokeJoin.Round);
  paint.setStrokeCap(StrokeCap.Round);
  return paint;
})();

// Outlined centered text at `size` points, as the prototype's strokeText plus fillText.
function outlined(
  c: SkCanvas,
  font: SkFont,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  stroke: string,
  strokeAlpha: number,
  strokeWidth: number,
): void {
  const k = size / font.getSize();
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  const width = font.getTextWidth(text);
  labelStroke.setColor(Skia.Color(stroke));
  labelStroke.setAlphaf(strokeAlpha);
  labelStroke.setStrokeWidth(strokeWidth / k);
  c.drawText(text, -width / 2, 0, labelStroke, font);
  c.drawText(text, -width / 2, 0, paintOf(fill), font);
  c.restore();
}

function drawGate(c: SkCanvas, kind: OfferKind, x: number, y: number, t: number, font: SkFont | null): void {
  c.save();
  c.translate(x, y + Math.sin(t * 4) * 2);
  fillOval(c, 0, 23, 15, 3.8, SHADOW, 0.22);
  c.drawCircle(0, 0, 20, gatePaint(kind));
  c.drawCircle(0, 0, 20, paintOf('#ffffff', 0.8, 2));
  if (kind === 'laser') {
    strokeLine(c, -4, 9, -4, -9, '#ffffff', 3.6);
    strokeLine(c, 3, 0, 11, 0, '#ffffff', 3);
    strokeLine(c, 7, -4, 7, 4, '#ffffff', 3);
  } else if (kind === 'shield') {
    c.drawCircle(0, 0, 9, paintOf('#ffffff', 1, 3.6));
  } else if (kind === 'magnet') {
    const path = Skia.PathBuilder.Make();
    path.moveTo(-7, -8);
    path.lineTo(-7, 0);
    path.arcToOval(oval(0, 0, 7, 7), 180, -180, false);
    path.lineTo(7, -8);
    strokePath(c, path.detach(), '#ffffff', 3.6);
  } else {
    const path = Skia.PathBuilder.Make();
    path.moveTo(0, 8);
    path.cubicTo(-13, -1, -7, -12, 0, -5);
    path.cubicTo(7, -12, 13, -1, 0, 8);
    fillPath(c, path.detach(), '#ffffff');
  }
  if (font) {
    outlined(c, font, GATE[kind].label, 0, 36, 12, '#ffffff', '#281e37', 0.6, 3.5);
  }
  c.restore();
}

function blob(x: number, y: number, r: number, seed: number): SkPath {
  const path = Skia.PathBuilder.Make();
  for (let k = 0; k < 9; k += 1) {
    const a = (k / 9) * TAU;
    const rr = r * (0.84 + 0.22 * hr(seed * 31, k));
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * 0.88;
    if (k === 0) {
      path.moveTo(px, py);
    } else {
      path.lineTo(px, py);
    }
  }
  path.close();
  return path.detach();
}

function drawObstacle(c: SkCanvas, o: Obstacle): void {
  const { x, y, r, seed } = o;
  if (o.kind === 'log') {
    const x1 = x - o.half;
    const x2 = x + o.half;
    strokeLine(c, x1 + 4, y + 7, x2 + 4, y + 7, SHADOW, r * 2, 0.22);
    strokeLine(c, x1, y, x2, y, '#8f5b37', r * 2);
    strokeLine(c, x1, y - r * 0.38, x2, y - r * 0.38, '#a8703f', r * 0.8);
    for (let k = 0; k < 7; k += 1) {
      const tx = x1 + (x2 - x1) * (0.1 + k * 0.13) + (hr(seed * 99, k) - 0.5) * 8;
      const ty = y + (hr(seed * 55, k) - 0.5) * r * 1.1;
      strokeLine(c, tx - 5, ty, tx + 5, ty + 1, '#6f4227', 1.8);
    }
    for (const ex of [x1, x2]) {
      if (ex < -r || ex > WORLD_W + r) {
        continue;
      }
      fillOval(c, ex, y, r * 0.55, r * 0.96, '#e0ad72');
      c.drawOval(oval(ex, y, r * 0.3, r * 0.55), paintOf('#b98352', 1, 1.2));
    }
    return;
  }
  if (o.kind === 'rock') {
    fillPath(c, blob(x + 4, y + 6, r, seed), SHADOW, 0.22);
    fillPath(c, blob(x, y, r, seed), '#9ea3b2');
    fillPath(c, blob(x - r * 0.18, y - r * 0.22, r * 0.62, seed + 3), '#c2c6d2');
    const crack = Skia.PathBuilder.Make();
    crack.moveTo(x + r * 0.15, y - r * 0.1);
    crack.lineTo(x + r * 0.35, y + r * 0.2);
    crack.lineTo(x + r * 0.25, y + r * 0.45);
    strokePath(c, crack.detach(), '#7f8494', 1.4);
    return;
  }
  fillOval(c, x + 4, y + 6, r, r * 0.9, SHADOW, 0.22);
  fillCircle(c, x, y, r, '#8a5a36');
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * TAU + seed;
    strokeLine(c, x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86, x + Math.cos(a) * r * 0.99, y + Math.sin(a) * r * 0.99, '#6f4227', 1.6);
  }
  fillCircle(c, x, y - 1.5, r * 0.8, '#e0ad72');
  for (const f of [0.58, 0.36, 0.16]) {
    c.drawCircle(x + 0.5, y - 1, r * f, paintOf('#c08a55', 1, 1.3));
  }
}

function drawLasers(c: SkCanvas, run: Run): void {
  const path = Skia.PathBuilder.Make();
  let any = false;
  for (const beam of run.lasers) {
    if (!beam.alive) {
      continue;
    }
    path.moveTo(beam.x, beam.y);
    path.lineTo(beam.x - beam.vx * 0.028, beam.y - beam.vy * 0.028);
    any = true;
  }
  if (!any) {
    return;
  }
  const beams = path.detach();
  strokePath(c, beams, '#ff4f7a', 8, 0.35);
  strokePath(c, beams, '#ff2d55', 3.6);
  strokePath(c, beams, '#ffd3dd', 1.4);
}

function drawSquirrels(c: SkCanvas, run: Run): void {
  for (const mob of run.squirrels) {
    if (!mob.alive) {
      continue;
    }
    if (mob.phase !== 'dazed') {
      const rot = mob.kind === 'glider' && mob.locked ? mob.rot : 0;
      drawSquirrelArt(c, mob.kind, mob.x, mob.y, mob.r, mob.age, mob.flash, rot);
    }
  }
}

function drawDazed(c: SkCanvas, run: Run): void {
  for (const mob of run.squirrels) {
    if (!mob.alive || mob.phase !== 'dazed') {
      continue;
    }
    const alpha = Math.max(0, 1 - mob.age / 0.9);
    layered(c, alpha, () => {
      drawSquirrelArt(c, mob.kind, mob.x, mob.y, mob.r, run.t, 0, mob.spin);
      for (let i = 0; i < 3; i += 1) {
        const an = run.t * 6 + (i * TAU) / 3;
        star(c, mob.x + Math.cos(an) * mob.r * 0.9, mob.y - mob.r * 0.9 + Math.sin(an) * mob.r * 0.3, 4, '#ffd447');
      }
    });
  }
}

const bandPaint = (() => {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeCap(StrokeCap.Butt);
  paint.setColor(Skia.Color('#ff4f7a'));
  return paint;
})();

function drawPet(c: SkCanvas, run: Run, drive: PetDrive, actor: Actor, breed: Breed, reduced: boolean): void {
  const k = petFit(drive, actor, breed);
  const down = run.phase === 'dying' || run.phase === 'over';
  const tilt = down ? (reduced ? 0 : Math.sin((1.1 - run.dieT) * 10) * 0.15) : run.lean;
  const blink = run.invuln > 0 && Math.floor(run.invuln * 12) % 2 === 1;
  const alpha = down ? 0.85 : blink ? 0.4 : 1;
  layered(c, alpha, () => {
    c.save();
    c.translate(run.petX, run.petY);
    if (tilt) {
      c.rotate(deg(tilt), 0, 0);
    }
    c.translate(0, PAW_Y);
    c.scale(k, k);
    drawActor(c, actor, breed, PET_FLOOR, run.t, null, false, reduced);
    const head = petHead(actor, breed);
    bandPaint.setStrokeWidth(3 / k);
    c.drawPath(arcPath(head.x, head.y, head.r * 0.99, Math.PI * 1.15, Math.PI * 1.85), bandPaint);
    const gemY = head.y - head.r * 0.98;
    fillCircle(c, head.x, gemY, 3.4 / k, '#ff2d55');
    fillCircle(c, head.x - 1 / k, gemY - 1 / k, 1.1 / k, '#ffc2cf');
    c.restore();
  });
}

let magnetPaint: SkPaint | null = null;

function drawAuras(c: SkCanvas, run: Run): void {
  if (run.shield) {
    fillCircle(c, run.petX, run.petY - 4, 27, '#78beff', 0.16);
    c.drawCircle(run.petX, run.petY - 4, 27, paintOf('#53a8ff', 0.85, 2.5));
  }
  if (run.magnet > 0) {
    if (!magnetPaint) {
      magnetPaint = Skia.Paint();
      magnetPaint.setAntiAlias(true);
      magnetPaint.setStyle(PaintStyle.Stroke);
      magnetPaint.setStrokeWidth(2);
      magnetPaint.setStrokeCap(StrokeCap.Butt);
      magnetPaint.setColor(Skia.Color('#a57cff'));
      magnetPaint.setAlphaf(0.5);
    }
    magnetPaint.setPathEffect(Skia.PathEffect.MakeDash([4, 6], -run.t * 30));
    c.drawCircle(run.petX, run.petY - 4, 36, magnetPaint);
  }
}

function drawFx(c: SkCanvas, run: Run): void {
  for (const f of run.fx) {
    if (!f.alive) {
      continue;
    }
    const k = f.max - f.life;
    const fade = Math.max(0, 1 - k / 0.35);
    if (f.kind === 'spark') {
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI / 2 + (i - 2) * 0.55;
        const r1 = 3 + k * 30;
        const r2 = 6 + k * 45;
        strokeLine(c, f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1, f.x + Math.cos(a) * r2, f.y + Math.sin(a) * r2, '#ff5078', 2, fade);
      }
    } else if (f.kind === 'puff') {
      fillCircle(c, f.x, f.y, 5 + k * 30, '#f0ece4', 0.9 * fade);
    } else {
      c.drawCircle(f.x, f.y, 27 + k * 90, paintOf('#53a8ff', fade, 3));
    }
  }
}

function drawPopups(c: SkCanvas, run: Run, font: SkFont): void {
  for (const item of run.popups) {
    if (!item.alive) {
      continue;
    }
    const age = 0.9 - item.life;
    const alpha = Math.max(0, 1 - Math.max(0, age - 0.5) / 0.4);
    layered(c, alpha, () => outlined(c, font, item.text, item.x, item.y, 19, item.color, '#ffffff', 1, 4));
  }
}

export function drawAcornAttack(
  c: SkCanvas,
  run: Run,
  actor: Actor | null,
  breed: Breed | null,
  drive: PetDrive,
  font: SkFont | null,
  screenW: number,
  screenH: number,
  reduced: boolean,
): void {
  const column = Math.max(1, columnWidth(screenW, screenH));
  const scale = column / WORLD_W;
  const left = (screenW - column) / 2;
  const origin = -left / scale;
  const width = screenW / scale;
  c.save();
  if (!reduced && run.shake > 0) {
    const mag = (run.shake / 0.3) * 5;
    c.translate((Math.sin(run.t * 45) * mag * scale) / 2, (Math.cos(run.t * 38) * mag * scale) / 2);
  }
  c.translate(left, 0);
  c.scale(scale, scale);
  drawGround(c, run.scroll, run.H, origin, origin + width);
  if (origin < -1) {
    fillRect(c, origin - 10, -10, -origin + 10, run.H + 20, SHADOW, 0.14);
  }
  if (origin + width > WORLD_W + 1) {
    fillRect(c, WORLD_W, -10, origin + width - WORLD_W + 10, run.H + 20, SHADOW, 0.14);
  }
  for (const item of run.pickups) {
    if (!item.alive || item.fade > 0) {
      continue;
    }
    if (item.kind === 'treat') {
      drawTreat(c, item);
    } else {
      drawGate(c, item.kind, item.x, item.y, item.t, font);
    }
  }
  for (const item of run.obstacles) {
    if (item.alive) {
      drawObstacle(c, item);
    }
  }
  drawLasers(c, run);
  drawSquirrels(c, run);
  for (const nut of run.acorns) {
    if (nut.alive) {
      drawAcorn(c, nut.x, nut.y, 1.25, nut.spin);
    }
  }
  if (actor && breed) {
    drawPet(c, run, drive, actor, breed, reduced);
  }
  drawAuras(c, run);
  drawDazed(c, run);
  drawFx(c, run);
  for (const item of run.pickups) {
    if (!item.alive || item.fade <= 0 || item.kind === 'treat') {
      continue;
    }
    const k = 0.4 - item.fade;
    const kind = item.kind;
    layered(c, item.fade / 0.4, () => drawGate(c, kind, item.x, item.y - k * 30, 0, font));
  }
  if (run.edge > 0) {
    c.drawRect(Skia.XYWHRect(0, 0, WORLD_W, run.H), paintOf('#ffffff', (run.edge / 0.6) * 0.7, 16));
  }
  if (font) {
    drawPopups(c, run, font);
  }
  c.restore();
}
