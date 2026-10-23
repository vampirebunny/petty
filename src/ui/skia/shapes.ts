import { Skia } from '@shopify/react-native-skia';
import type { SkCanvas, SkPath } from '@shopify/react-native-skia';

import type { Shape } from '../../actor/scenes';
import type { Env } from './env';
import { fill, ov, stroke } from './ink';
import { drawSkyPane } from './sky';

// Scene data shapes. Paths are built once per shape object and reused every frame.
const pathCache = new WeakMap<Shape, SkPath | null>();

function shapePath(shape: Shape): SkPath | null {
  if (pathCache.has(shape)) {
    return pathCache.get(shape) ?? null;
  }
  let path: SkPath | null;
  if (shape.t === 'rect' && shape.x != null && shape.y != null && shape.w != null && shape.h != null) {
    const r = Skia.XYWHRect(shape.x, shape.y, shape.w, shape.h);
    path = shape.r ? Skia.Path.RRect(Skia.RRectXY(r, shape.r, shape.r)) : Skia.Path.Rect(r);
  } else if (shape.t === 'ellipse' && shape.x != null && shape.y != null) {
    path = Skia.Path.Make();
    path.addOval(ov(shape.x, shape.y, shape.rx ?? 10, shape.ry ?? 10));
  } else if (shape.t === 'circle' && shape.x != null && shape.y != null) {
    path = Skia.Path.Make();
    path.addCircle(shape.x, shape.y, shape.r ?? 10);
  } else if (shape.t === 'poly' && shape.pts && shape.pts.length > 1) {
    path = Skia.Path.Make();
    path.addPoly(
      shape.pts.map(([x, y]) => ({ x, y })),
      true,
    );
  } else if (shape.t === 'line' && shape.x1 != null && shape.y1 != null && shape.x2 != null && shape.y2 != null) {
    path = Skia.Path.Make();
    path.moveTo(shape.x1, shape.y1);
    path.lineTo(shape.x2, shape.y2);
  } else {
    path = null;
  }
  pathCache.set(shape, path);
  return path;
}

export function drawShape(c: SkCanvas, shape: Shape, env: Env): void {
  if (shape.t === 'sky') {
    if (shape.x != null && shape.y != null && shape.w != null && shape.h != null) {
      drawSkyPane(c, shape.x, shape.y, shape.w, shape.h, env);
    }
    return;
  }
  const path = shapePath(shape);
  if (!path) {
    return;
  }
  const alpha = shape.alpha ?? 1;
  if (shape.fill && shape.t !== 'line') {
    c.drawPath(path, fill(shape.fill, alpha));
  }
  if (shape.stroke || shape.t === 'line') {
    c.drawPath(path, stroke(shape.stroke ?? shape.fill ?? '#000000', shape.lw ?? 2, alpha));
  }
}

export function drawShapes(c: SkCanvas, shapes: Shape[], env: Env): void {
  for (const shape of shapes) {
    drawShape(c, shape, env);
  }
}
