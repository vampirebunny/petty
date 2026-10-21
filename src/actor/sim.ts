import {
  activityEnergyPerHour,
  activityHungerPerHour,
  activityThirstPerHour,
  collapseSleepSec,
  collapseWakeEnergy,
  decayPerHour,
  healthyWeightBand,
  overweightPlayWeightBonus,
  playWeightPerHour,
  weightBurnPerSec,
  weightRunSpeed,
} from '../sim/config';
import type { Item } from '../items/types';
import { stepItems } from '../items/physics';
import { inactivePointer } from '../input/pointer';
import { toyAllows } from '../items/playRules';
import type { PlayBehavior } from '../items/playRules';
import { bodyFrame, depthScale, geomOf, headFaceOf, PET_SIZE, reachOf, speedMax, stageWidth, travelGateX, xRangeOf } from './geometry';
import { GREET, greetClip, motionMods, planGreeting, scriptFor } from './greetings';
import type { GreetPlan } from './greetings';
import { cancelJump, jump, jumpConfig, jumpOwnsMotion, resolveJump, stepJump } from './jump';
import { baseYaw, reversingTurn, stepFacing, stepYaw, TURN_SPEED, visualYaw } from './turn';
import {
  bowHold,
  gaitSpeedCap,
  gravity,
  jumpHeights,
  landSeconds,
  stalkWiggle,
} from './data/locomotion';
import {
  burstLength,
  chooseGait,
  jumpSpeed,
  landImpact,
  energySpeedScale,
  locoModsOf,
  maxGaitOf,
  newGaitState,
  nextBurstIn,
  phaseRate,
  predictCrossing,
  sampleChaseSpeed,
  stageProfileOf,
  stepGait,
  stepStamina,
  streamOf,
  isGaitAllowed,
} from './locomotion';
import type { LocoMods } from './locomotion';
import type { StageProfile } from './data/locomotion';
import { breedById, voiceRate } from './breeds';
import { growthFor } from './growth';
import { canBehave, reactionFor, type UserTask } from './behavior';
import { defaultPose, easePose } from './pose';
import { newCuddle, stepCuddle } from './cuddle';
import { nearestPoi, poiOf, sceneForSpecies, scenes, stageHeight } from './scenes';
import type { Scene } from './scenes';
import { variantFor } from './variation';
import type { Actor, ActorSource, Anchors, Direction, Idle, IdleMode, JumpKind, PlayState, Pose, SoundEvent, Task, TaskType, Vec, World } from './types';

const displayTau = 0.35;
const idleWeight: Record<IdleMode, number> = { still: 3, pant: 2, purr: 2, nap: 1.5, walk: 2.5, zoom: 0 };
// Horizontal speed below this is a settle, not a step. Above it, the body faces that direction.
const faceDeadzone = 8;

const defaultStats = { stamina: 0.5, agility: 0.5, boldness: 0.5, obedience: 0.5 };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function easeDisplay(current: number, target: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-dt / displayTau));
}

function makeToyItem(world: World, partial: Partial<Item> & Pick<Item, 'state'>): Item {
  const kind = world.toyKind ?? 'ball';
  return {
    id: `${kind}-1`,
    kind,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    holderId: undefined,
    ...partial,
  };
}

function clearItems(world: World): void {
  world.items = [];
}

function freeToy(world: World): Item | null {
  return world.items.find((item) => item.state === 'free') ?? null;
}

function carriedBy(world: World, actorId: string): Item | null {
  return world.items.find((item) => item.state === 'carried' && item.holderId === actorId) ?? null;
}

function anyCarried(world: World): boolean {
  return world.items.some((item) => item.state === 'carried');
}

function hasRefillableBowl(scene: Scene): boolean {
  return scene.props.some((prop) => prop.kind === 'bowl' && prop.contents === 'water');
}

function canAutonomousDrink(world: World): boolean {
  if (poiOf(world.scene, 'water') == null) {
    return false;
  }
  if (hasRefillableBowl(world.scene)) {
    return world.waterLevel > 0;
  }
  return true;
}

function emptyAnchors(face: 1 | -1 = 1): Anchors {
  return {
    head: {
      x: 0,
      y: 0,
      pitch: 0,
      radius: 0,
      nearEye: { x: 0, y: 0 },
      farEye: { x: 0, y: 0 },
      farEyeAlpha: 0,
      top: { x: 0, y: 0 },
    },
    neck: { x: 0, y: 0 },
    torso: { theta: 0, dy: 0, pivot: { x: 0, y: 0 } },
    paws: [],
    scale: 1,
    facing: face,
  };
}

function makeRng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function taskOf(type: TaskType, stage = '', kind?: 'eat' | 'drink'): Task {
  return { type, stage, t: 0, kind, bats: 0, cool: 0 };
}

function idleOf(mode: IdleMode = 'still'): Idle {
  return { mode, t: 0, dur: 4, target: null, sit: false, arrived: true };
}

function homeOf(scene: Scene): Vec {
  return poiOf(scene, 'home') ?? { x: 300, y: scene.floor.yMin + 40 };
}

function sceneSpeciesOf(actors: { breedId: string }[]): 'dog' | 'cat' {
  return actors.some((actor) => breedById(actor.breedId)?.species === 'cat') ? 'cat' : 'dog';
}

export function stagePoint(x: number, y: number, viewW: number, viewH: number, contentW = viewW): Vec {
  const pad = (viewW - contentW) / 2;
  return {
    x: ((x - pad) / Math.max(contentW, 1)) * stageWidth,
    y: (y / Math.max(viewH, 1)) * stageHeight,
  };
}

export function spawnActor(source: ActorSource, at?: Vec): Actor {
  const scene = scenes.livingroom;
  const home = homeOf(scene);
  const x = at?.x ?? home.x;
  const y = at?.y ?? home.y;
  return {
    id: source.id,
    breedId: source.breedId,
    x,
    y,
    z: 0,
    vz: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    face: 1,
    yawFace: 1,
    yaw: 0,
    lead: 0,
    turning: false,
    faceHold: 0,
    spin: null,
    pace: 1,
    hopScale: 1,
    hearts: [],
    pendingGreetId: null,
    pose: defaultPose(),
    task: taskOf(source.asleep ? 'sleep' : 'idle', source.asleep ? 'sleeping' : ''),
    idle: idleOf(),
    phase: 0,
    panPh: 0,
    chewPh: 0,
    wagPh: 0,
    breathPh: 0,
    blinkT: 3,
    pantT: 0,
    bark: { active: false, t: 0, fired: [false, false], open: 0, sound: false },
    ageDays: source.ageDays,
    displayAgeDays: source.ageDays,
    weight: source.weight,
    displayWeight: source.weight,
    syncedWeight: source.weight,
    pendingEnergy: 0,
    pendingHunger: 0,
    pendingThirst: 0,
    vitality: source.vitality,
    equipped: { ...source.equipped },
    look: source.look ? { ...source.look } : null,
    variant: variantFor(source.seed, source.breedId),
    asleep: source.asleep,
    collapseLeft: 0,
    sleepSec: 0,
    restBonusPaid: false,
    energyPops: 0,
    moodPops: [],
    mouth: { x, y },
    anchors: emptyAnchors(),
    cuddleAffinity: source.cuddleAffinity ?? 0.5,
    cuddle: null,
    cuddleOut: [],
    gait: newGaitState(),
    stamina: 1,
    tired: false,
    stats: { ...(source.stats ?? defaultStats) },
    energy: source.energy ?? 0.8,
    mood: source.mood ?? 0.8,
    thirst: source.thirst ?? 0.15,
    play: null,
    zoom: null,
    land: 0,
    jumpKind: null,
    jump: null,
    jumpOut: [],
    topT: 0,
    share: 0,
    direction: null,
    directionJump: -1,
  };
}

export function setDirection(actor: Actor, direction: Direction | null): void {
  actor.direction = direction;
  if (!direction) {
    return;
  }
  actor.task = taskOf('idle');
  actor.play = null;
  actor.zoom = null;
  actor.cuddle = null;
  actor.asleep = false;
}

function seedParticles(world: World): void {
  const ambient = world.scene.ambient?.particles;
  world.particles = [];
  if (!ambient) {
    return;
  }
  const count = ambient.count || (ambient.kind === 'rain' ? 70 : 14);
  for (let i = 0; i < count; i += 1) {
    world.particles.push({
      x: world.rng() * stageWidth,
      y: world.rng() * stageHeight,
      v: 0.6 + world.rng() * 0.8,
      ph: world.rng() * 6.28,
    });
  }
}

export function createWorld(actors: Actor[], seed = 1, scene: Scene = scenes.livingroom): World {
  const world: World = {
    actors,
    items: [],
    pointerTarget: inactivePointer(),
    waterLevel: 1,
    bowlFill: 1,
    pendingBowlDrinks: 0,
    foodStocked: false,
    pendingMeals: 0,
    t: 0,
    rng: makeRng(seed),
    scene: sceneForSpecies(scene, sceneSpeciesOf(actors)),
    reducedMotion: false,
    particles: [],
    sounds: [],
  };
  seedParticles(world);
  return world;
}

// Sounds the actors made since the last call. The view plays them; the sim never touches audio.
export function takeSounds(world: World): SoundEvent[] {
  const sounds = world.sounds;
  world.sounds = [];
  return sounds;
}

export function syncActor(actor: Actor, source: ActorSource): void {
  const pending = actor.weight - actor.syncedWeight;
  actor.ageDays = source.ageDays;
  actor.syncedWeight = source.weight;
  actor.weight = source.weight + pending;
  actor.vitality = source.vitality;
  actor.equipped = { ...source.equipped };
  actor.look = source.look ? { ...source.look } : null;
  actor.breedId = source.breedId;
  actor.variant = variantFor(source.seed, source.breedId);
  actor.cuddleAffinity = source.cuddleAffinity ?? actor.cuddleAffinity;
  actor.energy = source.energy ?? actor.energy;
  actor.mood = source.mood ?? actor.mood;
  actor.thirst = source.thirst ?? actor.thirst;
  actor.stats = source.stats ? { ...source.stats } : actor.stats;
  if (actor.collapseLeft <= 0 && actor.asleep !== source.asleep) {
    actor.sleepSec = 0;
    actor.restBonusPaid = false;
    actor.asleep = source.asleep;
    actor.task = taskOf(source.asleep ? 'sleep' : 'idle', source.asleep ? 'sleeping' : '');
    actor.pantT = 0;
  }
}

export function takeWeightDelta(actor: Actor): number {
  const delta = actor.weight - actor.syncedWeight;
  actor.syncedWeight = actor.weight;
  return delta;
}

export function takeEnergyDelta(actor: Actor): number {
  const delta = actor.pendingEnergy;
  actor.pendingEnergy = 0;
  return delta;
}

export function takeHungerDelta(actor: Actor): number {
  const delta = actor.pendingHunger;
  actor.pendingHunger = 0;
  return delta;
}

export function takeThirstDelta(actor: Actor): number {
  const delta = actor.pendingThirst;
  actor.pendingThirst = 0;
  return delta;
}

// A new scene only moves the actors to its home spot. Pet state is untouched, so a sleeping pet keeps sleeping.
export function setWorldScene(world: World, scene: Scene): void {
  scene = sceneForSpecies(scene, sceneSpeciesOf(world.actors));
  if (world.scene === scene) {
    return;
  }
  world.scene = scene;
  const home = homeOf(scene);
  const bed = poiOf(scene, 'bed');
  for (const actor of world.actors) {
    actor.x = home.x;
    actor.y = home.y;
    actor.vx = 0;
    actor.vy = 0;
    actor.z = 0;
    actor.vz = 0;
    actor.speed = 0;
    actor.face = 1;
    actor.yawFace = 1;
    actor.yaw = 0;
    actor.lead = 0;
    actor.turning = false;
    actor.spin = null;
    actor.bark = { active: false, t: 0, fired: [false, false], open: 0, sound: false };
    if (actor.asleep) {
      actor.task = taskOf('sleep', bed ? 'go' : 'sleeping');
    } else {
      actor.task = taskOf('idle');
      beginIdle(world, actor, 'still');
    }
  }
  clearItems(world);
  seedParticles(world);
}

function travelScale(actor: Actor, floor: { yMin: number; yMax: number }): { geom: ReturnType<typeof geomOf>; scale: number } | null {
  const breed = breedById(actor.breedId);
  if (!breed) {
    return null;
  }
  const geom = geomOf(breed, actor.displayAgeDays, actor.displayWeight, actor.vitality);
  return { geom, scale: PET_SIZE * geom.sc * depthScale(actor.y, floor.yMin, floor.yMax) };
}

function clearActorForTravel(world: World, actor: Actor): void {
  releaseCarried(world, actor);
  actor.direction = null;
  actor.play = null;
  actor.zoom = null;
  actor.cuddle = null;
  actor.z = 0;
  actor.vz = 0;
  cancelJump(actor);
  actor.jumpKind = null;
}

// Walks the pet off the right edge so a scene change can fade the empty room.
export function startSceneExit(world: World, actor: Actor): void {
  if (actor.collapseLeft > 0) {
    return;
  }
  clearActorForTravel(world, actor);
  const sized = travelScale(actor, world.scene.floor);
  const x = sized ? travelGateX(sized.geom, sized.scale, 1) : stageWidth + 120;
  actor.task = taskOf('travel', 'exit');
  actor.task.poi = { x, y: actor.y };
  actor.pantT = 0;
}

// Cuts to `scene` with the pet waiting off the left, then walking in to the home spot.
export function startSceneEnter(world: World, actor: Actor, scene: Scene): void {
  scene = sceneForSpecies(scene, sceneSpeciesOf(world.actors));
  world.scene = scene;
  clearItems(world);
  seedParticles(world);
  const home = homeOf(scene);
  const floor = scene.floor;
  const y = clamp(home.y, floor.yMin, floor.yMax);
  actor.y = y;
  const sized = travelScale(actor, floor);
  actor.x = sized ? travelGateX(sized.geom, sized.scale, -1) : -120;
  actor.vx = 0;
  actor.vy = 0;
  actor.speed = 0;
  actor.face = 1;
  actor.anchors.facing = 1;
  clearActorForTravel(world, actor);
  actor.task = taskOf('travel', 'enter');
  actor.task.poi = home;
  actor.pantT = 0;
}

export function isSceneTravel(actor: Actor): boolean {
  return actor.task.type === 'travel';
}

export function frameDt(elapsedMs: number, active: boolean): number {
  if (!active || elapsedMs <= 0) {
    return 0;
  }
  return Math.min(elapsedMs, 50) / 1000;
}

export function settleOnResume(world: World): void {
  let fetching = false;
  for (const actor of world.actors) {
    if (actor.task.type === 'eat' || actor.task.type === 'fetch' || actor.task.type === 'winddown') {
      fetching = actor.task.type === 'fetch' || fetching;
      actor.task = taskOf(actor.asleep ? 'sleep' : 'idle', actor.asleep ? 'sleeping' : '');
      actor.pantT = 0;
    }
  }
  if (fetching || anyCarried(world)) {
    clearItems(world);
  }
}

function releaseCarried(world: World, actor: Actor): void {
  const item = carriedBy(world, actor.id);
  if (!item) {
    return;
  }
  item.state = 'free';
  item.holderId = undefined;
  item.x = actor.mouth.x;
  item.y = actor.y + 1;
  item.z = Math.max(0, actor.y - actor.z - actor.mouth.y);
  item.vx = actor.face * 30;
  item.vy = 0;
  item.vz = 0;
}

export function throwFromEdge(world: World): void {
  const roll = world.rng;
  const floor = world.scene.floor;
  world.items = [
    makeToyItem(world, {
      state: 'free',
      x: floor.xMin - 4,
      y: floor.yMin + 10 + roll() * (floor.yMax - floor.yMin - 20),
      z: 30,
      // A frisbee flies long and flat, a yarn ball is a low toss, the rest are lobbed.
      vx: (240 + roll() * 110) * (world.toyKind === 'frisbee' ? 1.15 : 1),
      vy: (roll() - 0.5) * 90,
      vz: world.toyKind === 'frisbee' ? 170 : world.toyKind === 'yarn' ? 230 : 330,
    }),
  ];
}

export function dropBallAt(world: World, x: number, y: number, soft = true): void {
  const roll = world.rng;
  const floor = world.scene.floor;
  world.items = [
    makeToyItem(world, {
      state: 'free',
      x: clamp(x, floor.xMin - 12, floor.xMax + 12),
      y: clamp(y, floor.yMin, floor.yMax),
      z: soft ? 120 : 130,
      vx: (roll() - 0.5) * (soft ? 18 : 40),
      vy: (roll() - 0.5) * (soft ? 10 : 20),
      vz: 0,
    }),
  ];
}

export function flickBallAt(
  world: World,
  x: number,
  y: number,
  velocity: { vx: number; vy: number; vz: number },
): void {
  const floor = world.scene.floor;
  world.items = [
    makeToyItem(world, {
      state: 'free',
      x: clamp(x, floor.xMin - 12, floor.xMax + 12),
      y: clamp(y, floor.yMin, floor.yMax),
      z: 60,
      vx: velocity.vx,
      vy: velocity.vy,
      vz: velocity.vz,
    }),
  ];
}

export function takeBowlDrinks(world: World): number {
  const count = world.pendingBowlDrinks;
  world.pendingBowlDrinks = 0;
  return count;
}

export function takeMeals(world: World): number {
  const count = world.pendingMeals;
  world.pendingMeals = 0;
  return count;
}

export function syncWorldFood(world: World, stocked: boolean): void {
  world.foodStocked = stocked;
}

export function syncWorldWater(world: World, waterLevel: number): void {
  world.waterLevel = waterLevel;
}

function beginIdle(world: World, actor: Actor, mode: IdleMode): void {
  const roll = world.rng;
  actor.idle.mode = mode;
  actor.idle.t = 0;
  actor.idle.target = null;
  actor.idle.arrived = true;
  actor.idle.dur =
    mode === 'still'
      ? 3 + roll() * 3.5
      : mode === 'nap'
        ? 9 + roll() * 6
        : mode === 'walk'
          ? 9
          : mode === 'pant'
            ? 2 + roll() * 1.5
            : 4 + roll() * 2.5;
  if (mode === 'zoom') {
    startZoom(actor, 4);
    actor.idle.dur = 30;
  }
  actor.idle.sit = mode === 'purr' ? true : mode === 'pant' ? roll() < 0.5 : false;
  const bed = mode === 'nap' ? nearestPoi(world.scene, 'bed', actor) : null;
  if (bed) {
    actor.idle.target = { x: bed.x, y: bed.y };
    actor.idle.arrived = false;
  }
}

function nextIdle(world: World, actor: Actor): void {
  const breed = breedById(actor.breedId);
  // Food left in the bowl draws the pet over even if it was busy when the bowl was filled.
  if (world.foodStocked && poiOf(world.scene, 'food') != null && canBehave(actor, 'eat')) {
    startUserTask(world, actor, 'eat');
    return;
  }
  // Occasional autonomous drink when water is available. Thirst makes this much more likely.
  if (canAutonomousDrink(world) && world.rng() < 0.08 + 0.72 * actor.thirst && canBehave(actor, 'eat')) {
    startUserTask(world, actor, 'drink');
    return;
  }
  const options = (breed?.species === 'cat' ? ['still', 'purr', 'nap', 'walk'] : ['still', 'pant', 'nap', 'walk']).filter(
    (mode) =>
      mode !== actor.idle.mode && !(world.reducedMotion && mode === 'walk') && !(world.noNap && mode === 'nap'),
  ) as IdleMode[];
  const choices = options.length > 0 ? options : (['still'] as IdleMode[]);
  // Zoomies: a short lap at full speed now and then. Youth and energy make them far more frequent.
  const profile = profileOf(actor);
  const zoomWeight =
    world.reducedMotion || world.noNap || actor.stamina < 0.6 || !isGaitAllowed('canter', maxGaitOf(profile, actor.tired))
      ? 0
      : profile.zoomies * 4 * actor.energy * (0.5 + 0.5 * actor.mood);
  const weightOf = (mode: IdleMode): number => (mode === 'zoom' ? zoomWeight : idleWeight[mode]);
  if (zoomWeight > 0) {
    choices.push('zoom');
  }
  const total = choices.reduce((sum, mode) => sum + weightOf(mode), 0);
  let roll = world.rng() * total;
  let pick = choices[0];
  for (const mode of choices) {
    roll -= weightOf(mode);
    if (roll <= 0) {
      pick = mode;
      break;
    }
  }
  beginIdle(world, actor, pick);
  maybeIdleVoice(world, actor, pick);
}

const idleVoiceChance = 0.06;
const idleVoiceCooldown = 60;

// Now and then a resting pet pipes up on its own. Rare, never while moving or asleep, and rate limited.
function maybeIdleVoice(world: World, actor: Actor, mode: IdleMode): void {
  if (mode !== 'still' && mode !== 'pant' && mode !== 'purr') {
    return;
  }
  if (actor.asleep || actor.bark.active || actor.cuddle) {
    return;
  }
  const last = actor.idle.voicedAt;
  if (last != null && world.t - last < idleVoiceCooldown) {
    return;
  }
  if (world.rng() >= idleVoiceChance) {
    return;
  }
  actor.idle.voicedAt = world.t;
  actor.bark = { active: true, t: 0, fired: [false, false], open: 0, sound: true };
}

function goIdle(world: World, actor: Actor): void {
  releaseCarried(world, actor);
  actor.task = taskOf('idle');
  beginIdle(world, actor, 'still');
}

function grantRestEnergy(actor: Actor): void {
  actor.pendingEnergy += collapseWakeEnergy;
  actor.energy = Math.max(actor.energy, Math.min(1, actor.energy + collapseWakeEnergy / 100));
  actor.energyPops += 1;
}

export function takeEnergyPops(actor: Actor): number {
  const count = actor.energyPops;
  actor.energyPops = 0;
  return count;
}

export function takeMoodPops(actor: Actor): number[] {
  const amounts = actor.moodPops;
  actor.moodPops = [];
  return amounts;
}

export function startUserTask(
  world: World,
  actor: Actor,
  task: UserTask,
  roll = 1,
  drop?: Vec,
  flick?: { vx: number; vy: number; vz: number },
): boolean {
  if (actor.collapseLeft > 0 && task !== 'wake') {
    return false;
  }
  if (task === 'wake') {
    actor.asleep = false;
    actor.sleepSec = 0;
    actor.restBonusPaid = false;
    goIdle(world, actor);
    return true;
  }
  if (task === 'sleep') {
    // Walk to the bed when the scene has one, otherwise sleep where the pet stands.
    const bed = nearestPoi(world.scene, 'bed', actor);
    releaseCarried(world, actor);
    actor.asleep = true;
    actor.sleepSec = 0;
    actor.restBonusPaid = false;
    actor.task = taskOf('sleep', bed ? 'go' : 'sleeping');
    actor.task.poi = bed ?? undefined;
    actor.pantT = 0;
    return true;
  }
  // Any other request wakes a sleeper, then continues into that action.
  if (actor.asleep) {
    actor.asleep = false;
    actor.sleepSec = 0;
    actor.restBonusPaid = false;
  }
  // Another request ends Cuddle. A voice rides on top of it, so speak leaves it alone.
  if (task !== 'cuddle' && task !== 'speak' && actor.cuddle) {
    actor.cuddle = null;
  }
  if (task === 'cuddle') {
    releaseCarried(world, actor);
    actor.task = taskOf('cuddle');
    actor.cuddle = newCuddle(actor, world.rng);
    actor.cuddleOut = [];
    actor.pantT = 0;
    return true;
  }
  if (task === 'idle') {
    goIdle(world, actor);
    return true;
  }
  if (task === 'refuse' || task === 'confused') {
    releaseCarried(world, actor);
    actor.task = taskOf('sit', 'refuse');
    actor.face = -actor.face;
    actor.pantT = 0;
    return true;
  }
  if (task === 'signal') {
    releaseCarried(world, actor);
    actor.task = taskOf('sit', 'signal');
    actor.pantT = 0;
    return true;
  }
  if (task === 'potty') {
    const litter = nearestPoi(world.scene, 'litter', actor);
    releaseCarried(world, actor);
    actor.task = taskOf('sit', litter ? 'goto' : '');
    actor.task.poi = litter ?? undefined;
    actor.pantT = 0;
    return true;
  }
  if (task === 'sit' || task === 'paw') {
    releaseCarried(world, actor);
    actor.task = taskOf(task);
    actor.pantT = 0;
    return true;
  }
  if (task === 'speak') {
    // A voice rides on whatever the pet is doing, so the task is left alone.
    actor.bark = { active: true, t: 0, fired: [false, false], open: 0, sound: true };
    return true;
  }
  if (task === 'eat' || task === 'drink') {
    const poi = nearestPoi(world.scene, task === 'eat' ? 'food' : 'water', actor);
    if (!poi || !canBehave(actor, 'eat')) {
      return false;
    }
    releaseCarried(world, actor);
    actor.task = taskOf('eat', 'go', task);
    // The pet uses the bowl from whichever side it arrives on. It stands beside the bowl and faces it,
    // so a pet to the right of the bowl faces left. The scene's own `face` only breaks an exact tie.
    const side = actor.x > poi.x ? -1 : actor.x < poi.x ? 1 : (poi.face ?? 1);
    actor.task.poi = { ...poi, face: side };
    actor.pantT = 0;
    return true;
  }
  if (task === 'fetch') {
    releaseCarried(world, actor);
    if (flick && drop) {
      flickBallAt(world, drop.x, drop.y, flick);
    } else if (drop) {
      dropBallAt(world, drop.x, drop.y, true);
    } else {
      throwFromEdge(world);
    }
    // A play bow often comes first when the toy is offered, most of all for a puppy.
    const profile = profileOf(actor);
    actor.play = newPlay(world, actor, profile, modsOf(actor, profile));
    const bows = breedById(actor.breedId)?.species === 'dog' && world.rng() < profile.bow * (0.5 + 0.5 * actor.energy);
    actor.task = taskOf('fetch', bows ? 'bow' : 'chase');
    actor.pantT = 0;
    return true;
  }
  const reaction = reactionFor(actor.breedId, roll);
  if (reaction == null || !canBehave(actor, reaction)) {
    return false;
  }
  releaseCarried(world, actor);
  if (reaction === 'bark' || reaction === 'purr') {
    actor.bark = { active: true, t: 0, fired: [false, false], open: 0, sound: reaction === 'bark' };
    if (reaction === 'purr') {
      actor.task = taskOf('purr');
    }
    return true;
  }
  actor.task = taskOf(reaction);
  actor.pantT = 0;
  return true;
}

function updateItems(world: World, dt: number): void {
  stepItems(world.items, world.scene, dt);
}

function between(world: World, min: number, max: number): number {
  return min + world.rng() * (max - min);
}

// Choices for one chase, from the seeded stream, the pet's energy and mood, its life stage and its attributes.
function newPlay(world: World, actor: Actor, profile: StageProfile, mods: LocoMods): PlayState {
  const roll = world.rng;
  const misjudges = roll() < profile.tumble * (1.4 - actor.stats.agility);
  return {
    speedFrac: sampleChaseSpeed(roll, actor.energy, actor.mood),
    burstLeft: 0,
    burstIn: nextBurstIn(roll),
    walkToToy: roll() < profile.walkToToy,
    leap: roll() < Math.min(1, profile.leapCatch * mods.daring),
    returns: roll() < 0.55 + 0.45 * actor.stats.obedience,
    bowed: false,
    overshoot: misjudges ? 40 + roll() * 50 : 0,
    tumbled: false,
    stalked: false,
    pounced: false,
  };
}

function profileOf(actor: Actor): StageProfile {
  return stageProfileOf(actor.displayAgeDays, actor.vitality);
}

function modsOf(actor: Actor, profile: StageProfile): LocoMods {
  return locoModsOf(profile, actor.stats, actor.displayWeight);
}

// A change of stage inside a task keeps the task and restarts its clock.
function setStage(actor: Actor, stage: string, hold?: number): void {
  actor.task = { ...actor.task, stage, t: 0, hold };
}

// Leaves the ground. A jump is a vertical offset: the shadow stays down, the legs tuck, and the landing squashes.
function launch(actor: Actor, kind: JumpKind, vz: number, vx?: number, vy?: number): void {
  actor.vz = vz;
  actor.z = Math.max(actor.z, 0.01);
  actor.jumpKind = kind;
  if (vx !== undefined) {
    actor.vx = vx;
    actor.vy = vy ?? 0;
  }
}

// Jumps from here onto a toy. The pet is already on the toy's depth; the arc is sideways.
function pounceAt(world: World, actor: Actor, toy: Item, reach: number): boolean {
  if (actor.jump || Math.abs(toy.y - actor.y) > 18) {
    return false;
  }
  const dir = toy.x >= actor.x ? 1 : -1;
  actor.face = dir;
  const landX = toy.x - dir * reach * 0.75;
  // The stalk already wiggled, so the jump crouches without a second one.
  return jump(actor, { targetX: landX, wiggle: false, reduced: world.reducedMotion });
}

function windDown(world: World, actor: Actor, profile: StageProfile): Task {
  const young = profile.maxSpeed < 1 && profile.bow >= 0.6;
  const old = profile.maxSpeed < 0.9;
  let stage = '';
  if (actor.stamina < 0.45 || ((young || old) && world.rng() < 0.55)) {
    // After hard play a tired puppy or senior flops down.
    stage = 'flop';
  }
  if (breedById(actor.breedId)?.species === 'cat') {
    stage = stage === 'flop' ? 'flop' : world.rng() < 0.5 ? 'groom' : '';
  }
  return taskOf('winddown', stage);
}

function startZoom(actor: Actor, legs = 4): void {
  actor.zoom = { leg: 0, legs, first: -1 };
}

// Whether a pet bursts into a lap of the stage: lively, rested, and old enough to be fast.
function wantsZoom(world: World, actor: Actor, profile: StageProfile, scale = 1): boolean {
  if (world.reducedMotion || actor.stamina < 0.5 || !isGaitAllowed('canter', maxGaitOf(profile, actor.tired))) {
    return false;
  }
  const chance = profile.zoomies * (0.25 + 0.75 * actor.energy) * (0.5 + 0.5 * actor.mood) * scale;
  return world.rng() < chance;
}

// The next corner of a lap at full speed. Returns null when the lap is done.
function zoomWaypoint(actor: Actor, floor: { xMin: number; xMax: number; yMin: number; yMax: number }, range: { lo: number; hi: number }): Vec | null {
  const zoom = actor.zoom;
  if (!zoom) {
    return null;
  }
  const corners: Vec[] = [
    { x: range.hi, y: floor.yMax - 6 },
    { x: range.lo, y: floor.yMax - 6 },
    { x: range.lo, y: floor.yMin + 6 },
    { x: range.hi, y: floor.yMin + 6 },
  ];
  if (zoom.first < 0) {
    // Start toward the nearest corner so the lap begins without a turnaround.
    zoom.first = corners.reduce(
      (best, corner, index) =>
        Math.hypot(corner.x - actor.x, corner.y - actor.y) < Math.hypot(corners[best].x - actor.x, corners[best].y - actor.y) ? index : best,
      0,
    );
  }
  const first = zoom.first;
  const target = corners[(first + zoom.leg) % 4];
  if (Math.hypot(target.x - actor.x, target.y - actor.y) < 40) {
    zoom.leg += 1;
  }
  if (zoom.leg >= zoom.legs) {
    actor.zoom = null;
    return null;
  }
  return corners[(first + zoom.leg) % 4];
}

function poseTargets(actor: Actor): Pose {
  return {
    ...defaultPose(),
    walk: actor.speed > 14 ? 1 : 0,
  };
}

function steerDirection(
  actor: Actor,
  limit: number,
  targets: Pose,
  reduced: boolean,
): { move: Vec | null; vmax: number; wagRate: number; faceCamera: boolean } {
  const direction = actor.direction;
  if (!direction) {
    return { move: null, vmax: 0, wagRate: 5, faceCamera: false };
  }
  const pose = direction.pose;
  let move = direction.target;
  let vmax = limit * direction.pace;
  let wagRate = 6;
  let faceCamera = false;
  const arrived = move != null && Math.hypot(move.x - actor.x, move.y - actor.y) < 10 && actor.speed < 16;
  const traveling = pose === 'walk' || pose === 'run' || pose === 'sniff' || pose === 'stalk';
  if (!traveling || arrived) {
    move = null;
    vmax = 0;
  }
  if (pose === 'sniff' && arrived) {
    targets.headDown = 1;
    targets.wagAmp = 0.2;
  }
  if (pose === 'stalk') {
    targets.stalk = 1;
    targets.crouch = 0.55;
    if (!arrived) {
      vmax = limit * Math.min(direction.pace, 0.32);
    }
  }
  if (pose === 'sit' || pose === 'celebrate' || pose === 'pant' || pose === 'paw') {
    targets.sit = 1;
    faceCamera = true;
  }
  if (pose === 'celebrate') {
    targets.wagAmp = 0.7;
    wagRate = 14;
  }
  if (pose === 'pant') {
    targets.pant = 1;
    targets.breathAmp = 0.05;
    targets.breathRate = 2.5;
  }
  if (pose === 'paw') {
    targets.paw = 1;
    targets.wagAmp = 0.4;
  }
  if (pose === 'bow') {
    targets.bow = 1;
    targets.wagAmp = 0.65;
    wagRate = 16;
  }
  if (pose === 'sleep') {
    targets.lie = 1;
    targets.headRest = 1;
    targets.eyes = 1;
    targets.wagAmp = 0;
  }
  if ((pose === 'jump' || pose === 'pounce') && !actor.jump && actor.z <= 0 && actor.directionJump !== direction.token) {
    actor.directionJump = direction.token;
    // Keep the speed the pet already has. A directed hop is not the long fetch leap.
    const plan = resolveJump(actor, { reduced, fast: true });
    const carry = actor.vx * (plan?.airTime ?? 0.4);
    jump(actor, {
      reduced,
      fast: true,
      targetX: Math.abs(carry) > 6 ? actor.x + carry : actor.x,
    });
  }
  return { move, vmax, wagRate, faceCamera };
}

function beginCollapse(world: World, actor: Actor): void {
  releaseCarried(world, actor);
  actor.asleep = true;
  actor.task = taskOf('sleep', 'sleeping');
  actor.collapseLeft = collapseSleepSec;
  actor.pantT = 0;
  actor.play = null;
  actor.zoom = null;
  cancelJump(actor);
}

function finishCollapse(world: World, actor: Actor): void {
  actor.collapseLeft = 0;
  actor.asleep = false;
  grantRestEnergy(actor);
  goIdle(world, actor);
}

function spawnHearts(actor: Actor, world: World): void {
  if (!GREET.HEARTS || world.reducedMotion) {
    return;
  }
  for (let i = 0; i < 3; i += 1) {
    actor.hearts.push({ x: (world.rng() - 0.5) * 28, y: -36 - world.rng() * 16, t: 0, life: 0.7 + world.rng() * 0.3 });
  }
}

function playGreetSound(world: World, actor: Actor, breedId: string, ageDays: number, kind: NonNullable<import('./types').GreetStep['sound']>): void {
  const clip = greetClip(kind);
  const breed = breedById(breedId);
  const rate = (breed ? voiceRate(breed, growthFor(ageDays).scale) : 1) * clip.rate;
  if (world.sounds.length < 8) {
    world.sounds.push({ actorId: actor.id, sound: clip.sound, rate });
  }
  if (clip.jaw) {
    actor.bark = { active: true, t: 0, fired: [true, true], open: 0, sound: false };
  }
}

function greetPoint(world: World, actor: Actor, step: import('./types').GreetStep): Vec | null {
  const move = step.move;
  if (!move) {
    return null;
  }
  const floor = world.scene.floor;
  const home = homeOf(world.scene);
  if ('dx' in move) {
    return { x: actor.x + move.dx, y: actor.y + (move.dy ?? 0) };
  }
  if (move.to === 'center') {
    return home;
  }
  if (move.to === 'front') {
    return { x: home.x, y: floor.yMax };
  }
  if (move.to === 'left') {
    return { x: floor.xMin + 30, y: actor.y };
  }
  if (move.to === 'right') {
    return { x: floor.xMax - 30, y: actor.y };
  }
  if (move.to === 'offLeft') {
    return { x: floor.xMin - 90, y: actor.y };
  }
  if (move.to === 'offRight') {
    return { x: floor.xMax + 90, y: actor.y };
  }
  if (move.to === 'offEdge') {
    const left = floor.xMin - 90;
    const right = floor.xMax + 90;
    return { x: Math.abs(actor.x - left) <= Math.abs(actor.x - right) ? left : right, y: actor.y };
  }
  const food = poiOf(world.scene, 'food');
  return food ? { x: food.x, y: food.y } : home;
}

function faceGreet(actor: Actor, step: import('./types').GreetStep, at: Vec | null): boolean {
  const before = actor.face >= 0 ? 1 : -1;
  let next = before;
  const command = step.face ?? (step.move && !step.spin ? 'toward' : 'keep');
  if (command === 'flip') {
    next = before === 1 ? -1 : 1;
  } else if (command === 1 || command === -1) {
    next = command;
  } else if (command === 'toward' && at && Math.abs(at.x - actor.x) > 20) {
    next = at.x >= actor.x ? 1 : -1;
  }
  if (next !== before) {
    actor.face = next;
    return true;
  }
  return false;
}

function armGreet(world: World, actor: Actor, run: NonNullable<Task['greet']>, step: import('./types').GreetStep): void {
  if (step.hop) {
    actor.vz = step.hop;
    actor.z = Math.max(actor.z, 0.01);
    run.hopAir = (2 * step.hop) / gravity;
  }
  if (step.sound) {
    playGreetSound(world, actor, actor.breedId, actor.displayAgeDays, step.sound);
  }
  if (step.hearts) {
    spawnHearts(actor, world);
  }
  if (step.toy === 'pickup') {
    const pool = world.toyPool && world.toyPool.length > 0 ? world.toyPool : ['ball'];
    world.toyKind = pool[Math.floor(world.rng() * pool.length)] ?? 'ball';
    world.items = [makeToyItem(world, { state: 'carried', holderId: actor.id, x: actor.x, y: actor.y })];
  } else if (step.toy === 'drop') {
    releaseCarried(world, actor);
  }
  if (step.spin) {
    const home = (actor.face >= 0 ? 1 : -1) as 1 | -1;
    const away = (home === 1 ? -1 : 1) as 1 | -1;
    const air = Math.max(0.25, run.hopAir || step.dur * actor.pace);
    actor.face = away;
    actor.yawFace = away;
    actor.lead = 0;
    actor.spin = { rate: (Math.PI * 2) / (0.9 * air), far: baseYaw(away), home, returned: false };
  }
}

function runGreet(world: World, actor: Actor, dt: number, targets: Pose, limit: number): { move: Vec | null; vmax: number; wagRate: number } {
  const run = actor.task.greet;
  if (!run) {
    return { move: null, vmax: 0, wagRate: 5 };
  }
  if (run.delay > 0) {
    run.delay = Math.max(0, run.delay - dt);
    (Object.keys(targets) as (keyof Pose)[]).forEach((key) => {
      targets[key] = actor.pose[key];
    });
    run.faceCam = actor.pose.faceCam;
    run.headFront = actor.pose.headFront;
    run.march = false;
    return { move: null, vmax: 0, wagRate: 5 };
  }
  const step = run.steps[run.index];
  if (!step) {
    if (run.storeId) {
      actor.pendingGreetId = run.storeId;
    }
    actor.spin = null;
    world.greetLabel = undefined;
    goIdle(world, actor);
    return { move: null, vmax: 0, wagRate: 5 };
  }
  const at = greetPoint(world, actor, step);
  if (!run.armed) {
    if (step.spin && (actor.turning || actor.lead > 0)) {
      run.phase = 'wait';
    } else {
    const changed = step.spin ? false : faceGreet(actor, step, at);
    run.armed = true;
    run.patUsed = false;
    run.hopAir = 0;
    if (changed) {
      run.phase = 'wait';
    } else {
      armGreet(world, actor, run, step);
      run.phase = 'run';
      run.stepT = 0;
    }
    }
  } else if (run.phase === 'wait' && !actor.turning && actor.lead <= 0 && !step.spin) {
    armGreet(world, actor, run, step);
    run.phase = 'run';
    run.stepT = 0;
  }
  if (run.phase === 'run') {
    run.stepT += dt;
  }
  const pose = { ...defaultPose(), ...step.pose };
  (Object.keys(pose) as (keyof Pose)[]).forEach((key) => {
    if (key === 'breathAmp' || key === 'breathRate') {
      return;
    }
    targets[key] = pose[key];
  });
  targets.wagAmp = step.wag?.amp ?? defaultPose().wagAmp;
  run.poseRates = step.rate;
  run.faceCam = step.pose?.faceCam ?? 0;
  run.headFront = step.pose?.headFront ?? 0;
  const vocal = run.phase === 'run' && !!step.sound && greetClip(step.sound).jaw;
  targets.faceFront = vocal || actor.bark.active ? 1 : 0;
  run.march = run.phase === 'run' && !!step.march;
  run.patWindow = !!step.patWindow;
  run.skid = !!step.skid && run.phase === 'run';
  const dur = step.dur * actor.pace + run.extra;
  const limitDur = run.hopAir > 0 ? Math.max(dur, run.hopAir + 0.05) : dur;
  const arrived = at != null && Math.hypot(at.x - actor.x, at.y - actor.y) < 14 && actor.speed < 20;
  const finished = run.phase === 'run' && run.stepT >= limitDur;
  const arrivedEarly = run.phase === 'run' && !!step.untilArrive && arrived && run.stepT > 0.05;
  if (finished || arrivedEarly) {
    run.index += 1;
    run.stepT = 0;
    run.extra = 0;
    run.armed = false;
    run.phase = 'run';
    run.hopAir = 0;
  }
  const moving = run.phase === 'run' && at != null && !arrived;
  const speed = step.move ? limit * step.move.speed : 0;
  const wagRate = step.wag?.rate ?? 5;
  if (run.skid && step.untilArrive && run.stepT > limitDur * 0.6) {
    targets.skid = 1;
  }
  return { move: moving ? at : null, vmax: moving ? speed : 0, wagRate };
}

export function beginGreeting(world: World, actor: Actor, plan: GreetPlan): void {
  const sleeping = actor.asleep || actor.task.type === 'sleep';
  if (sleeping) {
    actor.asleep = false;
    actor.sleepSec = 0;
    actor.restBonusPaid = false;
  }
  goIdle(world, actor);
  if (plan.start === 'bed') {
    const bed = poiOf(world.scene, 'bed');
    if (bed) {
      actor.x = bed.x;
      actor.y = bed.y;
    }
    actor.pose = { ...actor.pose, lie: 1, headRest: 1, eyes: 1 };
  } else if (plan.start === 'edge') {
    const floor = world.scene.floor;
    const left = floor.xMin - 90;
    const right = floor.xMax + 90;
    const useLeft = Math.abs(actor.x - left) <= Math.abs(actor.x - right);
    actor.x = useLeft ? left : right;
    actor.face = useLeft ? 1 : -1;
    actor.yawFace = useLeft ? 1 : -1;
    actor.yaw = baseYaw(actor.face);
    actor.lead = 0;
    actor.turning = false;
  }
  actor.vx = 0;
  actor.vy = 0;
  actor.task = taskOf('greet');
  actor.task.ownsFacing = true;
  actor.task.greet = {
    steps: plan.steps,
    index: 0,
    stepT: 0,
    extra: 0,
    delay: GREET.START_DELAY,
    storeId: plan.storeId,
    phase: 'delay',
    armed: false,
    patUsed: false,
    march: false,
    faceCam: 0,
    headFront: 0,
    patWindow: false,
    move: null,
    speed: 0,
    untilArrive: false,
    hopAir: 0,
    skid: false,
  };
  world.greetLabel = plan.label;
}

export function patGreeting(world: World, actor: Actor): 'bonus' | 'repeat' | 'interrupt' | 'none' {
  const run = actor.task.type === 'greet' ? actor.task.greet : undefined;
  if (!run) {
    return 'none';
  }
  if (!run.patWindow) {
    return 'interrupt';
  }
  const kind = breedById(actor.breedId)?.species === 'cat' ? 'purr' : 'whine';
  playGreetSound(world, actor, actor.breedId, actor.displayAgeDays, kind);
  spawnHearts(actor, world);
  if (!run.patUsed) {
    run.patUsed = true;
    run.extra += 1.2;
    return 'bonus';
  }
  return 'repeat';
}

export function takePendingGreeting(actor: Actor): string | null {
  const id = actor.pendingGreetId;
  actor.pendingGreetId = null;
  return id;
}

export function debugFlipFace(actor: Actor): void {
  actor.face = actor.face >= 0 ? -1 : 1;
}

export function debugGreeting(world: World, actor: Actor, id: string, ageDays: number, vitality: number, energy: number): void {
  const plan = scriptFor(id, ageDays, vitality, energy, world.rng);
  if (plan) {
    beginGreeting(world, actor, plan);
  }
}

export { planGreeting };

function updateActor(world: World, actor: Actor, dt: number): void {
  const breed = breedById(actor.breedId);
  if (!breed) {
    return;
  }
  if (actor.collapseLeft > 0) {
    actor.collapseLeft = Math.max(0, actor.collapseLeft - dt);
    if (actor.collapseLeft <= 0) {
      finishCollapse(world, actor);
    }
  } else if (!actor.asleep && actor.energy * 100 + actor.pendingEnergy <= 0) {
    beginCollapse(world, actor);
  }
  if (actor.asleep && actor.collapseLeft <= 0 && actor.task.type === 'sleep' && actor.task.stage === 'sleeping') {
    actor.sleepSec += dt;
    if (!actor.restBonusPaid && actor.sleepSec >= collapseSleepSec) {
      actor.restBonusPaid = true;
      grantRestEnergy(actor);
    }
  }
  const floor = world.scene.floor;
  const motion = motionMods(actor.displayAgeDays, actor.vitality, actor.energy * 100);
  actor.pace = motion.pace;
  actor.hopScale = motion.hop;
  actor.hearts = actor.hearts.filter((heart) => {
    heart.t += dt;
    return heart.t < heart.life;
  });
  actor.task.t += dt;
  actor.task.cool = Math.max(0, actor.task.cool - dt);
  actor.displayAgeDays = easeDisplay(actor.displayAgeDays, actor.ageDays, dt);
  actor.displayWeight = easeDisplay(actor.displayWeight, actor.weight, dt);
  const profile = profileOf(actor);
  const mods = modsOf(actor, profile);
  actor.land = Math.max(0, actor.land - dt / landSeconds);
  // Greeting hops and the small play pops still integrate here. A phase jump owns its own arc.
  if (!actor.jump && (actor.z > 0 || actor.vz !== 0)) {
    actor.vz -= gravity * dt;
    actor.z += actor.vz * dt;
    if (actor.z <= 0) {
      // Landing: a hard, heavy landing absorbs more (the body dips and the legs bend).
      const mass = 0.65 + 0.5 * breed.size + 0.4 * Math.max(0, actor.displayWeight);
      actor.land = Math.max(actor.land, Math.min(1, landImpact(actor.vz, mass)));
      actor.z = 0;
      actor.vz = 0;
      actor.jumpKind = null;
    }
  }
  const frame = bodyFrame(
    breed,
    actor.displayAgeDays,
    actor.displayWeight,
    actor.vitality,
    actor.pose,
    actor.bark.open,
    actor.phase,
    actor.x,
    actor.y,
    actor.face,
    floor,
    actor.speed,
    actor.gait,
    actor.share,
  );
  actor.mouth = frame.mouth;
  const face = headFaceOf(breed, frame.geom, actor.pose.headTurn, actor.pose.faceFront);
  actor.anchors = {
    head: {
      x: frame.head.x,
      y: frame.head.y,
      pitch: frame.pitch,
      radius: frame.geom.headR,
      nearEye: face.nearEye,
      farEye: face.farEye,
      farEyeAlpha: face.farEyeAlpha,
      top: face.top,
    },
    neck: { x: frame.geom.bodyLen / 2 - 14, y: frame.geom.bodyY - 2 },
    torso: { theta: frame.theta, dy: frame.dy, pivot: { x: frame.geom.Px, y: frame.geom.Py } },
    paws: actor.anchors.paws,
    scale: frame.scale,
    facing: actor.face >= 0 ? 1 : -1,
  };
  const targets = poseTargets(actor);
  let move: Vec | null = null;
  let vmax = 0;
  let wagRate = 5;
  // Set by the idle and sitting states that may show the 3/4 head. The gate below can still veto it.
  let faceCamera = false;
  // The pet's own top speed, from its life stage, attributes and weight. A tired or elderly pet is held to a
  // slower gait, which caps how fast it may be sent. Energy scales how much of that age speed it actually uses:
  // zoomy is already a run for the age, and a full bar is a sprint.
  const topSpeed = speedMax(breed, actor.displayAgeDays, actor.displayWeight) * mods.maxSpeed;
  const maxGait = maxGaitOf(profile, actor.tired);
  const limit = topSpeed * gaitSpeedCap[maxGait] * energySpeedScale(actor.energy);
  const cat = breed.species === 'cat';

  if (actor.speed > weightRunSpeed) {
    actor.weight = clamp(actor.weight - weightBurnPerSec * dt, -1, 1);
  }

  if (actor.task.type === 'greet' && actor.task.greet) {
    const steered = runGreet(world, actor, dt, targets, limit);
    move = steered.move;
    vmax = steered.vmax;
    wagRate = steered.wagRate;
  } else if (actor.direction) {
    const directed = steerDirection(actor, limit, targets, world.reducedMotion);
    move = directed.move;
    vmax = directed.vmax;
    wagRate = directed.wagRate;
    faceCamera = directed.faceCamera;
  } else if (actor.task.type === 'travel' && actor.task.poi) {
    move = { x: actor.task.poi.x, y: actor.task.poi.y };
    vmax = clamp(limit * 0.7, 170, 240);
    wagRate = 10;
    if (actor.task.stage === 'enter' && Math.hypot(actor.task.poi.x - actor.x, actor.task.poi.y - actor.y) < 8 && actor.speed < 16) {
      goIdle(world, actor);
    }
  } else if (actor.task.type === 'idle') {
    actor.idle.t += dt;
    if (actor.idle.mode === 'zoom') {
      wagRate = 14;
      const range = xRangeOf(floor, frame.geom, frame.scale);
      const waypoint = zoomWaypoint(actor, floor, range);
      if (waypoint) {
        move = waypoint;
        vmax = limit;
      } else {
        actor.zoom = null;
        beginIdle(world, actor, 'still');
      }
    } else if (actor.idle.mode === 'walk') {
      if (!actor.idle.target) {
        actor.idle.target = {
          x: floor.xMin + 22 + world.rng() * (floor.xMax - floor.xMin - 44),
          y: floor.yMin + world.rng() * (floor.yMax - floor.yMin),
        };
      }
      move = actor.idle.target;
      // A zoomy pet crosses the room near the top of its age speed. A tired one ambles.
      vmax = limit * 0.82;
      const arrived =
        actor.idle.target != null &&
        Math.hypot(actor.idle.target.x - actor.x, actor.idle.target.y - actor.y) < 6 &&
        actor.speed < 14;
      if (arrived || actor.idle.t > actor.idle.dur) {
        nextIdle(world, actor);
      }
    } else {
      if (actor.idle.mode === 'pant') {
        targets.pant = 1;
        targets.breathAmp = 0.05;
        targets.breathRate = 2.5;
        targets.wagAmp = 0.12;
        targets.sit = actor.idle.sit ? 1 : 0;
      } else if (actor.idle.mode === 'purr') {
        targets.squint = 0.7;
        targets.breathAmp = 0.03;
        targets.breathRate = 3;
        targets.sit = 1;
        targets.wagAmp = 0.1;
      } else if (actor.idle.mode === 'nap') {
        if (!actor.idle.arrived && actor.idle.target) {
          move = actor.idle.target;
          vmax = limit * 0.42;
          if (Math.hypot(actor.idle.target.x - actor.x, actor.idle.target.y - actor.y) < 5 && actor.speed < 15) {
            actor.idle.arrived = true;
            actor.idle.t = 0;
          }
        } else {
          targets.lie = 1;
          targets.headRest = 1;
          targets.eyes = 1;
          targets.wagAmp = 0;
          targets.breathAmp = 0.03;
          targets.breathRate = 0.35;
        }
      }
      if (actor.idle.mode === 'still' || actor.idle.mode === 'pant' || actor.idle.mode === 'purr') {
        faceCamera = true;
      }
      if (actor.idle.arrived && actor.idle.t > actor.idle.dur) {
        nextIdle(world, actor);
      }
    }
  } else if (actor.task.type === 'sit') {
    targets.sit = 1;
    targets.wagAmp = 0.3;
    if (actor.task.stage === 'refuse') {
      if (actor.task.t > 1.4) {
        goIdle(world, actor);
      }
    } else if (actor.task.stage === 'signal') {
      targets.crouch = 0.55;
      targets.sit = 0.3;
      const angle = actor.task.t * 1.6;
      move = { x: actor.x + Math.cos(angle) * 28, y: actor.y + Math.sin(angle) * 14 };
      vmax = limit * 0.28;
    } else if (actor.task.stage === 'goto' && actor.task.poi) {
      move = { x: actor.task.poi.x, y: actor.task.poi.y };
      vmax = limit * 0.45;
      if (Math.hypot(actor.task.poi.x - actor.x, actor.task.poi.y - actor.y) < 18) {
        actor.task = taskOf('sit');
      }
    } else {
      faceCamera = true;
    }
  } else if (actor.task.type === 'paw') {
    targets.sit = 1;
    targets.wagAmp = 0.45;
    targets.paw = actor.task.t > 0.7 && actor.task.t < 3.7 ? 1 : 0;
    if (actor.task.t > 4.2) {
      actor.task = taskOf('sit');
    }
  } else if (actor.task.type === 'purr' || actor.task.type === 'groom') {
    targets.sit = 1;
    targets.squint = 0.7;
    targets.breathAmp = 0.03;
    targets.breathRate = 3;
    if (actor.task.t > 3) {
      goIdle(world, actor);
    }
  } else if (actor.task.type === 'sleep') {
    const bed = actor.task.poi ?? poiOf(world.scene, 'bed');
    if (actor.task.stage === 'go' && bed) {
      move = { x: bed.x, y: bed.y };
      vmax = limit * 0.5;
      if (Math.hypot(bed.x - actor.x, bed.y - actor.y) < 5 && actor.speed < 15) {
        actor.task.stage = 'sleeping';
      }
    } else {
      targets.lie = 1;
      targets.headRest = 1;
      targets.eyes = 1;
      targets.wagAmp = 0;
      targets.breathAmp = 0.03;
      targets.breathRate = 0.35;
    }
  } else if (actor.task.type === 'winddown' && actor.task.stage === 'flop') {
    // Flops down and pants, or purrs.
    targets.lie = 1;
    targets.headDown = 0.3;
    targets.wagAmp = 0.15;
    targets.breathAmp = 0.05;
    targets.breathRate = cat ? 3 : 5;
    if (cat) {
      targets.squint = 0.7;
    } else {
      targets.pant = 1;
    }
    if (actor.task.t > 5) {
      goIdle(world, actor);
    }
  } else if (actor.task.type === 'winddown' && actor.task.stage === 'groom') {
    // A cat sits and washes after play.
    targets.sit = 1;
    targets.squint = 0.7;
    targets.paw = actor.task.t > 0.5 ? 1 : 0;
    targets.breathAmp = 0.03;
    targets.breathRate = 3;
    if (actor.task.t > 4.5) {
      goIdle(world, actor);
    }
  } else if (actor.task.type === 'winddown') {
    faceCamera = true;
    targets.sit = 1;
    targets.wagAmp = 0.3;
    if (cat) {
      targets.squint = 0.7;
      targets.breathAmp = 0.03;
      targets.breathRate = 3;
    } else {
      targets.pant = 1;
      targets.breathAmp = 0.05;
      targets.breathRate = 5;
    }
    if (actor.task.t > 5) {
      goIdle(world, actor);
    }
  } else if (actor.task.type === 'eat') {
    const poi = actor.task.poi ?? poiOf(world.scene, actor.task.kind === 'drink' ? 'water' : 'food');
    let face: 1 | -1 = poi?.face ?? 1;
    const standOff = frame.scale * (frame.geom.bodyLen / 2 + 34);
    const range = xRangeOf(world.scene.floor, frame.geom, frame.scale);
    // A bowl near the stage edge: if the pet can't stand on its arriving side, use the other one.
    if (poi && actor.task.stage === 'go') {
      const x = poi.x - face * standOff;
      if (x < range.lo || x > range.hi) {
        face = face > 0 ? -1 : 1;
        if (actor.task.poi) {
          actor.task.poi = { ...actor.task.poi, face };
        }
      }
    }
    const spot = poi ? { x: poi.x - face * standOff, y: poi.y } : null;
    if (actor.task.stage === 'go' && spot) {
      move = spot;
      vmax = limit * 0.5;
      if (Math.hypot(spot.x - actor.x, spot.y - actor.y) < 4 && actor.speed < 15) {
        actor.task = { ...actor.task, stage: 'eating', t: 0 };
        actor.face = face;
        // Stand exactly on the spot so the head lands on the bowl and the pet sorts in front of it.
        actor.x = spot.x;
        actor.y = spot.y;
        actor.vx = 0;
        actor.vy = 0;
        actor.speed = 0;
      }
    } else if (spot) {
      targets.headDown = 1;
      targets.wagAmp = 0.35;
      actor.face = face;
      if (actor.task.t > 6) {
        if (actor.task.kind === 'drink' && hasRefillableBowl(world.scene)) {
          world.pendingBowlDrinks += 1;
        }
        if (actor.task.kind !== 'drink' && world.foodStocked) {
          world.pendingMeals += 1;
          world.foodStocked = false;
        }
        goIdle(world, actor);
      }
    } else {
      goIdle(world, actor);
    }
  } else if (actor.task.type === 'cuddle') {
    const step = stepCuddle(world, actor, dt, limit, targets);
    move = step.move;
    vmax = step.vmax;
    wagRate = step.wagRate;
    faceCamera = step.faceCamera;
    if (step.done) {
      actor.cuddleOut.push({ type: 'done', petted: actor.cuddle?.petted ?? 0 });
      actor.cuddle = null;
      goIdle(world, actor);
    }
  } else if (actor.task.type === 'fetch') {
    if (!actor.play) {
      actor.play = newPlay(world, actor, profile, mods);
    }
    const play = actor.play;
    const task = actor.task;
    const stage = task.stage;
    targets.wagAmp = 0.5;
    wagRate = 9;
    const reach = reachOf(frame.geom) * frame.scale;
    const toy = freeToy(world) ?? carriedBy(world, actor.id);
    const toyKind = toy?.kind ?? world.toyKind ?? 'ball';
    const allows = (behavior: PlayBehavior): boolean => toyAllows(cat ? 'cat' : 'dog', toyKind, behavior);
    const dir = toy ? (toy.x >= actor.x ? 1 : -1) : actor.face;
    const toyDist = toy ? Math.hypot(toy.x - actor.x, toy.y - actor.y) : 0;
    const mouthH0 = actor.y - actor.mouth.y;
    const faceToy = (): void => {
      if (toy && Math.abs(toy.x - actor.x) > 4) {
        actor.face = dir;
      }
    };
    const rangeNow = xRangeOf(floor, frame.geom, frame.scale);

    if (!toy) {
      goIdle(world, actor);
    } else if (stage === 'bow') {
      // Play bow: front legs fold, chest low, rump up, tail wagging fast. Hold, then bounce up.
      targets.bow = 1;
      targets.wagAmp = 0.65;
      wagRate = 18;
      task.hold ??= between(world, bowHold.min, bowHold.max);
      faceToy();
      if (task.t > task.hold) {
        launch(actor, 'hop', jumpSpeed(jumpHeights.hop * Math.max(0.5, mods.jumpHeight)));
        play.bowed = true;
        setStage(actor, 'chase');
      }
    } else if (stage === 'chase') {
      // Speed varies per chase: a sampled pace, now and then a burst, and a slow approach to the toy.
      play.burstIn -= dt;
      play.burstLeft = Math.max(0, play.burstLeft - dt);
      if (play.burstIn <= 0) {
        play.burstIn = nextBurstIn(world.rng);
        if (!play.walkToToy && actor.stamina > 0.25 && world.rng() < profile.burst * (0.35 + 0.65 * actor.energy)) {
          play.burstLeft = burstLength(world.rng);
        }
      }
      const pace = play.walkToToy ? 0.4 : play.burstLeft > 0 ? 1 : play.speedFrac;
      const approach = 0.45 + 0.55 * clamp((toyDist - 25) / 120, 0, 1);
      const toyMoving = Math.hypot(toy.vx, toy.vy) > 40 || toy.z > 6;
      let leaping = false;

      if (toy.state === 'free') {
        // Face the toy when that is the way the body is moving, or once the pet has nearly stopped.
        // A slide the other way keeps the old face until horizontal speed comes around.
        if (dir !== actor.face && actor.vx * dir > -faceDeadzone) {
          actor.face = dir;
        }
        // Leap-catch: predict where the toy comes down through the catch height and time the jump to meet it.
        if (!cat && play.leap && allows('leapCatch') && toy.z > 18 && actor.z === 0 && !actor.jump) {
          const ceiling = resolveJump(actor, { reduced: world.reducedMotion })?.heightPx ?? 0;
          const catchZ = mouthH0 + ceiling * 0.7;
          const needed = Math.max(6, catchZ - mouthH0);
          const plan = ceiling > 10 ? resolveJump(actor, { reduced: world.reducedMotion, heightPx: needed }) : null;
          const crossing = plan ? predictCrossing(toy, world.scene, catchZ, 2.5) : null;
          if (crossing && plan && crossing.t > 0.1) {
            const side = crossing.x >= actor.x ? 1 : -1;
            const spot = { x: crossing.x - side * reach * 0.8, y: crossing.y };
            const rise = plan.airTime / 2;
            move = spot;
            vmax = limit;
            leaping = true;
            if (
              Math.abs(spot.y - actor.y) < 18 &&
              Math.hypot(spot.x - actor.x, spot.y - actor.y) < 26 &&
              crossing.t <= rise + plan.prep + 0.04
            ) {
              actor.face = side;
              jump(actor, { targetX: spot.x, heightPx: needed, reduced: world.reducedMotion });
            }
          }
        }
        // A cat stalks a toy that is lying still, then pounces.
        if (cat && allows('stalk') && !play.stalked && !toyMoving && toyDist > 60 && toyDist < 280 && actor.z === 0) {
          play.stalked = true;
          setStage(actor, 'stalk');
        } else if (!cat && allows('pounce') && !play.pounced && !toyMoving && toyDist > 35 && toyDist < 110 && actor.z === 0 && !actor.jump) {
          // A playful dog pounces on a toy that is lying still, once it is on the toy's depth.
          if (pounceAt(world, actor, toy, reach)) {
            play.pounced = true;
            setStage(actor, 'pounce');
          }
        } else if (!cat && !play.bowed && toy.z < 6 && !toyMoving && toyDist < 130 && world.rng() < dt * profile.bow * 0.5) {
          // Now and then a dog stops to bow at a toy that is just lying there.
          setStage(actor, 'bow');
        }
      }

      if (actor.task.stage === 'chase') {
        const ahead = (toy.x - actor.x) * dir;
        const missing = task.cool > 0 && play.overshoot > 0;
        if (!leaping) {
          if (toy.state === 'free') {
            // A misjudged fast approach runs past the toy before coming back.
            const beyond = missing ? play.overshoot : 0;
            move = {
              x: missing ? toy.x + dir * beyond : ahead > reach ? toy.x - dir * reach : actor.x,
              y: toy.y,
            };
            vmax = limit * pace * (missing ? 1 : approach);
          }
        }
        const nearGround = actor.face === dir && ahead >= -2 && ahead <= reach + 10 && Math.abs(actor.y - toy.y) < 10 && toy.z < 16;
        const nearAir =
          actor.z > 6 &&
          actor.face === dir &&
          ahead >= -4 &&
          ahead <= reach + 14 &&
          Math.abs(actor.y - toy.y) < 14 &&
          Math.abs(toy.z - (mouthH0 + actor.z)) < 24;
        const near = toy.state === 'free' && (nearGround || nearAir);
        if (near && !cat && play.overshoot > 0 && !play.tumbled && actor.speed > 0.55 * limit && actor.z === 0) {
          // Too fast to grab it: it overshoots, and a clumsy puppy may tumble.
          play.tumbled = true;
          if (world.rng() < 0.5) {
            setStage(actor, 'tumble', 0.8);
          } else {
            task.cool = 0.8;
          }
        } else if (near && cat && task.cool <= 0) {
          // Bat with a front paw. The toy skips away and the cat hops after it.
          toy.vx = actor.face * (150 + world.rng() * 120);
          toy.vy = (world.rng() - 0.5) * 140;
          toy.vz = 170;
          launch(actor, 'hop', 160);
          task.bats += 1;
          task.cool = 0.5;
          if (toyKind === 'yarn' && task.bats >= 2) {
            setStage(actor, 'roll', between(world, 1.2, 1.8));
          } else if (task.bats >= 3) {
            actor.task = windDown(world, actor, profile);
          }
        } else if (near && !cat && task.cool <= 0) {
          toy.state = 'carried';
          toy.holderId = actor.id;
          if (toyKind === 'squeaky') {
            setStage(actor, 'shake', between(world, 1, 1.5));
          } else if (play.returns) {
            setStage(actor, 'return');
          } else {
            setStage(actor, 'carry', between(world, 0.8, 1.4));
          }
        }
      }
    } else if (stage === 'stalk') {
      // Low crouch, eyes on the toy, creeping closer.
      targets.stalk = 1;
      targets.wagAmp = 0.3;
      wagRate = 10;
      faceToy();
      move = { x: toy.x - dir * (reach + 36), y: toy.y };
      vmax = limit * 0.14;
      if (toyDist < reach + 90 || task.t > 3.2) {
        setStage(actor, 'wiggle', between(world, stalkWiggle.min, stalkWiggle.max));
      }
    } else if (stage === 'wiggle') {
      targets.stalk = 1;
      targets.wiggle = 1;
      targets.wagAmp = 0.5;
      wagRate = 22;
      faceToy();
      if (task.t > (task.hold ?? 1)) {
        if (pounceAt(world, actor, toy, reach)) {
          setStage(actor, 'pounce');
        }
      }
    } else if (stage === 'pounce') {
      faceToy();
      if (!actor.jump && actor.z <= 0 && task.t > 0.12) {
        setStage(actor, 'chase');
      }
    } else if (stage === 'tumble') {
      // A tumble: roll over once and get back up.
      targets.belly = task.t < 0.55 ? 1 : 0;
      targets.paddle = 0.8;
      targets.wagAmp = 0.1;
      if (task.t > (task.hold ?? 0.8)) {
        task.cool = 0;
        setStage(actor, 'chase');
      }
    } else if (stage === 'return') {
      if (toy.state === 'carried' && toy.holderId === actor.id) {
        const home = homeOf(world.scene);
        move = home;
        vmax = limit * (0.45 + 0.3 * play.speedFrac);
        if (Math.hypot(home.x - actor.x, home.y - actor.y) < 8 && actor.speed < 20) {
          releaseCarried(world, actor);
          if (wantsZoom(world, actor, profile, 0.5)) {
            startZoom(actor, 4);
            setStage(actor, 'zoom');
          } else {
            actor.task = windDown(world, actor, profile);
          }
        }
      } else {
        goIdle(world, actor);
      }
    } else if (stage === 'carry') {
      // Keeps the toy for a moment, showing it off, and then drops it.
      targets.wagAmp = 0.6;
      if (task.t > (task.hold ?? 1)) {
        releaseCarried(world, actor);
        actor.task = windDown(world, actor, profile);
      }
    } else if (stage === 'shake') {
      // Shakes the squeaky toy in its mouth.
      targets.headRot = Math.sin(task.t * 11) * 0.3;
      targets.wagAmp = 0.6;
      if (task.t > (task.hold ?? 1.2)) {
        setStage(actor, 'chew', between(world, 2, 3));
      }
    } else if (stage === 'chew') {
      // Flops down and chews.
      targets.lie = 1;
      targets.headDown = 0.5;
      targets.wagAmp = 0.15;
      if (task.t > (task.hold ?? 2.5)) {
        releaseCarried(world, actor);
        actor.task = windDown(world, actor, profile);
      }
    } else if (stage === 'roll') {
      // Rolls onto its side and bunny-kicks the yarn.
      targets.belly = 1;
      targets.paddle = 0.9;
      targets.kick = 0.8;
      targets.wagAmp = 0.3;
      if (task.t > (task.hold ?? 1.5)) {
        if (allows('tangle') && world.rng() < 0.5) {
          setStage(actor, 'tangle', 1);
        } else {
          actor.task = windDown(world, actor, profile);
        }
      }
    } else if (stage === 'tangle') {
      targets.belly = 1;
      targets.paddle = 1;
      targets.wagAmp = 0.5;
      if (task.t > (task.hold ?? 1)) {
        actor.task = windDown(world, actor, profile);
      }
    } else if (stage === 'zoom') {
      // A lap of the stage at full speed.
      wagRate = 14;
      const waypoint = zoomWaypoint(actor, floor, rangeNow);
      if (waypoint) {
        move = waypoint;
        vmax = limit;
      } else {
        actor.task = windDown(world, actor, profile);
      }
    } else {
      goIdle(world, actor);
    }
  }

  actor.bark.open = 0;
  if (actor.bark.active) {
    actor.bark.t += dt;
    const beats = cat ? [{ at: 0, len: 0.55 }] : [{ at: 0, len: 0.2 }, { at: 0.36, len: 0.2 }];
    const voiceLen = 0.7;
    beats.forEach((beat, index) => {
      const local = actor.bark.t - beat.at;
      if (local >= 0 && !actor.bark.fired[index]) {
        actor.bark.fired[index] = true;
        // The jaw still moves on every beat, but the recorded clip plays once per voice.
        if (index === 0 && actor.bark.sound && world.sounds.length < 8) {
          world.sounds.push({
            actorId: actor.id,
            sound: cat ? 'meow' : 'bark',
            rate: voiceRate(breed, growthFor(actor.displayAgeDays).scale),
          });
        }
      }
      if (local >= 0 && local < beat.len) {
        actor.bark.open = Math.max(actor.bark.open, Math.sin((local / beat.len) * Math.PI));
      }
    });
    if (actor.bark.t > voiceLen) {
      actor.bark.active = false;
    }
  }

  // The larger body (head in front, tail behind) sticks out from its anchor, so keep all of it inside the stage.
  // A scene change walks the pet off-screen, so that path is not clamped in x.
  const traveling = actor.task.type === 'travel';
  const { lo: xLo, hi: xHi } = xRangeOf(floor, frame.geom, frame.scale);
  const greetWide = actor.task.type === 'greet';
  const xClampLo = greetWide ? xLo - 110 : xLo;
  const xClampHi = greetWide ? xHi + 110 : xHi;
  if (!actor.task.ownsFacing && reversingTurn(actor)) {
    vmax *= TURN_SPEED;
  }
  const desired = { x: 0, y: 0 };
  if (move && !(actor.jump && jumpOwnsMotion(actor))) {
    const tx = traveling ? move.x : clamp(move.x, xClampLo, xClampHi);
    const ty = clamp(move.y, floor.yMin, floor.yMax);
    const dx = tx - actor.x;
    const dy = ty - actor.y;
    const distance = Math.hypot(dx, dy);
    const speed = Math.min(vmax, distance * 5);
    if (distance > 1) {
      desired.x = (dx / distance) * speed;
      desired.y = (dy / distance) * speed;
    }
  }
  // Velocity eases toward the wish, but no faster than the pet can speed up or brake (agility, weight, age).
  // A jump keeps the velocity it left the ground with.
  if (!(actor.z > 0 && actor.jumpKind) && !(actor.jump && (actor.jump.phase === 'airborne' || actor.jump.phase === 'bounce'))) {
    const ease = 1 - Math.exp(-dt * 7);
    let dvx = (desired.x - actor.vx) * ease;
    let dvy = (desired.y - actor.vy) * ease;
    const braking = desired.x * actor.vx + desired.y * actor.vy < actor.vx * actor.vx + actor.vy * actor.vy;
    const maxStep = (braking ? mods.decel : mods.accel) * dt;
    const step = Math.hypot(dvx, dvy);
    if (step > maxStep) {
      dvx *= maxStep / step;
      dvy *= maxStep / step;
    }
    actor.vx += dvx;
    actor.vy += dvy;
  }
  const nextX = actor.x + actor.vx * dt;
  actor.x = traveling ? nextX : clamp(nextX, xClampLo, xClampHi);
  actor.y = clamp(actor.y + actor.vy * dt, floor.yMin, floor.yMax);
  actor.speed = Math.hypot(actor.vx, actor.vy);
  // A fast stop skids while the body is still sliding the old way.
  const reversing = Math.abs(desired.x) > 20 && desired.x * actor.face < 0 && actor.vx * actor.face > 55;
  targets.skid = reversing && actor.z <= 0 ? clamp(actor.speed / 200, 0.4, 1) : 0;
  if (actor.task.greet?.skid) {
    targets.skid = 1;
  }
  if (!actor.jump) {
    stepFacing(actor, dt, !!actor.task.ownsFacing);
  }
  actor.anchors.facing = actor.face >= 0 ? 1 : -1;
  const greeting = actor.task.type === 'greet';
  const autoCam =
    !greeting && actor.vy > 0 && Math.abs(actor.vy) > 1.5 * Math.abs(actor.vx) ? 0.5 : 0;
  const idleCam = !greeting && faceCamera ? 0.5 : 0;
  targets.faceCam = greeting ? (actor.task.greet?.faceCam ?? 0) : Math.max(autoCam, idleCam);
  if (actor.jump && actor.jump.phase !== 'turn') {
    targets.faceCam = 0;
    actor.pose.faceCam = 0;
  }
  stepYaw(actor, dt, actor.pose.faceCam);
  const seen = visualYaw(actor.yaw);
  const signed = actor.face >= 0 ? 1 : -1;
  const mouthLocal = (actor.mouth.x - actor.x) / (signed * Math.max(frame.scale, 0.01));
  actor.mouth.x = actor.x + seen.dir * frame.scale * mouthLocal;
  targets.walk = actor.speed > 14 || actor.jump?.running ? 1 : 0;
  if (actor.bark.open > 0.05 && targets.eyes > 0) {
    targets.eyes = 0;
  }
  // The 3/4 head is a pose target set by the state machine, vetoed whenever the pet moves or acts.
  // Cuddle may hold the turned head while the pet lies down. It never turns while the pet moves.
  const cuddling = actor.task.type === 'cuddle';
  const stationary =
    move == null && actor.speed <= 14 && actor.z <= 0 && !actor.bark.active && (actor.pose.lie < 0.05 || cuddling);
  const leadHead = actor.lead > 0 || (actor.turning && Math.abs(baseYaw(actor.face) - actor.yaw) > 0.45);
  if (greeting) {
    targets.headTurn = Math.max(actor.task.greet?.headFront ?? 0, leadHead ? 1 : 0);
  } else if (actor.speed > 14) {
    targets.headTurn = 0;
  } else {
    targets.headTurn = faceCamera && stationary ? 1 : 0;
    if (leadHead) {
      targets.headTurn = 1;
    }
  }
  if (actor.jump && actor.jump.phase !== 'turn') {
    targets.headTurn = 0;
    actor.pose.headTurn = 0;
  }
  if (!greeting && actor.speed > 14 && actor.pose.headTurn > 0.15) {
    actor.pose.headTurn = 0.15;
  }
  // Gait: chosen from the speed with hysteresis, blended over ~150 ms, and limited by stamina and age.
  actor.share = topSpeed > 0 ? clamp(actor.speed / topSpeed, 0, 1.2) : 0;
  const nextGait = actor.speed > 14 ? chooseGait(actor.gait.current, actor.share, maxGait) : 'walk';
  stepGait(actor.gait, nextGait, dt);
  const tireState = stepStamina(actor.stamina, actor.tired, actor.gait.current, mods, dt);
  actor.stamina = tireState.stamina;
  actor.tired = tireState.tired;
  // Running or fetch spends need-energy. An idle nap pays it back. User sleep is restored by the needs clock.
  const napping =
    !actor.asleep && actor.task.type === 'idle' && actor.idle.mode === 'nap' && actor.idle.arrived && actor.speed < 15;
  const playing = actor.task.type === 'fetch' || actor.task.type === 'winddown' || actor.task.type === 'travel';
  const onTheMove = actor.speed > 14;
  const busyRate = (rates: { walk: number; trot: number; canter: number; gallop: number; play: number }): number =>
    Math.max(onTheMove ? rates[actor.gait.current] : 0, playing ? rates.play : 0);
  const runRate = busyRate(activityEnergyPerHour);
  const energyPerHour = napping ? decayPerHour.asleep.energy - decayPerHour.awake.energy : actor.asleep ? 0 : -runRate;
  if (energyPerHour !== 0) {
    actor.pendingEnergy += (energyPerHour / 3600) * dt;
  }
  // Moving or playing empties the tummy faster than sitting still, and works up a thirst.
  const hungerPerHour = busyRate(activityHungerPerHour);
  if (hungerPerHour > 0 && !actor.asleep) {
    actor.pendingHunger += (hungerPerHour / 3600) * dt;
  }
  const thirstPerHour = busyRate(activityThirstPerHour);
  if (thirstPerHour > 0 && !actor.asleep) {
    actor.pendingThirst += (thirstPerHour / 3600) * dt;
  }
  // Fetch burns weight even when the pet is too heavy to sprint. A heavier pet works a bit harder.
  if (!actor.asleep && (actor.task.type === 'fetch' || actor.task.type === 'winddown')) {
    const over = clamp((actor.weight - healthyWeightBand) / (1 - healthyWeightBand), 0, 1);
    const rate = playWeightPerHour * (1 + overweightPlayWeightBonus * over);
    actor.weight = clamp(actor.weight - (rate / 3600) * dt, -1, 1);
  }
  const flow = streamOf(actor.gait);
  const moving = actor.speed > 14 && actor.z <= 0 ? 1 : 0;
  targets.stretch = flow.stretch * moving;
  targets.stream = flow.stream * moving;
  targets.tuck = actor.z > 0 && !actor.jump ? 1 : 0;
  // Short hops and landings read as one: the legs come under the body in the air.
  const localSpeed = actor.speed / Math.max(frame.scale, 0.01);
  let cycle = phaseRate(actor.gait, localSpeed, frame.geom.L, actor.share);
  const shuffling = !world.reducedMotion && reversingTurn(actor) && actor.speed < 20 && actor.spin == null;
  if (shuffling) {
    cycle = Math.max(cycle, Math.PI * 2 * 1.6);
    targets.walk = Math.max(targets.walk, 0.5);
  }
  if (actor.task.greet?.march && !world.reducedMotion) {
    cycle = Math.max(cycle, Math.PI * 2 * 1.8);
    targets.walk = Math.max(targets.walk, 0.55);
  }
  actor.pose = easePose(actor.pose, targets, dt, profile.slowStand, actor.task.greet?.poseRates);
  actor.phase += dt * cycle;
  // Match jaw/tongue cadence to breath while panting so a slower idle pant reads as one motion.
  actor.panPh += dt * Math.PI * 2 * (actor.pose.pant > 0.05 ? actor.pose.breathRate : 5);
  actor.chewPh += dt * Math.PI * 2 * 3;
  actor.wagPh += dt * wagRate * (world.reducedMotion ? 0 : 1);
  actor.breathPh += dt * Math.PI * 2 * actor.pose.breathRate;
  actor.blinkT -= dt;
  if (actor.blinkT <= 0) {
    actor.blinkT = world.rng() < 0.18 ? 0.32 : 1.6 + world.rng() * 2.6;
  }
  considerHurdle(world, actor);
  stepJump(actor, dt);
  if (actor.task.type !== 'travel') {
    actor.x = clamp(actor.x, xClampLo, xClampHi);
  }
}

function considerHurdle(world: World, actor: Actor): void {
  if (actor.jump || actor.z > 0 || actor.speed < 50 || actor.asleep) {
    return;
  }
  const busy = actor.task.type;
  if (busy === 'greet' || busy === 'cuddle' || busy === 'sleep' || busy === 'eat') {
    return;
  }
  const face = actor.face >= 0 ? 1 : -1;
  let best: { x: number; h: number; ahead: number } | null = null;
  for (const prop of world.scene.props) {
    if (!prop.hurdle || Math.abs(prop.y - actor.y) > 28) {
      continue;
    }
    const ahead = (prop.x - actor.x) * face;
    if (ahead < 6 || ahead > jumpConfig.hurdleApproach) {
      continue;
    }
    if (!best || ahead < best.ahead) {
      best = { x: prop.x, h: prop.h ?? 22, ahead };
    }
  }
  if (!best) {
    return;
  }
  jump(actor, {
    obstacleHeight: best.h,
    targetX: best.x + face * jumpConfig.hurdlePast,
    fast: true,
    reduced: world.reducedMotion,
  });
}

function updateParticles(world: World, dt: number): void {
  const kind = world.scene.ambient?.particles?.kind;
  if (!kind || world.reducedMotion) {
    return;
  }
  for (const p of world.particles) {
    if (kind === 'rain') {
      p.y += 420 * p.v * dt;
      p.x -= 60 * p.v * dt;
    } else if (kind === 'snow') {
      p.y += 28 * p.v * dt;
      p.x += Math.sin(world.t * 1.2 + p.ph) * 14 * dt;
    } else {
      p.y += 22 * p.v * dt;
      p.x += (14 + Math.sin(world.t * 1.5 + p.ph) * 20) * dt;
    }
    if (p.y > stageHeight + 8) {
      p.y = -8;
      p.x = world.rng() * stageWidth;
    }
    if (p.x > stageWidth + 8) {
      p.x = -8;
    }
    if (p.x < -8) {
      p.x = stageWidth + 8;
    }
  }
}

export function update(world: World, dt: number): void {
  if (dt <= 0) {
    return;
  }
  const step = Math.min(dt * (world.timeScale ?? 1), 0.05);
  world.t += step;
  updateItems(world, step);
  updateParticles(world, step);
  const eating = world.actors.some(
    (actor) => actor.task.type === 'eat' && actor.task.kind !== 'drink' && actor.task.stage === 'eating',
  );
  // The bowl pours in when food is added, empties while the pet eats, and stays empty after.
  world.bowlFill = clamp(world.bowlFill + (eating ? -1 / 6 : world.foodStocked ? 0.8 : -2) * step, 0, 1);
  for (const actor of world.actors) {
    updateActor(world, actor, step);
  }
}
