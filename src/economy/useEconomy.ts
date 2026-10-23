import { useEffect, useState } from 'react';

import {
  buyAndUse,
  canAfford,
  claimDailyLogin,
  purchase,
  purchaseCart,
  subscribe,
  useItem,
  type InventoryRow,
  type WalletSnapshot,
} from './service';

export function useEconomy(ready: boolean) {
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);

  useEffect(() => {
    if (!ready) {
      return;
    }
    return subscribe(setWallet);
  }, [ready]);

  return {
    balance: wallet?.balance ?? 0,
    inventory: (wallet?.inventory ?? []) as InventoryRow[],
    purchase,
    purchaseCart,
    useItem,
    buyAndUse,
    canAfford,
    claimDailyLogin,
  };
}
