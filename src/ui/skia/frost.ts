import type { SkCanvas } from '@shopify/react-native-skia';

import { mulberry } from '../../actor/mulberry';
import { fillCircle, fillOval } from './draw';

// A fixed speckle pattern over the unit disc. Each speck has a threshold, so frost starts sparse and fills in
// as the amount grows, and the same specks always land in the same places (no shimmer between frames).
type Speck = { x: number; y: number; size: number; at: number };

const specks: readonly Speck[] = (() => {
  const roll = mulberry(1907);
  const list: Speck[] = [];
  for (let i = 0; i < 60; i += 1) {
    const angle = roll() * Math.PI * 2;
    const radius = Math.sqrt(roll());
    // Specks near the edge come in later, so the edge stays feathered and the middle frosts first.
    const at = (0.5 * radius + 0.5 * roll()) * 0.9;
    list.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, size: 0.55 + roll() * 0.9, at });
  }
  return list;
})();

// Frosting inside an oval: a very soft wash plus speckles, never a solid shape.
export function frostOval(c: SkCanvas, cx: number, cy: number, rx: number, ry: number, color: string, amount: number): void {
  if (amount <= 0.01) {
    return;
  }
  const a = Math.min(1, amount);
  fillOval(c, cx, cy, rx * 0.85, ry * 0.8, color, 0.16 * a);
  const dot = Math.max(0.55, Math.min(rx, ry) * 0.17);
  for (const speck of specks) {
    const visible = Math.min(1, Math.max(0, (a - speck.at) * 5));
    if (visible <= 0.01) {
      continue;
    }
    fillCircle(c, cx + speck.x * rx, cy + speck.y * ry, dot * speck.size * (0.7 + 0.3 * a), color, 0.8 * visible);
  }
}
