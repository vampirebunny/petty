import {
  COLLECT,
  FOG_START_M,
  GRAVITY,
  INTRO,
  JUMP_V,
  PTS_COIN,
  PTS_EXTRA_UMBRELLA,
  PTS_NEAR,
  PTS_PERFECT,
  PTS_PER_M,
  PX_PER_M,
  WORLD_W,
  ZONES,
} from './content';
import type { CollectKind } from './content';
import { birdPoints, gen, mulberry32 } from './generator';
import type { Banner, Cloud, PetBody, Run, RunStats } from './types';

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function metersOf(run: Run): number {
  return Math.floor((run.startY - run.bestY) / PX_PER_M);
}

export function scoreOf(run: Run): number {
  return metersOf(run) * PTS_PER_M + run.pts;
}

export function multiplierOf(combo: number): number {
  return Math.min(5, 1 + Math.floor(combo / 5));
}

function emptyStats(): RunStats {
  return { collect: 0, tokens: 0, maxCombo: 0, perfect: 0, bouncy: 0, near: 0 };
}

function banner(run: Run, eye: string, title: string, sub: string): void {
  run.bannerQ.push({ eye, title, sub });
}

function say(run: Run, x: number, y: number, txt: string, col: string, size = 18): void {
  run.fx.push({ x, y, txt, life: 1.1, col, size });
}

function addPts(run: Run, amount: number, x: number, y: number, col: string, pre = ''): void {
  run.pts += amount;
  run.fx.push({
    x,
    y,
    txt: `${pre}+${amount}`,
    life: 1,
    col: col || '#d1900f',
    size: amount >= 100 ? 24 : 18,
  });
}

function faceVelocity(pet: PetBody): void {
  if (Math.abs(pet.vx) > 20) {
    pet.face = pet.vx >= 0 ? 1 : -1;
  }
}

function jump(run: Run): void {
  const pet = run.pet;
  if (!pet.on || pet.dead) {
    return;
  }
  const cloud = pet.on;
  pet.vy = -JUMP_V;
  pet.vx = cloud.vx * 0.95;
  faceVelocity(pet);
  pet.on = null;
  pet.sq = -0.18;
  pet.noCut = false;
  pet.cut = false;
  run.jumpBuf = 0;
  run.sounds.push('jump');
}

function land(run: Run, cloud: Cloud): void {
  const pet = run.pet;
  const fresh = cloud !== pet.lastCloud;
  pet.on = cloud;
  pet.rel = clamp(pet.x - cloud.x, -cloud.w / 2 + 8, cloud.w / 2 - 8);
  pet.y = cloud.y;
  pet.vy = 0;
  pet.sq = 0.25;
  pet.lastCloud = cloud;
  if (fresh) {
    run.stand = 0;
    run.combo += 1;
    run.stats.maxCombo = Math.max(run.stats.maxCombo, run.combo);
    if (run.combo % 5 === 0 && run.combo <= 20) {
      say(run, pet.x, pet.y - 60, `×${multiplierOf(run.combo)} points!`, '#e2569b', 22);
    }
  }
  if (fresh && Math.abs(pet.x - cloud.x) < 10) {
    run.stats.perfect += 1;
    addPts(run, PTS_PERFECT * multiplierOf(run.combo), pet.x, pet.y - 50, '#e2569b', 'Perfect! ');
    pet.sq = 0.38;
  }
  if (cloud.type === 'rain' && cloud.timer < 0) {
    cloud.timer = 1.5;
  }
  if (cloud.type === 'bouncy') {
    cloud.sq = 0.6;
    if (fresh) {
      run.stats.bouncy += 1;
    }
    pet.on = null;
    pet.vy = -JUMP_V * 1.45;
    pet.vx = cloud.vx * 0.9;
    faceVelocity(pet);
    pet.noCut = true;
    run.jumpBuf = 0;
    run.sounds.push('big');
    return;
  }
  if (run.jumpBuf > 0) {
    jump(run);
  }
}

function markOver(run: Run): void {
  if (run.phase === 'over') {
    return;
  }
  run.phase = 'over';
  run.held = false;
  run.overId += 1;
}

function fatal(run: Run, cause: string): void {
  const pet = run.pet;
  if (pet.dead) {
    return;
  }
  if (run.invincible) {
    pet.on = null;
    pet.vy = -JUMP_V;
    pet.inv = Math.max(pet.inv, 0.4);
    if (pet.y > run.camY + run.H - 40) {
      pet.y = run.camY + run.H - 40;
    }
    return;
  }
  if (pet.umbrella) {
    pet.umbrella = false;
    pet.inv = 1.8;
    pet.umbAnim = 1.6;
    pet.on = null;
    pet.balloon = 0;
    pet.vy = -JUMP_V * 1.35;
    pet.noCut = true;
    if (pet.y > run.camY + run.H - 40) {
      pet.y = run.camY + run.H - 40;
    }
    run.fogY = Math.max(run.fogY, pet.y + 200);
    say(run, pet.x, pet.y - 60, 'Umbrella save!', '#e2569b', 22);
    return;
  }
  pet.dead = true;
  run.deathCause = cause;
  pet.on = null;
  run.held = false;
  if (cause.includes('fog')) {
    pet.sink = true;
    pet.vy = 120;
    pet.vx = 0;
  } else {
    pet.vy = -420;
    pet.vx = -pet.face * 60;
  }
}

function steal(run: Run, bird: Run['birds'][number]): void {
  const pet = run.pet;
  const lose = Math.min(run.pts, 100);
  run.pts -= lose;
  if (lose) {
    say(run, pet.x, pet.y - 50, `-${lose}`, '#7a5f8f', 20);
  }
  pet.inv = 1;
  pet.vx = (pet.x < bird.x ? -1 : 1) * 220;
  bird.flee = true;
  bird.vy = -240;
  bird.vx *= 1.6;
}

function tickBanner(run: Run, dt: number): void {
  if (run.bannerT > 0) {
    run.bannerT -= dt;
    if (run.bannerT <= 0) {
      run.banner = null;
      run.bannerCool = 0.35;
    }
    return;
  }
  if (run.bannerCool > 0) {
    run.bannerCool -= dt;
    return;
  }
  if (run.bannerQ.length > 0 && run.phase === 'play') {
    run.banner = run.bannerQ.shift() ?? null;
    run.bannerT = 2.1;
  }
}

function collectKind(kind: string): kind is CollectKind {
  return kind in COLLECT;
}

export function createRun(options: {
  seed: number;
  logicalH: number;
  seen: Set<string>;
  startMeters?: number;
  unlockAll?: boolean;
  invincible?: boolean;
}): Run {
  const rng = mulberry32(options.seed);
  const decor = mulberry32(options.seed ^ 0x9e3779b9);
  const H = options.logicalH;
  const by = H - 90;
  const startMeters = options.startMeters ?? 0;
  const base: Cloud = {
    id: 1,
    type: 'normal',
    x: WORLD_W / 2,
    y: by,
    baseY: by,
    prevY: by,
    w: 170,
    vx: 0,
    alpha: 1,
    timer: -1,
    sq: 0,
    amp: 34,
    ph: 0,
    es: 0,
    th: 0,
    announce: false,
  };
  const pet: PetBody = {
    x: WORLD_W / 2,
    y: by,
    vx: 0,
    vy: 0,
    on: base,
    rel: 0,
    face: 1,
    sq: 0,
    dead: false,
    sink: false,
    rot: 0,
    inv: 0,
    balloon: 0,
    magnet: 0,
    umbrella: false,
    umbAnim: 0,
    noCut: false,
    cut: false,
    lastCloud: base,
  };
  const run: Run = {
    W: WORLD_W,
    H,
    seed: options.seed,
    rng,
    phase: 'menu',
    t: 0,
    time: 0,
    pet,
    clouds: [base],
    items: [],
    birds: [],
    winds: [],
    fx: [],
    sounds: [],
    camY: 0,
    startY: by + startMeters * PX_PER_M,
    topY: by,
    topCloud: base,
    bestY: by,
    pts: 0,
    cloudCount: 0,
    nextId: 2,
    introduced: new Set(),
    seen: options.seen,
    freshSeen: [],
    zoneIdx: 0,
    fogY: by + startMeters * PX_PER_M + 130,
    fogOn: false,
    combo: 0,
    stand: 0,
    stats: emptyStats(),
    slowT: 0,
    jumpBuf: 0,
    deathCause: '',
    overId: 0,
    held: false,
    ptrX: WORLD_W / 2,
    invincible: options.invincible ?? false,
    unlockAll: options.unlockAll ?? false,
    hitboxes: false,
    banner: null,
    bannerT: 0,
    bannerCool: 0,
    bannerQ: [],
    stars: Array.from({ length: 70 }, () => ({
      x: decor() * WORLD_W,
      y: decor(),
      r: 0.6 + decor() * 1.2,
      p: decor() * 6,
    })),
    far: Array.from({ length: 7 }, (_, i) => ({
      x: decor() * WORLD_W,
      y: i * 260,
      w: 60 + decor() * 60,
    })),
  };
  gen(run);
  return run;
}

export function pointerDown(run: Run, x: number): void {
  if (run.phase !== 'play' || run.pet.dead) {
    return;
  }
  run.held = true;
  run.ptrX = x;
  run.jumpBuf = 0.14;
  if (run.pet.on) {
    jump(run);
  }
}

export function pointerMove(run: Run, x: number): void {
  if (run.held) {
    run.ptrX = x;
  }
}

export function pointerUp(run: Run): void {
  run.held = false;
}

export function pauseRun(run: Run): void {
  if (run.phase !== 'play') {
    return;
  }
  run.phase = 'paused';
  run.held = false;
  run.banner = null;
  run.bannerT = 0;
}

export function resumeRun(run: Run): void {
  if (run.phase !== 'paused') {
    return;
  }
  run.phase = 'play';
}

export function endRun(run: Run): void {
  if (run.phase !== 'paused' && run.phase !== 'play') {
    return;
  }
  run.deathCause = 'You ended the run';
  markOver(run);
}

export function beginRun(run: Run): void {
  run.phase = 'play';
}

export function driftClouds(run: Run, dt: number): void {
  run.t += dt;
  for (const cloud of run.clouds) {
    cloud.x += cloud.vx * dt * 0.5;
    const half = cloud.w / 2 + 6;
    if (cloud.x < half || cloud.x > run.W - half) {
      cloud.vx *= -1;
    }
  }
}

export function step(run: Run, dt: number): void {
  if (run.phase !== 'play') {
    return;
  }
  const pet = run.pet;
  run.t += dt;
  for (const cloud of run.clouds) {
    cloud.prevY = cloud.y;
    if (cloud.type === 'elevator') {
      cloud.y = cloud.baseY + Math.sin(run.t * cloud.es + cloud.ph) * cloud.amp;
    }
    cloud.x += cloud.vx * dt;
    const half = cloud.w / 2 + 6;
    if (cloud.x < half) {
      cloud.x = half;
      cloud.vx = Math.abs(cloud.vx);
    }
    if (cloud.x > run.W - half) {
      cloud.x = run.W - half;
      cloud.vx = -Math.abs(cloud.vx);
    }
    cloud.sq *= Math.pow(0.002, dt);
    if (cloud.type === 'rain' && cloud.timer >= 0) {
      cloud.timer -= dt;
      cloud.alpha = cloud.timer < 0.5 ? Math.max(0, cloud.timer / 0.5) : 1;
      if (cloud.timer <= 0) {
        cloud.gone = true;
        if (pet.on === cloud) {
          pet.on = null;
        }
      }
    }
    if (cloud.type === 'thunder') {
      cloud.th += dt;
      const cycle = cloud.th % 3.2;
      const zap = cycle > 2.9;
      cloud.warn = cycle > 2.15 && !zap;
      cloud.zap = zap;
      if (zap && pet.on === cloud && !(pet.inv > 0)) {
        fatal(run, 'Zapped by a thundercloud');
      }
    }
  }
  for (const bird of run.birds) {
    if (bird.kind === 'flock') {
      bird.off += bird.vx * dt;
      continue;
    }
    if (bird.flee) {
      bird.x += bird.vx * dt;
      bird.y += bird.vy * dt;
      if (bird.y - run.camY < -60 || bird.x < -60 || bird.x > run.W + 60) {
        bird.gone = true;
      }
      continue;
    }
    if (bird.kind === 'diver') {
      if (bird.st === 'patrol') {
        bird.x += bird.vx * dt;
        if (bird.x < 30 || bird.x > run.W - 30) {
          bird.vx *= -1;
        }
        const sy = bird.y - run.camY;
        const py = pet.y - 18;
        if (!pet.dead && sy > 40 && py > bird.y + 30 && py - bird.y < 300 && Math.abs(pet.x - bird.x) < 140) {
          bird.st = 'warn';
          bird.tm = 0.65;
        }
      } else if (bird.st === 'warn') {
        bird.tm -= dt;
        if (bird.tm <= 0) {
          const dx = pet.x - bird.x;
          const dy = pet.y - 18 - bird.y;
          const dist = Math.hypot(dx, dy) || 1;
          bird.dx = (dx / dist) * 360;
          bird.dy = (dy / dist) * 360;
          bird.st = 'dive';
        }
      } else {
        bird.x += bird.dx * dt;
        bird.y += bird.dy * dt;
        if (bird.x < -60 || bird.x > run.W + 60) {
          bird.gone = true;
        }
      }
      continue;
    }
    bird.x += bird.vx * dt;
    if (bird.vx > 0 && bird.x > run.W + 40) {
      bird.x = -40;
    }
    if (bird.vx < 0 && bird.x < -40) {
      bird.x = run.W + 40;
    }
  }
  run.clouds = run.clouds.filter((cloud) => !cloud.gone);
  if (run.jumpBuf > 0) {
    run.jumpBuf -= dt;
  }
  pet.inv = Math.max(0, pet.inv - dt);
  pet.magnet = Math.max(0, pet.magnet - dt);
  pet.umbAnim = Math.max(0, pet.umbAnim - dt);
  const held = run.held;

  if (pet.on) {
    pet.x = pet.on.x + pet.rel;
    pet.y = pet.on.y;
    if (!pet.dead) {
      run.stand += dt;
      if (run.stand > 1.8 && run.combo > 0) {
        if (run.combo >= 3) {
          say(run, pet.x, pet.y - 50, 'Combo lost', '#7a5f8f', 15);
        }
        run.combo = 0;
      }
      if (run.jumpBuf > 0) {
        jump(run);
      }
    }
  } else {
    const py = pet.y;
    if (pet.balloon > 0) {
      pet.balloon -= dt;
      pet.vy = -340;
      if (pet.balloon <= 0) {
        pet.vy = -160;
      }
    } else {
      pet.vy += GRAVITY * dt;
    }
    if (!pet.dead) {
      if (!pet.noCut && !pet.cut && !held && pet.vy < 0) {
        pet.vy *= 0.55;
        pet.cut = true;
      }
      let steer = 0;
      if (held) {
        const dx = run.ptrX - pet.x;
        steer = Math.abs(dx) < 8 ? 0 : clamp(dx / 50, -1, 1);
      }
      pet.vx += steer * 1500 * dt;
      if (!steer) {
        pet.vx *= 1 - 0.5 * dt;
      }
      for (const wind of run.winds) {
        if (pet.y - 18 > wind.y0 && pet.y - 18 < wind.y1) {
          pet.vx += wind.dir * 520 * dt;
        }
      }
      pet.vx = clamp(pet.vx, -280, 280);
      faceVelocity(pet);
    } else if (!pet.sink) {
      pet.rot += dt * 9 * -pet.face;
    }
    pet.x += pet.vx * dt;
    pet.y += pet.vy * dt;
    if (pet.x < 14) {
      pet.x = 14;
      pet.vx = Math.abs(pet.vx) * 0.3;
    }
    if (pet.x > run.W - 14) {
      pet.x = run.W - 14;
      pet.vx = -Math.abs(pet.vx) * 0.3;
    }
    if (!pet.dead && pet.vy > 0 && pet.balloon <= 0) {
      for (const cloud of run.clouds) {
        if (cloud.alpha < 0.3) {
          continue;
        }
        if (py <= cloud.prevY + 3 && pet.y >= cloud.y && Math.abs(pet.x - cloud.x) < cloud.w / 2 + 4) {
          land(run, cloud);
          break;
        }
      }
    }
  }
  pet.sq *= Math.pow(0.0005, dt);

  if (!pet.dead) {
    run.bestY = Math.min(run.bestY, pet.y);
    const cx = pet.x;
    const cy = pet.y - 18;
    for (const item of run.items) {
      if (item.got) {
        continue;
      }
      if ((item.k === 'coin' || collectKind(item.k)) && pet.magnet > 0) {
        const dx = cx - item.x;
        const dy = cy - item.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 170 && dist > 1) {
          item.x += (dx / dist) * 420 * dt;
          item.y += (dy / dist) * 420 * dt;
        }
      }
      if (Math.hypot(item.x - cx, item.y - cy) > 26) {
        continue;
      }
      item.got = true;
      const mult = multiplierOf(run.combo);
      if (item.k === 'coin') {
        run.stats.tokens += 1;
        addPts(run, PTS_COIN * mult, item.x, item.y, '#e2569b');
      } else if (collectKind(item.k)) {
        run.stats.collect += 1;
        addPts(run, COLLECT[item.k].pts * mult, item.x, item.y, COLLECT[item.k].col);
        run.sounds.push('squeak');
      } else if (item.k === 'magnet') {
        pet.magnet = 7;
        say(run, item.x, item.y, 'Magnet!', '#e2569b');
      } else if (item.k === 'balloon') {
        pet.balloon = 2.4;
        pet.on = null;
        say(run, item.x, item.y, 'Balloon!', '#e2569b');
      } else if (item.k === 'umbrella') {
        if (pet.umbrella) {
          addPts(run, PTS_EXTRA_UMBRELLA * mult, item.x, item.y, '#e2569b');
        } else {
          pet.umbrella = true;
          say(run, item.x, item.y, 'Umbrella!', '#e2569b');
        }
      }
    }
    const safe = pet.inv > 0 || pet.balloon > 0;
    for (const bird of run.birds) {
      if (bird.flee) {
        continue;
      }
      let hit = false;
      let minD = 1e9;
      for (const point of birdPoints(bird)) {
        const dx = Math.abs(point.x - cx);
        const dy = Math.abs(point.y - cy);
        if (dx < 21 && dy < 16) {
          hit = true;
        }
        minD = Math.min(minD, Math.hypot(dx, dy));
      }
      if (hit && !safe) {
        if (bird.kind === 'crow') {
          steal(run, bird);
        } else {
          fatal(
            run,
            bird.kind === 'flock' ? 'Bonked by the flock' : bird.kind === 'diver' ? 'A diving bird got you' : 'A bird bonked you',
          );
        }
        break;
      }
      if (bird.kind !== 'crow' && !bird.nm && !safe) {
        if (minD < 52) {
          bird.close = true;
        } else if (bird.close && minD > 80) {
          bird.nm = true;
          run.stats.near += 1;
          run.slowT = 0.45;
          addPts(run, PTS_NEAR * multiplierOf(run.combo), cx, cy - 40, '#e2569b', 'Close one! ');
        }
      }
    }
    if (run.fogOn && pet.y - 12 > run.fogY) {
      fatal(run, 'The fog caught you');
    }
  }

  const target = pet.y - run.H * 0.58;
  if (!pet.dead && target < run.camY) {
    run.camY += (target - run.camY) * Math.min(1, dt * 6);
  }
  const climbed = metersOf(run);
  if (!run.fogOn && climbed >= FOG_START_M) {
    run.fogOn = true;
    banner(run, `${FOG_START_M} m`, 'Here comes the fog', 'It rises from below. Keep climbing');
  }
  if (run.fogOn && !pet.dead) {
    run.fogY -= (14 + Math.min(56, (climbed - FOG_START_M) * 0.1)) * dt;
  }
  run.fogY = Math.min(run.fogY, run.camY + run.H + (run.fogOn ? 50 : 200));

  if (pet.y - run.camY > run.H + 70) {
    if (!pet.dead) {
      fatal(run, 'You fell off the clouds');
    } else {
      markOver(run);
      return;
    }
  }
  if (pet.dead && pet.sink && pet.y > run.fogY + 50) {
    markOver(run);
    return;
  }

  for (const list of [run.clouds, run.birds, run.winds] as const) {
    for (const object of list) {
      if (!object.announce) {
        continue;
      }
      const y = 'y0' in object ? object.y0 : object.y;
      const sy = y - run.camY;
      if (sy > 30 && sy < run.H - 60) {
        object.announce = false;
        const key = 'type' in object ? object.type : 'kind' in object ? object.kind : 'wind';
        const copy = INTRO[key];
        if (copy && !run.seen.has(key)) {
          run.seen.add(key);
          run.freshSeen.push(key);
          banner(run, 'New!', copy[0], copy[1]);
        }
      }
    }
  }
  const zone = Math.floor(metersOf(run) / 100);
  if (zone > run.zoneIdx) {
    run.zoneIdx = zone;
    banner(run, `${zone * 100} m`, ZONES[Math.min(zone, ZONES.length - 1)] ?? ZONES[ZONES.length - 1], '');
  }

  for (const floater of run.fx) {
    floater.life -= dt;
    floater.y -= 40 * dt;
  }
  run.fx = run.fx.filter((floater) => floater.life > 0);
  gen(run);
  tickBanner(run, dt);
}

export function takeSounds(run: Run): Run['sounds'] {
  return run.sounds.splice(0, run.sounds.length);
}

export function hudSignature(run: Run): string {
  const pet = run.pet;
  return [
    scoreOf(run),
    metersOf(run),
    run.combo,
    run.combo >= 2 && pet.on ? run.stand.toFixed(2) : '',
    Math.ceil(pet.magnet),
    pet.umbrella ? 1 : 0,
    run.banner?.title ?? '',
    run.bannerT > 0 ? 1 : 0,
  ].join('|');
}

export type { Banner };
