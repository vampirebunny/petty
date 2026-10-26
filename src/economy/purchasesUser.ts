import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

let configuredUserId: string | null = null;
let pending: Promise<void> = Promise.resolve();
let warnedMissingKey = false;
let warnedConfigure = false;

/** Expo Go has no App Store or Play Billing. RevenueCat rejects a store key there. */
function runningInExpoGo(): boolean {
  if (!__DEV__) {
    return false;
  }
  try {
    return Constants.expoGoConfig != null;
  } catch {
    return false;
  }
}

function publicSdkKey(): string | null {
  const key = runningInExpoGo()
    ? process.env.EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY
    : Platform.OS === 'ios'
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

async function applyPurchasesUser(userId: string | null): Promise<void> {
  if (!userId) {
    return;
  }
  const apiKey = publicSdkKey();
  if (!apiKey) {
    if (__DEV__ && !warnedMissingKey && (runningInExpoGo() || Platform.OS === 'ios' || Platform.OS === 'android')) {
      warnedMissingKey = true;
      console.warn(
        runningInExpoGo()
          ? 'RevenueCat Test Store key is missing. Set EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY.'
          : 'RevenueCat public SDK key is missing. Set EXPO_PUBLIC_REVENUECAT_IOS_KEY and EXPO_PUBLIC_REVENUECAT_ANDROID_KEY.',
      );
    }
    return;
  }
  if (configuredUserId === userId) {
    return;
  }
  const alreadyConfigured = configuredUserId != null || (await Purchases.isConfigured());
  if (!alreadyConfigured) {
    try {
      Purchases.configure({ apiKey, appUserID: userId });
    } catch (error) {
      if (__DEV__ && !warnedConfigure) {
        warnedConfigure = true;
        console.warn('RevenueCat could not be configured.', error);
      }
      return;
    }
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

export function resetPurchasesUserForTests(): void {
  configuredUserId = null;
  pending = Promise.resolve();
  warnedMissingKey = false;
  warnedConfigure = false;
}
