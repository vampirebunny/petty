import { useEffect, useRef, useState } from 'react';

import { starterCloset, type OwnedItem } from '../actor/closet';
import type { Equipped } from '../sim/types';
import { loadCloset } from '../storage/wardrobeStorage';

export function useCloset(ownerId: string | undefined, equipped: Equipped | undefined): OwnedItem[] {
  const [owned, setOwned] = useState<OwnedItem[]>(starterCloset.map((item) => ({ ...item })));
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ownerId || !equipped || loadedFor.current === ownerId) {
      return;
    }
    loadedFor.current = ownerId;
    void loadCloset(ownerId, equipped).then((closet) => {
      setOwned(closet.owned);
    });
  }, [equipped, ownerId]);
  return owned;
}
