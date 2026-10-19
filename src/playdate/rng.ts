import { mulberry, seedOf } from '../actor/mulberry';

export function rngFrom(...parts: (string | number)[]): () => number {
  return mulberry(seedOf(parts.map(String).join('|')));
}

export function pickIndex(rng: () => number, length: number): number {
  if (length <= 1) {
    return 0;
  }
  return Math.min(length - 1, Math.floor(rng() * length));
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = pickIndex(rng, i + 1);
    const swap = next[i];
    next[i] = next[j];
    next[j] = swap;
  }
  return next;
}
