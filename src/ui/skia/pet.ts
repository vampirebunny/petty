import { Skia, StrokeCap } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import { blendedFoot, bodyFrame, isDarkCoat, solveKnee, wearItem } from '../../actor';
import type { Actor, Breed, Geom } from '../../actor';
import { headFaceOf, headShift, noseOf, torsoPoint } from '../../actor/geometry';
import { visualYaw } from '../../actor/turn';
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
import { drawToyShape } from './scenery';

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
  carrying: string | null,
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
    actor.gait,
    actor.share,
  );
  const geom = frame.geom;
  const pose = actor.pose;
  const turned = visualYaw(actor.yaw);
  const scale = frame.scale * (1 + 0.35 * pose.closeUp);
  const cat = breed.species === 'cat';
  let theta = frame.theta - 0.35 * pose.rearUp + Math.sin(t * 9 + 1) * 0.03 * pose.rubSway;
  let dy = frame.dy + geom.dLie * pose.side;
  const barkOpen = actor.bark.open;
  // Streaming back at a gallop pulls the ears flat and stretches the tail out behind the body.
  const earBackNow = pose.earBack + 0.35 * pose.stream;
  const wag = Math.sin(actor.wagPh) * pose.wagAmp * (1 - 0.7 * pose.stream);
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
  const farColor = mix(mix(legColor, '#000000', 0.32), legColor, turned.ys);
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
  c.translate(actor.x, actor.y + 18 * pose.closeUp);
  c.scale(turned.dir * scale, scale);
  // Cuddle: the torso leans with the finger, and a shake-off wobbles the whole body about its feet.
  c.translate(pose.torsoShift, 0);
  if (pose.shake > 0.01) {
    c.rotate(deg(Math.sin(t * 42) * 0.07 * pose.shake), 0, 0);
    c.translate(Math.sin(t * 37) * 2.2 * pose.shake, 0);
  }
  // The shadow stays on the ground and shrinks and fades with height.
  const shadowK = clamp(1 - actor.z / 150, 0.45, 1);
  fillOval(
    c,
    (geom.bodyLen * 0.05 + 10 * pose.lie) * turned.yc,
    2,
    geom.bodyLen * (0.52 + 0.08 * pose.lie) * shadowK * Math.max(turned.yc, 0.55),
    7 * shadowK,
    '#000000',
    0.13 * shadowK,
  );
  c.translate(0, -actor.z / scale);

  const footAt = (hip: Pt, fore: boolean, leg: 0 | 1 | 2 | 3, nearFore: boolean, kicker = false): Pt => {
    const offset = leg === 1 || leg === 2 ? Math.PI : 0;
    const gait = blendedFoot(actor.gait, leg, actor.phase, geom.L, actor.share);
    const stand = { x: hip.x + (fore ? 3 : -1) + gait.x * pose.walk, y: gait.y * pose.walk };
    const sit = fore ? { x: hip.x + 4, y: 0 } : { x: hip.x + 0.45 * geom.L, y: 0 };
    const lieReach = Math.sqrt(Math.max(0, 0.97 * geom.L * (0.97 * geom.L) - hip.y * hip.y));
    const lie = fore ? { x: hip.x + lieReach, y: 0 } : { x: hip.x + 0.42 * geom.L, y: 0 };
    let x = stand.x + (sit.x - stand.x) * pose.sit + (lie.x - stand.x) * pose.lie;
    let y = stand.y + (sit.y - stand.y) * pose.sit + (lie.y - stand.y) * pose.lie;
    // Airborne: the legs tuck up and in under the body.
    if (pose.tuck > 0.001) {
      x = hip.x + (x - hip.x) * (1 - 0.45 * pose.tuck);
      y = Math.min(y, 0) * (1 - pose.tuck) - geom.L * 0.2 * pose.tuck;
    }
    // Play bow: the forelegs stretch forward along the ground, the rump stays up on the hind legs.
    if (fore && pose.bow > 0.001) {
      x += (hip.x + 0.55 * geom.L - x) * pose.bow;
      y += (0 - y) * pose.bow;
    }
    // A skid: the forelegs reach out ahead to brake.
    if (fore && pose.skid > 0.001) {
      x += geom.L * 0.22 * pose.skid;
    }
    // A stalking crouch: the legs are bent and the paws stay close.
    if (pose.stalk > 0.001) {
      x = hip.x + (x - hip.x) * (1 - 0.35 * pose.stalk);
    }
    // The butt wiggle before a pounce: the hind feet shuffle side to side.
    if (!fore && pose.wiggle > 0.001) {
      x += Math.sin(actor.wagPh * 0.9) * 3.5 * pose.wiggle;
    }
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
    if (fore && pose.rearUp > 0.001) {
      x += (hip.x + 0.2 * geom.L - x) * pose.rearUp;
      y += (hip.y - 0.35 * geom.L - y) * pose.rearUp;
    }
    if (pose.side > 0.001) {
      const laid = fore ? { x: hip.x + 0.55 * geom.L, y: 0 } : { x: hip.x - 0.4 * geom.L, y: 0 };
      x += (laid.x - x) * pose.side;
      y += (laid.y - y) * pose.side;
    }
    if (pose.legPedal > 0.001 && pose.belly > 0.2) {
      x += Math.sin(t * 9 + leg * 1.7) * 0.16 * geom.L * pose.legPedal;
      y += Math.cos(t * 9 + leg * 1.7) * 0.08 * geom.L * pose.legPedal;
    }
    return { x, y };
  };

  const project = (point: Pt, side: number): Pt => ({
    x: point.x * turned.yc + side * geom.bodyH * 0.3 * turned.ys,
    y: point.y,
  });
  const foreHip = torsoPoint(geom, theta, dy, geom.foreX, geom.hipY);
  const hindHip = torsoPoint(geom, theta, dy, geom.hindX, geom.hipY);
  const spread = turned.ys > 0.1 ? 0 : 4;
  const rawForeFar = { x: foreHip.x + spread, y: foreHip.y };
  const rawHindFar = { x: hindHip.x + spread, y: hindHip.y };
  const foreNear = project(foreHip, 1);
  const hindNear = project(hindHip, 1);
  const foreFar = project(rawForeFar, -1);
  const hindFar = project(rawHindFar, -1);
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
  const drawOne = (raw: Pt, hip: Pt, fore: boolean, leg: 0 | 1 | 2 | 3, near: boolean, side: number, kicker = false) =>
    drawLeg(c, hip, project(footAt(raw, fore, leg, near, kicker), side), geom, fore ? foreSide : -1, near ? legColor : farColor, boot, !near, sockColor, geom.gray.chest);
  const fadeFar = pose.side > 0.02;
  const withFar = (draw: () => { x: number; y: number; shin: number }) => {
    if (!fadeFar) {
      return draw();
    }
    c.save();
    const layer = Skia.Paint();
    layer.setAlphaf(Math.max(0, 1 - pose.side));
    c.saveLayer(layer);
    const paw = draw();
    c.restore();
    c.restore();
    return paw;
  };
  const hindFarPaw = () => withFar(() => drawOne(rawHindFar, hindFar, false, 0, false, -1));
  const foreFarPaw = () => withFar(() => drawOne(rawForeFar, foreFar, true, 1, false, -1));
  const hindNearPaw = () => drawOne(hindHip, hindNear, false, 2, true, 1, true);
  const foreNearPaw = () => drawOne(foreHip, foreNear, true, 3, true, 1);
  let paws: { x: number; y: number; shin: number }[];
  if (turned.ys <= 0.5) {
    const hindFarDrawn = hindFarPaw();
    const foreFarDrawn = foreFarPaw();
    paws = [hindFarDrawn, foreFarDrawn];
  } else {
    paws = [hindFarPaw(), hindNearPaw()];
  }

  // torso: tail, body, markings, ribs, coat
  c.save();
  c.translate(0, dy);
  c.translate(geom.Px, geom.Py);
  c.rotate(deg(theta), 0, 0);
  c.translate(-geom.Px, -geom.Py);
  if (turned.ys > 0.02) {
    for (const k of [-0.3, 0, 0.3]) {
      const end = k === 0 ? 1 : 0.9;
      fillOval(
        c,
        k * geom.bodyLen * turned.yc,
        geom.bodyY,
        geom.bodyH * 0.56 * turned.ys * end,
        (geom.bodyH / 2) * (k === 0 ? 1 : 0.92),
        baseColor,
      );
    }
    if (turned.ys > 0.05) {
      const bib = points ? (breed.accent ?? muzzleColorOf(breed, markings)) : mix(baseColor, '#ffffff', 0.18);
      fillOval(c, 0.3 * geom.bodyLen * turned.yc, geom.bodyY + geom.bodyH * 0.12, geom.bodyH * 0.28 * turned.ys, geom.bodyH * 0.22, bib, turned.ys);
    }
  }
  c.save();
  c.translate(geom.Px, geom.Py);
    c.scale(Math.max(turned.yc, 0.001), 1);
  c.translate(-geom.Px, -geom.Py);
  drawTail(c, breed, geom, wag, tailColor, pose.tailLift - 0.45 * pose.stream, tailDeco);
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
    c.drawPath(stripes, paintOf(mix(baseColor, '#000000', 0.5), 0.55 * turned.yc, 4));
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
    c.drawPath(ribs, paintOf('#000000', ((-actor.displayWeight - 0.35) / 0.65) * 0.38 * turned.yc, 1.4));
  }
  if (coat) {
    drawCoat(c, geom, coat, breath);
  }
  c.restore();
  c.restore();

  if (turned.ys <= 0.5) {
    paws.push(hindNearPaw(), foreNearPaw());
  } else {
    paws.push(foreFarPaw(), foreNearPaw());
  }
  actor.anchors.paws = paws;
  c.restore();

  // neck, bandana, collar
  const shift = headShift(geom, frame.head.y, pose);
  const head = { x: (frame.head.x + shift.x) * turned.yc, y: frame.head.y + shift.y + pose.headPush * geom.headR * 0.15 };
  const pitch = (frame.pitch + pose.headRot - 0.9 * pose.headUp + Math.sin(t * 9) * 0.12 * pose.rubSway) * (1 - 0.7 * turned.ys);
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
    pose.jawHold,
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
  const earSwing = Math.sin(actor.phase * 2) * 0.08 * pose.walk - barkOpen * 0.15 + earBackNow;
  const nearEar = (): void =>
    drawEar(c, breed, geom, nearPaint, { far: false, shift: face.nearEarShift, angle: 0.25 + earSwing, earBack: earBackNow, alpha: 1 });
  const farEar = (): void =>
    drawEar(c, breed, geom, farPaint, {
      far: true,
      shift: face.farEarShift,
      angle: -0.25 + earBackNow,
      earBack: earBackNow,
      alpha: profile.stiff ? 1 : face.farEarAlpha,
    });
  c.save();
  // At the bowl the head dips and lifts with each bite or lap.
  c.translate(head.x, head.y + pose.headDown * Math.sin(actor.chewPh) * 1.8);
  c.rotate(deg(pitch), 0, 0);
  if (pose.headPush > 0.001) {
    c.scale(1 + 0.3 * pose.headPush, 1 + 0.3 * pose.headPush);
  }
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
    c.scale(face.farEyeScale.x * (cat ? 1 + 1.2 * pose.pupils : 1), face.farEyeScale.y);
    drawEye(c, 0, 0, eyeR, eyeClosed, breed, cf);
    c.restore();
    if (fa < 0.999) {
      c.restore();
    }
    c.restore();
  }
  c.save();
  c.translate(ex, ey);
  if (cat && pose.pupils > 0.001) {
    c.scale(1 + 1.2 * pose.pupils, 1);
  }
  drawEye(c, 0, 0, eyeR, eyeClosed, breed, cf);
  c.restore();
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

  if (carrying !== null) {
    const cs = Math.cos(pitch);
    const sn = Math.sin(pitch);
    const mouthX = head.x + geom.tipX * cs - geom.tipY * sn;
    const mouthY = head.y + geom.tipX * sn + geom.tipY * cs;
    drawToyShape(c, carrying, mouthX - 4, mouthY + 1, 8);
  }
  for (const heart of actor.hearts) {
    const k = 1 - heart.t / heart.life;
    fillCircle(c, heart.x, heart.y - heart.t * 28, 4 + 2 * k, '#ff6b8a', 0.85 * k);
  }
  c.restore();

  if (silhouette) {
    c.restore();
  }

  // sleep marks float up from the head in screen space, so they never mirror
  const sleepy = pose.lie * pose.eyes;
  if (sleepy >= 0.5) {
    const hx = actor.x + turned.dir * scale * head.x;
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
