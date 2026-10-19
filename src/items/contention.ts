import type { Item } from './types';

export type Contender = { id: string; x: number; y: number };

export function claimItem(
  item: Item,
  actors: Contender[],
  random: () => number,
): string | null {
  if (actors.length === 0) {
    return null;
  }
  let bestDist = Infinity;
  const nearest: Contender[] = [];
  for (const actor of actors) {
    const dist = Math.hypot(actor.x - item.x, actor.y - item.y);
    if (dist < bestDist - 0.001) {
      bestDist = dist;
      nearest.length = 0;
      nearest.push(actor);
    } else if (Math.abs(dist - bestDist) <= 0.001) {
      nearest.push(actor);
    }
  }
  if (nearest.length === 1) {
    return nearest[0].id;
  }
  const pick = Math.floor(random() * nearest.length);
  return nearest[clampIndex(pick, nearest.length)].id;
}

function clampIndex(value: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(length - 1, value));
}
