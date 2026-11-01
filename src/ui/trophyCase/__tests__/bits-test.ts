import { caseTileWidth } from '../bits';

it('keeps two columns on a phone pane', () => {
  expect(caseTileWidth(358)).toBeCloseTo(174);
});

it('opens a fourth column on a wide Trophy Case pane', () => {
  const wide = caseTileWidth(824);
  expect(wide).toBeCloseTo(198.5);
});
