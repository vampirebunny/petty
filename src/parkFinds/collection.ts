import { dateWindowOccurredSince } from './conditions';
import { catalogForSpecies, parkFindById } from './catalog';
import type { ParkFindCatalogRow, ParkFindItemRecord, PetParkFindsState } from './types';

export function recordFor(
  state: PetParkFindsState | undefined | null,
  itemId: string,
): ParkFindItemRecord | null {
  return state?.items.find((row) => row.itemId === itemId) ?? null;
}

export function applyReveal(
  state: PetParkFindsState,
  itemId: string,
  foundAt: number,
): { next: PetParkFindsState; isNew: boolean } {
  const existing = recordFor(state, itemId);
  if (existing) {
    const items = state.items.map((row) =>
      row.itemId === itemId
        ? { ...row, count: row.count + 1, lastFoundAt: foundAt }
        : row,
    );
    return {
      next: {
        ...state,
        firstFindVisitDone: true,
        items,
        pendingRevealModal: { itemId, isNew: false, foundAt },
      },
      isNew: false,
    };
  }
  const items = [
    ...state.items,
    {
      itemId,
      count: 1,
      firstFoundAt: foundAt,
      lastFoundAt: foundAt,
      firstFindRewarded: false,
      seen: false,
    },
  ];
  return {
    next: {
      ...state,
      firstFindVisitDone: true,
      items,
      pendingRevealModal: { itemId, isNew: true, foundAt },
    },
    isNew: true,
  };
}

export function clearPendingModal(state: PetParkFindsState): PetParkFindsState {
  return { ...state, pendingRevealModal: null };
}

export function markCollectionSeen(state: PetParkFindsState): PetParkFindsState {
  return {
    ...state,
    items: state.items.map((row) => (row.seen ? row : { ...row, seen: true })),
  };
}

export function resetCollection(state: PetParkFindsState): PetParkFindsState {
  return {
    firstFindVisitDone: false,
    items: [],
    pendingRevealModal: null,
  };
}

/** Holiday items count in Y only after their window has occurred since adoption. */
export function visibleCatalogRows(
  species: 'dog' | 'cat',
  adoptedAt: number,
  now = Date.now(),
  foundIds?: Set<string>,
): ParkFindCatalogRow[] {
  const from = new Date(adoptedAt);
  const to = new Date(now);
  return catalogForSpecies(species).filter((row) => {
    if (row.condition_type !== 'date_window' || !row.condition_value) {
      return true;
    }
    if (foundIds?.has(row.id)) {
      return true;
    }
    return dateWindowOccurredSince(from, to, row.condition_value);
  });
}

export function progressCount(
  state: PetParkFindsState,
  species: 'dog' | 'cat',
  adoptedAt: number,
  now = Date.now(),
): { found: number; total: number } {
  const foundIds = new Set(state.items.map((row) => row.itemId));
  const visible = visibleCatalogRows(species, adoptedAt, now, foundIds);
  const found = visible.filter((row) => foundIds.has(row.id)).length;
  return { found, total: visible.length };
}

export function articleFor(name: string): 'a' | 'an' {
  const first = name.trim().charAt(0).toLowerCase();
  return 'aeiou'.includes(first) ? 'an' : 'a';
}

export function findTitle(petName: string, itemName: string): string {
  return `${petName} found ${articleFor(itemName)} ${itemName}!`;
}

export function itemDisplayName(itemId: string): string {
  return parkFindById(itemId)?.name ?? itemId;
}
