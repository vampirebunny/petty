import { Skia, type SkCanvas } from '@shopify/react-native-skia';
import type { World } from '../actor/types';
import { parkFinds } from '../sim/parkFindsConfig';
import { parkFindSkiaImage } from './imageCache';

function paint(color: string, alpha = 1) {
  const p = Skia.Paint();
  p.setColor(Skia.Color(color));
  if (alpha < 1) {
    p.setAlphaf(alpha);
  }
  return p;
}

/** Draw park-find decals, particles, grass tuft, and the found item in the scene canvas. */
export function drawParkFindFx(canvas: SkCanvas, world: World): void {
  const visit = world.parkFindVisit;
  if (!visit) {
    return;
  }
  const now = world.t;

  for (const decal of visit.decals) {
    const age = now - decal.bornAt;
    const fade = age > parkFinds.holeFadeSec - 2 ? Math.max(0, 1 - (age - (parkFinds.holeFadeSec - 2)) / 2) : 1;
    if (fade <= 0) continue;
    const hw = 18 * decal.hole;
    const hh = 5 * decal.hole;
    if (hw > 0.5) {
      canvas.drawOval(Skia.XYWHRect(decal.x - hw, decal.y - hh, hw * 2, hh * 2), paint('#4A2E16', fade));
    }
    const mw = 52 * decal.mound;
    const mh = 15 * decal.mound;
    if (mw > 0.5) {
      canvas.drawOval(Skia.XYWHRect(decal.x - mw / 2, decal.y - mh - 2, mw, mh), paint('#8A5A2B', fade * 0.9));
    }
  }

  if (visit.grassTuft && visit.grassTuft.grow > 0.01) {
    const g = visit.grassTuft;
    canvas.save();
    canvas.translate(g.x, g.y);
    canvas.rotate(g.shake, 0, 0);
    const h = 28 * g.grow;
    for (let i = -2; i <= 2; i += 1) {
      canvas.drawLine(i * 4, 0, i * 5, -h, paint('#4F8A3A', 0.95));
    }
    canvas.restore();
  }

  for (const p of visit.particles) {
    const alpha = 1 - p.life / p.maxLife;
    if (p.kind === 'blade') {
      canvas.drawLine(p.x, p.y, p.x + 2, p.y - 8, paint(p.color, alpha));
    } else {
      canvas.drawCircle(p.x, p.y, p.size, paint(p.color, alpha));
    }
  }

  if (visit.goldFlashUntil > now) {
    const host = world.actors.find((a) => !a.guest);
    const run = host?.task.parkFind;
    const x = run?.spot.x ?? visit.spot?.x ?? 0;
    const y = run?.spot.y ?? visit.spot?.y ?? 0;
    const t = 1 - (visit.goldFlashUntil - now) / 0.4;
    const r = 20 + t * 36;
    canvas.drawCircle(x, y - 10, r, paint('#F5D76E', (1 - t) * 0.45));
  }

  const host = world.actors.find((a) => !a.guest);
  const run = host?.task.type === 'parkFind' ? host.task.parkFind : null;
  if (run && (run.revealed || run.carrying)) {
    if (run.carrying && host) {
      // mouthMark is the bite point (same for dog and cat). drawItem anchors the
      // sprite's bottom at y, so nudge down so the lower third sits in the mouth
      // instead of floating up on the snout / between the eyes.
      const mouth = host.mouthMark ?? { x: host.x, y: host.y - 40 };
      const grip = parkFinds.itemSceneHeight * 0.35;
      drawItem(canvas, run.itemId, mouth.x, mouth.y + grip, 0);
    } else {
      drawItem(canvas, run.itemId, run.itemX, run.itemY - run.itemZ, run.itemZ);
    }
  } else if (visit.revealed && visit.item && visit.modalDueAt != null && !visit.running) {
    // After drop, item sits in front until modal closes.
    const floor = world.scene.floor;
    drawItem(
      canvas,
      visit.item.id,
      (floor.xMin + floor.xMax) / 2,
      floor.yMax - parkFinds.dropFrontYOffset + 8,
      0,
    );
  }
}

function drawItem(canvas: SkCanvas, itemId: string, x: number, y: number, z: number): void {
  const h = parkFinds.itemSceneHeight;
  const w = h * (120 / 150);
  // Shadow
  canvas.drawOval(Skia.XYWHRect(x - w * 0.35, y + 2, w * 0.7, 6), paint('#000000', 0.18));
  const image = parkFindSkiaImage(itemId, { size: '2x' });
  if (image) {
    canvas.drawImageRect(
      image,
      Skia.XYWHRect(0, 0, image.width(), image.height()),
      Skia.XYWHRect(x - w / 2, y - h - z * 0, w, h),
      paint('#ffffff'),
    );
  } else {
    canvas.drawOval(Skia.XYWHRect(x - w / 2, y - h, w, h), paint('#E8D5FF'));
  }
}
