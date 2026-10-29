import type { TutorialAction } from '../../sim/gameplayConfig';

export type TipId = 'tip.water' | 'tip.food' | 'tip.sleep' | 'tip.cuddle' | 'tip.move';

const tutorialTipAction: Partial<Record<TipId, TutorialAction>> = {
  'tip.food': 'feed',
  'tip.water': 'water',
  'tip.sleep': 'nap',
  'tip.cuddle': 'cuddle',
};

// A tutorial bubble is for an action the player has not done yet.
export function tutorialBlocksTip(id: TipId, seen: readonly string[]): boolean {
  const action = tutorialTipAction[id];
  return action != null && seen.includes(action);
}

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
