import { sceneById } from '../actor/scenes';
import type { Trait } from '../sim/types';
import { activityById, speciesPair } from './activities';
import { closingActions, closingHoldMs, maxDurationMs, minDurationMs, playdateConfig, warmupActions } from './config';
import { rngFrom } from './rng';
import type {
  ActivityDefinition,
  Beat,
  BeatParams,
  BeatTemplateId,
  BeatToward,
  PetSnapshot,
  PlaydateOutcome,
  Species,
} from './types';

type Who = 'A' | 'B' | 'both' | 'bolder' | 'shyer' | 'winner' | 'loser' | 'dog' | 'cat';

// Named spots on the floor. 'left' and 'right' swap on a coin flip so a race does not always run the same way.
type Place = 'random' | 'center' | 'left' | 'right' | 'far' | 'near';

type Step = {
  who: Who;
  action: string;
  // Follow the partner instead of heading to a fixed spot.
  toward?: BeatToward;
  gap?: number;
  pace?: number;
  lane?: number;
  spread?: 'x' | 'y';
  place?: Place;
  // Share of the playdate this step takes. Default 1.
  weight?: number;
  // Starts with the step before it, so one pet can chase while the other runs.
  parallel?: boolean;
};

const s = (who: Who, action: string, extra: Omit<Step, 'who' | 'action'> = {}): Step => ({ who, action, ...extra });

const templates: Record<BeatTemplateId, Step[]> = {
  // One pet runs out to fetch and brings it back, then they swap.
  'fetch-dogs': [
    s('A', 'play_bow', { weight: 0.7 }),
    s('B', 'run_to', { place: 'far', pace: 0.9, weight: 1.3 }),
    s('A', 'sit', { parallel: true }),
    s('B', 'run_to', { toward: 'partner', gap: 1.15, pace: 0.8, weight: 1.2 }),
    s('A', 'celebrate', { parallel: true }),
    s('B', 'play_bow', { weight: 0.7 }),
    s('A', 'run_to', { place: 'far', pace: 0.9, weight: 1.3 }),
    s('B', 'sit', { parallel: true }),
    s('A', 'run_to', { toward: 'partner', gap: 1.15, pace: 0.8, weight: 1.2 }),
    s('B', 'celebrate', { parallel: true }),
  ],
  // The cat stalks while the dog fetches, then pounces as the dog returns.
  'fetch-cross': [
    s('cat', 'approach', { toward: 'partner', gap: 1.6, weight: 1 }),
    s('dog', 'run_to', { place: 'far', pace: 0.9, weight: 1.3 }),
    s('cat', 'stalk', { toward: 'partner', gap: 1.7, parallel: true }),
    s('dog', 'run_to', { toward: 'partner', gap: 1.2, pace: 0.85, weight: 1.1 }),
    s('cat', 'pounce', { parallel: true }),
    s('dog', 'play_bow', { weight: 0.8 }),
    s('cat', 'jump', { parallel: true }),
  ],
  // They meet in the middle, bow, then pull back and forth until one wins.
  'tug-dogs': [
    s('both', 'run_to', { toward: 'meet', gap: 1.3, pace: 0.8, weight: 1.2 }),
    s('bolder', 'play_bow', { weight: 0.6 }),
    s('both', 'approach', { toward: 'meet', gap: 1.05, pace: 0.3, weight: 0.5 }),
    s('both', 'tug', { weight: 3 }),
    s('winner', 'win', { weight: 1 }),
    s('loser', 'pant', { parallel: true }),
  ],
  // Line up, sit ready, then run to the far side in separate lanes. The faster one wins.
  'race-dogs': [
    s('both', 'approach', { place: 'left', spread: 'y', pace: 0.45, weight: 1 }),
    s('both', 'sit', { weight: 0.5 }),
    s('winner', 'run_to', { place: 'right', spread: 'y', pace: 0.95, weight: 2 }),
    s('loser', 'run_to', { place: 'right', spread: 'y', pace: 0.78, parallel: true }),
    s('winner', 'win', { weight: 1 }),
    s('loser', 'pant', { parallel: true }),
    s('both', 'approach', { toward: 'meet', gap: 1.3, pace: 0.35, weight: 1 }),
  ],
  'race-cats': [
    s('both', 'approach', { place: 'left', spread: 'y', pace: 0.45, weight: 1 }),
    s('both', 'sit', { weight: 0.5 }),
    s('winner', 'run_to', { place: 'right', spread: 'y', pace: 0.95, weight: 2 }),
    s('loser', 'run_to', { place: 'right', spread: 'y', pace: 0.78, parallel: true }),
    s('winner', 'win', { weight: 1 }),
    s('loser', 'sit', { parallel: true }),
  ],
  'race-cross': [
    s('dog', 'play_bow', { weight: 0.7 }),
    s('cat', 'sit', { parallel: true }),
    s('both', 'approach', { place: 'left', spread: 'y', pace: 0.45, weight: 1 }),
    s('winner', 'run_to', { place: 'right', spread: 'y', pace: 0.95, weight: 2 }),
    s('loser', 'run_to', { place: 'right', spread: 'y', pace: 0.78, parallel: true }),
    s('cat', 'jump', { weight: 0.6 }),
    s('winner', 'win', { weight: 1 }),
    s('loser', 'pant', { parallel: true }),
  ],
  // One chases, the other runs. Then they switch.
  'chase-dogs': [
    s('bolder', 'run_to', { toward: 'partner', gap: 1.05, pace: 0.9, weight: 1.6 }),
    s('shyer', 'run_to', { toward: 'away', pace: 0.85, parallel: true }),
    s('bolder', 'play_bow', { weight: 0.5 }),
    s('shyer', 'sit', { parallel: true }),
    s('shyer', 'run_to', { toward: 'partner', gap: 1.05, pace: 0.9, weight: 1.6 }),
    s('bolder', 'run_to', { toward: 'away', pace: 0.85, parallel: true }),
    s('winner', 'win', { weight: 1 }),
    s('loser', 'pant', { parallel: true }),
  ],
  'chase-cats': [
    s('bolder', 'stalk', { toward: 'partner', gap: 1.3, weight: 1.3 }),
    s('shyer', 'sit', { parallel: true }),
    s('bolder', 'pounce', { weight: 0.5 }),
    s('shyer', 'run_to', { toward: 'away', pace: 0.9, parallel: true }),
    s('shyer', 'stalk', { toward: 'partner', gap: 1.3, weight: 1.3 }),
    s('bolder', 'run_to', { toward: 'away', pace: 0.9, parallel: true }),
    s('shyer', 'pounce', { weight: 0.5 }),
    s('winner', 'win', { weight: 1 }),
    s('loser', 'sit', { parallel: true }),
  ],
  'chase-cross': [
    s('dog', 'run_to', { toward: 'partner', gap: 1.1, pace: 0.9, weight: 1.5 }),
    s('cat', 'run_to', { toward: 'away', pace: 0.9, parallel: true }),
    s('cat', 'jump', { weight: 0.6 }),
    s('dog', 'play_bow', { parallel: true }),
    s('cat', 'stalk', { toward: 'partner', gap: 1.4, weight: 1.3 }),
    s('dog', 'sit', { parallel: true }),
    s('cat', 'pounce', { weight: 0.5 }),
    s('dog', 'run_to', { toward: 'away', pace: 0.85, parallel: true }),
    s('winner', 'win', { weight: 1 }),
    s('loser', 'pant', { parallel: true }),
  ],
  // The shy one sneaks off, the bold one counts then searches, and finds them.
  'hide-any': [
    s('shyer', 'hide', { place: 'far', pace: 0.55, weight: 1.4 }),
    s('bolder', 'sit', { parallel: true }),
    s('bolder', 'sniff', { place: 'random', weight: 1.1 }),
    s('bolder', 'sniff', { place: 'random', weight: 1.1 }),
    s('bolder', 'run_to', { toward: 'partner', gap: 1.1, pace: 0.8, weight: 1 }),
    s('shyer', 'celebrate', { weight: 0.8 }),
    s('bolder', 'play_bow', { parallel: true }),
  ],
  // Come together, sniff nose to nose, circle each other, then sit side by side.
  'sniff-any': [
    s('both', 'approach', { toward: 'meet', gap: 1.5, pace: 0.4, weight: 1.2 }),
    s('both', 'sniff', { toward: 'partner', gap: 1.1, weight: 1 }),
    s('bolder', 'sniff', { toward: 'partner', gap: 1.1, lane: 34, weight: 1 }),
    s('shyer', 'sit', { parallel: true }),
    s('bolder', 'sniff', { toward: 'partner', gap: 1.1, lane: -34, weight: 1 }),
    s('both', 'approach', { toward: 'meet', gap: 1.35, pace: 0.3, weight: 0.8 }),
    s('both', 'sit', { weight: 0.8 }),
  ],
  // Charge in together, hop around, and one leads a victory lap.
  'splash-dogs': [
    s('both', 'run_to', { place: 'center', spread: 'x', pace: 0.9, weight: 1.2 }),
    s('both', 'jump', { weight: 0.6 }),
    s('both', 'jump', { weight: 0.6 }),
    s('bolder', 'run_to', { place: 'random', pace: 0.85, weight: 1.1 }),
    s('shyer', 'run_to', { toward: 'partner', gap: 1.2, pace: 0.85, parallel: true }),
    s('both', 'jump', { weight: 0.6 }),
    s('winner', 'celebrate', { weight: 0.9 }),
  ],
  // Settle down side by side and sleep.
  'nap-any': [
    s('both', 'approach', { toward: 'meet', gap: 1.3, pace: 0.35, weight: 1.2 }),
    s('both', 'sit', { weight: 0.7 }),
    s('both', 'nap', { weight: 3 }),
  ],
  // They take turns showing off while the other watches and cheers.
  'trick-any': [
    s('both', 'approach', { toward: 'meet', gap: 1.5, pace: 0.4, weight: 1 }),
    s('B', 'trick', { weight: 1.6 }),
    s('A', 'sit', { parallel: true }),
    s('A', 'celebrate', { weight: 0.8 }),
    s('B', 'play_bow', { parallel: true }),
    s('A', 'trick', { weight: 1.4 }),
    s('B', 'sit', { parallel: true }),
    s('B', 'celebrate', { weight: 0.8 }),
    s('A', 'play_bow', { parallel: true }),
  ],
  'trick-cross': [
    s('cat', 'approach', { toward: 'partner', gap: 1.5, pace: 0.4, weight: 1 }),
    s('dog', 'sit', { parallel: true }),
    s('dog', 'play_bow', { weight: 0.8 }),
    s('cat', 'trick', { weight: 1.5 }),
    s('dog', 'sit', { parallel: true }),
    s('dog', 'trick', { weight: 1.4 }),
    s('cat', 'sit', { parallel: true }),
    s('both', 'celebrate', { weight: 0.8 }),
  ],
};

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

function resolveWho(step: Step, petA: PetSnapshot, petB: PetSnapshot, activity: ActivityDefinition): 'A' | 'B' | 'both' {
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
  const trait = activity.id === 'race' ? 'agility' : 'stamina';
  const winner = byTrait(petA, petB, trait, true);
  if (step.who === 'winner') {
    return winner;
  }
  return winner === 'A' ? 'B' : 'A';
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

function paramsFor(step: Step, rng: () => number, floor: Floor, flip: boolean): BeatParams {
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
}): GeneratedPlaydate {
  const { petA, petB, activity, sceneId, seed } = input;
  const rng = rngFrom(seed, activity.id, sceneId, petA.snapshotId, petB.snapshotId);
  const floor = sceneById(sceneId).floor;
  const flip = rng() < 0.5;
  const pair = speciesPair(petA.species, petB.species);
  const templateId = activity.templates[pair] ?? 'nap-any';
  const body = templates[templateId].slice();
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
  const affection = (score(petA, 'affection') + score(petB, 'affection')) / 2;
  if (affection >= 55) {
    body.push(s('both', 'nuzzle', { toward: 'partner', gap: 1.05, weight: 0.8 }));
  }
  const steps = [...warmup, ...body];
  const stamina = Math.min(1, Math.max(0, (score(petA, 'stamina') + score(petB, 'stamina')) / 200));
  const extra = Math.floor(rng() * Math.max(1, Math.round((maxDurationMs - minDurationMs) * (0.45 + 0.55 * stamina))));
  const durationMs = Math.min(maxDurationMs, minDurationMs + extra);
  const lastT = durationMs - closingHoldMs;
  // Steps that share a start (parallel) take their time from the step they join.
  const totalWeight = steps.reduce((sum, step) => (step.parallel ? sum : sum + (step.weight ?? 1)), 0);
  const unit = totalWeight > 0 ? lastT / totalWeight : lastT;
  const beats: Beat[] = [];
  let elapsedWeight = 0;
  let currentT = 0;
  for (const step of steps) {
    if (!step.parallel) {
      currentT = Math.round(elapsedWeight * unit);
      elapsedWeight += step.weight ?? 1;
    }
    beats.push({
      t: currentT,
      actor: resolveWho(step, petA, petB, activity),
      action: step.action,
      params: paramsFor(step, rng, floor, flip),
    });
  }
  // A nap playdate ends asleep. Anything else closes on a random wrap-up.
  const closing =
    activity.id === 'nap'
      ? 'nap'
      : closingActions[Math.min(closingActions.length - 1, Math.floor(rng() * closingActions.length))];
  beats.push({
    t: lastT,
    actor: 'both',
    action: closing,
    params: point(rng, floor),
  });

  const rareEvents: PlaydateOutcome['rareEvents'] = [];
  const chance = 0.05 + (score(petA, 'intelligence') / 100) * 0.22;
  if (petB.partyTricks.length > 0 && rng() < chance) {
    const trickId = petB.partyTricks[Math.min(petB.partyTricks.length - 1, Math.floor(rng() * petB.partyTricks.length))];
    rareEvents.push({ type: 'trick_shown', trickId });
  }

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
}): GeneratedPlaydate | null {
  const activity = activityById(input.activityId);
  if (!activity) {
    return null;
  }
  return generatePlaydate({ ...input, activity });
}
