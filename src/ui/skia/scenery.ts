import { StrokeCap, Skia } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import type { Scene, World } from '../../actor';
import { depthScale, stageHeight, stageWidth } from '../../actor/geometry';
import type { Prop } from '../../actor/scenes';
import { drawBackdropLayers } from './backdrop';
import { fillCircle, fillOval, oval, paintOf } from './draw';
import type { Env } from './env';
import { glow } from './ink';
import { extras, drawPropBody } from './props';
import { overcastWash } from './sky';
import { drawPrecip } from './weatherFx';
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

export function drawProp(c: SkCanvas, prop: Prop, env: Env): void {
  const saved = env.anchor;
  env.anchor = { x: prop.x, y: prop.y };
  c.save();
  c.translate(prop.x, prop.y);
  const lifted = env.liftedId === prop.id;
  const squishAge = env.squishId === prop.id ? env.t - (env.squishAt ?? env.t) : -1;
  let pop = lifted ? 1.08 : 1;
  if (squishAge >= 0 && squishAge < 0.18) {
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
  drawPropBody(c, prop, env);
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

// Every toy kind the pet can play with: the ball, a flat frisbee, a ball of yarn with a trailing thread, and a squeaky toy.
export function drawToyShape(c: SkCanvas, kind: string, x: number, y: number, radius: number, t = 0): void {
  if (kind === 'frisbee') {
    fillOval(c, x, y, radius * 1.5, radius * 0.5, '#3a8fd8');
    fillOval(c, x, y - radius * 0.1, radius * 1.05, radius * 0.3, '#7cc0f2');
    return;
  }
  if (kind === 'yarn') {
    fillCircle(c, x, y, radius, '#d9628f');
    for (const k of [-0.5, 0, 0.5]) {
      const arc = Skia.PathBuilder.Make();
      arc.addArc(oval(x, y, radius * (0.95 - Math.abs(k) * 0.4), radius * 0.95), 200 + k * 40, 130);
      c.drawPath(arc.build(), paintOf('#a8406a', 0.9, 1.2));
    }
    const thread = Skia.PathBuilder.Make();
    thread.moveTo(x + radius * 0.8, y + radius * 0.5);
    thread.cubicTo(x + radius * 1.8, y + radius * 0.9, x + radius * 1.5, y + radius * 1.5, x + radius * 2.6, y + radius * 1.1 + Math.sin(t * 2) * 0.8);
    c.drawPath(thread.build(), paintOf('#d9628f', 1, 1.4));
    return;
  }
  if (kind === 'stick') {
    c.save();
    c.translate(x, y);
    c.rotate(28, 0, 0);
    c.drawLine(-radius * 1.5, 0, radius * 1.5, 0, paintOf('#8a5a32', 1, 3));
    c.drawLine(-radius * 1.2, -radius * 0.25, -radius * 0.4, radius * 0.15, paintOf('#6b4424', 1, 1.6));
    c.restore();
    return;
  }
  if (kind === 'rope') {
    const lying = Skia.PathBuilder.Make();
    lying.moveTo(x - radius * 1.8, y);
    lying.quadTo(x - radius * 0.2, y + radius * 0.9, x + radius * 1.6, y + radius * 0.15);
    c.drawPath(lying.build(), paintOf('#c4553a', 1, 2.6));
    return;
  }
  if (kind === 'mouse') {
    fillOval(c, x, y, radius * 1.15, radius * 0.7, '#c4c8d0');
    fillCircle(c, x + radius * 0.85, y - radius * 0.15, radius * 0.45, '#d7dbe2');
    fillCircle(c, x + radius * 1.05, y - radius * 0.55, radius * 0.22, '#e7b7c4');
    fillCircle(c, x + radius * 1.05, y - radius * 0.55, radius * 0.08, '#3a2a32');
    const tail = Skia.PathBuilder.Make();
    tail.moveTo(x - radius * 0.9, y);
    tail.quadTo(x - radius * 1.6, y - radius * 0.8, x - radius * 1.3, y - radius * 1.3);
    c.drawPath(tail.build(), paintOf('#c4c8d0', 1, 2));
    return;
  }
  if (kind === 'crinkle') {
    fillCircle(c, x, y, radius, '#7ec8e3');
    fillCircle(c, x - radius * 0.2, y - radius * 0.15, radius * 0.55, '#f4f7fb', 0.55);
    return;
  }
  if (kind === 'bone') {
    c.save();
    c.translate(x, y);
    c.rotate(-18, 0, 0);
    c.drawLine(-radius * 0.7, 0, radius * 0.7, 0, paintOf('#f3e2c4', 1, radius * 0.55));
    fillCircle(c, -radius * 0.85, -radius * 0.18, radius * 0.38, '#f3e2c4');
    fillCircle(c, -radius * 0.85, radius * 0.18, radius * 0.38, '#f3e2c4');
    fillCircle(c, radius * 0.85, -radius * 0.18, radius * 0.38, '#f3e2c4');
    fillCircle(c, radius * 0.85, radius * 0.18, radius * 0.38, '#f3e2c4');
    c.restore();
    return;
  }
  if (kind === 'wand') {
    c.drawLine(x - radius * 0.2, y + radius * 1.4, x + radius * 0.8, y - radius * 1.2, paintOf('#8a5a32', 1, 2.2));
    fillCircle(c, x + radius * 0.9, y - radius * 1.35, radius * 0.45, '#e85a8c');
    fillCircle(c, x + radius * 1.25, y - radius * 1.05, radius * 0.28, '#f2c230');
    return;
  }
  if (kind === 'laser') {
    fillCircle(c, x, y, radius * 0.55, '#ff4d4d', 0.35);
    fillCircle(c, x, y, radius * 0.22, '#ff4d4d');
    return;
  }
  if (kind === 'squeaky') {
    fillOval(c, x, y, radius * 1.1, radius * 0.75, '#f2c230');
    fillCircle(c, x + radius * 0.85, y - radius * 0.3, radius * 0.5, '#f2c230');
    fillCircle(c, x + radius * 1.0, y - radius * 0.4, radius * 0.1, '#3a2a10');
    return;
  }
  drawBallShape(c, x, y, radius);
}

// A biscuit is the treat we can draw today. Other ids get a simple variant until they have their own art.
export function drawTreatShape(
  c: SkCanvas,
  id: string,
  x: number,
  y: number,
  radius: number,
  t = 0,
  species: 'dog' | 'cat' | null = null,
): void {
  if (id === 'biscuit' && species === 'cat') {
    fillOval(c, x, y, radius * 1.15, radius * 0.62, '#e7b15a');
    fillOval(c, x + radius * 0.85, y, radius * 0.38, radius * 0.28, '#e7b15a');
    fillCircle(c, x + radius * 1.05, y - radius * 0.08, radius * 0.08, '#8a5a32');
    fillCircle(c, x - radius * 0.2, y - radius * 0.05, radius * 0.1, '#c9842f');
    return;
  }
  if (id === 'biscuit') {
    c.save();
    c.translate(x, y);
    c.rotate(-18, 0, 0);
    c.drawLine(-radius * 0.7, 0, radius * 0.7, 0, paintOf('#e7b15a', 1, radius * 0.42));
    fillCircle(c, -radius * 0.85, -radius * 0.16, radius * 0.34, '#e7b15a');
    fillCircle(c, -radius * 0.85, radius * 0.16, radius * 0.34, '#e7b15a');
    fillCircle(c, radius * 0.85, -radius * 0.16, radius * 0.34, '#e7b15a');
    fillCircle(c, radius * 0.85, radius * 0.16, radius * 0.34, '#e7b15a');
    c.restore();
    return;
  }
  fillCircle(c, x, y + radius * 0.08, radius, '#c9842f');
  fillCircle(c, x, y, radius * 0.92, '#e7b15a');
  fillCircle(c, x - radius * 0.22, y - radius * 0.28, radius * 0.55, '#f3d48a', 0.9);
  fillCircle(c, x - radius * 0.28, y + radius * 0.08, radius * 0.16, '#8a5a32');
  fillCircle(c, x + radius * 0.22, y - radius * 0.22, radius * 0.13, '#8a5a32');
  fillCircle(c, x + radius * 0.08, y + radius * 0.28, radius * 0.12, '#8a5a32');
  if (id === 'special') {
    const twinkle = 0.85 + Math.sin(t * 6) * 0.15;
    fillCircle(c, x, y - radius * 0.05, radius * 0.28 * twinkle, '#ff7ba5');
    fillCircle(c, x, y - radius * 0.05, radius * 0.12, '#fff6fb');
  }
}

export function drawHeldPlay(c: SkCanvas, world: World): void {
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
    const angle = Math.atan2(y - origin.y, x - origin.x);
    c.save();
    c.translate(origin.x, origin.y);
    c.rotate((angle * 180) / Math.PI, 0, 0);
    const body = Skia.PathBuilder.Make();
    body.addRRect(Skia.RRectXY(Skia.XYWHRect(-16, -10, 32, 22), 6, 6));
    c.drawPath(body.build(), paintOf('#2a2a32'));
    c.drawCircle(18, 0, 5, paintOf('#ff4d4d'));
    c.restore();
    c.drawLine(origin.x, origin.y, x, y, paintOf('#FF4D4D', 0.4, 1.5));
    fillCircle(c, x, y, 10 * scale, '#ff4d4d', 0.28);
    fillCircle(c, x, y, 3.5 * scale, '#ff4d4d');
    if (held.spark > 0) {
      fillCircle(c, x, y, 8 + held.spark * 6, '#fff6c8', 0.65 * Math.min(1, held.spark));
    }
    return;
  }
  const y = held.y - held.featherZ;
  c.drawLine(held.featherX, y, stageWidth + 30, stageHeight + 10, paintOf('#8a5a32', 1, 2.4));
  fillCircle(c, held.featherX, y, 8, '#e85a8c');
  fillCircle(c, held.featherX + 7, y + 4, 5, '#f2c230');
  if (held.spark > 0) {
    fillCircle(c, held.x, held.y - 20, 6 + held.spark * 4, '#fff6c8', 0.7 * Math.min(1, held.spark));
  }
}

export function drawBallShape(c: SkCanvas, x: number, y: number, radius: number): void {
  fillCircle(c, x, y, radius, '#df5340');
  const shine = Skia.PathBuilder.Make();
  shine.addArc(oval(x, y, radius * 0.62, radius * 0.62), 162, 117);
  c.drawPath(shine.build(), paintOf('#ffffff', 0.75, 1.6));
  fillCircle(c, x + radius * 0.35, y - radius * 0.4, radius * 0.22, '#ffffff', 0.55);
}
