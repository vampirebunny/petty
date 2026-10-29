import type { ParkFindRarity } from '../sim/parkFindsConfig';

export type ParkFindSpecies = 'dog' | 'cat' | 'both';

export type ParkFindConditionType =
  | 'always'
  | 'season'
  | 'weather'
  | 'time'
  | 'moon'
  | 'date_window';

export type ParkFindCatalogRow = {
  id: string;
  name: string;
  species: ParkFindSpecies;
  rarity: ParkFindRarity;
  condition_type: ParkFindConditionType;
  condition_value: string | null;
  sort_order: number;
  art_key: string;
  active: boolean;
};

export type ParkFindItemRecord = {
  itemId: string;
  count: number;
  firstFoundAt: number;
  lastFoundAt: number;
  firstFindRewarded: boolean;
  seen: boolean;
};

export type PendingRevealModal = {
  itemId: string;
  isNew: boolean;
  foundAt: number;
};

export type PetParkFindsState = {
  firstFindVisitDone: boolean;
  items: ParkFindItemRecord[];
  pendingRevealModal?: PendingRevealModal | null;
};

export type ParkFindFoundEvent = {
  petId: string;
  itemId: string;
  rarity: ParkFindRarity;
  isNew: boolean;
  foundAt: number;
};

export type FindVariant = 'dig' | 'grass' | 'bush';

export const emptyParkFinds = (): PetParkFindsState => ({
  firstFindVisitDone: false,
  items: [],
  pendingRevealModal: null,
});
