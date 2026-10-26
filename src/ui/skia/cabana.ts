import { ClipOp, Skia, StrokeCap } from '@shopify/react-native-skia';
import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';

import { cabanaFloorY, styledBedWidth } from '../../actor/furniture';
import type { Prop } from '../../actor/scenes';
import { fill, linear, linearStroke, radial, stroke } from './ink';

const originX = 140;
const gold = ['#FFE9A6', '#F4C04A', '#D99016'];
const goldPos = [0, 0.5, 1];
const dome = 'M14 96 C38 46 242 46 266 96 Z';
const valance =
  'M14 94 L266 94 L266 100 a10.5 10.5 0 0 1 -21 0 a10.5 10.5 0 0 1 -21 0 a10.5 10.5 0 0 1 -21 0 a10.5 10.5 0 0 1 -21 0 a10.5 10.5 0 0 1 -21 0 a10.5 10.5 0 0 1 -21 0 a10.5 10.5 0 0 1 -21 0 a10.5 10.5 0 0 1 -21 0 a10.5 10.5 0 0 1 -21 0 a10.5 10.5 0 0 1 -21 0 a10.5 10.5 0 0 1 -21 0 a10.5 10.5 0 0 1 -21 0 Z';

function svgPath(c: SkCanvas, d: string, paint: SkPaint): void {
  const path = Skia.Path.MakeFromSVGString(d);
  if (path) {
    c.drawPath(path, paint);
  }
}

function roundRect(c: SkCanvas, x: number, y: number, w: number, h: number, r: number, paint: SkPaint): void {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r), paint);
}

function goldFill(y0: number, y1: number): SkPaint {
  return linear(0, y0, 0, y1, gold, goldPos);
}

function goldLine(y0: number, y1: number, width: number): SkPaint {
  return linearStroke(0, y0, 0, y1, gold, goldPos, width, 1, StrokeCap.Round);
}

function radialOval(c: SkCanvas, cx: number, cy: number, rx: number, ry: number, colors: string[]): void {
  c.save();
  c.translate(cx, cy);
  c.scale(rx, ry);
  c.drawCircle(0, 0, 1, radial(0, 0, 1, colors));
  c.restore();
}

function drawArt(c: SkCanvas): void {
  const post = linear(0, 0, 1, 0, ['#FFFFFF', '#EFDCC6']);
  c.drawOval(Skia.XYWHRect(12, 241, 256, 14), fill('#EBB9D1', 0.55));
  roundRect(c, 44, 96, 7, 110, 3.5, fill('#F7EDE2', 0.85));
  roundRect(c, 229, 96, 7, 110, 3.5, fill('#F7EDE2', 0.85));
  svgPath(c, 'M22 214 L22 228 A118 16 0 0 0 258 228 L258 214 Z', linear(0, 214, 0, 244, ['#E8B07A', '#C98652']));
  svgPath(c, 'M36 232 Q70 243 118 244', stroke('#FFFFFF', 3, 0.3));
  radialOval(c, 140, 214, 118, 18, ['#FCE6CB', '#EBC197']);
  svgPath(c, 'M22 214 A118 18 0 0 0 258 214', goldLine(200, 232, 3.5));
  roundRect(c, 27, 98, 9, 122, 4.5, post);
  roundRect(c, 244, 98, 9, 122, 4.5, post);
  roundRect(c, 24, 216, 15, 7, 3, goldFill(214, 224));
  roundRect(c, 241, 216, 15, 7, 3, goldFill(214, 224));
  svgPath(c, 'M48 202 L48 210 A92 12 0 0 0 232 210 L232 202 Z', linear(0, 200, 0, 222, ['#A98AE8', '#7656C6']));
  radialOval(c, 140, 202, 92, 14, ['#FBF7FF', '#DCCBFA', '#B79BEE']);
  svgPath(c, 'M48 202 A92 14 0 0 0 232 202', goldLine(190, 216, 2.5));
  svgPath(c, 'M70 197 Q140 188 210 197', stroke('#FFFFFF', 4, 0.6));

  const canopy = Skia.Path.MakeFromSVGString(dome);
  if (canopy) {
    c.save();
    c.clipPath(canopy, ClipOp.Intersect, true);
    for (let x = 14; x < 266; x += 20) {
      c.drawRect(Skia.XYWHRect(x, 40, 10, 70), fill(x % 40 === 14 ? '#F7A6CC' : '#FFF4EA'));
    }
    c.restore();
    c.drawPath(canopy, linear(0, 46, 0, 96, ['#FFFFFF', '#FFFFFF', '#C2537F'], [0, 0.55, 1], 0.28));
    c.drawPath(canopy, stroke('#E27FAD', 3.5));
  }
  svgPath(c, 'M40 84 C76 60 204 60 240 84', stroke('#FFFFFF', 3, 0.5));
  svgPath(c, valance, linear(0, 94, 0, 116, ['#FFC4E1', '#F48BBE']));
  svgPath(c, 'M14 95 L266 95', goldLine(90, 100, 3));
  svgPath(c, 'M22 100 Q36 104 40 100 Q42 116 36 130 Q32 120 22 116 Z', linear(0, 0, 1, 0, ['#F48BBE', '#FFC4E1']));
  svgPath(c, 'M258 100 Q244 104 240 100 Q238 116 244 130 Q248 120 258 116 Z', linear(0, 0, 1, 0, ['#FFC4E1', '#F48BBE']));
  roundRect(c, 27, 118, 10, 5, 2.5, goldFill(116, 124));
  roundRect(c, 243, 118, 10, 5, 2.5, goldFill(116, 124));
}

function place(c: SkCanvas, prop: Prop): void {
  const scale = (prop.w ?? styledBedWidth) / 280;
  c.scale(scale, scale);
  c.translate(-originX, -cabanaFloorY);
}

// Draws in the canvas's current space, with the floor anchor at the origin.
export function paintPupCabana(c: SkCanvas, prop: Prop): void {
  c.save();
  place(c, prop);
  drawArt(c);
  c.restore();
}

export function drawPupCabana(c: SkCanvas, prop: Prop): void {
  c.save();
  c.translate(prop.x, prop.y);
  paintPupCabana(c, prop);
  c.restore();
}
