import { BlendMode, Skia, StrokeCap } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import { blendedFoot, bodyFrame, isDarkCoat, solveKnee, wearItem } from '../../actor';
import type { Actor, Breed, Geom } from '../../actor';
import { blendedTheta, facingFit, projectLocal } from '../../actor/facing';
import { facingConfig } from '../../actor/data/facing';
import { carriedMouth, headFaceOf, headShift, noseOf, torsoPoint } from '../../actor/geometry';
import { liftScaleOf } from '../../actor/locomotion';
import { jumpConfig } from '../../actor/jump';
import { frostColorOf } from '../../actor/color';
import { baseColorOf, markingOf, resolveMarkings } from '../../actor/markings';
import { earProfiles } from '../../actor/data/breedShapes';
import { cuddleDefaults } from '../../actor/data/cuddle';
import { petStyle } from '../../actor/data/petStyle';
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
import {
  chinAnchor,
  collarJawOf,
  drawBoot,
  drawGlassesBack,
  drawGlassesFront,
  drawHat,
  drawChestDetails,
  drawHood,
  drawJacket,
  drawJacketCollar,
  drawNeckwear,
  drawSleeve,
  neckAxis,
  neckwearUnderHead,
} from './cosmetics';
import { bellyAxisScale, bellyRollOf } from './bellyRoll';
import { coatWeights } from './coatFade';
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
import { jacketHasSleeves, type WearItem } from '../../actor/wardrobe';
import { frostOval } from './frost';
import { drawToyShape } from './scenery';
import { cachedLayout, viewDefs, viewRig } from './views';
import { cosmeticAnchor } from './cosmeticAnchors';
import { shadeOval } from './shade';

// A layer paint that draws a tinted, dilated copy of the layer behind it: one outline for the whole pet.
// The radius is in the pet's local units, so it stays the same thickness relative to the pet when the
// stage is zoomed (wardrobe tiles, playdate camera).
function outlineLayerPaint(baseColor: string) {
  const { width, ink, inkMix } = petStyle.outline;
  const color = Skia.Color(mix(baseColor, ink, inkMix));
  const grown = Skia.ImageFilter.MakeDilate(width, width, null);
  const tinted = Skia.ImageFilter.MakeColorFilter(Skia.ColorFilter.MakeBlend(color, BlendMode.SrcIn), grown);
  const paint = Skia.Paint();
  // `null` in the merge list is the layer itself, drawn on top of the outline.
  paint.setImageFilter(Skia.ImageFilter.MakeMerge([tinted, null]));
  return paint;
}

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
  sleeve: WearItem | null = null,
  fur = '#888888',
  tilt = 0,
  widthScale = 1,
  pawScale = 1,
): Paw {
  const bone = geom.L / 2;
  const knee = solveKnee(hip, target, bone, side);
  const ex = target.x - knee.x;
  const ey = target.y - knee.y;
  const length = Math.hypot(ex, ey) || 1;
  const paw = { x: knee.x + (ex / length) * bone, y: knee.y + (ey / length) * bone };
  const leg = Skia.PathBuilder.Make();
  leg.moveTo(hip.x, hip.y);
  leg.lineTo(knee.x, knee.y);
  leg.lineTo(paw.x, paw.y);
  c.drawPath(leg.build(), paintOf(color, 1, geom.legWidth * widthScale));
  if (petStyle.shade.enabled) {
    const s = petStyle.shade;
    const back = -geom.legWidth * s.legOffset;
    const stripe = Skia.PathBuilder.Make();
    stripe.moveTo(hip.x + back, hip.y);
    stripe.lineTo(knee.x + back, knee.y);
    stripe.lineTo(paw.x + back, paw.y);
    c.drawPath(stripe.build(), paintOf('#000000', s.legAlpha, geom.legWidth * s.legStripe));
  }
  // A boot foot replaces the paw oval, which would poke out once the boot tilts with the shin.
  if (!boot) {
    fillOval(c, paw.x + 3, paw.y - 3, geom.pawRx * pawScale, geom.pawRy * pawScale, color);
  }
  if (sock) {
    // Socks or tan lower legs: the lower half of the leg and the paw in the marking color.
    const sockColor = far ? mix(sock, '#000000', 0.32) : sock;
    strokeLine(c, knee.x + (paw.x - knee.x) * 0.45, knee.y + (paw.y - knee.y) * 0.45, paw.x, paw.y, sockColor, geom.legWidth);
    if (!boot) {
      fillOval(c, paw.x + 3, paw.y - 3, geom.pawRx * pawScale, geom.pawRy * pawScale, sockColor);
    }
  }
  if (frost > 0.01) {
    // Senior frosting on the paw and the lower leg, over the sock color when there is one.
    const frostColor = frostColorOf(sock ? (far ? mix(sock, '#000000', 0.32) : sock) : color);
    if (!boot) {
      frostOval(c, paw.x + 3, paw.y - 3, geom.pawRx * 1.05, geom.pawRy * 1.1, frostColor, frost);
    }
    for (const f of [0.5, 0.75]) {
      frostOval(c, knee.x + (paw.x - knee.x) * f, knee.y + (paw.y - knee.y) * f, geom.legWidth * 0.8, geom.legWidth * 0.8, frostColor, frost * 0.85);
    }
  }
  if (!boot) {
    shadeOval(c, paw.x + 3, paw.y - 3, geom.pawRx * pawScale, geom.pawRy * pawScale);
  }
  if (sleeve) {
    drawSleeve(c, hip, knee, geom, sleeve, far, fur);
  }
  if (boot) {
    drawBoot(c, knee, paw, geom, boot, far, fur, tilt);
  }
  return { x: paw.x, y: paw.y, shin: Math.atan2(paw.y - knee.y, paw.x - knee.x), knee };
}

// Rotates a head-space mouth point by the head pitch into actor space.
export function toyMouthLocal(head: { x: number; y: number }, pitch: number, tipX: number, tipY: number): { x: number; y: number } {
  const cs = Math.cos(pitch);
  const sn = Math.sin(pitch);
  return {
    x: head.x + tipX * cs - tipY * sn,
    y: head.y + tipX * sn + tipY * cs,
  };
}

export function toyMouthStage(
  actor: { x: number; y: number; z: number; pose: { closeUp: number } },
  local: { x: number; y: number },
  facing: number,
  scale: number,
): { x: number; y: number } {
  return {
    x: actor.x + facing * scale * local.x,
    y: actor.y + 18 * actor.pose.closeUp - actor.z + scale * local.y,
  };
}

export function drawActor(
  c: SkCanvas,
  actor: Actor,
  breed: Breed,
  floor: { yMin: number; yMax: number },
  t: number,
  carrying: string | null,
  silhouette = false,
  reduced = false,
): void {
  const posed = actor.jump && actor.jump.phase !== 'turn' ? actor.jump.visual : null;
  if (actor.jump) {
    for (const puff of actor.jump.dust) {
      const k = 1 - puff.t / Math.max(puff.life, 0.01);
      fillCircle(c, puff.x, puff.y, puff.r * (1 + (1 - k) * 1.6), '#d8d0c6', 0.4 * k);
    }
  }
  const rig = viewRig(actor.octantFrom, actor.octant, actor.octantBlend, actor.face);
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
    rig.dir,
    floor,
    actor.speed,
    actor.gait,
    actor.share,
    facingFit(actor.octantFrom, actor.octant, actor.octantBlend),
  );
  const geom = frame.geom;
  const pose = actor.pose;
  const layoutKey = [
    breed.id,
    breed.coat,
    geom.bodyLen.toFixed(2),
    geom.bodyH.toFixed(2),
    geom.headR.toFixed(2),
    geom.snout.toFixed(2),
    rig.view,
    actor.equipped.hat ?? '',
    actor.equipped.glasses ?? '',
    actor.equipped.neckwear ?? '',
    actor.equipped.jacket ?? '',
    actor.equipped.boots ?? '',
  ].join('|');
  const layout = cachedLayout(layoutKey, () => {
    const canonical = viewDefs[rig.view];
    return {
      bodyRx: geom.bodyLen / 2,
      bodyRy: geom.bodyH / 2,
      head: headFaceOf(breed, geom, canonical.headTurn, canonical.headFront),
    };
  });
  const scale = frame.scale * (1 + 0.35 * pose.closeUp);
  const cat = breed.species === 'cat';
  let theta = frame.theta - 0.35 * pose.rearUp + Math.sin(t * 9 + 1) * 0.03 * pose.rubSway;
  let dy = frame.dy + geom.dLie * pose.side;
  if (posed) {
    theta += posed.pitch;
    dy += posed.dy;
  }
  const barkOpen = actor.bark.open;
  // Streaming back at a gallop pulls the ears flat and stretches the tail out behind the body.
  const earBackNow = pose.earBack + 0.35 * pose.stream + (posed?.ear ?? 0);
  const wag = Math.sin(actor.wagPh) * pose.wagAmp * (1 - 0.7 * pose.stream);
  let eyeClosed = Math.max(pose.eyes, pose.squint, actor.blinkT < 0.12 ? 1 : 0);
  if (barkOpen > 0.05) {
    eyeClosed = 0;
  }
  const boot = wearItem('boots', actor.equipped.boots);
  const jacket = wearItem('jacket', actor.equipped.jacket);
  const neckwear = wearItem('neckwear', actor.equipped.neckwear);
  const glasses = wearItem('glasses', actor.equipped.glasses);
  const hat = wearItem('hat', actor.equipped.hat);
  const jacketAnchor = jacket ? cosmeticAnchor('jacket', jacket.id, rig.view) : null;
  const bootAnchor = boot ? cosmeticAnchor('boots', boot.id, rig.view) : null;
  const coats = coatWeights(actor.octantFrom, actor.octant, actor.octantBlend);
  const sleeve = jacket && jacketAnchor && jacketHasSleeves(jacket) ? jacket : null;
  const bootOn = bootAnchor ? boot : null;
  const points = breed.pattern === 'points';
  // Breed marking regions, resolved against the coat. Locked regions ignore the user palette.
  const markings = resolveMarkings(breed);
  const baseColor = baseColorOf(breed);
  const legColor = markingOf(markings, 'legs')?.color ?? (points ? breed.accent ?? baseColor : baseColor);
  const tailColor = markingOf(markings, 'tail')?.color ?? legColor;
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
  c.scale((actor.debugTheta == null ? rig.dir : 1) * scale, scale);
  // Cuddle: the torso leans with the finger, and a shake-off wobbles the whole body about its feet.
  c.translate(pose.torsoShift, 0);
  if (pose.shake > 0.01) {
    c.rotate(deg(Math.sin(t * 42) * 0.07 * pose.shake), 0, 0);
    c.translate(Math.sin(t * 37) * 2.2 * pose.shake, 0);
  }
  // The shadow stays on the ground. A jump shrinks it to 60% and fades it to half at the apex.
  const jumpRise =
    actor.jump && (actor.jump.phase === 'airborne' || actor.jump.phase === 'bounce')
      ? clamp(actor.z / Math.max(actor.jump.apex, 1), 0, 1)
      : 0;
  const shadowK = actor.jump ? 1 : clamp(1 - actor.z / 150, 0.45, 1);
  const shadowSize = actor.jump ? 1 - (1 - jumpConfig.shadow.size) * jumpRise : shadowK;
  const shadowFade = actor.jump ? 1 - (1 - jumpConfig.shadow.opacity) * jumpRise : shadowK;
  fillOval(
    c,
    (geom.bodyLen * 0.05 + 10 * pose.lie) * rig.foreshorten,
    2,
    geom.bodyLen * (0.52 + 0.08 * pose.lie) * shadowSize * rig.shadowRx,
    7 * shadowSize * rig.shadowRy,
    '#000000',
    0.13 * shadowFade,
  );
  c.translate(0, -actor.z / scale);
  const thetaFacing = actor.debugTheta ?? blendedTheta(actor.octantFrom, actor.octant, actor.octantBlend, rig.dir);
  if (pose.walk > 0.05) {
    const frontness = Math.abs(Math.sin(thetaFacing));
    c.translate(Math.sin(actor.phase) * geom.bodyH * 0.06 * frontness * pose.walk, 0);
  }

  const outlined = petStyle.outline.enabled && !silhouette;
  if (outlined) {
    c.saveLayer(outlineLayerPaint(baseColor));
  }

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
    if (posed && posed.blend > 0.001) {
      const spec = fore ? posed.fore : posed.hind;
      const jx = hip.x + spec.x * geom.L;
      const jy = spec.plant ? 0 : hip.y + spec.y * geom.L;
      x = x * (1 - posed.blend) + jx * posed.blend;
      y = y * (1 - posed.blend) + jy * posed.blend;
    }
    return { x, y };
  };

  const half = geom.bodyH * 0.3;
  const liftScale = liftScaleOf(actor.displayAgeDays);
  const foreSide = pose.lie > 0.5 ? -1 : 1;
  const depthSpan = Math.max(geom.bodyLen, 1);

  // Roll-over spins the torso about its spine. The cosine scale lets the legs and tail
  // pass through. The body is drawn back out to its cross-section so the edge-on frame
  // keeps the girth instead of collapsing into a line. The head stays upright.
  const roll = bellyRollOf(pose.belly);
  const bellyScale = bellyAxisScale(roll);
  const bodyCenterY = geom.bodyY + dy;
  // `body` keeps underside shading on the ground side. `detail` is the side-view
  // surface (belly, markings, coat): it flips with the roll and fades out while edge-on.
  const paintRolled = (centerY: number, mode: 'body' | 'detail', paint: () => void): void => {
    if (pose.belly <= 0.001) {
      paint();
      return;
    }
    if (mode === 'detail' && roll.detail <= 0.001) {
      return;
    }
    const boost = mode === 'body' ? roll.sil / bellyScale : roll.sil / Math.abs(bellyScale);
    c.save();
    c.translate(0, centerY);
    c.scale(1, boost);
    c.translate(0, -centerY);
    const fadeDetail = mode === 'detail' && roll.detail < 0.999;
    if (fadeDetail) {
      const fade = Skia.Paint();
      fade.setAlphaf(roll.detail);
      c.saveLayer(fade);
    }
    paint();
    if (fadeDetail) {
      c.restore();
    }
    c.restore();
  };
  c.save();
  if (posed && posed.hip !== 0) {
    c.translate(posed.hip, 0);
  }
  if (pose.belly > 0.001) {
    c.translate(0, bodyCenterY);
    c.scale(1, bellyScale);
    c.translate(0, -bodyCenterY);
  }
  const footTilt = (fore: boolean): number => {
    const spec = posed ? (fore ? posed.fore : posed.hind) : null;
    const jump = posed && spec && !spec.plant ? posed.blend : 0;
    return Math.max(fore ? 0 : pose.sit, pose.lie, pose.belly, pose.side, pose.tuck, jump);
  };
  const specs: { localX: number; localY: number; fore: boolean; leg: 0 | 1 | 2 | 3; l: number; kick: boolean }[] = [
    { localX: geom.hindX, localY: geom.hipY, fore: false, leg: 0, l: -half, kick: false },
    { localX: geom.foreX, localY: geom.hipY, fore: true, leg: 1, l: -half, kick: false },
    { localX: geom.hindX, localY: geom.hipY, fore: false, leg: 2, l: half, kick: true },
    { localX: geom.foreX, localY: geom.hipY, fore: true, leg: 3, l: half, kick: false },
  ];
  const planned = specs.map((spec) => {
    const hip = torsoPoint(geom, theta, dy, spec.localX, spec.localY);
    const foot = footAt(hip, spec.fore, spec.leg, spec.l > 0, spec.kick);
    const df = foot.x - hip.x;
    const lift = foot.y < 0 ? -foot.y * liftScale : 0;
    // Hips collapse toward the body center with the facing angle. A front view keeps the
    // hind pair under the rump, a small step behind the chest, instead of out at the tail.
    const axialView = rig.view === 'front' || rig.view === 'back';
    const fs = axialView ? 1 : rig.foreshorten;
    const cos = Math.cos(thetaFacing);
    const sin = Math.sin(thetaFacing);
    const visualCenter = axialView ? 0 : geom.Px * (1 - fs);
    const hipLocalX = visualCenter + spec.localX * fs * cos + spec.l * sin;
    const hipLocalY = spec.localY - (spec.fore ? 0 : Math.abs(sin) * geom.bodyH * 0.1);
    const hipP = torsoPoint(geom, theta, dy, hipLocalX, hipLocalY);
    const stepped = projectLocal({ f: df, l: 0, h: lift }, thetaFacing);
    const origin = projectLocal({ f: 0, l: 0, h: 0 }, thetaFacing);
    const footP = { x: hipP.x + stepped.x - origin.x, y: stepped.y - origin.y };
    const depth = projectLocal({ f: spec.localX, l: spec.l, h: 0 }, thetaFacing).depth;
    return { ...spec, hipP, footP, depth };
  });
  planned.sort((a, b) => a.depth - b.depth);
  const bodyDepth = projectLocal({ f: 0, l: 0, h: 0 }, thetaFacing).depth;
  const paintLeg = (spec: (typeof planned)[number], rolled = false): { x: number; y: number; shin: number } => {
    const near = spec.depth >= bodyDepth;
    const norm = clamp(spec.depth / depthSpan, -1, 1);
    const stroke = (hip: Pt, foot: Pt) =>
      drawLeg(
        c,
        hip,
        foot,
        geom,
        spec.fore ? foreSide : -1,
        near ? legColor : mix(legColor, '#000000', 0.28),
        bootOn,
        !near,
        sockColor,
        geom.gray.chest,
        spec.fore ? sleeve : null,
        legColor,
        footTilt(spec.fore),
        near ? 1 : 1 - facingConfig.legNarrow,
        1 + facingConfig.pawDepth * norm,
      );
    // The back-view leg pass draws after the roll transform is restored.
    if (!rolled) {
      return stroke(spec.hipP, spec.footP);
    }
    // The roll scale would squash the stroke into a hairline. Draw the limb at its
    // rolled position with that scale undone, so the leg keeps its thickness.
    const projectY = (y: number) => bodyCenterY + (y - bodyCenterY) * bellyScale;
    c.save();
    c.translate(0, bodyCenterY);
    c.scale(1, 1 / bellyScale);
    c.translate(0, -bodyCenterY);
    const drawn = stroke(
      { x: spec.hipP.x, y: projectY(spec.hipP.y) },
      { x: spec.footP.x, y: projectY(spec.footP.y) },
    );
    c.restore();
    return {
      x: drawn.x,
      y: bodyCenterY + (drawn.y - bodyCenterY) / bellyScale,
      shin: drawn.shin,
    };
  };
  const behind = planned.filter((spec) => spec.depth < bodyDepth);
  const ahead = planned.filter((spec) => spec.depth >= bodyDepth);
  const drawnPaws: { x: number; y: number; shin: number }[] = [];
  for (const spec of behind) {
    drawnPaws.push(paintLeg(spec, pose.belly > 0.001));
  }

  // torso: tail, body, markings, ribs, coat
  c.save();
  c.translate(0, dy);
  c.translate(geom.Px, geom.Py);
  c.rotate(deg(theta), 0, 0);
  c.translate(-geom.Px, -geom.Py);
  if ((rig.chest > 0.08 && !(jacket && rig.view === 'front34')) || rig.rear > 0.35) {
    paintRolled(geom.bodyY, 'detail', () => {
      if (rig.chest > 0.08 && !(jacket && rig.view === 'front34')) {
        const bib = points ? (breed.accent ?? muzzleColorOf(breed, markings)) : mix(baseColor, '#ffffff', 0.18);
        fillOval(c, 0, geom.bodyY + geom.bodyH * 0.16, geom.bodyH * 0.34 * rig.chest, geom.bodyH * 0.28, bib, rig.chest);
        shadeOval(c, 0, geom.bodyY + geom.bodyH * 0.16, geom.bodyH * 0.34 * rig.chest, geom.bodyH * 0.28);
      }
      if (rig.rear > 0.35) {
        fillOval(
          c,
          0,
          geom.bodyY - geom.bodyH * 0.08,
          geom.bodyH * 0.42,
          geom.bodyH * 0.36,
          mix(baseColor, '#000000', 0.18),
          rig.rear * 0.55,
        );
      }
    });
  }
  c.save();
  c.translate(geom.Px, geom.Py);
  const axial = rig.view === 'front' || rig.view === 'back';
  if (!axial) {
    c.scale(Math.max(rig.foreshorten, 0.001), 1);
  }
  c.translate(-geom.Px, -geom.Py);
  const uprightTail = breed.tailType === 'sickleBushy' || breed.tailType === 'doubleCurl' || breed.tailType === 'plume' || breed.tailType === 'catBushy' || breed.tailType === 'catPlume';
  const paintTail = (): void => {
    if (rig.view === 'back') {
      const tx = -geom.bodyLen / 2 + 6;
      const ty = geom.bodyY - geom.bodyH * 0.1;
      c.save();
      c.translate(0, geom.bodyY - geom.bodyH * 0.42);
      c.rotate(90, 0, 0);
      c.translate(-tx, -ty);
      drawTail(c, breed, geom, wag, tailColor, pose.tailLift - 0.45 * pose.stream + (posed?.tail ?? 0), tailDeco);
      c.restore();
      return;
    }
    if (rig.view === 'front') {
      if (uprightTail) {
        fillCircle(c, 0, geom.bodyY - geom.bodyH * 0.72, geom.bodyH * 0.14, tailColor);
      }
      return;
    }
    drawTail(c, breed, geom, wag, tailColor, pose.tailLift - 0.45 * pose.stream + (posed?.tail ?? 0), tailDeco);
  };
  if (rig.tail === 'body' || rig.view === 'back') {
    paintTail();
  }
  const breath = 1 + pose.breathAmp * Math.sin(actor.breathPh);
  // Edge-on the flank turns toward the camera: a little darker, with a rounder shade.
  const rolledCoat = roll.bulk > 0.001 ? mix(baseColor, '#000000', 0.14 * roll.bulk) : baseColor;
  const form = 1 + roll.bulk;
  c.save();
  c.translate(0, geom.bodyY);
  c.scale(posed?.scaleX ?? 1, posed?.scaleY ?? 1);
  c.translate(0, -geom.bodyY);
  paintRolled(geom.bodyY, 'body', () => {
    if (rig.view === 'front') {
      const chestW = geom.bodyH * 1.1;
      const chestH = geom.bodyH;
      fillOval(c, 0, geom.bodyY + chestH * 0.08, chestW / 2, chestH / 2, rolledCoat);
      shadeOval(c, 0, geom.bodyY + chestH * 0.08, chestW / 2, chestH / 2, form);
    } else if (rig.view === 'back') {
      fillOval(c, 0, geom.bodyY, geom.bodyH * 0.52, geom.bodyH * 0.48, mix(rolledCoat, '#000000', 0.12));
      shadeOval(c, 0, geom.bodyY, geom.bodyH * 0.52, geom.bodyH * 0.48, form);
    } else {
      fillOval(c, 0, geom.bodyY, layout.bodyRx, layout.bodyRy * breath, rolledCoat);
    }
  });
  paintRolled(geom.bodyY, 'detail', () => {
    if (!axial) {
      fillOval(
        c,
        4,
        geom.bodyY + geom.bodyH * 0.22,
        geom.bodyLen * 0.38,
        geom.bodyH * 0.22 * breath,
        mix(baseColor, '#ffffff', 0.18),
      );
    }
    if (!axial && breed.pattern === 'stripes' && !tabby) {
      c.save();
      clipOval(c, 0, geom.bodyY, geom.bodyLen / 2, (geom.bodyH / 2) * breath);
      const stripes = Skia.PathBuilder.Make();
      for (let i = 0; i < 6; i += 1) {
        const sx = -geom.bodyLen * 0.34 + i * geom.bodyLen * 0.14;
        stripes.moveTo(sx, geom.bodyY - geom.bodyH * 0.5);
        stripes.quadTo(sx + 6, geom.bodyY - geom.bodyH * 0.1, sx + 2, geom.bodyY + geom.bodyH * 0.12);
      }
      c.drawPath(stripes.build(), paintOf(mix(baseColor, '#000000', 0.5), 0.55 * rig.foreshorten, 4));
      c.restore();
    }
    const markingView = rig.rear > 0.5 ? 'back' : rig.view === 'front' ? 'front' : 'side';
    drawBodyMarkings(c, geom, markings, breath, bodyDeco, markingView);
    if (geom.gray.chest > 0.01 && rig.view !== 'back') {
      // Senior frosting on the chest, over a locked white bib or the coat.
      frostOval(
        c,
        axial ? 0 : geom.bodyLen * 0.37,
        geom.bodyY + geom.bodyH * 0.2,
        axial ? geom.bodyH * 0.22 : geom.bodyLen * 0.13,
        geom.bodyH * 0.36,
        frostColorOf(markingOf(markings, 'chest')?.color ?? baseColor),
        geom.gray.chest,
      );
    }
    if (!axial && actor.displayWeight < -0.35) {
      const ribs = Skia.PathBuilder.Make();
      for (let r = 0; r < 4; r += 1) {
        const rx = geom.bodyLen * (0.06 + r * 0.07);
        ribs.moveTo(rx, geom.bodyY - geom.bodyH * 0.02);
        ribs.quadTo(rx + 4, geom.bodyY + geom.bodyH * 0.12, rx + 1, geom.bodyY + geom.bodyH * 0.3);
      }
      c.drawPath(ribs.build(), paintOf('#000000', ((-actor.displayWeight - 0.35) / 0.65) * 0.38 * rig.foreshorten, 1.4));
    }
    if (jacket && jacketAnchor && coats.side > 0.01) {
      const placed = { sit: pose.sit, theta, dy, foreshorten: rig.foreshorten, belly: pose.belly };
      c.save();
      c.translate(jacketAnchor.x * geom.bodyLen, jacketAnchor.y * geom.bodyH);
      drawJacket(c, geom, jacket, breath, baseColor, { ...placed, pass: 'side', alpha: coats.side });
      c.restore();
    }
    if (jacket && coats.front > 0.01) {
      c.save();
      if (!axial) {
        c.translate(geom.Px, geom.Py);
        c.scale(1 / Math.max(rig.foreshorten, 0.001), 1);
        c.translate(-geom.Px, -geom.Py);
      }
      drawJacket(c, geom, jacket, breath, baseColor, {
        pass: 'front',
        sit: pose.sit,
        theta,
        dy,
        foreshorten: 1,
        belly: pose.belly,
        alpha: coats.front,
      });
      c.restore();
    }
  });
  if (!axial) {
    paintRolled(geom.bodyY, 'body', () => {
      shadeOval(c, 0, geom.bodyY, geom.bodyLen / 2, (geom.bodyH / 2) * breath, form);
    });
  }
  if (rig.tail === 'over') {
    paintTail();
  }
  c.restore();
  c.restore();
  c.restore();

  if (!coats.legsInBackPass) {
    for (const spec of ahead) {
      drawnPaws.push(paintLeg(spec, pose.belly > 0.001));
    }
    if (jacket && coats.side + coats.front > 0.01) {
      drawChestDetails(c, geom, jacket, baseColor, theta, dy, actor.swing, rig.dir, pose.belly, coats.side + coats.front);
    }
  }
  actor.anchors.paws = drawnPaws.map((paw) => ({ x: paw.x, y: paw.y, shin: paw.shin }));
  c.restore();

  // neck, bandana, collar
  const shift = headShift(geom, frame.head.y, pose);
  let headX = frame.head.x;
  let headY = frame.head.y;
  if (posed && (posed.pitch !== 0 || posed.dy !== 0)) {
    const rx = headX - geom.Px;
    const ry = headY - geom.Py - frame.dy;
    const cs = Math.cos(posed.pitch);
    const sn = Math.sin(posed.pitch);
    headX = geom.Px + rx * cs - ry * sn;
    headY = geom.Py + frame.dy + rx * sn + ry * cs + posed.dy;
  }
  const head = {
    x: headX + shift.x,
    y: headY + shift.y + pose.headPush * geom.headR * 0.15,
  };
  const pitch =
    (frame.pitch + pose.headRot - 0.9 * pose.headUp + Math.sin(t * 9) * 0.12 * pose.rubSway + (posed?.head ?? 0)) *
    (1 - 0.7 * Math.max(rig.headFront, rig.rear));
  // Side view joins the neck at the front of the chest. Front and back replace that
  // body with a centered oval, so the same shoulder sits out to the side. A thick
  // stroke from there flares past the oval and reads as a wide body.
  const axialK = Math.max(rig.chest, rig.rear);
  const neckX = geom.bodyLen / 2 - 14;
  const scaledNeckX = geom.Px + (neckX - geom.Px) * rig.foreshorten;
  const neckLocalX = scaledNeckX + (0 - scaledNeckX) * axialK;
  const neckWidth = geom.headR * (1.35 - 0.62 * axialK);
  const base = torsoPoint(geom, theta, dy, neckLocalX, geom.bodyY - 2);
  if (pose.belly > 0.001) {
    base.y = bodyCenterY + (base.y - bodyCenterY) * bellyScale;
  }
  strokeLine(c, base.x, base.y, head.x - 2, head.y + 3, baseColor, neckWidth);
  const nx = head.x - 2 - base.x;
  const ny = head.y + 3 - base.y;
  const along = neckAxis(head, base, geom.headR);
  // perpendicular to the neck, always pointing down the screen
  const perp = along.x >= 0 ? { x: -along.y, y: along.x } : { x: along.y, y: -along.x };
  const neck = { x: base.x + nx * 0.62, y: base.y + ny * 0.62 };
  actor.anchors.neck = neck;
  if (jacket?.shape === 'hoodie' && jacketAnchor && coats.side > 0.01 && pose.belly < 0.45) {
    drawHood(c, base, perp, along, jacket, geom.headR, neckWidth, baseColor, coats.side);
  }
  if (jacket && jacketAnchor && coats.back < 0.999) {
    const collarAlpha = 1 - coats.back;
    if (collarAlpha < 0.999) {
      const fade = Skia.Paint();
      fade.setAlphaf(collarAlpha);
      c.saveLayer(fade);
    }
    drawJacketCollar(c, base, perp, along, jacket, geom.headR, neckWidth, baseColor);
    if (collarAlpha < 0.999) {
      c.restore();
    }
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
  const onSide = rig.view === 'side';
  const turn = clamp(Math.max(rig.headTurn, onSide ? Math.max(pose.headTurn, pose.faceCam) : 0), 0, 1);
  const front = clamp(Math.max(rig.headFront, onSide || rig.view === 'front' || rig.view === 'front34' ? pose.faceFront : 0), 0, 1);
  const face =
    actor.octantBlend >= 1 && turn === viewDefs[rig.view].headTurn && front === viewDefs[rig.view].headFront
      ? layout.head
      : headFaceOf(breed, geom, turn, pose.faceFront > front ? pose.faceFront : front);
  const rawMouth = carriedMouth(breed, geom, face, rig.rear, pose.snoutScale);
  const sideTuck = (1 - Math.max(face.turn, face.front)) * (rig.rear <= 0 ? 1 : Math.max(0, 1 - rig.rear / 0.55));
  const mouthLocal = { x: rawMouth.x - 4 * sideTuck, y: rawMouth.y + sideTuck };
  const mouth = toyMouthLocal(head, pitch, mouthLocal.x, mouthLocal.y);
  actor.mouthMark = toyMouthStage(actor, mouth, rig.dir, scale);
  const drawCarry = (): void => {
    if (carrying !== null) {
      drawToyShape(c, carrying, mouthLocal.x, mouthLocal.y, 8);
    }
  };
  const view = Math.max(face.turn, face.front);
  // Side view paints neckwear after the head so a turned face does not hide it.
  // Front and 3/4 paint it first, so the face covers the part that crosses the muzzle.
  const neckAnchor = neckwear ? cosmeticAnchor('neckwear', neckwear.id, rig.view) : null;
  const faceCoversNeck = rig.view === 'front' || rig.view === 'front34';
  const underHead = Boolean(neckAnchor && neckAnchor.mode !== 'knot' && (neckwearUnderHead(along) || faceCoversNeck));
  const wearNeck = () => {
    if (!neckwear || !neckAnchor || neckAnchor.mode === 'knot') {
      return;
    }
    const chin = chinAnchor(head, base, R, pitch, cat, view, collarJawOf(face, R), pose.lie);
    const sway = Math.sin(t * 3) * 0.08 + Math.sin(t * 11) * clamp(actor.speed / 120, 0, 1) * 0.12;
    const chest = markingOf(markings, 'chest')?.color ?? baseColor;
    c.save();
    c.translate(neckAnchor.x * R, neckAnchor.y * R);
    drawNeckwear(c, chin, perp, along, neckwear, sway, R, chest, view, pitch, {
      sit: pose.sit,
      lie: pose.lie,
      belly: pose.belly,
      theta,
      swing: actor.swing,
      dir: rig.dir,
    });
    c.restore();
  };
  if (underHead) {
    wearNeck();
  } else if (neckAnchor?.mode === 'knot' && neckwear) {
    if (neckwear.shape === 'bowtie') {
      const band = R * 0.12;
      const path = Skia.PathBuilder.Make();
      path.addRRect(Skia.RRectXY(Skia.XYWHRect(neck.x + neckAnchor.x * R - R * 0.28, neck.y + neckAnchor.y * R - band / 2, R * 0.56, band), band, band));
      c.drawPath(path.build(), paintOf(neckwear.colorway.c));
    } else {
      fillCircle(c, neck.x + neckAnchor.x * R, neck.y + neckAnchor.y * R, R * 0.16, neckwear.colorway.c);
    }
  }
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
  const farPaint = { ...nearPaint, color: mix(earColor, '#000000', 0.2 * (1 - face.front)) };
  const muzzleColor = muzzleColorOf(breed, markings);
  const earSwing = Math.sin(actor.phase * 2) * 0.08 * pose.walk * (1 + rig.legAngle) * (actor.gait.current === 'gallop' ? 1.8 : 1) - barkOpen * 0.15 + earBackNow;
  // 3/4 keeps the side-view ears. As the face finishes turning toward the camera, those crossfade
  // into a mirrored pair drawn together in front of the head.
  const frontK = clamp((face.front - 0.55) / 0.45, 0, 1);
  const sideK = 1 - frontK;
  const nearEar = (alpha = 1): void =>
    drawEar(c, breed, geom, nearPaint, { far: false, shift: face.nearEarShift, angle: 0.25 + earSwing, earBack: earBackNow, alpha });
  const farEar = (alpha = 1): void =>
    drawEar(c, breed, geom, farPaint, {
      far: true,
      shift: face.farEarShift,
      angle: -0.25 + earBackNow,
      earBack: earBackNow,
      alpha: (profile.stiff ? 1 : face.farEarAlpha) * alpha,
      showInner: face.front > 0.55,
    });
  const frontEar = (far: boolean, alpha: number): void =>
    drawEar(c, breed, geom, nearPaint, {
      far,
      shift: { x: 0, y: 0 },
      angle: -0.2 + earSwing - earBackNow,
      earBack: earBackNow,
      alpha,
      front: true,
    });
  const withHead = (draw: () => void): void => {
    c.save();
    // At the bowl the head dips and lifts with each bite or lap.
    c.translate(head.x, head.y + pose.headDown * Math.sin(actor.chewPh) * 1.8);
    c.rotate(deg(pitch), 0, 0);
    if (pose.headPush > 0.001) {
      c.scale(1 + 0.3 * pose.headPush, 1 + 0.3 * pose.headPush);
    }
    draw();
    c.restore();
  };
  withHead(() => {
  if (rig.rear > 0.55) {
    if (cat) {
      fillOval(c, 0, 0, R * 1.06, R * 0.96, baseColor);
    } else {
      fillCircle(c, 0, 0, R, baseColor);
    }
    drawSkull(c, headCtx, baseColor, false);
    shadeOval(c, 0, 0, cat ? R * 1.06 : R, cat ? R * 0.96 : R);
    // Side-view shifts stack both ears on one cheek. From behind they are a mirrored pair,
    // and both are fully visible, including hanging ears whose far ear would otherwise fade out.
    const rearAngle = -0.18 + earSwing - earBackNow;
    const rearEar = (far: boolean): void =>
      drawEar(c, breed, geom, nearPaint, {
        far,
        shift: { x: 0, y: 0 },
        angle: rearAngle,
        earBack: earBackNow,
        alpha: 1,
        rear: true,
      });
    rearEar(true);
    rearEar(false);
    return;
  }
  // The far ear sits behind the head and slides to the far side as the head turns. Hanging far ears stay
  // partly hidden behind the head; erect ears show both. Full front replaces this pair below.
  if (sideK > 0.001 && !profile.overHead && (profile.stiff || face.farEarAlpha > 0.001)) {
    farEar(sideK);
  }
  drawRuff(c, headCtx, baseColor, lighter);
  if (cat) {
    fillOval(c, 0, 0, R * 1.06, R * 0.96, baseColor);
  } else {
    fillCircle(c, 0, 0, R, baseColor);
  }
  drawSkull(c, headCtx, baseColor);
  if (sideK > 0.001 && profile.overHead) {
    // Folded ears lie on the head, so the far one is drawn over the head circle too.
    farEar(sideK);
  }
  if (breed.pattern === 'stripes' && !tabby) {
    const marks = Skia.PathBuilder.Make();
    marks.moveTo(-R * 0.1, -R * 0.92);
    marks.lineTo(-R * 0.1, -R * 0.55);
    marks.moveTo(R * 0.15, -R * 0.88);
    marks.lineTo(R * 0.2, -R * 0.55);
    marks.moveTo(-R * 0.36, -R * 0.84);
    marks.lineTo(-R * 0.4, -R * 0.52);
    c.drawPath(marks.build(), paintOf(mix(baseColor, '#000000', 0.5), 0.6, 2.6));
  }
  drawHeadMarkingsBelow(c, headCtx);
  shadeOval(c, 0, 0, cat ? R * 1.06 : R, cat ? R * 0.96 : R);
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
  if (petStyle.shade.enabled) {
    c.save();
    clipOval(c, mx, my, mrx, mry);
    fillOval(c, mx, my + mry * 0.85, mrx * 1.2, mry * 0.6, '#000000', petStyle.shade.shadowAlpha * 0.6);
    c.restore();
  }
  if (geom.gray.muzzle > 0.01) {
    // Senior frosting on the muzzle and chin, over the muzzle's own color (a pug's mask or Siamese points too).
    const frostColor = frostColorOf(muzzleColor);
    frostOval(c, mx, my, mrx * 0.95, mry * 0.95, frostColor, geom.gray.muzzle);
    frostOval(c, mx, my + mry * 0.8, mrx * 0.7, mry * 0.4, frostColor, geom.gray.muzzle * 0.9);
  }
  if (cat) {
    fillOval(c, noseX, noseY, R * 0.11 * noseK, R * 0.08 * noseK, darkPoints ? '#8a6a5c' : '#e59aa6');
    if (jaw < 0.04 && turn < 0.99 && face.front < 0.99) {
      const mouth = Skia.PathBuilder.Make();
      mouth.moveTo(mx + mrx * 0.82, my - R * 0.02);
      mouth.lineTo(mx + mrx * 0.82, my + R * 0.1);
      mouth.moveTo(mx + mrx * 0.82, my + R * 0.1);
      mouth.quadTo(mx + mrx * 0.5, my + R * 0.2, mx + mrx * 0.15, my + R * 0.1);
      c.drawPath(mouth.build(), paintOf('#281919', 0.55 * (1 - turn) * (1 - face.front), 1.1));
    }
    const pale = points || isDarkCoat(baseColor);
    const whisker = pale ? '#ebebf0' : '#ffffff';
    const whiskerAlpha = pale ? 0.75 : 0.85;
    for (const dir of face.front > 0.02 ? [1, -1] : [1]) {
      const whiskers = Skia.PathBuilder.Make();
      for (let wk = -1; wk <= 1; wk += 1) {
        whiskers.moveTo(mx + dir * mrx * 0.3, my + R * 0.04 + wk * 0.03 * R);
        whiskers.lineTo(mx + dir * (mrx + R * 0.95), my + R * 0.02 + wk * R * 0.22);
      }
      c.drawPath(whiskers.build(), paintOf(whisker, dir < 0 ? whiskerAlpha * face.front : whiskerAlpha, 1.1));
    }
  } else {
    const noseTurn = Math.max(turn, face.front);
    fillOval(c, noseX, noseY, R * (0.17 + 0.03 * noseTurn) * noseK, R * (0.13 + 0.01 * noseTurn) * noseK, '#1b1512');
  }
  // Small centered "w" mouth under the nose at the 3/4 turn (dogs show it when the jaw is shut).
  if ((turn > 0.01 || face.front > 0.01) && jaw < 0.04) {
    const wy = noseY + mry * 0.45;
    const s = R * 0.13;
    const mouthW = Skia.PathBuilder.Make();
    mouthW.moveTo(noseX, noseY + R * 0.05);
    mouthW.lineTo(noseX, wy);
    mouthW.moveTo(noseX - s, wy - R * 0.02);
    mouthW.quadTo(noseX - s / 2, wy + R * 0.09, noseX, wy);
    mouthW.quadTo(noseX + s / 2, wy + R * 0.09, noseX + s, wy - R * 0.02);
    c.drawPath(mouthW.build(), paintOf('#281919', 0.6 * Math.max(turn, face.front), 1.1));
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
  });
  if (!underHead) {
    wearNeck();
  }
  withHead(() => {
    const hatAnchor = hat ? cosmeticAnchor('hat', hat.id, rig.view) : null;
    const glassAnchor = glasses ? cosmeticAnchor('glasses', glasses.id, rig.view) : null;
    if (rig.rear > 0.55) {
      if (glasses && glassAnchor && glassAnchor.mode !== 'full') {
        c.save();
        c.translate(glassAnchor.x * R, glassAnchor.y * R);
        drawGlassesBack(c, glasses, face, R, baseColor);
        c.restore();
      }
      if (hat && hatAnchor) {
        c.save();
        c.translate(hatAnchor.x * R, hatAnchor.y * R);
        drawHat(c, hat, R, face, baseColor, rig.view === 'back' ? 'back' : 'side', t, reduced);
        c.restore();
      }
      return;
    }
    if (glasses && glassAnchor) {
      c.save();
      c.translate(glassAnchor.x * R, glassAnchor.y * R);
      drawGlassesBack(c, glasses, face, R, baseColor);
      c.restore();
    }
    if (sideK > 0.001) {
      nearEar(sideK);
    }
    if (frontK > 0.001) {
      frontEar(true, frontK);
      frontEar(false, frontK);
    }
    if (glasses && glassAnchor?.mode === 'full') {
      c.save();
      c.translate(glassAnchor.x * R, glassAnchor.y * R);
      drawGlassesFront(c, glasses, face, R, baseColor, t, reduced);
      c.restore();
    }
    if (hat && hatAnchor) {
      c.save();
      c.translate(hatAnchor.x * R, hatAnchor.y * R);
      drawHat(c, hat, R, face, baseColor, rig.view === 'front' ? 'front' : 'side', t, reduced);
      const pokeHat = hat.shape === 'beanie' || hat.shape === 'cap' || hat.shape === 'bucket' || hat.shape === 'beret' || hat.shape === 'crown';
      if (pokeHat && profile.hatPoke) {
        c.save();
        clipRectAbove(c, -R * 0.55, R * 3);
        if (sideK > 0.001) {
          farEar(sideK);
          nearEar(sideK);
        }
        if (frontK > 0.001) {
          frontEar(true, frontK);
          frontEar(false, frontK);
        }
        c.restore();
      }
      c.restore();
    }
  });

  if (rig.view === 'back') {
    c.save();
    c.translate(0, dy);
    c.translate(geom.Px, geom.Py);
    c.rotate(deg(theta), 0, 0);
    c.translate(-geom.Px, -geom.Py);
    fillOval(c, 0, geom.bodyY, geom.bodyH * 0.52, geom.bodyH * 0.48, mix(baseColor, '#000000', 0.12));
    shadeOval(c, 0, geom.bodyY, geom.bodyH * 0.52, geom.bodyH * 0.48);
    c.restore();
  }
  if (jacket && coats.back > 0.01) {
    c.save();
    c.translate(0, dy);
    c.translate(geom.Px, geom.Py);
    c.rotate(deg(theta), 0, 0);
    c.translate(-geom.Px, -geom.Py);
    drawJacket(c, geom, jacket, breath, baseColor, {
      pass: 'back',
      sit: pose.sit,
      theta,
      dy,
      foreshorten: 1,
      belly: pose.belly,
      alpha: coats.back,
    });
    c.restore();
    if (pose.belly < 0.45) {
      if (coats.back < 0.999) {
        const fade = Skia.Paint();
        fade.setAlphaf(coats.back);
        c.saveLayer(fade);
      }
      drawJacketCollar(c, base, perp, along, jacket, geom.headR, neckWidth, baseColor);
      if (jacket.shape === 'hoodie') {
        drawHood(c, base, perp, along, jacket, geom.headR, neckWidth, baseColor);
      }
      if (coats.back < 0.999) {
        c.restore();
      }
    }
  }
  if (coats.legsInBackPass) {
    for (const spec of ahead) {
      const paw = paintLeg(spec);
      drawnPaws.push(paw);
    }
    actor.anchors.paws = drawnPaws.map((paw) => ({ x: paw.x, y: paw.y, shin: paw.shin }));
    if (jacket && coats.side + coats.front > 0.01) {
      drawChestDetails(c, geom, jacket, baseColor, theta, dy, actor.swing, rig.dir, pose.belly, coats.side + coats.front);
    }
  }

  if (rig.tail === 'top' && rig.view !== 'back') {
    c.save();
    c.translate(0, dy);
    c.translate(geom.Px, geom.Py);
    c.rotate(deg(theta), 0, 0);
    c.translate(-geom.Px, -geom.Py);
    c.translate(geom.Px, geom.Py);
    c.scale(Math.max(rig.foreshorten, 0.001), 1);
    c.translate(-geom.Px, -geom.Py);
    drawTail(c, breed, geom, wag, tailColor, pose.tailLift - 0.45 * pose.stream + (posed?.tail ?? 0), tailDeco);
    c.restore();
  }

  if (rig.rear <= 0.55) {
    withHead(drawCarry);
  }
  if (outlined) {
    c.restore();
  }
  for (const heart of actor.hearts) {
    const k = 1 - heart.t / heart.life;
    fillCircle(c, heart.x, heart.y - heart.t * 28, 4 + 2 * k, '#ff6b8a', 0.85 * k);
  }
  c.restore();

  if (silhouette) {
    c.restore();
  }

  // Head point in stage space, unflipped, so a mark can sit above the weather.
  actor.headMark = {
    x: actor.x + rig.dir * scale * head.x,
    y: actor.y - actor.z + scale * head.y,
  };

  // sleep marks float up from the head in screen space, so they never mirror
  const sleepy = pose.lie * pose.eyes;
  if (sleepy >= 0.5) {
    const hx = actor.x + rig.dir * scale * head.x;
    const hy = actor.y - actor.z + scale * head.y;
    for (let i = 0; i < 3; i += 1) {
      const k = (t * 0.5 + i / 3) % 1;
      const size = (10 + k * 8) * 0.55;
      const zx = hx + 10 + k * 18;
      const zy = hy - R * scale - 6 - k * 26;
      const mark = Skia.PathBuilder.Make();
      mark.moveTo(zx, zy - size);
      mark.lineTo(zx + size, zy - size);
      mark.lineTo(zx, zy);
      mark.lineTo(zx + size, zy);
      c.drawPath(mark.build(), paintOf('#5C6B80', (1 - k) * 0.9 * sleepy, 1.6, StrokeCap.Round));
    }
  }
}
