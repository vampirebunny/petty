import type { RunwayThemeId } from './catalog';
import { venueFxByTheme, type VenueFx } from './venueFxData';
import { venueSvgXml } from './venueSvgXml';

export const venueLayerFiles = [
  '1-backdrop.svg',
  '2-far.svg',
  '3-near.svg',
  '4-truss.svg',
  '5-crowd.svg',
  '6-runway.svg',
  '7-front.svg',
] as const;

/** Stack positions from docs/boopboop-venues/README.md (v2). */
export const venueLayerLayout = [
  { y: 0, height: 600, speed: 0.1 },
  { y: 0, height: 600, speed: 0.3 },
  { y: 0, height: 600, speed: 0.6 },
  { y: 0, height: 130, speed: 0.8 },
  { y: 600, height: 70, speed: 0.75 },
  { y: 670, height: 150, speed: 1.0 },
  { y: 820, height: 170, speed: 1.25 },
] as const;

export const venueStackHeight = 990;
export const venueTileWidth = 1200;
/** Paw line on the runway surface (stack coordinates). */
export const venuePawY = 687;
/** LED strip y within the runway layer (runway-local). */
export const venueLedLocalY = 46;

export function venueXml(themeId: RunwayThemeId): readonly string[] {
  return venueSvgXml[themeId] ?? venueSvgXml.space;
}

export function venueFx(themeId: RunwayThemeId): VenueFx {
  return venueFxByTheme[themeId] ?? venueFxByTheme.space;
}

export function venueScale(screenHeight: number): number {
  return screenHeight / venueStackHeight;
}

/**
 * Parallax offset for a layer. `scroll` is in stack (unscaled) px — same units as
 * docs/boopboop-venues and the strips mock: offset = -(((scroll × k × s) mod tw) + tw) % tw.
 */
export function layerOffset(scroll: number, speed: number, scale: number): number {
  const tile = venueTileWidth * scale;
  if (tile <= 0) {
    return 0;
  }
  const tw = tile;
  return -(((scroll * speed * scale) % tw) + tw) % tw;
}

/** Pull the solid backdrop fill from `1-backdrop.svg` for letterboxing. */
export function themeSkyColor(themeId: RunwayThemeId): string {
  const sky = venueXml(themeId)[0] ?? '';
  const match = /<rect[^>]*fill="(#[0-9A-Fa-f]{3,8})"/i.exec(sky);
  return match?.[1] ?? '#1a1530';
}
