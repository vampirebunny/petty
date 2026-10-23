import { chinAnchor, neckAxis } from '../cosmetics';

jest.mock('@shopify/react-native-skia', () => ({
  ClipOp: {},
  PathOp: {},
  Skia: {},
  StrokeCap: {},
  StrokeJoin: {},
}));

it('keeps a collapsed sleep neck pointing forward instead of through the face', () => {
  const head = { x: 40, y: -20 };
  const base = { x: 40.4, y: -19.2 };
  const axis = neckAxis(head, base, 30);
  expect(axis.x).toBeGreaterThan(0.9);
  expect(Math.abs(axis.y)).toBeLessThan(0.1);
});

it('parks sleep neckwear under the jaw', () => {
  const head = { x: 30, y: -24 };
  const base = { x: 31, y: -23 };
  const r = 32;
  const chin = chinAnchor(head, base, r, 0.12, true, 0, undefined, 1);
  expect(chin.y).toBeGreaterThan(head.y + r * 0.4);
  expect(chin.y).toBeLessThan(head.y + r);
  expect(Math.abs(chin.x - head.x)).toBeLessThan(r * 0.25);
});

it('leaves an upright neck on the throat', () => {
  const head = { x: 10, y: -80 };
  const base = { x: 12, y: -20 };
  const axis = neckAxis(head, base, 28);
  expect(axis.y).toBeLessThan(-0.9);
  const chin = chinAnchor(head, base, 28, 0, false, 0, undefined, 0);
  expect(chin.y).toBeGreaterThan(head.y);
  expect(chin.y).toBeLessThan(base.y);
});
