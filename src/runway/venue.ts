import type { RunwayThemeId } from './catalog';

export const venueLayerFiles = [
  '1-sky.svg',
  '2-far.svg',
  '3-near.svg',
  '4-audience-back.svg',
  '5-floor.svg',
  '6-audience-front.svg',
] as const;

export const venueLayerSpeeds = [0.1, 0.3, 0.6, 0.75, 1.0, 1.25] as const;

export const venueStackHeight = 950;
export const venueTileWidth = 1200;
export const venuePawY = 732;

/** Metro needs static requires per theme folder. */
const venueAssets: Record<RunwayThemeId, number[]> = {
  space: [
    require('../../assets/runway/space/1-sky.svg'),
    require('../../assets/runway/space/2-far.svg'),
    require('../../assets/runway/space/3-near.svg'),
    require('../../assets/runway/space/4-audience-back.svg'),
    require('../../assets/runway/space/5-floor.svg'),
    require('../../assets/runway/space/6-audience-front.svg'),
  ],
  sea: [
    require('../../assets/runway/sea/1-sky.svg'),
    require('../../assets/runway/sea/2-far.svg'),
    require('../../assets/runway/sea/3-near.svg'),
    require('../../assets/runway/sea/4-audience-back.svg'),
    require('../../assets/runway/sea/5-floor.svg'),
    require('../../assets/runway/sea/6-audience-front.svg'),
  ],
  royal: [
    require('../../assets/runway/royal/1-sky.svg'),
    require('../../assets/runway/royal/2-far.svg'),
    require('../../assets/runway/royal/3-near.svg'),
    require('../../assets/runway/royal/4-audience-back.svg'),
    require('../../assets/runway/royal/5-floor.svg'),
    require('../../assets/runway/royal/6-audience-front.svg'),
  ],
  beach: [
    require('../../assets/runway/beach/1-sky.svg'),
    require('../../assets/runway/beach/2-far.svg'),
    require('../../assets/runway/beach/3-near.svg'),
    require('../../assets/runway/beach/4-audience-back.svg'),
    require('../../assets/runway/beach/5-floor.svg'),
    require('../../assets/runway/beach/6-audience-front.svg'),
  ],
  winter: [
    require('../../assets/runway/winter/1-sky.svg'),
    require('../../assets/runway/winter/2-far.svg'),
    require('../../assets/runway/winter/3-near.svg'),
    require('../../assets/runway/winter/4-audience-back.svg'),
    require('../../assets/runway/winter/5-floor.svg'),
    require('../../assets/runway/winter/6-audience-front.svg'),
  ],
  rock: [
    require('../../assets/runway/rock/1-sky.svg'),
    require('../../assets/runway/rock/2-far.svg'),
    require('../../assets/runway/rock/3-near.svg'),
    require('../../assets/runway/rock/4-audience-back.svg'),
    require('../../assets/runway/rock/5-floor.svg'),
    require('../../assets/runway/rock/6-audience-front.svg'),
  ],
  garden: [
    require('../../assets/runway/garden/1-sky.svg'),
    require('../../assets/runway/garden/2-far.svg'),
    require('../../assets/runway/garden/3-near.svg'),
    require('../../assets/runway/garden/4-audience-back.svg'),
    require('../../assets/runway/garden/5-floor.svg'),
    require('../../assets/runway/garden/6-audience-front.svg'),
  ],
  spooky: [
    require('../../assets/runway/spooky/1-sky.svg'),
    require('../../assets/runway/spooky/2-far.svg'),
    require('../../assets/runway/spooky/3-near.svg'),
    require('../../assets/runway/spooky/4-audience-back.svg'),
    require('../../assets/runway/spooky/5-floor.svg'),
    require('../../assets/runway/spooky/6-audience-front.svg'),
  ],
  west: [
    require('../../assets/runway/west/1-sky.svg'),
    require('../../assets/runway/west/2-far.svg'),
    require('../../assets/runway/west/3-near.svg'),
    require('../../assets/runway/west/4-audience-back.svg'),
    require('../../assets/runway/west/5-floor.svg'),
    require('../../assets/runway/west/6-audience-front.svg'),
  ],
  hero: [
    require('../../assets/runway/hero/1-sky.svg'),
    require('../../assets/runway/hero/2-far.svg'),
    require('../../assets/runway/hero/3-near.svg'),
    require('../../assets/runway/hero/4-audience-back.svg'),
    require('../../assets/runway/hero/5-floor.svg'),
    require('../../assets/runway/hero/6-audience-front.svg'),
  ],
  pirate: [
    require('../../assets/runway/pirate/1-sky.svg'),
    require('../../assets/runway/pirate/2-far.svg'),
    require('../../assets/runway/pirate/3-near.svg'),
    require('../../assets/runway/pirate/4-audience-back.svg'),
    require('../../assets/runway/pirate/5-floor.svg'),
    require('../../assets/runway/pirate/6-audience-front.svg'),
  ],
  safari: [
    require('../../assets/runway/safari/1-sky.svg'),
    require('../../assets/runway/safari/2-far.svg'),
    require('../../assets/runway/safari/3-near.svg'),
    require('../../assets/runway/safari/4-audience-back.svg'),
    require('../../assets/runway/safari/5-floor.svg'),
    require('../../assets/runway/safari/6-audience-front.svg'),
  ],
};

export function venueLayers(themeId: RunwayThemeId): number[] {
  return venueAssets[themeId] ?? venueAssets.space;
}

export function venueScale(screenHeight: number): number {
  return screenHeight / venueStackHeight;
}

export function layerOffset(scroll: number, speed: number, scale: number): number {
  const tile = venueTileWidth * scale;
  const raw = -((scroll * speed * scale) % tile);
  return raw > 0 ? raw - tile : raw;
}
