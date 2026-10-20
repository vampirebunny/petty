import { careConfig } from './careConfig';
import { nextRng } from './rng';
import type { Mess, PetState } from './types';

export function messesIn(state: PetState, sceneId: string): Mess[] {
  return state.care.messes.filter((mess) => mess.sceneId === sceneId);
}

export function spawnMess(state: PetState, sceneId: string, now: number): PetState {
  if (state.care.messes.length >= careConfig.maxMesses) {
    return state;
  }
  const xRoll = nextRng(state.rngState);
  const yRoll = nextRng(xRoll.state);
  const mess: Mess = {
    id: `m${yRoll.state.toString(36)}`,
    sceneId,
    x: 70 + xRoll.value * 500,
    y: 250 + yRoll.value * 360,
    createdAt: now,
  };
  return {
    ...state,
    rngState: yRoll.state,
    care: { ...state.care, messes: [...state.care.messes, mess] },
  };
}

export function cleanMess(state: PetState, messId: string): PetState {
  return {
    ...state,
    care: { ...state.care, messes: state.care.messes.filter((mess) => mess.id !== messId) },
  };
}

export function messStage(createdAt: number, now: number): 'fresh' | 'stink' | 'flies' {
  const age = now - createdAt;
  if (age >= careConfig.messFliesMs) {
    return 'flies';
  }
  if (age >= careConfig.messStinkMs) {
    return 'stink';
  }
  return 'fresh';
}

// The scene with the most messes. Ties go to the most recently visited, then the scene list order.
export function messDestination(state: PetState): string | null {
  const counts = new Map<string, number>();
  for (const mess of state.care.messes) {
    counts.set(mess.sceneId, (counts.get(mess.sceneId) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [sceneId, count] of counts) {
    if (count > bestCount) {
      best = sceneId;
      bestCount = count;
    } else if (count === bestCount && best) {
      const recent = state.care.recentScenes;
      const a = recent.indexOf(sceneId);
      const b = recent.indexOf(best);
      const aRank = a === -1 ? recent.length + careConfig.sceneOrder.indexOf(sceneId) : a;
      const bRank = b === -1 ? recent.length + careConfig.sceneOrder.indexOf(best) : b;
      if (aRank < bRank) {
        best = sceneId;
      }
    }
  }
  return best;
}

export function drainMesses(state: PetState, awakeMs: number): PetState {
  if (state.care.messes.length === 0 || awakeMs <= 0) {
    return state;
  }
  const hours = awakeMs / (60 * 60 * 1000);
  const happy = Math.min(careConfig.messDrainCap, state.care.messes.length * careConfig.messHappyPerHour * hours);
  const hygiene = Math.min(careConfig.messDrainCap, state.care.messes.length * careConfig.messHygienePerHour * hours);
  return {
    ...state,
    needs: { ...state.needs, happiness: Math.max(0, state.needs.happiness - happy) },
    care: { ...state.care, hygiene: Math.max(0, state.care.hygiene - hygiene) },
  };
}
