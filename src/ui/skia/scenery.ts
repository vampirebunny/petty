import { StrokeCap, Skia } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import type { Scene, World } from '../../actor';
import { stageHeight, stageWidth } from '../../actor/geometry';
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
export function drawAmbient(c: SkCanvas, world: World, env: Env, bleed = 0): void {
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
  overcastWash(c, left, 0, span, stageHeight, env, scene.time === 'outdoor' ? 0.22 : 0.12);
  for (const g of env.glows) {
    glow(c, g.x, g.y, g.r, '#ffc464', 0.8 * g.a);
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
      const arc = Skia.Path.Make();
      arc.addArc(oval(x, y, radius * (0.95 - Math.abs(k) * 0.4), radius * 0.95), 200 + k * 40, 130);
      c.drawPath(arc, paintOf('#a8406a', 0.9, 1.2));
    }
    const thread = Skia.Path.Make();
    thread.moveTo(x + radius * 0.8, y + radius * 0.5);
    thread.cubicTo(x + radius * 1.8, y + radius * 0.9, x + radius * 1.5, y + radius * 1.5, x + radius * 2.6, y + radius * 1.1 + Math.sin(t * 2) * 0.8);
    c.drawPath(thread, paintOf('#d9628f', 1, 1.4));
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
    const lying = Skia.Path.Make();
    lying.moveTo(x - radius * 1.8, y);
    lying.quadTo(x - radius * 0.2, y + radius * 0.9, x + radius * 1.6, y + radius * 0.15);
    c.drawPath(lying, paintOf('#c4553a', 1, 2.6));
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

export function drawBallShape(c: SkCanvas, x: number, y: number, radius: number): void {
  fillCircle(c, x, y, radius, '#df5340');
  const shine = Skia.Path.Make();
  shine.addArc(oval(x, y, radius * 0.62, radius * 0.62), 162, 117);
  c.drawPath(shine, paintOf('#ffffff', 0.75, 1.6));
  fillCircle(c, x + radius * 0.35, y - radius * 0.4, radius * 0.22, '#ffffff', 0.55);
}
