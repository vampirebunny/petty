import type { Facing, ViewId } from '../../actor/data/facing';
import { viewOf } from '../../actor/facing';

export type CoatSlot = 'side' | 'front' | 'back';

export type CoatWeights = {
  side: number;
  front: number;
  back: number;
  /** Hind legs draw once, after the back hood, and the early near-leg pass is skipped. */
  legsInBackPass: boolean;
};

function slotOf(view: ViewId): CoatSlot {
  if (view === 'front') {
    return 'front';
  }
  if (view === 'back') {
    return 'back';
  }
  return 'side';
}

// Outgoing is `from` at 1 - blend, incoming is `to` at blend. Side and 3/4 share one slot, so that
// turn does not crossfade. A settled pet keeps blend at 1, which leaves the previous coat at 0.
// After leaving full back, `from` can still be back while its weight is 0; that must not steal the legs.
export function coatWeights(from: Facing, to: Facing, blend: number): CoatWeights {
  const t = Math.max(0, Math.min(1, blend));
  const outgoing = slotOf(viewOf(from));
  const incoming = slotOf(viewOf(to));
  const weights: CoatWeights = { side: 0, front: 0, back: 0, legsInBackPass: false };
  if (outgoing === incoming) {
    weights[outgoing] = 1;
  } else {
    weights[outgoing] = 1 - t;
    weights[incoming] = t;
  }
  weights.legsInBackPass = weights.back > 0.001;
  return weights;
}
