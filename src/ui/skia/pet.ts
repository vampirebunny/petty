import { Skia, StrokeCap } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import { bodyFrame, gaitFoot, solveKnee, wearItem } from '../../actor';
import type { Actor, Breed, Geom } from '../../actor';
import { torsoPoint } from '../../actor/geometry';
import { drawBandana, drawBoot, drawCoat, drawCollar, drawGlasses, drawHat } from './cosmetics';
import {
  clamp,
  clipOval,
  deg,
  fillCircle,
  fillOval,
  mix,
  oval,
  paintOf,
  strokeLine,
} from './draw';
import type { WearItem } from '../../actor/wardrobe';
import { drawBallShape } from './scenery';

type Pt = { x: number; y: number };

type Paw = { x: number; y: number; shin: number; knee: Pt };

// Two-bone leg: the knee bends toward `side`, the paw stays on the bone length even when the target is out of reach.
function drawLeg(c: SkCanvas, hip: Pt, target: Pt, geom: Geom, side: number, color: string, boot: WearItem | null, far: boolean): Paw {
  const bone = geom.L / 2;
  const knee = solveKnee(hip, target, bone, side);
  const ex = target.x - knee.x;
  const ey = target.y - knee.y;
  const length = Math.hypot(ex, ey) || 1;
  const paw = { x: knee.x + (ex / length) * bone, y: knee.y + (ey / length) * bone };
  const leg = Skia.Path.Make();
  leg.moveTo(hip.x, hip.y);
  leg.lineTo(knee.x, knee.y);
  leg.lineTo(paw.x, paw.y);
  c.drawPath(leg, paintOf(color, 1, geom.legWidth));
  fillOval(c, paw.x + 3, paw.y - 3, geom.pawRx, geom.pawRy, color);
  if (boot) {
    drawBoot(c, knee, paw, geom, boot, far);
  }
  return { x: paw.x, y: paw.y, shin: Math.atan2(paw.y - knee.y, paw.x - knee.x), knee };
}

function drawEye(c: SkCanvas, ex: number, ey: number, eyeR: number, closed: number, breed: Breed, cf: number): void {
  const cat = breed.species === 'cat';
  if (closed > 0.6) {
    const lid = Skia.Path.Make();
    lid.addArc(oval(ex, ey - eyeR * 0.3, eyeR * 1.1, eyeR * 1.1), 27, 126);
    c.drawPath(lid, paintOf('#1b1512', 1, 2));
    return;
  }
  const open = 1 - closed;
  if (cat) {
    fillOval(c, ex, ey, eyeR * 1.12, eyeR * 1.1 * open, breed.eyeColor ?? '#79bd5a');
    fillOval(c, ex + eyeR * 0.05, ey, eyeR * 0.4, eyeR * 1.02 * open, '#15110f');
  } else {
    fillOval(c, ex, ey, eyeR, eyeR * open, '#1b1512');
  }
  fillCircle(c, ex + eyeR * 0.38, ey - eyeR * 0.38 * open, eyeR * 0.34 * open, '#ffffff');
  fillCircle(c, ex - eyeR * 0.35, ey + eyeR * 0.4 * open, eyeR * (0.12 + 0.1 * cf) * open, '#ffffff', 0.75);
}

function drawTail(c: SkCanvas, breed: Breed, geom: Geom, wag: number, color: string): void {
  const tx = -geom.bodyLen / 2 + 6;
  const ty = geom.bodyY - geom.bodyH * 0.1;
  const tail = Skia.Path.Make();
  let width = 9;
  if (breed.tail === 'straight') {
    const angle = 0.9 + wag;
    const length = 38;
    width = 8;
    tail.moveTo(tx, ty);
    tail.quadTo(tx - length * 0.4, ty - 4, tx - Math.cos(angle) * length, ty - Math.sin(angle) * length);
  } else if (breed.tail === 'curl') {
    width = 8;
    tail.addArc(oval(tx - 6 + wag * 6, ty - 12, 13, 13), 108, 288);
  } else if (breed.tail === 'long' || breed.tail === 'fluffy') {
    width = breed.tail === 'fluffy' ? 12 : 6.2;
    const sway = wag * (breed.tail === 'fluffy' ? 22 : 30);
    tail.moveTo(tx, ty);
    tail.cubicTo(tx - 24, ty + 8, tx - 40, ty - 8, tx - 34 + sway, ty - 38);
  } else {
    tail.moveTo(tx, ty);
    tail.lineTo(tx - 9 + wag * 4, ty - 7);
  }
  c.drawPath(tail, paintOf(color, 1, width));
}

export function drawActor(
  c: SkCanvas,
  actor: Actor,
  breed: Breed,
  floor: { yMin: number; yMax: number },
  t: number,
  carrying: boolean,
): void {
  const frame = bodyFrame(
    breed,
    actor.displayAgeDays,
    actor.displayWeight,
    actor.vitality,
    actor.pose,
    actor.bark.open,
    actor.phase,
    actor.x,
    actor.y,
    actor.face,
    floor,
    actor.speed,
  );
  const geom = frame.geom;
  const pose = actor.pose;
  const scale = frame.scale;
  const cat = breed.species === 'cat';
  const theta = frame.theta;
  const dy = frame.dy;
  const barkOpen = actor.bark.open;
  const stride = geom.L * (0.35 + 0.4 * clamp(actor.speed / 190, 0, 1.1));
  const lift = geom.L * (0.16 + 0.1 * clamp(actor.speed / 190, 0, 1));
  const wag = Math.sin(actor.wagPh) * pose.wagAmp;
  let eyeClosed = Math.max(pose.eyes, pose.squint, actor.blinkT < 0.12 ? 1 : 0);
  if (barkOpen > 0.05) {
    eyeClosed = 0;
  }
  const boot = wearItem('boots', actor.equipped.boots);
  const coat = wearItem('coat', actor.equipped.coat);
  const collar = wearItem('collar', actor.equipped.collar);
  const bandana = wearItem('bandana', actor.equipped.bandana);
  const glasses = wearItem('glasses', actor.equipped.glasses);
  const hat = wearItem('hat', actor.equipped.hat);
  const points = breed.pattern === 'points';
  const legColor = points ? breed.accent ?? breed.coat : breed.coat;
  const tailColor = legColor;
  const farColor = mix(legColor, '#000000', 0.32);

  c.save();
  c.translate(actor.x, actor.y);
  c.scale(actor.face * scale, scale);
  fillOval(c, geom.bodyLen * 0.05 + 10 * pose.lie, 2, geom.bodyLen * (0.52 + 0.08 * pose.lie), 7, '#000000', 0.13);
  c.translate(0, -actor.z / scale);

  const footAt = (hip: Pt, fore: boolean, offset: number, nearFore: boolean): Pt => {
    const gait = gaitFoot(actor.phase, offset, stride, lift);
    const stand = { x: hip.x + (fore ? 3 : -1) + gait.x * pose.walk, y: gait.y * pose.walk };
    const sit = fore ? { x: hip.x + 4, y: 0 } : { x: hip.x + 0.45 * geom.L, y: 0 };
    const lieReach = Math.sqrt(Math.max(0, 0.97 * geom.L * (0.97 * geom.L) - hip.y * hip.y));
    const lie = fore ? { x: hip.x + lieReach, y: 0 } : { x: hip.x + 0.42 * geom.L, y: 0 };
    let x = stand.x + (sit.x - stand.x) * pose.sit + (lie.x - stand.x) * pose.lie;
    let y = stand.y + (sit.y - stand.y) * pose.sit + (lie.y - stand.y) * pose.lie;
    if (nearFore && pose.paw > 0.001) {
      // The raised paw waves on the world clock, so it keeps moving while the pet sits still.
      const pawX = hip.x + 0.62 * geom.L;
      const pawY = hip.y + 0.28 * geom.L + Math.sin(t * 13) * 3;
      x += (pawX - x) * pose.paw;
      y += (pawY - y) * pose.paw;
    }
    return { x, y };
  };

  const foreNear = torsoPoint(geom, theta, dy, geom.foreX, geom.hipY);
  const hindNear = torsoPoint(geom, theta, dy, geom.hindX, geom.hipY);
  const foreFar = { x: foreNear.x + 4, y: foreNear.y };
  const hindFar = { x: hindNear.x + 4, y: hindNear.y };
  const foreSide = pose.lie > 0.5 ? -1 : 1;

  const hindFarPaw = drawLeg(c, hindFar, footAt(hindFar, false, 0, false), geom, -1, farColor, boot, true);
  const foreFarPaw = drawLeg(c, foreFar, footAt(foreFar, true, Math.PI, false), geom, foreSide, farColor, boot, true);

  // torso: tail, body, markings, ribs, coat
  c.save();
  c.translate(0, dy);
  c.translate(geom.Px, geom.Py);
  c.rotate(deg(theta), 0, 0);
  c.translate(-geom.Px, -geom.Py);
  drawTail(c, breed, geom, wag, tailColor);
  const breath = 1 + pose.breathAmp * Math.sin(actor.breathPh);
  fillOval(c, 0, geom.bodyY, geom.bodyLen / 2, (geom.bodyH / 2) * breath, breed.coat);
  fillOval(
    c,
    4,
    geom.bodyY + geom.bodyH * 0.22,
    geom.bodyLen * 0.38,
    geom.bodyH * 0.22 * breath,
    mix(breed.coat, '#ffffff', 0.18),
  );
  if (breed.pattern === 'stripes') {
    c.save();
    clipOval(c, 0, geom.bodyY, geom.bodyLen / 2, (geom.bodyH / 2) * breath);
    const stripes = Skia.Path.Make();
    for (let i = 0; i < 6; i += 1) {
      const sx = -geom.bodyLen * 0.34 + i * geom.bodyLen * 0.14;
      stripes.moveTo(sx, geom.bodyY - geom.bodyH * 0.5);
      stripes.quadTo(sx + 6, geom.bodyY - geom.bodyH * 0.1, sx + 2, geom.bodyY + geom.bodyH * 0.12);
    }
    c.drawPath(stripes, paintOf(mix(breed.coat, '#000000', 0.5), 0.55, 4));
    c.restore();
  }
  if (actor.displayWeight < -0.35) {
    const ribs = Skia.Path.Make();
    for (let r = 0; r < 4; r += 1) {
      const rx = geom.bodyLen * (0.06 + r * 0.07);
      ribs.moveTo(rx, geom.bodyY - geom.bodyH * 0.02);
      ribs.quadTo(rx + 4, geom.bodyY + geom.bodyH * 0.12, rx + 1, geom.bodyY + geom.bodyH * 0.3);
    }
    c.drawPath(ribs, paintOf('#000000', ((-actor.displayWeight - 0.35) / 0.65) * 0.38, 1.4));
  }
  if (coat) {
    drawCoat(c, geom, coat, breath);
  }
  c.restore();

  const hindNearPaw = drawLeg(c, hindNear, footAt(hindNear, false, Math.PI, false), geom, -1, legColor, boot, false);
  const foreNearPaw = drawLeg(c, foreNear, footAt(foreNear, true, 0, true), geom, foreSide, legColor, boot, false);
  actor.anchors.paws = [hindFarPaw, foreFarPaw, hindNearPaw, foreNearPaw].map(({ x, y, shin }) => ({ x, y, shin }));

  // neck, bandana, collar
  const head = frame.head;
  const pitch = frame.pitch;
  const base = torsoPoint(geom, theta, dy, geom.bodyLen / 2 - 14, geom.bodyY - 2);
  const neckWidth = geom.headR * 1.35;
  strokeLine(c, base.x, base.y, head.x - 2, head.y + 3, breed.coat, neckWidth);
  const nx = head.x - 2 - base.x;
  const ny = head.y + 3 - base.y;
  const nl = Math.hypot(nx, ny) || 1;
  const along = { x: nx / nl, y: ny / nl };
  // perpendicular to the neck, always pointing down the screen
  const perp = along.x >= 0 ? { x: -along.y, y: along.x } : { x: along.y, y: -along.x };
  const neck = { x: base.x + nx * 0.62, y: base.y + ny * 0.62 };
  actor.anchors.neck = neck;
  if (bandana) {
    drawBandana(c, neck, perp, along, neckWidth, bandana, Math.sin(t * 11) * clamp(actor.speed / 120, 0, 1) * 4);
  }
  if (collar) {
    drawCollar(
      c,
      { x: neck.x - along.x * 3, y: neck.y - along.y * 3 },
      perp,
      neckWidth,
      collar,
      Math.sin(t * 7) * clamp(actor.speed / 100, 0, 1) * 2.5,
    );
  }

  // head
  const R = geom.headR;
  const jaw = Math.max(
    pose.pant * (0.45 + 0.2 * Math.sin(actor.panPh)),
    barkOpen * 0.85,
    pose.headDown * (0.2 + 0.2 * Math.sin(actor.chewPh)),
  );
  const tongue = pose.pant * (0.8 + 0.2 * Math.sin(actor.panPh + 1));
  const cf = geom.cf;
  const earSize = breed.earSize;
  const eyeR = R * (0.13 + 0.07 * (1 - geom.eye) + 0.12 * cf);
  const ex = R * (0.3 + 0.05 * cf);
  const ey = -R * (0.12 - 0.09 * cf);
  c.save();
  c.translate(head.x, head.y);
  c.rotate(deg(pitch), 0, 0);
  const earFar = mix(breed.earColor, '#000000', 0.2);
  if (breed.ear === 'pointy') {
    const ear = Skia.Path.Make();
    ear.moveTo(-R * 0.9, -R * 0.5);
    ear.lineTo(-R * 0.55, -R * 1.7);
    ear.lineTo(-R * 0.05, -R * 0.8);
    ear.close();
    c.drawPath(ear, paintOf(earFar));
  } else if (breed.ear === 'cat') {
    const ear = Skia.Path.Make();
    ear.moveTo(-R * 0.8, -R * 0.55);
    ear.lineTo(-R * 0.5, -R * 1.62 * earSize);
    ear.lineTo(-R * 0.02, -R * 0.78);
    ear.close();
    c.drawPath(ear, paintOf(earFar));
  }
  if (cat) {
    fillOval(c, 0, 0, R * 1.06, R * 0.96, breed.coat);
  } else {
    fillCircle(c, 0, 0, R, breed.coat);
  }
  if (breed.pattern === 'stripes') {
    const marks = Skia.Path.Make();
    marks.moveTo(-R * 0.1, -R * 0.92);
    marks.lineTo(-R * 0.1, -R * 0.55);
    marks.moveTo(R * 0.15, -R * 0.88);
    marks.lineTo(R * 0.2, -R * 0.55);
    marks.moveTo(-R * 0.36, -R * 0.84);
    marks.lineTo(-R * 0.4, -R * 0.52);
    c.drawPath(marks, paintOf(mix(breed.coat, '#000000', 0.5), 0.6, 2.6));
  }
  const mrx = cat ? geom.snout * 0.6 + R * 0.34 : geom.snout * 0.7 + R * 0.3;
  const mry = cat ? R * 0.38 : R * 0.45;
  const mx = R * 0.55 + geom.snout * 0.45;
  const my = R * 0.3;
  const jawY = my + mry * 0.55 + jaw * R * 0.38;
  fillOval(c, mx - mrx * 0.05, jawY, mrx * 0.92, mry * 0.5, mix(breed.muzzle, '#000000', 0.14));
  if (jaw > 0.04) {
    fillOval(c, mx, my + mry * 0.5 + jaw * R * 0.18, mrx * 0.85, Math.max(0.5, jaw * R * 0.36), '#3a1f22');
    if (tongue > 0.05) {
      fillOval(c, mx + mrx * 0.15, jawY + R * 0.04 + tongue * R * 0.1, mrx * 0.42, R * 0.1 + tongue * R * 0.12, '#e87a8a');
    }
  }
  fillOval(c, mx, my, mrx, mry, breed.muzzle);
  if (cat) {
    fillOval(c, mx + mrx * 0.85, my - R * 0.1, R * 0.11, R * 0.08, points ? '#8a6a5c' : '#e59aa6');
    if (jaw < 0.04) {
      const mouth = Skia.Path.Make();
      mouth.moveTo(mx + mrx * 0.82, my - R * 0.02);
      mouth.lineTo(mx + mrx * 0.82, my + R * 0.1);
      mouth.moveTo(mx + mrx * 0.82, my + R * 0.1);
      mouth.quadTo(mx + mrx * 0.5, my + R * 0.2, mx + mrx * 0.15, my + R * 0.1);
      c.drawPath(mouth, paintOf('#281919', 0.55, 1.1));
    }
    const whiskers = Skia.Path.Make();
    for (let wk = -1; wk <= 1; wk += 1) {
      whiskers.moveTo(mx + mrx * 0.3, my + R * 0.04 + wk * 0.03 * R);
      whiskers.lineTo(mx + mrx + R * 0.95, my + R * 0.02 + wk * R * 0.22);
    }
    const pale = points || breed.coat === '#2b2b33';
    c.drawPath(whiskers, paintOf(pale ? '#ebebf0' : '#ffffff', pale ? 0.75 : 0.85, 1.1));
  } else {
    fillOval(c, mx + mrx * 0.9, my - R * 0.12, R * 0.17, R * 0.13, '#1b1512');
  }
  fillOval(c, ex + R * 0.02, ey + R * 0.4, R * 0.2, R * 0.12, '#ff738c', 0.3 * Math.min(cf, 1));
  drawEye(c, ex, ey, eyeR, eyeClosed, breed, cf);
  if (geom.bags > 0.04) {
    fillOval(c, ex, ey + eyeR * 1.15, eyeR * 0.9, eyeR * 0.45, '#6b5344', 0.45 * geom.bags);
  }
  // near ear
  if (breed.ear === 'pointy') {
    const ear = Skia.Path.Make();
    ear.moveTo(-R * 0.55, -R * 0.75);
    ear.lineTo(-R * 0.1, -R * 1.8);
    ear.lineTo(R * 0.5, -R * 0.8);
    ear.close();
    c.drawPath(ear, paintOf(breed.earColor));
  } else if (breed.ear === 'cat') {
    const ear = Skia.Path.Make();
    ear.moveTo(-R * 0.4, -R * 0.7);
    ear.lineTo(R * 0.12, -R * 1.7 * earSize);
    ear.lineTo(R * 0.62, -R * 0.62);
    ear.close();
    c.drawPath(ear, paintOf(breed.earColor));
    const inner = Skia.Path.Make();
    inner.moveTo(-R * 0.2, -R * 0.78);
    inner.lineTo(R * 0.12, -R * 1.4 * earSize);
    inner.lineTo(R * 0.44, -R * 0.74);
    inner.close();
    c.drawPath(inner, paintOf(points ? '#a07d70' : '#e8a3ad'));
  } else {
    c.save();
    c.translate(-R * 0.15, -R * 0.35);
    c.rotate(deg(0.25 + Math.sin(actor.phase * 2) * 0.08 * pose.walk - barkOpen * 0.15), 0, 0);
    fillOval(c, 0, R * 0.55 * earSize, R * 0.4 * earSize, R * 0.85 * earSize, breed.earColor);
    c.restore();
  }
  if (glasses) {
    drawGlasses(c, glasses, ex, ey, eyeR, R);
  }
  if (hat) {
    drawHat(c, hat, R);
  }
  c.restore();

  if (carrying) {
    const cs = Math.cos(pitch);
    const sn = Math.sin(pitch);
    const mouthX = head.x + geom.tipX * cs - geom.tipY * sn;
    const mouthY = head.y + geom.tipX * sn + geom.tipY * cs;
    drawBallShape(c, mouthX - 4, mouthY + 1, 8);
  }
  c.restore();

  // sleep marks float up from the head in screen space, so they never mirror
  const sleepy = pose.lie * pose.eyes;
  if (sleepy >= 0.5) {
    const hx = actor.x + actor.face * scale * head.x;
    const hy = actor.y - actor.z + scale * head.y;
    for (let i = 0; i < 3; i += 1) {
      const k = (t * 0.5 + i / 3) % 1;
      const size = (10 + k * 8) * 0.55;
      const zx = hx + 10 + k * 18;
      const zy = hy - R * scale - 6 - k * 26;
      const mark = Skia.Path.Make();
      mark.moveTo(zx, zy - size);
      mark.lineTo(zx + size, zy - size);
      mark.lineTo(zx, zy);
      mark.lineTo(zx + size, zy);
      c.drawPath(mark, paintOf('#5C6B80', (1 - k) * 0.9 * sleepy, 1.6, StrokeCap.Round));
    }
  }
}
