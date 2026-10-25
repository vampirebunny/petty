import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesOfferings,
  type PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

export const ENTITLEMENT_ID = 'boop_boop_pro';

export const PRODUCT_IDS = {
  lifetime: 'lifetime',
  yearly: 'yearly',
  monthly: 'monthly',
} as const;

export type ProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS];

const TEST_API_KEY = 'test_aExmfmUAQQDRPNnKzkJyFihlXtW';
const anonymousPrefix = '$RCAnonymousID:';

const unavailableMessage = "Purchases aren't available right now.";
const missingProductMessage = "That option isn't available right now.";
const failedMessage = "Couldn't complete that purchase.";

type CustomerListener = (info: CustomerInfo | null) => void;

const customerListeners = new Set<CustomerListener>();
let customerInfo: CustomerInfo | null = null;
let configureTask: Promise<boolean> | null = null;
let configured = false;
let updateListener: ((info: CustomerInfo) => void) | null = null;
let identityTail: Promise<void> = Promise.resolve();

export type PurchaseResult =
  | { ok: true; customerInfo: CustomerInfo }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string };

export type PaywallResult =
  | { status: 'purchased' | 'restored' | 'not_presented'; customerInfo: CustomerInfo | null }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

function revenueCatApiKey(): string | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return null;
  }
  const fromEnv =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY;
  const key = fromEnv || (__DEV__ ? TEST_API_KEY : null);
  if (!key || (!__DEV__ && key.startsWith('test_'))) {
    return null;
  }
  return key;
}

function isPurchasesError(error: unknown): error is PurchasesError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  );
}

function isCancelled(error: unknown): boolean {
  return (
    isPurchasesError(error) &&
    (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR || error.userCancelled === true)
  );
}

function errorMessage(error: unknown): string {
  if (isPurchasesError(error) && error.message.trim()) {
    return error.message;
  }
  return failedMessage;
}

function publish(info: CustomerInfo | null): void {
  customerInfo = info;
  for (const listener of customerListeners) {
    listener(info);
  }
}

export function hasProEntitlement(info: CustomerInfo | null = customerInfo): boolean {
  return info?.entitlements.active[ENTITLEMENT_ID] != null;
}

export function subscribeCustomerInfo(listener: CustomerListener): () => void {
  customerListeners.add(listener);
  listener(customerInfo);
  return () => {
    customerListeners.delete(listener);
  };
}

function attachCustomerListener(): void {
  if (updateListener) {
    Purchases.removeCustomerInfoUpdateListener(updateListener);
  }
  updateListener = (info) => {
    publish(info);
  };
  Purchases.addCustomerInfoUpdateListener(updateListener);
}

async function configureOnce(): Promise<boolean> {
  const key = revenueCatApiKey();
  if (!key) {
    return false;
  }
  const already = await Purchases.isConfigured();
  if (!already) {
    if (__DEV__) {
      await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    Purchases.configure({ apiKey: key });
  }
  attachCustomerListener();
  return true;
}

export function configurePurchases(): Promise<boolean> {
  if (configured) {
    return Promise.resolve(true);
  }
  if (!configureTask) {
    configureTask = (async () => {
      try {
        const ok = await configureOnce();
        configured = ok;
        return ok;
      } catch {
        return false;
      } finally {
        if (!configured) {
          configureTask = null;
        }
      }
    })();
  }
  return configureTask;
}

async function applyIdentity(userId: string | null, linked: boolean): Promise<void> {
  const ready = await configurePurchases();
  if (!ready) {
    return;
  }
  if (linked) {
    if (!userId) {
      return;
    }
    const current = await Purchases.getAppUserID();
    if (current === userId) {
      return;
    }
    const result = await Purchases.logIn(userId);
    publish(result.customerInfo);
    return;
  }
  const current = await Purchases.getAppUserID();
  if (current.startsWith(anonymousPrefix)) {
    return;
  }
  try {
    publish(await Purchases.logOut());
  } catch (error) {
    if (isPurchasesError(error) && error.code === PURCHASES_ERROR_CODE.LOG_OUT_ANONYMOUS_USER_ERROR) {
      return;
    }
    throw error;
  }
}

/** Identify a linked account. Guests stay anonymous so a later logIn can alias the purchase. */
export function syncPurchasesUser(userId: string | null, linked: boolean): Promise<void> {
  const run = identityTail.then(() => applyIdentity(userId, linked));
  identityTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  const ready = await configurePurchases();
  if (!ready) {
    return null;
  }
  const info = await Purchases.getCustomerInfo();
  publish(info);
  return info;
}

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  const ready = await configurePurchases();
  if (!ready) {
    return null;
  }
  return Purchases.getOfferings();
}

function productMatches(storeIdentifier: string, productId: string): boolean {
  return storeIdentifier === productId || storeIdentifier.startsWith(`${productId}:`);
}

export function packageForProduct(
  offerings: PurchasesOfferings,
  productId: ProductId,
): PurchasesPackage | null {
  const packages = offerings.current?.availablePackages ?? [];
  return packages.find((pkg) => productMatches(pkg.product.identifier, productId)) ?? null;
}

export async function purchaseProduct(productId: ProductId): Promise<PurchaseResult> {
  const ready = await configurePurchases();
  if (!ready) {
    return { ok: false, cancelled: false, message: unavailableMessage };
  }
  try {
    const offerings = await Purchases.getOfferings();
    const selected = packageForProduct(offerings, productId);
    if (!selected) {
      return { ok: false, cancelled: false, message: missingProductMessage };
    }
    const result = await Purchases.purchasePackage(selected);
    publish(result.customerInfo);
    return { ok: true, customerInfo: result.customerInfo };
  } catch (error) {
    if (isCancelled(error)) {
      return { ok: false, cancelled: true };
    }
    return { ok: false, cancelled: false, message: errorMessage(error) };
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  const ready = await configurePurchases();
  if (!ready) {
    return { ok: false, cancelled: false, message: unavailableMessage };
  }
  try {
    const info = await Purchases.restorePurchases();
    publish(info);
    return { ok: true, customerInfo: info };
  } catch (error) {
    if (isCancelled(error)) {
      return { ok: false, cancelled: true };
    }
    return { ok: false, cancelled: false, message: errorMessage(error) };
  }
}

export async function presentProPaywall(): Promise<PaywallResult> {
  const ready = await configurePurchases();
  if (!ready) {
    return { status: 'error', message: unavailableMessage };
  }
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: ENTITLEMENT_ID,
      callbacks: {
        onPurchaseCompleted: ({ customerInfo: info }) => {
          publish(info);
        },
        onRestoreCompleted: ({ customerInfo: info }) => {
          publish(info);
        },
      },
    });
    const info = await getCustomerInfo().catch(() => customerInfo);
    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
        return { status: 'purchased', customerInfo: info };
      case PAYWALL_RESULT.RESTORED:
        return { status: 'restored', customerInfo: info };
      case PAYWALL_RESULT.NOT_PRESENTED:
        return { status: 'not_presented', customerInfo: info };
      case PAYWALL_RESULT.CANCELLED:
        return { status: 'cancelled' };
      case PAYWALL_RESULT.ERROR:
        return { status: 'error', message: failedMessage };
      default:
        return { status: 'cancelled' };
    }
  } catch (error) {
    if (isCancelled(error)) {
      return { status: 'cancelled' };
    }
    return { status: 'error', message: errorMessage(error) };
  }
}

export async function presentCustomerCenter(): Promise<{ ok: true } | { ok: false; message: string }> {
  const ready = await configurePurchases();
  if (!ready) {
    return { ok: false, message: unavailableMessage };
  }
  try {
    await RevenueCatUI.presentCustomerCenter({
      callbacks: {
        onRestoreCompleted: ({ customerInfo: info }) => {
          publish(info);
        },
      },
    });
    await getCustomerInfo().catch(() => customerInfo);
    return { ok: true };
  } catch (error) {
    if (isCancelled(error)) {
      return { ok: true };
    }
    return { ok: false, message: errorMessage(error) };
  }
}
