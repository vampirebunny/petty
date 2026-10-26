import { COLLECT, MIN_CLOUD_W, PX_PER_M, UNLOCK, WORLD_W } from './content';
import type { UnlockKey } from './content';
import type { Bird, Cloud, CloudType, Item, Run } from './types';

const FL_SP = 58;
const FL_LEN = WORLD_W + 120;

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

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function want(run: Run, key: UnlockKey, meters: number): boolean {
  return run.unlockAll || meters >= UNLOCK[key];
}

function cloudW(run: Run, level: number, type: CloudType): number {
  const k = clamp(level / 8, 0, 1);
  const lerp = (a: number, b: number) => a + (b - a) * k;
  const wide = lerp(0.3, 0.05);
  const med = lerp(0.45, 0.2);
  const small = lerp(0.25, 0.45);
  const r = run.rng();
  let w: number;
  if (r < wide) {
    w = 140 + run.rng() * 50;
  } else if (r < wide + med) {
    w = 90 + run.rng() * 35;
  } else if (r < wide + med + small) {
    w = 64 + run.rng() * 22;
  } else {
    w = 50 + run.rng() * 12;
  }
  w = Math.max(MIN_CLOUD_W, w * (1 - 0.3 * k));
  if (type === 'bouncy') {
    w = Math.min(w, 110);
  }
  if (type === 'thunder') {
    w = Math.max(w, 80);
  }
  return w;
}

function pickType(run: Run, meters: number, prev: CloudType): CloudType {
  let type: CloudType = 'normal';
  for (const key of ['bouncy', 'rain', 'elevator', 'thunder'] as const) {
    if (want(run, key, meters) && !run.introduced.has(key)) {
      type = key;
      break;
    }
  }
  if (type === 'normal') {
    const roll = run.rng();
    let acc = 0;
    for (const [key, chance] of [
      ['bouncy', 0.1],
      ['rain', 0.13],
      ['elevator', 0.11],
      ['thunder', 0.09],
    ] as const) {
      if (!want(run, key, meters)) {
        continue;
      }
      acc += chance;
      if (roll < acc) {
        type = key;
        break;
      }
    }
  }
  if (type === 'thunder' && prev === 'thunder') {
    return 'normal';
  }
  return type;
}

function spawnStuff(run: Run, cloud: Cloud, gap: number, meters: number, level: number): void {
  const y = cloud.y;
  if (run.rng() < 0.6) {
    run.items.push({
      k: 'coin',
      x: clamp(cloud.x + (run.rng() * 140 - 70), 24, WORLD_W - 24),
      y: y + gap * 0.5,
      ph: run.rng() * 6,
    });
  }
  if (run.cloudCount > 3) {
    const roll = run.rng();
    let kind: Item['k'] | null = null;
    if (meters >= 150 && roll < 0.006) {
      kind = 'star';
    } else if (meters >= 60 && roll < 0.022) {
      kind = 'bell';
    } else if (roll < 0.052) {
      kind = 'duck';
    } else if (roll < 0.102) {
      kind = 'yarn';
    } else if (roll < 0.19) {
      kind = 'biscuit';
    }
    if (kind && kind in COLLECT) {
      const easy = kind === 'biscuit' || kind === 'yarn';
      run.items.push({
        k: kind,
        x: easy ? clamp(cloud.x + (run.rng() * 60 - 30), 24, WORLD_W - 24) : 30 + run.rng() * (WORLD_W - 60),
        y: easy ? y - 70 : y + gap * (0.3 + run.rng() * 0.4),
        ph: run.rng() * 6,
      });
    }
  }
  if (meters >= 40 && run.rng() < 0.12) {
    const dir = cloud.x < WORLD_W / 2 ? 1 : -1;
    for (let i = 1; i <= 5; i++) {
      const x = cloud.x + dir * (cloud.w / 2 + i * 24);
      if (x < 20 || x > WORLD_W - 20) {
        break;
      }
      run.items.push({ k: 'coin', x, y: y - 150 * Math.sin((i / 6) * Math.PI), ph: i * 0.6 });
    }
  }
  const power = run.rng();
  if (meters >= 120 && power < 0.014) {
    run.items.push({ k: 'umbrella', x: cloud.x, y: y - 62, ph: 0 });
  } else if (meters >= 80 && power < 0.044) {
    run.items.push({ k: 'balloon', x: cloud.x, y: y - 62, ph: 0 });
  } else if (meters >= 30 && power < 0.084) {
    run.items.push({ k: 'magnet', x: cloud.x, y: y - 62, ph: 0 });
  }
  if (run.cloudCount > 8) {
    const hy = y + gap * (0.38 + run.rng() * 0.24);
    let kind: Bird['kind'] | null = null;
    for (const key of ['crow', 'diver', 'flock'] as const) {
      if (want(run, key, meters) && !run.introduced.has(key)) {
        kind = key;
        break;
      }
    }
    if (!kind) {
      const roll = run.rng();
      if (want(run, 'flock', meters) && roll < 0.08) {
        kind = 'flock';
      } else if (want(run, 'diver', meters) && roll < 0.19) {
        kind = 'diver';
      } else if (want(run, 'crow', meters) && roll < 0.32) {
        kind = 'crow';
      } else if (roll < 0.32 + Math.min(0.3, 0.12 + level * 0.04)) {
        kind = 'bird';
      }
    }
    if (kind) {
      const announce = kind !== 'bird' && !run.introduced.has(kind);
      run.introduced.add(kind);
      const spd = Math.min(200, 80 + level * 18) * (run.rng() < 0.5 ? -1 : 1);
      if (kind === 'flock') {
        run.birds.push({
          kind,
          y: hy,
          x: 0,
          off: run.rng() * 500,
          vx: spd * 0.55,
          gap: Math.floor(run.rng() * 7),
          announce,
          ph: 0,
          vy: 0,
          st: 'patrol',
          tm: 0,
          dx: 0,
          dy: 0,
        });
      } else if (kind === 'diver') {
        run.birds.push({
          kind,
          x: 40 + run.rng() * (WORLD_W - 80),
          y: hy - 20,
          vx: spd * 0.4,
          st: 'patrol',
          tm: 0,
          ph: run.rng() * 6,
          announce,
          off: 0,
          gap: 0,
          vy: 0,
          dx: 0,
          dy: 0,
        });
      } else {
        run.birds.push({
          kind,
          x: spd > 0 ? -30 : WORLD_W + 30,
          y: hy,
          vx: kind === 'crow' ? spd * 0.8 : spd,
          ph: run.rng() * 6,
          announce,
          off: 0,
          gap: 0,
          vy: 0,
          st: 'patrol',
          tm: 0,
          dx: 0,
          dy: 0,
        });
      }
      if (kind === 'bird' && run.rng() < 0.35) {
        run.items.push({
          k: run.rng() < 0.5 ? 'duck' : 'yarn',
          x: 40 + run.rng() * (WORLD_W - 80),
          y: hy,
          ph: run.rng() * 6,
        });
      }
    }
  }
  if (want(run, 'wind', meters) && (!run.introduced.has('wind') || run.rng() < 0.17)) {
    const announce = !run.introduced.has('wind');
    run.introduced.add('wind');
    run.winds.push({
      y0: y + 8,
      y1: y + gap - 8,
      dir: run.rng() < 0.5 ? -1 : 1,
      announce,
      seed: run.rng() * 300,
    });
  }
}

export function addCloud(run: Run): void {
  const meters = (run.startY - run.topY) / PX_PER_M;
  const level = meters / 50;
  const prev = run.topCloud;
  run.cloudCount += 1;
  const type = pickType(run, meters, prev.type);
  let gap = 98 + run.rng() * 22 + Math.min(28, level * 4);
  if (prev.type === 'bouncy') {
    gap = 190 + run.rng() * 45;
  }
  if (type === 'elevator' || prev.type === 'elevator') {
    gap += 28;
  }
  const y = run.topY - gap;
  const w = cloudW(run, level, type);
  let speed = Math.min(260, (70 + level * 22) * (0.8 + run.rng() * 0.4));
  if (w > 140) {
    speed *= 0.8;
  } else if (w < 66) {
    speed *= 0.9;
  }
  speed = Math.max(55, speed);
  if (type === 'elevator') {
    speed = 0;
  }
  const cloud: Cloud = {
    id: run.nextId++,
    type,
    x: w / 2 + 8 + run.rng() * (WORLD_W - w - 16),
    y,
    baseY: y,
    prevY: y,
    w,
    vx: speed * (run.rng() < 0.5 ? -1 : 1),
    amp: 34,
    ph: run.rng() * 6,
    es: Math.min(3.4, (1.3 + run.rng() * 0.6) * (1 + level * 0.08)),
    th: run.rng() * 2,
    timer: -1,
    alpha: 1,
    sq: 0,
    announce: type !== 'normal' && !run.introduced.has(type),
  };
  if (type !== 'normal') {
    run.introduced.add(type);
  }
  run.clouds.push(cloud);
  run.topCloud = cloud;
  run.topY = y;
  spawnStuff(run, cloud, gap, meters, level);
}

export function gen(run: Run): void {
  while (run.topY > run.camY - 320) {
    addCloud(run);
  }
  const cut = run.camY + run.H + 220;
  run.clouds = run.clouds.filter((cloud) => cloud.y < cut && !cloud.gone);
  run.items = run.items.filter((item) => item.y < cut && !item.got);
  run.birds = run.birds.filter((bird) => bird.y < cut && !bird.gone);
  run.winds = run.winds.filter((wind) => wind.y0 < cut);
  if (!run.clouds.includes(run.topCloud) && run.clouds.length > 0) {
    run.topCloud = run.clouds[run.clouds.length - 1];
  }
}

export function birdPoints(bird: Bird): { x: number; y: number }[] {
  if (bird.kind !== 'flock') {
    return [{ x: bird.x, y: bird.y }];
  }
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 9; i++) {
    if (i === bird.gap || i === bird.gap + 1) {
      continue;
    }
    points.push({
      x: (((bird.off + i * FL_SP) % FL_LEN) + FL_LEN) % FL_LEN - 60,
      y: bird.y + Math.abs(i - 4) * 5,
    });
  }
  return points;
}

export function generateUntil(run: Run, meters: number): void {
  const target = run.startY - meters * PX_PER_M;
  let guard = 0;
  while (run.topY > target && guard < 400) {
    run.camY = run.topY;
    gen(run);
    guard += 1;
  }
}
