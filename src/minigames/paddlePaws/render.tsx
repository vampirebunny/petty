import { Skia } from '@shopify/react-native-skia';
import type { SkCanvas, SkFont } from '@shopify/react-native-skia';

import { sideOctant } from '../../actor/facing';
import type { Actor, Breed } from '../../actor/types';
import { fillCircle, fillGradient, fillOval, fillRRect, fillRect, mix, paintOf, strokeLine, strokeOval } from '../../ui/skia/draw';
import { drawActor } from '../../ui/skia/pet';
import { GATE_W, PET_X, PX_PER_M, TOP, UNLOCK, WORLD_W, ZONES } from './content';
import { floorY, gateCenter, itemY, jellyY, puffRadius } from './engine';
import type { Gate, Hazard, Item, Run } from './types';

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function zoneColors(meters: number): [string, string] {
  let index = 0;
  while (index < ZONES.length - 1 && meters >= ZONES[index + 1].from) {
    index += 1;
  }
  const here = ZONES[index];
  const next = ZONES[index + 1];
  if (!next) {
    return [here.top, here.bottom];
  }
  const span = next.from - here.from;
  const along = clamp((meters - here.from) / span, 0, 1);
  const blend = along < 0.7 ? 0 : (along - 0.7) / 0.3;
  return [mix(here.top, next.top, blend), mix(here.bottom, next.bottom, blend)];
}

function drawText(
  c: SkCanvas,
  text: string,
  x: number,
  y: number,
  color: string,
  font: SkFont,
  alpha = 1,
  outline = false,
): void {
  const width = font.getTextWidth(text);
  const left = x - width / 2;
  if (outline) {
    for (const [dx, dy] of [
      [-1.6, 0],
      [1.6, 0],
      [0, -1.6],
      [0, 1.6],
    ] as const) {
      c.drawText(text, left + dx, y + dy, paintOf('#ffffff', alpha), font);
    }
  }
  c.drawText(text, left, y, paintOf(color, alpha), font);
}

function chevron(c: SkCanvas, x: number, y: number, up: boolean, alpha: number): void {
  const d = up ? -1 : 1;
  const path = Skia.Path.Make();
  path.moveTo(x - 9, y - d * 4);
  path.lineTo(x, y + d * 6);
  path.lineTo(x + 9, y - d * 4);
  path.lineTo(x + 9, y - d * 1);
  path.lineTo(x, y + d * 9);
  path.lineTo(x - 9, y - d * 1);
  path.close();
  c.drawPath(path, paintOf('#ffffff', alpha));
}

function drawKelp(c: SkCanvas, run: Run, floor: number): void {
  const swayT = run.reduced ? 0 : run.decoT;
  for (const kelp of run.kelp) {
    const sway = Math.sin(swayT * 1.2 + kelp.ph) * 14;
    const path = Skia.Path.Make();
    path.moveTo(kelp.x, floor + 12);
    path.cubicTo(kelp.x + sway * 0.4, floor - kelp.h * 0.35, kelp.x - sway * 0.6, floor - kelp.h * 0.7, kelp.x + sway, floor - kelp.h);
    c.drawPath(path, paintOf('#145064', 0.22, 8));
  }
}

function drawBubbles(c: SkCanvas, run: Run, own: boolean): void {
  for (const bubble of run.bubbles) {
    if ((bubble.own !== 0) !== own) {
      continue;
    }
    strokeOval(c, bubble.x, bubble.y, bubble.r, bubble.r, '#ffffff', 1.3, 0.65);
    fillCircle(c, bubble.x - bubble.r * 0.35, bubble.y - bubble.r * 0.35, bubble.r * 0.3, '#ffffff', 0.45);
  }
}

function drawSeabed(c: SkCanvas, run: Run, floor: number): void {
  const path = Skia.Path.Make();
  path.moveTo(0, run.H);
  for (let x = 0; x <= run.W; x += 16) {
    path.lineTo(x, floor + Math.sin((x + run.dist) * 0.03) * 3);
  }
  path.lineTo(run.W, run.H);
  path.close();
  c.drawPath(path, paintOf('#f3d6a4'));
  for (let i = 0; i < 8; i += 1) {
    const x = ((i * 62 - run.dist) % (run.W + 60) + run.W + 60) % (run.W + 60) - 30;
    const y = floor + 14 + (i % 3) * 9;
    const ripple = Skia.Path.Make();
    ripple.moveTo(x, y);
    ripple.quadTo(x + 10, y - 4, x + 20, y);
    c.drawPath(ripple, paintOf('#e2bd82', 1, 2));
  }
  for (let i = 0; i < 3; i += 1) {
    const x = ((i * 170 + 60 - run.dist) % (run.W + 80) + run.W + 80) % (run.W + 80) - 40;
    const y = floor + 22;
    c.save();
    c.translate(x, y);
    c.rotate((i * 180) / Math.PI, 0, 0);
    const star = Skia.Path.Make();
    for (let k = 0; k < 10; k += 1) {
      const angle = (k / 10) * Math.PI * 2 - Math.PI / 2;
      const radius = k % 2 ? 3 : 8;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (k === 0) {
        star.moveTo(px, py);
      } else {
        star.lineTo(px, py);
      }
    }
    star.close();
    c.drawPath(star, paintOf(i % 2 ? '#ff9fb8' : '#ffb070'));
    c.restore();
  }
}

function drawGate(c: SkCanvas, gate: Gate, time: number, floor: number): void {
  const center = gateCenter(gate, time);
  const gapTop = center - gate.gap / 2;
  const gapBottom = center + gate.gap / 2;
  const x = gate.x;
  fillRRect(c, x, -40, GATE_W, gapTop + 40, 18, '#8a74c4');
  fillRRect(c, x + 9, -40, 13, gapTop + 26, 7, '#a994e0');
  fillRRect(c, x + GATE_W - 16, -40, 9, gapTop + 28, 5, '#7461ad');
  fillOval(c, x + GATE_W / 2, gapTop - 5, GATE_W / 2 - 6, 5, '#6fd3a0');
  const coralH = Math.max(8, floor - gapBottom + 20);
  fillRRect(c, x, gapBottom, GATE_W, coralH, 18, '#ff86b0');
  fillCircle(c, x + 15, gapBottom + 6, 11, '#ff86b0');
  fillCircle(c, x + GATE_W - 15, gapBottom + 4, 12, '#ff86b0');
  fillRRect(c, x + 9, gapBottom + 12, 11, Math.max(0, floor - gapBottom - 6), 6, '#ffb3cf');
}

function drawShell(c: SkCanvas, x: number, y: number, time: number, ph: number): void {
  c.save();
  c.translate(x, y);
  c.rotate((Math.sin(time * 2 + ph) * 0.2 * 180) / Math.PI, 0, 0);
  const shell = Skia.Path.Make();
  shell.moveTo(0, 8);
  shell.addArc(Skia.XYWHRect(-11, -12, 22, 22), 189, 162);
  shell.close();
  c.drawPath(shell, paintOf('#ffb3cf'));
  fillRRect(c, -4, 5, 8, 4, 2, '#e8679a');
  c.restore();
}

function drawPearl(c: SkCanvas, x: number, y: number): void {
  fillOval(c, x, y + 4, 15, 7, '#9b86d6');
  fillCircle(c, x, y + 1, 7, '#fde7f2');
  fillCircle(c, x - 2, y - 1, 2.5, '#ffffff');
}

function drawGem(c: SkCanvas, x: number, y: number, time: number, ph: number): void {
  c.save();
  c.translate(x, y);
  c.scale(0.75 + 0.25 * Math.cos(time * 2 + ph), 1);
  fillCircle(c, 0, 0, 20, '#ffffff', 0.25);
  const gem = Skia.Path.Make();
  gem.moveTo(-12, -4);
  gem.lineTo(-6, -11);
  gem.lineTo(6, -11);
  gem.lineTo(12, -4);
  gem.lineTo(0, 13);
  gem.close();
  c.drawPath(gem, paintOf('#3fb6dc'));
  c.restore();
}

function drawChest(c: SkCanvas, x: number, y: number): void {
  fillCircle(c, x, y, 24, '#ffd66e', 0.35);
  fillRRect(c, x - 15, y - 3, 30, 17, 4, '#a8652a');
  fillRect(c, x - 15, y + 3, 30, 3, '#f5b82e');
  fillRRect(c, x - 15, y - 13, 30, 10, 4, '#c27a3a');
  fillCircle(c, x, y + 8, 1.8, '#7a4518');
}

function drawShieldItem(c: SkCanvas, x: number, y: number, time: number): void {
  const radius = 15 + Math.sin(time * 4);
  fillCircle(c, x, y, radius, '#bef0ff', 0.35);
  strokeOval(c, x, y, radius, radius, '#ffffff', 2.4, 0.95);
}

function drawItem(c: SkCanvas, item: Item, time: number): void {
  const y = itemY(item, time) + Math.sin(time * 2.4 + item.ph) * 3;
  if (item.k === 'shell') {
    drawShell(c, item.x, y, time, item.ph);
  } else if (item.k === 'pearl') {
    drawPearl(c, item.x, y);
  } else if (item.k === 'gem') {
    drawGem(c, item.x, y, time, item.ph);
  } else if (item.k === 'chest') {
    drawChest(c, item.x, y);
  } else {
    drawShieldItem(c, item.x, y, time);
  }
}

function drawJelly(c: SkCanvas, hazard: Hazard, time: number, meters: number): void {
  const y = jellyY(hazard, time);
  const glow = clamp((meters - UNLOCK.glow) / 200, 0, 1);
  if (glow > 0) {
    fillCircle(c, hazard.x, y + 4, 30, '#ffaaf0', glow * 0.25);
  }
  for (let i = 0; i < 4; i += 1) {
    const tx = hazard.x - 9 + i * 6;
    const path = Skia.Path.Make();
    path.moveTo(tx, y + 2);
    path.quadTo(tx + Math.sin(time * 4 + i) * 5, y + 14, tx + Math.sin(time * 4 + i + 1) * 4, y + 26);
    c.drawPath(path, paintOf('#e588cf', 1, 2.6));
  }
  fillOval(c, hazard.x, y, 16, 13, '#f6b2e6');
  fillCircle(c, hazard.x - 5, y - 3, 1.8, '#5a3a6e');
  fillCircle(c, hazard.x + 5, y - 3, 1.8, '#5a3a6e');
}

function drawPuffer(c: SkCanvas, hazard: Hazard, time: number, font: SkFont | null): void {
  const puff = puffRadius(hazard, time);
  const y = hazard.y + Math.sin(time * 2 + hazard.bob) * 6;
  const wobble = puff.warn ? Math.sin(time * 40) * 1.6 : 0;
  c.save();
  c.translate(hazard.x + wobble, y);
  const tail = Skia.Path.Make();
  tail.moveTo(puff.r - 2, 0);
  tail.lineTo(puff.r + 9, -7);
  tail.lineTo(puff.r + 9, 7);
  tail.close();
  c.drawPath(tail, paintOf('#f2a93b'));
  fillCircle(c, 0, 0, puff.r, '#ffd36b');
  fillOval(c, 0, puff.r * 0.4, puff.r * 0.75, puff.r * 0.45, '#fff0c2');
  fillCircle(c, -puff.r * 0.45, -puff.r * 0.25, puff.r * 0.22, '#ffffff');
  fillCircle(c, -puff.r * 0.5, -puff.r * 0.25, puff.r * 0.12, '#2a1f33');
  c.restore();
  if (puff.warn && font) {
    drawText(c, '!', hazard.x, y - 16, '#e2365f', font);
  }
}

function drawPet(
  c: SkCanvas,
  run: Run,
  actor: Actor,
  breed: Breed,
): void {
  const dying = run.phase === 'dying' || run.phase === 'over';
  const side = sideOctant(1);
  actor.x = 0;
  actor.y = 0;
  actor.face = 1;
  actor.octant = side;
  actor.octantFrom = side;
  actor.octantTarget = side;
  actor.octantBlend = 1;
  actor.jump = null;
  actor.phase = run.pet.ph;
  actor.wagPh = run.pet.ph;
  actor.pose.swim = 1;
  actor.pose.xEyes = dying ? 1 : 0;
  actor.pose.walk = 0;
  actor.pose.tuck = 0;
  actor.pose.sit = 0;
  actor.pose.lie = 0;
  c.save();
  c.translate(run.pet.x, run.pet.y);
  const angle = dying ? run.pet.spin : run.pet.rot;
  if (angle) {
    c.rotate((angle * 180) / Math.PI, 0, -8);
  }
  const blink = run.pet.inv > 0 && run.phase === 'play' && Math.floor(run.t * 14) % 2 === 0;
  if (blink) {
    const veil = Skia.Paint();
    veil.setAlphaf(0.45);
    c.saveLayer(veil);
  }
  c.scale(0.4, 0.4);
  drawActor(c, actor, breed, { yMin: 0, yMax: 40 }, run.t, null, false, run.reduced);
  if (blink) {
    c.restore();
  }
  c.restore();
  if (run.pet.shield) {
    const pulse = 0.7 + 0.2 * Math.sin(run.t * 5);
    fillCircle(c, run.pet.x + 3, run.pet.y - 4, 31, '#bef0ff', 0.16);
    strokeOval(c, run.pet.x + 3, run.pet.y - 4, 31, 31, '#ffffff', 2, pulse);
  }
}

export function drawPaddlePaws(
  c: SkCanvas,
  run: Run,
  actor: Actor | null,
  breed: Breed | null,
  font: SkFont | null,
  fontSm: SkFont | null,
  screenW: number,
  screenH: number,
): void {
  const scale = screenW / WORLD_W;
  c.save();
  c.scale(scale, scale);
  const meters = run.dist / PX_PER_M;
  const [top, bottom] = zoneColors(meters);
  fillGradient(c, 0, 0, WORLD_W, Math.max(run.H, screenH / scale), top, bottom);
  const ray = clamp(1 - meters / UNLOCK.raysGone, 0, 1) * 0.16;
  if (ray > 0 && !run.reduced) {
    for (let i = 0; i < 4; i += 1) {
      const x0 = i * 110 + 30 + Math.sin(run.decoT * 0.35 + i * 1.7) * 18;
      const path = Skia.Path.Make();
      path.moveTo(x0, 0);
      path.lineTo(x0 + 34 + i * 4, 0);
      path.lineTo(x0 - 80, run.H * 0.8);
      path.lineTo(x0 - 150, run.H * 0.8);
      path.close();
      c.drawPath(path, paintOf('#ffffff', ray));
    }
  }
  const glow = clamp((meters - UNLOCK.glow) / 200, 0, 1);
  if (glow > 0) {
    const floor = floorY(run);
    for (let i = 0; i < 26; i += 1) {
      const x = ((i * 97 - run.dist * 0.12) % run.W + run.W) % run.W;
      const y = TOP + ((i * 137) % Math.max(1, floor - TOP));
      const twinkle = run.reduced ? 0.7 : 0.5 + 0.5 * Math.sin(run.t * 2 + i);
      fillCircle(c, x, y, 1.6, '#bef0ff', glow * 0.55 * twinkle);
    }
  }
  const floor = floorY(run);
  const surface = Skia.Path.Make();
  surface.moveTo(0, 0);
  for (let x = 0; x <= run.W; x += 10) {
    surface.lineTo(x, 10 + Math.sin(x * 0.045 + (run.reduced ? 0 : run.decoT) * 2.2) * 4);
  }
  surface.lineTo(run.W, 0);
  surface.close();
  c.drawPath(surface, paintOf('#ffffff', 0.28));
  drawKelp(c, run, floor);
  drawBubbles(c, run, false);
  if (run.bestMeters > 0 && fontSm) {
    const bx = PET_X + run.bestMeters * PX_PER_M - run.dist;
    if (bx > -10 && bx < run.W + 10) {
      for (let y = TOP; y < floor; y += 13) {
        strokeLine(c, bx, y, bx, Math.min(floor, y + 6), '#ffffff', 2, 0.7);
      }
      const label = `Farthest · ${run.bestMeters} m`;
      const width = fontSm.getTextWidth(label);
      fillRRect(c, bx - width / 2 - 7, TOP - 4, width + 14, 18, 9, '#fbfdff', 0.9);
      drawText(c, label, bx, TOP + 9, '#2f3f6e', fontSm);
    }
  }
  for (const gate of run.gates) {
    drawGate(c, gate, run.t, floor);
  }
  drawSeabed(c, run, floor);
  for (const item of run.items) {
    if (!item.got) {
      drawItem(c, item, run.t);
    }
  }
  for (const hazard of run.hazards) {
    if (hazard.k === 'jelly') {
      drawJelly(c, hazard, run.t, meters);
    } else {
      drawPuffer(c, hazard, run.t, font);
    }
  }
  if (actor && breed) {
    drawPet(c, run, actor, breed);
  }
  drawBubbles(c, run, true);
  const mid = clamp(run.pet.y, TOP, floor);
  chevron(c, run.W - 22, mid - 70, true, 0.28);
  chevron(c, run.W - 22, mid + 70, false, 0.28);
  if (font) {
    for (const popup of run.fx) {
      const alpha = clamp(popup.life / 0.5, 0, 1);
      font.setSize(popup.size);
      drawText(c, popup.txt, popup.x, popup.y, popup.col, font, alpha, true);
    }
  }
  c.restore();
}
