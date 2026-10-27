import Purchases from 'react-native-purchases';

import { loadBoopsPrices } from '../boopsOffering';
import { resetPurchasesUserForTests } from '../purchasesUser';

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    isConfigured: jest.fn(async () => false),
    getOfferings: jest.fn(),
  },
}));

function offering(
  current: { identifier: string; priceString: string }[] | null,
  extra?: { identifier: string; priceString: string }[],
) {
  const packages = (rows: { identifier: string; priceString: string }[]) =>
    rows.map((row) => ({
      identifier: `package_${row.identifier}`,
      product: { identifier: row.identifier, priceString: row.priceString },
    }));
  return {
    current: current ? { availablePackages: packages(current) } : null,
    all: extra ? { other: { availablePackages: packages(extra) } } : {},
  };
}

const packs = [
  { identifier: 'boops_600', priceString: '$0.99' },
  { identifier: 'boops_2000', priceString: '$2.99' },
  { identifier: 'boops_3500', priceString: '$4.99' },
  { identifier: 'boops_7500', priceString: '$9.99' },
  { identifier: 'boops_16000', priceString: '$19.99' },
  { identifier: 'boops_45000', priceString: '$49.99' },
];

beforeEach(() => {
  resetPurchasesUserForTests();
  jest.mocked(Purchases.isConfigured).mockReset();
  jest.mocked(Purchases.isConfigured).mockResolvedValue(true);
  jest.mocked(Purchases.getOfferings).mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('reads prices from the current offering by store product id', async () => {
  jest.mocked(Purchases.getOfferings).mockResolvedValue(offering(packs) as never);
  const prices = await loadBoopsPrices();
  expect(prices?.get('boops_600')).toBe('$0.99');
  expect(prices?.get('boops_45000')).toBe('$49.99');
  expect(prices?.size).toBe(6);
});

it('ignores an offering that is not current', async () => {
  jest.mocked(Purchases.getOfferings).mockResolvedValue(offering(null, packs) as never);
  await expect(loadBoopsPrices()).resolves.toBeNull();
});

it('omits a pack the current offering does not sell', async () => {
  jest.mocked(Purchases.getOfferings).mockResolvedValue(offering(packs.slice(1)) as never);
  const prices = await loadBoopsPrices();
  expect(prices?.has('boops_600')).toBe(false);
  expect(prices?.size).toBe(5);
  expect(console.warn).toHaveBeenCalledWith('Boops pack boops_600 is missing from the current offering.');
});

it('does not call the store before RevenueCat is configured', async () => {
  jest.mocked(Purchases.isConfigured).mockResolvedValue(false);
  await expect(loadBoopsPrices()).resolves.toBeNull();
  expect(Purchases.getOfferings).not.toHaveBeenCalled();
});

it('returns null when the store cannot be reached', async () => {
  jest.mocked(Purchases.getOfferings).mockRejectedValue(new Error('billing unavailable'));
  await expect(loadBoopsPrices()).resolves.toBeNull();
});
