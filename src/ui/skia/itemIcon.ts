import { Skia } from '@shopify/react-native-skia';
import type { SkCanvas, SkPicture } from '@shopify/react-native-skia';

import { wardrobeSizes } from '../../actor/data/wardrobeSizes';
import { jacketHasSleeves, type WearItem } from '../../actor/wardrobe';
import type { OutfitSlot } from '../../sim/types';
import {
  drawBoot,
  drawGlassesBack,
  drawGlassesFront,
  drawHatShape,
  drawHood,
  setOutlineScale,
  drawJacket,
  drawJacketCollar,
  drawNeckwear,
  drawSleeve,
} from './cosmetics';
import { iconFace, iconGeom } from './iconRig';

export const ICON_BOX = 100;

// A neck seen from the side, rising up and forward, the way neckwear is worn in play.
const ALONG = { x: 0.6, y: -0.8 };
const PERP = { x: 0.8, y: 0.6 };

// `bg` is the color the icon sits on. It is passed as the fur color, so the trim logic
// adds contrast when an item is close to its background.
export function drawItemIcon(c: SkCanvas, slot: OutfitSlot, item: WearItem, bg: string): void {
  if (slot === 'hat') {
    // Hats sit on the shelf: the head's top line is near the bottom of the box.
    c.save();
    c.translate(50, 86);
    drawHatShape(c, item, 30, bg, undefined, 'side', 0, false, true);
    c.restore();
    return;
  }
  if (slot === 'glasses') {
    const face = iconFace();
    c.save();
    c.translate(50, 50);
    drawGlassesBack(c, item, face, 34, bg);
    drawGlassesFront(c, item, face, 34, bg);
    c.restore();
    return;
  }
  if (slot === 'neckwear') {
    drawNeckwear(c, { x: 46, y: 30 }, PERP, ALONG, item, 0, 30, bg, 0);
    return;
  }
  const g = iconGeom();
  if (slot === 'jacket') {
    const k = 82 / (g.bodyLen * 1.15);
    c.save();
    c.translate(48, 56);
    c.scale(k, k);
    c.translate(0, -g.bodyY);
    const base = { x: g.bodyLen / 2 - 14, y: g.bodyY - 2 };
    const neckWidth = g.headR * 1.35;
    setOutlineScale(1 / k);
    try {
      if (item.shape === 'hoodie') {
        drawHood(c, base, PERP, ALONG, item, g.headR, neckWidth, bg);
      }
      drawJacket(c, g, item, 1, bg);
      if (jacketHasSleeves(item)) {
        const hip = { x: g.bodyLen * 0.28, y: g.bodyY + g.bodyH * 0.25 };
        drawSleeve(c, hip, { x: hip.x + 2, y: hip.y + g.L * 0.45 }, g, item, false, bg);
      }
      drawJacketCollar(c, base, PERP, ALONG, item, g.headR, neckWidth, bg);
    } finally {
      setOutlineScale(1);
    }
    c.restore();
    return;
  }
  const seg = g.L / 2;
  const k = 70 / (seg * (1 - wardrobeSizes.bootTop) + g.pawRy * 2.5);
  c.save();
  c.translate(46, 86);
  c.scale(k, k);
  setOutlineScale(1 / k);
  try {
    drawBoot(c, { x: 7, y: -seg }, { x: 7, y: 0 }, g, item, true, bg, 0);
    drawBoot(c, { x: -6, y: -seg }, { x: -6, y: 0 }, g, item, false, bg, 0);
  } finally {
    setOutlineScale(1);
  }
  c.restore();
}

const pictures = new Map<string, SkPicture>();

export function itemIconPicture(slot: OutfitSlot, item: WearItem, bg: string): SkPicture {
  const key = `${slot}:${item.id}:${bg}`;
  const hit = pictures.get(key);
  if (hit) {
    return hit;
  }
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, ICON_BOX, ICON_BOX));
  drawItemIcon(canvas, slot, item, bg);
  const picture = recorder.finishRecordingAsPicture();
  pictures.set(key, picture);
  return picture;
}
