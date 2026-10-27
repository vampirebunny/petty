import Purchases from 'react-native-purchases';

import { boopsPacks } from './boopsPacks';
import { whenPurchasesConfigured } from './purchasesUser';

/**
 * Prices from the current RevenueCat Offering. That is the Offering marked current
 * in the dashboard, for a development build and for production. Null when the SDK
 * is not configured, the store cannot be reached, or no Offering is current.
 * A pack missing from the Offering is omitted.
 */
export async function loadBoopsPrices(): Promise<ReadonlyMap<string, string> | null> {
  if (!(await whenPurchasesConfigured())) {
    return null;
  }
  let packages;
  try {
    const offerings = await Purchases.getOfferings();
    packages = offerings.current?.availablePackages;
  } catch (error) {
    if (__DEV__) {
      console.warn('RevenueCat offerings could not be loaded.', error);
    }
    return null;
  }
  if (!packages) {
    if (__DEV__) {
      console.warn('RevenueCat has no current offering.');
    }
    return null;
  }
  const byProductId = new Map(packages.map((pack) => [pack.product.identifier, pack.product.priceString]));
  const prices = new Map<string, string>();
  for (const pack of boopsPacks) {
    const priceString = byProductId.get(pack.productId)?.trim();
    if (!priceString) {
      console.warn(`Boops pack ${pack.productId} is missing from the current offering.`);
      continue;
    }
    prices.set(pack.productId, priceString);
  }
  return prices;
}
