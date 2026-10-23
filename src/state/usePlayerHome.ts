import { useEffect, useState } from 'react';

import type { FurniturePiece, FurniturePlacement } from '../actor/furniture';
import {
  furnitureOf,
  layoutOf,
  subscribePlayerHome,
  toysOf,
  type SpeciesId,
} from '../db/playerHome';

export function usePlayerHome(ownerId: string | undefined, species: SpeciesId) {
  const [pieces, setPieces] = useState<FurniturePiece[]>([]);
  const [placements, setPlacements] = useState<FurniturePlacement[]>([]);
  const [toys, setToys] = useState<string[]>([]);

  useEffect(() => {
    if (!ownerId) {
      setPieces([]);
      setPlacements([]);
      setToys([]);
      return;
    }
    const load = () => {
      setPieces(furnitureOf(ownerId));
      setPlacements(layoutOf(ownerId, species));
      setToys(toysOf(ownerId));
    };
    load();
    return subscribePlayerHome(load);
  }, [ownerId, species]);

  return { pieces, placements, toys };
}
