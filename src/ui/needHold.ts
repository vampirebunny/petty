import type { Needs } from '../sim/types';

export type NeedHold = {
  hunger: number;
  energy: number;
  happiness: number;
};

function clampNeed(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function needHold(before: Needs, after: Needs): NeedHold {
  return {
    hunger: after.hunger - before.hunger,
    energy: after.energy - before.energy,
    happiness: after.happiness - before.happiness,
  };
}

export function sumHolds(holds: NeedHold[]): NeedHold | null {
  if (holds.length === 0) {
    return null;
  }
  return holds.reduce(
    (sum, hold) => ({
      hunger: sum.hunger + hold.hunger,
      energy: sum.energy + hold.energy,
      happiness: sum.happiness + hold.happiness,
    }),
    { hunger: 0, energy: 0, happiness: 0 },
  );
}

// Treat gains are already on the pet. Subtract them so the rings stay put until the bite is done.
export function presentNeeds(needs: Needs, hold: NeedHold | null): Needs {
  if (!hold) {
    return needs;
  }
  return {
    hunger: clampNeed(needs.hunger - hold.hunger),
    energy: clampNeed(needs.energy - hold.energy),
    happiness: clampNeed(needs.happiness - hold.happiness),
  };
}
