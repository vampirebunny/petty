import { compileScene } from './scenes';
import type { Scene } from './scenes';

// Solid backdrop for the adoption preview. Same color for sky and floor, no pattern, so the pet
// sits on a flat field instead of a room.
export const previewBackdrop = '#E8EEF5';

export const previewScene: Scene = compileScene({
  v: 1,
  id: 'preview',
  name: 'Preview',
  time: 'fixed',
  sky: [previewBackdrop, previewBackdrop],
  floor: {
    horizon: 190,
    yMin: 224,
    yMax: 314,
    color: [previewBackdrop, previewBackdrop],
    pattern: 'none',
  },
  props: [],
  pois: [{ id: 'home', type: 'home', x: 320, y: 270 }],
});

export const previewHome = { x: 320, y: 270 };
