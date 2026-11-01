import { PaintStyle, Skia, TileMode } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import type { VenueFx } from '../../runway/venueFxData';
import { layerOffset, venueLedLocalY, venuePawY, venueTileWidth } from '../../runway/venue';

export type VenueFxParticle = {
  x: number;
  y: number;
  v: number;
  ph: number;
  c: string;
  r: number;
  a: number;
};

export type VenueFxFlash = { x: number; y: number; life: number };

export type VenueFxRuntime = {
  parts: VenueFxParticle[];
  flashes: VenueFxFlash[];
  nextFlash: number;
  star: { x: number; y: number; life: number } | null;
  t: number;
};

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

function rnd(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export function createVenueFxRuntime(fx: VenueFx): VenueFxRuntime {
  const parts: VenueFxParticle[] = [];
  const n = fx.particles === 'none' ? 0 : 28;
  for (let i = 0; i < n; i += 1) {
    parts.push({
      x: Math.random(),
      y: Math.random(),
      v: rnd(0.4, 1),
      ph: rnd(0, Math.PI * 2),
      c: fx.colors[i % Math.max(fx.colors.length, 1)] ?? '#FFFFFF',
      r: rnd(0.6, 1.4),
      a: rnd(0, Math.PI * 2),
    });
  }
  return { parts, flashes: [], nextFlash: 0.6, star: null, t: 0 };
}

function paintFill(color: string) {
  const p = Skia.Paint();
  p.setColor(Skia.Color(color));
  return p;
}

function glowAt(canvas: SkCanvas, x: number, y: number, r: number, color: string, a: number) {
  if (r <= 0 || a <= 0) {
    return;
  }
  const paint = Skia.Paint();
  paint.setShader(
    Skia.Shader.MakeRadialGradient(
      Skia.Point(x, y),
      r,
      [Skia.Color(hexA(color, a)), Skia.Color(hexA(color, 0))],
      [0, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawCircle(x, y, r, paint);
}

function eachTile(
  scroll: number,
  speed: number,
  scale: number,
  width: number,
  fn: (ox: number) => void,
) {
  const tile = venueTileWidth * scale;
  const offset = layerOffset(scroll, speed, scale);
  const copies = Math.ceil(width / Math.max(tile, 1)) + 2;
  for (let i = 0; i < copies; i += 1) {
    fn(offset + i * tile);
  }
}

function drawDiamond(canvas: SkCanvas, r: number, color: string, alpha: number) {
  const paint = paintFill(hexA(color, alpha));
  const path = Skia.Path.Make();
  path.moveTo(0, -r * 2);
  path.lineTo(r * 0.4, 0);
  path.lineTo(0, r * 2);
  path.lineTo(-r * 0.4, 0);
  path.close();
  canvas.drawPath(path, paint);
  const path2 = Skia.Path.Make();
  path2.moveTo(-r * 2, 0);
  path2.lineTo(0, r * 0.4);
  path2.lineTo(r * 2, 0);
  path2.lineTo(0, -r * 0.4);
  path2.close();
  canvas.drawPath(path2, paint);
}

export function advanceVenueFx(
  runtime: VenueFxRuntime,
  fx: VenueFx,
  dt: number,
  opts: { playing: boolean; scrollDir: 1 | -1; reducedMotion: boolean; width: number; scale: number },
): void {
  if (opts.reducedMotion) {
    return;
  }
  runtime.t += dt;
  const type = fx.particles;
  const W = opts.width;
  const s = opts.scale;
  for (const p of runtime.parts) {
    const tw = 0.5 + 0.5 * Math.sin(runtime.t * 3 * p.v + p.ph);
    void tw;
    if (type === 'snow') {
      p.y += dt * 0.06 * p.v;
      p.x += Math.sin(runtime.t + p.ph) * 0.0004;
    } else if (type === 'confetti' || type === 'glitter' || type === 'petals') {
      p.y += dt * (type === 'glitter' ? 0.03 : 0.07) * p.v;
      p.a += dt * 3 * p.v;
      p.x += Math.sin(runtime.t * 1.5 + p.ph) * 0.0006;
    } else if (type === 'bubbles') {
      p.y -= dt * 0.07 * p.v;
      p.x += Math.sin(runtime.t * 2 + p.ph) * 0.0005;
    } else if (type === 'fireflies' || type === 'dust') {
      p.x += Math.sin(runtime.t * 0.7 + p.ph) * 0.0004;
      p.y += Math.cos(runtime.t * 0.5 + p.ph) * 0.0004;
    }
    if (opts.playing) {
      p.x -= (opts.scrollDir * 160 * 0.3 * dt) / Math.max(W / s, 1);
    }
    if (p.y > 1.05) {
      p.y = -0.05;
    }
    if (p.y < -0.05) {
      p.y = 1.05;
    }
    if (p.x > 1.05) {
      p.x = -0.05;
    }
    if (p.x < -0.05) {
      p.x = 1.05;
    }
  }
}

type DrawFxOpts = {
  width: number;
  height: number;
  scale: number;
  stageTop: number;
  scroll: number;
  scrollDir: 1 | -1;
  reducedMotion: boolean;
  fxEnabled: boolean;
  /** Pet center X for follow spot; defaults to screen center. */
  petCenterX?: number;
  dt: number;
};

export function drawVenueExtras(
  canvas: SkCanvas,
  fx: VenueFx,
  runtime: VenueFxRuntime,
  opts: DrawFxOpts,
): void {
  if (!opts.fxEnabled) {
    return;
  }
  const s = opts.scale;
  const W = opts.width;
  const t = runtime.t;
  const extra = fx.extra;
  const anc = fx.anchors;
  if (anc) {
    const speed = anc.layer === '1-backdrop' ? 0.1 : anc.layer === '3-near' ? 0.6 : 0.3;
    eachTile(opts.scroll, speed, s, W, (ox) => {
      anc.points.forEach((pt, i) => {
        const pulse = 0.5 + 0.5 * Math.sin(t * (extra === 'stringLightTwinkle' ? 3 : 1.2) + i * 1.7);
        const big = extra === 'sunPulse' ? 220 : extra === 'stringLightTwinkle' ? 30 : 120;
        glowAt(
          canvas,
          ox + pt[0]! * s,
          opts.stageTop + pt[1]! * s,
          big * s * (0.85 + 0.15 * pulse),
          extra === 'stringLightTwinkle' ? '#FFE08A' : '#FFF4C2',
          opts.reducedMotion ? 0.35 : 0.25 + 0.35 * pulse,
        );
        if (extra === 'chandelierTwinkle' && !opts.reducedMotion) {
          for (let j = 0; j < 5; j += 1) {
            const a = t * 2 + j * 1.3 + i;
            const tw = Math.max(0, Math.sin(a * 2.3));
            const paint = paintFill(hexA('#FFFFFF', tw));
            canvas.drawCircle(
              ox + (pt[0]! + Math.cos(j * 1.25) * 60) * s,
              opts.stageTop + (pt[1]! - 40 + Math.sin(j * 2.1) * 30) * s,
              3 * s,
              paint,
            );
          }
        }
      });
    });
  }
  if (opts.reducedMotion) {
    return;
  }
  if (extra === 'shootingStar') {
    if (!runtime.star || runtime.star.life <= 0) {
      if (Math.random() < opts.dt * 0.25) {
        runtime.star = { x: rnd(0.1, 0.8) * W, y: opts.stageTop + rnd(40, 200) * s, life: 0.9 };
      }
    }
    if (runtime.star && runtime.star.life > 0) {
      runtime.star.life -= opts.dt;
      runtime.star.x += 700 * s * opts.dt;
      runtime.star.y += 220 * s * opts.dt;
      const paint = Skia.Paint();
      paint.setStrokeWidth(3 * s);
      paint.setStyle(PaintStyle.Stroke);
      paint.setShader(
        Skia.Shader.MakeLinearGradient(
          Skia.Point(runtime.star.x - 160 * s, runtime.star.y - 50 * s),
          Skia.Point(runtime.star.x, runtime.star.y),
          [Skia.Color('rgba(255,255,255,0)'), Skia.Color('rgba(255,255,255,0.95)')],
          [0, 1],
          TileMode.Clamp,
        ),
      );
      const path = Skia.Path.Make();
      path.moveTo(runtime.star.x - 160 * s, runtime.star.y - 50 * s);
      path.lineTo(runtime.star.x, runtime.star.y);
      canvas.drawPath(path, paint);
    }
  } else if (extra === 'causticShimmer' || extra === 'auroraDrift') {
    canvas.save();
    for (let i = 0; i < 4; i += 1) {
      const cx = ((i * 0.3 + t * 0.03) % 1.2) * W - 0.1 * W;
      if (extra === 'causticShimmer') {
        const paint = paintFill('rgba(255,255,255,0.07)');
        const path = Skia.Path.Make();
        path.moveTo(cx, opts.stageTop);
        path.lineTo(cx + 70 * s, opts.stageTop);
        path.lineTo(cx - 60 * s, opts.stageTop + 600 * s);
        path.lineTo(cx - 150 * s, opts.stageTop + 600 * s);
        path.close();
        canvas.drawPath(path, paint);
      } else {
        const cols = [
          'rgba(155,255,200,0.16)',
          'rgba(185,166,240,0.16)',
          'rgba(247,169,201,0.14)',
          'rgba(155,255,200,0.12)',
        ];
        const paint = paintFill(cols[i]!);
        paint.setStrokeWidth((30 - i * 5) * s);
        paint.setStyle(PaintStyle.Stroke);
        const path = Skia.Path.Make();
        for (let x = 0; x <= W; x += 20 * s) {
          const yy = opts.stageTop + (120 + i * 30) * s + Math.sin(x / (160 * s) + t * 0.5 + i) * 30 * s;
          if (x === 0) {
            path.moveTo(x, yy);
          } else {
            path.lineTo(x, yy);
          }
        }
        canvas.drawPath(path, paint);
      }
    }
    canvas.restore();
  } else if (extra === 'fog') {
    for (let f = 0; f < 3; f += 1) {
      const fx2 = ((f * 0.4 + t * 0.015) % 1.4) * W - 0.2 * W;
      glowAt(canvas, fx2, opts.stageTop + 560 * s, 260 * s, '#C9B8F5', 0.18);
    }
  } else if (extra === 'searchlights') {
    canvas.save();
    [0.25, 0.75].forEach((u, i) => {
      const bx = u * W;
      const by = opts.stageTop + 600 * s;
      const a = Math.sin(t * 0.5 + i * 2) * 0.5;
      canvas.save();
      canvas.translate(bx, by);
      canvas.rotate((a * 180) / Math.PI, 0, 0);
      const paint = Skia.Paint();
      paint.setShader(
        Skia.Shader.MakeLinearGradient(
          Skia.Point(0, 0),
          Skia.Point(0, -600 * s),
          [Skia.Color('rgba(255,255,255,0.28)'), Skia.Color('rgba(255,255,255,0)')],
          [0, 1],
          TileMode.Clamp,
        ),
      );
      const path = Skia.Path.Make();
      path.moveTo(-14 * s, 0);
      path.lineTo(14 * s, 0);
      path.lineTo(90 * s, -620 * s);
      path.lineTo(-90 * s, -620 * s);
      path.close();
      canvas.drawPath(path, paint);
      canvas.restore();
    });
    canvas.restore();
  }
}

export function drawVenueParticles(
  canvas: SkCanvas,
  fx: VenueFx,
  runtime: VenueFxRuntime,
  opts: DrawFxOpts,
): void {
  if (!opts.fxEnabled || opts.reducedMotion || fx.particles === 'none') {
    return;
  }
  const s = opts.scale;
  const W = opts.width;
  const H = 600 * s;
  const type = fx.particles;
  const t = runtime.t;
  for (const p of runtime.parts) {
    let x = p.x * W;
    let y = opts.stageTop + p.y * H;
    const tw = 0.5 + 0.5 * Math.sin(t * 3 * p.v + p.ph);
    canvas.save();
    if (type === 'glints') {
      y = opts.stageTop + (380 + p.y * 100) * s;
    }
    canvas.translate(x, y);
    if (type === 'stars' || type === 'sparkle' || type === 'glints') {
      const r = (type === 'stars' ? 2.2 : 5) * p.r * s * (0.4 + tw);
      drawDiamond(canvas, r, p.c, 0.3 + 0.7 * tw);
    } else if (type === 'bubbles') {
      const paint = paintFill('#FFFFFF');
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(2 * s);
      paint.setAlphaf(0.8);
      canvas.drawCircle(0, 0, 7 * p.r * s, paint);
    } else if (type === 'snow') {
      canvas.drawCircle(0, 0, 3.4 * p.r * s, paintFill(hexA('#FFFFFF', 0.9)));
    } else if (type === 'confetti' || type === 'glitter') {
      canvas.rotate((p.a * 180) / Math.PI, 0, 0);
      const w = (type === 'glitter' ? 4 : 7) * p.r * s;
      canvas.drawRect(
        Skia.XYWHRect(-w / 2, -w * 0.3, w, w * Math.abs(Math.cos(p.a)) * 0.9 + 1),
        paintFill(hexA(p.c, 0.9)),
      );
    } else if (type === 'petals') {
      canvas.rotate((p.a * 180) / Math.PI, 0, 0);
      canvas.drawOval(
        Skia.XYWHRect(-7 * p.r * s, -3.6 * p.r * s, 14 * p.r * s, 7.2 * p.r * s),
        paintFill(hexA(p.c, 0.9)),
      );
    } else if (type === 'fireflies') {
      glowAt(canvas, 0, 0, 14 * s, p.c, 0.9 * tw);
    } else {
      canvas.drawCircle(0, 0, 2.4 * p.r * s, paintFill(hexA(p.c, 0.35 + 0.35 * tw)));
    }
    canvas.restore();
  }
}

export function drawVenueBeams(
  canvas: SkCanvas,
  fx: VenueFx,
  runtime: VenueFxRuntime,
  opts: DrawFxOpts,
): void {
  if (!opts.fxEnabled) {
    return;
  }
  const s = opts.scale;
  const W = opts.width;
  const t = runtime.t;
  const pawY = opts.stageTop + venuePawY * s;
  const cx = opts.petCenterX ?? W / 2;

  canvas.save();
  if (!opts.reducedMotion) {
    eachTile(opts.scroll, 0.8, s, W, (ox) => {
      fx.fixtures.x.forEach((fxX, i) => {
        const x = ox + fxX * s;
        const y = opts.stageTop + fx.fixtures.y * s;
        const a = Math.sin(t * 0.7 + i * 0.9) * 0.32;
        const col = fx.beams[i % 2] ?? '#FFFFFF';
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate((a * 180) / Math.PI, 0, 0);
        const len = ((venuePawY - fx.fixtures.y) * s) / Math.max(Math.cos(a), 0.2);
        const paint = Skia.Paint();
        paint.setShader(
          Skia.Shader.MakeLinearGradient(
            Skia.Point(0, 0),
            Skia.Point(0, len),
            [Skia.Color(hexA(col, 0.38)), Skia.Color(hexA(col, 0.02))],
            [0, 1],
            TileMode.Clamp,
          ),
        );
        const path = Skia.Path.Make();
        path.moveTo(-8 * s, 0);
        path.lineTo(8 * s, 0);
        path.lineTo(60 * s, len);
        path.lineTo(-60 * s, len);
        path.close();
        canvas.drawPath(path, paint);
        canvas.restore();
        glowAt(canvas, x, y, 30 * s, col, 0.55 + 0.25 * Math.sin(t * 4 + i));
      });
    });
  } else {
    // Static lit fixtures only.
    eachTile(opts.scroll, 0.8, s, W, (ox) => {
      fx.fixtures.x.forEach((fxX, i) => {
        const col = fx.beams[i % 2] ?? '#FFFFFF';
        glowAt(canvas, ox + fxX * s, opts.stageTop + fx.fixtures.y * s, 22 * s, col, 0.55);
      });
    });
  }

  const spotA = 0.42;
  const spot = Skia.Paint();
  spot.setShader(
    Skia.Shader.MakeLinearGradient(
      Skia.Point(cx, opts.stageTop),
      Skia.Point(cx, pawY),
      [Skia.Color('rgba(255,250,235,0)'), Skia.Color(`rgba(255,250,235,${spotA})`)],
      [0, 1],
      TileMode.Clamp,
    ),
  );
  const cone = Skia.Path.Make();
  cone.moveTo(cx - 24 * s, opts.stageTop);
  cone.lineTo(cx + 24 * s, opts.stageTop);
  cone.lineTo(cx + 130 * s, pawY);
  cone.lineTo(cx - 130 * s, pawY);
  cone.close();
  canvas.drawPath(cone, spot);
  canvas.drawOval(Skia.XYWHRect(cx - 140 * s, pawY - 14 * s, 280 * s, 28 * s), paintFill('rgba(255,250,235,0.45)'));
  canvas.restore();
}

export function drawVenueLedChase(
  canvas: SkCanvas,
  fx: VenueFx,
  runtime: VenueFxRuntime,
  opts: DrawFxOpts,
): void {
  if (!opts.fxEnabled) {
    return;
  }
  const s = opts.scale;
  const y = opts.stageTop + (670 + venueLedLocalY) * s;
  const dir = opts.scrollDir;
  const t = opts.reducedMotion ? 0 : runtime.t;
  eachTile(opts.scroll, 1, s, opts.width, (ox) => {
    for (let i = 0; i < 10; i += 1) {
      const x = ox + ((((i * 120 + t * 260 * dir) % 1200) + 1200) % 1200) * s;
      glowAt(canvas, x, y, 26 * s, fx.led, opts.reducedMotion ? 0.55 : 0.8);
    }
  });
}

export function drawVenueFlashes(
  canvas: SkCanvas,
  fx: VenueFx,
  runtime: VenueFxRuntime,
  opts: DrawFxOpts,
): void {
  if (!opts.fxEnabled || opts.reducedMotion) {
    return;
  }
  const s = opts.scale;
  const t = runtime.t;
  if (t > runtime.nextFlash) {
    runtime.flashes.push({
      x: rnd(0.05, 0.95) * opts.width,
      y: opts.stageTop + rnd(840, 900) * s,
      life: 0.28,
    });
    runtime.nextFlash = t + rnd(0.35, 1.4);
  }
  runtime.flashes = runtime.flashes.filter((f) => f.life > 0);
  for (const f of runtime.flashes) {
    const a = f.life / 0.28;
    f.life -= opts.dt;
    glowAt(canvas, f.x, f.y, 90 * s * (1.2 - a * 0.2), fx.flash || '#FFFFFF', 0.85 * a);
    canvas.drawRect(Skia.XYWHRect(f.x - 7 * s, f.y - 5 * s, 14 * s, 10 * s), paintFill(`rgba(255,255,255,${a})`));
  }
  if (fx.extra === 'strobe' && t % 2.6 < 0.08) {
    canvas.drawRect(Skia.XYWHRect(0, 0, opts.width, opts.height), paintFill('rgba(255,255,255,0.22)'));
  }
}
