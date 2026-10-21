import type { ActivityDefinition, BeatTempo, BeatToward, PetSnapshot, SpeciesPair } from './types';

export type Who = 'A' | 'B' | 'both' | 'bolder' | 'shyer' | 'winner' | 'loser' | 'dog' | 'cat';

export type Place = 'random' | 'center' | 'left' | 'right' | 'far' | 'near';

export type StepProp = {
  kind: 'ball' | 'frisbee' | 'squeaky' | 'stick' | 'rope';
  holder?: Who | null;
  throwTo?: Place | { x: number; y: number };
  at?: Place | 'throwTo' | { x: number; y: number };
};

export type Step = {
  who: Who;
  action: string;
  toward?: BeatToward;
  gap?: number;
  pace?: number;
  lane?: number;
  spread?: 'x' | 'y';
  place?: Place;
  // Use the throw point resolved earlier in this playdate instead of rolling a new one.
  placeFrom?: 'throwTo';
  weight?: number;
  parallel?: boolean;
  tempo?: BeatTempo;
  holdBefore?: number;
  delay?: number;
  emote?: string;
  fx?: string;
  sfx?: string;
  camera?: string;
  tag?: string;
  gesture?: string;
  prop?: StepProp;
};

export type StoryContext = {
  petA: PetSnapshot;
  petB: PetSnapshot;
  activity: ActivityDefinition;
  pair: SpeciesPair;
  recentTags: readonly string[];
  latestTags: readonly string[];
  bond: number;
};

export type Variant = {
  id: string;
  weight: number;
  steps: Step[];
  requires?: (ctx: StoryContext) => boolean;
};

export type Story = {
  intro: Variant[];
  main: Variant[];
  finale: Variant[];
};

export const s = (who: Who, action: string, extra: Omit<Step, 'who' | 'action'> = {}): Step => ({ who, action, ...extra });

export function pickVariant(variants: readonly Variant[], ctx: StoryContext, rng: () => number): Variant {
  const open = variants.filter((variant) => variant.requires == null || variant.requires(ctx));
  const pool = open.length > 0 ? open : variants;
  const weights = pool.map((variant) => Math.max(0, variant.weight));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) {
    return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  }
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i] ?? 0;
    if (roll < 0) {
      return pool[i];
    }
  }
  return pool[pool.length - 1];
}

export function tagAct(variant: Variant, act: 'intro' | 'main' | 'finale'): Step[] {
  const tag = `variant:${act}:${variant.id}`;
  return variant.steps.map((step, index) => (index === 0 ? { ...step, tag } : { ...step }));
}
