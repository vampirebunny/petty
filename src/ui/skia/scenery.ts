import { StrokeCap, Skia } from '@shopify/react-native-skia';
import type { SkCanvas, SkPicture } from '@shopify/react-native-skia';

import type { Scene, World } from '../../actor';
import { depthScale, stageHeight, stageWidth } from '../../actor/geometry';
import type { Prop } from '../../actor/scenes';
import { drawBackdropLayers } from './backdrop';
import { fillCircle, fillOval, oval, paintOf } from './draw';
import type { Env } from './env';
import { motionStep, snowOn, takeMotionRecord, weatherOf } from './env';
import { activeTintKey, glow } from './ink';
import { lampGlow } from './light';
import { extras, drawPropBody, petNear } from './props';
import { overcastWash } from './sky';
import { drawPrecip } from './weatherFx';
import { drawFeatherBundle, drawLaserPointer, laserTip } from './itemShapes';
// Registers the catio prop kinds.
import './catioProps';

// The public scenery API is unchanged; the work now lives in the files next to this one:
//   ink.ts        cached, tint-aware paints        sky.ts       sky, sun, moon phases, clouds, rainbow
//   props.ts      prop registry and drawings       catioProps   catio pieces and garden
//   outside.ts    the view through windows         nature.ts    seasonal trees, bushes, grass
//   light.ts      shadows, window light, rim       weatherFx    rain, snow, puddles, glass drops
//   decor.ts      seasonal decor                   backdrop.ts  cached static backdrop

export type { Contact, Env, Glow, LightRig } from './env';
export { drawSkyPane } from './sky';
export { drawShapes } from './shapes';
export { registerProp } from './props';
// Toy and treat art lives in itemShapes.ts; these keep the old import path working.
export { BOX_PER_RADIUS, drawBallShape, drawFeatherBundle, drawLaserPointer, drawToyShape, drawTreatShape, treatArt } from './itemShapes';
export type { ArtDetail, TreatArt } from './itemShapes';

// These sway, host a bird, or show the sky. One picture each, replaced on the motion step,
// so the time step is not part of the key (that would blow the cap and re-record every frame).
const LIVE_PROPS = new Set(['window', 'pond', 'goalPost', 'tree', 'bush', 'garden', 'catTree', 'planter', 'scratcher']);
const PROP_CAP = 24;
type PropSlot = { picture: SkPicture; step: number };
const propShots = new Map<string, PropSlot>();

function stillPropKey(prop: Prop, env: Env, lifted: boolean, squishing: boolean): string | null {
  if (lifted || squishing) {
    return null;
  }
  if (prop.kind === 'bowl' && env.feeding.some((bite) => bite.x === prop.x && bite.y === prop.y)) {
    return null;
  }
  if (prop.kind === 'litterbox') {
    const kick = petNear(env, prop, 0.8, 26);
    if (kick.near > 0.5 && kick.speed > 10 && !env.reduced) {
      return null;
    }
  }
  if (prop.kind === 'catioScreen' && weatherOf(env).precip === 'rain' && !env.reduced) {
    return null;
  }
  const occupied =
    prop.kind === 'bed' || prop.kind === 'hammock'
      ? Math.round(petNear(env, prop, prop.kind === 'bed' ? 0.7 : 0.8, 30).near * 4)
      : '';
  const light = env.light;
  const extra = extras(prop);
  return [
    prop.id ?? '',
    prop.kind,
    prop.x,
    prop.y,
    prop.w ?? '',
    prop.h ?? '',
    prop.color ?? '',
    prop.scale ?? '',
    prop.contents ?? '',
    prop.glow ? 1 : 0,
    prop.bedStyle ?? '',
    extra.flip ? 1 : 0,
    extra.foliage ?? '',
    String(extra.curtain ?? ''),
    extra.plant ?? '',
    prop.kind === 'shape' ? JSON.stringify(prop.shapes ?? []) : '',
    occupied,
    Math.round(env.bowlFill * 20),
    Math.round(env.waterLevel * 20),
    Math.round(snowOn(env) * 10),
    Math.round(weatherOf(env).wetness * 10),
    Math.round(env.tod.dark * 20),
    Math.round((light?.length ?? 0) * 4),
    Math.round((light?.direct ?? 0) * 4),
    Math.round((light?.contact ?? 0) * 20),
    light?.key ? `${Math.round(light.key.x / 40)}:${Math.round(light.key.y / 40)}` : '',
    activeTintKey(),
    env.reduced ? 1 : 0,
    Math.round(env.bleed ?? 0),
  ].join('|');
}

function noteLampGlow(prop: Prop, env: Env): void {
  if (prop.kind !== 'lamp') {
    return;
  }
  const scale = prop.scale ?? 1;
  const on = lampGlow(prop.glow, env.tod.dark);
  if (on > 0.01) {
    env.glows.push({ x: prop.x, y: prop.y - 74 * scale, r: 84 * scale, a: on });
  }
}

export function drawProp(c: SkCanvas, prop: Prop, env: Env): void {
  const saved = env.anchor;
  env.anchor = { x: prop.x, y: prop.y };
  c.save();
  c.translate(prop.x, prop.y);
  const lifted = env.liftedId === prop.id;
  const squishAge = env.squishId === prop.id ? env.t - (env.squishAt ?? env.t) : -1;
  const squishing = squishAge >= 0 && squishAge < 0.18;
  let pop = lifted ? 1.08 : 1;
  if (squishing) {
    pop *= 1 - 0.06 * Math.sin((squishAge / 0.18) * Math.PI);
  }
  if (lifted) {
    fillOval(c, 0, 8, 46, 12, '#000000', 0.16);
  }
  if (pop !== 1) {
    c.scale(pop, pop);
  }
  if (prop.scale) {
    c.scale(prop.scale, prop.scale);
  }
  if (extras(prop).flip) {
    c.scale(-1, 1);
  }
  const key = stillPropKey(prop, env, lifted, squishing);
  const live = LIVE_PROPS.has(prop.kind);
  if (key) {
    const step = live ? motionStep(env) : 0;
    let slot = propShots.get(key);
    let recorded = false;
    if ((!slot || slot.step !== step) && (!live || takeMotionRecord(env.t))) {
      if (!slot && propShots.size >= PROP_CAP) {
        const oldest = propShots.keys().next().value;
        if (oldest !== undefined) {
          propShots.delete(oldest);
        }
      }
      const recorder = Skia.PictureRecorder();
      const canvas = recorder.beginRecording(Skia.XYWHRect(-800, -900, 2200, 1800));
      drawPropBody(canvas, prop, env);
      slot = { picture: recorder.finishRecordingAsPicture(), step };
      propShots.set(key, slot);
      recorded = true;
    }
    if (slot) {
      if (!recorded && !live) {
        noteLampGlow(prop, env);
      }
      c.drawPicture(slot.picture);
    } else {
      drawPropBody(c, prop, env);
    }
  } else {
    drawPropBody(c, prop, env);
  }
  c.restore();
  env.anchor = saved;
}

// Backdrop, back layers, floor and the flat `back` props. Everything here takes the scene tint, set
// by the caller with withTint (or, for older callers, a tinted layer: both work).
export function drawBackdrop(c: SkCanvas, scene: Scene, env: Env, bleed = 0): void {
  env.bleed = bleed;
  env.scene = env.scene ?? scene;
  drawBackdropLayers(c, scene, env, bleed, () => {
    for (const prop of scene.props) {
      if (prop.layer === 'back') {
        drawProp(c, prop, env);
      }
    }
  });
}

// Falling leaves from the scene, rain and snow from the weather, the scene's own colour wash,
// overcast gloom, and lamp glows. The glows use screen blending and are drawn last so they stay bright.
export function drawAmbient(c: SkCanvas, world: World, env: Env, bleed = 0, skipGlows = false): void {
  const scene = world.scene;
  const ambient = scene.ambient;
  const particles = ambient?.particles;
  if (particles && !env.reduced && world.particles.length > 0) {
    const kind = particles.kind;
    const color = particles.color ?? (kind === 'rain' ? 'rgba(190,215,240,0.75)' : kind === 'snow' ? '#ffffff' : '#d98f3a');
    for (const p of world.particles) {
      if (kind === 'rain') {
        c.drawLine(p.x, p.y, p.x + 3, p.y - 11, paintOf(color, 1, 1.2, StrokeCap.Round));
      } else if (kind === 'snow') {
        c.drawCircle(p.x, p.y, 1.7, paintOf(color));
      } else {
        c.save();
        c.translate(p.x, p.y);
        c.rotate(((env.t + p.ph) * 180) / Math.PI, 0, 0);
        c.drawOval(oval(0, 0, 4, 2), paintOf(color));
        c.restore();
      }
    }
  }
  const left = -bleed;
  const span = stageWidth + bleed * 2;
  const roofed = scene.shelter === 'roofed';
  if (scene.time === 'outdoor' && !roofed) {
    drawPrecip(c, left, 0, span, stageHeight, env);
  }
  if (ambient?.tint) {
    c.drawRect(Skia.XYWHRect(left, 0, span, stageHeight), paintOf(ambient.tint));
  }
  if (!(scene.time === 'indoor' && env.tod.dark > 0.2)) {
    overcastWash(c, left, 0, span, stageHeight, env, scene.time === 'outdoor' ? 0.22 : 0.12);
  }
  if (!skipGlows) {
    for (const g of env.glows) {
      glow(c, g.x, g.y, g.r, '#ffc464', 0.8 * g.a);
    }
  }
}


// `t` sways the wand's feathers; pass the scene clock (env.t) where it is available.
export function drawHeldPlay(c: SkCanvas, world: World, t = 0): void {
  const held = world.held;
  const actor = world.actors[0];
  if (!held || !actor) {
    return;
  }
  if (held.kind === 'laser') {
    const floor = world.scene.floor;
    const scale = depthScale(held.y, floor.yMin, floor.yMax);
    const slip = held.slip * 0.5 * 18 * actor.face;
    const x = Math.min(floor.xMax, Math.max(floor.xMin, held.x + slip));
    const y = held.y;
    const origin = { x: stageWidth / 2, y: stageHeight - 28 };
    const angle = (Math.atan2(y - origin.y, x - origin.x) * 180) / Math.PI;
    const tip = laserTip(origin.x, origin.y, angle, 36);
    c.drawLine(tip.x, tip.y, x, y, paintOf('#FF4D6A', 0.4, 1.5));
    drawLaserPointer(c, origin.x, origin.y, angle, 36);
    fillCircle(c, x, y, 10 * scale, '#FF4D6A', 0.25);
    fillCircle(c, x, y, 3.5 * scale, '#FF3355');
    if (held.spark > 0) {
      fillCircle(c, x, y, 8 + held.spark * 6, '#fff6c8', 0.65 * Math.min(1, held.spark));
    }
    return;
  }
  // Feather wand: the stick comes in from off-screen, a short string drops to the bell, and the
  // feathers hang around (featherX, y), the point the pet chases.
  const fy = held.y - held.featherZ;
  const bellY = fy - 12;
  const tip = { x: held.featherX + 18, y: bellY - 26 };
  const handle = { x: stageWidth + 30, y: stageHeight + 10 };
  c.drawLine(tip.x, tip.y, handle.x, handle.y, paintOf('#7A4A22', 1, 5, StrokeCap.Round));
  c.drawLine(tip.x, tip.y, handle.x, handle.y, paintOf('#C98C55', 1, 2.4, StrokeCap.Round));
  const string = Skia.PathBuilder.Make();
  string.moveTo(tip.x, tip.y);
  string.quadTo(held.featherX + 12, bellY - 14, held.featherX, bellY - 2);
  c.drawPath(string.build(), paintOf('#9E8AB0', 1, 1.2));
  drawFeatherBundle(c, held.featherX, bellY, 0.7, t);
  if (held.spark > 0) {
    fillCircle(c, held.x, held.y - 20, 6 + held.spark * 4, '#fff6c8', 0.7 * Math.min(1, held.spark));
  }
}
