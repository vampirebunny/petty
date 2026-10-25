import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { CustomerInfo } from 'react-native-purchases';

import { onLocalWiped } from '../compliance/accountWipe';
import { getCachedUserId } from '../compliance/identity';
import { onAccountFlags, readAccountLinked } from '../db/accountMeta';
import {
  getCustomerInfo,
  hasProEntitlement,
  presentCustomerCenter,
  presentProPaywall,
  subscribeCustomerInfo,
  syncPurchasesUser,
} from '../purchases/revenueCat';

type Identity = {
  ready: boolean;
  ownerId: string | null;
};

async function syncFromAccount(): Promise<void> {
  const linked = readAccountLinked();
  const userId = linked ? getCachedUserId() : null;
  await syncPurchasesUser(userId, linked);
}

export function usePro(identity?: Identity): {
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  presentPro: () => Promise<string | null>;
} {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const manage = identity != null;
  const ready = identity?.ready ?? false;
  const ownerId = identity?.ownerId ?? null;

  useEffect(() => subscribeCustomerInfo(setCustomerInfo), []);

  useEffect(() => {
    if (!manage || !ready) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await syncFromAccount();
        if (!cancelled) {
          await getCustomerInfo();
        }
      } catch {
        // Customer info stays on the last successful update.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manage, ready, ownerId]);

  useEffect(() => {
    if (!manage || !ready) {
      return;
    }
    return onAccountFlags(() => {
      void syncFromAccount()
        .then(() => getCustomerInfo())
        .catch(() => undefined);
    });
  }, [manage, ready]);

  useEffect(() => {
    if (!manage || !ready) {
      return;
    }
    return onLocalWiped(() => {
      void syncPurchasesUser(null, false)
        .then(() => getCustomerInfo())
        .catch(() => undefined);
    });
  }, [manage, ready]);

  useEffect(() => {
    if (!manage || !ready) {
      return;
    }
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        void getCustomerInfo().catch(() => undefined);
      }
    });
    return () => {
      subscription.remove();
    };
  }, [manage, ready]);

  const presentPro = useCallback(async (): Promise<string | null> => {
    try {
      if (hasProEntitlement()) {
        const result = await presentCustomerCenter();
        return result.ok ? null : result.message;
      }
      const result = await presentProPaywall();
      return result.status === 'error' ? result.message : null;
    } catch {
      return "Couldn't complete that purchase.";
    }
  }, []);

  return {
    isPro: hasProEntitlement(customerInfo),
    customerInfo,
    presentPro,
  };
}
