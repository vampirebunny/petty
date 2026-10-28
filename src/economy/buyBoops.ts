import Purchases, { PURCHASES_ERROR_CODE } from 'react-native-purchases';

import { ensureAnonymousUserId } from '../compliance/identity';
import { loadBoopsPackage } from './boopsOffering';
import { iapPurchaseKeys, pullIapCredits } from './iapApply';
import { syncPurchasesUser } from './purchasesUser';

const waitMs = 30_000;
const pollMs = 1_500;

export type BuyBoopsResult =
  | { status: 'cancelled' }
  | { status: 'pending' }
  | { status: 'credited' }
  | { status: 'on_the_way' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string; notCharged: boolean };

/** Buy one consumable pack. The Boops arrive from the server ledger, not from this call. */
export async function buyBoopsPack(productId: string, onWaiting?: () => void): Promise<BuyBoopsResult> {
  const userId = await ensureAnonymousUserId();
  if (!userId) {
    return { status: 'unavailable' };
  }
  await syncPurchasesUser(userId);
  let appUserId = '';
  try {
    appUserId = await Purchases.getAppUserID();
  } catch {
    return { status: 'unavailable' };
  }
  if (appUserId !== userId) {
    return { status: 'unavailable' };
  }
  const pack = await loadBoopsPackage(productId);
  if (!pack) {
    return { status: 'unavailable' };
  }
  const before = new Set(iapPurchaseKeys());
  try {
    await Purchases.purchasePackage(pack);
  } catch (error) {
    return purchaseFailure(error);
  }
  if (iapPurchaseKeys().some((key) => !before.has(key))) {
    return { status: 'credited' };
  }
  onWaiting?.();
  const arrived = await waitForCredit(before);
  return arrived ? { status: 'credited' } : { status: 'on_the_way' };
}

async function waitForCredit(before: ReadonlySet<string>): Promise<boolean> {
  const deadline = Date.now() + waitMs;
  while (Date.now() <= deadline) {
    await pullIapCredits();
    if (iapPurchaseKeys().some((key) => !before.has(key))) {
      return true;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(pollMs, remaining)));
  }
  return false;
}

function purchaseFailure(error: unknown): BuyBoopsResult {
  const parsed = readError(error);
  if (parsed.cancelled || parsed.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
    return { status: 'cancelled' };
  }
  if (parsed.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
    return { status: 'pending' };
  }
  const message = storeMessage(parsed.message);
  if (!message) {
    return { status: 'error', message: "The purchase didn't go through.", notCharged: parsed.notCharged };
  }
  return { status: 'error', message, notCharged: parsed.notCharged };
}

function readError(error: unknown): { code?: string; message: string; cancelled: boolean; notCharged: boolean } {
  if (!error || typeof error !== 'object') {
    return { message: '', cancelled: false, notCharged: false };
  }
  const row = error as Record<string, unknown>;
  const message = typeof row.message === 'string' ? row.message : '';
  const underlying = typeof row.underlyingErrorMessage === 'string' ? row.underlyingErrorMessage : '';
  const code = typeof row.code === 'string' ? row.code : undefined;
  const info = row.userInfo && typeof row.userInfo === 'object' ? JSON.stringify(row.userInfo) : '';
  const bag = `${message} ${underlying} ${info}`.toLowerCase();
  return {
    code,
    message,
    cancelled: row.userCancelled === true,
    notCharged: bag.includes("weren't charged") || bag.includes('not charged') || bag.includes('you were not charged'),
  };
}

function storeMessage(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 180 || trimmed.includes('\n')) {
    return null;
  }
  return trimmed;
}
