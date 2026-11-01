import type { ImageSourcePropType } from 'react-native';

import type { RunwayThemeId } from './catalog';

export const themePreviewImages: Record<RunwayThemeId, ImageSourcePropType> = {
  space: require('../../assets/runway-themes/space.png'),
  sea: require('../../assets/runway-themes/sea.png'),
  royal: require('../../assets/runway-themes/royal.png'),
  beach: require('../../assets/runway-themes/beach.png'),
  winter: require('../../assets/runway-themes/winter.png'),
  rock: require('../../assets/runway-themes/rock.png'),
  garden: require('../../assets/runway-themes/garden.png'),
  spooky: require('../../assets/runway-themes/spooky.png'),
  west: require('../../assets/runway-themes/west.png'),
  hero: require('../../assets/runway-themes/hero.png'),
  pirate: require('../../assets/runway-themes/pirate.png'),
  safari: require('../../assets/runway-themes/safari.png'),
};

export function themePreview(id: string): ImageSourcePropType | null {
  if (Object.prototype.hasOwnProperty.call(themePreviewImages, id)) {
    return themePreviewImages[id as RunwayThemeId];
  }
  return null;
}
