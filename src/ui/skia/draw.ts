import { BlendMode, ClipOp, PaintStyle, Skia, StrokeCap, StrokeJoin, TileMode } from '@shopify/react-native-skia';
import type { SkCanvas, SkPaint, SkPath } from '@shopify/react-native-skia';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function rgb(color: string): [number, number, number] {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(color);
  if (short) {
    return [parseInt(short[1] + short[1], 16), parseInt(short[2] + short[2], 16), parseInt(short[3] + short[3], 16)];
  }
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    return [128, 128, 128];
  }
  const value = parseInt(color.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function mix(color: string, toward: string, amount: number): string {
  const from = rgb(color);
  const to = rgb(toward);
  return `#${from
    .map((channel, index) => Math.round(channel + (to[index] - channel) * amount).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function rgba(color: string, alpha: number): string {
  const [r, g, b] = rgb(color);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

export function deg(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function paintOf(
  color: string,
  alpha = 1,
  stroke = 0,
  cap: StrokeCap = StrokeCap.Round,
): SkPaint {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(stroke > 0 ? PaintStyle.Stroke : PaintStyle.Fill);
  paint.setColor(Skia.Color(color));
  paint.setAlphaf(alpha);
  if (stroke > 0) {
    paint.setStrokeWidth(stroke);
    paint.setStrokeCap(cap);
    paint.setStrokeJoin(StrokeJoin.Round);
  }
  return paint;
}

export function oval(cx: number, cy: number, rx: number, ry: number) {
  return Skia.XYWHRect(cx - rx, cy - ry, Math.max(rx, 0.5) * 2, Math.max(ry, 0.5) * 2);
}

export function fillOval(c: SkCanvas, cx: number, cy: number, rx: number, ry: number, color: string, alpha = 1): void {
  c.drawOval(oval(cx, cy, rx, ry), paintOf(color, alpha));
}

export function fillCircle(c: SkCanvas, cx: number, cy: number, r: number, color: string, alpha = 1): void {
  c.drawCircle(cx, cy, r, paintOf(color, alpha));
}

export function fillRect(c: SkCanvas, x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
  c.drawRect(Skia.XYWHRect(x, y, w, h), paintOf(color, alpha));
}

export function fillRRect(c: SkCanvas, x: number, y: number, w: number, h: number, r: number, color: string, alpha = 1): void {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r), paintOf(color, alpha));
}

export function strokeLine(
  c: SkCanvas,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
  alpha = 1,
  cap: StrokeCap = StrokeCap.Round,
): void {
  c.drawLine(x1, y1, x2, y2, paintOf(color, alpha, width, cap));
}

export function strokeOval(
  c: SkCanvas,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  width: number,
  alpha = 1,
): void {
  c.drawOval(oval(cx, cy, rx, ry), paintOf(color, alpha, width));
}

export function polygon(points: [number, number][]): SkPath {
  const path = Skia.Path.Make();
  points.forEach(([x, y], index) => {
    if (index === 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  });
  path.close();
  return path;
}

export function clipOval(c: SkCanvas, cx: number, cy: number, rx: number, ry: number): void {
  const path = Skia.Path.Make();
  path.addOval(oval(cx, cy, rx, ry));
  c.clipPath(path, ClipOp.Intersect, true);
}

export function fillGradient(c: SkCanvas, x: number, y: number, w: number, h: number, top: string, bottom: string): void {
  const paint = paintOf('#ffffff');
  paint.setShader(
    Skia.Shader.MakeLinearGradient(
      Skia.Point(x, y),
      Skia.Point(x, y + h),
      [Skia.Color(top), Skia.Color(bottom)],
      null,
      TileMode.Clamp,
    ),
  );
  c.drawRect(Skia.XYWHRect(x, y, w, h), paint);
}

// A soft round light: full color out to `inner`, fading to nothing at `radius`.
export function radialGlow(
  c: SkCanvas,
  cx: number,
  cy: number,
  inner: number,
  radius: number,
  color: string,
  alpha: number,
  blend?: BlendMode,
): void {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  if (blend != null) {
    paint.setBlendMode(blend);
  }
  paint.setShader(
    Skia.Shader.MakeRadialGradient(
      Skia.Point(cx, cy),
      radius,
      [Skia.Color(rgba(color, alpha)), Skia.Color(rgba(color, 0))],
      [clamp(inner / radius, 0, 0.99), 1],
      TileMode.Clamp,
    ),
  );
  c.drawRect(Skia.XYWHRect(cx - radius, cy - radius, radius * 2, radius * 2), paint);
}
