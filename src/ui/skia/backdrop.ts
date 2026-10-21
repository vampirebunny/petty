import { Skia } from '@shopify/react-native-skia';
import type { SkCanvas, SkPicture } from '@shopify/react-native-skia';

import { tuftsFor } from '../../actor';
import type { Scene } from '../../actor';
import { stageHeight, stageWidth } from '../../actor/geometry';
import type { Shape } from '../../actor/scenes';
import type { Env } from './env';
import { weatherOf } from './env';
import { activeTintKey, clamp01, css, gradRect, linear, mixc, rect, rgba, stroke } from './ink';
import { grassTone, foliageOf } from './nature';
import { drawShape } from './shapes';
import { drawSkyPane, skyColors } from './sky';
import { drawGroundSnow, drawPrecip, drawPuddles, drawSplashes } from './weatherFx';

// The static part of a backdrop (wall, back layers, floor, floor pattern) is recorded once into an
// SkPicture and replayed every frame. It is re-recorded only when what it bakes in changes: the
// tint bucket, the bleed, or the season's grass tone. Skies inside the layers stay live.

type Segment = { sky: Shape } | { shapes: Shape[] };

const segmentsByScene = new WeakMap<Scene, Segment[]>();
const pictures = new WeakMap<Scene, { key: string; wall: SkPicture | null; layers: (SkPicture | null)[]; floor: SkPicture }>();

function segmentsOf(scene: Scene): Segment[] {
  const hit = segmentsByScene.get(scene);
  if (hit) {
    return hit;
  }
  const out: Segment[] = [];
  let run: Shape[] = [];
  for (const shape of scene.layers) {
    if (shape.t === 'sky') {
      if (run.length) {
        out.push({ shapes: run });
        run = [];
      }
      out.push({ sky: shape });
    } else {
      run.push(shape);
    }
  }
  if (run.length) {
    out.push({ shapes: run });
  }
  segmentsByScene.set(scene, out);
  return out;
}

function record(bleed: number, draw: (c: SkCanvas) => void): SkPicture {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(-bleed - 4, -4, stageWidth + bleed * 2 + 8, stageHeight + 8));
  draw(canvas);
  return recorder.finishRecordingAsPicture();
}

function floorColors(scene: Scene, env: Env): [string, string] {
  const floor = scene.floor;
  if (scene.time === 'outdoor' && floor.pattern === 'grass') {
    const f = foliageOf(env);
    return [grassTone(floor.color[0], f), grassTone(floor.color[1], f)];
  }
  return [floor.color[0], floor.color[1]];
}

function drawFloorPattern(c: SkCanvas, scene: Scene, bleed: number): void {
  const floor = scene.floor;
  const color = floor.lineColor ?? 'rgba(0,0,0,0.12)';
  const left = -bleed;
  const right = stageWidth + bleed;
  const path = Skia.Path.Make();
  if (floor.pattern === 'lines') {
    for (let i = 1; i < 4; i += 1) {
      const y = floor.horizon + i * i * 9 + 6;
      path.moveTo(left, y);
      path.lineTo(right, y);
    }
  } else if (floor.pattern === 'planks') {
    // Rows widen with depth for perspective, then settle at a fixed height so the near floor
    // keeps tiling instead of stretching into a few huge planks.
    const ys: number[] = [];
    let rowHeight = 8;
    for (let y = floor.horizon; y < stageHeight; y += rowHeight) {
      ys.push(y);
      rowHeight = Math.min(rowHeight * 1.4, 64);
    }
    ys.push(stageHeight);
    for (const y of ys) {
      path.moveTo(left, y);
      path.lineTo(right, y);
    }
    for (let row = 0; row < ys.length - 1; row += 1) {
      const span = 40 + (ys[row + 1] - ys[row]) * 3.6;
      const offset = ((row % 2) * span) / 2;
      // A faint lighter strip on alternate planks so the floor reads as wood, not ruled paper.
      if (row % 3 === 1) {
        rect(c, left, ys[row] + 1, right - left, (ys[row + 1] - ys[row]) * 0.35, '#ffffff', 0.04);
      }
      for (let x = offset - span; x > left; x -= span) {
        path.moveTo(x, ys[row]);
        path.lineTo(x, ys[row + 1]);
      }
      for (let x = offset; x < right; x += span) {
        path.moveTo(x, ys[row]);
        path.lineTo(x, ys[row + 1]);
      }
    }
  } else {
    return;
  }
  c.drawPath(path, stroke(color, 1, 1));
}

/** Grass tufts, live: they lean with the wind and part around a pet's paws. */
function drawGrass(c: SkCanvas, scene: Scene, env: Env): void {
  if (scene.floor.pattern !== 'grass') {
    return;
  }
  const cover = weatherOf(env).snowCover;
  if (cover > 0.85) {
    return;
  }
  const f = foliageOf(env);
  const color = mixc(scene.floor.lineColor ?? 'rgba(0,0,0,0.12)', 'rgba(120,100,50,0.25)', (1 - f.lush) * 0.6);
  const wind = env.reduced ? 0 : env.wind ?? 0.2;
  const pets = env.contacts ?? [];
  const path = Skia.Path.Make();
  // On wide screens the tufts repeat into the bleed, so the lawn doesn't go bare at the sides.
  const bleed = env.bleed ?? 0;
  const tiles = bleed > 0 ? [-1, 0, 1] : [0];
  const tufts = tuftsFor(scene).flatMap((t) => tiles.map((tile) => (tile === 0 ? t : { ...t, x: t.x + tile * stageWidth })));
  for (const tuft of tufts) {
    if (tuft.x < -bleed - 10 || tuft.x > stageWidth + bleed + 10) {
      continue;
    }
    let lean = wind * 0.45 + (env.reduced ? 0 : Math.sin(env.t * 2 + tuft.x * 0.05) * 0.12);
    for (const pet of pets) {
      const dx = tuft.x - pet.x;
      const dy = tuft.y - pet.y;
      if (Math.abs(dx) < 30 && Math.abs(dy) < 12) {
        lean += Math.sign(dx || 1) * (1 - Math.abs(dx) / 30) * 0.9;
      }
    }
    const s = tuft.s;
    const tip = lean * s;
    path.moveTo(tuft.x - s * 0.5, tuft.y);
    path.lineTo(tuft.x - s * 0.7 + tip * 0.8, tuft.y - s);
    path.moveTo(tuft.x, tuft.y);
    path.lineTo(tuft.x + tip, tuft.y - s * 1.2);
    path.moveTo(tuft.x + s * 0.5, tuft.y);
    path.lineTo(tuft.x + s * 0.7 + tip * 0.8, tuft.y - s);
  }
  c.drawPath(path, stroke(color, 1.3, 1 - cover));
}

/**
 * Sky or wall, back layers, floor, ground weather and the flat `back` props. The caller sets the
 * scene tint (withTint) around this.
 */
export function drawBackdropLayers(c: SkCanvas, scene: Scene, env: Env, bleed: number, drawBackProps: () => void): void {
  const floor = scene.floor;
  const left = -bleed;
  const span = stageWidth + bleed * 2;
  const [floorTop, floorBottom] = floorColors(scene, env);
  const key = `${activeTintKey()}|${Math.round(bleed)}|${floorTop}|${floorBottom}`;
  let cache = pictures.get(scene);
  if (!cache || cache.key !== key) {
    const segments = segmentsOf(scene);
    cache = {
      key,
      wall: scene.time === 'outdoor' ? null : record(bleed, (pc) => gradRect(pc, left, 0, span, floor.horizon, scene.sky[0], scene.sky[1])),
      layers: segments.map((seg) =>
        'shapes' in seg
          ? record(bleed, (pc) => {
              for (const shape of seg.shapes) {
                drawShape(pc, shape, env);
              }
            })
          : null,
      ),
      floor: record(bleed, (pc) => {
        gradRect(pc, left, floor.horizon, span, stageHeight - floor.horizon, floorTop, floorBottom);
        drawFloorPattern(pc, scene, bleed);
      }),
    };
    pictures.set(scene, cache);
  }
  if (scene.time === 'outdoor') {
    // One sky across the whole width; the sun and moon still cross the stage itself.
    drawSkyPane(c, left, 0, span, floor.horizon, env, { x: 0, w: stageWidth });
  } else if (cache.wall) {
    c.drawPicture(cache.wall);
  }
  segmentsOf(scene).forEach((seg, i) => {
    const pic = cache?.layers[i];
    if (pic) {
      c.drawPicture(pic);
    } else if ('sky' in seg) {
      drawShape(c, seg.sky, env);
    }
  });
  if (scene.time === 'outdoor') {
    // Atmospheric haze: distant layers near the horizon fade toward the sky colour.
    const [, skyBottom] = skyColors(env);
    const k = rgba(skyBottom);
    c.drawRect(
      Skia.XYWHRect(left, floor.horizon * 0.45, span, floor.horizon * 0.55),
      linear(0, floor.horizon * 0.45, 0, floor.horizon, [css([k[0], k[1], k[2], 0]), skyBottom], null, 0.22),
    );
  }
  c.drawPicture(cache.floor);
  const roofed = scene.shelter === 'roofed';
  if (scene.time === 'outdoor') {
    const wet = weatherOf(env).wetness;
    if (wet > 0.03 && !roofed) {
      rect(c, left, floor.horizon, span, stageHeight - floor.horizon, '#24384a', 0.12 * clamp01(wet));
    }
    if (!roofed) {
      drawGroundSnow(c, scene, env);
    }
    drawGrass(c, scene, env);
    if (!roofed) {
      drawPuddles(c, scene, env);
      drawSplashes(c, scene, env);
    } else {
      // Under a roof the rain is only seen beyond the mesh.
      drawPrecip(c, left, 0, span, floor.horizon + 2, env, { scale: 0.8 });
    }
  }
  drawBackProps();
}
