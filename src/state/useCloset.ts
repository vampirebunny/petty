import { useEffect, useRef, useState } from 'react';

import { starterCloset, type OwnedItem } from '../actor/closet';
import type { Equipped } from '../sim/types';
import { loadCloset, subscribeCloset } from '../storage/wardrobeStorage';

export function useCloset(ownerId: string | undefined, equipped: Equipped | undefined): OwnedItem[] {
  const [owned, setOwned] = useState<OwnedItem[]>(starterCloset.map((item) => ({ ...item })));
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ownerId || !equipped) {
      return;
    }
    const pull = () => {
      void loadCloset(ownerId, equipped).then((closet) => {
        setOwned(closet.owned);
      });
    };
    if (loadedFor.current !== ownerId) {
      loadedFor.current = ownerId;
      pull();
    }
    return subscribeCloset(pull);
  }, [equipped, ownerId]);
  return owned;
}
