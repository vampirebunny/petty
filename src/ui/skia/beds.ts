import { Skia, StrokeCap } from '@shopify/react-native-skia';
import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';

import type { Prop } from '../../actor/scenes';
import { bedFloorY, styledBedWidth } from '../../actor/furniture';
import { fill, linear, linearStroke, radial, stroke } from './ink';

const originX = 140;
const gold = ['#FFE9A6', '#F4C04A', '#D99016'];
const goldPos = [0, 0.5, 1];

export function isStyledBed(prop: Prop): boolean {
  return prop.bedStyle === 'cloud' || prop.bedStyle === 'bone' || prop.bedStyle === 'cave' || prop.bedStyle === 'moon';
}

function scaleOf(prop: Prop): number {
  return (prop.w ?? styledBedWidth) / 280;
}

function enter(c: SkCanvas, prop: Prop): void {
  c.scale(scaleOf(prop), scaleOf(prop));
  c.translate(-originX, -bedFloorY);
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

function roundRect(c: SkCanvas, x: number, y: number, w: number, h: number, r: number, paint: SkPaint): void {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r), paint);
}

function goldFill(y0: number, y1: number): SkPaint {
  return linear(0, y0, 0, y1, gold, goldPos);
}

function goldLine(y0: number, y1: number, width: number): SkPaint {
  return linearStroke(0, y0, 0, y1, gold, goldPos, width, 1, StrokeCap.Round);
}

function radialOval(c: SkCanvas, cx: number, cy: number, rx: number, ry: number, colors: string[], pos: number[] | null = null): void {
  c.save();
  c.translate(cx, cy);
  c.scale(rx, ry);
  c.drawCircle(0, 0, 1, radial(0, 0, 1, colors, pos));
  c.restore();
}

export function drawStyledBed(c: SkCanvas, prop: Prop): void {
  c.save();
  c.translate(prop.x, prop.y);
  enter(c, prop);
  if (prop.bedStyle === 'cloud') {
    drawMat(c);
  } else if (prop.bedStyle === 'bone') {
    drawChaise(c);
  } else if (prop.bedStyle === 'cave') {
    drawStack(c);
  } else if (prop.bedStyle === 'moon') {
    drawPillow(c);
  }
  c.restore();
}

function drawMat(c: SkCanvas): void {
  const side = linear(0, 150, 0, 182, ['#7DD8B4', '#43AE88']);
  const top = linear(0, 132, 0, 164, ['#F2FFF9', '#C4F2DE', '#94E2C2'], [0, 0.6, 1]);
  const pink = linear(0, 156, 0, 180, ['#FFD3E7', '#F48DBE']);
  oval(c, 140, 186, 124, 6, fill('#8FC9B2', 0.45));
  roundRect(c, 22, 148, 236, 34, 17, side);
  svgPath(c, 'M70 165 Q68 172 70 180 M105 166 Q104 173 105 181 M175 166 Q176 173 175 181 M210 165 Q212 172 210 180', stroke('#2F8E6C', 2, 0.35));
  svgPath(c, 'M34 170 Q56 180 92 181', stroke('#FFFFFF', 3.5, 0.3));
  roundRect(c, 24, 132, 232, 32, 16, top);
  svgPath(c, 'M70 137 Q66 148 70 159 M105 136 Q102 148 105 160 M140 136 L140 160 M175 136 Q178 148 175 160 M210 137 Q214 148 210 159', stroke('#5FBF99', 2, 0.55));
  svgPath(c, 'M48 138 Q140 131 232 138', stroke('#FFFFFF', 5, 0.7));
  svgPath(c, 'M30 156 Q140 170 250 156', linearStroke(0, 156, 0, 180, ['#FFD3E7', '#F48DBE'], null, 5, 1, StrokeCap.Round));
  roundRect(c, 129, 170, 22, 6, 3, pink);
  c.drawCircle(129, 170, 3.6, pink);
  c.drawCircle(129, 176, 3.6, pink);
  c.drawCircle(151, 170, 3.6, pink);
  c.drawCircle(151, 176, 3.6, pink);
}

function drawChaise(c: SkCanvas): void {
  const side = linear(0, 156, 0, 176, ['#F59A80', '#D06A52']);
  const top = linear(0, 138, 0, 162, ['#FFF1E8', '#FFD0BC', '#FFAE92'], [0, 0.55, 1]);
  const arm = linear(0, 122, 0, 170, ['#FFE6D9', '#FFB89F', '#E8806A'], [0, 0.5, 1]);
  oval(c, 140, 186, 120, 6, fill('#E3A994', 0.45));
  svgPath(c, 'M40 172 L54 172 L51 186 L43 186 Z M226 172 L240 172 L237 186 L229 186 Z', goldFill(172, 186));
  roundRect(c, 28, 156, 224, 20, 10, side);
  svgPath(c, 'M60 170 Q140 176 238 170', stroke('#FFFFFF', 3, 0.25));
  svgPath(c, 'M34 158 L246 158', goldLine(150, 166, 4));
  roundRect(c, 30, 138, 222, 24, 12, top);
  svgPath(
    c,
    'M76 141 L104 159 M104 141 L76 159 M110 141 L138 159 M138 141 L110 159 M144 141 L172 159 M172 141 L144 159 M178 141 L206 159 M206 141 L178 159 M212 141 L240 159 M240 141 L212 159',
    stroke('#E08A6E', 1.6, 0.35),
  );
  svgPath(c, 'M84 142 Q166 136 244 142', stroke('#FFFFFF', 5, 0.65));
  svgPath(c, 'M36 157 Q144 165 250 157', goldLine(150, 170, 4));
  svgPath(c, 'M26 170 L26 136 Q26 122 42 122 Q58 122 58 136 L58 164 Z', arm);
  oval(c, 42, 135, 13, 12, fill('#FFE3D5'));
  oval(c, 42, 135, 13, 12, goldLine(123, 147, 3));
  svgPath(c, 'M44 135 A2.5 2.5 0 1 0 41 137.5 A5.5 5.5 0 1 0 36.5 131', stroke('#E08A6E', 1.8, 0.7));
  svgPath(c, 'M30 152 Q31 162 36 166', stroke('#FFFFFF', 3, 0.4));
}

function drawStack(c: SkCanvas): void {
  const lilac = ['#FBF7FF', '#DCCBFA', '#B79BEE'];
  const pink = ['#FFF0F7', '#FFC4DE', '#F79AC4'];
  oval(c, 140, 186, 118, 6, fill('#B9A3E0', 0.5));
  svgPath(c, 'M30 162 L30 170 A110 14 0 0 0 250 170 L250 162 Z', linear(0, 160, 0, 184, ['#A98AE8', '#7656C6']));
  svgPath(c, 'M40 172 Q70 182 110 183', stroke('#FFFFFF', 3.5, 0.3));
  radialOval(c, 140, 162, 110, 16, lilac, [0, 0.55, 1]);
  svgPath(c, 'M30 162 A110 16 0 0 0 250 162', goldLine(150, 174, 3.5));
  svgPath(c, 'M52 157 Q80 149 110 148', stroke('#FFFFFF', 4.5, 0.6));
  svgPath(c, 'M74 146 L74 154 A78 11 0 0 0 230 154 L230 146 Z', linear(0, 146, 0, 166, ['#F28DBB', '#CF5F95']));
  radialOval(c, 152, 146, 78, 12, pink, [0, 0.55, 1]);
  svgPath(c, 'M152 146 L130 140 M152 146 L174 140 M152 146 L128 151 M152 146 L176 151', stroke('#E77FB0', 1.8, 0.55));
  oval(c, 152, 146, 5, 3.2, fill('#E77FB0'));
  svgPath(c, 'M98 141 Q150 133 206 141', stroke('#FFFFFF', 4.5, 0.7));
  svgPath(c, 'M74 146 A78 12 0 0 0 230 146', goldLine(140, 158, 3));
  svgPath(c, 'M62 173 L62 176', stroke('#D99016', 2));
  svgPath(c, 'M58 176 Q62 174 66 176 L67 184 Q62 186 57 184 Z', goldFill(174, 186));
}

function drawPillow(c: SkCanvas): void {
  const top = linear(0, 126, 0, 156, ['#EFFFFC', '#B5EEE6', '#7FD6CA'], [0, 0.55, 1]);
  const front = linear(0, 150, 0, 172, ['#63C9BC', '#2F9C90']);
  const tray = linear(0, 160, 0, 170, ['#FFF1C4', '#F4C04A']);
  oval(c, 140, 186, 120, 6, fill('#8CC6BE', 0.45));
  roundRect(c, 34, 176, 14, 9, 4, fill('#D99016'));
  roundRect(c, 232, 176, 14, 9, 4, fill('#D99016'));
  svgPath(c, 'M44 160 L236 160 L254 170 L26 170 Z', tray);
  roundRect(c, 26, 170, 228, 8, 3, goldFill(168, 178));
  svgPath(c, 'M34 172 L246 172', stroke('#FFFFFF', 2, 0.5));
  svgPath(c, 'M62 130 Q57 131 56 134', stroke('#D99016', 1.8));
  svgPath(c, 'M53 134 Q56 133 59 134 L60 141 Q56 142 52 141 Z', goldFill(132, 142));
  svgPath(c, 'M218 130 Q223 131 224 134', stroke('#D99016', 1.8));
  svgPath(c, 'M221 134 Q224 133 227 134 L228 141 Q224 142 220 141 Z', goldFill(132, 142));
  svgPath(c, 'M42 150 Q140 160 238 150 Q244 160 236 168 Q140 174 44 168 Q36 160 42 150 Z', front);
  svgPath(c, 'M62 130 Q140 124 218 130 Q232 140 238 150 Q140 160 42 150 Q48 140 62 130 Z', top);
  svgPath(c, 'M140 141 L116 136 M140 141 L164 136 M140 141 L112 147 M140 141 L168 147', stroke('#4FB3A6', 1.8, 0.5));
  oval(c, 140, 141, 6, 3.5, goldFill(137, 145));
  svgPath(c, 'M76 134 Q140 128 204 134', stroke('#FFFFFF', 5, 0.7));
  svgPath(c, 'M42 150 Q140 160 238 150', goldLine(148, 162, 4));
  svgPath(c, 'M60 164 Q100 170 140 170', stroke('#FFFFFF', 3, 0.3));
  svgPath(c, 'M42 150 Q36 154 36 158', stroke('#D99016', 2));
  svgPath(c, 'M32 158 Q36 156 40 158 L41 168 Q36 170 31 168 Z', goldFill(156, 170));
  svgPath(c, 'M238 150 Q244 154 244 158', stroke('#D99016', 2));
  svgPath(c, 'M240 158 Q244 156 248 158 L249 168 Q244 170 239 168 Z', goldFill(156, 170));
}
