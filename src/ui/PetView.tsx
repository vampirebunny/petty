import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, StyleSheet, useWindowDimensions } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { BlendMode, Canvas, PaintStyle, Picture, Skia, StrokeCap, TileMode } from '@shopify/react-native-skia';
import type { SkCanvas, SkPaint, SkPath, SkPicture } from '@shopify/react-native-skia';

import {
  bodyFrame,
  breedById,
  depthScale,
  gaitFoot,
  sceneById,
  setWorldScene,
  solveKnee,
  spawnActor,
  startUserTask,
  settleOnResume,
  syncActor,
  takeWeightDelta,
  todAt,
  update,
  wearItem,
  createWorld,
  frameDt,
} from '../actor';
import { stageHeight, stageWidth } from '../actor/geometry';
import { actorTint, lighting, petLightAmount, sceneryTint } from '../actor/lighting';
import type { Actor, Breed, Geom, Scene, TimeOfDay, World } from '../actor';
import type { Rgba } from '../actor/timeOfDay';
import type { Cue, PetState } from '../sim/types';
import type { WearItem } from '../actor/wardrobe';

type Props = {
  pet: PetState;
  cueKind: Cue['kind'];
  cueToken: number;
  drop?: { x: number; y: number };
  hour: number | null;
  reducedMotion: boolean;
  onWeightDelta: (delta: number) => void;
};

function sourceOf(pet: PetState) {
  return {
    id: pet.id,
    breedId: pet.breedId,
    ageDays: pet.ageDays,
    weight: pet.weight,
    vitality: pet.vitality,
    equipped: pet.equipped,
    asleep: pet.asleep,
  };
}

function rgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(hex: string, toward: string, amount: number): string {
  const from = rgb(hex);
  const to = rgb(toward);
  return `#${from
    .map((channel, index) => Math.round(channel + (to[index] - channel) * amount).toString(16).padStart(2, '0'))
    .join('')}`;
}

function deg(radians: number): number {
  return (radians * 180) / Math.PI;
}

function paintOf(color: string, alpha = 1, stroke = 0): SkPaint {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(stroke > 0 ? PaintStyle.Stroke : PaintStyle.Fill);
  paint.setColor(Skia.Color(color));
  paint.setAlphaf(alpha);
  if (stroke > 0) {
    paint.setStrokeWidth(stroke);
    paint.setStrokeCap(StrokeCap.Round);
  }
  return paint;
}

function oval(cx: number, cy: number, rx: number, ry: number) {
  return Skia.XYWHRect(cx - rx, cy - ry, Math.max(rx, 0.5) * 2, Math.max(ry, 0.5) * 2);
}

function addOval(path: SkPath, cx: number, cy: number, rx: number, ry: number): void {
  path.addOval(oval(cx, cy, rx, ry));
}

function drawBallShape(canvas: SkCanvas, x: number, y: number, radius: number): void {
  canvas.drawCircle(x, y, radius, paintOf('#df5340'));
  const shine = Skia.Path.Make();
  shine.addArc(oval(x, y, radius * 0.62, radius * 0.62), 160, 120);
  canvas.drawPath(shine, paintOf('#ffffff', 0.75, 1.6));
  canvas.drawCircle(x + radius * 0.35, y - radius * 0.4, radius * 0.22, paintOf('#ffffff', 0.55));
}

function drawBowl(canvas: SkCanvas, x: number, y: number, fill: number, color = '#2f7d5b'): void {
  canvas.save();
  canvas.translate(x, y);
  canvas.drawOval(oval(0, 2, 36, 7), paintOf('#000000', 0.12));
  const body = Skia.Path.Make();
  body.moveTo(-30, -16);
  body.lineTo(-22, 0);
  body.quadTo(0, 5, 22, 0);
  body.lineTo(30, -16);
  body.close();
  canvas.drawPath(body, paintOf(mix(color, '#000000', 0.2)));
  canvas.drawOval(oval(0, -16, 30, 7), paintOf(color));
  canvas.drawOval(oval(0, -16, 25, 5), paintOf(mix(color, '#000000', 0.45)));
  const kibble = paintOf('#8a5a3a');
  const count = Math.round(16 * fill);
  for (let i = 0; i < count; i += 1) {
    const angle = i * 2.4;
    const radius = 4 + (i % 5) * 4.2;
    canvas.drawOval(oval(Math.cos(angle) * radius, -17 + Math.sin(angle) * 2.2 - (i % 3), 3, 2.2), kibble);
  }
  canvas.restore();
}

function drawLeg(
  canvas: SkCanvas,
  hip: { x: number; y: number },
  foot: { x: number; y: number },
  geom: Geom,
  side: number,
  color: string,
): { x: number; y: number; shin: number } {
  const bone = geom.L / 2;
  const knee = solveKnee(hip, foot, bone, side);
  const path = Skia.Path.Make();
  path.moveTo(hip.x, hip.y);
  path.lineTo(knee.x, knee.y);
  path.lineTo(foot.x, foot.y);
  canvas.drawPath(path, paintOf(color, 1, geom.legWidth));
  canvas.drawOval(oval(foot.x + 3, foot.y - 3, geom.pawRx, geom.pawRy), paintOf(color));
  return { x: foot.x, y: foot.y, shin: Math.atan2(foot.y - knee.y, foot.x - knee.x) };
}

function drawBoot(canvas: SkCanvas, knee: { x: number; y: number }, foot: { x: number; y: number }, geom: Geom, boot: WearItem, far: boolean): void {
  const color = far ? mix(boot.c ?? '#d64545', '#000000', 0.3) : boot.c ?? '#d64545';
  const x0 = knee.x + (foot.x - knee.x) * 0.5;
  const y0 = knee.y + (foot.y - knee.y) * 0.5;
  const shin = Skia.Path.Make();
  shin.moveTo(x0, y0);
  shin.lineTo(foot.x, foot.y);
  canvas.drawPath(shin, paintOf(color, 1, geom.legWidth + 4.5));
  canvas.drawOval(oval(foot.x + 3.5, foot.y - 2.5, geom.pawRx + 3.5, geom.pawRy + 3.2), paintOf(color));
}

function drawActor(canvas: SkCanvas, actor: Actor, breed: Breed, floor: { yMin: number; yMax: number }): void {
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
  );
  const geom = frame.geom;
  const stride = geom.L * (0.35 + 0.4 * Math.min(actor.speed / 190, 1.1));
  const lift = geom.L * (0.16 + 0.1 * Math.min(actor.speed / 190, 1));
  const wag = Math.sin(actor.wagPh) * actor.pose.wagAmp;
  const eyeClosed = Math.max(actor.pose.eyes, actor.blinkT < 0.12 ? 1 : 0);
  const closed = actor.bark.open > 0.05 ? 0 : eyeClosed;
  const boot = wearItem('boots', actor.equipped.boots);
  const coat = wearItem('coat', actor.equipped.coat);
  const collar = wearItem('collar', actor.equipped.collar);
  const bandana = wearItem('bandana', actor.equipped.bandana);
  const glasses = wearItem('glasses', actor.equipped.glasses);
  const hat = wearItem('hat', actor.equipped.hat);
  const legColor = breed.pattern === 'points' ? breed.accent ?? breed.coat : breed.coat;
  const far = mix(legColor, '#000000', 0.32);

  const footAt = (hip: { x: number; y: number }, fore: boolean, offset: number, near: boolean) => {
    const gait = gaitFoot(actor.phase, offset, stride, lift);
    const stand = {
      x: hip.x + (fore ? 3 : -1) + gait.x * actor.pose.walk,
      y: gait.y * actor.pose.walk,
    };
    const sit = fore ? { x: hip.x + 4, y: 0 } : { x: hip.x + 0.45 * geom.L, y: 0 };
    const lieReach = Math.sqrt(Math.max(0, 0.97 * geom.L * (0.97 * geom.L) - hip.y * hip.y));
    const lie = fore ? { x: hip.x + lieReach, y: 0 } : { x: hip.x + 0.42 * geom.L, y: 0 };
    let x = stand.x + (sit.x - stand.x) * actor.pose.sit + (lie.x - stand.x) * actor.pose.lie;
    let y = stand.y + (sit.y - stand.y) * actor.pose.sit + (lie.y - stand.y) * actor.pose.lie;
    if (near && actor.pose.paw > 0.001) {
      const pawX = hip.x + 0.62 * geom.L;
      const pawY = hip.y + 0.28 * geom.L + Math.sin(actor.phase * 13) * 3;
      x += (pawX - x) * actor.pose.paw;
      y += (pawY - y) * actor.pose.paw;
    }
    return { x, y };
  };

  canvas.save();
  canvas.translate(actor.x, actor.y - actor.z);
  canvas.scale(actor.face * frame.scale, frame.scale);
  canvas.drawOval(
    oval(geom.bodyLen * 0.05 + 10 * actor.pose.lie, 2, geom.bodyLen * (0.52 + 0.08 * actor.pose.lie), 7),
    paintOf('#000000', 0.13),
  );

  const theta = frame.theta;
  const dy = frame.dy;
  const foreNear = {
    x: geom.Px + (geom.foreX - geom.Px) * Math.cos(theta) - (geom.hipY - geom.Py) * Math.sin(theta),
    y: geom.Py + (geom.foreX - geom.Px) * Math.sin(theta) + (geom.hipY - geom.Py) * Math.cos(theta) + dy,
  };
  const hindNear = {
    x: geom.Px + (geom.hindX - geom.Px) * Math.cos(theta) - (geom.hipY - geom.Py) * Math.sin(theta),
    y: geom.Py + (geom.hindX - geom.Px) * Math.sin(theta) + (geom.hipY - geom.Py) * Math.cos(theta) + dy,
  };
  const foreFar = { x: foreNear.x + 4, y: foreNear.y };
  const hindFar = { x: hindNear.x + 4, y: hindNear.y };
  const foreSide = actor.pose.lie > 0.5 ? -1 : 1;
  const hindFarFoot = footAt(hindFar, false, 0, false);
  const foreFarFoot = footAt(foreFar, true, Math.PI, false);
  const hindFarPaw = drawLeg(canvas, hindFar, hindFarFoot, geom, -1, far);
  const foreFarPaw = drawLeg(canvas, foreFar, foreFarFoot, geom, foreSide, far);
  if (boot) {
    drawBoot(canvas, hindFar, hindFarFoot, geom, boot, true);
    drawBoot(canvas, foreFar, foreFarFoot, geom, boot, true);
  }

  canvas.save();
  canvas.translate(0, dy);
  canvas.translate(geom.Px, geom.Py);
  canvas.rotate(deg(theta), 0, 0);
  canvas.translate(-geom.Px, -geom.Py);
  const tailX = -geom.bodyLen / 2 + 6;
  const tailY = geom.bodyY - geom.bodyH * 0.1;
  const tail = Skia.Path.Make();
  if (breed.tail === 'straight') {
    const angle = 0.9 + wag;
    const length = 38;
    tail.moveTo(tailX, tailY);
    tail.quadTo(tailX - length * 0.4, tailY - 4, tailX - Math.cos(angle) * length, tailY - Math.sin(angle) * length);
    canvas.drawPath(tail, paintOf(breed.coat, 1, 8));
  } else if (breed.tail === 'curl') {
    tail.addArc(oval(tailX - 6 + wag * 6, tailY - 12, 13, 13), 108, 288);
    canvas.drawPath(tail, paintOf(breed.coat, 1, 8));
  } else if (breed.tail === 'long' || breed.tail === 'fluffy') {
    const sway = wag * (breed.tail === 'fluffy' ? 22 : 30);
    tail.moveTo(tailX, tailY);
    tail.cubicTo(tailX - 24, tailY + 8, tailX - 40, tailY - 8, tailX - 34 + sway, tailY - 38);
    canvas.drawPath(tail, paintOf(breed.coat, 1, breed.tail === 'fluffy' ? 12 : 6.2));
  } else {
    tail.moveTo(tailX, tailY);
    tail.lineTo(tailX - 9 + wag * 4, tailY - 7);
    canvas.drawPath(tail, paintOf(breed.coat, 1, 9));
  }
  const breath = 1 + actor.pose.breathAmp * Math.sin(actor.breathPh);
  const body = Skia.Path.Make();
  addOval(body, 0, geom.bodyY, geom.bodyLen / 2, (geom.bodyH / 2) * breath);
  canvas.drawPath(body, paintOf(breed.coat));
  const belly = Skia.Path.Make();
  addOval(belly, 4, geom.bodyY + geom.bodyH * 0.22, geom.bodyLen * 0.38, geom.bodyH * 0.22 * breath);
  canvas.drawPath(belly, paintOf(mix(breed.coat, '#ffffff', 0.18)));
  if (breed.pattern === 'stripes') {
    const stripe = paintOf(mix(breed.coat, '#000000', 0.5), 0.55, 4);
    for (let i = 0; i < 6; i += 1) {
      const sx = -geom.bodyLen * 0.34 + i * geom.bodyLen * 0.14;
      const mark = Skia.Path.Make();
      mark.moveTo(sx, geom.bodyY - geom.bodyH * 0.5);
      mark.quadTo(sx + 6, geom.bodyY - geom.bodyH * 0.1, sx + 2, geom.bodyY + geom.bodyH * 0.12);
      canvas.drawPath(mark, stripe);
    }
  }
  if (actor.displayWeight < -0.35) {
    const rib = paintOf('#000000', ((-actor.displayWeight - 0.35) / 0.65) * 0.38, 1.4);
    for (let r = 0; r < 4; r += 1) {
      const rx = geom.bodyLen * (0.06 + r * 0.07);
      const line = Skia.Path.Make();
      line.moveTo(rx, geom.bodyY - geom.bodyH * 0.02);
      line.quadTo(rx + 4, geom.bodyY + geom.bodyH * 0.12, rx + 1, geom.bodyY + geom.bodyH * 0.3);
      canvas.drawPath(line, rib);
    }
  }
  if (coat?.c) {
    canvas.drawOval(
      oval(0, geom.bodyY, geom.bodyLen * 0.42, geom.bodyH * 0.46 * breath),
      paintOf(coat.c, 0.92),
    );
  }
  canvas.restore();

  const hindNearFoot = footAt(hindNear, false, Math.PI, false);
  const foreNearFoot = footAt(foreNear, true, 0, true);
  const hindNearPaw = drawLeg(canvas, hindNear, hindNearFoot, geom, -1, legColor);
  const foreNearPaw = drawLeg(canvas, foreNear, foreNearFoot, geom, foreSide, legColor);
  if (boot) {
    drawBoot(canvas, hindNear, hindNearFoot, geom, boot, false);
    drawBoot(canvas, foreNear, foreNearFoot, geom, boot, false);
  }
  actor.anchors.paws = [hindFarPaw, foreFarPaw, hindNearPaw, foreNearPaw];

  const head = frame.head;
  const pitch = frame.pitch;
  const neck = Skia.Path.Make();
  const neckBaseX = geom.Px + (geom.bodyLen / 2 - 14 - geom.Px) * Math.cos(theta) - (geom.bodyY - 2 - geom.Py) * Math.sin(theta);
  const neckBaseY =
    geom.Py + (geom.bodyLen / 2 - 14 - geom.Px) * Math.sin(theta) + (geom.bodyY - 2 - geom.Py) * Math.cos(theta) + dy;
  neck.moveTo(neckBaseX, neckBaseY);
  neck.lineTo(head.x - 2, head.y + 3);
  canvas.drawPath(neck, paintOf(breed.coat, 1, geom.headR * 1.35));
  if (bandana?.c) {
    canvas.drawCircle((neckBaseX + head.x) / 2, (neckBaseY + head.y) / 2, geom.headR * 0.55, paintOf(bandana.c, 0.95));
  }
  if (collar?.c) {
    canvas.drawCircle(neckBaseX + (head.x - neckBaseX) * 0.45, neckBaseY + (head.y - neckBaseY) * 0.45, geom.headR * 0.28, paintOf(collar.c));
  }

  canvas.save();
  canvas.translate(head.x, head.y);
  canvas.rotate(deg(pitch), 0, 0);
  const radius = geom.headR;
  const cat = breed.species === 'cat';
  if (breed.ear === 'pointy' || breed.ear === 'cat') {
    const backEar = Skia.Path.Make();
    backEar.moveTo(-radius * 0.9, -radius * 0.5);
    backEar.lineTo(-radius * 0.55, -radius * (breed.ear === 'cat' ? 1.62 * breed.earSize : 1.7));
    backEar.lineTo(-radius * 0.05, -radius * 0.8);
    backEar.close();
    canvas.drawPath(backEar, paintOf(mix(breed.earColor, '#000000', 0.2)));
  }
  if (cat) {
    canvas.drawOval(oval(0, 0, radius * 1.06, radius * 0.96), paintOf(breed.coat));
  } else {
    canvas.drawCircle(0, 0, radius, paintOf(breed.coat));
  }
  const jaw = Math.max(
    actor.pose.pant * (0.45 + 0.2 * Math.sin(actor.panPh)),
    actor.bark.open * 0.85,
    actor.pose.headDown * (0.2 + 0.2 * Math.sin(actor.chewPh)),
  );
  const tongue = actor.pose.pant * (0.8 + 0.2 * Math.sin(actor.panPh + 1));
  const snout = geom.snout;
  const mx = radius * 0.55 + snout * 0.45;
  const my = radius * 0.3;
  const mrx = cat ? snout * 0.6 + radius * 0.34 : snout * 0.7 + radius * 0.3;
  const mry = cat ? radius * 0.38 : radius * 0.45;
  const jawY = my + mry * 0.55 + jaw * radius * 0.38;
  canvas.drawOval(oval(mx - mrx * 0.05, jawY, mrx * 0.92, mry * 0.5), paintOf(mix(breed.muzzle, '#000000', 0.14)));
  if (jaw > 0.04) {
    canvas.drawOval(
      oval(mx, my + mry * 0.5 + jaw * radius * 0.18, mrx * 0.85, Math.max(0.5, jaw * radius * 0.36)),
      paintOf('#3a1f22'),
    );
    if (tongue > 0.05) {
      canvas.drawOval(
        oval(mx + mrx * 0.15, jawY + radius * 0.04 + tongue * radius * 0.1, mrx * 0.42, radius * 0.1 + tongue * radius * 0.12),
        paintOf('#e87a8a'),
      );
    }
  }
  canvas.drawOval(oval(mx, my, mrx, mry), paintOf(breed.muzzle));
  if (cat) {
    canvas.drawOval(oval(mx + mrx * 0.85, my - radius * 0.1, radius * 0.11, radius * 0.08), paintOf(breed.pattern === 'points' ? '#8a6a5c' : '#e59aa6'));
  } else {
    canvas.drawOval(oval(mx + mrx * 0.9, my - radius * 0.12, radius * 0.17, radius * 0.13), paintOf('#1b1512'));
  }
  if (geom.cf > 0.02) {
    canvas.drawOval(oval(radius * 0.32, radius * 0.28, radius * 0.2, radius * 0.12), paintOf('#ff738c', 0.3 * Math.min(geom.cf, 1)));
  }
  const eyeR = radius * (0.13 + 0.07 * (1 - frame.geom.eye) + 0.12 * geom.cf);
  const ex = radius * (0.3 + 0.05 * geom.cf);
  const ey = -radius * (0.12 - 0.09 * geom.cf);
  const eyeColor = cat ? breed.eyeColor ?? '#79bd5a' : '#1b1512';
  if (closed > 0.6) {
    const lid = Skia.Path.Make();
    lid.addArc(oval(ex, ey - eyeR * 0.3, eyeR * 1.1, eyeR * 1.1), 27, 126);
    canvas.drawPath(lid, paintOf('#1b1512', 1, 2));
  } else {
    canvas.drawOval(oval(ex, ey, eyeR * (cat ? 1.12 : 1), eyeR * (1 - closed)), paintOf(eyeColor));
    if (cat) {
      canvas.drawOval(oval(ex, ey, eyeR * 0.4, eyeR * (1 - closed)), paintOf('#15110f'));
    }
    canvas.drawCircle(ex + eyeR * 0.35, ey - eyeR * 0.35, Math.max(0.4, eyeR * 0.35 * (1 - closed)), paintOf('#ffffff'));
  }
  if (geom.bags > 0.04) {
    canvas.drawOval(oval(ex, ey + eyeR * 1.15, eyeR * 0.9, eyeR * 0.45), paintOf('#6b5344', 0.45 * geom.bags));
  }
  if (breed.ear === 'pointy' || breed.ear === 'cat') {
    const ear = Skia.Path.Make();
    ear.moveTo(-radius * 0.55, -radius * 0.75);
    ear.lineTo(-radius * 0.1, -radius * (breed.ear === 'cat' ? 1.7 * breed.earSize : 1.8));
    ear.lineTo(radius * 0.5, -radius * 0.8);
    ear.close();
    canvas.drawPath(ear, paintOf(breed.earColor));
  } else {
    canvas.save();
    canvas.translate(-radius * 0.15, -radius * 0.35);
    canvas.rotate(deg(0.25 + Math.sin(actor.phase * 2) * 0.08 * actor.pose.walk - actor.bark.open * 0.15), 0, 0);
    canvas.drawOval(
      oval(0, radius * 0.55 * breed.earSize, radius * 0.4 * breed.earSize, radius * 0.85 * breed.earSize),
      paintOf(breed.earColor),
    );
    canvas.restore();
  }
  if (glasses?.c) {
    canvas.drawOval(oval(ex, ey, eyeR * 1.7, eyeR * 1.35), paintOf(glasses.c, 0.55, 2));
  }
  if (hat?.c) {
    canvas.drawOval(oval(0, -radius * 0.85, radius * 0.72, radius * 0.38), paintOf(hat.c));
    canvas.drawRect(Skia.XYWHRect(-radius * 0.9, -radius * 0.7, radius * 1.8, radius * 0.16), paintOf(hat.c));
  }
  canvas.restore();

  if (actor.pose.lie * actor.pose.eyes > 0.5) {
    for (let i = 0; i < 3; i += 1) {
      const k = (actor.breathPh * 0.08 + i / 3) % 1;
      const z = Skia.Path.Make();
      const zx = head.x + 18 + k * 16;
      const zy = head.y - radius - 8 - k * 22;
      z.moveTo(zx, zy);
      z.lineTo(zx + 8, zy);
      z.lineTo(zx, zy + 8);
      z.lineTo(zx + 8, zy + 8);
      canvas.drawPath(z, paintOf('#5C6B80', (1 - k) * 0.9, 1.4));
    }
  }
  canvas.restore();
}

function fillGradient(canvas: SkCanvas, x: number, y: number, w: number, h: number, top: string, bot: string): void {
  const paint = paintOf('#ffffff');
  paint.setShader(
    Skia.Shader.MakeLinearGradient(
      Skia.Point(x, y),
      Skia.Point(x, y + h),
      [Skia.Color(top), Skia.Color(bot)],
      null,
      TileMode.Clamp,
    ),
  );
  canvas.drawRect(Skia.XYWHRect(x, y, w, h), paint);
}

function skySpot(u: number, x: number, y: number, w: number, h: number, peak: number): { x: number; y: number } {
  const along = Math.max(-0.1, Math.min(1.1, u));
  return {
    x: x + w * (0.12 + 0.76 * u),
    y: y + h * 0.98 - Math.sin(Math.PI * along) * h * peak,
  };
}

function drawSkyPane(canvas: SkCanvas, x: number, y: number, w: number, h: number, tod: TimeOfDay, outdoor: boolean, reduced: boolean): void {
  const top = outdoor ? tod.top : '#d7e7f2';
  const bot = outdoor ? tod.bot : '#efe6d8';
  canvas.save();
  canvas.clipRect(Skia.XYWHRect(x, y, w, h), 0, true);
  fillGradient(canvas, x, y, w, h, top, bot);
  if (outdoor && tod.dark > 0.45) {
    for (let i = 0; i < 18; i += 1) {
      const sx = x + ((i * 47) % Math.max(w, 1));
      const sy = y + ((i * 29) % Math.max(h * 0.7, 1));
      const twinkle = reduced ? 1 : 0.55 + 0.45 * Math.sin(i + tod.hour);
      canvas.drawCircle(sx, sy, 1.2, paintOf('#ffffff', Math.min(1, (tod.dark - 0.45) * twinkle)));
    }
  }
  if (outdoor) {
    const radius = Math.max(5, Math.min(22, h * 0.17));
    const sun = (tod.hour - 6) / 12;
    if (sun > -0.12 && sun < 1.12) {
      const spot = skySpot(sun, x, y, w, h, 0.8);
      canvas.drawCircle(spot.x, spot.y, radius, paintOf('#fff3b0'));
    }
    const moon = ((tod.hour - 18 + 24) % 24) / 12;
    if (moon > -0.12 && moon < 1.12 && tod.dark > 0.02) {
      const spot = skySpot(moon, x, y, w, h, 0.7);
      canvas.drawCircle(spot.x, spot.y, radius * 0.82, paintOf('#f4f0d8', Math.min(1, tod.dark * 1.6)));
    }
  }
  canvas.restore();
}

function drawProp(canvas: SkCanvas, prop: Scene['props'][number], tod: TimeOfDay, reduced: boolean, bowlFill: number): void {
  canvas.save();
  canvas.translate(prop.x, prop.y);
  if (prop.scale) {
    canvas.scale(prop.scale, prop.scale);
  }
  const color = prop.color ?? '#8a6a52';
  if (prop.kind === 'bowl') {
    canvas.restore();
    drawBowl(canvas, prop.x, prop.y, bowlFill, color);
    return;
  }
  if (prop.kind === 'bed') {
    canvas.drawRect(Skia.XYWHRect(-(prop.w ?? 112) / 2, -28, prop.w ?? 112, 36), paintOf(color));
    canvas.drawOval(oval(0, -24, (prop.w ?? 112) * 0.42, 10), paintOf('#fff7ea'));
  } else if (prop.kind === 'rug') {
    canvas.drawOval(oval(0, 0, (prop.w ?? 200) / 2, (prop.h ?? 40) / 2), paintOf(color, 0.85));
  } else if (prop.kind === 'couch') {
    canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(-(prop.w ?? 160) / 2, -70, prop.w ?? 160, 78), 12, 12), paintOf(color));
  } else if (prop.kind === 'window') {
    const w = prop.w ?? 90;
    const h = prop.h ?? 80;
    canvas.drawRect(Skia.XYWHRect(-w / 2, -h, w, h), paintOf('#8a6a52'));
    drawSkyPane(canvas, -w / 2 + 6, -h + 6, w - 12, h - 16, tod, true, reduced);
  } else if (prop.kind === 'lamp') {
    canvas.drawRect(Skia.XYWHRect(-4, -70, 8, 70), paintOf('#5c5148'));
    canvas.drawOval(oval(0, -78, 16, 10), paintOf('#f4e2b0'));
    if (prop.glow !== false && tod.dark > 0.15) {
      canvas.drawCircle(0, -70, 36, paintOf('#ffc464', 0.28 * tod.dark));
    }
  } else if (prop.kind === 'tree') {
    canvas.drawRect(Skia.XYWHRect(-6, -40, 12, 50), paintOf('#6b4a32'));
    canvas.drawCircle(0, -70, 34, paintOf('#3f8f4e'));
  } else if (prop.kind === 'bush') {
    canvas.drawCircle(0, -16, 22, paintOf('#4f9a58'));
  } else if (prop.kind === 'bench') {
    canvas.drawRect(Skia.XYWHRect(-(prop.w ?? 90) / 2, -16, prop.w ?? 90, 10), paintOf('#8d5a32'));
  } else if (prop.kind === 'pond') {
    canvas.drawOval(oval(0, 0, (prop.w ?? 140) / 2, (prop.h ?? 30) / 2), paintOf('#6eb7d6'));
  } else if (prop.kind === 'fence') {
    canvas.drawRect(Skia.XYWHRect(-(prop.w ?? 640) / 2, -28, prop.w ?? 640, 8), paintOf('#efe6d2'));
  }
  canvas.restore();
}

function drawTinted(canvas: SkCanvas, tint: Rgba, draw: () => void): void {
  if (tint.a <= 0.001) {
    draw();
    return;
  }
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColorFilter(
    Skia.ColorFilter.MakeBlend(
      Skia.Color(`rgba(${Math.round(tint.r)},${Math.round(tint.g)},${Math.round(tint.b)},${tint.a})`),
      BlendMode.SrcATop,
    ),
  );
  canvas.saveLayer(paint);
  draw();
  canvas.restore();
}

function drawPetLight(canvas: SkCanvas, x: number, y: number, amount: number): void {
  const { radius, color } = lighting.petLight;
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setBlendMode(BlendMode.Screen);
  paint.setShader(
    Skia.Shader.MakeRadialGradient(
      Skia.Point(x, y),
      radius,
      [
        Skia.Color(`rgba(${color[0]},${color[1]},${color[2]},${amount})`),
        Skia.Color(`rgba(${color[0]},${color[1]},${color[2]},0)`),
      ],
      null,
      TileMode.Clamp,
    ),
  );
  canvas.drawCircle(x, y, radius, paint);
}

function drawWorld(canvas: SkCanvas, world: World, width: number, height: number, tod: TimeOfDay, reduced: boolean): void {
  const scene = world.scene;
  const floor = scene.floor;
  canvas.scale(width / stageWidth, height / stageHeight);
  const outdoor = scene.time === 'outdoor';
  const skyTop = outdoor ? tod.top : scene.sky[0];
  const skyBot = outdoor ? tod.bot : scene.sky[1];
  const roomTint = sceneryTint(scene, tod);
  const bodyTint = actorTint(scene, tod);
  drawTinted(canvas, roomTint, () => {
    if (outdoor) {
      drawSkyPane(canvas, 0, 0, stageWidth, floor.horizon, tod, true, reduced);
    } else {
      fillGradient(canvas, 0, 0, stageWidth, floor.horizon, skyTop, skyBot);
    }
    fillGradient(canvas, 0, floor.horizon, stageWidth, stageHeight - floor.horizon, floor.color[0], floor.color[1]);
    for (const layer of scene.layers) {
      if (layer.t === 'sky' && layer.x != null && layer.y != null && layer.w != null && layer.h != null) {
        drawSkyPane(canvas, layer.x, layer.y, layer.w, layer.h, tod, true, reduced);
      } else if (layer.t === 'rect' && layer.x != null && layer.y != null && layer.w != null && layer.h != null && layer.fill) {
        canvas.drawRect(Skia.XYWHRect(layer.x, layer.y, layer.w, layer.h), paintOf(layer.fill, layer.alpha ?? 1));
      } else if (layer.t === 'ellipse' && layer.x != null && layer.y != null && layer.fill) {
        canvas.drawOval(oval(layer.x, layer.y, layer.rx ?? 10, layer.ry ?? 10), paintOf(layer.fill, layer.alpha ?? 1));
      }
    }
    for (const prop of scene.props) {
      if ((prop.layer ?? 'sorted') === 'back') {
        drawProp(canvas, prop, tod, reduced, world.bowlFill);
      }
    }
  });
  if (scene.time === 'indoor') {
    const glow = petLightAmount(tod.dark);
    if (glow > 0) {
      for (const actor of world.actors) {
        drawPetLight(canvas, actor.x, actor.y, glow);
      }
    }
  }
  const items: { y: number; draw: () => void }[] = [];
  for (const prop of scene.props) {
    if ((prop.layer ?? 'sorted') === 'sorted') {
      items.push({
        y: prop.y,
        draw: () => drawTinted(canvas, roomTint, () => drawProp(canvas, prop, tod, reduced, world.bowlFill)),
      });
    }
  }
  for (const actor of world.actors) {
    const breed = breedById(actor.breedId);
    if (!breed) {
      continue;
    }
    items.push({
      y: actor.y,
      draw: () =>
        drawTinted(canvas, bodyTint, () => {
          drawActor(canvas, actor, breed, floor);
          if (world.ball.state === 'carried' && world.ball.carrierId === actor.id) {
            drawBallShape(canvas, actor.mouth.x, actor.mouth.y, 8);
          }
        }),
    });
  }
  if (world.ball.state === 'free') {
    items.push({
      y: world.ball.y,
      draw: () =>
        drawTinted(canvas, bodyTint, () => {
          const size = depthScale(world.ball.y, floor.yMin, floor.yMax);
          const radius = 8 * size;
          canvas.drawOval(oval(world.ball.x, world.ball.y + 1, radius * 1.1, radius * 0.4), paintOf('#000000', 0.15));
          drawBallShape(canvas, world.ball.x, world.ball.y - world.ball.z - radius, radius);
        }),
    });
  }
  items.sort((a, b) => a.y - b.y);
  for (const item of items) {
    item.draw();
  }
  for (const prop of scene.props) {
    if (prop.layer === 'front') {
      drawTinted(canvas, roomTint, () => drawProp(canvas, prop, tod, reduced, world.bowlFill));
    }
  }
  if (scene.time === 'indoor') {
    for (const prop of scene.props) {
      if (prop.kind === 'lamp' && prop.glow !== false && tod.dark > 0.15) {
        canvas.drawCircle(prop.x, prop.y - 70, 42, paintOf('#ffc464', 0.35 * tod.dark));
      }
    }
  }
}

export function PetView({ pet, cueKind, cueToken, drop, hour, reducedMotion, onWeightDelta }: Props) {
  const { width } = useWindowDimensions();
  const viewWidth = Math.max(280, width - 40);
  const viewHeight = viewWidth * (stageHeight / stageWidth);
  const widthRef = useRef(viewWidth);
  const heightRef = useRef(viewHeight);
  widthRef.current = viewWidth;
  heightRef.current = viewHeight;
  const worldRef = useRef<World>(createWorld([spawnActor(sourceOf(pet))], 1, sceneById(pet.sceneId)));
  const activeRef = useRef(AppState.currentState === 'active');
  const hourRef = useRef(hour);
  const reducedRef = useRef(reducedMotion);
  const todRef = useRef<TimeOfDay>(todAt(12));
  const todAtMs = useRef(0);
  if (hourRef.current !== hour) {
    todAtMs.current = 0;
  }
  hourRef.current = hour;
  reducedRef.current = reducedMotion;
  const picture = useSharedValue<SkPicture>(
    useMemo(() => {
      const recorder = Skia.PictureRecorder();
      recorder.beginRecording(Skia.XYWHRect(0, 0, viewWidth, viewHeight));
      return recorder.finishRecordingAsPicture();
    }, [viewHeight, viewWidth]),
  );
  const previous = useRef<SkPicture | null>(null);

  const redraw = useCallback(() => {
    const recorder = Skia.PictureRecorder();
    const bounds = Skia.XYWHRect(0, 0, widthRef.current, heightRef.current);
    const canvas = recorder.beginRecording(bounds);
    const now = Date.now();
    if (now - todAtMs.current > 1000) {
      const clock = new Date(now);
      const live = clock.getHours() + clock.getMinutes() / 60 + clock.getSeconds() / 3600;
      todRef.current = todAt(hourRef.current == null ? live : hourRef.current);
      todAtMs.current = now;
    }
    worldRef.current.reducedMotion = reducedRef.current;
    drawWorld(canvas, worldRef.current, widthRef.current, heightRef.current, todRef.current, reducedRef.current);
    const next = recorder.finishRecordingAsPicture();
    const older = previous.current;
    previous.current = picture.value;
    picture.value = next;
    older?.dispose();
  }, [picture]);

  useEffect(() => {
    const world = worldRef.current;
    const actor = world.actors[0];
    if (!actor || actor.id !== pet.id) {
      world.actors = [spawnActor(sourceOf(pet))];
      world.ball.state = 'none';
    } else {
      syncActor(actor, sourceOf(pet));
    }
    if (world.scene.id !== pet.sceneId) {
      setWorldScene(world, sceneById(pet.sceneId));
    }
    redraw();
  }, [pet.ageDays, pet.asleep, pet.breedId, pet.equipped, pet.id, pet.sceneId, pet.vitality, pet.weight, redraw]);

  useEffect(() => {
    const actor = worldRef.current.actors[0];
    if (!actor) {
      return;
    }
    if (cueKind === 'eat') {
      startUserTask(worldRef.current, actor, 'eat');
    } else if (cueKind === 'drink') {
      startUserTask(worldRef.current, actor, 'drink');
    } else if (cueKind === 'yawn') {
      startUserTask(worldRef.current, actor, 'sleep');
    } else if (cueKind === 'purr') {
      startUserTask(worldRef.current, actor, 'react', 0.8);
    } else if (cueKind === 'wiggle') {
      startUserTask(worldRef.current, actor, 'react', 0.2);
    } else if (cueKind === 'fetch') {
      startUserTask(worldRef.current, actor, 'fetch', 1, drop);
    }
    redraw();
  }, [cueKind, cueToken, drop, redraw]);

  const step = useCallback(
    (elapsedMs: number) => {
      update(worldRef.current, frameDt(elapsedMs, activeRef.current));
      const actor = worldRef.current.actors[0];
      if (actor) {
        const delta = takeWeightDelta(actor);
        if (Math.abs(delta) > 0.00001) {
          onWeightDelta(delta);
        }
      }
      redraw();
    },
    [onWeightDelta, redraw],
  );

  const kick = useRef<() => void>(() => undefined);

  useEffect(() => {
    let raf = 0;
    let last = Date.now();
    let running = true;
    const loop = () => {
      if (!running) {
        return;
      }
      const now = Date.now();
      step(now - last);
      last = now;
      if (activeRef.current) {
        raf = requestAnimationFrame(loop);
      }
    };
    kick.current = () => {
      cancelAnimationFrame(raf);
      last = Date.now();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [step]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      const active = status === 'active';
      const returned = active && !activeRef.current;
      activeRef.current = active;
      if (returned) {
        settleOnResume(worldRef.current);
        kick.current();
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <Canvas style={[styles.canvas, { width: viewWidth, height: viewHeight }]}>
      <Picture picture={picture} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
  },
});
