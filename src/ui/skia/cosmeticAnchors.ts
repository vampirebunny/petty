import type { ViewId } from '../../actor/data/facing';

export type CosmeticMode = 'full' | 'arms' | 'knot';

type Anchor = { x: number; y: number; mode: CosmeticMode };

// Offsets are fractions of head radius (hats, glasses, neckwear) or body length (jackets).
// Boots follow the leg they are drawn on, so their anchor is the leg itself.

const hat: Record<ViewId, Anchor> = {
  side: { x: 0, y: 0, mode: 'full' },
  front34: { x: 0.04, y: -0.04, mode: 'full' },
  front: { x: 0, y: -0.06, mode: 'full' },
  back34: { x: -0.04, y: -0.1, mode: 'full' },
  back: { x: 0, y: -0.14, mode: 'full' },
};

const glasses: Record<ViewId, Anchor> = {
  side: { x: 0, y: 0, mode: 'full' },
  front34: { x: 0.02, y: 0, mode: 'full' },
  front: { x: 0, y: 0.02, mode: 'full' },
  back34: { x: -0.08, y: 0.04, mode: 'arms' },
  back: { x: 0, y: 0.06, mode: 'arms' },
};

const neck: Record<ViewId, Anchor> = {
  side: { x: 0, y: 0.12, mode: 'full' },
  front34: { x: 0.04, y: 0.12, mode: 'full' },
  front: { x: 0, y: 0.12, mode: 'full' },
  back34: { x: -0.06, y: 0.04, mode: 'knot' },
  back: { x: 0, y: 0.02, mode: 'knot' },
};

const jacket: Record<ViewId, Anchor> = {
  side: { x: 0, y: 0, mode: 'full' },
  front34: { x: 0.02, y: 0.04, mode: 'full' },
  front: { x: 0, y: 0.06, mode: 'full' },
  back34: { x: -0.02, y: 0, mode: 'full' },
  back: { x: 0, y: 0, mode: 'full' },
};

const boots: Record<ViewId, Anchor> = {
  side: { x: 0, y: 0, mode: 'full' },
  front34: { x: 0, y: 0, mode: 'full' },
  front: { x: 0, y: 0, mode: 'full' },
  back34: { x: 0, y: 0, mode: 'full' },
  back: { x: 0, y: 0, mode: 'full' },
};

const bySlot = {
  hat,
  glasses,
  neckwear: neck,
  jacket,
  boots,
} as const;

type Slot = keyof typeof bySlot;

const warned = new Set<string>();

// Missing view: dev warning and hide. Side and the other four views are defined for every shipped slot.
export function cosmeticAnchor(slot: string, id: string, view: ViewId): Anchor | null {
  const table = bySlot[slot as Slot];
  const anchor = table?.[view];
  if (!anchor) {
    const key = `${slot}:${id}:${view}`;
    if (!warned.has(key) && (typeof __DEV__ === 'undefined' || __DEV__)) {
      warned.add(key);
      console.warn(`cosmetic ${id} has no ${view} anchor; hiding it`);
    }
    return null;
  }
  return anchor;
}
