import { Skia } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import type { Prop } from '../../actor/scenes';
import type { Env } from './env';
import { snowOn, weatherOf } from './env';
import { cachedPath, circle, clamp01, ellipse, fill, glowOval, hash, line, mixc, poly, rect, rrect, stroke } from './ink';
import { drawPropBody, pawPrint, registerProp } from './props';
import { drawSkyPane } from './sky';
import { drawPrecip } from './weatherFx';

// The Stadium header: a small outdoor scene on the shared sky, weather, and time of day.
// Props draw in local coordinates with their base at (0, 0), like every other registered prop.

export const STADIUM_STAGE = { w: 390, h: 220, ground: 198 } as const;

const pastel = ['#FFC8DA', '#C3F0D7', '#C2E0FF', '#FFEBA6', '#DBCDFF', '#FFD5B5', '#BAEFED'];

function nightOf(env: Env): number {
  return clamp01((env.tod.dark - 0.3) * 1.4);
}

function shade(env: Env, color: string): string {
  return mixc(color, '#1c2233', nightOf(env) * 0.55);
}

function motionT(env: Env): number {
  return env.reduced ? 0 : env.t;
}

// Signed wind, -1 to 1. Calm still moves a little.
function breeze(env: Env): number {
  const wind = env.wind ?? weatherOf(env).wind;
  return Math.max(0.15, Math.min(1, Math.abs(wind)));
}

function lampsOn(env: Env): boolean {
  return env.tod.dark > 0.22;
}

registerProp('stadiumStands', (c, prop, env) => {
  const w = prop.w ?? 320;
  const h = prop.h ?? 56;
  const body = cachedPath(`stands:${w}:${h}`, (p) => {
    p.moveTo(-w / 2, 0);
    p.lineTo(-w / 2 + 12, -h + 14);
    p.quadTo(0, -h - 14, w / 2 - 12, -h + 14);
    p.lineTo(w / 2, 0);
    p.close();
  });
  c.drawPath(body, fill(shade(env, '#D4C2FF')));
  for (let row = 1; row <= 3; row += 1) {
    const y = -h + 14 + row * 10;
    line(c, -w / 2 + 12 + row * 3, y, w / 2 - 12 - row * 3, y, shade(env, '#BCA6F2'), 2);
  }
  c.drawPath(body, stroke(shade(env, '#9F86E0'), 2.5));
  const snow = snowOn(env);
  if (snow > 0.05) {
    const cap = cachedPath(`standsCap:${w}:${h}`, (p) => {
      p.moveTo(-w / 2 + 12, -h + 14);
      p.quadTo(0, -h - 14, w / 2 - 12, -h + 14);
    });
    c.drawPath(cap, stroke('#FFFFFF', 4 * snow + 1, 0.95));
  }
});

registerProp('crowd', (c, prop, env) => {
  const w = prop.w ?? 280;
  const t = motionT(env);
  const count = Math.floor(w / 13);
  // Every 20 to 30 seconds a wave ripples left to right.
  const cycle = 25;
  const lap = Math.floor(t / cycle);
  const waveStart = hash(lap, 31) * 5;
  const into = t - lap * cycle - waveStart;
  const waveX = into >= 0 && into < 2.4 ? -w / 2 + (into / 2.4) * (w + 40) - 20 : null;
  for (let row = 0; row < 2; row += 1) {
    for (let i = 0; i < count - row; i += 1) {
      const seed = i * 7 + row * 101;
      const x = -w / 2 + 8 + i * 13 + row * 6.5;
      const period = 0.8 + hash(seed, 3) * 0.8;
      const amp = 1 + hash(seed, 5) * 2;
      let bob = Math.sin((t / period) * Math.PI * 2 + hash(seed, 7) * 6.28) * amp;
      const sway = Math.sin(t * 0.35 + hash(seed, 9) * 6.28) > 0.93 ? Math.sin(t * 6 + seed) * 1.5 : 0;
      if (waveX != null) {
        bob -= Math.max(0, 1 - Math.abs(x - waveX) / 22) * 6;
      }
      const y = -6 - row * 9 + bob;
      const color = shade(env, pastel[Math.floor(hash(seed, 11) * pastel.length)]);
      const cat = hash(seed, 13) > 0.5;
      if (cat) {
        poly(c, [x + sway - 5, y - 2, x + sway - 3, y - 9, x + sway - 0.5, y - 4], color);
        poly(c, [x + sway + 5, y - 2, x + sway + 3, y - 9, x + sway + 0.5, y - 4], color);
      } else {
        ellipse(c, x + sway - 5, y - 1, 2.2, 4, shade(env, '#C7A27E'));
        ellipse(c, x + sway + 5, y - 1, 2.2, 4, shade(env, '#C7A27E'));
      }
      circle(c, x + sway, y, 5.5, color);
      circle(c, x + sway - 1.8, y - 0.5, 0.8, shade(env, '#4A3560'));
      circle(c, x + sway + 1.8, y - 0.5, 0.8, shade(env, '#4A3560'));
      if (row === 0 && hash(seed, 17) > 0.82) {
        const wig = Math.sin(t * 5 + seed) * 2;
        line(c, x + sway + 6, y + 2, x + sway + 8, y - 12, shade(env, '#9F86E0'), 1);
        poly(c, [x + sway + 8, y - 12, x + sway + 15 + wig, y - 10, x + sway + 8, y - 7], shade(env, '#FF7BA5'));
      }
    }
  }
});

registerProp('pennant', (c, prop, env) => {
  const h = prop.h ?? 40;
  const len = prop.w ?? 22;
  const t = motionT(env);
  const wind = breeze(env);
  const phase = hash(Math.round(prop.x), 19) * 6.28;
  const flap = Math.sin(t * (2 + wind * 5) + phase) * (1.5 + wind * 4);
  line(c, 0, 0, 0, -h, shade(env, '#9F86E0'), 2);
  circle(c, 0, -h - 1.5, 2, shade(env, '#FFE08A'));
  poly(c, [0, -h, len, -h + 6 + flap, 0, -h + 13], shade(env, prop.color ?? '#FF7BA5'));
  if (snowOn(env) > 0.3) {
    circle(c, 0, -h - 3, 2.5, '#FFFFFF', 0.95);
  }
});

registerProp('bunting', (c, prop, env) => {
  const w = prop.w ?? 280;
  const sag = 9;
  const t = motionT(env);
  const wind = breeze(env);
  const cord = cachedPath(`bunting:${w}`, (p) => {
    p.moveTo(-w / 2, 0);
    p.quadTo(0, sag * 2, w / 2, 0);
  });
  c.drawPath(cord, stroke(shade(env, '#9F86E0'), 1.2));
  const flags = Math.floor(w / 15);
  for (let i = 0; i < flags; i += 1) {
    const u = (i + 0.5) / flags;
    const x = -w / 2 + u * w;
    const y = 4 * sag * u * (1 - u) * 0.5 * 2;
    const flap = Math.sin(t * (2.4 + wind * 4) + i * 0.9) * (0.6 + wind * 2.4);
    poly(c, [x - 5, y, x + 5, y, x + flap, y + 10], shade(env, pastel[i % pastel.length]));
  }
});

registerProp('stadiumFacade', (c, prop, env) => {
  const w = prop.w ?? 300;
  const h = prop.h ?? 72;
  const body = cachedPath(`facade:${w}:${h}`, (p) => {
    p.moveTo(-w / 2, 0);
    p.lineTo(-w / 2, -h + 10);
    p.quadTo(0, -h - 8, w / 2, -h + 10);
    p.lineTo(w / 2, 0);
    p.close();
  });
  c.drawPath(body, fill(shade(env, '#FF9EC4')));
  const stripe = cachedPath(`facadeStripe:${w}:${h}`, (p) => {
    p.moveTo(-w / 2, -h + 10);
    p.quadTo(0, -h - 8, w / 2, -h + 10);
  });
  c.drawPath(stripe, stroke(shade(env, '#FFD3E3'), 9));
  const lit = lampsOn(env);
  for (let i = -3; i <= 3; i += 1) {
    if (i === 0) {
      continue;
    }
    const x = i * 38;
    const glass = lit ? '#FFE9A8' : '#FFF1F7';
    rrect(c, x - 9, -h + 24, 18, 26, 9, shade(env, glass));
    rect(c, x - 9, -h + 38, 18, 12, shade(env, glass));
    line(c, x, -h + 26, x, -h + 50, shade(env, '#E98DAE'), 1.2);
  }
  rrect(c, -24, -50, 48, 50, 22, shade(env, '#8A5A9E'));
  rect(c, -24, -26, 48, 26, shade(env, '#8A5A9E'));
  for (let bx = -16; bx <= 16; bx += 8) {
    line(c, bx, -44, bx, 0, shade(env, '#F2DBFF'), 2);
  }
  pawPrint(c, 0, -60, 6, shade(env, '#EE5A8E'));
  c.drawPath(body, stroke(shade(env, '#D9709B'), 2.5));
  const snow = snowOn(env);
  if (snow > 0.05) {
    c.drawPath(stripe, stroke('#FFFFFF', 3 + snow * 4, 0.95));
  }
});

registerProp('scoreboard', (c, prop, env) => {
  const w = prop.w ?? 124;
  const h = prop.h ?? 46;
  const posts = 18;
  line(c, -w / 3, 0, -w / 3, -posts, shade(env, '#9F86E0'), 4);
  line(c, w / 3, 0, w / 3, -posts, shade(env, '#9F86E0'), 4);
  rrect(c, -w / 2, -posts - h, w, h, 9, shade(env, '#5B4A7A'));
  rrect(c, -w / 2 + 5, -posts - h + 5, w - 10, h - 10, 6, '#2E2440');
  for (let i = 0; i < 6; i += 1) {
    circle(c, -w / 2 + 12 + i * ((w - 24) / 5), -posts - h + 2, 1.6, lampsOn(env) ? '#FFE08A' : shade(env, '#DBCDFF'));
  }
  if (snowOn(env) > 0.05) {
    rrect(c, -w / 2 + 2, -posts - h - 3, w - 4, 4 + snowOn(env) * 3, 2, '#FFFFFF', 0.95);
  }
});

registerProp('lightTower', (c, prop, env) => {
  const h = prop.h ?? 140;
  const t = motionT(env);
  const on = lampsOn(env);
  rect(c, -3, -h, 6, h, shade(env, '#B9A9D6'));
  for (let y = -h + 20; y < -10; y += 22) {
    line(c, -3, y, 3, y + 11, shade(env, '#9F86E0'), 1);
  }
  if (on) {
    const sweep = Math.sin(t * 0.5 + (prop.flip ? 1.7 : 0)) * 5;
    c.save();
    c.translate(0, -h - 6);
    c.rotate((prop.flip ? -20 : 20) + sweep, 0, 0);
    poly(c, [-8, 0, 8, 0, 34, 150, -34, 150], '#FFF6C8', 0.16 * clamp01(env.tod.dark * 1.5));
    c.restore();
    glowOval(c, 0, -h - 6, 26, 16, '#FFF2B0', 0.5 * clamp01(env.tod.dark * 1.5));
  }
  rrect(c, -15, -h - 13, 30, 14, 4, shade(env, '#EDE6FA'));
  for (let i = -1; i <= 1; i += 1) {
    circle(c, i * 8, -h - 6, 3, on ? '#FFE08A' : shade(env, '#CFC5E3'));
  }
  if (snowOn(env) > 0.05) {
    rrect(c, -15, -h - 16, 30, 4, 2, '#FFFFFF', 0.95);
  }
});

registerProp('ribbonBanner', (c, prop, env) => {
  const w = prop.w ?? 150;
  const h = prop.h ?? 26;
  const tail = shade(env, '#A28AE3');
  poly(c, [-w / 2 + 6, -h + 6, -w / 2 - 18, -h + 6, -w / 2 - 10, -h / 2 + 3, -w / 2 - 18, 0, -w / 2 + 6, 0], tail);
  poly(c, [w / 2 - 6, -h + 6, w / 2 + 18, -h + 6, w / 2 + 10, -h / 2 + 3, w / 2 + 18, 0, w / 2 - 6, 0], tail);
  rrect(c, -w / 2, -h, w, h, 8, shade(env, '#C9B6FA'));
  rrect(c, -w / 2 + 4, -h + 3, w - 8, 7, 4, '#FFFFFF', 0.35);
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(-w / 2, -h, w, h), 8, 8), stroke(shade(env, '#7853E6'), 1.5));
});

const W = STADIUM_STAGE.w;
const G = STADIUM_STAGE.ground;

export const stadiumProps: Prop[] = [
  { kind: 'lightTower', x: 30, y: G, h: 150 },
  { kind: 'lightTower', x: W - 30, y: G, h: 150, flip: true },
  { kind: 'stadiumStands', x: W / 2, y: 140, w: 320, h: 56 },
  { kind: 'crowd', x: W / 2, y: 104, w: 270 },
  { kind: 'pennant', x: 70, y: 112, h: 40, color: '#FF7BA5' },
  { kind: 'pennant', x: W - 70, y: 112, h: 40, color: '#7FD8A8' },
  { kind: 'scoreboard', x: W / 2, y: 96, w: 124, h: 46 },
  { kind: 'stadiumFacade', x: W / 2, y: G, w: 300, h: 72 },
  { kind: 'bunting', x: W / 2, y: 134, w: 268 },
  { kind: 'ribbonBanner', x: W / 2, y: 30, w: 150, h: 26 },
];

/** Where the live text sits over the art, in stage units. */
export const stadiumLabels = {
  scoreboard: { x: W / 2 - 57, y: 96 - 18 - 41, w: 114, h: 36 },
  title: { x: W / 2 - 75, y: 30 - 26, w: 150, h: 26 },
} as const;

/** `top` is extra sky above the stage, in pixels, for the status bar. */
export function drawStadiumHeader(c: SkCanvas, width: number, top: number, env: Env): void {
  const k = width / W;
  const lift = top / k;
  c.save();
  c.scale(k, k);
  drawSkyPane(c, 0, 0, W, STADIUM_STAGE.h + lift, env);
  c.translate(0, lift);
  const snow = snowOn(env);
  const grass = mixc(shade(env, '#A8DE93'), '#F4F8FF', snow * 0.8);
  rect(c, 0, G - 4, W, STADIUM_STAGE.h - G + 4, grass);
  rect(c, 0, G - 4, W, 3, shade(env, '#8CCB78'), 1 - snow * 0.7);
  for (const prop of stadiumProps) {
    c.save();
    c.translate(prop.x, prop.y);
    drawPropBody(c, prop, env);
    c.restore();
  }
  const wet = weatherOf(env).wetness;
  if (wet > 0.05) {
    rect(c, 0, G - 4, W, 6, '#FFFFFF', wet * 0.18);
  }
  drawPrecip(c, 0, -lift, W, STADIUM_STAGE.h + lift, env);
  c.restore();
}
