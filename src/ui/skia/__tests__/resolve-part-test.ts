import type { WearItem } from '../../../actor/wardrobe';
import { resolvePart } from '../cosmetics';

jest.mock('@shopify/react-native-skia', () => ({
  ClipOp: {},
  PaintStyle: {},
  PathOp: {},
  StrokeCap: {},
  StrokeJoin: {},
  Skia: {},
  TileMode: {},
  vec: () => ({ x: 0, y: 0 }),
}));

function item(partial: Pick<WearItem, 'slot' | 'shape' | 'colorway'> & Partial<WearItem>): WearItem {
  return {
    id: 'lab',
    label: 'Lab',
    ...partial,
  };
}

it('resolves a gingham bandana, a solid rib, baffle panels, and a colored sole', () => {
  const bandana = item({
    slot: 'neckwear',
    shape: 'bandana',
    colorway: { c: '#E0526A', d: '#FFFFFF', pattern: 'gingham' },
  });
  expect(resolvePart(bandana, 'cloth').pattern).toMatchObject({ id: 'gingham', c: '#E0526A', d: '#FFFFFF' });
  expect(resolvePart(bandana, 'band').pattern).toBeNull();
  expect(resolvePart(bandana, 'band').color).not.toBe('#E0526A');

  const sweater = item({
    slot: 'jacket',
    shape: 'sweater',
    colorway: { c: '#C84A4A', d: '#2B3A6B', pattern: 'plaid', parts: { rib: '#F4DEDE' } },
  });
  expect(resolvePart(sweater, 'body').pattern).toMatchObject({ id: 'plaid', c: '#C84A4A' });
  expect(resolvePart(sweater, 'rib')).toEqual({ color: '#F4DEDE', pattern: null });

  const puffer = item({
    slot: 'jacket',
    shape: 'puffer',
    colorway: {
      c: '#FF8CC4',
      baffles: ['#FF8CC4', '#FFB15C', '#FFE16B', '#8FE3A8', '#7EC8F5', '#B9A2F5'],
    },
  });
  expect(resolvePart(puffer, 'body')).toEqual({ color: '#FF8CC4', pattern: null });
  expect(resolvePart(puffer, 'collar').pattern).toBeNull();
  expect(puffer.colorway.baffles).toHaveLength(6);

  const sneaker = item({
    slot: 'boots',
    shape: 'sneaker',
    colorway: { c: '#f4f4f4', d: '#d64545', parts: { sole: '#112233' } },
  });
  expect(resolvePart(sneaker, 'sole')).toEqual({ color: '#112233', pattern: null });
  expect(resolvePart(sneaker, 'upper')).toEqual({ color: '#f4f4f4', pattern: null });
  expect(resolvePart(sneaker, 'stripe').color).toBe('#d64545');
  expect(resolvePart(sneaker, 'nope').color).toBe('#f4f4f4');
});
