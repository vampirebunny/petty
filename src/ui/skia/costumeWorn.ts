import { Skia } from '@shopify/react-native-skia';
import type { SkCanvas, SkSVG } from '@shopify/react-native-skia';

import type { WearItem } from '../../actor/wardrobe';
import { costumeWornXml } from '../../runway/costumeSvgXml';

const cache = new Map<string, SkSVG | null>();

/** True only for runway costume WearItems that have worn SVG art (Closet ids may collide). */
export function usesCostumeWorn(item: Pick<WearItem, 'id' | 'costume'> | null | undefined): boolean {
  return Boolean(item?.costume && costumeWornXml[item.id]);
}

/** @deprecated Prefer usesCostumeWorn — id alone collides with Closet (crown, bowtie, vest, bandana). */
export function hasCostumeWornArt(id: string): boolean {
  return Boolean(costumeWornXml[id]);
}

function wornSvg(id: string): SkSVG | null {
  if (cache.has(id)) {
    return cache.get(id) ?? null;
  }
  const xml = costumeWornXml[id];
  if (!xml) {
    cache.set(id, null);
    return null;
  }
  const svg = Skia.SVG.MakeFromString(xml);
  cache.set(id, svg);
  return svg;
}

/** Parse viewBox="minX minY w h" from the worn SVG xml. */
function viewBoxOf(id: string): { minX: number; minY: number; w: number; h: number } | null {
  const xml = costumeWornXml[id];
  if (!xml) {
    return null;
  }
  const match = /viewBox="([^"]+)"/.exec(xml);
  if (!match?.[1]) {
    return null;
  }
  const parts = match[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length < 4 || parts.some((n) => Number.isNaN(n))) {
    return null;
  }
  return { minX: parts[0]!, minY: parts[1]!, w: parts[2]!, h: parts[3]! };
}

type DrawOpts = {
  /** Uniform scale (hat/glasses/neck/back/boots) or separate axes for jacket. */
  scale: number | { x: number; y: number };
  /** Extra alpha (far boots). */
  alpha?: number;
};

/**
 * Draw a worn costume SVG with its catalog origin at (0,0).
 * The worn files are authored so (0,0) is the slot origin.
 */
export function drawCostumeWorn(c: SkCanvas, id: string, opts: DrawOpts): boolean {
  const svg = wornSvg(id);
  const vb = viewBoxOf(id);
  if (!svg || !vb) {
    return false;
  }
  const sx = typeof opts.scale === 'number' ? opts.scale : opts.scale.x;
  const sy = typeof opts.scale === 'number' ? opts.scale : opts.scale.y;
  const alpha = opts.alpha ?? 1;
  c.save();
  if (alpha < 0.999) {
    const fade = Skia.Paint();
    fade.setAlphaf(alpha);
    c.saveLayer(fade);
  }
  c.scale(sx, sy);
  c.translate(vb.minX, vb.minY);
  c.drawSvg(svg, vb.w, vb.h);
  if (alpha < 0.999) {
    c.restore();
  }
  c.restore();
  return true;
}
