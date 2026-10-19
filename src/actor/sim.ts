import { weightBurnPerSec, weightRunSpeed } from '../sim/config';
import type { Item } from '../items/types';
import { stepItems } from '../items/physics';
import { inactivePointer } from '../input/pointer';
import { bodyFrame, reachOf, speedMax, stageWidth } from './geometry';
import { breedById, voiceRate } from './breeds';
import { growthFor } from './growth';
import { canBehave, reactionFor, type UserTask } from './behavior';
import { defaultPose, easePose } from './pose';
import { nearestPoi, poiOf, scenes, stageHeight } from './scenes';
import type { Scene } from './scenes';
import type { Actor, ActorSource, Anchors, Idle, IdleMode, Pose, SoundEvent, Task, TaskType, Vec, World } from './types';

const displayTau = 0.35;
const idleWeight: Record<IdleMode, number> = { still: 3, pant: 2, purr: 2, nap: 1.5, walk: 2.5 };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function easeDisplay(current: number, target: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-dt / displayTau));
}

function makeBallItem(partial: Partial<Item> & Pick<Item, 'state'>): Item {
  return {
    id: 'ball-1',
    kind: 'ball',
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

function freeBall(world: World): Item | null {
  return world.items.find((item) => item.kind === 'ball' && item.state === 'free') ?? null;
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
    head: { x: 0, y: 0, pitch: 0, radius: 0 },
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

export function stagePoint(x: number, y: number, viewW: number, viewH: number): Vec {
  return {
    x: (x / Math.max(viewW, 1)) * stageWidth,
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
    vitality: source.vitality,
    equipped: { ...source.equipped },
    look: source.look ? { ...source.look } : null,
    asleep: source.asleep,
    mouth: { x, y },
    anchors: emptyAnchors(),
  };
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
    t: 0,
    rng: makeRng(seed),
    scene,
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
  if (actor.asleep !== source.asleep) {
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

// A new scene only moves the actors to its home spot. Pet state is untouched, so a sleeping pet keeps sleeping.
export function setWorldScene(world: World, scene: Scene): void {
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
    makeBallItem({
      state: 'free',
      x: floor.xMin - 4,
      y: floor.yMin + 10 + roll() * (floor.yMax - floor.yMin - 20),
      z: 30,
      vx: 240 + roll() * 110,
      vy: (roll() - 0.5) * 90,
      vz: 330,
    }),
  ];
}

export function dropBallAt(world: World, x: number, y: number, soft = true): void {
  const roll = world.rng;
  const floor = world.scene.floor;
  world.items = [
    makeBallItem({
      state: 'free',
      x: clamp(x, floor.xMin - 12, floor.xMax + 12),
      y: clamp(y, floor.yMin, floor.yMax),
      z: soft ? 40 : 130,
      vx: (roll() - 0.5) * (soft ? 18 : 40),
      vy: (roll() - 0.5) * (soft ? 10 : 20),
      vz: soft ? 20 : 0,
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
    makeBallItem({
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
  actor.idle.sit = mode === 'purr' ? true : mode === 'pant' ? roll() < 0.5 : false;
  const bed = mode === 'nap' ? nearestPoi(world.scene, 'bed', actor) : null;
  if (bed) {
    actor.idle.target = { x: bed.x, y: bed.y };
    actor.idle.arrived = false;
  }
}

function nextIdle(world: World, actor: Actor): void {
  const breed = breedById(actor.breedId);
  // Occasional autonomous drink when water is available.
  if (canAutonomousDrink(world) && world.rng() < 0.18 && canBehave(actor, 'eat')) {
    startUserTask(world, actor, 'drink');
    return;
  }
  const options = (breed?.species === 'cat' ? ['still', 'purr', 'nap', 'walk'] : ['still', 'pant', 'nap', 'walk']).filter(
    (mode) => mode !== actor.idle.mode && !(world.reducedMotion && mode === 'walk'),
  ) as IdleMode[];
  const choices = options.length > 0 ? options : (['still'] as IdleMode[]);
  const total = choices.reduce((sum, mode) => sum + idleWeight[mode], 0);
  let roll = world.rng() * total;
  let pick = choices[0];
  for (const mode of choices) {
    roll -= idleWeight[mode];
    if (roll <= 0) {
      pick = mode;
      break;
    }
  }
  beginIdle(world, actor, pick);
}

function goIdle(world: World, actor: Actor): void {
  releaseCarried(world, actor);
  actor.task = taskOf('idle');
  beginIdle(world, actor, 'still');
}

export function startUserTask(
  world: World,
  actor: Actor,
  task: UserTask,
  roll = 1,
  drop?: Vec,
  flick?: { vx: number; vy: number; vz: number },
): boolean {
  if (task === 'wake') {
    actor.asleep = false;
    goIdle(world, actor);
    return true;
  }
  if (task === 'sleep') {
    // Walk to the bed when the scene has one, otherwise sleep where the pet stands.
    const bed = nearestPoi(world.scene, 'bed', actor);
    releaseCarried(world, actor);
    actor.asleep = true;
    actor.task = taskOf('sleep', bed ? 'go' : 'sleeping');
    actor.task.poi = bed ?? undefined;
    actor.pantT = 0;
    return true;
  }
  // Any other request wakes a sleeper, then continues into that action.
  if (actor.asleep) {
    actor.asleep = false;
  }
  if (task === 'idle') {
    goIdle(world, actor);
    return true;
  }
  if (task === 'refuse') {
    releaseCarried(world, actor);
    actor.task = taskOf('sit', 'refuse');
    actor.face = -actor.face;
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
    actor.task = taskOf('fetch', 'chase');
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

function poseTargets(actor: Actor): Pose {
  return {
    ...defaultPose(),
    walk: actor.speed > 14 ? 1 : 0,
  };
}

function updateActor(world: World, actor: Actor, dt: number): void {
  const breed = breedById(actor.breedId);
  if (!breed) {
    return;
  }
  const floor = world.scene.floor;
  actor.task.t += dt;
  actor.task.cool = Math.max(0, actor.task.cool - dt);
  actor.displayAgeDays = easeDisplay(actor.displayAgeDays, actor.ageDays, dt);
  actor.displayWeight = easeDisplay(actor.displayWeight, actor.weight, dt);
  if (actor.z > 0 || actor.vz !== 0) {
    actor.vz -= 900 * dt;
    actor.z += actor.vz * dt;
    if (actor.z <= 0) {
      actor.z = 0;
      actor.vz = 0;
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
  );
  actor.mouth = frame.mouth;
  actor.anchors = {
    head: { x: frame.head.x, y: frame.head.y, pitch: frame.pitch, radius: frame.geom.headR },
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
  const limit = speedMax(breed, actor.displayAgeDays, actor.displayWeight);
  const cat = breed.species === 'cat';

  if (actor.speed > weightRunSpeed) {
    actor.weight = clamp(actor.weight - weightBurnPerSec * dt, -1, 1);
  }

  if (actor.task.type === 'idle') {
    actor.idle.t += dt;
    if (actor.idle.mode === 'walk') {
      if (!actor.idle.target) {
        actor.idle.target = {
          x: floor.xMin + 22 + world.rng() * (floor.xMax - floor.xMin - 44),
          y: floor.yMin + world.rng() * (floor.yMax - floor.yMin),
        };
      }
      move = actor.idle.target;
      vmax = limit * 0.42;
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
      if (actor.idle.arrived && actor.idle.t > actor.idle.dur) {
        nextIdle(world, actor);
      }
    }
  } else if (actor.task.type === 'sit') {
    targets.sit = 1;
    targets.wagAmp = 0.3;
    if (actor.task.stage === 'refuse') {
      targets.headTurn = 1;
      if (actor.task.t > 1.4) {
        goIdle(world, actor);
      }
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
  } else if (actor.task.type === 'winddown') {
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
    const face = poi?.face ?? 1;
    const spot = poi
      ? { x: poi.x - face * frame.scale * (frame.geom.bodyLen / 2 + 34), y: poi.y }
      : null;
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
        goIdle(world, actor);
      }
    } else {
      goIdle(world, actor);
    }
  } else if (actor.task.type === 'fetch') {
    targets.wagAmp = 0.5;
    wagRate = 9;
    const reach = reachOf(frame.geom) * frame.scale;
    const ball = freeBall(world) ?? carriedBy(world, actor.id);
    if (actor.task.stage === 'chase' && ball && ball.state === 'free') {
      const mouthSlop = 2;
      let ahead = (ball.x - actor.x) * actor.face;
      if (ahead < -mouthSlop) {
        actor.face = -actor.face;
        ahead = -ahead;
      }
      move = { x: ahead > reach ? ball.x - actor.face * reach : actor.x, y: ball.y };
      vmax = limit;
      const near = ahead >= -mouthSlop && ahead <= reach + 10 && Math.abs(actor.y - ball.y) < 10 && ball.z < 16;
      if (near && cat && actor.task.cool <= 0) {
        ball.vx = actor.face * (150 + world.rng() * 120);
        ball.vy = (world.rng() - 0.5) * 140;
        ball.vz = 170;
        actor.vz = 160;
        actor.task.bats += 1;
        actor.task.cool = 0.5;
        if (actor.task.bats >= 3) {
          actor.task = taskOf('winddown');
        }
      } else if (near && !cat) {
        ball.state = 'carried';
        ball.holderId = actor.id;
        actor.task.stage = 'return';
      }
    } else if (actor.task.stage === 'return' && ball && ball.state === 'carried' && ball.holderId === actor.id) {
      const home = homeOf(world.scene);
      move = home;
      vmax = limit * 0.62;
      if (Math.hypot(home.x - actor.x, home.y - actor.y) < 8 && actor.speed < 20) {
        releaseCarried(world, actor);
        actor.task = taskOf('winddown');
      }
    } else if (actor.task.stage !== 'chase' || !ball) {
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

  const desired = { x: 0, y: 0 };
  if (move) {
    const tx = clamp(move.x, floor.xMin, floor.xMax);
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
  const ease = 1 - Math.exp(-dt * 7);
  actor.vx += (desired.x - actor.vx) * ease;
  actor.vy += (desired.y - actor.vy) * ease;
  actor.x = clamp(actor.x + actor.vx * dt, floor.xMin, floor.xMax);
  actor.y = clamp(actor.y + actor.vy * dt, floor.yMin, floor.yMax);
  actor.speed = Math.hypot(actor.vx, actor.vy);
  const chasing = actor.task.type === 'fetch' && actor.task.stage === 'chase';
  const eating = actor.task.type === 'eat' && actor.task.stage === 'eating';
  if (!chasing && !eating && Math.abs(actor.vx) > 25) {
    actor.face = actor.vx > 0 ? 1 : -1;
    actor.anchors.facing = actor.face >= 0 ? 1 : -1;
  }
  targets.walk = actor.speed > 14 ? 1 : 0;
  if (actor.bark.open > 0.05 && targets.eyes > 0) {
    targets.eyes = 0;
  }
  actor.pose = easePose(actor.pose, targets, dt);
  const stride = frame.geom.L * (0.35 + 0.4 * clamp(actor.speed / 190, 0, 1.1));
  const localSpeed = actor.speed / Math.max(frame.scale, 0.01);
  actor.phase += dt * Math.min(24, ((Math.PI * 2 * 0.55 * localSpeed) / Math.max(stride, 1)) || 0);
  // Match jaw/tongue cadence to breath while panting so a slower idle pant reads as one motion.
  actor.panPh += dt * Math.PI * 2 * (actor.pose.pant > 0.05 ? actor.pose.breathRate : 5);
  actor.chewPh += dt * Math.PI * 2 * 3;
  actor.wagPh += dt * wagRate * (world.reducedMotion ? 0 : 1);
  actor.breathPh += dt * Math.PI * 2 * actor.pose.breathRate;
  actor.blinkT -= dt;
  if (actor.blinkT <= 0) {
    actor.blinkT = world.rng() < 0.18 ? 0.32 : 1.6 + world.rng() * 2.6;
  }
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
  const step = Math.min(dt, 0.05);
  world.t += step;
  updateItems(world, step);
  updateParticles(world, step);
  const eating = world.actors.some(
    (actor) => actor.task.type === 'eat' && actor.task.kind !== 'drink' && actor.task.stage === 'eating',
  );
  world.bowlFill = clamp(world.bowlFill + (eating ? -1 / 6 : 0.4) * step, 0, 1);
  for (const actor of world.actors) {
    updateActor(world, actor, step);
  }
}
