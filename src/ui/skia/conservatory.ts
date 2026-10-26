import { ClipOp, FillType, Skia } from '@shopify/react-native-skia';
import type { SkCanvas, SkPath } from '@shopify/react-native-skia';

import { ANCHOR, SCALE } from '../../actor/conservatory';
import type { Prop } from '../../actor/scenes';
import { fill, linear, linearStroke, stroke } from './ink';

export type HousePart = 'back' | 'front' | 'full';

export type HouseDraw = {
  detail: boolean;
  sparkles: boolean;
  night: number;
};

const day: HouseDraw = { detail: false, sparkles: false, night: 0 };

function enter(c: SkCanvas, prop: Prop): void {
  c.translate(prop.x, prop.y);
  c.scale(prop.flip ? -SCALE : SCALE, SCALE);
  c.translate(-ANCHOR.x, -ANCHOR.y);
}

function pathOf(d: string): SkPath | null {
  return Skia.Path.MakeFromSVGString(d);
}

function drawPath(c: SkCanvas, d: string, paint: ReturnType<typeof fill>, evenOdd = false): void {
  const path = pathOf(d);
  if (!path) {
    return;
  }
  if (evenOdd) {
    path.setFillType(FillType.EvenOdd);
  }
  c.drawPath(path, paint);
}

function oval(c: SkCanvas, cx: number, cy: number, rx: number, ry: number, paint: ReturnType<typeof fill>): void {
  c.drawOval(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2), paint);
}

function outsidePath(): SkPath {
  const path = pathOf(
    'M-1000 -1000 H1360 V1300 H-1000 Z M70 216 L70 116 L135 64 L235 88 L300 140 L300 240 L170 240 Z M106 224.6 L106 170 C106 146 142 155 142 178.6 L142 233.3 Z',
  );
  const made = path ?? Skia.Path.Make();
  made.setFillType(FillType.EvenOdd);
  return made;
}

// Clips to everything outside the house, plus the door opening, in world space.
export function clipHouseOutside(c: SkCanvas, prop: Prop): void {
  const path = outsidePath();
  const matrix = Skia.Matrix();
  matrix.translate(prop.x, prop.y);
  matrix.scale(prop.flip ? -SCALE : SCALE, SCALE);
  matrix.translate(-ANCHOR.x, -ANCHOR.y);
  path.transform(matrix);
  c.clipPath(path, ClipOp.Intersect, true);
}

function roofScallops(c: SkCanvas): void {
  const paint = stroke('#E27FAD', 1.6);
  for (let row = 0; row < 7; row += 1) {
    const y = 70 + row * 11;
    for (let col = 0; col < 14; col += 1) {
      const x = 70 + col * 16 + (row % 2) * 8;
      drawPath(c, `M${x} ${y} A8 8 0 0 0 ${x + 16} ${y}`, paint);
    }
  }
}

function drawBack(c: SkCanvas, opts: HouseDraw): void {
  const night = Math.max(0, Math.min(1, opts.night));
  oval(c, 192, 266, 168, 12, fill('#EBB9D1', 0.55));
  const glow = night > 0.05 ? '#FFE0B0' : '#FFF4E6';
  drawPath(c, 'M70 216 L70 116 L135 64 L235 88 L300 140 L300 240 L170 240 Z', fill(glow, 0.92));
  drawPath(
    c,
    'M70 116 L135 64 L200 116 L200 216 L300 240 M70 216 L200 216',
    stroke('#E9DCCF', 2.5),
  );
  if (opts.detail) {
    c.save();
    c.skew(0, 0.24);
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(124, 118, 22, 26), 3, 3), fill('#FFFFFF'));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(124, 118, 22, 26), 3, 3), stroke('#E3A324', 2));
    drawPath(c, 'M130 150 q5 -6 10 0', stroke('#F48BBE', 2.5));
    c.restore();
    drawPath(c, 'M214 90 L214 104', stroke('#D9A23A', 1.6));
    drawPath(c, 'M200 106 Q214 118 228 106', stroke('#E3A324', 3));
    drawPath(c, 'M214 104 L214 114', stroke('#D9A23A', 2));
    oval(c, 200, 104, 3.4, 3.4, fill('#FFF3C4'));
    oval(c, 214, 100, 3.4, 3.4, fill('#FFF3C4'));
    oval(c, 228, 104, 3.4, 3.4, fill('#FFF3C4'));
  }
  oval(c, 214, 104, 16, 16, fill('#FFE7A8', 0.35 + night * 0.35));
  oval(c, 228, 228, 68, 14, linear(160, 214, 160, 242, ['#E9DAFF', '#B597EC']));
  oval(c, 228, 228, 68, 14, stroke('#E3A324', 2.5));
  drawPath(c, 'M180 222 Q228 214 276 222', stroke('#FFFFFF', 4, 0.55));
}

function post(c: SkCanvas, x: number, y: number, capY: number): void {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, 12, 110), 5, 5), fill('#FFFCF6'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, 12, 110), 5, 5), stroke('#E7C9AA', 2));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x - 3, capY, 18, 8), 3, 3), linear(x, capY, x, capY + 8, ['#FFE08A', '#E3A324']));
}

function topiary(c: SkCanvas, x: number, potY: number, leafY: number, lean: number): void {
  drawPath(c, `M${x} ${potY + 4} L${x + 24} ${potY + 4} L${x + 20} ${potY + 20} L${x + 4} ${potY + 20} Z`, linear(x, potY, x, potY + 20, ['#FFC4E1', '#F48BBE']));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x - 2, potY, 28, 6), 3, 3), fill('#F48BBE'));
  drawPath(c, `M${x + 12} ${potY} L${x + 12} ${leafY + 14}`, stroke('#B9875A', 3));
  oval(c, x + 12 + lean, leafY, 15, 15, linear(x, leafY - 15, x, leafY + 15, ['#B8F0C8', '#5FBF84']));
  drawPath(c, `M${x + 3} ${leafY - 4} Q${x + 8} ${leafY - 12} ${x + 14} ${leafY - 13}`, stroke('#FFFFFF', 3, 0.6));
}

function drawFront(c: SkCanvas, opts: HouseDraw): void {
  const night = Math.max(0, Math.min(1, opts.night));
  drawPath(
    c,
    'M70 216 L70 116 L170 140 L170 240 Z M106 224.6 L106 170 C106 146 142 155 142 178.6 L142 233.3 Z',
    fill('#CBEBFF', 0.38),
    true,
  );
  drawPath(c, 'M170 240 L170 140 L235 88 L300 140 L300 240 Z', fill('#CBEBFF', 0.32));
  drawPath(c, 'M184 232 L206 184', stroke('#FFFFFF', 7, 0.6));
  drawPath(c, 'M198 236 L210 210', stroke('#FFFFFF', 3, 0.55));
  drawPath(c, 'M276 190 L292 158', stroke('#FFFFFF', 5, 0.5));
  drawPath(c, 'M76 204 L90 150', stroke('#FFFFFF', 6, 0.6));
  drawPath(c, 'M150 214 L162 176', stroke('#FFFFFF', 4, 0.5));
  const gold = linearStroke(0, 80, 0, 240, ['#FFE08A', '#E3A324'], null, 3);
  drawPath(c, 'M156 236.6 L156 136.6', gold);
  drawPath(c, 'M70 150 L106 158.6 M142 167.3 L170 174', gold);
  drawPath(c, 'M202 240 L202 114.4', gold);
  drawPath(c, 'M235 240 L235 146', gold);
  drawPath(c, 'M268 240 L268 114.4', gold);
  drawPath(c, 'M170 176 L300 176', gold);
  drawPath(c, 'M170 176 Q186 158 202 176 Q218 158 235 176 Q251 158 268 176 Q284 158 300 176', stroke('#E3A324', 2.5));
  const frame = 'M70 216 L70 116 L170 140 L170 240 M300 240 L300 140 L235 88 L170 140';
  drawPath(c, frame, stroke('#E7C9AA', 10));
  drawPath(c, frame, stroke('#FFFCF6', 7));
  const door = 'M106 224.6 L106 170 C106 146 142 155 142 178.6 L142 233.3';
  drawPath(c, door, stroke('#E7C9AA', 10));
  drawPath(c, door, stroke('#FFFCF6', 7));
  if (opts.detail) {
    drawPath(c, 'M110 166 C112 152 136 158 138 176', stroke('#E3A324', 2.5));
  }
  post(c, 164, 134, 130);
  post(c, 294, 134, 130);
  post(c, 64, 110, 106);
  oval(c, 235, 128, 16, 16, fill('#FFFCF6'));
  oval(c, 235, 128, 16, 16, stroke('#E7C9AA', 2));
  oval(c, 235, 128, 12, 12, linear(223, 116, 223, 140, ['#FFE08A', '#E3A324']));
  oval(c, 235, 131, 4.3, 3.5, fill('#B8770F'));
  for (const [x, y] of [
    [230, 126],
    [233.3, 123.2],
    [236.7, 123.2],
    [240, 126],
  ] as const) {
    oval(c, x, y, 1.9, 1.9, fill('#B8770F'));
  }
  drawPath(c, 'M64 228 L64 214 L170 239 L170 254 Z', linear(64, 214, 64, 254, ['#FFF4EA', '#EBCDB4']));
  drawPath(c, 'M168 238 L308 238 L308 254 L168 254 Z', linear(168, 238, 168, 254, ['#FFF4EA', '#EBCDB4']));
  if (opts.detail) {
    drawPath(
      c,
      'M64 221 L170 246.5 M168 246 L308 246 M100 222.6 L100 237 M136 231 L136 245.5 M204 238 L204 246 M240 246 L240 254 M276 238 L276 246',
      stroke('#DDBB9E', 1.5),
    );
  }
  drawPath(c, 'M96 228 L150 241 L146 248 L90 235 Z', linear(90, 228, 150, 261, ['#FFF4EA', '#EBCDB4']));
  drawPath(c, 'M88 238 L152 253 L148 261 L80 246 Z', linear(80, 238, 152, 261, ['#FFF4EA', '#EBCDB4']));
  drawPath(c, 'M100 232 L144 242.5', stroke('#FFFFFF', 2, 0.7));
  drawPath(c, 'M90 160 L96 160', stroke('#E3A324', 2.5));
  oval(c, 88, 172, 12, 12, fill('#FFE7A8', 0.45 + night * 0.25));
  drawPath(c, 'M83 164 L93 164 L95 178 L81 178 Z', fill('#FFF6D6'));
  drawPath(c, 'M83 164 L93 164 L95 178 L81 178 Z', stroke('#E3A324', 2.2));
  drawPath(c, 'M81 164 L88 158 L95 164 Z', linear(81, 158, 81, 164, ['#FFE08A', '#E3A324']));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(82, 178, 12, 3), 1.5, 1.5), linear(82, 178, 82, 181, ['#FFE08A', '#E3A324']));
  c.save();
  c.clipPath(pathOf('M240 82 L140 58 L60 124 L160 148 Z') ?? Skia.Path.Make(), ClipOp.Intersect, true);
  c.drawRect(Skia.XYWHRect(50, 50, 210, 110), fill('#F7A6CC'));
  roofScallops(c);
  c.drawRect(Skia.XYWHRect(50, 50, 210, 40), fill('#FFFFFF', 0.28));
  c.restore();
  drawPath(c, 'M160 148 L60 124', stroke('#E27FAD', 4));
  drawPath(c, 'M240 82 L312 146', stroke('#F48BBE', 12));
  drawPath(c, 'M162 146 L240 84 L310 146', stroke('#FFFCF6', 5));
  drawPath(c, 'M168 141 L240 90 L304 141', stroke('#E3A324', 2));
  drawPath(c, 'M240 82 L140 58', stroke('#E3A324', 6));
  oval(c, 242, 80, 5, 5, linear(237, 75, 237, 85, ['#FFE08A', '#E3A324']));
  oval(c, 138, 57, 4.5, 4.5, linear(133, 52, 133, 62, ['#FFE08A', '#E3A324']));
  drawPath(c, 'M240 86 L240 98', stroke('#E3A324', 2.5));
  oval(c, 240, 100, 3, 3, linear(237, 97, 237, 103, ['#FFE08A', '#E3A324']));
  drawPath(c, 'M150 64 L230 84', stroke('#FFFFFF', 3, 0.5));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(179, 46, 24, 24), 3, 3), fill('#FFFCF6'));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(179, 46, 24, 24), 3, 3), stroke('#E7C9AA', 2));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(184, 50, 14, 16), 2, 2), fill('#CBEBFF'));
  drawPath(c, 'M191 50 L191 66', stroke('#E3A324', 1.5));
  drawPath(c, 'M187 62 L194 52', stroke('#FFFFFF', 2, 0.8));
  drawPath(c, 'M174 48 Q191 22 208 48 Z', linear(174, 22, 174, 48, ['#FFC4E1', '#F48BBE']));
  drawPath(c, 'M181 42 Q186 32 194 30', stroke('#FFFFFF', 2.5, 0.7));
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(173, 46, 36, 4), 2, 2), linear(173, 46, 173, 50, ['#FFE08A', '#E3A324']));
  oval(c, 191, 28, 3, 3, linear(188, 25, 188, 31, ['#FFE08A', '#E3A324']));
  if (opts.detail) {
    drawPath(c, 'M191 28 L191 8', stroke('#D9A23A', 2));
    drawPath(c, 'M181 14 L201 14', stroke('#D9A23A', 2));
    drawPath(c, 'M201 10 L207 14 L201 18 Z', fill('#E3A324'));
    drawPath(c, 'M181 10 L177 10 L179 14 L177 18 L181 18 Z', fill('#E3A324'));
  }
  topiary(c, 30, 250, 220, 0);
  topiary(c, 316, 236, 203, 0);
  if (opts.sparkles) {
    drawPath(c, 'M40 70 L43 79 L52 82 L43 85 L40 94 L37 85 L28 82 L37 79 Z', fill('#FFD25E'));
    drawPath(c, 'M330 120 L332 126 L338 128 L332 130 L330 136 L328 130 L322 128 L328 126 Z', fill('#FFD25E'));
    drawPath(c, 'M300 40 L301.5 45 L306 46.5 L301.5 48 L300 53 L298.5 48 L294 46.5 L298.5 45 Z', fill('#FFC4E1'));
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

// Already translated to the prop origin, the way drawProp leaves the canvas.
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
