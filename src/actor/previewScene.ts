import { compileScene } from './scenes';
import type { Scene } from './scenes';

// A plain, fixed-light backdrop for the adoption preview. Scene data only: no props, no clock.
export const previewScene: Scene = compileScene({
  v: 1,
  id: 'preview',
  name: 'Preview',
  time: 'fixed',
  sky: ['#dfe9f5', '#eef3fa'],
  floor: {
    horizon: 190,
    yMin: 224,
    yMax: 314,
    color: ['#e6ddcf', '#d6cbb9'],
    pattern: 'planks',
    lineColor: 'rgba(70,40,10,0.12)',
  },
  props: [],
  pois: [{ id: 'home', type: 'home', x: 320, y: 270 }],
});

export const previewHome = { x: 320, y: 270 };
