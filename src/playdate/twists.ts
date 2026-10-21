import { s } from './story';
import type { Step, StoryContext, Who } from './story';
import type { SpeciesPair } from './types';

type PairName = 'dogs' | 'cats' | 'cross';

type Twist = {
  id: string;
  activities: string[] | 'any';
  pairs: PairName[] | 'any';
  fits?: (ctx: StoryContext) => boolean;
  weight: (ctx: StoryContext) => number;
  steps: (ctx: StoryContext, rng: () => number) => Step[];
  replace?: 'finish';
};

const places = ['center', 'left', 'right', 'far'] as const;

function pairName(pair: SpeciesPair): PairName {
  if (pair === 'dog-dog') {
    return 'dogs';
  }
  if (pair === 'cat-cat') {
    return 'cats';
  }
  return 'cross';
}

function avg(ctx: StoryContext, trait: 'intelligence' | 'stamina' | 'boldness'): number {
  return (ctx.petA.attributes[trait] + ctx.petB.attributes[trait]) / 2;
}

function hasDog(ctx: StoryContext): boolean {
  return ctx.petA.species === 'dog' || ctx.petB.species === 'dog';
}

function catBoldness(ctx: StoryContext): number {
  if (ctx.petA.species === 'cat' && ctx.petB.species === 'cat') {
    return Math.max(ctx.petA.attributes.boldness, ctx.petB.attributes.boldness);
  }
  if (ctx.petA.species === 'cat') {
    return ctx.petA.attributes.boldness;
  }
  return ctx.petB.attributes.boldness;
}

const twists: Twist[] = [
  {
    id: 'butterfly',
    activities: 'any',
    pairs: 'any',
    weight: (ctx) => 0.8 + (100 - avg(ctx, 'intelligence')) / 40,
    steps: () => [
      s('bolder', 'sit', { gesture: 'head_tilt', weight: 0.4 }),
      s('shyer', 'sit', { gesture: 'head_tilt', emote: 'question', parallel: true }),
      s('bolder', 'approach', { place: 'random', pace: 0.45, fx: 'butterfly', weight: 0.8 }),
      s('bolder', 'approach', { place: 'random', pace: 0.45, fx: 'butterfly', weight: 0.8 }),
      s('bolder', 'approach', { place: 'random', pace: 0.45, fx: 'butterfly', weight: 0.8 }),
      s('bolder', 'run_to', { toward: 'partner', gap: 1.3, pace: 0.85, gesture: 'double_take', weight: 0.7 }),
    ],
  },
  {
    id: 'zoomies',
    activities: 'any',
    pairs: 'any',
    fits: (ctx) => hasDog(ctx) || Math.max(ctx.petA.attributes.stamina, ctx.petB.attributes.stamina) >= 60,
    weight: (ctx) => 0.7 + avg(ctx, 'stamina') / 80,
    steps: (_ctx, rng) => {
      const count = 3 + (rng() < 0.5 ? 1 : 0);
      const laps: Step[] = [];
      for (let i = 0; i < count; i += 1) {
        laps.push(s('both', 'zoomies', { place: places[i % places.length], tempo: 'snap', weight: 0.55 }));
      }
      laps.push(s('both', 'skid', { weight: 0.35, camera: 'punch' }));
      laps.push(s('both', 'flop', { weight: 0.45 }));
      laps.push(s('both', 'pant', { emote: 'sweat', weight: 0.5 }));
      return laps;
    },
  },
  {
    id: 'fake_out',
    activities: ['chase', 'hide', 'fetch'],
    pairs: 'any',
    fits: (ctx) => ctx.activity.id !== 'fetch' || ctx.pair === 'dog-cat',
    weight: (ctx) => 0.6 + avg(ctx, 'intelligence') / 80,
    steps: () => [
      s('bolder', 'sit', { gesture: 'butt_wiggle', weight: 0.5 }),
      s('shyer', 'sit', { gesture: 'startle', emote: 'exclaim', parallel: true }),
      s('bolder', 'sit', { gesture: 'yawn', weight: 0.7 }),
    ],
  },
  {
    id: 'photo_finish',
    activities: ['race'],
    pairs: 'any',
    weight: () => 1,
    replace: 'finish',
    steps: () => [
      s('both', 'run_to', { place: 'right', spread: 'y', pace: 0.9, weight: 1.6, camera: 'punch' }),
      s('both', 'sit', { gesture: 'double_take', weight: 0.4 }),
      s('winner', 'win', { emote: 'sparkle', weight: 0.8 }),
      s('loser', 'pant', { parallel: true }),
    ],
  },
  {
    id: 'steal',
    activities: ['fetch', 'tug'],
    pairs: ['cross'],
    weight: (ctx) => 0.5 + catBoldness(ctx) / 60,
    steps: () => [
      s('cat', 'run_to', { toward: 'away', pace: 0.95, weight: 1, prop: { kind: 'ball', holder: 'cat' } }),
      s('dog', 'run_to', { toward: 'partner', gap: 1.1, pace: 0.9, parallel: true }),
    ],
  },
  {
    id: 'tug_flip',
    activities: ['tug'],
    pairs: 'any',
    weight: () => 1,
    steps: () => [
      s('both', 'sit', { weight: 0.4, prop: { kind: 'rope', holder: null, at: 'center' } }),
      s('both', 'flop', { weight: 0.6, camera: 'shake' }),
      s('both', 'roll_over', { weight: 0.7 }),
      s('both', 'pant', { emote: 'note', toward: 'partner', gap: 1.2, weight: 0.6 }),
    ],
  },
  {
    id: 'sneeze_chain',
    activities: 'any',
    pairs: 'any',
    weight: (ctx) => 0.5 + (100 - Math.min(ctx.petA.attributes.stamina, ctx.petB.attributes.stamina)) / 50,
    steps: () => [
      s('A', 'sit', { gesture: 'sneeze', sfx: 'sneeze', weight: 0.4 }),
      s('B', 'sit', { gesture: 'startle', emote: 'exclaim', parallel: true }),
      s('B', 'sit', { gesture: 'sneeze', sfx: 'sneeze', weight: 0.5, holdBefore: 350 }),
    ],
  },
  {
    id: 'mirror',
    activities: 'any',
    pairs: 'any',
    fits: (ctx) => ctx.bond >= 24,
    weight: (ctx) => 0.5 + ctx.bond / 40,
    steps: () => [
      s('both', 'sit', { gesture: 'big_stretch', weight: 0.7 }),
      s('both', 'sit', { gesture: 'shake_off', weight: 0.6 }),
      s('both', 'sit', { gesture: 'look_at_camera', weight: 0.5 }),
    ],
  },
  {
    id: 'hide_reverse',
    activities: ['hide'],
    pairs: 'any',
    weight: () => 1,
    steps: () => [
      s('shyer', 'stalk', { toward: 'partner', gap: 0.9, weight: 1 }),
      s('bolder', 'sit', { gesture: 'startle', emote: 'exclaim', parallel: true }),
      s('both', 'celebrate', { weight: 0.6 }),
    ],
  },
  {
    id: 'doze_off',
    activities: 'any',
    pairs: 'any',
    fits: (ctx) => ctx.activity.id !== 'nap',
    weight: (ctx) => 0.5 + (100 - Math.min(ctx.petA.attributes.stamina, ctx.petB.attributes.stamina)) / 40,
    steps: (ctx) => {
      const tired: Who = ctx.petA.attributes.stamina <= ctx.petB.attributes.stamina ? 'A' : 'B';
      const other: Who = tired === 'A' ? 'B' : 'A';
      return [
        s(tired, 'flop', { emote: 'zzz', weight: 0.6 }),
        s(other, 'sniff', { toward: 'partner', gap: 0.9, weight: 0.8 }),
        s(tired, 'sit', { gesture: 'startle', emote: 'exclaim', weight: 0.4 }),
        s(other, 'play_bow', { parallel: true }),
      ];
    },
  },
];

function eligible(twist: Twist, ctx: StoryContext): boolean {
  const activityOk = twist.activities === 'any' || twist.activities.includes(ctx.activity.id);
  const pairOk = twist.pairs === 'any' || twist.pairs.includes(pairName(ctx.pair));
  return activityOk && pairOk && (twist.fits == null || twist.fits(ctx));
}

function mentioned(tags: readonly string[], id: string): boolean {
  return tags.some((tag) => tag === id || tag === `twist:${id}`);
}

function twistWeight(twist: Twist, ctx: StoryContext): number {
  if (mentioned(ctx.latestTags ?? [], twist.id)) {
    return 0;
  }
  const base = twist.weight(ctx);
  return mentioned(ctx.recentTags, twist.id) ? base * 0.5 : base;
}

function pickTwist(pool: readonly Twist[], ctx: StoryContext, rng: () => number): Twist | null {
  if (pool.length === 0) {
    return null;
  }
  const weights = pool.map((twist) => Math.max(0, twistWeight(twist, ctx)));
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

function decorate(twist: Twist, steps: Step[], rng: () => number): Step[] {
  const holdBefore = 400 + Math.floor(rng() * 301);
  const tag = `twist:${twist.id}`;
  return steps.map((step, index) => (index === 0 ? { ...step, parallel: false, holdBefore, tag } : { ...step }));
}

type Range = { start: number; end: number };

function insertionIndex(steps: readonly Step[], rng: () => number): number {
  if (steps.length === 0) {
    return 0;
  }
  let index = Math.min(steps.length - 1, Math.floor((0.55 + rng() * 0.2) * steps.length));
  while (index < steps.length && steps[index]?.parallel === true) {
    index += 1;
  }
  return index;
}

function avoid(steps: readonly Step[], index: number, blocked: readonly Range[]): number {
  let cursor = index;
  const inside = (at: number) => blocked.some((range) => at >= range.start && at < range.end);
  while (cursor < steps.length && (steps[cursor]?.parallel === true || inside(cursor))) {
    cursor += 1;
  }
  return cursor;
}

function finishSlice(steps: readonly Step[]): [number, number] | null {
  const start = steps.findIndex((step) => step.who === 'winner' && step.action === 'run_to' && step.parallel !== true);
  if (start < 0) {
    return null;
  }
  let end = start + 1;
  while (end < steps.length && steps[end]?.parallel === true) {
    end += 1;
  }
  if (end < steps.length && steps[end]?.action === 'win') {
    end += 1;
    while (end < steps.length && steps[end]?.parallel === true) {
      end += 1;
    }
  }
  return [start, end];
}

function placeTwist(steps: Step[], twist: Twist, ctx: StoryContext, rng: () => number, blocked: Range[]): Step[] {
  const body = decorate(twist, twist.steps(ctx, rng), rng);
  if (twist.replace === 'finish') {
    const slice = finishSlice(steps);
    if (slice) {
      const [start, end] = slice;
      blocked.push({ start, end: start + body.length });
      return [...steps.slice(0, start), ...body, ...steps.slice(end)];
    }
  }
  const at = avoid(steps, insertionIndex(steps, rng), blocked);
  blocked.push({ start: at, end: at + body.length });
  return [...steps.slice(0, at), ...body, ...steps.slice(at)];
}

export function insertTwists(steps: Step[], ctx: StoryContext, rng: () => number): Step[] {
  const open = twists.filter((twist) => eligible(twist, ctx));
  const first = pickTwist(open, ctx, rng);
  if (!first) {
    return steps;
  }
  const blocked: Range[] = [];
  let next = placeTwist(steps, first, ctx, rng, blocked);
  if (rng() < 0.25) {
    const second = pickTwist(
      open.filter((twist) => twist.id !== first.id),
      ctx,
      rng,
    );
    if (second) {
      next = placeTwist(next, second, ctx, rng, blocked);
    }
  }
  return next;
}
