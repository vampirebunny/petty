import { ClipOp, Skia } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import { stars } from '../../actor';
import { moonArc } from '../../actor/sky';
import type { Env } from './env';
import { weatherOf } from './env';
import { cachedPath, circle, clamp01, css, ellipse, fill, glow, gradRect, hash, linearStroke, makePath, mixc, ov, rgba, stroke } from './ink';

export type SkyArc = {
  /** The span the sun and moon travel across (the stage for an outdoor backdrop, the pane for a window). */
  x: number;
  w: number;
};

/** Sun fraction across the day: 0 at sunrise (06:00 solar), 1 at sunset (18:00 solar). */
export function sunFraction(env: Env): number {
  return (env.tod.hour - 6) / 12;
}

/** A point on the east-to-west arc for a fraction u of the way across. */
export function arcSpot(u: number, arc: SkyArc, y: number, h: number, peak: number): { x: number; y: number } {
  const k = u < -0.1 ? -0.1 : u > 1.1 ? 1.1 : u;
  return { x: arc.x + arc.w * (0.12 + 0.76 * u), y: y + h * 0.98 - Math.sin(Math.PI * k) * h * peak };
}

/** Sky gradient colours, greyed by overcast. */
export function skyColors(env: Env): [string, string] {
  const { tod } = env;
  const over = weatherOf(env).overcast * 0.82;
  if (over < 0.01) {
    return [tod.top, tod.bot];
  }
  const greyTop = mixc('#8f99a5', '#1d2229', clamp01(tod.dark * 1.2));
  const greyBot = mixc('#b9c0c8', '#2e343c', clamp01(tod.dark * 1.2));
  return [mixc(tod.top, greyTop, over), mixc(tod.bot, greyBot, over)];
}

function drawStars(c: SkCanvas, x: number, y: number, w: number, h: number, arc: SkyArc, env: Env): void {
  const { tod, t, reduced } = env;
  const alpha = clamp01((tod.dark - 0.45) * 2) * (1 - weatherOf(env).overcast);
  if (alpha < 0.01) {
    return;
  }
  // Tile the star field by the arc width, so stars cover a wide sky but stay put over the stage.
  const first = Math.floor((x - arc.x) / arc.w);
  const last = Math.floor((x + w - arc.x) / arc.w);
  const big = arc.w > 200;
  for (let tile = first; tile <= last; tile += 1) {
    for (const star of stars) {
      const sx = arc.x + (tile + star[0]) * arc.w;
      if (sx < x - 2 || sx > x + w + 2) {
        continue;
      }
      const tw = reduced ? 0.85 : 0.55 + 0.45 * Math.sin(t * 1.6 + star[3] + tile);
      const r = Math.min(star[2], w / 40 + 0.6);
      circle(c, sx, y + star[1] * h, r, '#ffffff', clamp01(alpha * tw));
      if (big && star[2] > 1.4) {
        // The brightest stars get a soft cross glint.
        const g = r * 3.2 * tw;
        c.drawLine(sx - g, y + star[1] * h, sx + g, y + star[1] * h, stroke('#ffffff', 0.6, alpha * 0.45 * tw));
        c.drawLine(sx, y + star[1] * h - g, sx, y + star[1] * h + g, stroke('#ffffff', 0.6, alpha * 0.45 * tw));
      }
    }
  }
}

// Sun and moon size: big in the open sky, smaller in a window so they don't fill a pane.
function discSize(h: number): number {
  return h > 220 ? Math.min(22, h * 0.17) : Math.max(5, h * 0.1);
}

function drawSun(c: SkCanvas, y: number, h: number, arc: SkyArc, env: Env): void {
  const u = sunFraction(env);
  if (u < -0.12 || u > 1.12) {
    return;
  }
  const veil = 1 - weatherOf(env).overcast * 0.92;
  if (veil < 0.03) {
    return;
  }
  const r = discSize(h);
  const p = arcSpot(u, arc, y, h, 0.8);
  const high = clamp01(Math.sin(Math.PI * clamp01(u)) * 2.5);
  const color = mixc('#ff7b45', '#fff3b0', high);
  glow(c, p.x, p.y, r * 6, color, 0.22 * veil);
  glow(c, p.x, p.y, r * 2.6, mixc(color, '#ffffff', 0.4), 0.55 * veil);
  circle(c, p.x, p.y, r, color, veil);
  circle(c, p.x - r * 0.2, p.y - r * 0.2, r * 0.62, mixc(color, '#ffffff', 0.55), 0.55 * veil);
}

/** The moon with its real phase. Lit side faces right while waxing in the northern hemisphere. */
export function drawMoonDisc(c: SkCanvas, cx: number, cy: number, r: number, phase: number, alpha: number, southern = false, night = 1): void {
  if (alpha < 0.01) {
    return;
  }
  const illum = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
  glow(c, cx, cy, r * (2.4 + illum * 1.6), '#cfd6ff', 0.32 * alpha * (0.25 + illum) * night);
  c.save();
  if (southern) {
    c.translate(cx * 2, 0);
    c.scale(-1, 1);
  }
  // Earthshine: the dark part is faintly visible at night.
  circle(c, cx, cy, r, '#3d4660', alpha * 0.35 * night);
  const waxing = phase < 0.5;
  const k = Math.abs(Math.cos(phase * 2 * Math.PI));
  const lit = makePath((p) => {
    const disc = ov(cx, cy, r, r);
    const term = ov(cx, cy, Math.max(0.01, r * k), r);
    p.moveTo(cx, cy - r);
    p.arcToOval(disc, -90, waxing ? 180 : -180, false);
    const bulgesRight = waxing ? phase < 0.25 : phase < 0.75;
    p.arcToOval(term, 90, bulgesRight ? -180 : 180, false);
    p.close();
  });
  if (illum > 0.015) {
    c.drawPath(lit, fill('#f7f2dc', alpha));
    c.save();
    c.clipPath(lit, ClipOp.Intersect, true);
    circle(c, cx - r * 0.28, cy - r * 0.22, r * 0.24, '#b7b196', 0.45 * alpha);
    circle(c, cx + r * 0.3, cy + r * 0.25, r * 0.17, '#b7b196', 0.4 * alpha);
    circle(c, cx + r * 0.05, cy + r * 0.48, r * 0.11, '#b7b196', 0.35 * alpha);
    circle(c, cx + r * 0.42, cy - r * 0.35, r * 0.09, '#b7b196', 0.35 * alpha);
    c.restore();
  }
  c.restore();
}

function drawMoon(c: SkCanvas, y: number, h: number, arc: SkyArc, env: Env): void {
  const moon = env.sky?.moon;
  const phase = moon?.phase ?? 0.5;
  const u = moonArc(env.tod.hour, phase);
  if (u === null) {
    return;
  }
  // Bright at night; a pale daytime moon when it is up during the day.
  const night = clamp01(env.tod.dark * 1.6);
  const alpha = Math.max(night, 0.3) * (1 - weatherOf(env).overcast * 0.95);
  const r = discSize(h) * 0.82;
  const p = arcSpot(u, arc, y, h, 0.7);
  drawMoonDisc(c, p.x, p.y, r, phase, alpha, (env.sky?.observer.lat ?? 40) < 0, night);
}

function drawRainbow(c: SkCanvas, y: number, h: number, arc: SkyArc, env: Env): void {
  const strength = weatherOf(env).rainbow;
  if (strength < 0.01) {
    return;
  }
  const u = clamp01(sunFraction(env));
  if (env.tod.dark > 0.6) {
    return;
  }
  // A rainbow sits opposite the sun, centred below the horizon; the higher the sun, the lower the bow.
  const sunX = arc.x + arc.w * (0.12 + 0.76 * u);
  const cx = sunX > arc.x + arc.w / 2 ? arc.x + arc.w * 0.3 : arc.x + arc.w * 0.7;
  const height = Math.sin(Math.PI * u);
  const cy = y + h * (1.02 + height * 0.3);
  const R = h * 0.72;
  const band = Math.max(1.2, h * 0.02);
  const colors = ['#ff5a5a', '#ff9e42', '#ffe35a', '#6fd86a', '#4fb6ff', '#5f6dff', '#a46bff'];
  const bottom = y + h;
  const bow = (col: string, radius: number, width: number, alpha: number) => {
    // Each band fades toward the horizon, so the bow seems to rise out of the haze.
    const k = rgba(col);
    const clear = css([k[0], k[1], k[2], 0]);
    const paint = linearStroke(0, bottom, 0, cy - radius * 0.55, [clear, col, col], [0, 0.55, 1], width, alpha);
    c.drawPath(
      cachedPath(`bow|${Math.round(cx)}|${Math.round(cy)}|${Math.round(radius * 10)}`, (p) => p.addArc(ov(cx, cy, radius, radius), 180, 180)),
      paint,
    );
  };
  colors.forEach((col, i) => bow(col, R - i * band, band * 1.15, 0.42 * strength));
  // A faint secondary bow, colours reversed.
  colors.forEach((col, i) => bow(col, R * 1.28 + i * band * 0.9, band, 0.12 * strength));
}

export function cloudColor(env: Env): string {
  const { tod } = env;
  const over = weatherOf(env).overcast;
  const day = mixc('#ffffff', mixc(tod.bot, '#ffd7c2', 0.4), clamp01(tod.dark * 2.2));
  const night = '#2c3344';
  const base = mixc(day, night, clamp01((tod.dark - 0.35) * 1.8));
  return mixc(base, tod.dark > 0.5 ? '#232830' : '#9aa2ad', over * 0.75);
}

/** Puffy clouds drifting with the wind. More of them, and greyer, as the weather turns. */
export function drawClouds(c: SkCanvas, x: number, y: number, w: number, h: number, env: Env, salt = 0): void {
  const weather = weatherOf(env);
  const count = Math.round(1 + weather.clouds * 4 + weather.overcast * 7);
  if (count <= 0) {
    return;
  }
  const color = cloudColor(env);
  const shade = mixc(color, '#5d6675', 0.28 + weather.overcast * 0.2);
  const speed = env.reduced ? 0 : 0.0035 * (0.4 + Math.abs(env.wind ?? weather.wind)) * Math.sign((env.wind ?? weather.wind) || 1);
  for (let i = 0; i < count; i += 1) {
    const seed = i + salt * 31;
    const s = h * (0.07 + hash(seed, 2) * 0.07) * (1 + weather.overcast * 0.6);
    const fx = ((((hash(seed, 1) * 1.4 + env.t * speed * (0.7 + hash(seed, 4) * 0.6)) % 1.4) + 1.4) % 1.4) - 0.2;
    const cx = x + fx * w;
    const cy = y + h * (0.1 + hash(seed, 3) * 0.42);
    const a = 0.75 + weather.overcast * 0.2;
    // Shadowed underside first, then the lit puffs on top.
    ellipse(c, cx, cy + s * 0.35, s * 2.1, s * 0.55, shade, a);
    circle(c, cx - s * 1.1, cy + s * 0.1, s * 0.75, color, a);
    circle(c, cx - s * 0.2, cy - s * 0.35, s * 1.05, color, a);
    circle(c, cx + s * 0.9, cy - s * 0.05, s * 0.8, color, a);
    circle(c, cx + s * 1.6, cy + s * 0.2, s * 0.5, color, a);
    ellipse(c, cx + s * 0.2, cy + s * 0.25, s * 1.9, s * 0.45, color, a);
  }
}

/**
 * A rectangle of sky: gradient, stars, clouds, the rainbow, the sun (sunrise to sunset, east to
 * west) and the moon (wherever its phase puts it). The backdrop and every window pane use it, so
 * they always show the same sky. `arc` is the span the sun and moon cross (defaults to the pane).
 */
export function drawSkyPane(c: SkCanvas, x: number, y: number, w: number, h: number, env: Env, arc: SkyArc = { x, w }): void {
  c.save();
  c.clipRect(Skia.XYWHRect(x, y, w, h), ClipOp.Intersect, true);
  const [top, bottom] = skyColors(env);
  gradRect(c, x, y, w, h, top, bottom);
  drawStars(c, x, y, w, h, arc, env);
  drawMoon(c, y, h, arc, env);
  drawSun(c, y, h, arc, env);
  drawRainbow(c, y, h, arc, env);
  drawClouds(c, x, y, w, h, env, Math.round(arc.w));
  c.restore();
}

/** Darken an area for heavy overcast (outdoor scenes), drawn under the light effects. */
export function overcastWash(c: SkCanvas, x: number, y: number, w: number, h: number, env: Env, strength = 0.2): void {
  const over = weatherOf(env).overcast;
  if (over > 0.02) {
    c.drawRect(Skia.XYWHRect(x, y, w, h), fill('#3c4656', over * strength));
  }
}
