import type { Pose } from '../types';
import type { TrickPropType } from '../../sim/trickProps';

export type TrickOutcome = 'success' | 'early' | 'mid' | 'almost';

type MoveTo = 'front' | { x: number } | { prop: string; at: string } | { ball: true };

export type TrickStep = {
  label?: string;
  dur?: number;
  untilArrive?: boolean;
  pose?: Partial<Pose>;
  rate?: Partial<Record<keyof Pose, number>>;
  wag?: { amp: number; rate: number };
  sound?: 'woof' | 'yip' | 'whine' | 'meow' | 'trill' | 'howl';
  move?: {
    to?: MoveTo;
    dx?: number;
    dy?: number;
    speed: number;
    backward?: boolean;
    slide?: boolean;
    pass?: boolean;
  };
  jump?: {
    inPlace?: boolean;
    to?: MoveTo;
    landZ?: 'top' | 0;
    clear?: 'bar';
    heightPx?: 'hoop';
    height?: number;
    fast?: boolean;
    wiggle?: boolean;
    knock?: boolean;
  };
  spin?: { turns: number };
  carry?: 'pickup' | 'drop';
  clap?: boolean;
  sing?: { voice: 'woof' | 'meow'; notes: { st: number; d: number }[] };
  toss?: { target: 'mouth' | 'floor'; dx?: number; flight?: number };
};

type Fail = { take?: number; steps?: TrickStep[]; tail: 'tilt' | 'sniff' | 'groom' | 'none' };

export type TrickDef = {
  id: string;
  prop: TrickPropType | null;
  steps: TrickStep[];
  fail: { early: Fail; mid: Fail; almost: Fail };
};

const tails: Record<Fail['tail'], TrickStep[]> = {
  tilt: [
    { label: 'Confused head tilt', dur: 0.45, pose: { sit: 1, headRot: 0.35, earBack: 0.25, faceCam: 0.6 } },
    { dur: 0.5, pose: { sit: 1, headRot: -0.3, earBack: 0.15, faceCam: 0.6 } },
    { dur: 0.5, pose: { sit: 1, faceCam: 0.4 } },
  ],
  sniff: [
    { label: 'Gets distracted', dur: 1.0, pose: { headDown: 0.75 } },
    { dur: 0.45, pose: { headRot: 0.3, faceCam: 0.5 } },
    { dur: 0.4 },
  ],
  groom: [
    { label: 'Grooms instead', dur: 1.4, pose: { sit: 1, paw: 1, headDown: 0.35, squint: 0.7 } },
    { dur: 0.5, pose: { sit: 1, faceCam: 0.4 } },
  ],
  none: [{ dur: 0.6 }],
};

const wag = (amp: number, rate: number) => ({ amp, rate });

const dogNotes = [
  { st: 0, d: 0.32 },
  { st: 2, d: 0.32 },
  { st: 4, d: 0.32 },
  { st: 7, d: 0.45 },
  { st: 4, d: 0.32 },
  { st: 2, d: 0.32 },
  { st: 0, d: 0.42 },
  { st: 12, d: 1.0 },
];
const catNotes = [
  { st: 0, d: 0.42 },
  { st: 3, d: 0.38 },
  { st: 7, d: 0.5 },
  { st: 3, d: 0.38 },
  { st: 10, d: 0.55 },
  { st: 7, d: 0.4 },
  { st: 0, d: 0.9 },
];

function def(id: string, prop: TrickPropType | null, steps: TrickStep[], fail: TrickDef['fail']): TrickDef {
  return { id, prop, steps, fail };
}

const dogDown: TrickStep[] = [
  { label: 'Sits', dur: 0.45, pose: { sit: 1, faceCam: 0.4 } },
  { label: 'Lies down', dur: 0.6, pose: { lie: 1, faceCam: 0.4 } },
  { label: 'Holds it', dur: 1.4, pose: { lie: 1, faceCam: 0.5, headUp: 0.1 }, wag: wag(0.35, 8) },
  { label: 'Gets up', dur: 0.5 },
];
const dogSpin: TrickStep[] = [
  { label: 'Gets ready', dur: 0.35, pose: { faceCam: 0.3 }, wag: wag(0.5, 12) },
  { label: 'Spins all the way around', dur: 1.0, spin: { turns: 1 }, pose: { tailLift: 0.4 }, wag: wag(0.6, 14) },
  { label: 'Ta-da', dur: 1.0, pose: { faceCam: 0.5, pant: 0.6 }, wag: wag(0.7, 14), sound: 'yip' },
];
const dogHigh: TrickStep[] = [
  { label: 'Sits', dur: 0.45, pose: { sit: 1, faceCam: 0.4 } },
  { label: 'Paw up high', dur: 0.45, pose: { sit: 1, pawHigh: 1, headUp: 0.3, faceCam: 0.4 } },
  { label: 'Five!', dur: 0.3, pose: { sit: 1, pawHigh: 1, headUp: 0.3, faceCam: 0.4 }, sound: 'woof', clap: true },
  { label: 'Proud', dur: 1.1, pose: { sit: 1, faceCam: 0.6, pant: 0.6 }, wag: wag(0.7, 14) },
];
const dogBow: TrickStep[] = [
  { label: 'Stretches forward', dur: 0.5, pose: { bow: 1, headUp: 0.25, tailLift: 0.6, faceCam: 0.3 } },
  { label: 'Holds the bow', dur: 1.1, pose: { bow: 1, headUp: 0.25, tailLift: 0.8, faceCam: 0.3 }, wag: wag(0.8, 15) },
  { label: 'Pops up', dur: 0.6, pose: { faceCam: 0.4 }, sound: 'woof', wag: wag(0.6, 12) },
];
const dogRoll: TrickStep[] = [
  { label: 'Lies down', dur: 0.5, pose: { lie: 1 } },
  { label: 'Onto its side', dur: 0.45, pose: { lie: 1, side: 1, headRest: 1 } },
  { label: 'Belly up', dur: 0.55, pose: { lie: 1, side: 1, belly: 1, legPedal: 0.5, squint: 0.4 }, rate: { belly: 6 } },
  { label: 'All the way over', dur: 0.55, pose: { lie: 1, side: 1, headRest: 1 }, rate: { belly: 6 }, move: { dx: 44, speed: 0.4, slide: true } },
  { label: 'Stands up', dur: 0.5 },
  { label: 'Shakes off', dur: 0.55, pose: { shake: 1 }, wag: wag(0.6, 12) },
];
const dogCatch: TrickStep[] = [
  { label: 'Watches the toss', dur: 0.45, pose: { faceCam: 0.3, headUp: 0.3 }, wag: wag(0.6, 14), toss: { target: 'mouth' } },
  { label: 'Tracks the ball', dur: 0.2, pose: { headUp: 0.5 } },
  { label: 'Leaps', jump: { inPlace: true, height: 0.75 }, pose: { headUp: 0.45 } },
  { label: 'Got it!', dur: 1.1, pose: { faceCam: 0.5 }, wag: wag(0.8, 15) },
];
const dogStand: TrickStep[] = [
  { label: 'Sits', dur: 0.45, pose: { sit: 1, faceCam: 0.3 } },
  { label: 'Rises onto hind legs', dur: 0.65, pose: { stand: 1, headUp: 0.1 } },
  { label: 'Balances', dur: 1.4, pose: { stand: 1, faceCam: 0.5, pant: 0.5 }, wag: wag(0.5, 12) },
  { label: 'Drops down', dur: 0.5, rate: { stand: 6 } },
  { label: 'Wags', dur: 0.6, pose: { faceCam: 0.4 }, wag: wag(0.7, 14), sound: 'yip' },
];
const dogSing: TrickStep[] = [
  { label: 'Sits up tall', dur: 0.45, pose: { sit: 1, faceCam: 0.4 } },
  { label: 'Sings', sing: { voice: 'woof', notes: dogNotes }, pose: { sit: 1, headUp: 0.65, faceCam: 0.3, eyes: 0.5 }, wag: wag(0.4, 8) },
  { label: 'Takes a bow', dur: 0.8, pose: { sit: 1, faceCam: 0.6 }, wag: wag(0.7, 14) },
];
const dogJump: TrickStep[] = [
  { label: 'Walks to the podium', move: { to: { prop: 'podium', at: 'approach' }, speed: 0.8 }, untilArrive: true, dur: 4 },
  { label: 'Looks up', dur: 0.35, pose: { headUp: 0.35 } },
  { label: 'Hops up', jump: { to: { prop: 'podium', at: 'top' }, landZ: 'top' } },
  { label: 'Turns to you', dur: 0.35, pose: { faceCam: 0.6 } },
  { label: 'Waits like a star', dur: 1.6, pose: { sit: 1, faceCam: 0.7, headUp: 0.15 }, wag: wag(0.6, 12) },
  { label: 'Hops down', jump: { to: { prop: 'podium', at: 'off' }, landZ: 0 } },
  { dur: 0.5 },
];
const dogTunnel: TrickStep[] = [
  { label: 'Lines up', move: { to: { prop: 'tunnel', at: 'approach' }, speed: 0.8 }, untilArrive: true, dur: 4 },
  { label: 'Crouches', dur: 0.35, pose: { stalk: 1, headDown: 0.25, earBack: 0.3 } },
  { label: 'Dashes through', move: { to: { prop: 'tunnel', at: 'out' }, speed: 1.4 }, untilArrive: true, dur: 4, pose: { stalk: 1, headDown: 0.3, earBack: 0.45 } },
  { label: 'Pops out', dur: 0.25, sound: 'yip' },
  { label: 'Happy hop', jump: { inPlace: true, height: 0.35 } },
  { label: 'Wags', dur: 0.9, pose: { faceCam: 0.5, pant: 0.6 }, wag: wag(0.7, 14) },
];
const dogHurdle: TrickStep[] = [
  { label: 'Runs at the hurdle', move: { to: { prop: 'hurdle', at: 'approach' }, speed: 1.1 }, untilArrive: true, dur: 4 },
  { label: 'Sails over', jump: { to: { prop: 'hurdle', at: 'landing' }, clear: 'bar', fast: true } },
  { label: 'Trots on', move: { dx: 50, speed: 0.6 }, untilArrive: true, dur: 2 },
  { label: 'Proud', dur: 1.0, pose: { faceCam: 0.5, pant: 0.6 }, wag: wag(0.7, 14), sound: 'woof' },
];
const weave = (at: string, dy: number, speed: number): TrickStep => ({
  move: { to: { prop: 'cones', at }, dy, speed, pass: true },
  untilArrive: true,
  dur: 3,
});
const dogWeave: TrickStep[] = [
  { label: 'Lines up', move: { to: { prop: 'cones', at: 'approach' }, dy: -18, speed: 0.8 }, untilArrive: true, dur: 4 },
  { label: 'Weaves the cones', ...weave('c0', -18, 0.65) },
  weave('c1', 18, 0.65),
  weave('c2', -18, 0.65),
  weave('c3', 18, 0.65),
  { label: 'Out the end', move: { to: { prop: 'cones', at: 'out' }, dy: 0, speed: 0.6 }, untilArrive: true, dur: 3 },
  { label: 'Proud', dur: 1.0, pose: { faceCam: 0.5, pant: 0.6 }, wag: wag(0.7, 14), sound: 'woof' },
];
const dogHoop: TrickStep[] = [
  { label: 'Lines up', move: { to: { prop: 'hoop', at: 'approach' }, speed: 0.8 }, untilArrive: true, dur: 4 },
  { label: 'Eyes the hoop', dur: 0.4, pose: { headUp: 0.3, earBack: 0.2 }, wag: wag(0.6, 14) },
  { label: 'Leaps through', jump: { to: { prop: 'hoop', at: 'landing' }, heightPx: 'hoop' } },
  { label: 'Lands', dur: 0.35 },
  { label: 'Proud', dur: 1.0, pose: { faceCam: 0.5, pant: 0.6 }, wag: wag(0.7, 14), sound: 'woof' },
];
const dogDead: TrickStep[] = [
  { label: 'Bang!', dur: 0.35, pose: { faceCam: 0.5, earBack: 0.3 } },
  { label: 'Staggers', dur: 0.35, pose: { rearUp: 0.25, headUp: 0.3, eyes: 0.3 } },
  { label: 'Dramatic flop', dur: 0.55, pose: { lie: 1, side: 1, headRest: 1, eyes: 1, tailLift: -0.3 }, rate: { side: 7, lie: 7 }, sound: 'whine' },
  { label: 'Plays dead', dur: 1.6, pose: { lie: 1, side: 1, headRest: 1, eyes: 1, wagAmp: 0, tailLift: -0.3 } },
  { label: 'Sneaky tail wag', dur: 0.9, pose: { lie: 1, side: 1, headRest: 1, eyes: 1 }, wag: wag(0.5, 10) },
  { label: 'Peeks and pops up', dur: 0.7, pose: { faceCam: 0.5 }, wag: wag(0.7, 14) },
];

const catSpin: TrickStep[] = [
  { label: 'Gets ready', dur: 0.4, pose: { tailLift: 0.8, faceCam: 0.3 } },
  { label: 'Twirls', dur: 1.2, spin: { turns: 1 }, pose: { tailLift: 1 } },
  { label: 'Ta-da', dur: 1.0, pose: { sit: 1, faceCam: 0.6, tailLift: 0.5 }, sound: 'meow' },
];
const catHigh: TrickStep[] = [
  { label: 'Sits', dur: 0.45, pose: { sit: 1, faceCam: 0.4, tailLift: 0.3 } },
  { label: 'Paw up high', dur: 0.5, pose: { sit: 1, pawHigh: 1, headUp: 0.25, faceCam: 0.4 } },
  { label: 'Five!', dur: 0.3, pose: { sit: 1, pawHigh: 1, headUp: 0.25, faceCam: 0.4 }, sound: 'meow', clap: true },
  { label: 'Pleased', dur: 1.0, pose: { sit: 1, faceCam: 0.6, squint: 0.5, tailLift: 0.5 } },
];
const catLie: TrickStep[] = [
  { label: 'Sits', dur: 0.45, pose: { sit: 1, faceCam: 0.4 } },
  { label: 'Settles into a loaf', dur: 0.7, pose: { sit: 0.35, lie: 0.55, squint: 0.5, faceCam: 0.4 } },
  { label: 'Holds it', dur: 1.5, pose: { sit: 0.35, lie: 0.55, squint: 0.75, faceCam: 0.5 }, wag: wag(0.15, 3) },
  { label: 'Gets up', dur: 0.5, pose: { tailLift: 0.6 } },
];
const catRoll: TrickStep[] = [
  { label: 'Lies down', dur: 0.6, pose: { lie: 1 } },
  { label: 'Onto its side', dur: 0.55, pose: { lie: 1, side: 1, headRest: 1, squint: 0.4 } },
  { label: 'Belly up', dur: 0.7, pose: { lie: 1, side: 1, belly: 1, squint: 0.5 }, rate: { belly: 4 } },
  { label: 'All the way over', dur: 0.7, pose: { lie: 1, side: 1, headRest: 1 }, rate: { belly: 4 }, move: { dx: 40, speed: 0.3, slide: true } },
  { label: 'Sits up', dur: 0.7, pose: { sit: 1, faceCam: 0.5, tailLift: 0.4 } },
  { label: 'Quick groom', dur: 0.8, pose: { sit: 1, paw: 1, headDown: 0.35, squint: 0.7 } },
];
const catStand: TrickStep[] = [
  { label: 'Sits', dur: 0.45, pose: { sit: 1, faceCam: 0.3, tailLift: 0.3 } },
  { label: 'Rises onto hind legs', dur: 0.7, pose: { stand: 1, headUp: 0.15, tailLift: 0.2 } },
  { label: 'Balances', dur: 1.4, pose: { stand: 1, faceCam: 0.5, pupils: 0.6 } },
  { label: 'Drops down', dur: 0.5, rate: { stand: 6 } },
  { label: 'Sits', dur: 0.6, pose: { sit: 1, faceCam: 0.5, tailLift: 0.5 }, sound: 'meow' },
];
const catSing: TrickStep[] = [
  { label: 'Sits up', dur: 0.45, pose: { sit: 1, faceCam: 0.4, tailLift: 0.4 } },
  { label: 'Sings', sing: { voice: 'meow', notes: catNotes }, pose: { sit: 1, headUp: 0.45, faceCam: 0.4, squint: 0.5 }, wag: wag(0.3, 4) },
  { label: 'Pleased', dur: 0.9, pose: { sit: 1, faceCam: 0.6, eyes: 1 }, rate: { eyes: 2.5 } },
];
const catTunnel: TrickStep[] = [
  { label: 'Lines up', move: { to: { prop: 'tunnel', at: 'approach' }, speed: 0.7 }, untilArrive: true, dur: 4, pose: { tailLift: 0.6 } },
  { label: 'Crouches', dur: 0.4, pose: { stalk: 1, pupils: 1, wiggle: 0.6 } },
  { label: 'Zooms through', move: { to: { prop: 'tunnel', at: 'out' }, speed: 1.6 }, untilArrive: true, dur: 4, pose: { stalk: 1, earBack: 0.4 } },
  { label: 'Pops out', dur: 0.5, pose: { tailLift: 1 }, sound: 'trill' },
  { label: 'Sits', dur: 0.8, pose: { sit: 1, faceCam: 0.6, tailLift: 0.6 } },
];
const catJump: TrickStep[] = [
  { label: 'Walks to the podium', move: { to: { prop: 'podium', at: 'approach' }, speed: 0.6 }, untilArrive: true, dur: 4, pose: { tailLift: 0.6 } },
  { label: 'Sizes it up', dur: 0.5, pose: { sit: 1, headUp: 0.4, pupils: 0.6 } },
  { label: 'Leaps up', jump: { to: { prop: 'podium', at: 'top' }, landZ: 'top' } },
  { label: 'Turns to you', dur: 0.35, pose: { faceCam: 0.6, tailLift: 0.4 } },
  { label: 'Waits like a star', dur: 1.6, pose: { sit: 1, faceCam: 0.7, tailLift: 0.3 }, sound: 'trill' },
  { label: 'Hops down', jump: { to: { prop: 'podium', at: 'off' }, landZ: 0, wiggle: false } },
  { dur: 0.5 },
];
const catHoop: TrickStep[] = [
  { label: 'Lines up', move: { to: { prop: 'hoop', at: 'approach' }, speed: 0.6 }, untilArrive: true, dur: 4, pose: { tailLift: 0.6 } },
  { label: 'Eyes the hoop', dur: 0.5, pose: { headUp: 0.3, pupils: 0.8 } },
  { label: 'Leaps through', jump: { to: { prop: 'hoop', at: 'landing' }, heightPx: 'hoop' } },
  { label: 'Lands, tail up', dur: 0.4, pose: { tailLift: 1 } },
  { label: 'Circus star', dur: 1.0, pose: { sit: 1, faceCam: 0.6, tailLift: 0.6 }, sound: 'trill' },
];
const catHurdle: TrickStep[] = [
  { label: 'Trots at the hurdle', move: { to: { prop: 'hurdle', at: 'approach' }, speed: 0.9 }, untilArrive: true, dur: 4, pose: { tailLift: 0.6 } },
  { label: 'Bounds over', jump: { to: { prop: 'hurdle', at: 'landing' }, clear: 'bar', wiggle: false, fast: true } },
  { label: 'Lands, tail up', dur: 0.5, pose: { tailLift: 1 } },
  { label: 'Sits, pleased', dur: 1.0, pose: { sit: 1, faceCam: 0.6, tailLift: 0.5 }, sound: 'trill' },
];
const catWeaveStep = (at: string, dy: number): TrickStep => ({
  move: { to: { prop: 'cones', at }, dy, speed: 0.5, pass: true },
  untilArrive: true,
  dur: 3,
  pose: { tailLift: 0.8 },
});
const catWeave: TrickStep[] = [
  { label: 'Lines up', move: { to: { prop: 'cones', at: 'approach' }, dy: -18, speed: 0.6 }, untilArrive: true, dur: 4, pose: { tailLift: 0.6 } },
  { label: 'Weaves the cones', ...catWeaveStep('c0', -18) },
  catWeaveStep('c1', 18),
  catWeaveStep('c2', -18),
  catWeaveStep('c3', 18),
  { label: 'Out the end', move: { to: { prop: 'cones', at: 'out' }, dy: 0, speed: 0.5 }, untilArrive: true, dur: 3, pose: { tailLift: 1 } },
  { label: 'Sits, pleased', dur: 1.0, pose: { sit: 1, faceCam: 0.6, tailLift: 0.5 }, sound: 'meow' },
];
const catFetch: TrickStep[] = [
  { label: 'Watches the toss', dur: 0.75, pose: { pupils: 1, headUp: 0.2 }, toss: { target: 'floor', dx: 160, flight: 0.8 } },
  { label: 'Stalks', move: { to: { ball: true }, speed: 0.32 }, untilArrive: true, dur: 4, pose: { stalk: 1, pupils: 1, tailLift: -0.2 } },
  { label: 'Butt wiggle', dur: 0.5, pose: { stalk: 1, wiggle: 1, pupils: 1 } },
  { label: 'Pounces', jump: { to: { ball: true }, height: 0.5, wiggle: false } },
  { label: 'Picks it up', dur: 0.45, pose: { headDown: 0.8 }, carry: 'pickup' },
  { label: 'Brings it back', move: { to: 'front', speed: 0.6 }, untilArrive: true, dur: 4, pose: { closeUp: 1, tailLift: 1, faceCam: 0.3 } },
  { label: 'Drops it', dur: 0.45, pose: { closeUp: 1, headDown: 0.5 }, carry: 'drop' },
  { label: 'Sits, pleased', dur: 1.1, pose: { closeUp: 1, sit: 1, faceCam: 0.7 }, sound: 'trill' },
];

const rollBack = { label: 'Rolls back', dur: 0.55, pose: { lie: 1, side: 1, headRest: 1 } };

export const trickDefs: TrickDef[] = [
  def('dog_down', null, dogDown, {
    early: { take: 1, tail: 'tilt' },
    mid: { steps: [dogDown[0], dogDown[1], { label: 'Pops right back up', dur: 0.35 }], tail: 'tilt' },
    almost: { steps: [dogDown[0], dogDown[1], { label: 'Breaks the hold', dur: 0.5, pose: { lie: 1 }, wag: wag(0.8, 16) }, { dur: 0.4 }], tail: 'tilt' },
  }),
  def('dog_spin', null, dogSpin, {
    early: { take: 1, tail: 'tilt' },
    mid: { steps: [dogSpin[0], { label: 'Half a turn', dur: 0.6, spin: { turns: 0.5 } }], tail: 'tilt' },
    almost: { steps: [dogSpin[0], { label: 'Spins too far', dur: 1.4, spin: { turns: 1.5 } }], tail: 'tilt' },
  }),
  def('dog_high_five', null, dogHigh, {
    early: { take: 1, tail: 'tilt' },
    mid: { steps: [dogHigh[0], { label: 'Offers Paw instead', dur: 1.1, pose: { sit: 1, paw: 1, faceCam: 0.5 } }], tail: 'tilt' },
    almost: { steps: [dogHigh[0], { label: 'Paw only halfway up', dur: 0.9, pose: { sit: 1, pawHigh: 0.45, faceCam: 0.4 } }], tail: 'tilt' },
  }),
  def('dog_bow', null, dogBow, {
    early: { steps: [{ label: 'Lies down instead', dur: 1.0, pose: { lie: 1, faceCam: 0.4 } }], tail: 'tilt' },
    mid: { steps: [{ label: 'Half a bow', dur: 0.8, pose: { bow: 0.45, headUp: 0.2 } }], tail: 'tilt' },
    almost: { steps: [dogBow[0], { label: 'Bows, then flops', dur: 0.9, pose: { lie: 1 } }], tail: 'tilt' },
  }),
  def('dog_roll_over', null, dogRoll, {
    early: { take: 1, tail: 'tilt' },
    mid: { steps: [dogRoll[0], dogRoll[1], dogRoll[2], { label: 'Stays for belly rubs', dur: 1.4, pose: { lie: 1, side: 1, belly: 1, legPedal: 1 } }, rollBack, { dur: 0.5 }], tail: 'tilt' },
    almost: { steps: [dogRoll[0], dogRoll[1], dogRoll[2], rollBack, { dur: 0.5 }], tail: 'tilt' },
  }),
  def('dog_catch', null, dogCatch, {
    early: { steps: [{ label: 'Watches it fall', dur: 1.2, pose: { headUp: 0.3, faceCam: 0.3 }, toss: { target: 'floor', dx: 70 } }, { label: 'Sniffs the ball', dur: 0.9, pose: { headDown: 0.8 } }], tail: 'tilt' },
    mid: { steps: [{ label: 'Watches', dur: 1.05, pose: { headUp: 0.35 }, toss: { target: 'floor', dx: 40 } }, { label: 'Jumps too late', jump: { inPlace: true, height: 0.6 } }], tail: 'tilt' },
    almost: { steps: [dogCatch[0], dogCatch[1], dogCatch[2], { label: 'Drops it', dur: 0.4, carry: 'drop' }], tail: 'tilt' },
  }),
  def('dog_play_dead', null, dogDead, {
    early: { steps: [dogDead[0], { label: 'Sits instead', dur: 0.9, pose: { sit: 1, faceCam: 0.5 } }], tail: 'tilt' },
    mid: { steps: [dogDead[0], dogDead[1], dogDead[2], { label: "Can't stay still", dur: 0.6, pose: { lie: 1, side: 1 }, wag: wag(0.8, 16) }], tail: 'tilt' },
    almost: { steps: [dogDead[0], dogDead[1], dogDead[2], { label: 'Opens one eye', dur: 0.8, pose: { lie: 1, side: 1, eyes: 0.4 } }], tail: 'tilt' },
  }),
  def('dog_stand_tall', null, dogStand, {
    early: { steps: [dogStand[0], { label: 'Front paws barely lift', dur: 0.8, pose: { sit: 1, stand: 0.22 } }], tail: 'tilt' },
    mid: { steps: [dogStand[0], { label: 'Gets halfway up', dur: 0.6, pose: { stand: 0.65 } }, { label: 'Topples', dur: 0.4, rate: { stand: 9 } }], tail: 'tilt' },
    almost: { steps: [dogStand[0], dogStand[1], { label: 'Wobbles hard', dur: 0.8, pose: { stand: 1, shake: 0.6 } }, { label: 'Drops early', dur: 0.4, rate: { stand: 7 } }], tail: 'tilt' },
  }),
  def('dog_sing', null, dogSing, {
    early: { steps: [dogSing[0], { label: 'One woof', dur: 0.6, pose: { sit: 1, faceCam: 0.4 }, sound: 'woof' }], tail: 'tilt' },
    mid: { steps: [dogSing[0], { label: 'Off key', sing: { voice: 'woof', notes: [{ st: 0, d: 0.32 }, { st: 6, d: 0.32 }, { st: -3, d: 0.5 }] }, pose: { sit: 1, headUp: 0.5 } }], tail: 'tilt' },
    almost: { steps: [dogSing[0], { label: 'Voice cracks', sing: { voice: 'woof', notes: dogNotes.slice(0, 7).concat([{ st: 16, d: 0.25 }]) }, pose: { sit: 1, headUp: 0.65 } }, { dur: 0.5, pose: { sit: 1, shake: 0.5 } }], tail: 'none' },
  }),
  def('dog_jump_up', 'podium', dogJump, {
    early: { steps: [dogJump[0], { label: 'Sniffs the podium', dur: 1.0, pose: { headDown: 0.7 } }], tail: 'tilt' },
    mid: { steps: [dogJump[0], dogJump[1], { label: 'Front paws up only', dur: 0.9, pose: { rearUp: 0.7, headUp: 0.3 } }], tail: 'tilt' },
    almost: { steps: [dogJump[0], dogJump[1], dogJump[2], { label: 'Hops right back off', jump: { to: { prop: 'podium', at: 'off' }, landZ: 0 } }], tail: 'tilt' },
  }),
  def('dog_tunnel', 'tunnel', dogTunnel, {
    early: { steps: [dogTunnel[0], { label: 'Sniffs the opening', dur: 1.0, pose: { headDown: 0.7 } }], tail: 'tilt' },
    mid: { steps: [dogTunnel[0], dogTunnel[1], { label: 'Backs out', move: { to: { prop: 'tunnel', at: 'approach' }, speed: 0.6, backward: true }, untilArrive: true, dur: 4, pose: { stalk: 1 } }], tail: 'tilt' },
    almost: { steps: [dogTunnel[0], { label: 'Runs around', move: { to: { prop: 'tunnel', at: 'out' }, dy: 30, speed: 1.1 }, untilArrive: true, dur: 4 }], tail: 'tilt' },
  }),
  def('dog_hurdle', 'hurdle', dogHurdle, {
    early: { steps: [dogHurdle[0], { label: 'Stops dead', dur: 0.35, pose: { skid: 1 } }], tail: 'tilt' },
    mid: { steps: [dogHurdle[0], { label: 'Goes around', move: { to: { prop: 'hurdle', at: 'landing' }, dy: 34, speed: 0.9 }, untilArrive: true, dur: 4 }], tail: 'tilt' },
    almost: { steps: [dogHurdle[0], { label: 'Jumps too low', jump: { to: { prop: 'hurdle', at: 'landing' }, height: 0.3, fast: true, knock: true } }], tail: 'tilt' },
  }),
  def('dog_weave', 'cones', dogWeave, {
    early: { steps: [dogWeave[0], { label: 'Sniffs the first cone', dur: 1.0, pose: { headDown: 0.7 } }], tail: 'tilt' },
    mid: { steps: [dogWeave[0], dogWeave[1], dogWeave[2], { label: 'Cuts through', move: { to: { prop: 'cones', at: 'out' }, speed: 0.8 }, untilArrive: true, dur: 3 }], tail: 'tilt' },
    almost: { steps: [dogWeave[0], dogWeave[1], dogWeave[2], dogWeave[3], { label: 'Skips the last', move: { to: { prop: 'cones', at: 'out' }, speed: 0.7 }, untilArrive: true, dur: 3 }], tail: 'tilt' },
  }),
  def('dog_hoop', 'hoop', dogHoop, {
    early: { steps: [dogHoop[0], { label: 'Sniffs the stand', dur: 1.0, pose: { headDown: 0.7 } }], tail: 'tilt' },
    mid: { steps: [dogHoop[0], dogHoop[1], { label: 'Runs around', move: { to: { prop: 'hoop', at: 'landing' }, dy: 30, speed: 0.9 }, untilArrive: true, dur: 4 }], tail: 'tilt' },
    almost: { steps: [dogHoop[0], dogHoop[1], { label: 'Jumps under it', jump: { to: { prop: 'hoop', at: 'landing' }, height: 0.2 } }], tail: 'tilt' },
  }),
  def('cat_spin', null, catSpin, {
    early: { take: 1, tail: 'groom' },
    mid: { steps: [catSpin[0], { label: 'Half a turn', dur: 0.7, spin: { turns: 0.5 } }], tail: 'groom' },
    almost: { steps: [catSpin[0], { label: 'Spins too far', dur: 1.6, spin: { turns: 1.5 } }], tail: 'tilt' },
  }),
  def('cat_high_five', null, catHigh, {
    early: { take: 1, tail: 'groom' },
    mid: { steps: [catHigh[0], { label: 'Offers Paw instead', dur: 1.1, pose: { sit: 1, paw: 1 } }], tail: 'groom' },
    almost: { steps: [catHigh[0], { label: 'Halfway up', dur: 0.9, pose: { sit: 1, pawHigh: 0.45 } }], tail: 'tilt' },
  }),
  def('cat_lie_down', null, catLie, {
    early: { take: 1, tail: 'groom' },
    mid: { steps: [catLie[0], catLie[1], { label: 'Flops onto its side', dur: 1.2, pose: { lie: 1, side: 1, headRest: 1 } }], tail: 'groom' },
    almost: { steps: [catLie[0], catLie[1], { label: 'Gets up too soon', dur: 0.4, pose: { tailLift: 0.6 } }], tail: 'tilt' },
  }),
  def('cat_roll_over', null, catRoll, {
    early: { take: 1, tail: 'groom' },
    mid: { steps: [catRoll[0], catRoll[1], catRoll[2], { label: 'Stays belly up', dur: 1.2, pose: { lie: 1, side: 1, belly: 1 } }, rollBack], tail: 'groom' },
    almost: { steps: [catRoll[0], catRoll[1], catRoll[2], rollBack], tail: 'tilt' },
  }),
  def('cat_fetch', null, catFetch, {
    early: { steps: [catFetch[0], catFetch[1], catFetch[2], catFetch[3], { label: 'Bats it', dur: 0.7, pose: { paw: 1 } }], tail: 'groom' },
    mid: { steps: [catFetch[0], catFetch[1], catFetch[2], catFetch[3], catFetch[4], { label: 'Lies down with it', dur: 1.5, pose: { lie: 1, squint: 0.6 } }], tail: 'none' },
    almost: { steps: [...catFetch.slice(0, 6), { label: 'Keeps it', dur: 1.2, pose: { sit: 1, faceCam: 0.6 } }], tail: 'none' },
  }),
  def('cat_stand_tall', null, catStand, {
    early: { steps: [catStand[0], { label: 'Barely lifts', dur: 0.8, pose: { sit: 1, stand: 0.22 } }], tail: 'groom' },
    mid: { steps: [catStand[0], { label: 'Halfway', dur: 0.6, pose: { stand: 0.65 } }, { dur: 0.4, rate: { stand: 9 } }], tail: 'groom' },
    almost: { steps: [catStand[0], catStand[1], { label: 'Wobbles hard', dur: 0.8, pose: { stand: 1, shake: 0.6 } }], tail: 'tilt' },
  }),
  def('cat_sing', null, catSing, {
    early: { steps: [catSing[0], { label: 'One meow', dur: 0.6, pose: { sit: 1 }, sound: 'meow' }], tail: 'groom' },
    mid: { steps: [catSing[0], { label: 'Off key', sing: { voice: 'meow', notes: [{ st: 0, d: 0.4 }, { st: 6, d: 0.4 }, { st: -2, d: 0.6 }] }, pose: { sit: 1 } }], tail: 'groom' },
    almost: { steps: [catSing[0], { label: 'Squeaks', sing: { voice: 'meow', notes: catNotes.slice(0, 6).concat([{ st: 15, d: 0.3 }]) }, pose: { sit: 1 } }], tail: 'none' },
  }),
  def('cat_tunnel', 'tunnel', catTunnel, {
    early: { steps: [catTunnel[0], { label: 'Peers in', dur: 1.0, pose: { stalk: 0.6, pupils: 1 } }], tail: 'groom' },
    mid: { steps: [catTunnel[0], catTunnel[1], { label: 'Comes back out', move: { to: { prop: 'tunnel', at: 'approach' }, speed: 0.6, backward: true }, untilArrive: true, dur: 4 }], tail: 'groom' },
    almost: { steps: [catTunnel[0], catTunnel[1], { label: 'Hops over it', jump: { to: { prop: 'tunnel', at: 'out' }, height: 1.6 } }], tail: 'groom' },
  }),
  def('cat_jump_up', 'podium', catJump, {
    early: { steps: [catJump[0], { label: 'Sniffs the podium', dur: 1.0, pose: { headDown: 0.6 } }], tail: 'groom' },
    mid: { steps: [catJump[0], catJump[1], { label: 'Paws at the edge', dur: 1.0, pose: { rearUp: 0.7 } }], tail: 'groom' },
    almost: { steps: [catJump[0], catJump[1], catJump[2], { label: 'Hops off', jump: { to: { prop: 'podium', at: 'off' }, landZ: 0, wiggle: false } }], tail: 'groom' },
  }),
  def('cat_hurdle', 'hurdle', catHurdle, {
    early: { steps: [catHurdle[0], { label: 'Sits and stares', dur: 0.9, pose: { sit: 1, headUp: 0.3 } }], tail: 'groom' },
    mid: { steps: [catHurdle[0], { label: 'Walks around', move: { to: { prop: 'hurdle', at: 'landing' }, dy: 34, speed: 0.6 }, untilArrive: true, dur: 4 }], tail: 'groom' },
    almost: { steps: [catHurdle[0], { label: 'Jumps too low', jump: { to: { prop: 'hurdle', at: 'landing' }, height: 0.35, knock: true, fast: true } }], tail: 'groom' },
  }),
  def('cat_hoop', 'hoop', catHoop, {
    early: { steps: [catHoop[0], catHoop[1]], tail: 'groom' },
    mid: { steps: [catHoop[0], catHoop[1], { label: 'Walks around', move: { to: { prop: 'hoop', at: 'landing' }, dy: 30, speed: 0.5 }, untilArrive: true, dur: 4 }], tail: 'groom' },
    almost: { steps: [catHoop[0], catHoop[1], { label: 'Leaps under it', jump: { to: { prop: 'hoop', at: 'landing' }, height: 0.25 } }], tail: 'tilt' },
  }),
  def('cat_weave', 'cones', catWeave, {
    early: { steps: [catWeave[0], { label: 'Rubs the cone', dur: 1.2, pose: { squint: 0.7, tailLift: 1 } }], tail: 'groom' },
    mid: { steps: [catWeave[0], catWeave[1], catWeave[2], { label: 'Cuts through', move: { to: { prop: 'cones', at: 'out' }, speed: 0.6 }, untilArrive: true, dur: 3 }], tail: 'groom' },
    almost: { steps: [catWeave[0], catWeave[1], catWeave[2], catWeave[3], { label: 'Skips the last', move: { to: { prop: 'cones', at: 'out' }, speed: 0.5 }, untilArrive: true, dur: 3 }], tail: 'tilt' },
  }),
];

const byId = new Map(trickDefs.map((trick) => [trick.id, trick]));

export function trickDef(id: string): TrickDef | null {
  return byId.get(id) ?? null;
}

export function stepsFor(id: string, outcome: TrickOutcome): TrickStep[] {
  const trick = byId.get(id);
  if (!trick) {
    return [];
  }
  if (outcome === 'success') {
    return trick.steps;
  }
  const fail = trick.fail[outcome];
  const body = fail.steps ?? trick.steps.slice(0, fail.take ?? 0);
  return body.concat(tails[fail.tail]);
}
