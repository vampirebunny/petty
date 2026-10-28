import Purchases from 'react-native-purchases';

import { boopsPacks } from './boopsPacks';
import { revenueCatUnconfiguredReason, whenPurchasesConfigured } from './purchasesUser';

/**
 * Prices from the current RevenueCat Offering. That is the Offering marked current
 * in the dashboard, for a development build and for production. Null when the SDK
 * is not configured, the store cannot be reached, or no Offering is current.
 * A pack missing from the Offering is omitted.
 */
export async function loadBoopsPrices(): Promise<ReadonlyMap<string, string> | null> {
  if (!(await whenPurchasesConfigured())) {
    console.warn(revenueCatUnconfiguredReason());
    return null;
  }
  let packages;
  try {
    const offerings = await Purchases.getOfferings();
    packages = offerings.current?.availablePackages;
  } catch (error) {
    console.warn(`RevenueCat offerings could not be loaded. ${offeringErrorDetail(error)}`);
    return null;
  }
  if (!packages) {
    console.warn('RevenueCat has no current offering.');
    return null;
  }
  const byProductId = new Map(packages.map((pack) => [pack.product.identifier, pack.product.priceString]));
  const returned = [...byProductId.keys()].sort().join(', ') || 'none';
  const prices = new Map<string, string>();
  for (const pack of boopsPacks) {
    const priceString = byProductId.get(pack.productId)?.trim();
    if (!priceString) {
      console.warn(`Boops pack ${pack.productId} is missing from the current offering. Store products: ${returned}.`);
      continue;
    }
    prices.set(pack.productId, priceString);
  }
  return prices;
}

function offeringErrorDetail(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String(error.message);
    const underlying =
      'underlyingErrorMessage' in error && error.underlyingErrorMessage
        ? String(error.underlyingErrorMessage)
        : '';
    return underlying && underlying !== message ? `${message} ${underlying}` : message;
  }
  return String(error);
}
