import { BEAMS, POINTS, powerUpOffer, settingsFor, treatShape, levelAt, type Species } from './content';
import type { Acorn, Fx, Laser, Obstacle, Pattern, Phase, Pickup, Popup, Run, SoundName, Squad, Squirrel, SquirrelKind } from './types';

const PET_R = 13;
const PATTERNS: Pattern[] = ['snake', 'v', 'sweep', 'line'];
// The start card's lawn and run cycle.
export const MENU_SPEED = 95;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function newId(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const n = Math.floor(Math.random() * 16);
    const value = char === 'x' ? n : (n & 0x3) | 0x8;
    return value.toString(16);
  });
}

function squirrel(): Squirrel {
  return {
    alive: false,
    kind: 'scout',
    pattern: 'line',
    phase: 'move',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    hp: 1,
    r: 15,
    rot: 0,
    flash: 0,
    age: 0,
    i: 0,
    n: 1,
    cx: 200,
    dir: 1,
    hoverY: 80,
    locked: false,
    throwAt: 0,
    squadId: 0,
    d: 1,
    spin: 0,
  };
}

function obstacle(): Obstacle {
  return { alive: false, kind: 'rock', x: 0, y: 0, r: 16, half: 0, seed: 0 };
}

function laser(): Laser {
  return { alive: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0 };
}

function acorn(): Acorn {
  return { alive: false, x: 0, y: 0, vx: 0, vy: 0, spin: 0 };
}

function pickup(): Pickup {
  return { alive: false, kind: 'treat', shape: 'bone', x: 0, y: 0, vx: 0, vy: 0, choice: false, fade: 0, t: 0 };
}

function popup(): Popup {
  return { alive: false, x: 0, y: 0, text: '', color: '#e94b93', life: 0 };
}

function fx(): Fx {
  return { alive: false, kind: 'spark', x: 0, y: 0, life: 0, max: 0.2 };
}

function squad(): Squad {
  return { alive: false, id: 0, left: 0, escaped: false };
}

function fill<T>(count: number, make: () => T): T[] {
  return Array.from({ length: count }, make);
}

export function createRun(opts: { seed?: number; logicalH?: number; species?: Species } = {}): Run {
  const seed = opts.seed ?? Math.floor(Math.random() * 4294967296);
  const H = opts.logicalH ?? 800;
  const run: Run = {
    phase: 'menu',
    pausedFrom: 'play',
    H,
    t: 0,
    time: 0,
    seed,
    rng: mulberry32(seed),
    traveled: 0,
    awardedMeters: 0,
    score: 0,
    level: 1,
    groundSpeed: MENU_SPEED,
    groundTarget: MENU_SPEED,
    scroll: 0,
    laserLevel: 1,
    laserTimer: 0,
    cool: 0.14,
    hearts: 3,
    invuln: 0,
    shield: false,
    magnet: 0,
    petX: 200,
    petY: H - 120,
    petVx: 0,
    lean: 0,
    pendingDx: 0,
    pendingDy: 0,
    pointing: false,
    pointerX: 0,
    pointerY: 0,
    shake: 0,
    scorePop: 0,
    levelPop: 0,
    edge: 0,
    dieT: 0,
    species: opts.species ?? 'dog',
    runId: '',
    booped: 0,
    treats: 0,
    sounds: [],
    nextSquad: 1,
    squadTimer: 0.8,
    gliderTimer: 0,
    lobberTimer: 0,
    hoarderTimer: 0,
    obstacleTimer: 2.2,
    gliderOn: false,
    lobberOn: false,
    hoarderOn: false,
    squirrels: fill(36, squirrel),
    obstacles: fill(14, obstacle),
    lasers: fill(48, laser),
    acorns: fill(20, acorn),
    pickups: fill(24, pickup),
    popups: fill(24, popup),
    fx: fill(24, fx),
    squads: fill(8, squad),
  };
  return run;
}

function range(run: Run, min: number, max: number): number {
  return min + run.rng() * (max - min);
}

function sound(run: Run, name: SoundName): void {
  if (run.sounds.length < 12) {
    run.sounds.push(name);
  }
}

export function takeSounds(run: Run): SoundName[] {
  return run.sounds.splice(0, run.sounds.length);
}

export function metersOf(run: Run): number {
  return Math.floor(run.traveled / 10);
}

export function hudSignature(run: Run): string {
  return [
    run.score,
    run.hearts,
    run.laserLevel,
    run.level,
    metersOf(run),
    run.shield ? 1 : 0,
    Math.ceil(run.magnet),
    run.phase,
    run.scorePop > 0 ? 1 : 0,
    run.levelPop > 0 ? 1 : 0,
  ].join('|');
}

export function layoutRun(run: Run, H: number): void {
  run.H = H;
  clampPet(run);
}

export function clampPet(run: Run): void {
  run.petX = Math.max(16, Math.min(384, run.petX));
  run.petY = Math.max(0.3 * run.H, Math.min(run.H - 36, run.petY));
}

function clearAlive(run: Run): void {
  for (const item of run.squirrels) item.alive = false;
  for (const item of run.obstacles) item.alive = false;
  for (const item of run.lasers) item.alive = false;
  for (const item of run.acorns) item.alive = false;
  for (const item of run.pickups) item.alive = false;
  for (const item of run.popups) item.alive = false;
  for (const item of run.fx) item.alive = false;
  for (const item of run.squads) item.alive = false;
  run.sounds.length = 0;
}

export function beginRun(run: Run): void {
  run.rng = mulberry32(run.seed ^ (Math.floor(run.t * 1000) + 1));
  clearAlive(run);
  run.phase = 'play';
  run.pausedFrom = 'play';
  run.t = 0;
  run.time = 0;
  run.traveled = 0;
  run.awardedMeters = 0;
  run.score = 0;
  run.level = 1;
  run.groundSpeed = 110;
  run.groundTarget = 110;
  run.laserLevel = 1;
  run.laserTimer = 0;
  run.cool = 0.14;
  run.hearts = 3;
  run.invuln = 0;
  run.shield = false;
  run.magnet = 0;
  run.petX = 200;
  run.petY = Math.max(0.3 * run.H, run.H - 120);
  run.petVx = 0;
  run.lean = 0;
  run.pendingDx = 0;
  run.pendingDy = 0;
  run.shake = 0;
  run.scorePop = 0;
  run.levelPop = 0;
  run.edge = 0;
  run.dieT = 0;
  run.runId = newId();
  run.booped = 0;
  run.treats = 0;
  run.nextSquad = 1;
  run.squadTimer = 0.8;
  run.gliderTimer = 0;
  run.lobberTimer = 0;
  run.hoarderTimer = 0;
  run.obstacleTimer = 2.2;
  run.gliderOn = false;
  run.lobberOn = false;
  run.hoarderOn = false;
  clampPet(run);
}

export function pauseRun(run: Run): void {
  if (run.phase === 'play' || run.phase === 'dying') {
    run.pausedFrom = run.phase;
    run.phase = 'pause';
  }
}

export function resumeRun(run: Run): void {
  if (run.phase === 'pause') {
    run.phase = run.pausedFrom;
  }
}

export function endRun(run: Run): void {
  run.phase = 'over';
}

export function pointerDown(run: Run, x: number, y: number): void {
  run.pointing = true;
  run.pointerX = x;
  run.pointerY = y;
}

export function pointerMove(run: Run, x: number, y: number): void {
  if (!run.pointing) {
    return;
  }
  run.pendingDx += x - run.pointerX;
  run.pendingDy += y - run.pointerY;
  run.pointerX = x;
  run.pointerY = y;
}

export function pointerUp(run: Run): void {
  run.pointing = false;
}

export function claimSquirrel(run: Run): Squirrel | null {
  const slot = run.squirrels.find((item) => !item.alive);
  if (!slot) {
    return null;
  }
  slot.alive = true;
  slot.phase = 'move';
  slot.flash = 0;
  slot.age = 0;
  slot.vx = 0;
  slot.vy = 0;
  slot.locked = false;
  slot.spin = 0;
  slot.rot = 0;
  slot.squadId = 0;
  slot.hp = 1;
  slot.r = 15;
  slot.throwAt = 0;
  return slot;
}

export function claimObstacle(run: Run): Obstacle | null {
  const slot = run.obstacles.find((item) => !item.alive);
  if (!slot) {
    return null;
  }
  slot.alive = true;
  slot.half = 0;
  slot.seed = run.rng();
  return slot;
}

export function claimAcorn(run: Run): Acorn | null {
  const slot = run.acorns.find((item) => !item.alive);
  if (!slot) {
    return null;
  }
  slot.alive = true;
  slot.spin = 0;
  return slot;
}

export function claimPickup(run: Run): Pickup | null {
  const slot = run.pickups.find((item) => !item.alive);
  if (!slot) {
    return null;
  }
  slot.alive = true;
  slot.vx = 0;
  slot.vy = 0;
  slot.choice = false;
  slot.fade = 0;
  slot.t = 0;
  slot.shape = treatShape(run.species);
  slot.kind = 'treat';
  return slot;
}

export function claimSquad(run: Run): Squad | null {
  const slot = run.squads.find((item) => !item.alive);
  if (!slot) {
    return null;
  }
  slot.alive = true;
  slot.escaped = false;
  slot.left = 0;
  return slot;
}

function emit(run: Run, x: number, y: number, text: string, color: string): void {
  const slot = run.popups.find((item) => !item.alive);
  if (!slot) {
    return;
  }
  slot.alive = true;
  slot.x = x;
  slot.y = y;
  slot.text = text;
  slot.color = color;
  slot.life = 0.9;
}

function burst(run: Run, kind: Fx['kind'], x: number, y: number, max: number): void {
  const slot = run.fx.find((item) => !item.alive);
  if (!slot) {
    return;
  }
  slot.alive = true;
  slot.kind = kind;
  slot.x = x;
  slot.y = y;
  slot.life = max;
  slot.max = max;
}

function addScore(run: Run, points: number, x: number, y: number, text: string, color = '#e94b93'): void {
  if (points <= 0) {
    return;
  }
  run.score += points;
  run.scorePop = 0.25;
  emit(run, x, y, text, color);
}

function nearest(px: number, py: number, item: Obstacle): { d: number; dx: number; dy: number } {
  const ax = item.x - item.half;
  const span = item.half * 2;
  const t = span > 0 ? Math.max(0, Math.min(1, (px - ax) / span)) : 0;
  const cx = ax + span * t;
  const dx = px - cx;
  const dy = py - item.y;
  return { d: Math.hypot(dx, dy), dx, dy };
}

function resolveObstacles(run: Run): void {
  if (run.invuln > 0) {
    return;
  }
  for (const item of run.obstacles) {
    if (!item.alive) {
      continue;
    }
    const hit = nearest(run.petX, run.petY, item);
    const reach = PET_R + item.r;
    if (hit.d >= reach) {
      continue;
    }
    if (hit.d > 0.001) {
      const push = reach - hit.d;
      run.petX += (hit.dx / hit.d) * push;
      run.petY += (hit.dy / hit.d) * push;
    } else {
      run.petY += reach;
    }
  }
  clampPet(run);
}

function pinned(run: Run): boolean {
  if (run.invuln > 0 || run.petY < run.H - 36 - 0.5) {
    return false;
  }
  for (const item of run.obstacles) {
    if (!item.alive) {
      continue;
    }
    const hit = nearest(run.petX, run.petY, item);
    if (PET_R + item.r - hit.d > 3) {
      return true;
    }
  }
  return false;
}

function dropLaser(run: Run): void {
  if (run.laserLevel <= 1) {
    return;
  }
  run.laserLevel -= 1;
  run.laserTimer = run.laserLevel > 1 ? 18 : 0;
}

function hurt(run: Run): void {
  if (run.phase !== 'play' || run.invuln > 0) {
    return;
  }
  if (run.shield) {
    run.shield = false;
    run.invuln = 1;
    burst(run, 'ring', run.petX, run.petY - 6, 0.35);
    sound(run, 'bloop');
    return;
  }
  run.hearts -= 1;
  run.invuln = 1.6;
  run.shake = 0.3;
  dropLaser(run);
  sound(run, 'hurt');
  if (run.hearts <= 0) {
    run.phase = 'dying';
    run.dieT = 1.1;
    run.groundTarget = 0;
  }
}

function noteSquad(run: Run, id: number, escaped: boolean, x: number, y: number): void {
  if (id === 0) {
    return;
  }
  const group = run.squads.find((item) => item.alive && item.id === id);
  if (!group) {
    return;
  }
  group.left -= 1;
  if (escaped) {
    group.escaped = true;
  }
  if (group.left > 0) {
    return;
  }
  group.alive = false;
  if (group.escaped) {
    return;
  }
  const bonus = 300 * run.level;
  addScore(run, bonus, x, y - 34, `Squad +${bonus}`, '#c77d00');
  dropTreat(run, x, y);
}

function defeat(run: Run, mob: Squirrel): void {
  if (mob.phase === 'dazed') {
    return;
  }
  mob.phase = 'dazed';
  mob.age = 0;
  mob.spin = 0;
  const away = mob.x < 200 ? -1 : 1;
  mob.vx = away * range(run, 120, 200);
  mob.vy = -90;
  const points = POINTS[mob.kind] * run.level;
  run.booped += 1;
  addScore(run, points, mob.x, mob.y - 12, `+${points}`);
  sound(run, mob.kind === 'lobber' || mob.kind === 'hoarder' ? 'explode' : 'impact');
  if (mob.kind === 'hoarder') {
    for (let i = 0; i < 3; i += 1) {
      dropTreat(run, mob.x, mob.y);
    }
  } else if (mob.kind === 'lobber' && run.laserLevel < 4 && run.rng() < 0.25) {
    dropOffer(run, 'laser', mob.x, mob.y);
  }
  noteSquad(run, mob.squadId, false, mob.x, mob.y);
}

function escape(run: Run, mob: Squirrel): void {
  if (!mob.alive || mob.phase === 'dazed') {
    return;
  }
  mob.alive = false;
  noteSquad(run, mob.squadId, true, mob.x, mob.y);
}

export function hitSquirrel(run: Run, index: number, amount: number): void {
  const mob = run.squirrels[index];
  if (!mob || !mob.alive || mob.phase === 'dazed') {
    return;
  }
  mob.hp -= amount;
  mob.flash = 0.08;
  if (mob.hp <= 0) {
    defeat(run, mob);
  } else {
    sound(run, 'impact');
  }
}

function dropTreat(run: Run, x: number, y: number): void {
  const slot = claimPickup(run);
  if (!slot) {
    return;
  }
  slot.kind = 'treat';
  slot.shape = treatShape(run.species);
  slot.x = x;
  slot.y = y;
  slot.vx = range(run, -40, 40);
  slot.vy = -range(run, 30, 80);
}

function dropOffer(run: Run, kind: Pickup['kind'], x: number, y: number): void {
  const slot = claimPickup(run);
  if (!slot) {
    return;
  }
  slot.kind = kind;
  slot.x = x;
  slot.y = y;
  slot.vx = range(run, -20, 20);
  slot.vy = -40;
}

function layChoice(run: Run): void {
  const kinds = powerUpOffer(run.hearts, run.laserLevel, run.rng);
  const gap = kinds.length === 2 ? 150 : 110;
  const start = 200 - ((kinds.length - 1) * gap) / 2;
  kinds.forEach((kind, index) => {
    const slot = claimPickup(run);
    if (!slot) {
      return;
    }
    slot.kind = kind;
    slot.choice = true;
    slot.x = start + index * gap;
    slot.y = -40;
  });
}

function levelUp(run: Run): void {
  run.level += 1;
  run.groundTarget = settingsFor(run.level).ground;
  run.levelPop = 0.25;
  run.edge = 0.6;
  emit(run, 200, run.H * 0.42, `Level ${run.level}`, '#6b46c9');
  sound(run, 'badge');
  if (!run.gliderOn && run.level >= 2) {
    run.gliderOn = true;
    run.gliderTimer = 3;
  }
  if (!run.lobberOn && run.level >= 3) {
    run.lobberOn = true;
    run.lobberTimer = 4;
  }
  if (!run.hoarderOn && run.level >= 4) {
    run.hoarderOn = true;
    run.hoarderTimer = 20;
  }
  layChoice(run);
}

function movePet(run: Run, dx: number, dy: number): void {
  const dist = Math.hypot(dx, dy);
  if (dist === 0) {
    return;
  }
  const steps = Math.max(1, Math.ceil(dist / 10));
  for (let i = 0; i < steps; i += 1) {
    run.petX += dx / steps;
    run.petY += dy / steps;
    clampPet(run);
    resolveObstacles(run);
  }
}

function onScreen(mob: Squirrel): boolean {
  return mob.y > -8 && mob.x > -10 && mob.x < 410;
}

function beamHits(x: number, y: number, mob: Squirrel): boolean {
  return Math.hypot(x - mob.x, y - mob.y) < mob.r * 0.9 + 5;
}

function hitsObstacle(x: number, y: number, pad: number, run: Run): Obstacle | null {
  for (const item of run.obstacles) {
    if (item.alive && nearest(x, y, item).d < item.r + pad) {
      return item;
    }
  }
  return null;
}

function updateLasers(run: Run, dt: number): void {
  for (const beam of run.lasers) {
    if (!beam.alive) {
      continue;
    }
    beam.px = beam.x;
    beam.py = beam.y;
    beam.x += beam.vx * dt;
    beam.y += beam.vy * dt;
    const mx = (beam.x + beam.px) / 2;
    const my = (beam.y + beam.py) / 2;
    const blocked = hitsObstacle(beam.x, beam.y, 0, run) ?? hitsObstacle(mx, my, 0, run);
    if (blocked) {
      beam.alive = false;
      burst(run, 'spark', beam.x, beam.y + 6, 0.35);
      continue;
    }
    let struck = false;
    for (let index = 0; index < run.squirrels.length; index += 1) {
      const mob = run.squirrels[index];
      if (!mob || !mob.alive || mob.phase === 'dazed' || !onScreen(mob)) {
        continue;
      }
      if (beamHits(beam.x, beam.y, mob) || beamHits(mx, my, mob)) {
        hitSquirrel(run, index, 1);
        struck = true;
        break;
      }
    }
    if (struck || beam.y < -40 || beam.y > run.H + 20 || beam.x < -30 || beam.x > 430) {
      beam.alive = false;
    }
  }
}

function fire(run: Run): void {
  const pattern = BEAMS[run.laserLevel] ?? BEAMS[1];
  if (!pattern) {
    return;
  }
  for (const beam of pattern) {
    const slot = run.lasers.find((item) => !item.alive);
    if (!slot) {
      return;
    }
    const speed = 820;
    slot.alive = true;
    slot.x = run.petX + beam.x;
    slot.y = run.petY - 28;
    slot.px = slot.x;
    slot.py = slot.y;
    slot.vx = Math.sin(beam.a) * speed;
    slot.vy = -Math.cos(beam.a) * speed;
  }
  sound(run, 'laser');
}

function placeScout(run: Run, mob: Squirrel): void {
  const { i, n, cx, dir, d, age, pattern } = mob;
  const mid = (n - 1) / 2;
  if (pattern === 'snake') {
    const ti = age - 0.3 * i;
    mob.x = Math.max(20, Math.min(380, cx + 95 * Math.sin(2.1 * ti)));
    mob.y = -30 + 120 * d * ti;
  } else if (pattern === 'v') {
    mob.x = Math.max(18, Math.min(382, cx + (i - mid) * 42 + 28 * Math.sin(1.4 * age)));
    mob.y = -40 - Math.abs(i - mid) * 30 + 105 * d * age;
  } else if (pattern === 'sweep') {
    const ti = age - 0.28 * i;
    const start = dir > 0 ? -30 : 430;
    mob.x = start + dir * 175 * d * ti;
    mob.y = 70 + 40 * ti + 26 * Math.sin(2.2 * ti);
  } else {
    const span = n > 1 ? (i * 300) / (n - 1) : 150;
    mob.x = 50 + span + 22 * Math.sin(2.6 * age + i);
    mob.y = -30 + 95 * d * age;
  }
}

function throwAcorn(run: Run, mob: Squirrel): void {
  const slot = claimAcorn(run);
  if (!slot) {
    return;
  }
  const dx = run.petX - mob.x;
  const dy = run.petY - (mob.y + 6);
  const len = Math.hypot(dx, dy) || 1;
  const speed = 210 * mob.d;
  slot.x = mob.x;
  slot.y = mob.y + 6;
  slot.vx = (dx / len) * speed;
  slot.vy = (dy / len) * speed;
}

function updateSquirrel(run: Run, mob: Squirrel, dt: number): void {
  mob.flash = Math.max(0, mob.flash - dt);
  if (mob.phase === 'dazed') {
    mob.age += dt;
    mob.x += mob.vx * dt;
    mob.y += mob.vy * dt;
    mob.spin = mob.age * 9 * (mob.vx < 0 ? -1 : 1);
    if (mob.age > 0.9) {
      mob.alive = false;
    }
    return;
  }
  mob.age += dt;
  if (mob.kind === 'scout') {
    placeScout(run, mob);
    const own = mob.pattern === 'v' || mob.pattern === 'line' ? mob.age : mob.age - (mob.pattern === 'snake' ? 0.3 : 0.28) * mob.i;
    if (own > 1 && (mob.y > run.H + 40 || mob.x < -50 || mob.x > 450)) {
      escape(run, mob);
    }
    return;
  }
  if (mob.kind === 'glider') {
    if (mob.age < 0.8) {
      const u = mob.age / 0.8;
      const ease = u * u * (3 - 2 * u);
      mob.y = -30 + (mob.hoverY + 30) * ease;
      mob.x = mob.cx + Math.sin(mob.age * 8) * 4;
      return;
    }
    if (!mob.locked) {
      mob.locked = true;
      const dx = run.petX - mob.x;
      const dy = run.petY - mob.y;
      const len = Math.hypot(dx, dy) || 1;
      const speed = 330 * mob.d;
      mob.vx = (dx / len) * speed;
      mob.vy = Math.max(140 * mob.d, (dy / len) * speed);
      mob.rot = -Math.atan2(mob.vx, mob.vy);
    }
    mob.x += mob.vx * dt;
    mob.y += mob.vy * dt;
    if (mob.y > run.H + 40 || mob.x < -60 || mob.x > 460) {
      mob.alive = false;
    }
    return;
  }
  if (mob.kind === 'lobber') {
    if (mob.age < 1.2) {
      const u = mob.age / 1.2;
      const ease = u * u * (3 - 2 * u);
      mob.x = mob.cx;
      mob.y = -40 + (mob.hoverY + 40) * ease;
      return;
    }
    if (mob.age < 8) {
      mob.x = mob.cx + Math.sin(mob.age * 1.5) * 18;
      mob.y = mob.hoverY + Math.sin(mob.age * 3) * 4;
      if (mob.age >= mob.throwAt) {
        throwAcorn(run, mob);
        mob.throwAt = mob.age + 1.8 / mob.d;
      }
      return;
    }
    mob.y += 75 * dt;
    if (mob.y > run.H + 40) {
      mob.alive = false;
    }
    return;
  }
  mob.x = mob.cx + Math.sin(mob.age * 1.1) * 30;
  mob.y += 42 * mob.d * dt;
  if (mob.y > run.H + 50) {
    mob.alive = false;
  }
}

function updateAcorns(run: Run, dt: number): void {
  for (const nut of run.acorns) {
    if (!nut.alive) {
      continue;
    }
    nut.x += nut.vx * dt;
    nut.y += nut.vy * dt;
    nut.spin += dt * 6;
    if (hitsObstacle(nut.x, nut.y, 6, run)) {
      nut.alive = false;
      burst(run, 'puff', nut.x, nut.y, 0.35);
      continue;
    }
    if (Math.hypot(nut.x - run.petX, nut.y - (run.petY - 6)) < 15) {
      nut.alive = false;
      hurt(run);
      continue;
    }
    if (nut.y > run.H + 40 || nut.y < -80 || nut.x < -40 || nut.x > 440) {
      nut.alive = false;
    }
  }
}

function updatePickups(run: Run, dt: number): void {
  const damp = Math.pow(0.03, dt);
  for (const item of run.pickups) {
    if (!item.alive) {
      continue;
    }
    item.t += dt;
    if (item.fade > 0) {
      item.fade -= dt;
      if (item.fade <= 0) {
        item.alive = false;
      }
      continue;
    }
    item.x += item.vx * dt;
    item.y += item.vy * dt + run.groundSpeed * dt;
    if (!item.choice) {
      item.vx *= damp;
      item.vy *= damp;
    }
    if (item.y > run.H + 40) {
      item.alive = false;
    }
  }
}

function pullTreats(run: Run, dt: number): void {
  if (run.magnet <= 0) {
    return;
  }
  run.magnet = Math.max(0, run.magnet - dt);
  const ox = run.petX;
  const oy = run.petY - 6;
  for (const item of run.pickups) {
    if (!item.alive || item.kind !== 'treat' || item.fade > 0) {
      continue;
    }
    const dx = ox - item.x;
    const dy = oy - item.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 180 && dist > 1) {
      const step = Math.min(dist, 430 * dt);
      item.x += (dx / dist) * step;
      item.y += (dy / dist) * step;
    }
  }
}

function collect(run: Run, item: Pickup): void {
  if (item.choice) {
    for (const other of run.pickups) {
      if (other !== item && other.alive && other.choice && other.fade <= 0) {
        other.fade = 0.4;
      }
    }
  }
  if (item.kind === 'treat') {
    const points = 50 * run.level;
    run.treats += 1;
    addScore(run, points, item.x, item.y - 10, `+${points}`);
    sound(run, 'bloop');
  } else if (item.kind === 'laser') {
    run.laserLevel = Math.min(4, run.laserLevel + 1);
    run.laserTimer = 18;
    emit(run, item.x, item.y - 20, 'Laser up!', '#e0234f');
    sound(run, 'powerUp');
  } else if (item.kind === 'shield') {
    run.shield = true;
    emit(run, item.x, item.y - 20, 'Shield!', '#2a6fc4');
    sound(run, 'powerUp');
  } else if (item.kind === 'magnet') {
    run.magnet = 12;
    emit(run, item.x, item.y - 20, 'Magnet!', '#6b46c9');
    sound(run, 'powerUp');
  } else {
    run.hearts = Math.min(3, run.hearts + 1);
    emit(run, item.x, item.y - 20, '+1 heart', '#d23c82');
    sound(run, 'powerUp');
  }
  item.alive = false;
}

function collectPickups(run: Run): void {
  const ox = run.petX;
  const oy = run.petY - 6;
  for (const item of run.pickups) {
    if (!item.alive || item.fade > 0) {
      continue;
    }
    const radius = item.kind === 'treat' ? 24 : item.choice ? 32 : 24;
    if (Math.hypot(item.x - ox, item.y - oy) <= radius) {
      collect(run, item);
    }
  }
}

function contact(run: Run): void {
  const ox = run.petX;
  const oy = run.petY - 4;
  for (const mob of run.squirrels) {
    if (!mob.alive || mob.phase === 'dazed') {
      continue;
    }
    if (Math.hypot(mob.x - ox, mob.y - oy) < mob.r * 0.8 + 10) {
      defeat(run, mob);
      hurt(run);
    }
  }
}

function spawnSquad(run: Run): void {
  const group = claimSquad(run);
  if (!group) {
    return;
  }
  const n = run.level >= 6 ? 6 : 5;
  const pattern = PATTERNS[Math.floor(run.rng() * PATTERNS.length)] ?? 'line';
  const id = run.nextSquad;
  run.nextSquad += 1;
  group.id = id;
  group.left = 0;
  const d = settingsFor(run.level).d;
  const cx = pattern === 'line' ? 200 : range(run, 115, 285);
  const dir = run.rng() < 0.5 ? -1 : 1;
  for (let i = 0; i < n; i += 1) {
    const mob = claimSquirrel(run);
    if (!mob) {
      break;
    }
    mob.kind = 'scout';
    mob.pattern = pattern;
    mob.hp = 1;
    mob.r = 15;
    mob.i = i;
    mob.n = n;
    mob.cx = cx;
    mob.dir = dir;
    mob.d = d;
    mob.squadId = id;
    mob.age = 0;
    group.left += 1;
    placeScout(run, mob);
  }
  if (group.left === 0) {
    group.alive = false;
  }
}

function spawnKind(run: Run, kind: SquirrelKind): void {
  const mob = claimSquirrel(run);
  if (!mob) {
    return;
  }
  const d = settingsFor(run.level).d;
  mob.kind = kind;
  mob.d = d;
  mob.age = 0;
  if (kind === 'glider') {
    mob.hp = 1;
    mob.r = 15;
    mob.cx = range(run, 40, 360);
    mob.x = mob.cx;
    mob.hoverY = range(run, 50, 130);
    mob.y = -30;
    return;
  }
  if (kind === 'lobber') {
    mob.hp = run.level >= 9 ? 4 : 3;
    mob.r = 17;
    mob.cx = range(run, 60, 340);
    mob.x = mob.cx;
    mob.hoverY = range(run, 95, 185);
    mob.y = -40;
    mob.throwAt = 2.3;
    return;
  }
  mob.hp = 8;
  mob.r = 24;
  mob.cx = range(run, 80, 320);
  mob.x = mob.cx;
  mob.y = -40;
}

function lobberCount(run: Run): number {
  let count = 0;
  for (const mob of run.squirrels) {
    if (mob.alive && mob.kind === 'lobber' && mob.phase === 'move') {
      count += 1;
    }
  }
  return count;
}

function spawnObstacle(run: Run): void {
  const jitter = () => -60 + run.rng() * 30;
  if (run.level >= 2 && run.rng() < 0.3) {
    const slot = claimObstacle(run);
    if (!slot) {
      return;
    }
    const length = range(run, 130, 200);
    const left = run.rng() < 0.5;
    slot.kind = 'log';
    slot.r = 13;
    slot.half = length / 2;
    slot.x = left ? length / 2 - 12 : 412 - length / 2;
    slot.y = -60;
    return;
  }
  const pair = run.rng() < 0.35;
  const spots = pair ? [range(run, 45, 120), range(run, 280, 355)] : [range(run, 50, 350)];
  for (const x of spots) {
    const slot = claimObstacle(run);
    if (!slot) {
      return;
    }
    const rock = run.rng() < 0.55;
    slot.kind = rock ? 'rock' : 'stump';
    slot.r = rock ? range(run, 16, 28) : range(run, 17, 25);
    slot.half = 0;
    slot.x = x;
    slot.y = jitter();
  }
}

function tickSpawns(run: Run, dt: number): void {
  const settings = settingsFor(run.level);
  run.squadTimer -= dt;
  if (run.squadTimer <= 0) {
    spawnSquad(run);
    run.squadTimer = settings.squad * range(run, 0.85, 1.15);
  }
  if (run.gliderOn) {
    run.gliderTimer -= dt;
    if (run.gliderTimer <= 0) {
      spawnKind(run, 'glider');
      if (run.level >= 6 && run.rng() < 0.4) {
        spawnKind(run, 'glider');
      }
      run.gliderTimer = settings.glider * range(run, 0.8, 1.2);
    }
  }
  if (run.lobberOn) {
    run.lobberTimer -= dt;
    if (run.lobberTimer <= 0) {
      if (lobberCount(run) < Math.max(0, settings.lobberCap)) {
        spawnKind(run, 'lobber');
      }
      run.lobberTimer = range(run, 4, 6.5);
    }
  }
  if (run.hoarderOn) {
    run.hoarderTimer -= dt;
    if (run.hoarderTimer <= 0) {
      spawnKind(run, 'hoarder');
      run.hoarderTimer = settings.hoarder * range(run, 0.85, 1.15);
    }
  }
  run.obstacleTimer -= dt;
  if (run.obstacleTimer <= 0) {
    spawnObstacle(run);
    run.obstacleTimer = settings.obstacle + run.rng() * 1.3;
  }
}

function scrollWorld(run: Run, dt: number): void {
  const step = run.groundSpeed * dt;
  run.scroll += step;
  run.traveled += step;
  for (const item of run.obstacles) {
    if (item.alive) {
      item.y += step;
      if (item.y > run.H + 80) {
        item.alive = false;
      }
    }
  }
}

function easeSpeed(run: Run, dt: number): void {
  run.groundSpeed += (run.groundTarget - run.groundSpeed) * (1 - Math.exp(-3 * dt));
}

function decayVisuals(run: Run, dt: number): void {
  run.shake = Math.max(0, run.shake - dt);
  run.scorePop = Math.max(0, run.scorePop - dt);
  run.levelPop = Math.max(0, run.levelPop - dt);
  run.edge = Math.max(0, run.edge - dt);
  for (const item of run.popups) {
    if (!item.alive) {
      continue;
    }
    item.life -= dt;
    item.y -= 38 * dt;
    if (item.life <= 0) {
      item.alive = false;
    }
  }
  for (const item of run.fx) {
    if (!item.alive) {
      continue;
    }
    item.life -= dt;
    if (item.life <= 0) {
      item.alive = false;
    }
  }
}

export function step(run: Run, dt: number, reduced = false): Phase {
  const capped = Math.max(0, Math.min(0.033, dt));
  if (capped === 0 || run.phase === 'pause' || run.phase === 'over') {
    return run.phase;
  }
  run.t += capped;
  decayVisuals(run, capped);
  if (run.phase === 'menu') {
    run.groundSpeed = reduced ? 0 : MENU_SPEED;
    run.scroll += run.groundSpeed * capped;
    return run.phase;
  }
  run.time += capped;
  run.invuln = Math.max(0, run.invuln - capped);
  if (run.phase === 'dying') {
    run.dieT -= capped;
    run.groundTarget = 0;
    easeSpeed(run, capped);
    scrollWorld(run, capped);
    if (run.dieT <= 0) {
      run.phase = 'over';
    }
    return run.phase;
  }
  scrollWorld(run, capped);
  resolveObstacles(run);
  for (const mob of run.squirrels) {
    if (mob.alive) {
      updateSquirrel(run, mob, capped);
    }
  }
  updateAcorns(run, capped);
  updateLasers(run, capped);
  const dx = run.pendingDx;
  const dy = run.pendingDy;
  run.pendingDx = 0;
  run.pendingDy = 0;
  const beforeX = run.petX;
  movePet(run, dx, dy);
  const leanTarget = Math.max(-1, Math.min(1, dx / (capped * 900))) * 0.18;
  run.lean += (leanTarget - run.lean) * Math.min(1, capped * 12);
  const vx = (run.petX - beforeX) / capped;
  run.petVx += (vx - run.petVx) * Math.min(1, capped * 10);
  if (run.phase !== 'play') {
    return run.phase;
  }
  resolveObstacles(run);
  if (pinned(run)) {
    hurt(run);
  }
  if (run.phase !== 'play') {
    return run.phase;
  }
  contact(run);
  if (run.phase !== 'play') {
    return run.phase;
  }
  pullTreats(run, capped);
  updatePickups(run, capped);
  collectPickups(run);
  const whole = Math.floor(run.traveled / 10);
  if (whole > run.awardedMeters) {
    run.score += whole - run.awardedMeters;
    run.awardedMeters = whole;
    run.scorePop = 0.25;
  }
  while (run.level < levelAt(run.traveled / 10)) {
    levelUp(run);
  }
  if (run.laserLevel > 1) {
    run.laserTimer -= capped;
    if (run.laserTimer <= 0) {
      dropLaser(run);
    }
  }
  run.cool -= capped;
  if (run.cool <= 0) {
    fire(run);
    run.cool += 0.14;
    if (run.cool < 0) {
      run.cool = 0;
    }
  }
  easeSpeed(run, capped);
  tickSpawns(run, capped);
  return run.phase;
}
