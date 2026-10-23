import type { Item } from '../items/types';
import type { PointerTarget } from '../input/pointer';
import type { BreedRanges, Equipped, Look } from '../sim/types';
import type { Scene } from './scenes';
import type { CuddleParams } from './data/cuddle';
import type { JumpOut, JumpState } from './jump';
import type { Variant } from './variation';

export type Vec = { x: number; y: number };

export type Species = 'dog' | 'cat';

export type Pattern = 'stripes' | 'points' | 'bicolor' | 'none';

export type TaskType =
  | 'stand'
  | 'sit'
  | 'sleep'
  | 'eat'
  | 'walk'
  | 'jump'
  | 'pant'
  | 'paw'
  | 'bark'
  | 'idle'
  | 'fetch'
  | 'winddown'
  | 'purr'
  | 'groom'
  | 'pounce'
  | 'cuddle'
  | 'travel'
  | 'greet'
  | 'treat'
  | 'held';

// Silhouette vocabulary. Each breed picks one value per slot, and the renderer draws the matching shape.
export type EarType =
  | 'erectTall'
  | 'bat'
  | 'longDrape'
  | 'button'
  | 'softFlop'
  // Cat ears.
  | 'standard'
  | 'wedgeLarge'
  | 'smallLow'
  | 'tufted'
  | 'folded';

export type SkullShape = 'wedge' | 'long' | 'dome' | 'broad' | 'fox' | 'round' | 'flat' | 'square';

export type TailType =
  | 'sickleBushy'
  | 'fluffyRump'
  | 'plume'
  | 'thinTaper'
  | 'doubleCurl'
  | 'catLong'
  | 'catThin'
  | 'catPlume'
  | 'catBushy';

export type Texture = 'smooth' | 'ruff' | 'feathered' | 'fluffyRump' | 'longCoat' | 'tufts';

export type EyeShape = 'almond' | 'slanted' | 'round' | 'bigRound';

export type Ruff = 'none' | 'neck' | 'chest';

// Named marking shapes. Head shapes are drawn in head space and follow the 3/4 turn; body shapes in torso space.
export type MarkingShape =
  | 'faceMask'
  | 'cap'
  | 'blaze'
  | 'muzzle'
  | 'browDots'
  | 'blackMask'
  | 'wrinkles'
  | 'ears'
  | 'chest'
  | 'belly'
  | 'socks'
  | 'lowerLegs'
  | 'feathering'
  | 'points'
  | 'tailTip'
  | 'legs'
  | 'tail'
  | 'tabbyBack'
  | 'tabbyM'
  | 'cheekBars'
  | 'tailRings';

// How a marking region gets its color: locked to a fixed color, or derived from the user's palette.
export type ColorRule =
  | { mode: 'locked'; color: string }
  | { mode: 'base' }
  | { mode: 'tint'; amount: number }
  | { mode: 'shade'; amount: number }
  // The user's point accent when the look has one, otherwise a shade of the base.
  | { mode: 'points'; amount: number };

export type MarkingRegion = {
  name: string;
  shape: MarkingShape;
  where: 'head' | 'body';
  color: ColorRule;
  // Only active when the look's pattern is this one (tabby stripes only for 'stripes').
  when?: Pattern;
};

export type ResolvedMarking = { name: string; shape: MarkingShape; where: 'head' | 'body'; color: string; locked: boolean };

export type Breed = {
  id: string;
  name: string;
  species: Species;
  bodyLen: number;
  bodyH: number;
  legLen: number;
  head: number;
  snout: number;
  earSize: number;
  // Silhouette parameters. They come from breed data only: the look never changes them.
  earType: EarType;
  skull: SkullShape;
  // Brow-to-snout step depth, 0 (flat wedge) to 1 (deep).
  stop: number;
  tailType: TailType;
  texture: Texture;
  noseSize: number;
  muzzleWidth: number;
  eyeShape: EyeShape;
  // 1 is average. Below is close-set, above is wide-set.
  eyeSpacing: number;
  // Eye size multiplier on top of the eye shape. Omitted is 1.
  eyeSize?: number;
  markings: readonly MarkingRegion[];
  // How the body color is derived from the user's color. Default is the user's color itself.
  baseRule?: ColorRule;
  ruff: Ruff;
  // Locked eye colors ignore any color the look asks for.
  eyeColorLocked?: boolean;
  // Look patterns this breed allows, besides its own.
  patterns: readonly Pattern[];
  // Per-pet variation, set from the pet seed (see variation.ts). Absent means the breed's own values.
  tailFluff?: number;
  markingIntensity?: number;
  oneEarFlop?: boolean;
  coat: string;
  earColor: string;
  muzzle: string;
  pitch: number;
  size: number;
  cuteness: number;
  eyeColor?: string;
  pattern?: Pattern;
  accent?: string;
  behaviors: readonly TaskType[];
  attributeRanges: BreedRanges;
  blurb: string;
};

export type Pose = {
  sit: number;
  lie: number;
  walk: number;
  paw: number;
  pant: number;
  headDown: number;
  headRest: number;
  headTurn: number;
  eyes: number;
  wagAmp: number;
  breathAmp: number;
  breathRate: number;
  squint: number;
  spineArch: number;
  crouch: number;
  // Cuddle channels. Offsets are actor-local pixels and angles are radians.
  headDx: number;
  headDy: number;
  headRot: number;
  // Positive bends the ears back, negative perks them up.
  earBack: number;
  torsoShift: number;
  snoutScale: number;
  tailLift: number;
  // 0 = upright, 1 = on its back.
  belly: number;
  knead: number;
  paddle: number;
  kick: number;
  shake: number;
  // Play locomotion channels, all 0..1.
  // Legs tucked in the air.
  tuck: number;
  // Landing squash that absorbs the impact.
  land: number;
  // Dog play bow: front legs folded, chest low, rump up.
  bow: number;
  // Cat stalk: low crouch with the eyes on the toy.
  stalk: number;
  // Butt wiggle before a pounce.
  wiggle: number;
  // Ears and tail streaming back at a gallop.
  stream: number;
  // Spine flex and extend at canter and gallop.
  stretch: number;
  // Braking hard to turn: weight back, front feet forward.
  skid: number;
  // Greeting channels. side is a flop and does not roll the belly.
  side: number;
  rearUp: number;
  headUp: number;
  headPush: number;
  jawHold: number;
  pupils: number;
  closeUp: number;
  rubSway: number;
  legPedal: number;
  faceCam: number;
  headFront: number;
  // Symmetric face toward the camera. Greetings raise it for a bark or meow.
  faceFront: number;
};

export type IdleMode = 'still' | 'pant' | 'purr' | 'nap' | 'walk' | 'zoom';

export type Task = {
  type: TaskType;
  stage: string;
  t: number;
  kind?: 'eat' | 'drink';
  // Premium food. The pet chews faster than it does for kibble.
  premium?: boolean;
  bats: number;
  cool: number;
  // How long the current hold lasts (play bow, stalk wiggle, shake, chew), in seconds.
  hold?: number;
  poi?: { x: number; y: number; face?: 1 | -1; propId?: string };
  // True while a greeting is the only writer of actor.face.
  ownsFacing?: boolean;
  greet?: GreetRun;
  // Mood points to show once this treat is eaten.
  mood?: number;
};

export type HeartBit = { x: number; y: number; t: number; life: number };

export type GreetSound = 'yip' | 'woof' | 'howl' | 'whine' | 'meow' | 'trill' | 'purr' | 'yawn';

export type GreetFace = 1 | -1 | 'flip' | 'toward' | 'keep';

export type GreetMove =
  | { to: 'center' | 'front' | 'left' | 'right' | 'offLeft' | 'offRight' | 'bowl' | 'offEdge'; speed: number }
  | { dx: number; dy?: number; speed: number };

export type GreetStep = {
  dur: number;
  untilArrive?: boolean;
  pose?: Partial<Pose>;
  rate?: Partial<Record<keyof Pose, number>>;
  move?: GreetMove;
  face?: GreetFace;
  spin?: boolean;
  hop?: number;
  sound?: GreetSound;
  wag?: { amp: number; rate: number };
  march?: boolean;
  toy?: 'pickup' | 'drop';
  skid?: boolean;
  hearts?: boolean;
  patWindow?: boolean;
};

export type Spin = { rate: number; far: number; home: 1 | -1; returned: boolean };

// Runtime greeting cursor. Steps are not saved.
export type GreetRun = {
  steps: GreetStep[];
  index: number;
  stepT: number;
  extra: number;
  delay: number;
  storeId: string | null;
  phase: 'delay' | 'wait' | 'run';
  armed: boolean;
  patUsed: boolean;
  march: boolean;
  faceCam: number;
  headFront: number;
  patWindow: boolean;
  move: Vec | null;
  speed: number;
  untilArrive: boolean;
  hopAir: number;
  skid: boolean;
  poseRates?: Partial<Record<keyof Pose, number>>;
};

export type Idle = {
  mode: IdleMode;
  t: number;
  dur: number;
  target: Vec | null;
  sit: boolean;
  arrived: boolean;
  // World time of the last spontaneous bark or meow, so they stay rare.
  voicedAt?: number;
};

export type Gait = 'walk' | 'trot' | 'canter' | 'gallop';

// The gait the legs are in and the one they came from. `blend` runs 0 to 1 over about 150 ms.
export type GaitState = { current: Gait; from: Gait; blend: number };

// Play-relevant attributes as 0..1.
export type LocoStats = { stamina: number; agility: number; boldness: number; obedience: number };

export type JumpKind = 'hop' | 'leap' | 'pounce';

// A playdate director owns the actor. Home idle does not run while this is set.
export type DirectionPose =
  | 'walk'
  | 'run'
  | 'sit'
  | 'sleep'
  | 'jump'
  | 'pant'
  | 'paw'
  | 'bow'
  | 'stalk'
  | 'pounce'
  | 'celebrate'
  | 'sniff'
  | 'skid'
  | 'zoomies'
  | 'roll_over'
  | 'flop';

// A playdate gesture playing on top of a directed pose. Steps are not saved.
export type GestureRun = {
  id: string;
  index: number;
  elapsed: number;
};

export type Direction = {
  target: Vec | null;
  pace: number;
  pose: DirectionPose;
  token: number;
};

// Choices made once per chase, from the seeded stream, the pet's energy and mood, and its age.
export type PlayState = {
  // Share of top speed this chase runs at.
  speedFrac: number;
  burstLeft: number;
  burstIn: number;
  // Seniors sometimes walk to the toy.
  walkToToy: boolean;
  // Whether this chase attempts leap-catches.
  leap: boolean;
  // Whether the pet brings the toy back.
  returns: boolean;
  // A play bow has already happened this chase.
  bowed: boolean;
  overshoot: number;
  tumbled: boolean;
  // Set once a stalk or a pounce has happened this chase, so each happens at most once.
  stalked: boolean;
  pounced: boolean;
  // True only for a toy the player threw. A pet that starts fetch on its own leaves this unset.
  thrown?: boolean;
  // The find for this chase has already been recorded.
  counted?: boolean;
};

export type ZoomState = { leg: number; legs: number; first: number };

export type Bark = {
  active: boolean;
  t: number;
  fired: [boolean, boolean];
  open: number;
  sound: boolean;
};

export type CuddleZone = 'head' | 'back' | 'nose' | 'belly';

export type CuddlePhase =
  | 'approach'
  | 'settle'
  | 'waiting'
  | 'rollDown'
  | 'rollOver'
  | 'belly'
  | 'rollBack'
  | 'hold'
  | 'unturn'
  | 'shake'
  | 'swat'
  | 'leave';

export type CuddleExit = 'mode' | 'tolerance' | 'timeout';

export type CuddleReactionKind = 'boop' | 'headShake' | 'flinch' | 'scratch' | 'swat';

export type CuddleReaction = { kind: CuddleReactionKind; t: number; dur: number; side: 1 | -1 };

export type CuddleState = {
  params: CuddleParams;
  phase: CuddlePhase;
  t: number;
  // Seconds since the last valid touch movement, and since a touch of any kind.
  touchT: number;
  sinceTouch: number;
  touchX: number | null;
  zone: CuddleZone | null;
  strokes: number;
  continuity: number;
  sustained: number;
  tolerance: number;
  petted: number;
  // True while the user is mid-gesture. Lifting the finger clears the mood streak.
  gesturing: boolean;
  gestureSec: number;
  moodPaid: number;
  reaction: CuddleReaction | null;
  boopTimes: number[];
  kickT: number;
  kickCool: number;
  buntT: number;
  tiltT: number;
  tiltNext: number;
  tiltSide: 1 | -1;
  kneading: boolean;
  purring: boolean;
  trap: boolean;
  trapTried: boolean;
  exit: CuddleExit | null;
  leaveTarget: Vec | null;
  perkT: number;
  announced: boolean;
  // One-shot flag for the sound or event of the current phase.
  fired: boolean;
};

export type CuddleOut = { type: 'exit'; reason: CuddleExit } | { type: 'done'; petted: number };

export type Actor = {
  id: string;
  breedId: string;
  x: number;
  y: number;
  z: number;
  vz: number;
  vx: number;
  vy: number;
  speed: number;
  // Dangling cloth (scarf tails, drawstrings, bandana tip). Seed prevVx with vx on spawn and on every reset.
  swing: number;
  swingVel: number;
  prevVx: number;
  axSmooth: number;
  face: number;
  // Displayed octant, the one being tweened from, and the one velocity or a pose wants.
  octant: import('./data/facing').Facing;
  octantFrom: import('./data/facing').Facing;
  octantTarget: import('./data/facing').Facing;
  // 0..1 blend of continuous view params. Draw order swaps at 1.
  octantBlend: number;
  octantHold: number;
  // How many octants this target was when it was chosen. Above 1, the pet arcs until it is close.
  octantSpan: number;
  // Horizontal sign captured when the target was chosen. N/S tie-breaks use this, not the live face.
  aimFace: 1 | -1;
  // Low-passed velocity used to pick the octant.
  aimVx: number;
  aimVy: number;
  // Facing-lab override, in radians. E = 0, S = +π/2. Absent in normal play.
  debugTheta?: number;
  // The facing yaw is currently chasing. A change starts the head lead.
  yawFace: 1 | -1;
  yaw: number;
  // Seconds left before a reversal may rotate the body.
  lead: number;
  turning: boolean;
  // Seconds vx has pointed against face, for the free-movement flip.
  faceHold: number;
  spin: Spin | null;
  pace: number;
  hopScale: number;
  hearts: HeartBit[];
  pendingGreetId: string | null;
  pose: Pose;
  task: Task;
  idle: Idle;
  phase: number;
  panPh: number;
  chewPh: number;
  wagPh: number;
  breathPh: number;
  blinkT: number;
  pantT: number;
  bark: Bark;
  ageDays: number;
  displayAgeDays: number;
  weight: number;
  displayWeight: number;
  syncedWeight: number;
  // Need-energy change (pet points, not 0..1) waiting to be applied to pet state.
  pendingEnergy: number;
  // Hunger gain (pet points) from moving or playing, waiting to be applied to pet state.
  pendingHunger: number;
  // Hydration change in pet points, negative while busy, waiting to be applied to pet state.
  pendingHydration: number;
  vitality: number;
  equipped: Equipped;
  // World time of the last bell jingle, so a run does not ring every frame.
  bellAt?: number;
  look: Look | null;
  variant: Variant;
  asleep: boolean;
  // Seconds left in a collapse nap after energy hits 0. 0 means not collapsing.
  collapseLeft: number;
  // Seconds toward the next rest-energy tick. A user sleep pays every 5 seconds.
  sleepSec: number;
  // Energy-point amounts waiting to be shown, one per rest or collapse burst.
  energyPops: number[];
  // Mood-point amounts waiting to be shown, one per cuddle burst.
  moodPops: number[];
  mouth: Vec;
  anchors: Anchors;
  // 0..1, how much this pet likes cuddling. It sets how soon it escalates and how long it stays.
  cuddleAffinity: number;
  cuddle: CuddleState | null;
  cuddleOut: CuddleOut[];
  gait: GaitState;
  // 0..1. Drains at canter and gallop, recovers when slower.
  stamina: number;
  // Too tired for the fastest gaits until it has recovered.
  tired: boolean;
  stats: LocoStats;
  // Needs as 0..1, used to size how lively play is.
  energy: number;
  mood: number;
  // 0..1 hydration. Low hydration makes the pet seek water on its own.
  hydration: number;
  play: PlayState | null;
  zoom: ZoomState | null;
  // Seconds of landing absorb left after a hop, 0..1. Phase jumps use `jump` instead.
  land: number;
  jumpKind: JumpKind | null;
  // Phase jump. Null while the pet is on the ground between jumps.
  jump: JumpState | null;
  // Landing events waiting for the screen that started the jump.
  jumpOut: JumpOut[];
  // Seconds the current gait has been at canter or faster.
  topT: number;
  // Speed as a share of the pet's own top speed, for the legs.
  share: number;
  direction: Direction | null;
  // The direction token that already launched a jump, so a held jump fires once.
  directionJump: number;
  // Playdate gesture. setDirection does not clear it.
  gesture: GestureRun | null;
  // Head point in stage space, written while drawing, for marks that must sit above the weather.
  headMark: { x: number; y: number } | null;
  // Mouth point in stage space, written while drawing, so a rope can meet the toy.
  mouthMark: { x: number; y: number } | null;
  // A park visitor. Care, meals, and the player's commands do not apply.
  guest?: boolean;
};

export type Anchors = {
  // nearEye, farEye and top are in head space (relative to head x and y, before pitch).
  head: {
    x: number;
    y: number;
    pitch: number;
    radius: number;
    nearEye: Vec;
    farEye: Vec;
    farEyeAlpha: number;
    top: Vec;
  };
  neck: { x: number; y: number };
  torso: { theta: number; dy: number; pivot: { x: number; y: number } };
  paws: { x: number; y: number; shin: number }[];
  scale: number;
  facing: 1 | -1;
};

export type Particle = { x: number; y: number; v: number; ph: number };

// Cuddle content clips. Boop, flinch, swat, and shake-off stay silent.
export type CuddleSound = 'cuddle_purr' | 'cuddle_happy' | 'cuddle_pant';

export type HeldToy = {
  kind: 'wand' | 'laser';
  x: number;
  y: number;
  z: number;
  down: boolean;
  quiet: number;
  chase: number;
  watch: number;
  leap: number;
  swat: number;
  pounce: number;
  catch: number;
  slip: number;
  moodAt: number;
  featherX: number;
  featherZ: number;
  prevX: number;
  speed: number;
  spark: number;
};

export type SoundEvent = {
  actorId: string;
  sound: 'bark' | 'meow' | 'growl' | 'sneeze' | 'sneeze_cat' | 'trill' | 'bell' | 'squeak' | CuddleSound;
  rate: number;
};

export type CareInvite = 'food' | 'water' | 'bed';

export type World = {
  actors: Actor[];
  items: Item[];
  pointerTarget: PointerTarget;
  waterLevel: number;
  bowlFill: number;
  pendingBowlDrinks: number;
  // Drinks from water that is not a bowl, such as the pond.
  pendingPondDrinks: number;
  // Food waiting in the bowl, and meals finished since the view last looked.
  foodStocked: boolean;
  premiumMeal?: boolean;
  // Player taps, oldest first. The prop itself is the queue.
  invites: CareInvite[];
  // The invite Z is walking toward or acting on right now.
  serving: CareInvite | null;
  // Set the frame he lies down, so the pet record can flip asleep.
  pendingRest: boolean;
  restLatched: boolean;
  glance: { face: 1 | -1; left: number } | null;
  liftedId: string | null;
  squishId: string | null;
  squishAt: number;
  pendingMeals: number;
  pendingPlayFinds: ('fetch_round' | 'toy_round')[];
  // Mood-point amounts waiting to be shown, one per treat the pet has finished.
  pendingTreatMoods: number[];
  // Treat bites finished since the view last looked, including bites with no mood.
  pendingTreatFinishes: number;
  // The treat the pet is walking to or chewing. Cleared once that bite is settled.
  liveTreat: { mood: number } | null;
  t: number;
  rng: () => number;
  scene: Scene;
  reducedMotion: boolean;
  particles: Particle[];
  sounds: SoundEvent[];
  // Debug rendering only: draw every actor as a flat black silhouette.
  silhouette?: boolean;
  // Pets never nap or collapse on their own. Other idles still run.
  noNap?: boolean;
  // The toy gestures and play use. Missing means the ball.
  toyKind?: string;
  // A wand or laser the player is holding. Floor toys are removed while this is set.
  held: HeldToy | null;
  // Seconds of continuous toy movement toward the next mood grant. Cleared when the toy stops.
  playMoodSec: number;
  // Taps and throws toward the next mood grant. Cleared when that grant lands, or the toy is put away.
  playActs: number;
  // True while a throw drag is moving fast enough to count as using the toy.
  playTouch: boolean;
  // Multiplies sim dt. Debug scrubbing uses 0.5 and 0.2.
  timeScale?: number;
  // Toys a greeting may carry. Always includes ball.
  toyPool?: string[];
  // Id of the greeting currently showing, for the debug panel.
  greetLabel?: string;
  // Home park visitors. Missing or disabled on every other stage.
  park?: ParkBook;
};

export type ParkOffer = {
  id: string;
  breedId: string;
  species: Species;
  ageDays: number;
  weight: number;
  vitality: number;
  seed: number;
  // Shown scores, 0–100.
  boldness: number;
  affection: number;
  look: Look | null;
  equipped: Equipped;
};

export type ParkGuestPhase = 'enter' | 'wander' | 'hello' | 'leave';

export type ParkGuestState = {
  actorId: string;
  snapshotId: string;
  boldness: number;
  affection: number;
  species: Species;
  ageDays: number;
  leaveAt: number;
  hardLeaveAt: number;
  phase: ParkGuestPhase;
  helloUntil: number;
  partnerId: string | null;
  // This visitor already had their one hello, paid or cancelled.
  done: boolean;
  paid: boolean;
  tried: boolean;
};

export type ParkBook = {
  enabled: boolean;
  offers: ParkOffer[];
  stranger: ((nonce: number) => ParkOffer) | null;
  nonce: number;
  nextCheck: number;
  recentId: string | null;
  moodAt: number[];
  staying: boolean;
  helloAt: number;
  guests: ParkGuestState[];
};

export type ActorSource = {
  id: string;
  breedId: string;
  ageDays: number;
  weight: number;
  vitality: number;
  equipped: Equipped;
  look?: Look | null;
  asleep: boolean;
  cuddleAffinity?: number;
  // The pet seed, for per-pet variation inside the breed.
  seed?: number;
  // 0..1 energy and happiness, and the play attributes, for how the pet moves in play.
  energy?: number;
  mood?: number;
  hydration?: number;
  stats?: LocoStats;
};
