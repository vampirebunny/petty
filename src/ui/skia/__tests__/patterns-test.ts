import { patternAngle, patternPaint, patternUnit } from '../patternSpec';
import { wearItem } from '../../../actor/wardrobe';

it('rounds a pattern tile to the nearest half pixel', () => {
  expect(patternUnit(3.2)).toBe(3);
  expect(patternUnit(3.3)).toBe(3.5);
  expect(patternUnit(0.1)).toBe(0.5);
});

it('tilts scarf stripes and leaves hat stripes horizontal', () => {
  const scarf = wearItem('neckwear', 'scarf-stripe');
  const beanie = wearItem('hat', 'beanie-stripe');
  expect(scarf && patternAngle(scarf)).toBe(30);
  expect(beanie && patternAngle(beanie)).toBe(0);
});

it('patterns only the parts a piece names', () => {
  const hat = wearItem('hat', 'top-velvet');
  expect(hat && patternPaint(hat, 'band', 4)?.id).toBe('stars');
  expect(hat && patternPaint(hat, 'crown', 4)).toBeNull();
  const plain = wearItem('hat', 'top');
  expect(plain && patternPaint(plain, 'band', 4)).toBeNull();
});
