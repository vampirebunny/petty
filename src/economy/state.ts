import { careConfig, type TreatTier } from '../sim/careConfig';

export type InventoryStack = { itemId: string; qty: number };

export type UserEconomy = {
  inventory: InventoryStack[];
  lastTreatRegenAt: number;
  lastDailyBonusLocalDate: string | null;
};

export const basicTreatId = 'biscuit';
export const specialTreatId = 'special';

export function emptyEconomy(now: number): UserEconomy {
  return { inventory: [], lastTreatRegenAt: now, lastDailyBonusLocalDate: null };
}

export function stackQty(economy: UserEconomy, itemId: string): number {
  return economy.inventory.find((stack) => stack.itemId === itemId)?.qty ?? 0;
}

export function addStack(economy: UserEconomy, itemId: string, qty: number): UserEconomy {
  if (qty <= 0) {
    return economy;
  }
  const current = stackQty(economy, itemId);
  const nextQty = Math.min(careConfig.stackCeiling, current + qty);
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

function localDate(now: number): string {
  const date = new Date(now);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Regen is real time and pauses at the basic cap. The login bonus is once per local calendar date.
export function settleEconomy(economy: UserEconomy, now: number): UserEconomy {
  let next = economy;
  const elapsed = Math.max(0, now - next.lastTreatRegenAt);
  const steps = Math.floor(elapsed / careConfig.regenMs);
  if (steps > 0) {
    let qty = stackQty(next, basicTreatId);
    let granted = 0;
    for (let i = 0; i < steps && qty < careConfig.regenCap; i += 1) {
      qty += 1;
      granted += 1;
    }
    next = addStack(next, basicTreatId, granted);
    next = { ...next, lastTreatRegenAt: next.lastTreatRegenAt + steps * careConfig.regenMs };
  }
  const today = localDate(now);
  if (next.lastDailyBonusLocalDate !== today) {
    next = addStack(next, basicTreatId, careConfig.loginBonus);
    next = { ...next, lastDailyBonusLocalDate: today };
  }
  return next;
}

export function rewardTierAvailable(economy: UserEconomy, tier: TreatTier): TreatTier | null {
  const basic = stackQty(economy, basicTreatId);
  const special = stackQty(economy, specialTreatId);
  if (tier === 'special' && special > 0) {
    return 'special';
  }
  if (tier === 'basic' && basic > 0) {
    return 'basic';
  }
  if (special > 0) {
    return 'special';
  }
  if (basic > 0) {
    return 'basic';
  }
  return null;
}

export function minutesUntilTreat(economy: UserEconomy, now: number): number {
  if (stackQty(economy, basicTreatId) >= careConfig.regenCap) {
    return 0;
  }
  const elapsed = Math.max(0, now - economy.lastTreatRegenAt);
  const remain = careConfig.regenMs - (elapsed % careConfig.regenMs);
  return Math.max(1, Math.ceil(remain / 60000));
}

// Stub for a future store. It does not grant items.
export function purchaseItem(economy: UserEconomy): UserEconomy {
  return economy;
}
