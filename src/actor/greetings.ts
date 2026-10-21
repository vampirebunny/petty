import { stageDayThresholds } from '../sim/config';
import type { GreetSound, GreetStep, SoundEvent } from './types';

export const GREET = {
  MIN_AWAY_MIN: 2,
  SHORT_MAX_H: 2,
  MEDIUM_MAX_H: 12,
  TIRED: 35,
  MID: 50,
  PAT_BONUS: 5,
  HEARTS: true,
  START_DELAY: 0.35,
} as const;

export type MotionMods = { pace: number; hop: number; tumble: number };

type Row = MotionMods & { day: number };

const ageRows: Row[] = [
  { day: 0, pace: 0.85, hop: 1.15, tumble: 0.6 },
  { day: stageDayThresholds[0], pace: 0.88, hop: 1.15, tumble: 0.3 },
  { day: stageDayThresholds[1], pace: 0.95, hop: 1.1, tumble: 0 },
  { day: stageDayThresholds[2], pace: 1, hop: 1, tumble: 0 },
  { day: stageDayThresholds[3], pace: 1.15, hop: 0.8, tumble: 0 },
];

const seniorRows: { vitality: number; pace: number; hop: number }[] = [
  { vitality: 0.35, pace: 1.45, hop: 0.55 },
  { vitality: 0.55, pace: 1.3, hop: 0.65 },
  { vitality: 0.85, pace: 1.15, hop: 0.8 },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpMods(a: MotionMods, b: MotionMods, t: number): MotionMods {
  return { pace: lerp(a.pace, b.pace, t), hop: lerp(a.hop, b.hop, t), tumble: lerp(a.tumble, b.tumble, t) };
}

function seniorMods(vitality: number): MotionMods {
  const v = Math.max(seniorRows[0].vitality, Math.min(seniorRows[seniorRows.length - 1].vitality, vitality));
  for (let i = 1; i < seniorRows.length; i += 1) {
    const lo = seniorRows[i - 1];
    const hi = seniorRows[i];
    if (v <= hi.vitality) {
      const t = (v - lo.vitality) / (hi.vitality - lo.vitality);
      return { pace: lerp(lo.pace, hi.pace, t), hop: lerp(lo.hop, hi.hop, t), tumble: 0 };
    }
  }
  const last = seniorRows[seniorRows.length - 1];
  return { pace: last.pace, hop: last.hop, tumble: 0 };
}

// Pace, hop, and tumble chance. Energy is the 0–100 need (low means tired).
export function motionMods(ageDays: number, vitality: number, energy: number): MotionMods {
  let mods: MotionMods;
  if (ageDays >= stageDayThresholds[3]) {
    const senior = seniorMods(vitality);
    const into = ageDays - stageDayThresholds[3];
    mods = into < 1 ? lerpMods(ageRows[3], senior, into) : senior;
  } else {
    mods = ageRows[0];
    for (let i = 0; i < ageRows.length - 1; i += 1) {
      const lo = ageRows[i];
      const hi = ageRows[i + 1];
      if (ageDays < hi.day) {
        const remain = hi.day - ageDays;
        mods = remain < 1 ? lerpMods(lo, hi, 1 - remain) : lo;
        break;
      }
    }
  }
  if (energy < GREET.TIRED) {
    return { pace: mods.pace * 1.15, hop: mods.hop * 0.75, tumble: mods.tumble };
  }
  return mods;
}

export function greetClip(kind: GreetSound): { sound: SoundEvent['sound']; rate: number; jaw: boolean } {
  switch (kind) {
    case 'yip':
      return { sound: 'bark', rate: 1.5, jaw: true };
    case 'woof':
    case 'howl':
      return { sound: 'bark', rate: 1, jaw: true };
    case 'whine':
      return { sound: 'cuddle_happy', rate: 1, jaw: true };
    case 'trill':
      return { sound: 'meow', rate: 1.4, jaw: true };
    case 'yawn':
      return { sound: 'meow', rate: 0.7, jaw: true };
    case 'purr':
      return { sound: 'cuddle_purr', rate: 1, jaw: false };
    default:
      return { sound: 'meow', rate: 1, jaw: true };
  }
}

type Built = {
  id: string;
  species: 'dog' | 'cat';
  tags: { aff?: number; bold?: number; nrg?: number };
  start?: 'edge' | 'bed';
  short?: boolean;
  steps: (hop: number, tumble: boolean) => GreetStep[];
};

const wakeDog: GreetStep[] = [
  { dur: 0.2, pose: { lie: 1, eyes: 0 } },
  { dur: 0.4, pose: { eyes: 0 } },
];

function dogSteps(hop: number, tumble: boolean): Record<string, GreetStep[]> {
  const h = (n: number) => n * hop;
  return {
    zoomies: [
      { dur: 0.25, wag: { amp: 0.5, rate: 12 }, sound: 'yip' },
      { move: { to: 'right', speed: 1.3 }, untilArrive: true, dur: 1.6 },
      { move: { to: 'left', speed: 1.3 }, untilArrive: true, dur: 2.2 },
      { move: { to: 'center', speed: 1.1 }, untilArrive: true, dur: 1.6, skid: true },
      ...(tumble
        ? ([
            { dur: 0.3, pose: { belly: 1 }, sound: 'yip' },
            { dur: 0.45 },
          ] as GreetStep[])
        : []),
      { dur: 1.2, pose: { sit: 1, pant: 1, faceCam: 0.6 }, wag: { amp: 0.6, rate: 12 } },
    ],
    bounce: [
      { dur: 0.3, pose: { pant: 0.6 }, wag: { amp: 0.6, rate: 14 }, sound: 'yip' },
      { dur: 0.45, pose: { rearUp: 1 }, hop: h(240) },
      { dur: 0.15 },
      { dur: 0.7, hop: h(280), spin: true },
      { dur: 0.15 },
      { dur: 0.45, pose: { rearUp: 1 }, hop: h(220), sound: 'yip' },
      { dur: 0.9, pose: { pant: 0.8, faceCam: 0.5 } },
    ],
    bow: [
      { dur: 0.4, pose: { bow: 1, headUp: 0.25, faceCam: 0.3 }, wag: { amp: 0.7, rate: 14 } },
      { dur: 0.3, pose: { bow: 1 }, sound: 'woof' },
      { dur: 0.7, pose: { bow: 1 } },
      { dur: 0.3, pose: { bow: 1 }, sound: 'woof' },
      { dur: 0.4, hop: h(200) },
      { dur: 0.6 },
    ],
    runup: [
      {
        move: { to: 'front', speed: 0.9 },
        untilArrive: true,
        dur: 1.6,
        pose: { closeUp: 1, headFront: 1, faceCam: 0.8, pant: 0.8 },
        wag: { amp: 0.6, rate: 14 },
      },
      { dur: 0.35, pose: { closeUp: 1, headFront: 1, faceCam: 0.8, sit: 1, pant: 0.8 } },
      { dur: 1.5, pose: { closeUp: 1, headFront: 1, faceCam: 0.8, sit: 1, pant: 1 }, sound: 'whine' },
    ],
    fetch: [
      { dur: 0.25, wag: { amp: 0.5, rate: 12 }, sound: 'yip' },
      { move: { to: 'offEdge', speed: 1.2 }, untilArrive: true, dur: 1.8 },
      { dur: 0.6, toy: 'pickup' },
      { move: { to: 'center', speed: 1 }, untilArrive: true, dur: 2 },
      { dur: 0.35, pose: { headDown: 0.5 } },
      { dur: 0.15, toy: 'drop' },
      { dur: 1.4, pose: { sit: 1, faceCam: 0.8, headFront: 0.8, pant: 0.6 }, wag: { amp: 0.7, rate: 14 }, sound: 'woof' },
    ],
    wiggle: [
      { dur: 0.3, pose: { pant: 0.6, faceCam: 0.5 }, wag: { amp: 0.85, rate: 16 }, march: true },
      { dur: 1.5, pose: { faceCam: 0.5 }, wag: { amp: 0.85, rate: 18 }, march: true, sound: 'yip' },
      { dur: 0.4 },
    ],
    rollover: [
      { dur: 0.4, wag: { amp: 0.5, rate: 10 } },
      { dur: 0.45, pose: { side: 1 } },
      { dur: 0.5, pose: { belly: 1, eyes: 1, pant: 0.6, legPedal: 1 }, sound: 'whine' },
      { dur: 2, pose: { belly: 1, eyes: 1, pant: 0.6, legPedal: 1 }, patWindow: true, hearts: true },
      { dur: 0.5, pose: { side: 1 } },
      { dur: 0.4 },
    ],
    howl: [
      { dur: 0.4, pose: { sit: 1, headFront: 0.2 } },
      { dur: 0.5, pose: { sit: 1, headUp: 0.9, eyes: 1 } },
      { dur: 1.4, pose: { sit: 1, headUp: 0.9, eyes: 1, jawHold: 0.6 }, sound: 'howl' },
      { dur: 0.5, pose: { sit: 1 }, wag: { amp: 0.5, rate: 10 } },
      { dur: 0.7, pose: { sit: 1, faceCam: 0.6 } },
    ],
    wag: [
      { dur: 0.3, pose: { pant: 0.6, faceCam: 0.6 }, wag: { amp: 0.6, rate: 14 } },
      { dur: 0.35, hop: h(150), sound: 'yip' },
      { dur: 1, pose: { faceCam: 0.6 } },
    ],
  };
}

function catSteps(hop: number): Record<string, GreetStep[]> {
  const h = (n: number) => n * hop;
  return {
    trill: [
      { move: { to: 'center', speed: 0.55 }, untilArrive: true, dur: 2.4, pose: { tailLift: 1 }, sound: 'trill' },
      { dur: 0.4, pose: { sit: 1, tailLift: 1, faceCam: 0.6 } },
      { dur: 0.5, pose: { sit: 1, tailLift: 0.6, faceCam: 0.6, headFront: 0.7 }, sound: 'trill' },
      { dur: 0.9, pose: { sit: 1, faceCam: 0.6 } },
    ],
    rub: [
      { move: { to: 'front', speed: 0.4 }, untilArrive: true, dur: 1.4, pose: { closeUp: 0.6, tailLift: 1, squint: 0.7, faceCam: 0.3 } },
      { move: { dx: 140, speed: 0.35 }, untilArrive: true, dur: 1.4, pose: { closeUp: 0.6, tailLift: 1, squint: 0.7, rubSway: 1 }, sound: 'purr' },
      { move: { dx: -280, speed: 0.35 }, untilArrive: true, dur: 2.2, pose: { closeUp: 0.6, tailLift: 1, squint: 0.7, rubSway: 1 } },
      { move: { to: 'center', speed: 0.4 }, untilArrive: true, dur: 1.4 },
    ],
    stretch: [
      { dur: 0.7, pose: { lie: 1, headRest: 1, eyes: 0 } },
      { dur: 0.6, pose: { bow: 1, headUp: 0.3 } },
      { dur: 1, pose: { bow: 1, headUp: 0.55, jawHold: 1, eyes: 1 }, sound: 'yawn' },
      { dur: 0.4, pose: { bow: 1 } },
      { dur: 0.5 },
      { move: { to: 'center', speed: 0.5 }, untilArrive: true, dur: 2, pose: { tailLift: 1 }, sound: 'trill' },
      { dur: 0.4, pose: { sit: 1, faceCam: 0.6 } },
      { dur: 0.6, pose: { sit: 1, faceCam: 0.6 } },
    ],
    blink: [
      { dur: 0.45, pose: { sit: 1, faceCam: 0.7, headFront: 1 } },
      { dur: 1.3, pose: { sit: 1, faceCam: 0.7, headFront: 1, eyes: 1 }, rate: { eyes: 2.5 } },
      { dur: 0.6, pose: { sit: 1, faceCam: 0.7, headFront: 1, eyes: 1 } },
      { dur: 1, pose: { sit: 1, faceCam: 0.7, headFront: 1 }, rate: { eyes: 2.5 }, sound: 'purr' },
      { dur: 0.3, pose: { sit: 1, faceCam: 0.7, headFront: 1 } },
      { dur: 1.1, pose: { sit: 1, faceCam: 0.7, headFront: 1, eyes: 1 }, rate: { eyes: 2.5 } },
      { dur: 0.9, pose: { sit: 1, faceCam: 0.7, headFront: 1 }, rate: { eyes: 2.5 } },
    ],
    flop: [
      { dur: 0.4, pose: { tailLift: 0.5 } },
      { dur: 0.5, pose: { side: 1, squint: 0.5 }, sound: 'meow' },
      { dur: 1.7, pose: { side: 1, squint: 0.5 }, wag: { amp: 0.6, rate: 8 } },
      { dur: 0.5 },
      { dur: 0.4 },
    ],
    pounce: [
      { move: { dx: -150, speed: 0.5 }, untilArrive: true, dur: 1.2 },
      { face: 'flip', dur: 0.1 },
      { dur: 0.4, pose: { pupils: 1 } },
      { dur: 0.9, pose: { pupils: 1 } },
      { dur: 0.6, hop: h(300), move: { dx: 260, speed: 1.3 } },
      { dur: 0.25 },
      { dur: 0.4, pose: { sit: 1, faceCam: 0.6 } },
      { dur: 0.6, pose: { sit: 1, faceCam: 0.6 } },
    ],
    headbutt: [
      { move: { to: 'front', speed: 0.5 }, untilArrive: true, dur: 1.4, pose: { closeUp: 1, tailLift: 1, headFront: 1, faceCam: 0.8 } },
      { dur: 0.3, pose: { closeUp: 1, tailLift: 1, headFront: 1, faceCam: 0.8, headPush: 1, eyes: 1 }, hearts: true },
      { dur: 0.35, pose: { closeUp: 1, tailLift: 1, headFront: 1, faceCam: 0.8, eyes: 1 } },
      { dur: 0.3, pose: { closeUp: 1, tailLift: 1, headFront: 1, faceCam: 0.8, headPush: 1, eyes: 1 }, sound: 'purr', hearts: true },
      { dur: 0.4, pose: { closeUp: 1, tailLift: 1, headFront: 1, faceCam: 0.8 } },
      { dur: 0.6 },
    ],
    knead: [
      { dur: 0.5, pose: { sit: 1, bow: 1, squint: 0.7, headFront: 0.6, faceCam: 0.4 } },
      { dur: 2.3, pose: { sit: 1, bow: 1, squint: 0.7, headFront: 0.6, faceCam: 0.4, knead: 1 }, sound: 'purr' },
      { dur: 0.5 },
    ],
    tailHello: [
      { dur: 0.4, pose: { tailLift: 1, headFront: 0.6, faceCam: 0.5 }, sound: 'trill' },
      { dur: 1.2, pose: { tailLift: 1, headFront: 0.6, faceCam: 0.5 } },
      { dur: 0.4 },
    ],
  };
}

const catalog: Built[] = [
  { id: 'zoomies', species: 'dog', tags: { bold: 1, nrg: 1 }, steps: (hop, tumble) => dogSteps(hop, tumble).zoomies },
  { id: 'bounce', species: 'dog', tags: { bold: 0.5, nrg: 1 }, steps: (hop, tumble) => dogSteps(hop, tumble).bounce },
  { id: 'bow', species: 'dog', tags: { bold: 0.5, nrg: 0.5 }, steps: (hop, tumble) => dogSteps(hop, tumble).bow },
  { id: 'runup', species: 'dog', tags: { aff: 1, nrg: 0.3 }, steps: (hop, tumble) => dogSteps(hop, tumble).runup },
  { id: 'fetch', species: 'dog', tags: { aff: 0.5, nrg: 0.6 }, steps: (hop, tumble) => dogSteps(hop, tumble).fetch },
  { id: 'wiggle', species: 'dog', tags: { aff: 0.6, nrg: 0.4 }, steps: (hop, tumble) => dogSteps(hop, tumble).wiggle },
  { id: 'rollover', species: 'dog', tags: { aff: 1, nrg: -0.3 }, steps: (hop, tumble) => dogSteps(hop, tumble).rollover },
  { id: 'howl', species: 'dog', tags: { bold: 1, nrg: -0.2 }, steps: (hop, tumble) => dogSteps(hop, tumble).howl },
  { id: 'wag', species: 'dog', tags: {}, short: true, steps: (hop, tumble) => dogSteps(hop, tumble).wag },
  { id: 'trill', species: 'cat', tags: { aff: 0.6 }, start: 'edge', steps: (hop) => catSteps(hop).trill },
  { id: 'rub', species: 'cat', tags: { aff: 1 }, steps: (hop) => catSteps(hop).rub },
  { id: 'stretch', species: 'cat', tags: { nrg: -1 }, start: 'bed', steps: (hop) => catSteps(hop).stretch },
  { id: 'blink', species: 'cat', tags: { aff: 0.8, nrg: -0.6 }, steps: (hop) => catSteps(hop).blink },
  { id: 'flop', species: 'cat', tags: { aff: 0.6, nrg: -0.4 }, steps: (hop) => catSteps(hop).flop },
  { id: 'pounce', species: 'cat', tags: { bold: 1, nrg: 1 }, steps: (hop) => catSteps(hop).pounce },
  { id: 'headbutt', species: 'cat', tags: { aff: 1, bold: 0.3 }, steps: (hop) => catSteps(hop).headbutt },
  { id: 'knead', species: 'cat', tags: { aff: 1, nrg: -0.5 }, steps: (hop) => catSteps(hop).knead },
  { id: 'tailHello', species: 'cat', tags: {}, short: true, steps: (hop) => catSteps(hop).tailHello },
];

const settle: GreetStep = { move: { to: 'center', speed: 0.6 }, untilArrive: true, dur: 2.4 };

export function greetingIds(species: 'dog' | 'cat'): string[] {
  return catalog.filter((item) => item.species === species).map((item) => item.id);
}

export type GreetContext = {
  species: 'dog' | 'cat';
  elapsedH: number;
  energy: number;
  affection: number;
  boldness: number;
  affectionPotential: number;
  boldnessPotential: number;
  ageDays: number;
  vitality: number;
  asleep: boolean;
  reduced: boolean;
  lastId: string | null;
  rng: () => number;
};

export type GreetPlan = {
  ids: string[];
  steps: GreetStep[];
  storeId: string | null;
  start: 'edge' | 'bed' | null;
  label: string;
};

function axis(value: number, potential: number): number {
  const mid = Math.max(1, potential) / 2;
  const span = Math.max(1, mid);
  return Math.max(-1, Math.min(1, (value - mid) / span));
}

function weightOf(item: Built, affection: number, boldness: number, energyAxis: number, stretchBoost: boolean): number {
  const tags = item.tags;
  const score = (tags.aff ?? 0) * affection + (tags.bold ?? 0) * boldness + (tags.nrg ?? 0) * energyAxis;
  const base = Math.max(0.05, 1 + 1.2 * score);
  return stretchBoost && item.id === 'stretch' ? base * 3 : base;
}

function pickOne(pool: Built[], weights: number[], rng: () => number): Built | null {
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (pool.length === 0 || total <= 0) {
    return null;
  }
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) {
      return pool[i];
    }
  }
  return pool[pool.length - 1];
}

function build(item: Built, mods: MotionMods, rng: () => number): GreetStep[] {
  const tumble = item.id === 'zoomies' && rng() < mods.tumble;
  return item.steps(mods.hop, tumble);
}

export function planGreeting(ctx: GreetContext): GreetPlan | null {
  if (ctx.elapsedH * 60 < GREET.MIN_AWAY_MIN) {
    return null;
  }
  const mods = motionMods(ctx.ageDays, ctx.vitality, ctx.energy);
  const speciesPool = catalog.filter((item) => item.species === ctx.species);
  const short = speciesPool.find((item) => item.short);
  if (!short) {
    return null;
  }
  const prefix = ctx.asleep && ctx.species === 'dog' ? wakeDog : [];
  if (ctx.reduced || ctx.elapsedH < GREET.SHORT_MAX_H) {
    return {
      ids: [short.id],
      steps: [...prefix, ...build(short, mods, ctx.rng), settle],
      storeId: null,
      start: null,
      label: short.id,
    };
  }
  const affection = axis(ctx.affection, ctx.affectionPotential);
  const boldness = axis(ctx.boldness, ctx.boldnessPotential);
  const energyAxis = Math.max(-1, Math.min(1, (ctx.energy - GREET.MID) / GREET.MID));
  const boost = ctx.asleep && ctx.species === 'cat';
  const main = speciesPool.filter((item) => !item.short && item.id !== ctx.lastId);
  const weights = main.map((item) => weightOf(item, affection, boldness, energyAxis, boost));
  const first = pickOne(main, weights, ctx.rng);
  if (!first) {
    return null;
  }
  if (ctx.elapsedH < GREET.MEDIUM_MAX_H) {
    return {
      ids: [first.id],
      steps: [...prefix, ...build(first, mods, ctx.rng), settle],
      storeId: null,
      start: first.start ?? null,
      label: first.id,
    };
  }
  const rest = main.filter((item) => item.id !== first.id && !item.start);
  const second = pickOne(
    rest,
    rest.map((item) => weightOf(item, affection, boldness, energyAxis, boost)),
    ctx.rng,
  );
  const ids = second ? [first.id, second.id] : [first.id];
  const steps = [
    ...prefix,
    ...build(first, mods, ctx.rng),
    ...(second ? build(second, mods, ctx.rng) : []),
    settle,
  ];
  return {
    ids,
    steps,
    storeId: second ? second.id : null,
    start: first.start ?? null,
    label: ids.join('+'),
  };
}

export function scriptFor(id: string, ageDays: number, vitality: number, energy: number, rng: () => number): GreetPlan | null {
  const item = catalog.find((entry) => entry.id === id);
  if (!item) {
    return null;
  }
  const mods = motionMods(ageDays, vitality, energy);
  return {
    ids: [item.id],
    steps: [...build(item, mods, rng), settle],
    storeId: null,
    start: item.start ?? null,
    label: item.id,
  };
}
