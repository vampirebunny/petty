import type { TrickListing } from '../../sim/tricks';
import type { Stage, Trait } from '../../sim/types';

export const traitLabel: Record<Trait, string> = {
  stamina: 'Stamina',
  agility: 'Agility',
  intelligence: 'Intelligence',
  boldness: 'Boldness',
  affection: 'Affection',
  obedience: 'Obedience',
};

export function raisesLine(traits: Trait[]): string {
  return traits.map((trait) => `+ ${traitLabel[trait]}`).join(', ');
}

export type ColorFamily = 'blue' | 'purple' | 'orange' | 'mint';

const familyById: Record<string, ColorFamily> = {
  dog_down: 'blue',
  dog_spin: 'purple',
  dog_high_five: 'orange',
  dog_bow: 'mint',
  dog_jump_up: 'blue',
  dog_roll_over: 'purple',
  dog_catch: 'orange',
  dog_stand_tall: 'mint',
  dog_tunnel: 'blue',
  dog_hurdle: 'purple',
  dog_hoop: 'orange',
  dog_play_dead: 'mint',
  dog_sing: 'blue',
  dog_weave: 'purple',
  cat_spin: 'purple',
  cat_high_five: 'orange',
  cat_lie_down: 'mint',
  cat_jump_up: 'blue',
  cat_tunnel: 'purple',
  cat_roll_over: 'orange',
  cat_stand_tall: 'mint',
  cat_hurdle: 'blue',
  cat_hoop: 'purple',
  cat_fetch: 'orange',
  cat_sing: 'mint',
  cat_weave: 'blue',
  sit: 'blue',
  speak: 'purple',
  paw: 'mint',
};

// None of the current tricks are flagged new. A future row sets a local-midnight timestamp here.
const newUntil: Partial<Record<string, number>> = {};

export function colorFamilyOf(id: string): ColorFamily {
  return familyById[id] ?? 'purple';
}

export function trickIsNew(id: string, now: number): boolean {
  const until = newUntil[id];
  return until != null && now < until;
}

export function isQuickLearn(trick: TrickListing): boolean {
  return trick.difficulty <= 1;
}

export function stageAgeLabel(stage: Stage, species: 'dog' | 'cat'): string {
  if (stage === 'puppy') {
    return species === 'cat' ? 'Kitten' : 'Puppy';
  }
  if (stage === 'olderPuppy') {
    return species === 'cat' ? 'Older kitten' : 'Older puppy';
  }
  if (stage === 'adolescent') {
    return 'Adolescent';
  }
  if (stage === 'adult') {
    return 'Adult';
  }
  return 'Senior';
}

export function dayKey(now: number): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function fnv(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function trickOfTheDay(eligible: TrickListing[], ownerId: string, now: number): TrickListing | null {
  if (eligible.length === 0) {
    return null;
  }
  const sorted = [...eligible].sort((a, b) => a.id.localeCompare(b.id));
  return sorted[fnv(`${dayKey(now)}:${ownerId}`) % sorted.length] ?? null;
}

export function untilMidnightLabel(now: number): string {
  const date = new Date(now);
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const minutes = Math.max(0, Math.ceil((next.getTime() - now) / 60000));
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export type TrainRow = {
  id: string;
  progress: number;
  unlocked: boolean;
  restUntil: number | null;
  source: 'starter' | 'purchase';
  lastPracticedAt: number | null;
};

export type TrainKind = 'new' | 'ready' | 'almost' | 'resting' | 'locked';

export function trainKind(row: TrainRow, now: number): TrainKind {
  if (!row.unlocked) {
    return 'locked';
  }
  if (row.restUntil != null && now < row.restUntil) {
    return 'resting';
  }
  if (row.source === 'purchase' && row.progress <= 0 && row.lastPracticedAt == null) {
    return 'new';
  }
  if (row.progress >= 90) {
    return 'almost';
  }
  return 'ready';
}

export function trainingOrder(rows: TrainRow[], now: number): string[] {
  const rank: Record<TrainKind, number> = { new: 0, ready: 1, almost: 1, resting: 2, locked: 3 };
  return [...rows]
    .sort((a, b) => {
      const kindA = trainKind(a, now);
      const kindB = trainKind(b, now);
      if (rank[kindA] !== rank[kindB]) {
        return rank[kindA] - rank[kindB];
      }
      if (kindA === 'resting') {
        return (a.restUntil ?? 0) - (b.restUntil ?? 0);
      }
      if (kindA === 'ready' || kindA === 'almost') {
        return b.progress - a.progress;
      }
      return a.id.localeCompare(b.id);
    })
    .map((row) => row.id);
}

export type ShopRank = {
  id: string;
  price: number;
  mastered: boolean;
  owned: boolean;
  fresh: boolean;
  affordable: boolean;
};

export function shopOrder(rows: ShopRank[]): string[] {
  const group = (row: ShopRank) => {
    if (row.mastered) {
      return 4;
    }
    if (row.owned) {
      return 3;
    }
    if (row.fresh) {
      return 0;
    }
    return row.affordable ? 1 : 2;
  };
  return [...rows]
    .sort((a, b) => {
      const groupA = group(a);
      const groupB = group(b);
      if (groupA !== groupB) {
        return groupA - groupB;
      }
      if (groupA <= 2 && a.price !== b.price) {
        return a.price - b.price;
      }
      return a.id.localeCompare(b.id);
    })
    .map((row) => row.id);
}
