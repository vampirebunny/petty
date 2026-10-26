import { ClipOp, Skia, StrokeCap } from '@shopify/react-native-skia';
import type { SkCanvas, SkPaint, SkPath } from '@shopify/react-native-skia';

import { ANCHOR, SCALE } from '../../actor/conservatory';
import type { Prop } from '../../actor/scenes';
import { fill, linear, linearStroke, stroke } from './ink';

export type HousePart = 'back' | 'front' | 'full';

export type HouseDraw = {
  detail: boolean;
  night: number;
};

const day: HouseDraw = { detail: false, night: 0 };

const CANOPY = 'M20 98 C80 60 320 60 380 98 L380 106 L20 106 Z';
const VALANCE = `M20 104 L380 104 L380 106${' a12.857 12.857 0 0 1 -25.714 0'.repeat(14)} Z`;

const GOLD = ['#FFE08A', '#E3A324'];
const CREAM = '#FFFCF6';
const FRAME = '#E7C9AA';

const paths = new Map<string, SkPath>();

function svgPath(d: string): SkPath {
  const hit = paths.get(d);
  if (hit) {
    return hit;
  }
  const path = Skia.Path.MakeFromSVGString(d) ?? Skia.Path.Make();
  paths.set(d, path);
  return path;
}

function drawPath(c: SkCanvas, d: string, paint: SkPaint): void {
  c.drawPath(svgPath(d), paint);
}

function oval(c: SkCanvas, cx: number, cy: number, rx: number, ry: number, paint: SkPaint): void {
  c.drawOval(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2), paint);
}

function roundRect(c: SkCanvas, x: number, y: number, w: number, h: number, r: number, paint: SkPaint): void {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r), paint);
}

function ramp(y0: number, y1: number, colors: string[]): SkPaint {
  return linear(0, y0, 0, y1, colors);
}

function gold(width: number): SkPaint {
  return linearStroke(0, 60, 0, 240, GOLD, null, width, 1, StrokeCap.Round);
}

function enter(c: SkCanvas, prop: Prop): void {
  c.translate(prop.x, prop.y);
  c.scale(prop.flip ? -SCALE : SCALE, SCALE);
  c.translate(-ANCHOR.x, -ANCHOR.y);
}

function stripes(c: SkCanvas): void {
  const canopy = svgPath(CANOPY);
  const bounds = canopy.getBounds();
  c.save();
  c.clipPath(canopy, ClipOp.Intersect, true);
  const x0 = Math.floor(bounds.x / 12) * 12;
  let band = 0;
  for (let x = x0; x < bounds.x + bounds.width + 12; x += 12) {
    c.drawRect(Skia.XYWHRect(x, bounds.y - 2, 12, bounds.height + 4), fill(band % 2 === 0 ? '#F7A6CC' : '#FFF4EA'));
    band += 1;
  }
  c.restore();
  drawPath(
    c,
    CANOPY,
    linear(0, 60, 0, 106, ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)', 'rgba(194,83,127,0.2)'], [0, 0.55, 1]),
  );
}

function drawBack(c: SkCanvas, opts: HouseDraw): void {
  oval(c, 200, 246, 190, 10, fill('#EBB9D1', 0.55));
  c.drawRect(Skia.XYWHRect(52, 90, 296, 112), ramp(90, 202, ['#E6FAF0', '#BDEBD5']));
  c.drawRect(Skia.XYWHRect(52, 154, 296, 48), ramp(154, 202, ['#A8E3C7', '#7FD0AB']));
  drawPath(c, 'M52 154 L348 154', gold(3));
  if (opts.detail) {
    drawPath(c, 'M90 160 L90 198 M130 160 L130 198 M270 160 L270 198 M310 160 L310 198', stroke('#6FC39C', 2));
  }
  c.drawRect(Skia.XYWHRect(36, 196, 328, 20), ramp(196, 216, ['#F7D9B6', '#EBC197']));
  if (opts.detail) {
    drawPath(c, 'M60 206 L340 206', stroke('#E2B488', 1.5));
  }
  roundRect(c, 104, 164, 192, 24, 12, ramp(164, 188, ['#F3EAFF', '#CDB5F2']));
  drawPath(c, 'M118 170 Q200 164 282 170', stroke('#FFFFFF', 4, 0.6));
  roundRect(c, 94, 180, 212, 30, 15, ramp(180, 210, ['#E9DAFF', '#B597EC']));
  roundRect(c, 94, 180, 212, 30, 15, gold(2.5));
  drawPath(c, 'M112 188 Q200 182 288 188', stroke('#FFFFFF', 4, 0.55));
}

function curtain(c: SkCanvas, body: string, fold: string): void {
  drawPath(c, body, linear(52, 100, 348, 100, ['#F48BBE', '#FFC4E1']));
  drawPath(c, fold, stroke('#FFFFFF', 3, 0.5));
}

function post(c: SkCanvas, x: number, highlight: number): void {
  roundRect(c, x, 92, 16, 124, 6, fill(CREAM));
  roundRect(c, x, 92, 16, 124, 6, stroke(FRAME, 2));
  drawPath(c, `M${highlight} 100 L${highlight} 208`, stroke('#FFFFFF', 3, 0.8));
}

function drawFront(c: SkCanvas, opts: HouseDraw): void {
  const night = Math.max(0, Math.min(1, opts.night));
  roundRect(c, 28, 214, 344, 20, 6, ramp(214, 234, ['#F2C18F', '#D99A5E']));
  drawPath(c, 'M40 219 L360 219', stroke('#FFFFFF', 2.5, 0.5));
  roundRect(c, 148, 232, 104, 10, 4, ramp(232, 242, ['#F2C18F', '#D99A5E']));
  drawPath(c, 'M156 235 L244 235', stroke('#FFFFFF', 2, 0.5));
  curtain(c, 'M56 100 Q66 132 74 158 Q64 178 60 210 L52 210 L52 100 Z', 'M58 108 Q64 132 68 152');
  curtain(c, 'M344 100 Q334 132 326 158 Q336 178 340 210 L348 210 L348 100 Z', 'M342 108 Q336 132 332 152');
  if (opts.detail) {
    oval(c, 62, 160, 9, 4, ramp(156, 164, GOLD));
    oval(c, 338, 160, 9, 4, ramp(156, 164, GOLD));
  }
  post(c, 38, 44);
  post(c, 346, 352);
  roundRect(c, 34, 206, 24, 10, 4, ramp(206, 216, GOLD));
  roundRect(c, 342, 206, 24, 10, 4, ramp(206, 216, GOLD));
  stripes(c);
  drawPath(c, 'M20 98 C80 60 320 60 380 98', stroke('#E27FAD', 4));
  drawPath(c, 'M44 90 C110 66 290 66 356 90', stroke('#FFFFFF', 3, 0.5));
  drawPath(c, VALANCE, ramp(104, 119, ['#FFC4E1', '#F48BBE']));
  drawPath(c, 'M20 104 L380 104', gold(3.5));
  oval(c, 20, 101, 5, 5, ramp(96, 106, GOLD));
  oval(c, 380, 101, 5, 5, ramp(96, 106, GOLD));
  drawPath(c, 'M40 122 Q120 138 200 122 Q280 138 360 122', stroke('#D9A23A', 1.5));
  const glowA = 0.45 + night * 0.35;
  const glowR = 7 + night * 2;
  for (const [x, y] of [
    [60, 125.5],
    [100, 129.5],
    [140, 129.5],
    [180, 125.5],
    [220, 125.5],
    [260, 129.5],
    [300, 129.5],
    [340, 125.5],
  ] as const) {
    oval(c, x, y, glowR, glowR, fill('#FFE7A8', glowA));
    oval(c, x, y, 3.5, 3.5, fill('#FFE08A'));
  }
  oval(c, 200, 82, 13, 13, ramp(69, 95, GOLD));
  oval(c, 200, 82, 13, 13, stroke('#D9961A', 1.5));
  oval(c, 200, 85, 4.6, 3.8, fill('#B8770F'));
  for (const [x, y] of [
    [194.5, 79.5],
    [198, 76.5],
    [202, 76.5],
    [205.5, 79.5],
  ] as const) {
    oval(c, x, y, 2, 2, fill('#B8770F'));
  }
}

function paintParts(c: SkCanvas, part: HousePart, opts: HouseDraw): void {
  if (part !== 'front') {
    drawBack(c, opts);
  }
  if (part !== 'back') {
    drawFront(c, opts);
  }
}

export function paintConservatory(c: SkCanvas, part: HousePart = 'full', opts: HouseDraw = day): void {
  c.save();
  c.scale(SCALE, SCALE);
  c.translate(-ANCHOR.x, -ANCHOR.y);
  paintParts(c, part, opts);
  c.restore();
}

export function drawConservatory(c: SkCanvas, prop: Prop, part: HousePart = 'full', opts: HouseDraw = day): void {
  c.save();
  enter(c, prop);
  paintParts(c, part, opts);
  c.restore();
}
