import type { Prop } from '../../actor/scenes';

// Shared prop geometry, so the light pass and the props agree on where things are.

/** Windows are drawn at least this big, so there is a real view outside. Scene data can go larger. */
export const WINDOW_MIN = { w: 150, h: 132 };

/** A window's pane size in its own (unscaled) coordinates, clamped so the top stays on the wall. */
export function windowDims(prop: Prop): { w: number; h: number } {
  let w = prop.w ?? 168;
  let h = prop.h ?? 150;
  if (w < WINDOW_MIN.w) {
    const k = WINDOW_MIN.w / w;
    w *= k;
    h *= k;
  }
  h = Math.max(h, WINDOW_MIN.h);
  const scale = prop.scale ?? 1;
  // Leave a little wall above the frame.
  const maxH = (prop.y - 16) / scale;
  return { w, h: Math.max(60, Math.min(h, maxH)) };
}

/** Half width of a prop's footprint on the floor, for decor placement and pet contact. */
export function footprint(prop: Prop): number {
  const scale = prop.scale ?? 1;
  const kind = prop.kind as string;
  const defaults: Record<string, number> = {
    bowl: 34,
    litterbox: 42,
    bed: 58,
    rug: 140,
    couch: 100,
    lamp: 18,
    tree: 40,
    bench: 52,
    pond: 78,
    bush: 34,
    fence: 150,
    catTree: 48,
    planter: 30,
    scratcher: 22,
    pumpkin: 14,
    catioPost: 16,
  };
  const w = prop.w ? prop.w / 2 : defaults[kind] ?? 30;
  return w * scale;
}
