export type PointerKind = 'laser' | 'featherWand';

export type PointerTarget = {
  x: number;
  y: number;
  active: boolean;
  kind: PointerKind;
};

export function inactivePointer(): PointerTarget {
  return { x: 0, y: 0, active: false, kind: 'laser' };
}
