import { BlendMode, Skia, TileMode } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import type { Scene } from '../../actor';
import { stageHeight, stageWidth } from '../../actor/geometry';
import { indoorOverlayAlpha, lighting } from '../../actor/lighting';
import type { Env, LampLight, LightRig } from './env';
import { weatherOf } from './env';
import { clamp01, ellipse, fill, glow, glowOval, hash, polyPath, untinted } from './ink';
import { windowDims } from './layout';
import { sunFraction } from './sky';

/** How much a lamp is lit: always, never, or from dusk (the old lamp rule). */
export function lampGlow(glowSetting: boolean | undefined, dark: number): number {
  return glowSetting === true ? 1 : glowSetting === false ? 0 : clamp01((dark - 0.25) / 0.5);
}

export function lightRig(scene: Scene, env: Env): LightRig {
  const { tod } = env;
  const weather = weatherOf(env);
  const lamps: LampLight[] = [];
  for (const prop of scene.props) {
    if (prop.kind === 'lamp') {
      const a = lampGlow(prop.glow, tod.dark);
      if (a > 0.01) {
        const s = prop.scale ?? 1;
        lamps.push({ x: prop.x, y: prop.y - 74 * s, floorY: prop.y, r: 84 * s, a });
      }
    }
  }
  const u = sunFraction(env);
  const arc = Math.sin(Math.PI * clamp01(u));
  const sunUp = u > -0.03 && u < 1.03;
  if (scene.time === 'outdoor') {
    const horizon = scene.floor.horizon;
    if (sunUp && tod.dark < 0.75) {
      const direct = (1 - weather.overcast * 0.85) * (1 - tod.dark) * clamp01(arc * 4 + 0.15);
      return {
        key: { x: stageWidth * (0.12 + 0.76 * u), y: horizon * 0.98 - arc * horizon * 0.8 },
        direct,
        length: 0.3 + 1.5 * (1 - arc),
        contact: 0.1 + 0.08 * direct,
        lamps,
        rim: '#ffcf8f',
        rimStrength: direct * (0.15 + 0.5 * (1 - arc)),
      };
    }
    const moon = env.sky?.moon;
    const moonLight = (moon?.illumination ?? 0.5) * (1 - weather.overcast);
    return {
      key: moonLight > 0.2 ? { x: stageWidth * 0.7, y: horizon * 0.3 } : null,
      direct: 0.22 * moonLight,
      length: 0.8,
      contact: 0.09,
      lamps,
      rim: '#b8c8ff',
      rimStrength: 0.18 * moonLight,
    };
  }
  // Indoors: daylight comes in through the biggest window; at night the lamps take over.
  const day = (1 - tod.dark) * (1 - weather.overcast * 0.7);
  let key: { x: number; y: number } | null = null;
  let best = 0;
  for (const prop of scene.props) {
    if (prop.kind === 'window') {
      const { w, h } = windowDims(prop);
      const area = w * h * (prop.scale ?? 1);
      if (area > best) {
        best = area;
        key = { x: prop.x, y: prop.y - (h * (prop.scale ?? 1)) / 2 };
      }
    }
  }
  const lampMax = lamps.reduce((m, l) => Math.max(m, l.a), 0);
  return {
    key: day > 0.12 ? key : null,
    direct: key ? 0.5 * day : 0,
    length: 0.45,
    contact: 0.12,
    lamps,
    rim: lampMax > day ? '#ffc874' : '#fff1d6',
    rimStrength: Math.max(lampMax * 0.4, key ? day * 0.22 : 0),
  };
}

/** The light that matters most at a stage position: a nearby lit lamp, or the key light. */
export function lightAt(rig: LightRig, x: number, y: number): { x: number; y: number; strength: number } | null {
  let best: { x: number; y: number; strength: number } | null = rig.key ? { ...rig.key, strength: rig.direct } : null;
  for (const lamp of rig.lamps) {
    const d = Math.hypot(lamp.x - x, (lamp.floorY - y) * 2);
    const strength = 0.6 * lamp.a * clamp01(1 - d / 420);
    if (!best || strength > best.strength) {
      best = { x: lamp.x, y: lamp.y, strength };
    }
  }
  return best && best.strength > 0.02 ? best : null;
}

/**
 * A soft contact shadow plus a cast shadow that leans away from the light and stretches when the
 * sun is low. Coordinates are the prop's local ones; env.anchor says where the prop is on stage.
 */
export function castShadow(c: SkCanvas, env: Env, x: number, y: number, rx: number, ry: number, height = 40, strength = 1): void {
  const rig = env.light;
  const contact = (rig?.contact ?? 0.12) * strength;
  ellipse(c, x, y, rx * 1.12, ry * 1.25, '#000000', contact * 0.45);
  ellipse(c, x, y, rx * 0.86, ry * 0.85, '#000000', contact * 0.65);
  if (!rig) {
    return;
  }
  const wx = (env.anchor?.x ?? 0) + x;
  const wy = (env.anchor?.y ?? 0) + y;
  const light = lightAt(rig, wx, wy);
  if (!light) {
    return;
  }
  const lampish = rig.lamps.some((l) => l.x === light.x && l.y === light.y);
  const dir = Math.max(-1, Math.min(1, (wx - light.x) / 170));
  const len = height * (lampish ? 0.7 : rig.length);
  const dx = dir * len * 0.6;
  const dy = len * 0.12;
  ellipse(c, x + dx * 0.55, y + dy * 0.5, rx + Math.abs(dx) * 0.55, ry + dy * 0.55, '#1b1630', 0.16 * light.strength * strength);
}

/**
 * Sunlight through each window onto the floor: one bright quad per pane, slanting with the hour and
 * stretching when the sun is low. Untinted, screen-blended, under the props and pets.
 */
export function drawWindowLight(c: SkCanvas, scene: Scene, env: Env): void {
  if (scene.time !== 'indoor') {
    return;
  }
  const weather = weatherOf(env);
  const u = sunFraction(env);
  if (u < 0 || u > 1) {
    return;
  }
  const strength = (1 - env.tod.dark) * (1 - weather.overcast * 0.85) * clamp01(Math.sin(Math.PI * u) * 3);
  if (strength < 0.03) {
    return;
  }
  const H = scene.floor.horizon;
  const sunX = stageWidth * (0.12 + 0.76 * u);
  const reach = 0.3 + 0.5 * (1 - Math.sin(Math.PI * u));
  untinted(() => {
    for (const prop of scene.props) {
      if (prop.kind !== 'window') {
        continue;
      }
      const s = prop.scale ?? 1;
      const { w, h } = windowDims(prop);
      const left = prop.x - (w * s) / 2;
      const top = prop.y - h * s;
      const sill = prop.y;
      if (sill >= H) {
        continue;
      }
      const lean = Math.max(-1.2, Math.min(1.2, (prop.x - sunX) / 160)) * 0.85;
      const toFloor = (wx: number, wy: number): [number, number] => {
        const fy = Math.min(stageHeight, H + (H - wy) * reach);
        return [wx + lean * (fy - H), fy];
      };
      const gap = 3 * s;
      const panes = [
        [left, top, prop.x - gap, prop.y - (h * s) / 2 - gap],
        [prop.x + gap, top, left + w * s, prop.y - (h * s) / 2 - gap],
        [left, prop.y - (h * s) / 2 + gap, prop.x - gap, sill],
        [prop.x + gap, prop.y - (h * s) / 2 + gap, left + w * s, sill],
      ];
      // A faint beam from the glass to the floor, then the bright patches.
      const far = toFloor(left, top);
      const farR = toFloor(left + w * s, top);
      c.drawPath(polyPath([left, top, left + w * s, top, farR[0], farR[1], far[0], far[1]]), fill('#fff4d6', 0.05 * strength, BlendMode.Screen));
      for (const [x0, y0, x1, y1] of panes) {
        const a = toFloor(x0, y1);
        const b = toFloor(x1, y1);
        const cc = toFloor(x1, y0);
        const d = toFloor(x0, y0);
        c.drawPath(polyPath([a[0], a[1], b[0], b[1], cc[0], cc[1], d[0], d[1]]), fill('#ffe9b8', 0.26 * strength, BlendMode.Screen));
      }
      if (!env.reduced) {
        // Dust drifting in the beam.
        for (let i = 0; i < 9; i += 1) {
          const k = (hash(i, Math.round(prop.x)) + env.t * 0.02 * (0.5 + hash(i, 3))) % 1;
          const side = hash(i, 9);
          const bx = left + side * w * s + lean * (far[1] - H) * k;
          const by = top + (far[1] - top) * k + Math.sin(env.t * 0.7 + i) * 3;
          glow(c, bx, by, 2.2, '#fff6dc', 0.5 * strength * Math.sin(Math.PI * k));
        }
      }
    }
  });
}

/** Warm pools of lamp light on the floor, under the props and pets. */
export function drawLampPools(c: SkCanvas, rig: LightRig): void {
  for (const lamp of rig.lamps) {
    const s = lamp.r / 84;
    glowOval(c, lamp.x, lamp.floorY + 2, 130 * s, 36 * s, '#ffcb7a', 0.32 * lamp.a);
  }
}

function channel(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** A radial pool: solid color at the center, clear at the rim. No hard edge. */
export function drawSoftPool(c: SkCanvas, x: number, y: number, r: number, hex: string, a: number): void {
  if (a <= 0.003 || r <= 0) {
    return;
  }
  const [red, green, blue] = channel(hex);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setShader(
    Skia.Shader.MakeRadialGradient(
      Skia.Point(x, y),
      r,
      [Skia.Color(`rgba(${red},${green},${blue},${a})`), Skia.Color(`rgba(${red},${green},${blue},0)`)],
      null,
      TileMode.Clamp,
    ),
  );
  c.drawCircle(x, y, r, paint);
}

function drawSoftOval(c: SkCanvas, x: number, y: number, rx: number, ry: number, hex: string, a: number): void {
  if (a <= 0.003 || rx <= 0 || ry <= 0) {
    return;
  }
  c.save();
  c.translate(x, y);
  c.scale(1, ry / rx);
  drawSoftPool(c, 0, 0, rx, hex, a);
  c.restore();
}

/** Light navy veil over an indoor room. The pet is drawn after this, so he stays untinted. */
export function drawNightVeil(c: SkCanvas, bleed: number, dark: number): void {
  const alpha = indoorOverlayAlpha(dark);
  if (alpha <= 0.001) {
    return;
  }
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(`rgba(27,35,80,${alpha})`));
  c.drawRect(Skia.XYWHRect(-bleed, 0, stageWidth + bleed * 2, stageHeight), paint);
}

/** Indoor lamp and pumpkin glows, drawn after the navy veil. */
export function drawCozyPools(c: SkCanvas, rig: LightRig, glows: { x: number; y: number; r: number; a: number }[]): void {
  const { warm, warmAlpha, radiusScale } = lighting.cozyNight;
  for (const lamp of rig.lamps) {
    const s = (lamp.r / 84) * radiusScale;
    drawSoftOval(c, lamp.x, lamp.floorY + 2, 130 * s, 36 * s, warm, warmAlpha * lamp.a);
  }
  for (const glow of glows) {
    drawSoftPool(c, glow.x, glow.y, glow.r * radiusScale, warm, warmAlpha * Math.min(1, glow.a));
  }
}

/** Cool moonlight from each window onto the floor in front of it. */
export function drawMoonPools(c: SkCanvas, scene: Scene, amount: number): void {
  if (amount < 0.02) {
    return;
  }
  const { moon, moonAlpha, radiusScale } = lighting.cozyNight;
  for (const prop of scene.props) {
    if (prop.kind !== 'window') {
      continue;
    }
    const s = prop.scale ?? 1;
    drawSoftPool(c, prop.x, prop.y + 48 * s, 200 * radiusScale * s, moon, moonAlpha * amount);
  }
}

/**
 * Light the pet layer: the scene tint over the pet, then a rim of warm (or moon-cool) light on the
 * side facing the nearest light. Called inside the pet's own layer, with SrcATop so only the pet
 * is touched.
 */
export function shadeActorLayer(
  c: SkCanvas,
  env: Env,
  actor: { x: number; y: number },
  tint: { r: number; g: number; b: number; a: number },
  bounds: { x: number; y: number; w: number; h: number },
): void {
  const rect = Skia.XYWHRect(bounds.x, bounds.y, bounds.w, bounds.h);
  if (tint.a > 0.001) {
    const p = Skia.Paint();
    p.setColor(Float32Array.of(tint.r / 255, tint.g / 255, tint.b / 255, tint.a));
    p.setBlendMode(BlendMode.SrcATop);
    c.drawRect(rect, p);
  }
  const rig = env.light;
  if (!rig || rig.rimStrength < 0.03) {
    return;
  }
  const light = lightAt(rig, actor.x, actor.y);
  if (!light) {
    return;
  }
  const dir = Math.sign(light.x - actor.x) || 1;
  const cx = actor.x;
  const reach = bounds.w * 0.5;
  const color = rig.rim;
  const p = Skia.Paint();
  const col = Skia.Color(color);
  const clearCol = Float32Array.of(col[0], col[1], col[2], 0);
  const strongCol = Float32Array.of(col[0], col[1], col[2], Math.min(0.55, rig.rimStrength * (0.6 + light.strength)));
  p.setShader(
    Skia.Shader.MakeLinearGradient(Skia.Point(cx + dir * reach, actor.y), Skia.Point(cx - dir * reach * 0.1, actor.y), [strongCol, clearCol], null, TileMode.Clamp),
  );
  p.setBlendMode(BlendMode.SrcATop);
  c.drawRect(rect, p);
}
