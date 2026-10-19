import { BlendMode, Skia, StrokeCap, ClipOp } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import { stars, tuftsFor } from '../../actor';
import type { Scene, TimeOfDay, World } from '../../actor';
import { stageHeight, stageWidth } from '../../actor/geometry';
import type { Prop, Shape } from '../../actor/scenes';
import {
  clamp,
  fillCircle,
  fillGradient,
  fillOval,
  fillRRect,
  fillRect,
  mix,
  oval,
  paintOf,
  polygon,
  radialGlow,
  strokeLine,
  strokeOval,
} from './draw';

export type Glow = { x: number; y: number; r: number; a: number };

export type Env = {
  tod: TimeOfDay;
  t: number;
  reduced: boolean;
  bowlFill: number;
  waterLevel: number;
  glows: Glow[];
  // Where a pet is eating or drinking right now, so a bowl can react.
  feeding: { x: number; y: number; kind: 'eat' | 'drink' }[];
};

// A rectangle of sky: gradient, stars, the sun (06:00-18:00, east to west) and the moon (18:00-06:00).
// The backdrop and every window pane use it, so they always show the same sky.
export function drawSkyPane(c: SkCanvas, x: number, y: number, w: number, h: number, env: Env): void {
  const { tod, t, reduced } = env;
  c.save();
  c.clipRect(Skia.XYWHRect(x, y, w, h), ClipOp.Intersect, true);
  fillGradient(c, x, y, w, h, tod.top, tod.bot);
  const starAlpha = clamp((tod.dark - 0.45) * 2, 0, 1);
  if (starAlpha > 0.01) {
    for (const star of stars) {
      const alpha = starAlpha * (reduced ? 0.85 : 0.6 + 0.4 * Math.sin(t * 1.6 + star[3]));
      fillCircle(c, x + star[0] * w, y + star[1] * h, Math.min(star[2], w / 40 + 0.6), '#ffffff', clamp(alpha, 0, 1));
    }
  }
  const r = Math.max(5, Math.min(22, h * 0.17));
  const spot = (u: number, peak: number) => ({
    x: x + w * (0.12 + 0.76 * u),
    y: y + h * 0.98 - Math.sin(Math.PI * clamp(u, -0.1, 1.1)) * h * peak,
  });
  const sun = (tod.hour - 6) / 12;
  if (sun > -0.12 && sun < 1.12) {
    const p = spot(sun, 0.8);
    const color = mix('#ff8f4f', '#fff3b0', clamp(Math.sin(Math.PI * clamp(sun, 0, 1)) * 2.5, 0, 1));
    radialGlow(c, p.x, p.y, r * 0.5, r * 3.4, color, 0.38);
    fillCircle(c, p.x, p.y, r, color);
  }
  const moon = ((tod.hour - 18 + 24) % 24) / 12;
  const moonAlpha = clamp(tod.dark * 1.6, 0, 1);
  if (moon > -0.12 && moon < 1.12 && moonAlpha > 0.02) {
    const p = spot(moon, 0.7);
    radialGlow(c, p.x, p.y, r * 0.5, r * 2.8, '#cfd6ff', 0.3 * moonAlpha);
    fillCircle(c, p.x, p.y, r * 0.82, '#f4f0d8', moonAlpha);
    fillCircle(c, p.x - r * 0.25, p.y - r * 0.2, r * 0.2, '#a09b82', 0.35 * moonAlpha);
    fillCircle(c, p.x + r * 0.28, p.y + r * 0.22, r * 0.14, '#a09b82', 0.35 * moonAlpha);
  }
  c.restore();
}

export function drawShapes(c: SkCanvas, shapes: Shape[], env: Env): void {
  for (const shape of shapes) {
    if (shape.t === 'sky') {
      if (shape.x != null && shape.y != null && shape.w != null && shape.h != null) {
        drawSkyPane(c, shape.x, shape.y, shape.w, shape.h, env);
      }
      continue;
    }
    const path = Skia.Path.Make();
    if (shape.t === 'rect' && shape.x != null && shape.y != null && shape.w != null && shape.h != null) {
      const rect = Skia.XYWHRect(shape.x, shape.y, shape.w, shape.h);
      if (shape.r) {
        path.addRRect(Skia.RRectXY(rect, shape.r, shape.r));
      } else {
        path.addRect(rect);
      }
    } else if (shape.t === 'ellipse' && shape.x != null && shape.y != null) {
      path.addOval(oval(shape.x, shape.y, shape.rx ?? 10, shape.ry ?? 10));
    } else if (shape.t === 'circle' && shape.x != null && shape.y != null) {
      path.addCircle(shape.x, shape.y, shape.r ?? 10);
    } else if (shape.t === 'poly' && shape.pts && shape.pts.length > 1) {
      path.addPoly(
        shape.pts.map(([x, y]) => ({ x, y })),
        true,
      );
    } else if (shape.t === 'line' && shape.x1 != null && shape.y1 != null && shape.x2 != null && shape.y2 != null) {
      path.moveTo(shape.x1, shape.y1);
      path.lineTo(shape.x2, shape.y2);
    } else {
      continue;
    }
    const alpha = shape.alpha ?? 1;
    if (shape.fill && shape.t !== 'line') {
      c.drawPath(path, paintOf(shape.fill, alpha));
    }
    if (shape.stroke || shape.t === 'line') {
      c.drawPath(path, paintOf(shape.stroke ?? shape.fill ?? '#000000', alpha, shape.lw ?? 2));
    }
  }
}

function drawBowl(c: SkCanvas, prop: Prop, env: Env): void {
  const accent = prop.color ?? '#2f7d5b';
  fillOval(c, 0, 2, 36, 7, '#000000', 0.12);
  const body = Skia.Path.Make();
  body.moveTo(-30, -16);
  body.lineTo(-22, 0);
  body.quadTo(0, 5, 22, 0);
  body.lineTo(30, -16);
  body.close();
  c.drawPath(body, paintOf(mix(accent, '#000000', 0.2)));
  fillOval(c, 0, -16, 30, 7, accent);
  fillOval(c, 0, -16, 25, 5, mix(accent, '#000000', 0.45));
  if (prop.contents === 'water') {
    const level = clamp(env.waterLevel, 0, 1);
    if (level > 0.02) {
      fillOval(c, 0, -16, 25 * (0.55 + 0.45 * level), 5 * (0.55 + 0.45 * level), '#7ec3e6', 0.35 + 0.65 * level);
      const lapped = env.feeding.some((f) => f.kind === 'drink' && f.x === prop.x && f.y === prop.y);
      if (lapped && !env.reduced) {
        // Rings spread from where the tongue hits the water.
        for (let i = 0; i < 2; i += 1) {
          const k = (env.t * 1.6 + i * 0.5) % 1;
          strokeOval(c, 3, -16, 3 + k * 16, 0.7 + k * 3.2, '#ffffff', 1.4, 0.7 * (1 - k));
        }
      }
    }
  }
  const count = prop.contents === 'water' ? 0 : Math.round(16 * env.bowlFill);
  for (let i = 0; i < count; i += 1) {
    const angle = i * 2.4;
    const radius = 4 + (i % 5) * 4.2;
    fillOval(c, Math.cos(angle) * radius, -17 + Math.sin(angle) * 2.2 - (i % 3), 3, 2.2, '#8a5a3a');
  }
}

function drawPropBody(c: SkCanvas, prop: Prop, env: Env): void {
  const { tod, t } = env;
  const color = prop.color;
  switch (prop.kind) {
    case 'shape':
      drawShapes(c, prop.shapes ?? [], env);
      break;
    case 'bowl':
      drawBowl(c, prop, env);
      break;
    case 'bed': {
      const w = prop.w ?? 110;
      const col = color ?? '#4d7fa8';
      fillOval(c, 0, 4, w / 2 + 4, 8, '#000000', 0.12);
      fillOval(c, 0, -5, w / 2, 15, mix(col, '#000000', 0.25));
      fillOval(c, 0, -9, w / 2, 14, col);
      fillOval(c, 0, -8, w / 2 - 11, 9, mix(col, '#ffffff', 0.28));
      break;
    }
    case 'rug': {
      const w = prop.w ?? 280;
      const h = prop.h ?? 60;
      const col = color ?? '#7c5a8a';
      fillOval(c, 0, 0, w / 2, h / 2, col);
      strokeOval(c, 0, 0, w / 2 - 10, h / 2 - 7, mix(col, '#ffffff', 0.4), 3);
      break;
    }
    case 'couch': {
      const w = prop.w ?? 190;
      const col = color ?? '#4f7c8a';
      fillOval(c, 0, 3, w / 2 + 8, 7, '#000000', 0.12);
      fillRRect(c, -w / 2 + 6, -70, w - 12, 46, 12, mix(col, '#000000', 0.15));
      fillRRect(c, -w / 2 + 14, -42, w - 28, 30, 8, col);
      fillRRect(c, -w / 2 - 6, -52, 24, 48, 9, mix(col, '#000000', 0.3));
      fillRRect(c, w / 2 - 18, -52, 24, 48, 9, mix(col, '#000000', 0.3));
      fillRect(c, -w / 2 + 6, -6, 6, 6, '#4a3a2c');
      fillRect(c, w / 2 - 12, -6, 6, 6, '#4a3a2c');
      break;
    }
    case 'window': {
      const w = prop.w ?? 96;
      const h = prop.h ?? 92;
      fillRect(c, -w / 2 - 6, -h - 6, w + 12, h + 12, '#efe8dc');
      drawSkyPane(c, -w / 2, -h, w, h, env);
      const cloud = 1 - clamp(tod.dark * 1.5, 0, 1);
      if (cloud > 0.02) {
        fillOval(c, -w * 0.15, -h * 0.62, 20, 6, '#ffffff', 0.85 * cloud);
      }
      strokeLine(c, 0, -h, 0, 0, '#efe8dc', 4);
      strokeLine(c, -w / 2, -h / 2, w / 2, -h / 2, '#efe8dc', 4);
      fillRect(c, -w / 2 - 10, 0, w + 20, 6, '#d9cfbd');
      break;
    }
    case 'lamp': {
      const scale = prop.scale ?? 1;
      const glow = prop.glow === true ? 1 : prop.glow === false ? 0 : clamp((tod.dark - 0.25) / 0.5, 0, 1);
      if (glow > 0.01) {
        env.glows.push({ x: prop.x, y: prop.y - 74 * scale, r: 84 * scale, a: glow });
      }
      fillOval(c, 0, 2, 16, 4, '#000000', 0.12);
      fillRect(c, -1.5, -66, 3, 66, '#5a4a3a');
      fillOval(c, 0, -1, 11, 3.5, '#5a4a3a');
      c.drawPath(
        polygon([
          [-15, -64],
          [15, -64],
          [10, -86],
          [-10, -86],
        ]),
        paintOf(color ?? '#f1d58a'),
      );
      break;
    }
    case 'tree': {
      const col = color ?? '#4f9d55';
      fillOval(c, 0, 2, 34, 6, '#000000', 0.12);
      fillRect(c, -7, -62, 14, 62, '#7a5535');
      for (const [x, y, r] of [
        [0, -92, 36],
        [-26, -70, 26],
        [26, -70, 26],
      ]) {
        fillCircle(c, x, y, r, col);
      }
      fillCircle(c, -8, -100, 16, mix(col, '#ffffff', 0.18));
      break;
    }
    case 'bench': {
      const w = prop.w ?? 96;
      const col = color ?? '#8a5a3a';
      fillOval(c, 0, 2, w / 2 + 4, 5, '#000000', 0.12);
      fillRect(c, -w / 2 + 6, -22, 6, 22, '#4a4a52');
      fillRect(c, w / 2 - 12, -22, 6, 22, '#4a4a52');
      fillRRect(c, -w / 2, -28, w, 8, 2, col);
      fillRRect(c, -w / 2, -52, w, 8, 2, col);
      fillRRect(c, -w / 2, -40, w, 8, 2, col);
      break;
    }
    case 'pond': {
      const w = prop.w ?? 150;
      const h = prop.h ?? 34;
      fillOval(c, 0, 0, w / 2 + 5, h / 2 + 3, '#a9d9ee');
      fillOval(c, 0, 0, w / 2, h / 2, '#69b6de');
      const k = (t * 0.35) % 1;
      strokeOval(c, w * 0.1, -2, w * 0.1 * (0.4 + k), h * 0.1 * (0.4 + k) + 1, '#ffffff', 1.5, 0.55 * (1 - k));
      break;
    }
    case 'bush': {
      const col = color ?? '#5aa65a';
      fillOval(c, 0, 2, 32, 5, '#000000', 0.12);
      for (const [x, y, r] of [
        [-16, -14, 16],
        [0, -20, 20],
        [18, -13, 15],
      ]) {
        fillCircle(c, x, y, r, col);
      }
      fillCircle(c, -3, -26, 8, mix(col, '#ffffff', 0.2));
      break;
    }
    case 'fence': {
      const w = prop.w ?? 300;
      const col = color ?? '#f1ede4';
      fillRect(c, -w / 2, -22, w, 4, mix(col, '#000000', 0.12));
      fillRect(c, -w / 2, -10, w, 4, mix(col, '#000000', 0.12));
      for (let x = -w / 2; x <= w / 2; x += 14) {
        fillRect(c, x, -32, 8, 32, col);
      }
      break;
    }
    default:
      break;
  }
}

export function drawProp(c: SkCanvas, prop: Prop, env: Env): void {
  c.save();
  c.translate(prop.x, prop.y);
  if (prop.scale) {
    c.scale(prop.scale, prop.scale);
  }
  drawPropBody(c, prop, env);
  c.restore();
}

function drawFloorPattern(c: SkCanvas, scene: Scene): void {
  const floor = scene.floor;
  const color = floor.lineColor ?? 'rgba(0,0,0,0.12)';
  const path = Skia.Path.Make();
  let width = 1;
  if (floor.pattern === 'lines') {
    for (let i = 1; i < 4; i += 1) {
      const y = floor.horizon + i * i * 9 + 6;
      path.moveTo(0, y);
      path.lineTo(stageWidth, y);
    }
  } else if (floor.pattern === 'planks') {
    const ys = [0, 8, 22, 44, 76, 120].map((offset) => floor.horizon + offset).concat(stageHeight);
    for (const y of ys) {
      path.moveTo(0, y);
      path.lineTo(stageWidth, y);
    }
    for (let row = 0; row < ys.length - 1; row += 1) {
      const span = 46 + row * 34;
      const offset = ((row % 2) * span) / 2;
      for (let x = offset; x < stageWidth; x += span) {
        path.moveTo(x, ys[row]);
        path.lineTo(x, ys[row + 1]);
      }
    }
  } else if (floor.pattern === 'grass') {
    width = 1.3;
    for (const tuft of tuftsFor(scene)) {
      path.moveTo(tuft.x - tuft.s * 0.5, tuft.y);
      path.lineTo(tuft.x - tuft.s * 0.7, tuft.y - tuft.s);
      path.moveTo(tuft.x, tuft.y);
      path.lineTo(tuft.x, tuft.y - tuft.s * 1.2);
      path.moveTo(tuft.x + tuft.s * 0.5, tuft.y);
      path.lineTo(tuft.x + tuft.s * 0.7, tuft.y - tuft.s);
    }
  } else {
    return;
  }
  c.drawPath(path, paintOf(color, 1, width));
}

// Backdrop, back layers, floor and the flat `back` props. Everything here takes the full scene tint.
export function drawBackdrop(c: SkCanvas, scene: Scene, env: Env): void {
  const floor = scene.floor;
  if (scene.time === 'outdoor') {
    drawSkyPane(c, 0, 0, stageWidth, floor.horizon, env);
  } else {
    fillGradient(c, 0, 0, stageWidth, floor.horizon, scene.sky[0], scene.sky[1]);
  }
  drawShapes(c, scene.layers, env);
  fillGradient(c, 0, floor.horizon, stageWidth, stageHeight - floor.horizon, floor.color[0], floor.color[1]);
  drawFloorPattern(c, scene);
  for (const prop of scene.props) {
    if (prop.layer === 'back') {
      drawProp(c, prop, env);
    }
  }
}

// Falling leaves, snow or rain, the scene's own color wash, and lamp glows. The glows use screen
// blending and are drawn after the tint so they stay bright.
export function drawAmbient(c: SkCanvas, world: World, env: Env): void {
  const ambient = world.scene.ambient;
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
  if (ambient?.tint) {
    fillRect(c, 0, 0, stageWidth, stageHeight, ambient.tint);
  }
  for (const glow of env.glows) {
    radialGlow(c, glow.x, glow.y, 2, glow.r, '#ffc464', 0.8 * glow.a, BlendMode.Screen);
  }
}

export function drawBallShape(c: SkCanvas, x: number, y: number, radius: number): void {
  fillCircle(c, x, y, radius, '#df5340');
  const shine = Skia.Path.Make();
  shine.addArc(oval(x, y, radius * 0.62, radius * 0.62), 162, 117);
  c.drawPath(shine, paintOf('#ffffff', 0.75, 1.6));
  fillCircle(c, x + radius * 0.35, y - radius * 0.4, radius * 0.22, '#ffffff', 0.55);
}
