import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

let configuredUserId: string | null = null;
let pending: Promise<void> = Promise.resolve();
let warnedMissingKey = false;
let warnedConfigure = false;
let unconfiguredReason = 'RevenueCat is not configured.';

/** Expo Go has no App Store or Play Billing, so RevenueCat stays unconfigured there. */
function runningInExpoGo(): boolean {
  if (!__DEV__) {
    return false;
  }
  try {
    return isRunningInExpoGo();
  } catch {
    return false;
  }
}

function publicSdkKey(): string | null {
  if (runningInExpoGo()) {
    return null;
  }
  const key =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : Platform.OS === 'android'
        ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
        : null;
  const trimmed = key?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Bind RevenueCat to a stable id. A guest uses the install id, so buying does not
 * wait on an account. logIn runs only when that id changes. logOut is never called:
 * it mints $RCAnonymousID.
 */
export function syncPurchasesUser(userId: string | null): Promise<void> {
  pending = pending.then(() => applyPurchasesUser(userId), () => applyPurchasesUser(userId));
  return pending;
}

/** getOfferings rejects until configure has finished. */
export function whenPurchasesConfigured(): Promise<boolean> {
  return pending.then(
    () => Purchases.isConfigured(),
    () => Purchases.isConfigured(),
  );
}

/** Why the last configure attempt did not finish. The sheet logs this when prices cannot load. */
export function revenueCatUnconfiguredReason(): string {
  return unconfiguredReason;
}

async function applyPurchasesUser(userId: string | null): Promise<void> {
  if (!userId) {
    return;
  }
  const apiKey = publicSdkKey();
  if (!apiKey) {
    unconfiguredReason = runningInExpoGo()
      ? 'RevenueCat is not configured because this is Expo Go.'
      : 'RevenueCat is not configured because the public SDK key is missing. Set EXPO_PUBLIC_REVENUECAT_IOS_KEY and EXPO_PUBLIC_REVENUECAT_ANDROID_KEY.';
    if (__DEV__ && !warnedMissingKey && !runningInExpoGo() && (Platform.OS === 'ios' || Platform.OS === 'android')) {
      warnedMissingKey = true;
      console.warn(unconfiguredReason);
    }
    return;
  }
  if (configuredUserId === userId) {
    return;
  }
  const alreadyConfigured = configuredUserId != null || (await Purchases.isConfigured());
  if (!alreadyConfigured) {
    try {
      if (__DEV__) {
        await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      }
      Purchases.configure({ apiKey, appUserID: userId });
    } catch (error) {
      unconfiguredReason = `RevenueCat could not be configured. ${errorDetail(error)}`;
      if (__DEV__ && !warnedConfigure) {
        warnedConfigure = true;
        console.warn(unconfiguredReason);
      }
      return;
    }
    unconfiguredReason = 'RevenueCat is not configured.';
    configuredUserId = userId;
    return;
  }
  const current = configuredUserId ?? (await Purchases.getAppUserID());
  if (current === userId) {
    configuredUserId = userId;
    return;
  }
  await Purchases.logIn(userId);
  configuredUserId = userId;
}

function errorDetail(error: unknown): string {
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

export function resetPurchasesUserForTests(): void {
  configuredUserId = null;
  pending = Promise.resolve();
  warnedMissingKey = false;
  warnedConfigure = false;
  unconfiguredReason = 'RevenueCat is not configured.';
}
