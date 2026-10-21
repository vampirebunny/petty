import { ClipOp, Skia } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import type { Env } from './env';
import { snowOn, weatherOf } from './env';
import { clamp01, darken, fill, glow, hash, lighten, mixc, poly, rect } from './ink';
import { drawTree, foliageOf, grassTone } from './nature';
import { drawSkyPane, skyColors } from './sky';
import { drawPrecip } from './weatherFx';

// The view through a window: sky, rolling hills, a few neighbour houses and trees, a fence and the
// lawn. The landscape is laid out in stage coordinates, so two windows in one room show different
// parts of the same street instead of the same picture twice.

/**
 * Draw the outside view in the pane (x, y, w, h), in the window's local coordinates.
 * `worldLeft` is the stage x of the pane's left edge; `unit` is stage units per local unit.
 */
export function drawOutsideView(c: SkCanvas, x: number, y: number, w: number, h: number, env: Env, worldLeft: number, unit = 1): void {
  const f = foliageOf(env);
  const snow = snowOn(env);
  const dark = env.tod.dark;
  const [, skyBottom] = skyColors(env);
  c.save();
  c.clipRect(Skia.XYWHRect(x, y, w, h), ClipOp.Intersect, true);
  drawSkyPane(c, x, y, w, h, env);
  const toWorld = (lx: number) => worldLeft + (lx - x) * unit;
  const haze = (col: string, k: number) => mixc(col, skyBottom, k);
  const night = clamp01((dark - 0.3) * 1.4);
  const nightShade = (col: string) => mixc(col, '#1c2233', night * 0.6);

  // Far hills.
  const hillY = (lx: number, amp: number, base: number, freq: number) => {
    const wx = toWorld(lx);
    return y + h * base + Math.sin(wx / (90 * freq)) * h * amp + Math.sin(wx / (31 * freq) + 1.3) * h * amp * 0.35;
  };
  const hill = (base: number, amp: number, freq: number, color: string) => {
    const p = Skia.Path.Make();
    p.moveTo(x, y + h);
    for (let lx = x; lx <= x + w + 6; lx += 6) {
      p.lineTo(lx, hillY(lx, amp, base, freq));
    }
    p.lineTo(x + w, y + h);
    p.close();
    c.drawPath(p, fill(color));
  };
  const farGreen = snow > 0.2 ? mixc('#cdd6e3', '#ffffff', snow * 0.5) : grassTone(mixc('#86b874', '#c9a45e', f.turn * 0.6), f);
  hill(0.58, 0.05, 1.3, nightShade(haze(farGreen, 0.5)));
  hill(0.66, 0.04, 0.8, nightShade(haze(farGreen, 0.25)));

  // Neighbour houses, spaced along the street.
  const firstSlot = Math.floor(toWorld(x) / 130) - 1;
  const lastSlot = Math.floor(toWorld(x + w) / 130) + 1;
  const scale = h / 150;
  for (let slot = firstSlot; slot <= lastSlot; slot += 1) {
    if (hash(slot, 101) < 0.35) {
      continue;
    }
    const hx = x + (slot * 130 + 30 + hash(slot, 102) * 50 - worldLeft) / unit;
    const hw = (34 + hash(slot, 103) * 22) * scale;
    const hh = (22 + hash(slot, 104) * 12) * scale;
    const baseY = y + h * 0.8;
    const walls = ['#e9d7c0', '#cfe0e6', '#f0d6d6', '#dfe6cf', '#e6dcf0'];
    const wall = nightShade(haze(walls[Math.floor(hash(slot, 105) * walls.length)], 0.18));
    const roof = nightShade(haze(['#b0573f', '#5e6f86', '#7b5a48'][Math.floor(hash(slot, 106) * 3)], 0.18));
    rect(c, hx, baseY - hh, hw, hh, wall);
    poly(c, [hx - 4 * scale, baseY - hh, hx + hw / 2, baseY - hh - hh * 0.75, hx + hw + 4 * scale, baseY - hh], roof);
    if (snow > 0.05) {
      poly(c, [hx - 4 * scale, baseY - hh, hx + hw / 2, baseY - hh - hh * 0.75, hx + hw + 4 * scale, baseY - hh, hx + hw / 2, baseY - hh - hh * 0.55], '#f5f8ff', snow);
    }
    rect(c, hx + hw * 0.72, baseY - hh - hh * 0.7, 5 * scale, hh * 0.35, darken(roof, 0.2));
    // Windows light up after dark.
    const winA = clamp01((dark - 0.35) * 2.2) * (hash(slot, 107) < 0.75 ? 1 : 0.25);
    for (const wx of [0.2, 0.62]) {
      const ww = hw * 0.2;
      const lit = mixc(darken(wall, 0.35), '#ffd37a', winA);
      rect(c, hx + hw * wx, baseY - hh * 0.72, ww, ww, lit);
      if (winA > 0.05) {
        glow(c, hx + hw * wx + ww / 2, baseY - hh * 0.72 + ww / 2, ww * 2, '#ffcc66', 0.35 * winA);
      }
    }
    rect(c, hx + hw * 0.42, baseY - hh * 0.5, hw * 0.16, hh * 0.5, darken(wall, 0.3));
  }

  // Street trees.
  const firstTree = Math.floor(toWorld(x) / 95) - 1;
  const lastTree = Math.floor(toWorld(x + w) / 95) + 1;
  for (let i = firstTree; i <= lastTree; i += 1) {
    if (hash(i, 111) < 0.4) {
      continue;
    }
    const tx = x + (i * 95 + hash(i, 112) * 60 - worldLeft) / unit;
    const ts = scale * (0.32 + hash(i, 113) * 0.12);
    c.save();
    c.translate(tx, y + h * 0.84);
    c.scale(ts, ts);
    drawTree(c, env, nightShade(haze('#5f9e55', 0.1)), { seed: i, evergreen: hash(i, 114) < 0.25 });
    c.restore();
  }

  // Lawn and a low fence in front.
  const lawnTop = y + h * 0.84;
  const lawn = snow > 0.2 ? mixc('#e9eff8', '#ffffff', snow * 0.4) : grassTone('#7fbf67', f);
  rect(c, x, lawnTop, w, h - (lawnTop - y), nightShade(lawn));
  rect(c, x, lawnTop, w, 2, nightShade(darken(lawn, 0.12)));
  const fence = nightShade('#f3efe6');
  const postGap = 11 * scale;
  const offset = ((-worldLeft / unit) % postGap + postGap) % postGap;
  rect(c, x, lawnTop - 9 * scale, w, 2 * scale, darken(fence, 0.1));
  for (let px = x - postGap + offset; px < x + w; px += postGap) {
    poly(c, [px, lawnTop + 2, px, lawnTop - 11 * scale, px + 2.5 * scale, lawnTop - 14 * scale, px + 5 * scale, lawnTop - 11 * scale, px + 5 * scale, lawnTop + 2], fence);
  }
  if (snow > 0.1) {
    rect(c, x, lawnTop - 10.5 * scale, w, 1.6 * scale, '#ffffff', snow);
  }
  if (weatherOf(env).wetness > 0.3 && snow < 0.1) {
    rect(c, x, lawnTop + 2, w, h - (lawnTop - y) - 2, '#5d7f9c', 0.12 * weatherOf(env).wetness);
  }

  drawPrecip(c, x, y, w, h, env, { scale: 0.55 * scale, density: 1.6, salt: Math.round(worldLeft) });
  // The air is softer through glass.
  c.drawRect(Skia.XYWHRect(x, y, w, h), fill(lighten(skyBottom, 0.3), 0.05));
  c.restore();
}
