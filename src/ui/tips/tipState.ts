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
