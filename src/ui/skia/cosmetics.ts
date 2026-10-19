import { Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import type { Geom } from '../../actor';
import type { HeadFace } from '../../actor/geometry';
import type { WearItem } from '../../actor/wardrobe';
import { clipOval, fillCircle, fillOval, fillRect, mix, oval, paintOf, polygon, strokeLine } from './draw';

type Pt = { x: number; y: number };

export function drawBoot(c: SkCanvas, knee: Pt, paw: Pt, geom: Geom, boot: WearItem, far: boolean): void {
  const base = boot.c ?? '#d64545';
  const color = far ? mix(base, '#000000', 0.3) : base;
  const x0 = knee.x + (paw.x - knee.x) * 0.5;
  const y0 = knee.y + (paw.y - knee.y) * 0.5;
  strokeLine(c, x0, y0, paw.x, paw.y, color, geom.legWidth + 4.5);
  fillOval(c, paw.x + 3.5, paw.y - 2.5, geom.pawRx + 3.5, geom.pawRy + 3.2, color);
  fillOval(c, paw.x + 3.5, paw.y + 0.6, geom.pawRx + 3.8, 2.2, mix(base, '#000000', far ? 0.55 : 0.4));
  const cuff = boot.d ?? mix(base, '#ffffff', 0.3);
  strokeLine(
    c,
    x0,
    y0,
    x0 + (paw.x - knee.x) * 0.14,
    y0 + (paw.y - knee.y) * 0.14,
    far ? mix(cuff, '#000000', 0.3) : cuff,
    geom.legWidth + 6.5,
    1,
    StrokeCap.Butt,
  );
}

// Drawn inside the torso transform, clipped to the body so it follows breathing and weight.
export function drawCoat(c: SkCanvas, geom: Geom, item: WearItem, breath: number): void {
  const color = item.c ?? '#d64545';
  c.save();
  clipOval(c, 0, geom.bodyY, geom.bodyLen / 2 + 0.5, (geom.bodyH / 2) * breath + 0.5);
  const x0 = -geom.bodyLen * 0.3;
  const x1 = geom.bodyLen * 0.46;
  const y0 = geom.bodyY - geom.bodyH;
  const y1 = geom.bodyY + geom.bodyH;
  fillRect(c, x0, y0, x1 - x0, y1 - y0, color);
  if (item.id === 'sweater') {
    for (let y = y0 + 4; y < y1; y += 9) {
      fillRect(c, x0, y, x1 - x0, 3, item.d ?? '#f4dede', 0.85);
    }
  } else if (item.id === 'rain') {
    fillRect(c, x0, geom.bodyY - 1, x1 - x0, 1.6, mix(color, '#000000', 0.22));
    for (let i = 0; i < 3; i += 1) {
      fillCircle(c, x1 - 14 - i * 11, geom.bodyY + geom.bodyH * 0.1, 2, mix(color, '#000000', 0.4));
    }
  } else if (item.id === 'vest') {
    const line = mix(color, '#ffffff', 0.3);
    for (let x = x0 + 8; x < x1; x += 11) {
      strokeLine(c, x, y0, x, y1, line, 1.4);
    }
    strokeLine(c, x0, geom.bodyY, x1, geom.bodyY, line, 1.4);
  }
  fillRect(c, x0, y0, 3.5, y1 - y0, mix(color, '#000000', 0.25));
  c.restore();
}

export function drawCollar(c: SkCanvas, at: Pt, perp: Pt, neckWidth: number, item: WearItem, swing: number): void {
  const color = item.c ?? '#d64545';
  strokeLine(
    c,
    at.x - perp.x * neckWidth * 0.5,
    at.y - perp.y * neckWidth * 0.5,
    at.x + perp.x * neckWidth * 0.5,
    at.y + perp.y * neckWidth * 0.5,
    color,
    5,
  );
  if (item.id === 'gold') {
    for (let i = -1; i <= 1; i += 1) {
      fillCircle(c, at.x + perp.x * neckWidth * 0.28 * i, at.y + perp.y * neckWidth * 0.28 * i, 1.5, '#fff3c4');
    }
  }
  const tx = at.x + perp.x * neckWidth * 0.5 + swing;
  const ty = at.y + perp.y * neckWidth * 0.5 + 5;
  fillCircle(c, tx, ty, 3.6, '#f0c94a');
  fillCircle(c, tx - 1, ty - 1, 1.1, '#ffffff', 0.7);
}

export function drawBandana(c: SkCanvas, at: Pt, perp: Pt, along: Pt, neckWidth: number, item: WearItem, flutter: number): void {
  const color = item.c ?? '#d64545';
  const a = { x: at.x - perp.x * neckWidth * 0.55 - along.x * 2, y: at.y - perp.y * neckWidth * 0.55 - along.y * 2 };
  const b = { x: at.x + perp.x * neckWidth * 0.55 - along.x * 2, y: at.y + perp.y * neckWidth * 0.55 - along.y * 2 };
  const tip = { x: at.x - 3 + flutter, y: at.y + neckWidth * 0.95 };
  const cloth = Skia.Path.Make();
  cloth.moveTo(a.x, a.y);
  cloth.lineTo(b.x, b.y);
  cloth.quadTo((b.x + tip.x) / 2 + 2, (b.y + tip.y) / 2, tip.x, tip.y);
  cloth.quadTo((a.x + tip.x) / 2 - 2, (a.y + tip.y) / 2, a.x, a.y);
  cloth.close();
  c.drawPath(cloth, paintOf(color));
  strokeLine(c, a.x, a.y, b.x, b.y, mix(color, '#000000', 0.2), 1.2);
  if (item.d) {
    for (const [u, v] of [
      [0.5, 0.3],
      [0.32, 0.5],
      [0.66, 0.5],
      [0.5, 0.7],
    ]) {
      fillCircle(
        c,
        a.x + (b.x - a.x) * u + (tip.x - (a.x + b.x) / 2) * v,
        a.y + (b.y - a.y) * u + (tip.y - (a.y + b.y) / 2) * v,
        1.5,
        item.d,
      );
    }
  }
}

function strokeSquare(c: SkCanvas, x: number, y: number, size: number, color: string, width: number, alpha: number): void {
  const paint = paintOf(color, alpha, width);
  paint.setStrokeJoin(StrokeJoin.Miter);
  c.drawRect(Skia.XYWHRect(x, y, size, size), paint);
}

// One square lens centered on an eye. `k` scales the lens, `sx` and `sy` foreshorten it, `alpha` fades it.
function drawLens(c: SkCanvas, item: WearItem, ex: number, ey: number, eyeR: number, k: number, sx: number, sy: number, alpha: number): void {
  const color = item.c ?? '#1b1b22';
  const cx = ex + eyeR * 0.1 * k * sx;
  const half = eyeR * 1.7 * k;
  const gold = item.id === 'square';
  c.save();
  c.translate(cx, ey);
  c.scale(sx, sy);
  if (gold) {
    fillRect(c, -half, -half, half * 2, half * 2, '#82beff', 0.3 * alpha);
    strokeSquare(c, -half, -half, half * 2, color, 2.4, alpha);
  } else {
    fillRect(c, -half, -half, half * 2, half * 2, color, alpha);
    strokeSquare(c, -half, -half, half * 2, '#15151b', 1.6, alpha);
    strokeLine(c, -half * 0.55, -half * 0.45, -half * 0.05, -half * 0.75, '#ffffff', 1.6, 0.45 * alpha);
  }
  c.restore();
}

// Glasses follow the head turn: one lens in side view, two lenses and a bridge at the 3/4 turn.
// The far lens fades in with the far eye, and lenses shrink to fit the gap between the eyes.
export function drawGlasses(c: SkCanvas, item: WearItem, face: HeadFace, headR: number): void {
  const color = item.c ?? '#1b1b22';
  const frame = item.id === 'square' ? color : '#15151b';
  const { eyeR, nearEye, farEye, turn } = face;
  const ex = nearEye.x;
  const ey = nearEye.y;
  // The two lenses together need about 3.3 eye radii between the eye centers. Close-set breeds (husky) get
  // smaller lenses so they never overlap, wide-set breeds (pug) keep the full size.
  const fit = Math.min(1, Math.max(0.6, face.gap3 / (3.3 * eyeR)));
  const k = 1 + (fit - 1) * turn;
  strokeLine(c, ex - eyeR * 1.7 * k, ey - eyeR * 0.1, -headR * 0.62, ey - headR * 0.06, frame, 2.2);
  if (turn < 0.999) {
    strokeLine(c, ex + eyeR * 1.8 * k, ey + eyeR * 0.05, ex + eyeR * 2.9, ey + eyeR * 0.35, frame, 2.2, 1 - turn);
  }
  drawLens(c, item, ex, ey, eyeR, k, 1, 1, 1);
  if (face.farEyeAlpha > 0.001) {
    const a = face.farEyeAlpha;
    const { x: sx, y: sy } = face.farEyeScale;
    drawLens(c, item, farEye.x, ey, eyeR, k, sx, sy, a);
    const nearEdge = ex + eyeR * (0.1 + 1.8) * k;
    const farEdge = farEye.x + eyeR * (0.1 - 1.8) * k * sx;
    strokeLine(c, nearEdge - 1, ey - eyeR * 0.1, farEdge + 1, ey - eyeR * 0.1, frame, 2.2, a);
  }
}

// Drawn in head space, so it follows pitch, sitting, barking and growth. At the 3/4 turn it shifts toward
// the front and widens a little so the far ear never pokes through.
export function drawHat(c: SkCanvas, item: WearItem, r: number, face: HeadFace): void {
  c.save();
  c.translate(face.top.x, 0);
  c.scale(1 + 0.12 * face.turn, 1);
  drawHatShape(c, item, r);
  c.restore();
}

function drawHatShape(c: SkCanvas, item: WearItem, r: number): void {
  const color = item.c ?? '#d64545';
  if (item.id === 'beanie') {
    const cap = Skia.Path.Make();
    cap.moveTo(-r * 0.98, -r * 0.3);
    cap.quadTo(-r * 1.05, -r * 1.4, -r * 0.05, -r * 1.34);
    cap.quadTo(r * 0.98, -r * 1.3, r * 0.92, -r * 0.32);
    cap.close();
    c.drawPath(cap, paintOf(color));
    strokeLine(c, -r * 0.97, -r * 0.3, r * 0.92, -r * 0.33, mix(color, '#ffffff', 0.25), r * 0.3, 1, StrokeCap.Butt);
    fillCircle(c, -r * 0.05, -r * 1.4, r * 0.2, '#f6f6f6');
  } else if (item.id === 'party') {
    c.drawPath(
      polygon([
        [-r * 0.5, -r * 0.82],
        [r * 0.4, -r * 0.82],
        [-r * 0.28, -r * 2.15],
      ]),
      paintOf(color),
    );
    strokeLine(c, -r * 0.42, -r * 1.0, r * 0.12, -r * 1.25, '#ffd34d', 2.2);
    strokeLine(c, -r * 0.3, -r * 1.35, r * 0.0, -r * 1.52, '#ffd34d', 2.2);
    fillCircle(c, -r * 0.28, -r * 2.17, r * 0.16, '#ffd34d');
  } else if (item.id === 'top') {
    c.save();
    c.rotate(-0.1 * (180 / Math.PI), 0, 0);
    fillRect(c, -r * 0.5, -r * 1.95, r * 1.0, r * 1.05, color);
    c.drawOval(oval(0, -r * 0.92, r * 0.85, r * 0.2), paintOf(color));
    fillRect(c, -r * 0.5, -r * 1.2, r * 1.0, r * 0.2, '#c0392b');
    c.restore();
  }
}
