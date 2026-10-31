import type { RunwayThemeId } from './catalog';
import { venueSvgXml } from './venueSvgXml';

export const venueLayerFiles = [
  '1-sky.svg',
  '2-far.svg',
  '3-near.svg',
  '4-audience-back.svg',
  '5-floor.svg',
  '6-audience-front.svg',
] as const;

/** Stack positions from docs/boopboop-venues/README.md. */
export const venueLayerLayout = [
  { y: 0, height: 600, speed: 0.1 },
  { y: 0, height: 600, speed: 0.3 },
  { y: 0, height: 600, speed: 0.6 },
  { y: 600, height: 70, speed: 0.75 },
  { y: 670, height: 110, speed: 1.0 },
  { y: 780, height: 170, speed: 1.25 },
] as const;

export const venueStackHeight = 950;
export const venueTileWidth = 1200;
export const venuePawY = 732;

export function venueXml(themeId: RunwayThemeId): readonly string[] {
  return venueSvgXml[themeId] ?? venueSvgXml.space;
}

export function venueScale(screenHeight: number): number {
  return screenHeight / venueStackHeight;
}

export function layerOffset(scroll: number, speed: number, scale: number): number {
  const tile = venueTileWidth * scale;
  if (tile <= 0) {
    return 0;
  }
  const raw = -((scroll * speed * scale) % tile);
  return raw > 0 ? raw - tile : raw;
}

/** Pull the solid sky fill from `1-sky.svg` for letterboxing above the stack. */
export function themeSkyColor(themeId: RunwayThemeId): string {
  const sky = venueXml(themeId)[0] ?? '';
  const match = /<rect[^>]*fill="(#[0-9A-Fa-f]{3,8})"/i.exec(sky);
  return match?.[1] ?? '#1a1530';
}
