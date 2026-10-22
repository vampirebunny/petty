import { useEffect, useState } from 'react';

import type { FurniturePiece, FurniturePlacement } from '../actor/furniture';
import {
  furnitureOf,
  layoutOf,
  ownsToy,
  subscribePlayerHome,
  type SpeciesId,
} from '../db/playerHome';

export function usePlayerHome(ownerId: string | undefined, species: SpeciesId) {
  const [pieces, setPieces] = useState<FurniturePiece[]>([]);
  const [placements, setPlacements] = useState<FurniturePlacement[]>([]);
  const [ownsBall, setOwnsBall] = useState(false);

  useEffect(() => {
    if (!ownerId) {
      setPieces([]);
      setPlacements([]);
      setOwnsBall(false);
      return;
    }
    const load = () => {
      setPieces(furnitureOf(ownerId));
      setPlacements(layoutOf(ownerId, species));
      setOwnsBall(ownsToy(ownerId, 'ball'));
    };
    load();
    return subscribePlayerHome(load);
  }, [ownerId, species]);

  return { pieces, placements, ownsBall };
}
