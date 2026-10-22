import { careConfig } from '../sim/careConfig';

export type InventoryStack = { itemId: string; qty: number };

export type UserEconomy = {
  inventory: InventoryStack[];
  lastTreatRegenAt: number;
  lastDailyBonusLocalDate: string | null;
};

export const basicTreatId = 'biscuit';
export const specialTreatId = 'special';

export function emptyEconomy(now: number): UserEconomy {
  return {
    inventory: [{ itemId: basicTreatId, qty: careConfig.startingTreats }],
    lastTreatRegenAt: now,
    lastDailyBonusLocalDate: null,
  };
}

export function spendTreat(economy: UserEconomy, itemId: string): { economy: UserEconomy; ok: boolean } {
  const next = takeStack(economy, itemId);
  if (!next) {
    return { economy, ok: false };
  }
  return { economy: next, ok: true };
}

export function stackQty(economy: UserEconomy, itemId: string): number {
  return economy.inventory.find((stack) => stack.itemId === itemId)?.qty ?? 0;
}

export function addStack(economy: UserEconomy, itemId: string, qty: number): UserEconomy {
  if (qty <= 0) {
    return economy;
  }
  const current = stackQty(economy, itemId);
  const nextQty = current + qty;
  const inventory = economy.inventory.filter((stack) => stack.itemId !== itemId);
  if (nextQty > 0) {
    inventory.push({ itemId, qty: nextQty });
  }
  return { ...economy, inventory };
}

export function takeStack(economy: UserEconomy, itemId: string): UserEconomy | null {
  const current = stackQty(economy, itemId);
  if (current <= 0) {
    return null;
  }
  const inventory = economy.inventory
    .map((stack) => (stack.itemId === itemId ? { ...stack, qty: stack.qty - 1 } : stack))
    .filter((stack) => stack.qty > 0);
  return { ...economy, inventory };
}

// Treats do not regenerate. Settlement keeps the wallet as it was saved.
export function settleEconomy(economy: UserEconomy, _now: number): UserEconomy {
  return economy;
}

// Stub for a future store. It does not grant items.
export function purchaseItem(economy: UserEconomy): UserEconomy {
  return economy;
}
