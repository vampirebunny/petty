import { breedsFor } from '../breeds';
import { PET_SIZE, depthScale, geomOf, reachOf, rearOf, stageWidth, xRangeOf } from '../geometry';
import { scenes } from '../scenes';

describe('stage bounds', () => {
  const floor = scenes.livingroom.floor;
  for (const breed of [...breedsFor('dog'), ...breedsFor('cat')]) {
    for (const age of [0, 300, 1000]) {
      it(`keeps a ${breed.id} at day ${age} inside the stage at the front of the floor`, () => {
        const geom = geomOf(breed, age, 0);
        const scale = PET_SIZE * geom.sc * depthScale(floor.yMax, floor.yMin, floor.yMax);
        const { lo, hi } = xRangeOf(floor, geom, scale);
        expect(lo).toBeLessThanOrEqual(hi);
        expect(lo - rearOf(geom) * scale).toBeGreaterThanOrEqual(0);
        expect(hi + reachOf(geom) * scale).toBeLessThanOrEqual(stageWidth);
      });
    }
  }
});
