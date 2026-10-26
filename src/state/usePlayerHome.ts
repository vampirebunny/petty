import { useEffect, useState } from 'react';

import type { FurniturePiece, FurniturePlacement } from '../actor/furniture';
import {
  furnitureOf,
  layoutOf,
  repairBedPlacements,
  subscribePlayerHome,
  toysOf,
  type SpeciesId,
} from '../db/playerHome';

type HomeSnapshot = {
  ownerId: string;
  species: SpeciesId;
  pieces: FurniturePiece[];
  placements: FurniturePlacement[];
  toys: string[];
};

const emptyHome = { pieces: [], placements: [], toys: [] };

export function usePlayerHome(ownerId: string | undefined, species: SpeciesId) {
  const [snapshot, setSnapshot] = useState<HomeSnapshot | null>(null);

  useEffect(() => {
    if (!ownerId) {
      return;
    }
    const id = ownerId;
    const load = () => {
      repairBedPlacements(id, species);
      setSnapshot({
        ownerId: id,
        species,
        pieces: furnitureOf(id),
        placements: layoutOf(id, species),
        toys: toysOf(id),
      });
    };
    load();
    return subscribePlayerHome(load);
  }, [ownerId, species]);

  if (!ownerId || snapshot == null || snapshot.ownerId !== ownerId || snapshot.species !== species) {
    return emptyHome;
  }
  return { pieces: snapshot.pieces, placements: snapshot.placements, toys: snapshot.toys };
}
