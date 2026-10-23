export type TipId = 'tip.water' | 'tip.food' | 'tip.sleep' | 'tip.cuddle' | 'tip.move';

export type TipPhase = 'fresh' | 'snoozed' | 'done';

export function phaseAfter(phase: TipPhase | undefined, event: 'act' | 'dismiss'): TipPhase {
  if (phase === 'done' || event === 'act') {
    return 'done';
  }
  if (phase === 'snoozed' && event === 'dismiss') {
    return 'done';
  }
  return 'snoozed';
}

export function canShowTip(phase: TipPhase | undefined): boolean {
  return phase !== 'done';
}

// The move tip is finished the moment it appears. A dismiss does not schedule another show.
// A snoozed move tip was already shown under the old rule, so it stays retired too.
export function canOffer(id: TipId, phase: TipPhase | undefined): boolean {
  if (id === 'tip.move') {
    return phase == null;
  }
  return canShowTip(phase);
}

export function phaseOnShow(id: TipId, phase: TipPhase | undefined): TipPhase | undefined {
  if (id === 'tip.move') {
    return 'done';
  }
  return phase;
}
