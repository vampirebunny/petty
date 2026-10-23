import { compileScene } from '../../actor/scenes';
import type { Scene } from '../../actor/scenes';

// One ground line. Walk targets stay inside a short left-right span, and the
// half-pixel floor band gives the sim nowhere to move up or down.
export const shopAnchor = { x: 320, y: 400.2 };

export const shopPetScene: Scene = compileScene({
  v: 1,
  id: 'shop',
  name: 'Shop',
  time: 'indoor',
  sky: ['#FFE6F2', '#FFE6F2'],
  floor: {
    horizon: 360,
    yMin: 400,
    yMax: 400.4,
    xMin: 278,
    xMax: 362,
    color: ['#FFE6F2', '#FFE6F2'],
    pattern: 'none',
  },
  props: [],
  pois: [{ id: 'home', type: 'home', x: shopAnchor.x, y: shopAnchor.y }],
});
