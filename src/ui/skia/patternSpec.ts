import type { WearItem } from '../../actor/wardrobe';

export type PatternId = 'stripes' | 'gingham' | 'plaid' | 'daisies' | 'stars' | 'rainbow';

export type PatternPaint = {
  id: PatternId;
  c: string;
  d?: string;
  u: number;
  angle: number;
};

const known: readonly PatternId[] = ['stripes', 'gingham', 'plaid', 'daisies', 'stars', 'rainbow'];

const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) {
    return;
  }
  warned.add(key);
  if (typeof __DEV__ === 'undefined' || __DEV__) {
    console.warn(message);
  }
}

export function isPatternId(value: string): value is PatternId {
  return (known as readonly string[]).includes(value);
}

/** Round the tile size so one picture is shared across nearby head sizes. */
export function patternUnit(u: number): number {
  return Math.max(0.5, Math.round(u * 2) / 2);
}

// Stripes on a scarf or bandana run at 30 degrees. Everything else is horizontal in the part's own frame.
export function patternAngle(item: WearItem): number {
  if (item.colorway.pattern === 'stripes' && (item.shape === 'scarf' || item.shape === 'bandana')) {
    return 30;
  }
  return 0;
}

export function patternPaint(item: WearItem, part: string, u: number, angle = patternAngle(item)): PatternPaint | null {
  const id = item.colorway.pattern;
  if (!id) {
    return null;
  }
  if (item.patternParts && !item.patternParts.includes(part)) {
    return null;
  }
  if (!isPatternId(id)) {
    warnOnce(`pattern:${id}`, `unknown pattern ${id}`);
    return null;
  }
  return { id, c: item.colorway.c, d: item.colorway.d, u: patternUnit(u), angle };
}
