import { Skia } from '@shopify/react-native-skia';
import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';

import type { Prop } from '../../actor/scenes';
import { styledBedWidth } from '../../actor/furniture';
import { fill, linear, stroke } from './ink';

export type BedPart = 'back' | 'front';

const floorY = 184;
const originX = 140;

export function isStyledBed(prop: Prop): boolean {
  return prop.bedStyle === 'cloud' || prop.bedStyle === 'bone' || prop.bedStyle === 'cave' || prop.bedStyle === 'moon';
}

function scaleOf(prop: Prop): number {
  return (prop.w ?? styledBedWidth) / 280;
}

export function bedWorldPoint(prop: Prop, svgX: number, svgY: number): { x: number; y: number } {
  const scale = scaleOf(prop);
  return { x: prop.x + (svgX - originX) * scale, y: prop.y + (svgY - floorY) * scale };
}

export function caveDoor(prop: Prop): { cx: number; cy: number; rx: number; ry: number } {
  const center = bedWorldPoint(prop, 140, 140);
  const scale = scaleOf(prop);
  return { cx: center.x, cy: center.y, rx: 54 * scale, ry: 44 * scale };
}

export function cradleKnot(prop: Prop): { x: number; y: number } {
  return bedWorldPoint(prop, 140, 18);
}

export function cradleSway(t: number, reduced: boolean): number {
  if (reduced) {
    return 0;
  }
  return Math.sin((t / 3) * Math.PI * 2) * 3;
}

function enter(c: SkCanvas, prop: Prop): number {
  const scale = scaleOf(prop);
  c.scale(scale, scale);
  c.translate(-originX, -floorY);
  return scale;
}

function oval(c: SkCanvas, cx: number, cy: number, rx: number, ry: number, paint: SkPaint): void {
  c.drawOval(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2), paint);
}

function svgPath(c: SkCanvas, d: string, paint: SkPaint): void {
  const path = Skia.Path.MakeFromSVGString(d);
  if (path) {
    c.drawPath(path, paint);
  }
}

function swayAboutKnot(c: SkCanvas, degrees: number): void {
  if (degrees === 0) {
    return;
  }
  c.translate(140, 18);
  c.rotate(degrees, 0, 0);
  c.translate(-140, -18);
}

export function drawStyledBed(c: SkCanvas, prop: Prop, part: BedPart, sway: number): void {
  c.save();
  c.translate(prop.x, prop.y);
  enter(c, prop);
  if (prop.bedStyle === 'cloud') {
    drawCloud(c, part);
  } else if (prop.bedStyle === 'bone') {
    drawBone(c, part);
  } else if (prop.bedStyle === 'cave') {
    drawCave(c, part);
  } else if (prop.bedStyle === 'moon') {
    drawMoon(c, part, sway);
  }
  c.restore();
}

function drawCloud(c: SkCanvas, part: BedPart): void {
  const pink = linear(0, 80, 0, 190, ['#FFC4E1', '#F48BBE']);
  const lilac = linear(0, 100, 0, 160, ['#F3E8FF', '#D6BEF5']);
  if (part === 'back') {
    oval(c, 140, 186, 116, 9, fill('#E9BBD3', 0.6));
    oval(c, 140, 118, 118, 46, pink);
    svgPath(c, 'M54 96 Q140 66 226 96', stroke('#FFFFFF', 7, 0.55));
    oval(c, 140, 124, 92, 30, fill('#FFE1EF'));
    oval(c, 140, 130, 84, 21, lilac);
    svgPath(c, 'M92 124 Q140 116 188 124', stroke('#FFFFFF', 5, 0.6));
    return;
  }
  for (const puff of [
    [46, 146, 25],
    [234, 146, 25],
    [92, 158, 27],
    [188, 158, 27],
    [140, 162, 28],
  ] as const) {
    c.drawCircle(puff[0], puff[1], puff[2], pink);
  }
  for (const shine of ['M32 136 Q42 126 54 128', 'M78 147 Q90 137 103 139', 'M126 151 Q138 141 152 143', 'M174 147 Q186 137 199 139', 'M220 136 Q230 126 242 128']) {
    svgPath(c, shine, stroke('#FFFFFF', 5, 0.65));
  }
}

function drawBone(c: SkCanvas, part: BedPart): void {
  const mint = linear(0, 90, 0, 180, ['#B8F0D8', '#6FCFA6']);
  const deep = linear(0, 70, 0, 150, ['#9BE6C5', '#57BE93']);
  const butter = linear(0, 80, 0, 130, ['#FFF1B0', '#FFD25E']);
  if (part === 'back') {
    oval(c, 140, 188, 112, 8, fill('#B5DCCB', 0.7));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(54, 166, 14, 18), 5, 5), fill('#E8A86B'));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(212, 166, 14, 18), 5, 5), fill('#E8A86B'));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(52, 72, 176, 70), 26, 26), deep);
    svgPath(c, 'M76 86 Q140 76 204 86', stroke('#FFFFFF', 6, 0.5));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(40, 124, 200, 48), 20, 20), mint);
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(60, 114, 160, 28), 14, 14), fill('#DDFBEE'));
    svgPath(c, 'M78 120 Q140 114 202 120', stroke('#FFFFFF', 5, 0.8));
    c.drawCircle(102, 94, 13, butter);
    c.drawCircle(102, 114, 13, butter);
    c.drawCircle(178, 94, 13, butter);
    c.drawCircle(178, 114, 13, butter);
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(100, 92, 80, 24), 12, 12), butter);
    svgPath(c, 'M110 97 Q140 93 170 97', stroke('#FFFFFF', 4, 0.8));
    return;
  }
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(26, 98, 44, 76), 22, 22), mint);
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(210, 98, 44, 76), 22, 22), mint);
  svgPath(c, 'M36 112 Q46 103 58 105', stroke('#FFFFFF', 5, 0.7));
  svgPath(c, 'M220 112 Q230 103 242 105', stroke('#FFFFFF', 5, 0.7));
}

function drawCave(c: SkCanvas, part: BedPart): void {
  const lav = linear(0, 40, 0, 180, ['#E2D2FF', '#A98BE8']);
  const pink = linear(0, 150, 0, 190, ['#FFD0E6', '#F59BC6']);
  if (part === 'back') {
    oval(c, 140, 186, 108, 9, fill('#C9B6EA', 0.6));
    svgPath(c, 'M72 84 L60 30 Q58 22 66 26 L112 58 Z', lav);
    svgPath(c, 'M78 72 L70 40 L100 60 Z', pink);
    svgPath(c, 'M208 84 L220 30 Q222 22 214 26 L168 58 Z', lav);
    svgPath(c, 'M202 72 L210 40 L180 60 Z', pink);
    svgPath(c, 'M50 180 Q40 180 40 168 L40 124 C40 48 240 48 240 124 L240 168 Q240 180 230 180 Z', lav);
    svgPath(c, 'M68 104 Q86 72 132 66', stroke('#FFFFFF', 8, 0.5));
    oval(c, 140, 140, 54, 44, fill('#5E4A82'));
    return;
  }
  oval(c, 140, 140, 54, 44, stroke('#F4ECFF', 10));
  svgPath(c, 'M98 116 Q114 98 136 96', stroke('#FFFFFF', 4, 0.8));
  oval(c, 140, 172, 44, 11, pink);
  svgPath(c, 'M112 168 Q140 163 168 168', stroke('#FFFFFF', 4, 0.7));
}

function drawMoon(c: SkCanvas, part: BedPart, sway: number): void {
  const moon = linear(0, 90, 0, 180, ['#FFF2B3', '#FFC94A']);
  const pink = linear(0, 110, 0, 150, ['#FFD6EA', '#F7A3CB']);
  if (part === 'back') {
    oval(c, 140, 188, 120, 8, fill('#E6CF8E', 0.6));
    svgPath(c, 'M30 184 Q30 10 140 10 Q250 10 250 184', stroke('#D99A5E', 11));
    svgPath(c, 'M50 120 Q60 40 140 26', stroke('#FFFFFF', 3, 0.45));
    c.save();
    swayAboutKnot(c, sway);
    svgPath(c, 'M140 18 L66 94', stroke('#C98C55', 2.5));
    svgPath(c, 'M140 18 L214 94', stroke('#C98C55', 2.5));
    c.drawCircle(140, 18, 5, fill('#C98C55'));
    oval(c, 140, 128, 60, 11, pink);
    svgPath(c, 'M104 124 Q140 119 176 124', stroke('#FFFFFF', 4, 0.7));
    c.restore();
    return;
  }
  c.save();
  swayAboutKnot(c, sway);
  svgPath(c, 'M58 92 C58 182 222 182 222 92 C206 146 74 146 58 92 Z', moon);
  svgPath(c, 'M76 128 Q104 158 140 160', stroke('#FFFFFF', 5, 0.6));
  svgPath(c, 'M140 160 L140 170', stroke('#C98C55', 2));
  svgPath(c, 'M140 168 L143.5 175 L151 176 L145.5 181 L147 188 L140 184.5 L133 188 L134.5 181 L129 176 L136.5 175 Z', fill('#FFC94A'));
  c.restore();
}
