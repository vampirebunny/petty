import { Skia, StrokeCap } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import { bodyFrame, gaitFoot, isDarkCoat, solveKnee, wearItem } from '../../actor';
import type { Actor, Breed, Geom } from '../../actor';
import { headFaceOf, headShift, noseOf, torsoPoint } from '../../actor/geometry';
import { frostColorOf } from '../../actor/color';
import { baseColorOf, markingOf, resolveMarkings } from '../../actor/markings';
import { earProfiles } from '../../actor/data/breedShapes';
import { cuddleDefaults } from '../../actor/data/cuddle';
import {
  drawBodyMarkings,
  drawEar,
  drawEye,
  drawHeadMarkingsAbove,
  drawHeadMarkingsBelow,
  drawRuff,
  clipRectAbove,
  drawSkull,
  drawTail,
  earColorOf,
  muzzleColorOf,
} from './breedParts';
import type { HeadCtx } from './breedParts';
import { drawBandana, drawBoot, drawCoat, drawCollar, drawGlasses, drawHat } from './cosmetics';
import {
  clamp,
  clipOval,
  deg,
  fillCircle,
  fillOval,
  fillRRect,
  mix,
  paintOf,
  strokeLine,
} from './draw';
import type { WearItem } from '../../actor/wardrobe';
import { frostOval } from './frost';
import { drawBallShape } from './scenery';

type Pt = { x: number; y: number };

type Paw = { x: number; y: number; shin: number; knee: Pt };

// Two-bone leg: the knee bends toward `side`, the paw stays on the bone length even when the target is out of reach.
function drawLeg(
  c: SkCanvas,
  hip: Pt,
  target: Pt,
  geom: Geom,
  side: number,
  color: string,
  boot: WearItem | null,
  far: boolean,
  sock: string | null,
  frost = 0,
): Paw {
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
  if (sock) {
    // Socks or tan lower legs: the lower half of the leg and the paw in the marking color.
    const sockColor = far ? mix(sock, '#000000', 0.32) : sock;
    strokeLine(c, knee.x + (paw.x - knee.x) * 0.45, knee.y + (paw.y - knee.y) * 0.45, paw.x, paw.y, sockColor, geom.legWidth);
    fillOval(c, paw.x + 3, paw.y - 3, geom.pawRx, geom.pawRy, sockColor);
  }
  if (frost > 0.01) {
    // Senior frosting on the paw and the lower leg, over the sock color when there is one.
    const frostColor = frostColorOf(sock ? (far ? mix(sock, '#000000', 0.32) : sock) : color);
    frostOval(c, paw.x + 3, paw.y - 3, geom.pawRx * 1.05, geom.pawRy * 1.1, frostColor, frost);
    for (const f of [0.5, 0.75]) {
      frostOval(c, knee.x + (paw.x - knee.x) * f, knee.y + (paw.y - knee.y) * f, geom.legWidth * 0.8, geom.legWidth * 0.8, frostColor, frost * 0.85);
    }
  }
  if (boot) {
    drawBoot(c, knee, paw, geom, boot, far);
  }
  return { x: paw.x, y: paw.y, shin: Math.atan2(paw.y - knee.y, paw.x - knee.x), knee };
}

export function drawActor(
  c: SkCanvas,
  actor: Actor,
  breed: Breed,
  floor: { yMin: number; yMax: number },
  t: number,
  carrying: boolean,
  silhouette = false,
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
  // Breed marking regions, resolved against the coat. Locked regions ignore the user palette.
  const markings = resolveMarkings(breed);
  const baseColor = baseColorOf(breed);
  const legColor = markingOf(markings, 'legs')?.color ?? (points ? breed.accent ?? baseColor : baseColor);
  const tailColor = markingOf(markings, 'tail')?.color ?? legColor;
  const farColor = mix(legColor, '#000000', 0.32);
  const socks = markingOf(markings, 'socks') ?? markingOf(markings, 'lowerLegs');
  const sockColor = socks ? socks.color : null;
  const featherColor = markingOf(markings, 'feathering')?.color ?? mix(baseColor, '#ffffff', 0.18);
  const tailDeco = {
    feather: featherColor,
    tip: markingOf(markings, 'tailTip')?.color ?? null,
    rings: markingOf(markings, 'tailRings')?.color ?? null,
  };
  const lighter = mix(baseColor, '#ffffff', 0.25);
  const bodyDeco = {
    chestRuff: breed.ruff === 'chest' ? lighter : null,
    scallop: breed.texture === 'longCoat' ? baseColor : null,
  };
  // Tabby breeds draw their stripes from marking regions instead of the generic stripes pattern.
  const tabby = markingOf(markings, 'tabbyBack') != null;
  const darkPoints = points || breed.baseRule != null;

  if (silhouette) {
    // Debug view: everything the actor draws is flattened to solid black, so only the outline remains.
    const flat = Skia.Paint();
    flat.setColorFilter(Skia.ColorFilter.MakeMatrix([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]));
    c.saveLayer(flat);
  }
  c.save();
  c.translate(actor.x, actor.y);
  c.scale(actor.face * scale, scale);
  // Cuddle: the torso leans with the finger, and a shake-off wobbles the whole body about its feet.
  c.translate(pose.torsoShift, 0);
  if (pose.shake > 0.01) {
    c.rotate(deg(Math.sin(t * 42) * 0.07 * pose.shake), 0, 0);
    c.translate(Math.sin(t * 37) * 2.2 * pose.shake, 0);
  }
  fillOval(c, geom.bodyLen * 0.05 + 10 * pose.lie, 2, geom.bodyLen * (0.52 + 0.08 * pose.lie), 7, '#000000', 0.13);
  c.translate(0, -actor.z / scale);

  const footAt = (hip: Pt, fore: boolean, offset: number, nearFore: boolean, kicker = false): Pt => {
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
    if (pose.belly > 0.001) {
      // On its back the legs fold up toward the body, and paddle slowly when the belly is rubbed.
      x = hip.x + (x - hip.x) * (1 - 0.3 * pose.belly);
      y = hip.y + (y - hip.y) * (1 - 0.3 * pose.belly);
      x += Math.sin(t * 5 + offset + (fore ? 1 : 0)) * 5 * pose.paddle;
      y += Math.cos(t * 5 + offset + (fore ? 1 : 0)) * 4 * pose.paddle;
    }
    if (fore && pose.knead > 0.001) {
      // Kneading: the front paws press in turn, about twice a second.
      y -= Math.max(0, Math.sin(t * Math.PI * 2 * cuddleDefaults.escalation.kneadHz + offset)) * geom.L * 0.22 * pose.knead;
    }
    if (kicker && pose.kick > 0.001) {
      // A few quick small lifts of the near hind leg.
      y -= Math.abs(Math.sin(t * 16)) * geom.L * 0.35 * pose.kick;
    }
    return { x, y };
  };

  const foreNear = torsoPoint(geom, theta, dy, geom.foreX, geom.hipY);
  const hindNear = torsoPoint(geom, theta, dy, geom.hindX, geom.hipY);
  const foreFar = { x: foreNear.x + 4, y: foreNear.y };
  const hindFar = { x: hindNear.x + 4, y: hindNear.y };
  const foreSide = pose.lie > 0.5 ? -1 : 1;

  // Roll-over mirrors the torso, legs, and tail about the body's center line. The head stays upright.
  const bellyScale = 1 - 2 * pose.belly;
  const bodyCenterY = geom.bodyY + dy;
  c.save();
  if (pose.belly > 0.001) {
    c.translate(0, bodyCenterY);
    c.scale(1, bellyScale);
    c.translate(0, -bodyCenterY);
  }
  const hindFarPaw = drawLeg(c, hindFar, footAt(hindFar, false, 0, false), geom, -1, farColor, boot, true, sockColor, geom.gray.chest);
  const foreFarPaw = drawLeg(c, foreFar, footAt(foreFar, true, Math.PI, false), geom, foreSide, farColor, boot, true, sockColor, geom.gray.chest);

  // torso: tail, body, markings, ribs, coat
  c.save();
  c.translate(0, dy);
  c.translate(geom.Px, geom.Py);
  c.rotate(deg(theta), 0, 0);
  c.translate(-geom.Px, -geom.Py);
  drawTail(c, breed, geom, wag, tailColor, pose.tailLift, tailDeco);
  const breath = 1 + pose.breathAmp * Math.sin(actor.breathPh);
  fillOval(c, 0, geom.bodyY, geom.bodyLen / 2, (geom.bodyH / 2) * breath, baseColor);
  fillOval(
    c,
    4,
    geom.bodyY + geom.bodyH * 0.22,
    geom.bodyLen * 0.38,
    geom.bodyH * 0.22 * breath,
    mix(baseColor, '#ffffff', 0.18),
  );
  if (breed.pattern === 'stripes' && !tabby) {
    c.save();
    clipOval(c, 0, geom.bodyY, geom.bodyLen / 2, (geom.bodyH / 2) * breath);
    const stripes = Skia.Path.Make();
    for (let i = 0; i < 6; i += 1) {
      const sx = -geom.bodyLen * 0.34 + i * geom.bodyLen * 0.14;
      stripes.moveTo(sx, geom.bodyY - geom.bodyH * 0.5);
      stripes.quadTo(sx + 6, geom.bodyY - geom.bodyH * 0.1, sx + 2, geom.bodyY + geom.bodyH * 0.12);
    }
    c.drawPath(stripes, paintOf(mix(baseColor, '#000000', 0.5), 0.55, 4));
    c.restore();
  }
  drawBodyMarkings(c, geom, markings, breath, bodyDeco);
  if (geom.gray.chest > 0.01) {
    // Senior frosting on the chest, over a locked white bib or the coat.
    frostOval(
      c,
      geom.bodyLen * 0.37,
      geom.bodyY + geom.bodyH * 0.2,
      geom.bodyLen * 0.13,
      geom.bodyH * 0.36,
      frostColorOf(markingOf(markings, 'chest')?.color ?? baseColor),
      geom.gray.chest,
    );
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

  const hindNearPaw = drawLeg(c, hindNear, footAt(hindNear, false, Math.PI, false, true), geom, -1, legColor, boot, false, sockColor, geom.gray.chest);
  const foreNearPaw = drawLeg(c, foreNear, footAt(foreNear, true, 0, true), geom, foreSide, legColor, boot, false, sockColor, geom.gray.chest);
  actor.anchors.paws = [hindFarPaw, foreFarPaw, hindNearPaw, foreNearPaw].map(({ x, y, shin }) => ({ x, y, shin }));
  c.restore();

  // neck, bandana, collar
  const shift = headShift(geom, frame.head.y, pose);
  const head = { x: frame.head.x + shift.x, y: frame.head.y + shift.y };
  const pitch = frame.pitch + pose.headRot;
  const base = torsoPoint(geom, theta, dy, geom.bodyLen / 2 - 14, geom.bodyY - 2);
  if (pose.belly > 0.001) {
    base.y = bodyCenterY + (base.y - bodyCenterY) * bellyScale;
  }
  const neckWidth = geom.headR * 1.35;
  strokeLine(c, base.x, base.y, head.x - 2, head.y + 3, baseColor, neckWidth);
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
    pose.headDown * (0.3 + 0.3 * Math.sin(actor.chewPh)),
  );
  const tongue = pose.pant * (0.8 + 0.2 * Math.sin(actor.panPh + 1));
  const cf = geom.cf;
  const profile = earProfiles[breed.earType];
  // 3/4 head turn: all eye, snout and far-ear positions come from one layout shared with the anchors.
  const turn = clamp(pose.headTurn, 0, 1);
  const face = headFaceOf(breed, geom, turn);
  const eyeR = face.eyeR;
  const ex = face.nearEye.x;
  const ey = face.nearEye.y;
  const headCtx: HeadCtx = { breed, geom, face, markings };
  const earColor = earColorOf(breed, markings);
  const nearPaint = {
    color: earColor,
    inner: cat ? (darkPoints ? '#a07d70' : '#e8a3ad') : mix(earColor, '#ffffff', 0.35),
    feather: featherColor,
  };
  const farPaint = { ...nearPaint, color: mix(earColor, '#000000', 0.2) };
  const muzzleColor = muzzleColorOf(breed, markings);
  const earSwing = Math.sin(actor.phase * 2) * 0.08 * pose.walk - barkOpen * 0.15 + pose.earBack;
  const nearEar = (): void =>
    drawEar(c, breed, geom, nearPaint, { far: false, shift: face.nearEarShift, angle: 0.25 + earSwing, earBack: pose.earBack, alpha: 1 });
  const farEar = (): void =>
    drawEar(c, breed, geom, farPaint, {
      far: true,
      shift: face.farEarShift,
      angle: -0.25 + pose.earBack,
      earBack: pose.earBack,
      alpha: profile.stiff ? 1 : face.farEarAlpha,
    });
  c.save();
  // At the bowl the head dips and lifts with each bite or lap.
  c.translate(head.x, head.y + pose.headDown * Math.sin(actor.chewPh) * 1.8);
  c.rotate(deg(pitch), 0, 0);
  // The far ear sits behind the head and slides to the far side as the head turns. Hanging far ears stay
  // partly hidden behind the head; erect ears show both.
  if (!profile.overHead && (profile.stiff || face.farEarAlpha > 0.001)) {
    farEar();
  }
  drawRuff(c, headCtx, baseColor, lighter);
  if (cat) {
    fillOval(c, 0, 0, R * 1.06, R * 0.96, baseColor);
  } else {
    fillCircle(c, 0, 0, R, baseColor);
  }
  drawSkull(c, headCtx, baseColor);
  if (profile.overHead) {
    // Folded ears lie on the head, so the far one is drawn over the head circle too.
    farEar();
  }
  if (breed.pattern === 'stripes' && !tabby) {
    const marks = Skia.Path.Make();
    marks.moveTo(-R * 0.1, -R * 0.92);
    marks.lineTo(-R * 0.1, -R * 0.55);
    marks.moveTo(R * 0.15, -R * 0.88);
    marks.lineTo(R * 0.2, -R * 0.55);
    marks.moveTo(-R * 0.36, -R * 0.84);
    marks.lineTo(-R * 0.4, -R * 0.52);
    c.drawPath(marks, paintOf(mix(baseColor, '#000000', 0.5), 0.6, 2.6));
  }
  drawHeadMarkingsBelow(c, headCtx);
  // The muzzle comes from breed data: its 3/4 shape (visible length, width, drop) is already in the layout.
  const mrx = face.muzzle.rx;
  const mry = face.muzzle.ry * pose.snoutScale;
  const mx = face.muzzle.x;
  const my = face.muzzle.y;
  const nose = noseOf(breed, R, face, pose.snoutScale);
  const noseX = nose.x;
  const noseY = nose.y;
  const noseK = cat ? face.noseSize / 0.8 : face.noseSize;
  const jawY = my + mry * 0.55 + jaw * R * 0.38;
  fillOval(c, mx - mrx * 0.05, jawY, mrx * 0.92, mry * 0.5, mix(muzzleColor, '#000000', 0.14));
  if (jaw > 0.04) {
    fillOval(c, mx, my + mry * 0.5 + jaw * R * 0.18, mrx * 0.85, Math.max(0.5, jaw * R * 0.36), '#3a1f22');
    if (tongue > 0.05) {
      fillOval(c, mx + mrx * 0.15, jawY + R * 0.04 + tongue * R * 0.1, mrx * 0.42, R * 0.1 + tongue * R * 0.12, '#e87a8a');
    }
  }
  if (face.squareMuzzle) {
    fillRRect(c, mx - mrx, my - mry, mrx * 2, mry * 2, Math.min(mrx, mry) * 0.45, muzzleColor);
  } else {
    fillOval(c, mx, my, mrx, mry, muzzleColor);
  }
  if (geom.gray.muzzle > 0.01) {
    // Senior frosting on the muzzle and chin, over the muzzle's own color (a pug's mask or Siamese points too).
    const frostColor = frostColorOf(muzzleColor);
    frostOval(c, mx, my, mrx * 0.95, mry * 0.95, frostColor, geom.gray.muzzle);
    frostOval(c, mx, my + mry * 0.8, mrx * 0.7, mry * 0.4, frostColor, geom.gray.muzzle * 0.9);
  }
  if (cat) {
    fillOval(c, noseX, noseY, R * 0.11 * noseK, R * 0.08 * noseK, darkPoints ? '#8a6a5c' : '#e59aa6');
    if (jaw < 0.04 && turn < 0.99) {
      const mouth = Skia.Path.Make();
      mouth.moveTo(mx + mrx * 0.82, my - R * 0.02);
      mouth.lineTo(mx + mrx * 0.82, my + R * 0.1);
      mouth.moveTo(mx + mrx * 0.82, my + R * 0.1);
      mouth.quadTo(mx + mrx * 0.5, my + R * 0.2, mx + mrx * 0.15, my + R * 0.1);
      c.drawPath(mouth, paintOf('#281919', 0.55 * (1 - turn), 1.1));
    }
    const whiskers = Skia.Path.Make();
    for (let wk = -1; wk <= 1; wk += 1) {
      whiskers.moveTo(mx + mrx * 0.3, my + R * 0.04 + wk * 0.03 * R);
      whiskers.lineTo(mx + mrx + R * 0.95, my + R * 0.02 + wk * R * 0.22);
    }
    const pale = points || isDarkCoat(baseColor);
    c.drawPath(whiskers, paintOf(pale ? '#ebebf0' : '#ffffff', pale ? 0.75 : 0.85, 1.1));
  } else {
    fillOval(c, noseX, noseY, R * (0.17 + 0.03 * turn) * noseK, R * (0.13 + 0.01 * turn) * noseK, '#1b1512');
  }
  // Small centered "w" mouth under the nose at the 3/4 turn (dogs show it when the jaw is shut).
  if (turn > 0.01 && jaw < 0.04) {
    const wy = noseY + mry * 0.45;
    const s = R * 0.13;
    const mouthW = Skia.Path.Make();
    mouthW.moveTo(noseX, noseY + R * 0.05);
    mouthW.lineTo(noseX, wy);
    mouthW.moveTo(noseX - s, wy - R * 0.02);
    mouthW.quadTo(noseX - s / 2, wy + R * 0.09, noseX, wy);
    mouthW.quadTo(noseX + s / 2, wy + R * 0.09, noseX + s, wy - R * 0.02);
    c.drawPath(mouthW, paintOf('#281919', 0.6 * turn, 1.1));
  }
  fillOval(c, ex + R * 0.02, ey + R * 0.4, R * 0.2, R * 0.12, '#ff738c', 0.3 * Math.min(cf, 1));
  if (face.farEyeAlpha > 0.001) {
    // Far cheek blush and far eye. Clipped to the head and faded in over t = 0..0.3 so it never pops.
    const fa = face.farEyeAlpha;
    c.save();
    clipOval(c, 0, 0, R, cat ? R * 0.96 : R);
    fillOval(c, face.farEye.x + R * 0.02, ey + R * 0.4, R * 0.14, R * 0.09, '#ff738c', 0.3 * Math.min(cf, 1) * fa);
    if (fa < 0.999) {
      const layer = Skia.Paint();
      layer.setAlphaf(fa);
      c.saveLayer(layer);
    }
    c.save();
    c.translate(face.farEye.x, face.farEye.y);
    c.scale(face.farEyeScale.x, face.farEyeScale.y);
    drawEye(c, 0, 0, eyeR, eyeClosed, breed, cf);
    c.restore();
    if (fa < 0.999) {
      c.restore();
    }
    c.restore();
  }
  drawEye(c, ex, ey, eyeR, eyeClosed, breed, cf);
  if (geom.bags > 0.04) {
    fillOval(c, ex, ey + eyeR * 1.15, eyeR * 0.9, eyeR * 0.45, '#6b5344', 0.45 * geom.bags);
    if (face.farEyeAlpha > 0.001) {
      fillOval(c, face.farEye.x, ey + eyeR * 1.1, eyeR * 0.68, eyeR * 0.4, '#6b5344', 0.45 * geom.bags * face.farEyeAlpha);
    }
  }
  if (geom.gray.brows > 0.01) {
    // Senior frosting over the brows and the outer corner of each eye. The far eye follows its fade-in.
    const browColor = frostColorOf(markingOf(markings, 'blackMask')?.color ?? baseColor);
    frostOval(c, ex + eyeR * 0.1, ey - eyeR * 1.9, eyeR * 1.5, eyeR * 0.65, browColor, geom.gray.brows);
    frostOval(c, ex - eyeR * 1.1, ey + eyeR * 0.3, eyeR * 0.65, eyeR * 0.65, browColor, geom.gray.brows * 0.8);
    if (face.farEyeAlpha > 0.001) {
      const far = geom.gray.brows * face.farEyeAlpha;
      frostOval(c, face.farEye.x + eyeR * 0.1, ey - eyeR * 1.8, eyeR * 1.2, eyeR * 0.55, browColor, far);
      frostOval(c, face.farEye.x + eyeR * 0.9, ey + eyeR * 0.3, eyeR * 0.5, eyeR * 0.55, browColor, far * 0.8);
    }
  }
  drawHeadMarkingsAbove(c, headCtx);
  // near ear (slides back in 3/4 so the ears spread apart)
  nearEar();
  if (glasses) {
    drawGlasses(c, glasses, face, R);
  }
  if (hat) {
    drawHat(c, hat, R, face);
    if (hat.id === 'beanie' && profile.hatPoke) {
      // Erect and bat ears poke through the beanie: redraw them over it, above the brim.
      c.save();
      clipRectAbove(c, -R * 0.55, R * 3);
      farEar();
      nearEar();
      c.restore();
    }
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

  if (silhouette) {
    c.restore();
  }

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
