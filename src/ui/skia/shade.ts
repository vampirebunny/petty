import { ClipOp } from '@shopify/react-native-skia';
import type { SkCanvas, SkPath } from '@shopify/react-native-skia';

import { petStyle } from '../../actor/data/petStyle';
import { clipOval, fillOval, paintOf } from './draw';

// Clip to the part's oval and lay a translucent shadow on its underside and a highlight near its top.
export function shadeOval(c: SkCanvas, x: number, y: number, rx: number, ry: number, alpha = 1): void {
  const s = petStyle.shade;
  if (!s.enabled || alpha <= 0) {
    return;
  }
  c.save();
  clipOval(c, x, y, rx, ry);
  fillOval(c, x + rx * 0.08, y + ry * s.shadowY, rx * s.shadowRx, ry * s.shadowRy, '#000000', s.shadowAlpha * alpha);
  fillOval(c, x + rx * s.highlightX, y + ry * s.highlightY, rx * s.highlightRx, ry * s.highlightRy, '#ffffff', s.highlightAlpha * alpha);
  c.restore();
}

// Same shadow and highlight, clipped to a path. Erect ears skip the highlight and keep only the base shadow.
export function shadePath(c: SkCanvas, path: SkPath, alpha = 1, highlight = true): void {
  const s = petStyle.shade;
  if (!s.enabled || alpha <= 0) {
    return;
  }
  const bounds = path.getBounds();
  const rx = Math.max(bounds.width / 2, 0.5);
  const ry = Math.max(bounds.height / 2, 0.5);
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  c.save();
  c.clipPath(path, ClipOp.Intersect, true);
  fillOval(c, x + rx * 0.08, y + ry * s.shadowY, rx * s.shadowRx, ry * s.shadowRy, '#000000', s.shadowAlpha * alpha);
  if (highlight) {
    fillOval(c, x + rx * s.highlightX, y + ry * s.highlightY, rx * s.highlightRx, ry * s.highlightRy, '#ffffff', s.highlightAlpha * alpha);
  }
  c.restore();
}

// A darker stripe along the underside of a tail stroke, inside the tail's own width.
export function shadeTail(c: SkCanvas, path: SkPath, width: number): void {
  const s = petStyle.shade;
  if (!s.enabled || width <= 0) {
    return;
  }
  c.save();
  c.translate(0, width * s.legOffset);
  c.drawPath(path, paintOf('#000000', s.legAlpha, width * s.legStripe));
  c.restore();
}
