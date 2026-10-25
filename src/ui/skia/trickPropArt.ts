import { PaintStyle, Skia } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import { PROP_SCALE, type PlacedTrickProp } from '../../sim/trickProps';

const fill = (color: string, alpha = 1) => {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color(color));
  paint.setAlphaf(alpha);
  return paint;
};

export function drawTrickProp(canvas: SkCanvas, prop: PlacedTrickProp, pass: 'back' | 'front'): void {
  const s = PROP_SCALE;
  canvas.save();
  canvas.translate(prop.x, prop.y);
  if (prop.type === 'podium') {
    if (pass === 'back') {
      canvas.drawOval(Skia.XYWHRect(-48 * s, -8 * s, 96 * s, 16 * s), fill('#3B2357', 0.12));
      canvas.drawRect(Skia.XYWHRect(-40 * s, -30 * s, 80 * s, 26 * s), fill('#FFD98A'));
      canvas.drawOval(Skia.XYWHRect(-40 * s, -36 * s, 80 * s, 16 * s), fill('#FFE9B8'));
    }
  } else if (prop.type === 'tunnel') {
    const pink = prop.sourceTrickId.startsWith('cat') ? '#A9DBFF' : '#FFB3DA';
    const lip = prop.sourceTrickId.startsWith('cat') ? '#8CC7EF' : '#F59BC8';
    if (pass === 'back') {
      canvas.drawOval(Skia.XYWHRect(-18 * s, -40 * s, 36 * s, 50 * s), fill('#FFC9E4'));
      canvas.drawOval(Skia.XYWHRect(30 * s, -40 * s, 36 * s, 50 * s), fill(pink));
    } else {
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(-66 * s, -32 * s, 132 * s, 40 * s), 20 * s, 20 * s), fill(pink));
      canvas.drawOval(Skia.XYWHRect(-12 * s, -28 * s, 24 * s, 36 * s), fill(lip));
    }
  } else if (prop.type === 'hurdle') {
    const barY = prop.knocked ? -8 * s : -36 * s;
    if (pass === 'back') {
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(-34 * s, -70 * s, 8 * s, 70 * s), 4, 4), fill('#A9DBFF'));
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(-40 * s, barY, 80 * s, 10 * s), 5, 5), fill('#FFFFFF'));
    } else {
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(26 * s, -70 * s, 8 * s, 70 * s), 4, 4), fill('#A9DBFF'));
    }
  } else if (prop.type === 'hoop') {
    const oval = Skia.XYWHRect(-8 * s, -78 * s, 16 * s, 70 * s);
    if (pass === 'back') {
      canvas.drawArc(oval, 90, 180, false, stroke('#FFB3DA', 8 * s));
    } else {
      canvas.drawArc(oval, 270, 180, false, stroke('#FFB3DA', 8 * s));
      canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(-4 * s, -16 * s, 8 * s, 20 * s), 3, 3), fill('#D9C6F5'));
    }
  } else if (prop.type === 'cones') {
    const xs = [-60, -20, 20, 60];
    xs.forEach((x, index) => {
      const behind = index % 2 === 0;
      if ((pass === 'front') !== behind) {
        return;
      }
      const cx = x * s;
      const path = Skia.Path.Make();
      path.moveTo(cx - 12 * s, 0);
      path.lineTo(cx, -36 * s);
      path.lineTo(cx + 12 * s, 0);
      path.close();
      canvas.drawPath(path, fill(index % 2 === 0 ? '#FF9EB5' : '#A9DBFF'));
    });
  }
  canvas.restore();
}

function stroke(color: string, width: number) {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(width);
  paint.setColor(Skia.Color(color));
  return paint;
}
