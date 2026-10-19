export type ItemGrip = 'mouth' | 'paw' | 'none';

export type ItemPhysics = {
  bounce: number;
  friction: number;
  drag: number;
  lift?: number;
  spin?: number;
  rolls?: boolean;
};

export type ItemKind = {
  id: string;
  name: string;
  size: number;
  grip: ItemGrip;
  physics: ItemPhysics;
  // Draw lives in Skia, keyed by kind id.
  stub?: boolean;
};

export const ITEM_KINDS: Record<string, ItemKind> = {
  ball: {
    id: 'ball',
    name: 'Ball',
    size: 1,
    grip: 'mouth',
    physics: { bounce: 1.5, friction: 1, drag: 1, rolls: true },
  },
  frisbee: {
    id: 'frisbee',
    name: 'Frisbee',
    size: 1.1,
    grip: 'mouth',
    physics: { bounce: 0.35, friction: 0.7, drag: 0.4, lift: 1, rolls: false },
    stub: true,
  },
  squeaky: {
    id: 'squeaky',
    name: 'Squeaky Toy',
    size: 0.9,
    grip: 'mouth',
    physics: { bounce: 0.25, friction: 1.4, drag: 1.6, rolls: false },
    stub: true,
  },
  bone: {
    id: 'bone',
    name: 'Chew Bone',
    size: 1,
    grip: 'mouth',
    physics: { bounce: 0.1, friction: 2, drag: 2, rolls: false },
    stub: true,
  },
  yarn: {
    id: 'yarn',
    name: 'Yarn Ball',
    size: 0.9,
    grip: 'paw',
    physics: { bounce: 0.6, friction: 0.8, drag: 0.8, rolls: true },
    stub: true,
  },
  jingleBall: {
    id: 'jingleBall',
    name: 'Jingle Ball',
    size: 0.75,
    grip: 'paw',
    physics: { bounce: 1.1, friction: 0.6, drag: 0.7, rolls: true },
    stub: true,
  },
};

export function itemKindById(id: string): ItemKind | null {
  return ITEM_KINDS[id] ?? null;
}
