import { daysToSenior, stageDayThresholds } from '../sim/config';
import { breedById } from './breeds';
import { depthScale, geomOf, PET_SIZE } from './geometry';
import type { Actor, Pose, World } from './types';
import type { Prop } from './scenes';

// Named config. nextIdle rolls this before the normal idle pick when a scratch pole or tree is eligible.
export const FURNITURE_IDLE_CHANCE = 1;
export const FURNITURE_COOLDOWN_SEC = 180;

const htmlTorso = 58;
const htmlJump = 110;

export const poleMint = '#86D6C1';
export const polePink = '#FF9CC9';
export const poleSisal = '#d9c49a';

// Local coordinates. y is up the prop (negative is above the floor contact). z for the cat is -y.
export const catTreeLayout = {
  pad: { x0: -96, x1: 96, y: -8 },
  posts: [
    { id: 'postL', x: -52, w: 14, yTop: -175, yBottom: -8 },
    { id: 'postR', x: 52, w: 14, yTop: -200, yBottom: -8 },
  ],
  platforms: [
    { id: 'p1', x0: 8, x1: 96, y: -140 },
    { id: 'p2', x0: -96, x1: -8, y: -175 },
    { id: 'p3', x0: 4, x1: 92, y: -200, top: true },
  ],
} as const;

export type AgeBand = 'kitten' | 'adult' | 'senior';

// x is forward from the hip. y is from the hip, or from the floor under the cat when `ground` is set,
// so a paw on a scratch pad or a stretch lands on the surface instead of at shoulder height.
export type FurnitureReach = { x: number; y: number; ground?: boolean };

export type FurnitureRig = {
  rear: number;
  reach: { near: FurnitureReach; far: FurnitureReach } | null;
  // Hind paws gripping a post while climbing. Null keeps the normal standing feet.
  hind: { near: FurnitureReach; far: FurnitureReach } | null;
  claws: number;
  specks: { x: number; y: number; age: number; life: number }[];
};

export type FurniturePhase =
  | 'approach'
  | 'rear'
  | 'scratch'
  | 'drop'
  | 'stretch'
  | 'crouch'
  | 'air'
  | 'land'
  | 'climb'
  | 'pull'
  | 'perch'
  | 'abort';

type Surf = { id: string; x0: number; x1: number; z: number; top?: boolean };

type Edge = {
  kind: 'jump' | 'climb' | 'drop';
  from: string;
  to: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  postX?: number;
};

export type FurnitureRun = {
  pieceId: string;
  affordanceId: string;
  kind: 'scratch' | 'visit';
  scratch: 'vertical' | 'horizontal' | null;
  phase: FurniturePhase;
  t: number;
  dur: number;
  goal: string;
  surface: string;
  face: 1 | -1;
  leaving: boolean;
  perch: 'loaf' | 'sit' | 'groom' | 'tail' | 'paw' | 'survey' | 'nap';
  strokes: number;
  stroke: number;
  strokeHz: number;
  wantStretch: boolean;
  short: boolean;
  path: Edge[];
  edge: number;
  pin: { x: number; z: number } | null;
  // Where the last phase left the body, so the next phase eases out of it instead of snapping.
  from: { rear: number; x: number | null; z: number | null };
  rig: FurnitureRig;
  anchorX: number;
  anchorY: number;
};

export function ageBand(ageDays: number): AgeBand {
  if (ageDays < stageDayThresholds[1]) {
    return 'kitten';
  }
  if (ageDays >= daysToSenior) {
    return 'senior';
  }
  return 'adult';
}

function ageJump(band: AgeBand): number {
  if (band === 'kitten') {
    return 0.75;
  }
  if (band === 'senior') {
    return 0.85;
  }
  return 1;
}

function ageRear(band: AgeBand): number {
  if (band === 'kitten') {
    return (60 * Math.PI) / 180;
  }
  if (band === 'senior') {
    return (55 * Math.PI) / 180;
  }
  return (70 * Math.PI) / 180;
}

// 110px in the HTML room, scaled by this cat's torso. Agility 0.5 keeps the age factor as written.
export function jumpReach(torso: number, band: AgeBand, agility: number): number {
  const agilityScale = 0.7 + 0.6 * Math.max(0, Math.min(1, agility));
  return torso * (htmlJump / htmlTorso) * ageJump(band) * agilityScale;
}

export function pawHeightOnPost(hipY: number, torso: number, frontLeg: number, angle: number, postTop: number, postBottom: number): number {
  const raw = hipY - torso * Math.sin(angle) - frontLeg * 0.9;
  return Math.min(postBottom, Math.max(postTop, raw));
}

function torsoOf(actor: Actor): number {
  const breed = breedById(actor.breedId);
  if (!breed) {
    return 90;
  }
  return geomOf(breed, actor.displayAgeDays, actor.displayWeight, actor.vitality).bodyLen;
}

function legOf(actor: Actor): number {
  const breed = breedById(actor.breedId);
  if (!breed) {
    return 40;
  }
  return geomOf(breed, actor.displayAgeDays, actor.displayWeight, actor.vitality).L;
}

function surfacesFor(band: AgeBand): Surf[] {
  const all = catTreeLayout.platforms.map((platform) => ({
    id: platform.id,
    x0: platform.x0,
    x1: platform.x1,
    z: -platform.y,
    top: 'top' in platform ? platform.top : false,
  }));
  if (band === 'senior') {
    return all.filter((surface) => surface.id === 'p1');
  }
  return all;
}

function postsOf(prop: Prop): { id: string; x: number; w: number; zTop: number; zBottom: number }[] {
  if (prop.kind === 'scratcher') {
    const h = prop.h ?? 74;
    return [{ id: 'pole', x: 0, w: 16, zTop: h, zBottom: 8 }];
  }
  return catTreeLayout.posts.map((post) => ({
    id: post.id,
    x: post.x,
    w: post.w,
    zTop: -post.yTop,
    zBottom: -post.yBottom,
  }));
}

type Node = { id: string; x0: number; x1: number; z: number; floor?: boolean; top?: boolean };

function nodesOf(prop: Prop, band: AgeBand): Node[] {
  const floor: Node = { id: 'floor', x0: -220, x1: 220, z: 0, floor: true };
  if (prop.kind !== 'catTree') {
    return [floor];
  }
  return [floor, ...surfacesFor(band)];
}

export function planRoute(prop: Prop, band: AgeBand, torso: number, agility: number, fromId: string, toId: string): Edge[] | null {
  const reach = jumpReach(torso, band, agility);
  const nodes = nodesOf(prop, band);
  const from = nodes.find((node) => node.id === fromId);
  const to = nodes.find((node) => node.id === toId);
  if (!from || !to || from === to) {
    return from && to && from === to ? [] : null;
  }
  const posts = postsOf(prop);
  const edges: Edge[] = [];
  for (const a of nodes) {
    for (const b of nodes) {
      if (a === b) {
        continue;
      }
      const up = b.z > a.z + 4;
      const gap = Math.abs(b.z - a.z);
      const ax = (a.x0 + a.x1) / 2;
      const bx = (b.x0 + b.x1) / 2;
      if (up && gap <= reach) {
        edges.push({ kind: 'jump', from: a.id, to: b.id, x0: ax, x1: bx, z0: a.z, z1: b.z });
      } else if (!up && gap > 4) {
        const next = nodes
          .filter((node) => node.z < a.z - 4)
          .sort((p, q) => q.z - p.z)[0];
        const adultHop = band === 'adult' && gap <= torso * (200 / htmlTorso);
        if (b.id === next?.id || adultHop) {
          edges.push({ kind: 'drop', from: a.id, to: b.id, x0: ax, x1: bx, z0: a.z, z1: b.z });
        }
      }
    }
  }
  if (band !== 'senior') {
    for (const post of posts) {
      for (const b of nodes) {
        if (b.floor || b.z > post.zTop + 1 || post.x < b.x0 || post.x > b.x1) {
          continue;
        }
        const below = nodes
          .filter((node) => node.z < b.z - 4 && (node.floor || (post.x >= node.x0 && post.x <= node.x1)))
          .sort((p, q) => q.z - p.z)[0];
        if (!below) {
          continue;
        }
        const jump = edges.some((edge) => edge.kind === 'jump' && edge.from === below.id && edge.to === b.id);
        if (jump) {
          continue;
        }
        edges.push({
          kind: 'climb',
          from: below.id,
          to: b.id,
          x0: post.x,
          x1: (b.x0 + b.x1) / 2,
          z0: below.z,
          z1: b.z,
          postX: post.x,
        });
      }
    }
  }
  const dist = new Map<string, number>([[fromId, 0]]);
  const prev = new Map<string, Edge>();
  const open = [...nodes];
  while (open.length > 0) {
    open.sort((a, b) => (dist.get(a.id) ?? 1e9) - (dist.get(b.id) ?? 1e9));
    const node = open.shift();
    if (!node || node.id === toId || !dist.has(node.id)) {
      break;
    }
    for (const edge of edges) {
      if (edge.from !== node.id) {
        continue;
      }
      const next = (dist.get(node.id) ?? 0) + (edge.kind === 'climb' ? 3 : 1);
      if (next < (dist.get(edge.to) ?? 1e9)) {
        dist.set(edge.to, next);
        prev.set(edge.to, edge);
      }
    }
  }
  if (fromId !== toId && !prev.has(toId)) {
    return null;
  }
  const path: Edge[] = [];
  let cursor = toId;
  while (cursor !== fromId) {
    const edge = prev.get(cursor);
    if (!edge) {
      return null;
    }
    path.unshift(edge);
    cursor = edge.from;
  }
  return path;
}

type Choice = {
  id: string;
  pieceId: string;
  kind: 'scratch' | 'visit';
  scratch: 'vertical' | 'horizontal' | null;
  weight: number;
  goal: string;
  prop: Prop;
};

function choicesFor(world: World, actor: Actor): Choice[] {
  const breed = breedById(actor.breedId);
  if (!breed || breed.species !== 'cat' || actor.guest || world.reducedMotion || actor.direction || actor.asleep || actor.cuddle) {
    return [];
  }
  const band = ageBand(actor.displayAgeDays);
  const low = actor.energy < 0.25;
  const list: Choice[] = [];
  for (const prop of world.scene.props) {
    if (!prop.id || (prop.kind !== 'scratcher' && prop.kind !== 'catTree')) {
      continue;
    }
    if (prop.kind === 'scratcher') {
      list.push({ id: `${prop.id}:pole`, pieceId: prop.id, kind: 'scratch', scratch: 'vertical', weight: 3, goal: 'floor', prop });
    }
    if (prop.kind === 'catTree') {
      list.push({ id: `${prop.id}:pad`, pieceId: prop.id, kind: 'scratch', scratch: 'horizontal', weight: 2, goal: 'floor', prop });
      list.push({ id: `${prop.id}:post`, pieceId: prop.id, kind: 'scratch', scratch: 'vertical', weight: 2, goal: 'floor', prop });
      if (!low) {
        const goal = band === 'senior' ? 'p1' : catTreeLayout.platforms[catTreeLayout.platforms.length - 1].id;
        list.push({ id: `${prop.id}:visit`, pieceId: prop.id, kind: 'visit', scratch: null, weight: 3, goal, prop });
      }
    }
  }
  const used = world.furnitureUsed ?? {};
  return list.filter((choice) => world.t >= (used[`${actor.id}|${choice.id}`] ?? 0));
}

function cool(world: World, actor: Actor, id: string): void {
  if (!world.furnitureUsed) {
    world.furnitureUsed = {};
  }
  world.furnitureUsed[`${actor.id}|${id}`] = world.t + FURNITURE_COOLDOWN_SEC;
}

function emptyRig(): FurnitureRig {
  return { rear: 0, reach: null, hind: null, claws: 0, specks: [] };
}

function approachX(prop: Prop, scratch: 'vertical' | 'horizontal' | null, torso: number, face: 1 | -1): number {
  if (scratch === 'horizontal') {
    return prop.x + face * 20;
  }
  const post = prop.kind === 'catTree' ? catTreeLayout.posts[1] : { x: 0, w: 16 };
  return prop.x + post.x - face * (post.w / 2 + torso * 0.35);
}

// The body inset keeps a wandering pet fully on stage. A pole in the catio corner sits inside that inset,
// so the walk target has to use the floor itself or the cat stops short and never scratches.
function clampToFloor(world: World, x: number, y: number): { x: number; y: number } {
  const floor = world.scene.floor;
  return {
    x: Math.min(floor.xMax, Math.max(floor.xMin, x)),
    y: Math.min(floor.yMax, Math.max(floor.yMin, y)),
  };
}

function standFace(world: World, actor: Actor, prop: Prop, scratch: 'vertical' | 'horizontal' | null, torso: number): 1 | -1 {
  const prefer: 1 | -1 = prop.x >= actor.x ? 1 : -1;
  if (!scratch) {
    return prefer;
  }
  const gap = (face: 1 | -1): number => {
    const ideal = approachX(prop, scratch, torso, face);
    return Math.abs(clampToFloor(world, ideal, prop.y).x - ideal);
  };
  const other: 1 | -1 = prefer === 1 ? -1 : 1;
  return gap(other) + 8 < gap(prefer) ? other : prefer;
}

function makeRun(world: World, actor: Actor, choice: Choice): FurnitureRun {
  const band = ageBand(actor.displayAgeDays);
  const torso = torsoOf(actor);
  const face = standFace(world, actor, choice.prop, choice.scratch, torso);
  const anchor = clampToFloor(world, approachX(choice.prop, choice.scratch, torso, face), choice.prop.y);
  const path = choice.kind === 'visit' ? planRoute(choice.prop, band, torso, actor.stats.agility, 'floor', choice.goal) ?? [] : [];
  const roll = world.rng();
  const strokes = band === 'kitten' ? 5 + Math.floor(roll * 5) : band === 'senior' ? 2 + Math.floor(roll * 3) : 4 + Math.floor(roll * 5);
  return {
    pieceId: choice.pieceId,
    affordanceId: choice.id,
    kind: choice.kind,
    scratch: choice.scratch,
    phase: 'approach',
    t: 0,
    dur: 0,
    goal: choice.goal,
    surface: 'floor',
    face,
    leaving: false,
    perch: 'sit',
    strokes,
    stroke: -1,
    strokeHz: band === 'kitten' ? 4 : band === 'senior' ? 2 : 2.5,
    wantStretch: world.rng() < 0.5,
    short: band === 'kitten' && world.rng() < 0.15,
    path,
    edge: 0,
    pin: null,
    from: { rear: 0, x: null, z: null },
    rig: emptyRig(),
    anchorX: anchor.x,
    anchorY: anchor.y,
  };
}

// Starts a use when something is eligible. The roll lives in tryFurnitureIdle.
export function beginFurniture(world: World, actor: Actor): boolean {
  const options = choicesFor(world, actor);
  if (options.length === 0) {
    return false;
  }
  let total = 0;
  for (const choice of options) {
    total += choice.weight;
  }
  let roll = world.rng() * total;
  let pick = options[0];
  for (const choice of options) {
    roll -= choice.weight;
    if (roll <= 0) {
      pick = choice;
      break;
    }
  }
  if (pick.kind === 'visit') {
    const band = ageBand(actor.displayAgeDays);
    const path = planRoute(pick.prop, band, torsoOf(actor), actor.stats.agility, 'floor', pick.goal);
    if (!path || path.length === 0) {
      return false;
    }
  }
  actor.furniture = makeRun(world, actor, pick);
  cool(world, actor, pick.id);
  return true;
}

export function tryFurnitureIdle(world: World, actor: Actor): boolean {
  if (actor.furniture || choicesFor(world, actor).length === 0) {
    return false;
  }
  if (world.rng() >= FURNITURE_IDLE_CHANCE) {
    return false;
  }
  return beginFurniture(world, actor);
}

export function furnitureClaims(actor: Actor, pieceId: string): boolean {
  return actor.furniture?.pieceId === pieceId;
}

export function askFurnitureOff(actor: Actor): void {
  if (actor.furniture) {
    actor.furniture.leaving = true;
  }
}

export function furnitureBusy(actor: Actor): boolean {
  const run = actor.furniture;
  if (!run) {
    return false;
  }
  return run.phase !== 'approach' || run.surface !== 'floor' || (run.pin != null && run.pin.z > 8);
}

function propOf(world: World, id: string): Prop | null {
  return world.scene.props.find((prop) => prop.id === id) ?? null;
}

// Phases that pose the paws themselves. Every other phase starts with the rig cleared, so a climb or a
// jump never leaves the forelegs hanging in the air or the body tilted once the cat is up on a platform.
const posedPhases: FurniturePhase[] = ['rear', 'scratch', 'drop', 'stretch', 'climb', 'pull', 'land'];

function enter(run: FurnitureRun, phase: FurniturePhase, dur: number): void {
  run.from = { rear: run.rig.rear, x: run.pin?.x ?? null, z: run.pin?.z ?? null };
  run.phase = phase;
  run.t = 0;
  run.dur = dur;
  run.pin = null;
  if (!posedPhases.includes(phase)) {
    run.rig.rear = 0;
    run.rig.reach = null;
    run.rig.hind = null;
    run.rig.claws = 0;
  }
}

function smooth(k: number): number {
  const c = Math.max(0, Math.min(1, k));
  return c * c * (3 - 2 * c);
}

// One scratch stroke, u in 0..1. The working paw hooks in at the top, drags down with the claws out for
// the first 60%, then lifts off and swings back up clear of the surface.
function strokeCurve(u: number): { drag: number; off: number; contact: boolean } {
  if (u < 0.6) {
    const k = u / 0.6;
    // Fast start, slow finish: the claws catch, then the pull runs out.
    return { drag: 1 - (1 - k) * (1 - k), off: 0, contact: true };
  }
  const k = smooth((u - 0.6) / 0.4);
  return { drag: 1 - k, off: Math.sin(k * Math.PI), contact: false };
}

function poseScratch(world: World, run: FurnitureRun, actor: Actor, targets: Pose): boolean {
  const band = ageBand(actor.displayAgeDays);
  const leg = legOf(actor);
  const k = Math.min(1, run.t / Math.max(run.dur, 0.01));
  const full = ageRear(band);
  if (run.phase === 'rear') {
    run.rig.rear = full * smooth(k);
  } else if (run.phase === 'drop') {
    run.rig.rear = run.from.rear * (1 - smooth(k));
  } else if (run.phase === 'scratch') {
    run.rig.rear = full;
  } else {
    run.rig.rear = 0;
  }
  const scratching = run.phase === 'scratch';
  const cycle = run.t * run.strokeHz;
  const stroke = scratching ? strokeCurve(cycle % 1) : { drag: 0, off: 0, contact: false };
  // Paws take turns. The resting paw stays hooked in, partway down the stroke.
  const nearWorks = Math.floor(cycle) % 2 === 0;
  const contact = stroke.contact;
  // Stage pixels to the pet's local units, for surfaces measured on the prop.
  const scale = Math.max(scaleOf(actor, world.scene.floor), 0.01);
  if (run.scratch === 'horizontal' && run.phase !== 'stretch') {
    targets.bow = 1;
    run.rig.rear = 0;
    const padTop = -Math.abs(catTreeLayout.pad.y) / scale;
    const reachOut = leg * 0.95;
    const travel = leg * 0.4;
    const paw = (works: boolean, lead: number): FurnitureReach => {
      if (!scratching) {
        return { x: reachOut * lead, y: padTop, ground: true };
      }
      const drag = works ? stroke.drag : 0.5;
      const off = works ? stroke.off : 0;
      return { x: reachOut * lead - drag * travel, y: padTop - off * leg * 0.18, ground: true };
    };
    run.rig.reach = { near: paw(nearWorks, 1), far: paw(!nearWorks, 0.85) };
  } else if (run.phase === 'rear' || run.phase === 'scratch' || run.phase === 'drop') {
    const up = Math.min(1, run.rig.rear / full);
    // Offsets from the shoulder. Reach rises with the rear, a stroke drags the paw back down toward it.
    const top = -leg * (0.25 + 0.6 * up);
    const travel = leg * 0.45 * up;
    const toPost = torsoOf(actor) * 0.18 * up;
    const paw = (works: boolean): FurnitureReach => {
      const drag = works ? stroke.drag : 0.45;
      const off = works ? stroke.off : 0;
      return { x: toPost - off * leg * 0.15, y: top + drag * travel };
    };
    run.rig.reach = { near: paw(nearWorks), far: paw(!nearWorks) };
  } else if (run.phase === 'stretch') {
    run.rig.reach = { near: { x: leg * 1.05, y: 0, ground: true }, far: { x: leg * 0.85, y: 0, ground: true } };
  } else {
    run.rig.reach = null;
  }
  run.rig.hind = null;
  run.rig.claws = contact ? 1 : scratching ? 0.5 : 0;
  targets.squint = run.phase === 'scratch' ? 0.65 : 0;
  targets.earBack = run.phase === 'scratch' ? 0.45 : 0;
  targets.tailLift = run.scratch === 'horizontal' ? 0.8 : run.phase === 'scratch' ? -0.35 : 0.2;
  // Follows the stroke instead of switching on contact, so the back flexes with each pull.
  targets.spineArch = scratching ? 0.12 + 0.18 * stroke.drag : 0;
  targets.wiggle = scratching ? 0.2 : 0;
  if (run.phase === 'stretch') {
    targets.bow = 0;
    targets.stretch = 1;
    targets.tailLift = 0.9;
  }
  return contact;
}

function tickSpecks(run: FurnitureRun, dt: number): void {
  for (const speck of run.rig.specks) {
    speck.age += dt;
    speck.y += 18 * dt;
  }
  run.rig.specks = run.rig.specks.filter((speck) => speck.age < speck.life);
}

export function playScratchStroke(): void {
  // A royalty-free scratch clip is not bundled yet. Callers still hit this once per stroke.
}

export type FurnitureStep = {
  done: boolean;
  move: { x: number; y: number } | null;
  vmax: number;
  faceCamera: boolean;
  sideLock: 1 | -1 | null;
};

function nextEdge(world: World, run: FurnitureRun, actor: Actor, prop: Prop | null): FurniturePhase {
  const edge = run.path[run.edge];
  if (!edge) {
    if (run.leaving || run.surface === 'floor') {
      enter(run, 'drop', 0.01);
      run.t = 1;
      return run.phase;
    }
    const styles = ['loaf', 'sit', 'groom', 'tail', 'paw', 'survey', 'nap'] as const;
    const top = run.goal === 'p3';
    const pick = Math.floor(world.rng() * (top ? styles.length : styles.length - 1));
    run.perch = actor.energy < 0.4 ? 'nap' : styles[pick];
    enter(run, 'perch', 8 + world.rng() * 17);
    return run.phase;
  }
  run.anchorX = (prop?.x ?? 0) + edge.x0;
  run.anchorY = prop?.y ?? run.anchorY;
  enter(run, 'approach', 0);
  return run.phase;
}

export function stepFurniture(world: World, actor: Actor, dt: number, targets: Pose): FurnitureStep {
  const run = actor.furniture;
  const idle: FurnitureStep = { done: false, move: null, vmax: 0, faceCamera: false, sideLock: null };
  if (!run) {
    return { ...idle, done: true };
  }
  const prop = propOf(world, run.pieceId);
  if (!prop) {
    enter(run, 'abort', 0.35);
  }
  run.t += dt;
  tickSpecks(run, dt);
  const side = run.face;
  actor.face = side;

  if (run.leaving && run.phase !== 'air' && run.phase !== 'abort' && run.phase !== 'drop' && run.phase !== 'land') {
    if (run.surface === 'floor' && (run.phase === 'approach' || run.phase === 'rear' || run.phase === 'scratch' || run.phase === 'stretch' || run.phase === 'crouch')) {
      if (run.phase === 'scratch' || run.phase === 'rear') {
        enter(run, 'drop', 0.3);
      } else {
        return { ...idle, done: true };
      }
    } else if (run.phase === 'perch' || run.phase === 'climb' || run.phase === 'pull') {
      const back = prop ? planRoute(prop, ageBand(actor.displayAgeDays), torsoOf(actor), actor.stats.agility, run.surface, 'floor') : null;
      run.path = back ?? [];
      run.edge = 0;
      run.leaving = true;
      if (!back || back.length === 0) {
        enter(run, 'abort', 0.35);
      } else {
        nextEdge(world, run, actor, prop);
      }
    }
  }

  if (run.phase === 'approach') {
    const spot = clampToFloor(world, run.anchorX, prop?.y ?? run.anchorY);
    const dist = Math.hypot(spot.x - actor.x, spot.y - actor.y);
    // A tree's footprint used to stop the cat on the rim, short of the 10px arrival, so the use never began.
    const arrived = (dist < 36 && actor.speed < 40) || (run.t > 3 && actor.speed < 24 && dist < 140);
    if (arrived) {
      if (dist < 36) {
        actor.x = spot.x;
        actor.y = spot.y;
      }
      if (run.kind === 'scratch') {
        enter(run, run.scratch === 'horizontal' ? 'scratch' : 'rear', run.scratch === 'horizontal' ? 0.2 : 0.4);
      } else {
        const edge = run.path[run.edge];
        if (!edge) {
          return { ...idle, done: true };
        }
        enter(run, 'crouch', 0.35 + world.rng() * 0.25);
      }
    }
    return { done: false, move: spot, vmax: 90, faceCamera: false, sideLock: side };
  }

  if (run.phase === 'rear') {
    poseScratch(world, run, actor, targets);
    if (run.t >= run.dur) {
      enter(run, 'scratch', run.strokes / run.strokeHz);
      run.stroke = -1;
    }
    return { ...idle, sideLock: side };
  }

  if (run.phase === 'scratch') {
    const cycle = run.t * run.strokeHz;
    const index = Math.floor(cycle);
    // stroke starts at -1, so the first stroke gets its sound and specks too.
    if (index !== run.stroke) {
      run.stroke = index;
      playScratchStroke();
      const postX = run.scratch === 'horizontal' ? run.face * 16 : prop?.kind === 'catTree' ? catTreeLayout.posts[1].x : 0;
      const postH = prop?.kind === 'catTree' ? -catTreeLayout.posts[1].yTop : prop?.h ?? 74;
      // Specks start about where the paws drag, not at a fixed fraction of the pole.
      const postY = run.scratch === 'horizontal' ? -5 : -Math.min(postH * 0.9, legOf(actor) * 1.6 * scaleOf(actor, world.scene.floor));
      for (let i = 0; i < 3; i += 1) {
        run.rig.specks.push({
          x: (prop?.x ?? actor.x) + postX + (i - 1) * 3,
          y: (prop?.y ?? actor.y) + postY,
          age: 0,
          life: 0.45,
        });
      }
    }
    poseScratch(world, run, actor, targets);
    if (run.t >= run.dur) {
      enter(run, 'drop', 0.3);
    }
    return { ...idle, sideLock: side };
  }

  if (run.phase === 'drop') {
    poseScratch(world, run, actor, targets);
    if (run.t >= run.dur) {
      run.rig.rear = 0;
      run.rig.reach = null;
      run.rig.claws = 0;
      if (run.leaving) {
        return { ...idle, done: true };
      }
      if (run.wantStretch) {
        enter(run, 'stretch', 0.8);
      } else {
        return { ...idle, done: true };
      }
    }
    return { ...idle, sideLock: side };
  }

  if (run.phase === 'stretch') {
    poseScratch(world, run, actor, targets);
    if (run.t >= run.dur) {
      return { ...idle, done: true };
    }
    return { ...idle, sideLock: side };
  }

  if (run.phase === 'crouch') {
    targets.crouch = 1;
    targets.wiggle = 1;
    targets.headUp = 0.4;
    if (run.t >= run.dur) {
      const edge = run.path[run.edge];
      if (!edge) {
        return { ...idle, done: true };
      }
      if (edge.kind === 'climb') {
        enter(run, 'climb', Math.max(0.4, (edge.z1 - edge.z0) / Math.max(torsoOf(actor), 40)));
      } else {
        enter(run, 'air', edge.z1 >= edge.z0 ? 0.38 : 0.34);
        run.short = run.short && edge.kind === 'jump' && edge.z1 > edge.z0;
      }
    }
    return { ...idle, sideLock: side };
  }

  if (run.phase === 'air') {
    const edge = run.path[run.edge];
    if (!edge) {
      return { ...idle, done: true };
    }
    const k = Math.min(1, run.t / Math.max(run.dur, 0.01));
    const arc = Math.abs(edge.z1 - edge.z0) * (edge.z1 >= edge.z0 ? 0.16 : 0.08);
    const x = edge.x0 + (edge.x1 - edge.x0) * k;
    const z = edge.z0 + (edge.z1 - edge.z0) * k + Math.sin(k * Math.PI) * arc;
    const stageX = (prop?.x ?? 0) + x;
    run.pin = { x: stageX, z: run.short && k > 0.7 ? edge.z1 * 0.92 : z };
    // Nose up on the way up, level out over the top, nose down a little for the landing.
    run.rig.rear = edge.z1 >= edge.z0 ? 0.3 * Math.cos(k * Math.PI) : -0.15 * Math.sin(k * Math.PI);
    run.rig.reach = null;
    run.rig.hind = null;
    targets.tuck = 1;
    targets.stretch = 0.4;
    if (k >= 1) {
      run.surface = edge.to;
      actor.z = edge.z1;
      if (run.short) {
        run.short = false;
        enter(run, 'pull', 0.5);
      } else {
        enter(run, 'land', 0.2);
      }
    }
    return { ...idle, sideLock: side };
  }

  if (run.phase === 'land') {
    targets.land = 1 - run.t / Math.max(run.dur, 0.01);
    run.rig.rear = run.from.rear * (1 - smooth(run.t / Math.max(run.dur, 0.01)));
    run.rig.reach = null;
    run.rig.hind = null;
    const edge = run.path[run.edge];
    if (edge) {
      run.pin = { x: (prop?.x ?? 0) + edge.x1, z: edge.z1 };
      run.surface = edge.to;
    }
    if (run.t >= run.dur) {
      run.edge += 1;
      if (!run.path[run.edge]) {
        if (run.surface === 'floor' || run.leaving) {
          actor.z = 0;
          return { ...idle, done: true };
        }
        if (nextEdge(world, run, actor, prop) === 'perch') {
          return { ...idle, sideLock: side };
        }
      } else {
        nextEdge(world, run, actor, prop);
      }
    }
    return { ...idle, sideLock: side };
  }

  if (run.phase === 'climb') {
    const edge = run.path[run.edge];
    if (!edge) {
      return { ...idle, done: true };
    }
    const k = Math.min(1, run.t / Math.max(run.dur, 0.01));
    const leg = legOf(actor);
    const rise = edge.z1 - edge.z0;
    // Climbing is a series of bounds, not a glide: front paws reach and hook, the hind legs push,
    // and the body surges. `bounds` scales with the height so a tall post takes more pulls.
    const bounds = Math.max(2, Math.round(rise / Math.max(leg * scaleOf(actor, world.scene.floor) * 1.1, 1)));
    const w = 2 * Math.PI * bounds;
    // Monotonic with surges: speed swings between 0.15x and 1.85x of the average.
    const progress = k - (0.85 * Math.sin(w * k)) / w;
    const beat = Math.sin(w * k);
    // Ease into the upright pose over the first bound, instead of snapping from the crouch.
    const settle = smooth(k * bounds);
    run.rig.rear = (Math.PI / 2) * 0.82 * settle;
    // Paws alternate: one reaches high while the other pulls down near the chest.
    run.rig.reach = {
      near: { x: leg * 0.12, y: -leg * (0.55 + 0.3 * beat) },
      far: { x: leg * 0.12, y: -leg * (0.55 - 0.3 * beat) },
    };
    // The hind feet push off the post in counter-phase with the front reach.
    run.rig.hind = {
      near: { x: leg * 0.3, y: leg * (0.35 + 0.15 * beat) },
      far: { x: leg * 0.3, y: leg * (0.35 - 0.15 * beat) },
    };
    run.rig.claws = 1;
    const post = prop?.kind === 'catTree' ? catTreeLayout.posts.find((p) => p.x === edge.postX) : null;
    // Hold the cat against the near face of the post, not centered inside it.
    const hug = (post?.w ?? 16) / 2 + leg * 0.2 * scaleOf(actor, world.scene.floor);
    run.pin = { x: (prop?.x ?? 0) + (edge.postX ?? edge.x0) - run.face * hug, z: edge.z0 + rise * progress };
    targets.tailLift = -0.6 + 0.15 * beat;
    targets.earBack = 0.2;
    if (k >= 1) {
      enter(run, 'pull', 0.45);
    }
    return { ...idle, sideLock: side };
  }

  if (run.phase === 'pull') {
    const edge = run.path[run.edge];
    const k = Math.min(1, run.t / Math.max(run.dur, 0.01));
    const e = smooth(k);
    const leg = legOf(actor);
    if (edge) {
      // Haul over the lip: the body slides from the post onto the platform with a small hop,
      // instead of teleporting to the platform center on the first frame.
      const toX = (prop?.x ?? 0) + edge.x1;
      const fromX = run.from.x ?? toX;
      const fromZ = run.from.z ?? edge.z1;
      run.pin = {
        x: fromX + (toX - fromX) * e,
        z: fromZ + (edge.z1 - fromZ) * Math.min(1, e * 1.6) + Math.sin(k * Math.PI) * leg * 0.15 * scaleOf(actor, world.scene.floor),
      };
      if (k > 0.5) {
        run.surface = edge.to;
      }
    }
    // Ease the body down from wherever the climb or short jump left it.
    run.rig.rear = run.from.rear * (1 - e);
    // Front paws plant on the platform top first, then the legs fall back into a normal stance.
    run.rig.reach = k < 0.65 ? { near: { x: leg * 0.6, y: 0, ground: true }, far: { x: leg * 0.45, y: 0, ground: true } } : null;
    run.rig.hind = k < 0.4 ? { near: { x: leg * 0.2, y: leg * 0.2 * (1 - k / 0.4) }, far: { x: leg * 0.1, y: leg * 0.3 * (1 - k / 0.4) } } : null;
    run.rig.claws = k < 0.4 ? 1 : 0;
    targets.land = Math.sin(k * Math.PI) * 0.4;
    if (k >= 1) {
      run.edge += 1;
      if (!run.path[run.edge]) {
        if (run.leaving || run.surface === 'floor') {
          return { ...idle, done: true };
        }
        nextEdge(world, run, actor, prop);
      } else {
        enter(run, 'approach', 0);
      }
    }
    return { ...idle, sideLock: side };
  }

  if (run.phase === 'perch') {
    const napNow = actor.energy < 0.25;
    if (napNow) {
      run.perch = 'nap';
    }
    if (run.perch === 'loaf' || run.perch === 'sit' || run.perch === 'survey') {
      targets.sit = run.perch === 'loaf' ? 0.35 : 1;
      targets.lie = run.perch === 'loaf' ? 0.55 : 0;
    }
    if (run.perch === 'groom' || run.perch === 'paw') {
      targets.sit = 1;
      targets.paw = 1;
    }
    if (run.perch === 'tail') {
      targets.sit = 1;
      targets.tailLift = -0.2 + Math.sin(world.t * 2) * 0.35;
    }
    if (run.perch === 'survey') {
      targets.headTurn = Math.sin(world.t * 0.8) * 0.8;
    }
    if (run.perch === 'nap') {
      targets.lie = 1;
      targets.eyes = 1;
      targets.headRest = 1;
    }
    const hold = napNow && !run.leaving ? Infinity : run.dur;
    if (run.t >= hold) {
      const back = prop ? planRoute(prop, ageBand(actor.displayAgeDays), torsoOf(actor), actor.stats.agility, run.surface, 'floor') : null;
      run.path = back ?? [];
      run.edge = 0;
      run.leaving = false;
      if (!back || back.length === 0) {
        enter(run, 'abort', 0.35);
      } else {
        nextEdge(world, run, actor, prop);
      }
    }
    const look = run.perch === 'sit' || run.perch === 'loaf' || run.perch === 'survey' || run.perch === 'nap';
    return { done: false, move: null, vmax: 0, faceCamera: look, sideLock: look ? null : side };
  }

  if (run.phase === 'abort') {
    const k = Math.min(1, run.t / Math.max(run.dur, 0.01));
    run.pin = { x: actor.x, z: actor.z * (1 - k) };
    if (k >= 1) {
      actor.z = 0;
      return { ...idle, done: true };
    }
    return idle;
  }

  return { ...idle, done: true };
}

export function scaleOf(actor: Actor, floor: { yMin: number; yMax: number }): number {
  const breed = breedById(actor.breedId);
  if (!breed) {
    return 1;
  }
  const geom = geomOf(breed, actor.displayAgeDays, actor.displayWeight, actor.vitality);
  return PET_SIZE * geom.sc * depthScale(actor.y, floor.yMin, floor.yMax);
}
