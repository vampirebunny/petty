import { ClipOp, Skia } from '@shopify/react-native-skia';
import type { SkCanvas, SkPath, SkPicture } from '@shopify/react-native-skia';

import { mix, paintOf } from './draw';
import type { PatternPaint } from './patternSpec';

export type { PatternId, PatternPaint } from './patternSpec';
export { isPatternId, patternAngle, patternPaint, patternUnit } from './patternSpec';

const RAINBOW = ['#FF7A8A', '#FFB86B', '#FFE38F', '#8FE3A6', '#8FD3FF', '#B9A2F5'];
const GOLD = '#FFC93C';
const PLAID_LINE = '#F0C94A';

type Tile = { picture: SkPicture; w: number; h: number };

const tiles = new Map<string, Tile>();

function tileKey(paint: PatternPaint): string {
  return `${paint.id}|${paint.c}|${paint.d ?? ''}|${paint.u}`;
}

function record(w: number, h: number, draw: (canvas: SkCanvas) => void): SkPicture {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, w, h));
  draw(canvas);
  return recorder.finishRecordingAsPicture();
}

function starPath(cx: number, cy: number, outer: number, inner: number): SkPath {
  const path = Skia.PathBuilder.Make();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  }
  path.close();
  return path.detach();
}

function daisy(canvas: SkCanvas, x: number, y: number, u: number, turn: number, petal: string): void {
  canvas.save();
  canvas.translate(x, y);
  canvas.rotate((turn * 180) / Math.PI, 0, 0);
  for (let i = 0; i < 5; i += 1) {
    canvas.save();
    canvas.rotate(i * 72, 0, 0);
    canvas.drawOval(Skia.XYWHRect(-u * 0.3, -u * 0.95, u * 0.6, u), paintOf(petal));
    canvas.restore();
  }
  canvas.drawCircle(0, 0, u * 0.55, paintOf(GOLD));
  canvas.restore();
}

function tileFor(paint: PatternPaint): Tile {
  const key = tileKey(paint);
  const cached = tiles.get(key);
  if (cached) {
    return cached;
  }
  const u = paint.u;
  const motif = paint.d ?? paint.c;
  let tile: Tile;
  if (paint.id === 'stripes') {
    const h = u * 2;
    tile = {
      w: u * 2,
      h,
      picture: record(u * 2, h, (canvas) => {
        canvas.drawRect(Skia.XYWHRect(0, 0, u * 2, u), paintOf(motif));
      }),
    };
  } else if (paint.id === 'gingham') {
    const band = mix(paint.c, motif, 0.45);
    const cross = mix(paint.c, motif, 0.75);
    const size = u * 2;
    tile = {
      w: size,
      h: size,
      picture: record(size, size, (canvas) => {
        canvas.drawRect(Skia.XYWHRect(0, 0, size, u), paintOf(band));
        canvas.drawRect(Skia.XYWHRect(0, 0, u, size), paintOf(band));
        canvas.drawRect(Skia.XYWHRect(0, 0, u, u), paintOf(cross));
      }),
    };
  } else if (paint.id === 'plaid') {
    const size = u * 4;
    const wide = mix(paint.c, motif, 0.5);
    const cross = mix(paint.c, motif, 0.75);
    const line = mix(paint.c, PLAID_LINE, 0.8);
    tile = {
      w: size,
      h: size,
      picture: record(size, size, (canvas) => {
        canvas.drawRect(Skia.XYWHRect(0, 0, size, u * 1.4), paintOf(wide));
        canvas.drawRect(Skia.XYWHRect(0, 0, u * 1.4, size), paintOf(wide));
        canvas.drawRect(Skia.XYWHRect(0, 0, u * 1.4, u * 1.4), paintOf(cross));
        canvas.drawRect(Skia.XYWHRect(0, u * 2, size, u * 0.3), paintOf(line));
        canvas.drawRect(Skia.XYWHRect(u * 2, 0, u * 0.3, size), paintOf(line));
      }),
    };
  } else if (paint.id === 'daisies') {
    const w = u * 4;
    const h = u * 8;
    tile = {
      w,
      h,
      picture: record(w, h, (canvas) => {
        daisy(canvas, w / 2, u * 2, u, 0.35, motif);
        daisy(canvas, 0, u * 6, u, -0.5, motif);
        daisy(canvas, w, u * 6, u, -0.5, motif);
      }),
    };
  } else {
    const w = u * 3.5;
    const h = u * 7;
    const outer = u * 0.6;
    tile = {
      w,
      h,
      picture: record(w, h, (canvas) => {
        canvas.drawPath(starPath(w / 2, u * 1.75, outer, outer * 0.45), paintOf(motif));
        canvas.drawPath(starPath(0, u * 5.25, outer, outer * 0.45), paintOf(motif));
        canvas.drawPath(starPath(w, u * 5.25, outer, outer * 0.45), paintOf(motif));
      }),
    };
  }
  tiles.set(key, tile);
  return tile;
}

export function patternTile(paint: PatternPaint): { w: number; h: number } | null {
  if (paint.id === 'rainbow') {
    return null;
  }
  const tile = tileFor(paint);
  return { w: tile.w, h: tile.h };
}

function drawRainbow(canvas: SkCanvas, path: SkPath): void {
  const bounds = path.getBounds();
  canvas.save();
  canvas.clipPath(path, ClipOp.Intersect, true);
  const band = bounds.height / RAINBOW.length;
  for (let i = 0; i < RAINBOW.length; i += 1) {
    canvas.drawRect(Skia.XYWHRect(bounds.x, bounds.y + band * i, bounds.width, band + 0.5), paintOf(RAINBOW[i]));
  }
  canvas.restore();
}

export function drawItemPattern(canvas: SkCanvas, path: SkPath, paint: PatternPaint): void {
  if (paint.id === 'rainbow') {
    drawRainbow(canvas, path);
    return;
  }
  const tile = tileFor(paint);
  const bounds = path.getBounds();
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const pad = Math.hypot(bounds.width, bounds.height) + tile.w + tile.h;
  canvas.save();
  canvas.clipPath(path, ClipOp.Intersect, true);
  canvas.translate(cx, cy);
  canvas.rotate(paint.angle, 0, 0);
  canvas.translate(-cx, -cy);
  const x0 = bounds.x - pad;
  const y0 = bounds.y - pad;
  for (let y = y0; y < bounds.y + bounds.height + pad; y += tile.h) {
    for (let x = x0; x < bounds.x + bounds.width + pad; x += tile.w) {
      canvas.save();
      canvas.translate(x, y);
      canvas.drawPicture(tile.picture);
      canvas.restore();
    }
  }
  canvas.restore();
}

/** Soft shade over a patterned fill. The outline is drawn by the caller after this. */
export function shadePattern(canvas: SkCanvas, path: SkPath, color: string, alpha = 1): void {
  const bounds = path.getBounds();
  canvas.save();
  canvas.clipPath(path, ClipOp.Intersect, true);
  const paint = paintOf(mix(color, '#000000', 0.35), 0.35 * alpha);
  canvas.drawRect(Skia.XYWHRect(bounds.x, bounds.y + bounds.height * 0.45, bounds.width, bounds.height), paint);
  canvas.restore();
}
