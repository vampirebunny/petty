import type { Scene } from '../actor/scenes';
import type { Actor, World } from '../actor/types';
import { skyAt } from '../actor/sky';
import { parkFinds } from '../sim/parkFindsConfig';
import type { ConditionOverrides } from './conditions';
import { beginParkFind } from './findTask';
import { rollParkFind } from './roll';
import type { FindVariant, ParkFindCatalogRow } from './types';
import type { ParkFindRarity } from '../sim/parkFindsConfig';

export type DigDecal = {
  x: number;
  y: number;
  bornAt: number;
  hole: number;
  mound: number;
};

export type FindParticle = {
  kind: 'dirt' | 'blade' | 'leaf';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

export type ParkFindVisit = {
  armed: boolean;
  noticeAt: number;
  used: boolean;
  prompting: boolean;
  promptStartedAt: number;
  variant: FindVariant | null;
  spot: { x: number; y: number } | null;
  bushPropId?: string;
  grassTuft: { x: number; y: number; grow: number; shake: number; shrinkAt: number | null } | null;
  bushShake: number;
  item: ParkFindCatalogRow | null;
  running: boolean;
  revealed: boolean;
  modalDueAt: number | null;
  goldFlashUntil: number;
  decals: DigDecal[];
  particles: FindParticle[];
};

export type ParkFindDebug = {
  forceNotice?: FindVariant | null;
  forceRarity?: ParkFindRarity | null;
  forceItemId?: string | null;
  overrides?: ConditionOverrides;
};

let debugState: ParkFindDebug = {};

export function parkFindDebug(): ParkFindDebug {
  return debugState;
}

export function setParkFindDebug(next: Partial<ParkFindDebug> | null): void {
  debugState = next ? { ...debugState, ...next } : {};
}

function pondHit(scene: Scene, x: number, y: number): boolean {
  for (const prop of scene.props) {
    if (prop.kind !== 'pond') continue;
    const w = prop.w ?? 150;
    const h = prop.h ?? 34;
    if (Math.abs(x - prop.x) < w * 0.55 && Math.abs(y - prop.y) < h * 0.9) {
      return true;
    }
  }
  return false;
}

function tooCloseToProps(scene: Scene, x: number, y: number, minDist: number): boolean {
  for (const prop of scene.props) {
    const r = prop.kind === 'bush' ? 34 : prop.kind === 'tree' ? 40 : prop.kind === 'bench' ? 36 : 28;
    if (Math.hypot(x - prop.x, y - prop.y) < minDist + r * 0.3) {
      return true;
    }
  }
  for (const poi of scene.pois) {
    if (Math.hypot(x - poi.x, y - poi.y) < minDist) {
      return true;
    }
  }
  return false;
}

export function pickFindSpot(
  scene: Scene,
  pet: { x: number; y: number },
  rng: () => number,
  bleed = 0,
): { x: number; y: number } | null {
  const floor = scene.floor;
  const xMin = floor.xMin + parkFinds.spotPadX - bleed;
  const xMax = floor.xMax - parkFinds.spotPadX + bleed;
  const yMin = floor.yMin + parkFinds.spotPadYMin;
  const yMax = floor.yMax - parkFinds.spotPadYMax;
  for (let i = 0; i < 40; i += 1) {
    const x = xMin + rng() * Math.max(1, xMax - xMin);
    const y = yMin + rng() * Math.max(1, yMax - yMin);
    if (Math.hypot(x - pet.x, y - pet.y) < parkFinds.spotMinPetDist) continue;
    if (pondHit(scene, x, y)) continue;
    if (tooCloseToProps(scene, x, y, parkFinds.spotMinPropDist)) continue;
    return { x, y };
  }
  return null;
}

function pickVariant(
  species: 'dog' | 'cat',
  scene: Scene,
  rng: () => number,
  forced?: FindVariant | null,
): { variant: FindVariant; bushPropId?: string; spotAdjust?: { x: number; y: number } } {
  if (forced === 'dig' || species === 'dog') {
    return { variant: 'dig' };
  }
  if (forced === 'bush' || (forced !== 'grass' && rng() < parkFinds.bushChance)) {
    const bush = scene.props.find((prop) => prop.kind === 'bush');
    if (bush) {
      return {
        variant: 'bush',
        bushPropId: bush.id,
        spotAdjust: {
          x: bush.x,
          y: Math.max(bush.y + 18, scene.floor.yMin + 10),
        },
      };
    }
  }
  return { variant: 'grass' };
}

export function createParkFindVisit(
  world: World,
  actor: Actor,
  species: 'dog' | 'cat',
  firstVisit: boolean,
  now = world.t,
): ParkFindVisit {
  const debug = parkFindDebug();
  const force = debug.forceNotice;
  let armed = false;
  if (force) {
    armed = true;
  } else {
    const chance = firstVisit ? parkFinds.firstVisitFindChance : parkFinds.visitFindChance;
    armed = world.rng() < chance;
  }
  const noticeDelay = force
    ? 0.4
    : parkFinds.noticeMinSec + world.rng() * (parkFinds.noticeMaxSec - parkFinds.noticeMinSec);
  const picked = pickVariant(species, world.scene, world.rng, force);
  let spot = pickFindSpot(world.scene, actor, world.rng, world.stageBleed);
  if (picked.spotAdjust) {
    spot = picked.spotAdjust;
  }
  if (!spot) {
    armed = false;
  }
  return {
    armed,
    noticeAt: now + noticeDelay,
    used: !armed,
    prompting: false,
    promptStartedAt: 0,
    variant: armed ? picked.variant : null,
    spot,
    bushPropId: picked.bushPropId,
    grassTuft: null,
    bushShake: 0,
    item: null,
    running: false,
    revealed: false,
    modalDueAt: null,
    goldFlashUntil: 0,
    decals: [],
    particles: [],
  };
}

/** Drop whatever the pet is doing so the notice hold can own the body. */
function settleForNotice(world: World, actor: Actor, spot: { x: number; y: number }): void {
  const carried = world.items.find((item) => item.state === 'carried' && item.holderId === actor.id);
  if (carried) {
    carried.state = 'free';
    carried.holderId = undefined;
    carried.x = actor.mouth.x;
    carried.y = actor.y + 1;
    carried.z = Math.max(0, actor.y - actor.z - actor.mouth.y);
    carried.vx = actor.face * 30;
    carried.vy = 0;
    carried.vz = 0;
  }
  actor.play = null;
  actor.direction = null;
  actor.zoom = null;
  actor.cuddle = null;
  actor.furniture = null;
  actor.asleep = false;
  actor.task = { type: 'idle', stage: 'parkNotice', t: 0, bats: 0, cool: 0 };
  actor.idle = { mode: 'still', t: 0, dur: 999, target: null, sit: false, arrived: true };
  if (Math.abs(spot.x - actor.x) > 4) {
    actor.face = spot.x >= actor.x ? 1 : -1;
  }
}

function releaseNoticeHold(world: World): void {
  const host = world.actors.find((actor) => !actor.guest);
  if (!host || host.task.type !== 'idle' || host.task.stage !== 'parkNotice') {
    return;
  }
  host.task.stage = '';
  host.idle.dur = 0;
  host.idle.t = 0.01;
}

export function dismissParkFindPrompt(world: World): void {
  const visit = world.parkFindVisit;
  if (!visit || !visit.prompting) return;
  visit.prompting = false;
  visit.used = true;
  visit.armed = false;
  releaseNoticeHold(world);
  visit.grassTuft = null;
  visit.bushShake = 0;
  visit.variant = null;
}

export function acceptParkFindPrompt(
  world: World,
  actor: Actor,
  species: 'dog' | 'cat',
): ParkFindCatalogRow | null {
  const visit = world.parkFindVisit;
  if (!visit || !visit.prompting || !visit.spot || !visit.variant) {
    return null;
  }
  const debug = parkFindDebug();
  const sky = skyAt(debug.overrides?.date ?? new Date());
  const item = rollParkFind(species, sky, world.rng, {
    forceRarity: debug.forceRarity,
    forceItemId: debug.forceItemId,
    overrides: debug.overrides,
  });
  visit.prompting = false;
  visit.used = true;
  visit.item = item;
  if (!item) {
    visit.grassTuft = null;
    visit.bushShake = 0;
    releaseNoticeHold(world);
    return null;
  }
  visit.running = true;
  beginParkFind(actor, {
    variant: visit.variant,
    itemId: item.id,
    rarity: item.rarity,
    spot: visit.spot,
    bushPropId: visit.bushPropId,
  });
  return item;
}

/** Start the notice cue when its timer is up. The pet does not have to be idle. */
export function tickParkFindVisit(
  world: World,
  actor: Actor,
  species: 'dog' | 'cat',
  dt: number,
): void {
  const visit = world.parkFindVisit;
  if (!visit || (visit.used && !visit.running && !visit.prompting)) {
    return;
  }
  if (visit.prompting) {
    // Prompt stays until "Let's see!" or another player action — no auto-timeout.
    if (visit.variant === 'grass' && visit.grassTuft) {
      visit.grassTuft.grow = Math.min(1, visit.grassTuft.grow + dt / 0.3);
      visit.grassTuft.shake = Math.sin(world.t * Math.PI * 2 * 4) * 7;
    }
    if (visit.variant === 'bush') {
      visit.bushShake = Math.sin(world.t * Math.PI * 2 * 2) * 1.5;
    }
    return;
  }

  if (!visit.armed || visit.used || visit.running || !visit.spot || !visit.variant) {
    return;
  }
  if (world.t < visit.noticeAt) {
    return;
  }

  visit.prompting = true;
  visit.promptStartedAt = world.t;
  if (visit.variant === 'grass') {
    visit.grassTuft = { x: visit.spot.x, y: visit.spot.y, grow: 0, shake: 0, shrinkAt: null };
  }
  if (visit.variant === 'bush') {
    visit.bushShake = 1.5;
  }
  settleForNotice(world, actor, visit.spot);
  void species;
}

export function forceParkFindNoticeNow(
  world: World,
  actor: Actor,
  species: 'dog' | 'cat',
  variant: FindVariant,
): void {
  setParkFindDebug({ forceNotice: variant });
  const visit = createParkFindVisit(world, actor, species, false, world.t);
  visit.armed = true;
  visit.used = false;
  visit.noticeAt = world.t;
  visit.variant = variant;
  const picked = pickVariant(species, world.scene, world.rng, variant);
  if (picked.spotAdjust) {
    visit.spot = picked.spotAdjust;
    visit.bushPropId = picked.bushPropId;
  } else if (!visit.spot) {
    visit.spot = pickFindSpot(world.scene, actor, world.rng, world.stageBleed);
  }
  world.parkFindVisit = visit;
}

export function spawnDirt(visit: ParkFindVisit, x: number, y: number, rng: () => number): void {
  if (visit.particles.filter((p) => p.kind === 'dirt').length >= parkFinds.particlePool) {
    return;
  }
  const colors = ['#8A5A2B', '#6E4422', '#9A6A3A'];
  visit.particles.push({
    kind: 'dirt',
    x,
    y,
    vx: -40 - rng() * 60,
    vy: -70 - rng() * 40,
    life: 0,
    maxLife: 0.5,
    color: colors[Math.floor(rng() * colors.length)] ?? '#8A5A2B',
    size: 2.2 + rng() * 1.2,
  });
}

export function ensureHole(visit: ParkFindVisit, x: number, y: number, now: number): void {
  let hole = visit.decals.find((d) => Math.hypot(d.x - x, d.y - y) < 12);
  if (!hole) {
    hole = { x, y, bornAt: now, hole: 0, mound: 0 };
    visit.decals.push(hole);
    if (visit.decals.length > parkFinds.maxHoles) {
      visit.decals.shift();
    }
  }
  hole.hole = Math.min(1, hole.hole + 0.02);
  hole.mound = Math.min(1, hole.mound + 0.02);
}

export function updateFindFx(visit: ParkFindVisit, dt: number, now: number): void {
  visit.particles = visit.particles
    .map((p) => ({
      ...p,
      life: p.life + dt,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      vy: p.vy + (p.kind === 'dirt' ? 180 : 40) * dt,
    }))
    .filter((p) => p.life < p.maxLife);
  visit.decals = visit.decals.filter((d) => now - d.bornAt < parkFinds.holeFadeSec);
  if (visit.grassTuft?.shrinkAt != null && now >= visit.grassTuft.shrinkAt) {
    visit.grassTuft.grow = Math.max(0, visit.grassTuft.grow - dt);
    if (visit.grassTuft.grow <= 0) {
      visit.grassTuft = null;
    }
  }
}
