import { Skia } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import { emoteAlpha, emoteScale } from '../../playdate/overlay';
import type { OverlayBurst } from '../../playdate/overlay';
import { fillCircle, fillOval, paintOf } from './draw';

function drawEmote(c: SkCanvas, burst: OverlayBurst): void {
  const emote = burst.emote;
  if (!emote) {
    return;
  }
  const alpha = emoteAlpha(burst.emoteT);
  if (alpha <= 0) {
    return;
  }
  const scale = emoteScale(burst.emoteT);
  const x = burst.x;
  const y = burst.y - 22;
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  if (emote === 'heart') {
    fillCircle(c, 0, 0, 7, '#ff6b8a', 0.9 * alpha);
  } else if (emote === 'exclaim') {
    c.drawLine(0, -12, 0, -2, paintOf('#f2c14e', alpha, 2.4));
    fillCircle(c, 0, 3, 1.8, '#f2c14e', alpha);
  } else if (emote === 'question') {
    const hook = Skia.PathBuilder.Make();
    hook.moveTo(-4, -8);
    hook.quadTo(0, -14, 4, -8);
    hook.quadTo(5, -2, 0, 0);
    c.drawPath(hook.build(), paintOf('#7eb6ff', alpha, 2));
    fillCircle(c, 0, 5, 1.6, '#7eb6ff', alpha);
  } else if (emote === 'sweat') {
    fillOval(c, 8, -2, 3.2, 5, '#8ec8f5', 0.9 * alpha);
  } else if (emote === 'sparkle') {
    const ink = paintOf('#fff4c2', alpha, 1.8);
    c.drawLine(0, -9, 0, 9, ink);
    c.drawLine(-9, 0, 9, 0, ink);
    c.drawLine(-6, -6, 6, 6, ink);
    c.drawLine(-6, 6, 6, -6, ink);
  } else if (emote === 'note') {
    fillOval(c, -2, 2, 5, 3.4, '#d98cff', alpha);
    c.drawLine(3, 2, 3, -10, paintOf('#d98cff', alpha, 1.8));
  } else {
    const ink = paintOf('#ff5a4a', alpha, 2.2);
    c.drawLine(-7, -7, 7, 7, ink);
    c.drawLine(-7, 7, 7, -7, ink);
    c.drawLine(0, -9, 0, 9, ink);
  }
  c.restore();
}

function drawParticle(c: SkCanvas, burst: OverlayBurst): void {
  for (const bit of burst.particles) {
    const fade = 1 - bit.age / Math.max(bit.life, 0.01);
    if (bit.kind === 'dust') {
      fillCircle(c, bit.x, bit.y, 3.2 * (1 + bit.age), '#d8d0c6', 0.45 * fade);
    } else if (bit.kind === 'skidmarks') {
      c.drawLine(bit.x - 7, bit.y, bit.x + 7, bit.y, paintOf('#6d645c', 0.55 * fade, 2));
    } else if (bit.kind === 'splash') {
      fillCircle(c, bit.x, bit.y, 2.4, '#7ec8f0', 0.8 * fade);
    } else {
      c.save();
      c.translate(bit.x, bit.y);
      if (bit.spin !== 0) {
        c.rotate((bit.age * bit.spin * 180) / Math.PI, 0, 0);
      }
      c.drawRect(Skia.XYWHRect(-2.2, -3.2, 4.4, 6.4), paintOf('#f2c14e', 0.9 * fade));
      c.restore();
    }
  }
}

function drawZzz(c: SkCanvas, x: number, y: number, phase: number): void {
  for (let i = 0; i < 3; i += 1) {
    const k = (phase * 0.5 + i / 3) % 1;
    const size = (10 + k * 8) * 0.55;
    const zx = x + 10 + k * 18;
    const zy = y - 6 - k * 26;
    const mark = Skia.PathBuilder.Make();
    mark.moveTo(zx, zy - size);
    mark.lineTo(zx + size, zy - size);
    mark.lineTo(zx, zy);
    mark.lineTo(zx + size, zy);
    c.drawPath(mark.build(), paintOf('#5C6B80', (1 - k) * 0.9, 1.6));
  }
}

function drawButterfly(c: SkCanvas, x: number, y: number, t: number): void {
  c.save();
  c.translate(x, y - 28);
  const flap = 0.35 + Math.abs(Math.sin(t * 12)) * 0.85;
  fillOval(c, -6, 0, 7 * flap, 4, '#7eb6ff', 0.9);
  fillOval(c, 6, 0, 7 * flap, 4, '#f2c14e', 0.9);
  fillOval(c, 0, 0, 1.3, 4.2, '#3a2a10');
  c.restore();
}

export function drawOverlay(
  c: SkCanvas,
  bursts: readonly OverlayBurst[],
  extras?: { butterfly?: { x: number; y: number } | null; zzz?: readonly { x: number; y: number; phase: number }[]; t?: number },
): void {
  for (const burst of bursts) {
    drawParticle(c, burst);
    drawEmote(c, burst);
  }
  if (extras?.butterfly) {
    drawButterfly(c, extras.butterfly.x, extras.butterfly.y, extras.t ?? 0);
  }
  for (const mark of extras?.zzz ?? []) {
    drawZzz(c, mark.x, mark.y, mark.phase);
  }
}
