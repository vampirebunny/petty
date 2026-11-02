import { caseTileWidth } from '../bits';

it('keeps two columns on a phone pane', () => {
  expect(caseTileWidth(358)).toBeCloseTo(174);
});

it('keeps three columns for one-time badges on a narrow phone pane', () => {
  expect(caseTileWidth(328, 108, 10, 5, 3)).toBeCloseTo((328 - 20) / 3);
  expect(caseTileWidth(288, 108, 10, 5, 3)).toBeCloseTo((288 - 20) / 3);
});

it('opens a fourth column on a wide Trophy Case pane', () => {
  const wide = caseTileWidth(824);
  expect(wide).toBeCloseTo(198.5);
});
