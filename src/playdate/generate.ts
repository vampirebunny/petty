import { sceneById } from '../actor/scenes';
import type { Trait } from '../sim/types';
import { activityById, speciesPair } from './activities';
import { closingActions, closingHoldMs, maxDurationMs, minDurationMs, playdateConfig, warmupActions } from './config';
import { rngFrom } from './rng';
import { stories } from './stories';
import { pickVariant, s, tagAct } from './story';
import type { Place, Step, StepProp, StoryContext, Who } from './story';
import { assignSfx } from './sfx';
import { insertTwists } from './twists';
import type {
  ActivityDefinition,
  Beat,
  BeatParams,
  BeatProp,
  BeatTempo,
  PetSnapshot,
  PlaydateOutcome,
  Species,
} from './types';

export type { Step, StoryContext } from './story';

const tempoScale: Record<BeatTempo, number> = {
  snap: 0.45,
  normal: 1,
  linger: 1.8,
};

export type SlotStep = {
  parallel?: boolean;
  weight?: number;
  tempo?: BeatTempo;
  holdBefore?: number;
  delay?: number;
};

// One start time per step. Parallel steps share the slot unless they set delay.
export function slotTimes(steps: readonly SlotStep[], lastT: number, tempoRng: () => number): number[] {
  type Group = { indexes: number[]; weight: number; hold: number };
  const groups: Group[] = [];
  steps.forEach((step, index) => {
    if (step.parallel === true && groups.length > 0) {
      groups[groups.length - 1].indexes.push(index);
      return;
    }
    const tempo = tempoScale[step.tempo ?? 'normal'];
    const jitter = (tempoRng() * 2 - 1) * 0.18;
    groups.push({
      indexes: [index],
      weight: Math.max(0, (step.weight ?? 1) * tempo * (1 + jitter)),
      hold: Math.max(0, step.holdBefore ?? 0),
    });
  });

  let holds = groups.map((group) => group.hold);
  let totalHold = holds.reduce((sum, hold) => sum + hold, 0);
  const holdCap = lastT * 0.35;
  if (totalHold > holdCap && totalHold > 0) {
    const holdScale = holdCap / totalHold;
    holds = holds.map((hold) => hold * holdScale);
    totalHold = holdCap;
  }
  const weightSum = groups.reduce((sum, group) => sum + group.weight, 0);
  const available = Math.max(0, lastT - totalHold);
  const unit = weightSum > 0 ? available / weightSum : 0;

  const starts: number[] = [];
  let cursor = 0;
  for (let i = 0; i < groups.length; i += 1) {
    cursor += holds[i] ?? 0;
    starts.push(cursor);
    cursor += groups[i].weight * unit;
  }

  const times = steps.map(() => 0);
  for (let i = 0; i < groups.length; i += 1) {
    const start = Math.min(lastT, Math.max(0, Math.round(starts[i] ?? 0)));
    const nextStart = i + 1 < groups.length ? Math.round(starts[i + 1] ?? lastT) : lastT + 1;
    const group = groups[i];
    for (const index of group.indexes) {
      const step = steps[index];
      let t = start;
      const delay = step?.delay ?? 0;
      if (step?.parallel && delay > 0) {
        const latest = Math.max(start, nextStart - 1);
        t = Math.min(start + delay, latest);
      }
      times[index] = Math.min(lastT, Math.max(0, t));
    }
  }
  return times;
}

function specified(step: Step): Partial<Beat> {
  const beat: Partial<Beat> = {};
  if (step.emote != null) {
    beat.emote = step.emote;
  }
  if (step.fx != null) {
    beat.fx = step.fx;
  }
  if (step.sfx != null) {
    beat.sfx = step.sfx;
  }
  if (step.camera != null) {
    beat.camera = step.camera;
  }
  if (step.tag != null) {
    beat.tag = step.tag;
  }
  if (step.gesture != null) {
    beat.gesture = step.gesture;
  }
  if (step.tempo != null) {
    beat.tempo = step.tempo;
  }
  if (step.holdBefore != null) {
    beat.holdBefore = step.holdBefore;
  }
  if (step.delay != null) {
    beat.delay = step.delay;
  }
  return beat;
}

function assertTimeline(beats: readonly Beat[], lastT: number): void {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return;
  }
  for (let i = 0; i < beats.length; i += 1) {
    const beat = beats[i];
    if (beat.t > lastT) {
      throw new Error(`playdate beat ${i} is past the end`);
    }
    if (i > 0 && beat.t < beats[i - 1].t) {
      throw new Error(`playdate beats are not sorted at ${i}`);
    }
  }
}

function score(pet: PetSnapshot, trait: Trait): number {
  return pet.attributes[trait];
}

function byTrait(petA: PetSnapshot, petB: PetSnapshot, trait: Trait, higher: boolean): 'A' | 'B' {
  const a = score(petA, trait);
  const b = score(petB, trait);
  if (a === b) {
    return higher ? 'A' : 'B';
  }
  if (higher) {
    return a > b ? 'A' : 'B';
  }
  return a < b ? 'A' : 'B';
}

function speciesActor(petA: PetSnapshot, petB: PetSnapshot, species: Species): 'A' | 'B' {
  if (petA.species === species) {
    return 'A';
  }
  if (petB.species === species) {
    return 'B';
  }
  return 'A';
}

export function favoriteChance(gap: number): number {
  return 0.5 + 0.38 * Math.tanh(Math.abs(gap) / 25);
}

type Contest = { winner: 'A' | 'B'; upset: boolean };

function decideContest(petA: PetSnapshot, petB: PetSnapshot, activity: ActivityDefinition, rng: () => number): Contest {
  const trait = activity.id === 'race' ? 'agility' : 'stamina';
  const a = score(petA, trait);
  const b = score(petB, trait);
  const higher: 'A' | 'B' | null = a === b ? null : a > b ? 'A' : 'B';
  const favoriteWins = rng() < favoriteChance(a - b);
  const winner: 'A' | 'B' = higher == null ? (favoriteWins ? 'A' : 'B') : favoriteWins ? higher : higher === 'A' ? 'B' : 'A';
  return { winner, upset: higher != null && winner !== higher };
}

function resolveWho(step: Step, petA: PetSnapshot, petB: PetSnapshot, contest: Contest): 'A' | 'B' | 'both' {
  if (step.who === 'both' || step.who === 'A' || step.who === 'B') {
    return step.who;
  }
  if (step.who === 'dog' || step.who === 'cat') {
    return speciesActor(petA, petB, step.who);
  }
  if (step.who === 'bolder') {
    return byTrait(petA, petB, 'boldness', true);
  }
  if (step.who === 'shyer') {
    return byTrait(petA, petB, 'boldness', false);
  }
  if (step.who === 'winner') {
    return contest.winner;
  }
  return contest.winner === 'A' ? 'B' : 'A';
}

function warmupCount(petA: PetSnapshot, petB: PetSnapshot): number {
  const shy = Math.min(score(petA, 'boldness'), score(petB, 'boldness'));
  if (shy >= playdateConfig.shyBoldness) {
    return 0;
  }
  if (shy < 15) {
    return 3;
  }
  if (shy < 28) {
    return 2;
  }
  return 1;
}

type Floor = { xMin: number; xMax: number; yMin: number; yMax: number };

function point(rng: () => number, floor: Floor): { x: number; y: number } {
  const xSpan = Math.max(1, floor.xMax - floor.xMin - 80);
  const ySpan = Math.max(1, floor.yMax - floor.yMin - 40);
  return {
    x: Math.round(floor.xMin + 40 + rng() * xSpan),
    y: Math.round(floor.yMin + 20 + rng() * ySpan),
  };
}

function placeAt(place: Place, rng: () => number, floor: Floor, flip: boolean): { x: number; y: number } {
  const random = point(rng, floor);
  const width = floor.xMax - floor.xMin;
  const height = floor.yMax - floor.yMin;
  const mid = Math.round(floor.yMin + height / 2);
  if (place === 'center') {
    return { x: Math.round(floor.xMin + width / 2), y: mid };
  }
  if (place === 'left' || place === 'right') {
    const left = place === 'left' !== flip;
    return { x: Math.round(floor.xMin + width * (left ? 0.2 : 0.8)), y: mid };
  }
  if (place === 'far') {
    return { x: random.x, y: Math.round(floor.yMin + height * 0.15) };
  }
  if (place === 'near') {
    return { x: random.x, y: Math.round(floor.yMax - height * 0.1) };
  }
  return random;
}

const placeNames = new Set<Place>(['random', 'center', 'left', 'right', 'far', 'near']);

function isPlace(value: Place | 'throwTo' | { x: number; y: number }): value is Place {
  return typeof value === 'string' && placeNames.has(value as Place);
}

function paramsFor(step: Step, rng: () => number, floor: Floor, flip: boolean, thrown: { x: number; y: number } | null): BeatParams {
  if (step.placeFrom === 'throwTo' && thrown) {
    const params: BeatParams = { ...thrown };
    if (step.pace != null) {
      params.pace = step.pace;
    }
    if (step.spread) {
      params.spread = step.spread;
    }
    return params;
  }
  if (step.toward) {
    const params: BeatParams = { toward: step.toward };
    if (step.gap != null) {
      params.gap = step.gap;
    }
    if (step.pace != null) {
      params.pace = step.pace;
    }
    if (step.lane != null) {
      params.lane = step.lane;
    }
    return params;
  }
  const params: BeatParams = placeAt(step.place ?? 'random', rng, floor, flip);
  if (step.pace != null) {
    params.pace = step.pace;
  }
  if (step.spread) {
    params.spread = step.spread;
  }
  return params;
}

function resolveHolder(holder: Who, petA: PetSnapshot, petB: PetSnapshot, contest: Contest): 'A' | 'B' | 'both' {
  if (holder === 'A' || holder === 'B' || holder === 'both') {
    return holder;
  }
  return resolveWho({ who: holder, action: 'sit' }, petA, petB, contest);
}

function resolvePoint(value: Place | { x: number; y: number }, rng: () => number, floor: Floor, flip: boolean): { x: number; y: number } {
  return isPlace(value) ? placeAt(value, rng, floor, flip) : value;
}

function resolveProp(
  prop: StepProp,
  rng: () => number,
  floor: Floor,
  flip: boolean,
  thrown: { x: number; y: number } | null,
  petA: PetSnapshot,
  petB: PetSnapshot,
  contest: Contest,
): { prop: BeatProp; thrown: { x: number; y: number } | null } {
  const beatProp: BeatProp = { kind: prop.kind };
  if (prop.holder === null) {
    beatProp.holder = null;
  } else if (prop.holder != null) {
    beatProp.holder = resolveHolder(prop.holder, petA, petB, contest);
  }
  let next = thrown;
  if (prop.throwTo) {
    beatProp.throwTo = resolvePoint(prop.throwTo, rng, floor, flip);
    next = beatProp.throwTo;
  }
  if (prop.at === 'throwTo' && next) {
    beatProp.at = { ...next };
  } else if (prop.at != null && prop.at !== 'throwTo') {
    beatProp.at = resolvePoint(prop.at, rng, floor, flip);
  }
  return { prop: beatProp, thrown: next };
}

const fullBodyGestures = new Set(['double_take', 'startle', 'look_at_camera', 'butt_wiggle']);

function otherActor(actor: 'A' | 'B'): 'A' | 'B' {
  return actor === 'A' ? 'B' : 'A';
}

function reactionDelay(rng: () => number): number {
  return 150 + Math.floor(rng() * 251);
}

function watcherBusy(beats: readonly Beat[], actor: 'A' | 'B', start: number, end: number): boolean {
  return beats.some((beat) => beat.t >= start && beat.t <= end && (beat.actor === actor || beat.actor === 'both'));
}

function actionAt(beats: readonly Beat[], actor: 'A' | 'B', t: number): string {
  let action = 'sit';
  let at = -1;
  for (const beat of beats) {
    if (beat.t < t && beat.t >= at && (beat.actor === actor || beat.actor === 'both')) {
      at = beat.t;
      action = beat.action;
    }
  }
  return action;
}

function pushReaction(
  beats: Beat[],
  watcher: 'A' | 'B',
  pet: PetSnapshot,
  t: number,
  spec: { action?: string; gesture?: string; emote?: string },
): void {
  let action = spec.action;
  let gesture = spec.gesture;
  const shy = score(pet, 'boldness') < playdateConfig.shyBoldness;
  const fullBody = (gesture != null && fullBodyGestures.has(gesture)) || action === 'celebrate' || action === 'play_bow';
  if (shy && fullBody) {
    gesture = 'glance';
    action = undefined;
  }
  const beat: Beat = {
    t,
    actor: watcher,
    action: action ?? actionAt(beats, watcher, t),
    tag: 'reaction',
  };
  if (gesture) {
    beat.gesture = gesture;
  }
  if (spec.emote) {
    beat.emote = spec.emote;
  }
  beats.push(beat);
}

function chaseAnchor(beats: readonly Beat[], watcher: 'A' | 'B', fleeT: number): number {
  let earlier: number | null = null;
  for (const beat of beats) {
    if (beat.actor !== watcher && beat.actor !== 'both') {
      continue;
    }
    if (beat.params?.toward === 'partner' && beat.t < fleeT && (earlier == null || beat.t > earlier)) {
      earlier = beat.t;
    }
  }
  return earlier ?? fleeT;
}

function notableOf(beat: Beat): 'win' | 'startle' | 'trick' | 'slip' | 'away' | null {
  if (beat.action === 'win') {
    return 'win';
  }
  if (beat.action === 'pounce' || beat.gesture === 'startle') {
    return 'startle';
  }
  if (beat.action === 'trick') {
    return 'trick';
  }
  if (beat.action === 'skid' || beat.action === 'flop') {
    return 'slip';
  }
  if (beat.params?.toward === 'away') {
    return 'away';
  }
  return null;
}

// Reactions and fidgets for the pet who is not the one doing the notable move.
// Call only after the scene rng has already placed every original beat.
export function addReactions(beats: Beat[], petA: PetSnapshot, petB: PetSnapshot, rng: () => number): Beat[] {
  const lastT = beats.reduce((end, beat) => Math.max(end, beat.t), 0);
  const petFor = (actor: 'A' | 'B') => (actor === 'A' ? petA : petB);
  const notables = beats.filter((beat) => beat.tag !== 'reaction' && beat.tag !== 'fidget' && beat.actor !== 'both');
  for (const beat of notables) {
    if (beat.actor !== 'A' && beat.actor !== 'B') {
      continue;
    }
    const kind = notableOf(beat);
    if (!kind) {
      continue;
    }
    const watcher = otherActor(beat.actor);
    const pet = petFor(watcher);
    const lead = kind === 'away' ? chaseAnchor(beats, watcher, beat.t) : beat.t;
    const windowStart = kind === 'away' ? lead - 400 : beat.t + 150;
    const windowEnd = kind === 'away' ? lead - 150 : beat.t + 400;
    if (watcherBusy(beats, watcher, windowStart, windowEnd)) {
      continue;
    }
    const delay = reactionDelay(rng);
    const t = kind === 'away' ? lead - delay : beat.t + delay;
    if (t < 0 || t >= lastT) {
      continue;
    }
    if (kind === 'win') {
      if (score(pet, 'affection') < 50) {
        pushReaction(beats, watcher, pet, t, { gesture: 'double_take' });
      } else {
        pushReaction(beats, watcher, pet, t, { action: 'pant', emote: 'sweat' });
      }
    } else if (kind === 'startle') {
      pushReaction(beats, watcher, pet, t, { gesture: 'startle', emote: 'exclaim' });
    } else if (kind === 'trick') {
      const emote = score(pet, 'affection') >= 50 ? 'heart' : score(pet, 'intelligence') < 35 ? 'question' : undefined;
      pushReaction(beats, watcher, pet, t, { action: 'sit', emote });
      const celebrateT = t + 500;
      if (celebrateT < lastT && !watcherBusy(beats, watcher, celebrateT - 150, celebrateT + 150)) {
        pushReaction(beats, watcher, pet, celebrateT, { action: 'celebrate' });
      }
    } else if (kind === 'slip') {
      if (rng() < 0.2) {
        pushReaction(beats, watcher, pet, t, { gesture: 'look_at_camera' });
      } else {
        pushReaction(beats, watcher, pet, t, { gesture: 'head_tilt', emote: 'question' });
      }
    } else if (pet.species === 'cat') {
      pushReaction(beats, watcher, pet, t, { gesture: 'butt_wiggle' });
    } else {
      pushReaction(beats, watcher, pet, t, { action: 'play_bow' });
    }
  }

  const fidgets: Beat[] = [];
  for (const actor of ['A', 'B'] as const) {
    const times = beats.filter((beat) => beat.actor === actor || beat.actor === 'both').map((beat) => beat.t);
    const marks = [...new Set([0, ...times, lastT])].sort((a, b) => a - b);
    for (let i = 0; i < marks.length - 1; i += 1) {
      const left = marks[i];
      const right = marks[i + 1];
      if (right - left <= 2500 || rng() >= 0.25) {
        continue;
      }
      const t = Math.round((left + right) / 2);
      if (t < left + 150 || t > right - 150 || t >= lastT) {
        continue;
      }
      const roll = rng();
      const gesture = roll < 1 / 3 ? 'scratch' : roll < 2 / 3 ? 'glance' : 'tail_up';
      fidgets.push({
        t,
        actor,
        action: actionAt(beats, actor, t),
        gesture,
        tag: 'fidget',
      });
    }
  }
  beats.push(...fidgets);
  beats.sort((a, b) => a.t - b.t);
  return beats;
}

function finaleTrickTime(beats: readonly Beat[], lastT: number): number {
  const startIndex = beats.findIndex((beat) => beat.tag?.startsWith('variant:finale:'));
  const start = startIndex >= 0 ? beats[startIndex].t : 0;
  let end = start;
  for (let i = Math.max(0, startIndex); i < beats.length; i += 1) {
    const beat = beats[i];
    if (beat.t >= lastT || beat.tag === 'upset') {
      break;
    }
    if (i > startIndex && beat.action === 'nuzzle') {
      break;
    }
    end = beat.t;
  }
  return Math.min(Math.max(Math.round((start + end) / 2), 0), Math.max(0, lastT - 1));
}

export type GeneratedPlaydate = {
  beats: Beat[];
  outcome: PlaydateOutcome;
};

export function generatePlaydate(input: {
  petA: PetSnapshot;
  petB: PetSnapshot;
  activity: ActivityDefinition;
  sceneId: string;
  seed: number;
  recentTags?: readonly string[];
  latestTags?: readonly string[];
  bond?: number;
}): GeneratedPlaydate {
  const { petA, petB, activity, sceneId, seed } = input;
  const recentTags = input.recentTags ?? [];
  const latestTags = input.latestTags ?? [];
  const bond = input.bond ?? 0;
  const rng = rngFrom(seed, activity.id, sceneId, petA.snapshotId, petB.snapshotId);
  const tempoRng = rngFrom(seed, 'tempo');
  const storyRng = rngFrom(seed, 'story');
  const floor = sceneById(sceneId).floor;
  const flip = rng() < 0.5;
  const pair = speciesPair(petA.species, petB.species);
  const templateId = activity.templates[pair] ?? 'nap-any';
  const ctx: StoryContext = { petA, petB, activity, pair, recentTags, latestTags, bond };
  const story = stories[templateId];
  const intro = tagAct(pickVariant(story.intro, ctx, storyRng), 'intro');
  const main = insertTwists(tagAct(pickVariant(story.main, ctx, storyRng), 'main'), ctx, storyRng);
  const finale = tagAct(pickVariant(story.finale, ctx, storyRng), 'finale');
  const shyCount = warmupCount(petA, petB);
  const shy = byTrait(petA, petB, 'boldness', false);
  const warmup: Step[] = [];
  const warmupSteps: Record<(typeof warmupActions)[number], Omit<Step, 'who' | 'action'>> = {
    sniff: { toward: 'partner', gap: 2, pace: 0.3, weight: 0.8 },
    hide: { place: 'far', pace: 0.5, weight: 0.8 },
    approach: { toward: 'partner', gap: 1.6, pace: 0.35, weight: 0.8 },
  };
  for (let i = 0; i < shyCount; i += 1) {
    const action = warmupActions[Math.min(i, warmupActions.length - 1)];
    warmup.push(s(i === shyCount - 1 && shyCount > 1 ? 'bolder' : shy, action, warmupSteps[action]));
  }
  const steps = [...warmup, ...intro, ...main, ...finale];
  const affection = (score(petA, 'affection') + score(petB, 'affection')) / 2;
  if (affection >= 55) {
    steps.push(s('both', 'nuzzle', { toward: 'partner', gap: 1.05, weight: 0.8 }));
  }
  const winnerRng = rngFrom(seed, 'winner');
  const contest = decideContest(petA, petB, activity, winnerRng);
  const contested = steps.some((step) => step.who === 'winner' || step.who === 'loser');
  if (contested && contest.upset) {
    steps.push(s('winner', 'celebrate', { emote: 'sparkle', fx: 'confetti', weight: 0.6, tag: 'upset' }));
    steps.push(s('loser', 'sit', { gesture: 'double_take', emote: 'exclaim', parallel: true, tag: 'upset' }));
  }
  const hadZoomies = steps.some((step) => step.action === 'zoomies');
  const stamina = Math.min(1, Math.max(0, (score(petA, 'stamina') + score(petB, 'stamina')) / 200));
  const extra = Math.floor(rng() * Math.max(1, Math.round((maxDurationMs - minDurationMs) * (0.45 + 0.55 * stamina))));
  const durationMs = Math.min(maxDurationMs, minDurationMs + extra);
  const lastT = durationMs - closingHoldMs;
  const times = slotTimes(steps, lastT, tempoRng);
  const beats: Beat[] = [];
  let thrown: { x: number; y: number } | null = null;
  steps.forEach((step, index) => {
    let prop: BeatProp | undefined;
    if (step.prop) {
      const resolved = resolveProp(step.prop, rng, floor, flip, thrown, petA, petB, contest);
      prop = resolved.prop;
      thrown = resolved.thrown;
    }
    const params = paramsFor(step, rng, floor, flip, thrown);
    if (prop?.throwTo && prop.at == null && params.x != null && params.y != null) {
      prop.at = { x: params.x, y: params.y };
    }
    const beat: Beat = {
      t: times[index] ?? 0,
      actor: resolveWho(step, petA, petB, contest),
      action: step.action,
      params,
      ...specified(step),
    };
    if (prop) {
      beat.prop = prop;
    }
    if (contest.upset && step.action === 'win' && beat.camera == null) {
      beat.camera = 'punch';
    }
    beats.push(beat);
  });
  // One closing roll, then the closing place, then the trick rolls. The roll's meaning depends on the playdate.
  const roll = rng();
  const place = point(rng, floor);
  const goldenCurl = roll < 1 / 50;
  const goldenWatch = roll < 1 / 25;
  if (activity.id === 'nap') {
    beats.push({ t: lastT, actor: 'both', action: 'nap', params: place });
  } else if (goldenCurl) {
    beats.push({
      t: lastT,
      actor: 'both',
      action: 'nap',
      params: { ...place, toward: 'partner', gap: 1.05 },
      emote: 'heart',
      tag: 'golden',
    });
  } else if (goldenWatch) {
    beats.push({
      t: lastT,
      actor: 'both',
      action: 'celebrate',
      params: place,
      gesture: 'look_at_camera',
      tag: 'golden',
    });
  } else if (contested && contest.upset && affection >= 55) {
    beats.push({
      t: lastT,
      actor: contest.winner === 'A' ? 'B' : 'A',
      action: 'nuzzle',
      params: { ...place, toward: 'partner', gap: 1.05 },
    });
  } else if (hadZoomies) {
    beats.push({ t: lastT, actor: 'both', action: 'flop', params: place });
  } else {
    const span = 1 - 1 / 25;
    const index = Math.min(closingActions.length - 1, Math.floor(((roll - 1 / 25) / span) * closingActions.length));
    beats.push({ t: lastT, actor: 'both', action: closingActions[index] ?? 'celebrate', params: place });
  }
  const rareEvents: PlaydateOutcome['rareEvents'] = [];
  const chance = 0.05 + (score(petA, 'intelligence') / 100) * 0.22;
  if (petB.partyTricks.length > 0 && rng() < chance) {
    const trickId = petB.partyTricks[Math.min(petB.partyTricks.length - 1, Math.floor(rng() * petB.partyTricks.length))];
    rareEvents.push({ type: 'trick_shown', trickId });
    const shown = finaleTrickTime(beats, lastT);
    const action = trickId === 'speak' ? 'speak' : trickId;
    beats.push({ t: shown, actor: 'B', action, emote: 'sparkle', tag: 'trick_shown' });
    beats.push({ t: shown, actor: 'A', action: 'celebrate' });
    beats.sort((a, b) => a.t - b.t);
  }
  addReactions(beats, petA, petB, rng);
  assignSfx(beats, petA, petB, contested && contest.upset);
  assertTimeline(beats, lastT);

  return {
    beats,
    outcome: {
      moodDelta: playdateConfig.happinessGain,
      attributeXp: { ...activity.attributesTrained },
      bondDelta: playdateConfig.bondGain,
      rareEvents,
    },
  };
}

export function generateForActivity(input: {
  petA: PetSnapshot;
  petB: PetSnapshot;
  activityId: string;
  sceneId: string;
  seed: number;
  recentTags?: readonly string[];
  latestTags?: readonly string[];
  bond?: number;
}): GeneratedPlaydate | null {
  const activity = activityById(input.activityId);
  if (!activity) {
    return null;
  }
  return generatePlaydate({ ...input, activity });
}
