import { mulberry32 } from '../cloudHop/generator';
import {
  BED,
  DEAD_BAND,
  FIRST_GATE_X,
  GAP_MIN,
  GAP_RAMP,
  GAP_START,
  GATE_W,
  HIT_R,
  MOVE_AMP,
  MOVE_CHANCE,
  PADDLE_DRIFT,
  PADDLE_SWIM,
  PET_X,
  POINTS,
  POPUP,
  PX_PER_M,
  SCROLL_BASE,
  SCROLL_CAP,
  SCROLL_RAMP,
  SINK_EASE,
  SINK_V,
  SPAWN_WHEN,
  SWIM_EASE,
  SWIM_V,
  SWING_BASE,
  SWING_CAP,
  SWING_RAMP,
  TILT_EASE,
  TOP,
  UNLOCK,
  WORLD_W,
} from './content';
import type { ItemKind } from './content';
import type { Bubble, Gate, Hazard, HitKind, Item, PaddleSound, Popup, Rng, Run } from './types';

function touchKey(id: number | string): string {
  return String(id);
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function range(rng: Rng, a: number, b: number): number {
  return a + rng() * (b - a);
}

export function floorY(run: Run): number {
  return run.H - BED;
}

export function metersOf(run: Run): number {
  return Math.floor(run.dist / PX_PER_M);
}

export function gateCenter(gate: Gate, time: number): number {
  return gate.c + Math.sin(time * 1.6 + gate.ph) * gate.amp;
}

export function itemY(item: Item, time: number): number {
  return item.g ? gateCenter(item.g, time) + item.dy : item.y;
}

export function jellyY(hazard: Hazard, time: number): number {
  return hazard.y0 + Math.sin(time * 2 + hazard.ph) * hazard.amp;
}

export function puffRadius(hazard: Hazard, time: number): { r: number; warn: boolean } {
  const cycle = (time * 0.9 + hazard.ph) % 2.4;
  if (cycle < 1.1) {
    return { r: 13, warn: false };
  }
  if (cycle < 1.45) {
    return { r: 13, warn: true };
  }
  if (cycle < 1.65) {
    return { r: 13 + (14 * (cycle - 1.45)) / 0.2, warn: false };
  }
  if (cycle < 2.2) {
    return { r: 27, warn: false };
  }
  return { r: 27 - (14 * (cycle - 2.2)) / 0.2, warn: false };
}

function circRect(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number): boolean {
  const nx = clamp(cx, x, x + w);
  const ny = clamp(cy, y, y + h);
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

function ambientBubble(run: Run, y?: number): Bubble {
  const floor = floorY(run);
  return {
    x: range(run.rng, 0, run.W),
    y: y ?? floor,
    r: range(run.rng, 1.5, 4),
    vy: -range(run.rng, 18, 40),
    life: 99,
    own: 0,
  };
}

function addPopup(run: Run, txt: string, x: number, y: number, col: string, size = 18): void {
  const popup: Popup = { txt, x, y, col, size, life: 0.8, vy: -50 };
  run.fx.push(popup);
}

function sound(run: Run, name: PaddleSound): void {
  run.sounds.push(name);
}

export function takeSounds(run: Run): PaddleSound[] {
  return run.sounds.splice(0, run.sounds.length);
}

export function createRun(options: {
  seed: number;
  logicalH: number;
  bestMeters?: number;
  bestScore?: number;
  rng?: Rng;
}): Run {
  const rng = options.rng ?? mulberry32(options.seed);
  const H = options.logicalH;
  const run: Run = {
    W: WORLD_W,
    H,
    seed: options.seed,
    rng,
    phase: 'ready',
    t: 0,
    decoT: 0,
    dist: 0,
    speed: SCROLL_BASE,
    pet: {
      x: PET_X,
      y: H * 0.45,
      vy: 0,
      rot: 0,
      inv: 0,
      shield: false,
      ph: 0,
      bubT: 0,
      spin: 0,
    },
    gates: [],
    hazards: [],
    items: [],
    fx: [],
    bubbles: [],
    kelp: [],
    sounds: [],
    spawnX: FIRST_GATE_X,
    prevGate: null,
    gateCount: 0,
    lastCenter: (TOP + (H - BED)) / 2,
    score: 0,
    bestMeters: options.bestMeters ?? 0,
    bestScore: options.bestScore ?? 0,
    cause: '',
    dieT: 0,
    lastDir: 0,
    bump: 0,
    overId: 0,
    reduced: false,
    touches: new Map(),
    touchOrder: [],
    seenHazards: new Set(),
  };
  for (let i = 0; i < 16; i += 1) {
    run.bubbles.push(ambientBubble(run, range(rng, TOP, floorY(run))));
  }
  for (let i = 0; i < 8; i += 1) {
    run.kelp.push({ x: i * 58 + range(rng, -10, 10), h: range(rng, 70, 170), ph: range(rng, 0, 6) });
  }
  return run;
}

function spawnGate(run: Run, x: number): void {
  const meters = metersOf(run);
  const floor = floorY(run);
  run.gateCount += 1;
  const gap = Math.max(GAP_MIN, GAP_START - meters * GAP_RAMP);
  let cmin = TOP + gap / 2 + 14;
  let cmax = floor - gap / 2 - 14;
  const moving = meters >= UNLOCK.moving && run.rng() < MOVE_CHANCE;
  const amp = moving ? Math.max(0, Math.min(MOVE_AMP, (cmax - cmin) / 2 - 2)) : 0;
  cmin += amp;
  cmax -= amp;
  const swing = Math.min(SWING_CAP, SWING_BASE + meters * SWING_RAMP);
  const center = clamp(run.lastCenter + range(run.rng, -swing, swing), cmin, cmax);
  const gate: Gate = { x, c: center, gap, amp, ph: range(run.rng, 0, 6.28), seed: run.rng() * 1000 };
  run.gates.push(gate);
  const shieldHere = meters >= UNLOCK.shield && !run.pet.shield && run.gateCount % 13 === 6;
  const mid: ItemKind = shieldHere ? 'shield' : meters >= UNLOCK.pearl && run.rng() < 0.35 ? 'pearl' : 'shell';
  for (const dx of [-24, 0, 24]) {
    run.items.push({
      k: dx === 0 ? mid : 'shell',
      x: x + GATE_W / 2 + dx,
      y: 0,
      g: gate,
      dy: 0,
      ph: range(run.rng, 0, 6),
    });
  }
  const prev = run.prevGate;
  if (prev) {
    const mx = (prev.x + x) / 2 + GATE_W / 2;
    const my = (prev.c + center) / 2;
    const roll = run.rng();
    let hazard: Hazard | null = null;
    if (meters >= UNLOCK.puffer && roll < 0.3) {
      hazard = {
        k: 'puffer',
        x: mx,
        y: clamp(my + range(run.rng, -70, 70), TOP + 30, floor - 30),
        y0: 0,
        amp: 0,
        ph: range(run.rng, 0, 2.4),
        bob: range(run.rng, 0, 6),
      };
      run.seenHazards.add('puffer');
    } else if (meters >= UNLOCK.jelly && roll < 0.68) {
      hazard = {
        k: 'jelly',
        x: mx,
        y: 0,
        y0: clamp(my + range(run.rng, -50, 50), TOP + 70, floor - 80),
        amp: range(run.rng, 35, 55),
        ph: range(run.rng, 0, 6.28),
        bob: 0,
      };
      run.seenHazards.add('jelly');
    }
    if (hazard) {
      run.hazards.push(hazard);
    }
    const special = run.gateCount % 11 === 0 ? 'chest' : run.gateCount % 4 === 0 ? 'gem' : null;
    if (special) {
      const base = hazard ? (hazard.k === 'puffer' ? hazard.y : hazard.y0) : my;
      const side = run.rng() < 0.5 ? -1 : 1;
      const offset = hazard ? 88 : range(run.rng, 70, 100);
      run.items.push({
        k: special,
        x: mx,
        y: clamp(base + side * offset, TOP + 18, floor - 22),
        g: null,
        dy: 0,
        ph: range(run.rng, 0, 6),
      });
    }
    if (!hazard) {
      for (const fraction of [0.33, 0.66]) {
        run.items.push({
          k: 'shell',
          x: prev.x + GATE_W / 2 + (x - prev.x) * fraction,
          y: prev.c + (center - prev.c) * fraction,
          g: null,
          dy: 0,
          ph: range(run.rng, 0, 6),
        });
      }
    }
  }
  run.lastCenter = center;
  run.prevGate = gate;
  run.spawnX = x;
}

function direction(run: Run): number {
  const order = run.touchOrder;
  if (order.length === 0) {
    return 0;
  }
  const y = run.touches.get(order[order.length - 1] ?? -1);
  if (y == null) {
    return 0;
  }
  const dy = y - run.pet.y;
  if (Math.abs(dy) < DEAD_BAND) {
    return 2;
  }
  return dy < 0 ? -1 : 1;
}

function hit(run: Run, kind: HitKind): void {
  if (run.pet.inv > 0 || run.phase !== 'play') {
    return;
  }
  if (run.pet.shield) {
    run.pet.shield = false;
    run.pet.inv = 1.3;
    sound(run, 'pop');
    addPopup(run, 'Pop!', PET_X, run.pet.y - 30, '#2f8fc0', 22);
    for (let i = 0; i < 10; i += 1) {
      run.bubbles.push({
        x: PET_X + range(run.rng, -24, 24),
        y: run.pet.y + range(run.rng, -24, 24),
        r: range(run.rng, 2, 5),
        vy: -range(run.rng, 60, 140),
        life: 1,
        own: 1,
      });
    }
    return;
  }
  run.phase = 'dying';
  run.dieT = 0;
  run.cause = kind;
  run.pet.vy = -90;
  sound(run, kind === 'jelly' ? 'zap' : 'bonk');
  addPopup(run, kind === 'jelly' ? 'Zap!' : 'Bonk!', PET_X, run.pet.y - 34, '#e2569b', 26);
}

function ambient(run: Run, dt: number, scroll: number): void {
  const deco = run.reduced ? 0 : dt;
  for (const kelp of run.kelp) {
    kelp.x -= scroll * 0.35;
    if (kelp.x < -30) {
      kelp.x += run.W + 60;
    }
  }
  if (deco > 0) {
    run.decoT += deco;
  }
  for (const bubble of run.bubbles) {
    if (!run.reduced) {
      bubble.y += bubble.vy * dt;
    }
    bubble.x -= scroll * (bubble.own ? 0.6 : 0.2);
    bubble.life -= dt;
  }
  run.bubbles = run.bubbles.filter((bubble) => bubble.y > TOP - 50 && bubble.life > 0 && bubble.x > -10);
  if (!run.reduced) {
    while (run.bubbles.filter((bubble) => !bubble.own).length < 16) {
      run.bubbles.push(ambientBubble(run));
    }
  }
}

function tickPopups(run: Run, dt: number, scroll: number): void {
  for (const popup of run.fx) {
    popup.y += popup.vy * dt;
    popup.x -= scroll * 0.3;
    popup.life -= dt;
  }
  run.fx = run.fx.filter((popup) => popup.life > 0);
  run.bump = Math.max(0, run.bump - dt);
}

function finish(run: Run): void {
  if (run.phase === 'over') {
    return;
  }
  run.phase = 'over';
  run.overId += 1;
  run.touches.clear();
  run.touchOrder = [];
}

function updatePlay(run: Run, dt: number): void {
  run.t += dt;
  const meters = metersOf(run);
  run.speed = Math.min(SCROLL_CAP, SCROLL_BASE + meters * SCROLL_RAMP);
  const scroll = run.speed * dt;
  run.dist += scroll;
  const dir = direction(run);
  if (dir === -1 && run.lastDir !== -1) {
    sound(run, 'up');
  }
  run.lastDir = dir;
  const target = dir === 2 ? 0 : dir === 0 ? SINK_V : dir * SWIM_V;
  const ease = dir === 0 ? SINK_EASE : SWIM_EASE;
  run.pet.vy += (target - run.pet.vy) * Math.min(1, dt * ease);
  run.pet.y += run.pet.vy * dt;
  const floor = floorY(run);
  if (run.pet.y < TOP) {
    run.pet.y = TOP;
    if (run.pet.vy < 0) {
      run.pet.vy = 0;
    }
  }
  if (run.pet.y > floor - 16) {
    run.pet.y = floor - 16;
    if (run.pet.vy > 0) {
      run.pet.vy = 0;
    }
  }
  const tilt = clamp(run.pet.vy / 700, -0.42, 0.42);
  run.pet.rot += (tilt - run.pet.rot) * Math.min(1, dt * TILT_EASE);
  if (!run.reduced) {
    run.pet.ph += dt * (dir ? PADDLE_SWIM : PADDLE_DRIFT);
    run.pet.bubT -= dt;
    if (run.pet.bubT <= 0) {
      run.pet.bubT = range(run.rng, 0.3, 0.6);
      run.bubbles.push({
        x: PET_X + 30,
        y: run.pet.y - 6 + run.pet.rot * 30,
        r: range(run.rng, 2, 3.5),
        vy: -range(run.rng, 40, 70),
        life: 1.6,
        own: 1,
      });
    }
  }
  run.pet.inv = Math.max(0, run.pet.inv - dt);

  for (const gate of run.gates) {
    gate.x -= scroll;
  }
  run.gates = run.gates.filter((gate) => gate.x > -GATE_W - 20);
  run.spawnX -= scroll;
  while (run.spawnX < SPAWN_WHEN) {
    spawnGate(run, run.spawnX + range(run.rng, 235, 285));
  }
  for (const hazard of run.hazards) {
    hazard.x -= scroll + (hazard.k === 'puffer' ? 45 * dt : 0);
  }
  run.hazards = run.hazards.filter((hazard) => hazard.x > -60);
  for (const item of run.items) {
    item.x -= scroll;
  }
  ambient(run, dt, scroll);

  for (const item of run.items) {
    const reach = HIT_R + (item.k === 'chest' ? 17 : 13);
    if (Math.hypot(item.x - PET_X, itemY(item, run.t) - run.pet.y) > reach) {
      continue;
    }
    item.got = true;
    if (item.k === 'shield') {
      run.pet.shield = true;
      sound(run, 'power');
      continue;
    }
    const pts = POINTS[item.k];
    const look = POPUP[item.k];
    run.score += pts;
    sound(run, item.k);
    addPopup(run, `+${pts}`, item.x, itemY(item, run.t) - 16, look.color, look.size);
    run.bump = 0.25;
    if (item.k === 'chest') {
      for (let i = 0; i < 8; i += 1) {
        run.bubbles.push({
          x: item.x + range(run.rng, -14, 14),
          y: itemY(item, run.t) + range(run.rng, -10, 10),
          r: range(run.rng, 2, 4),
          vy: -range(run.rng, 60, 120),
          life: 1,
          own: 1,
        });
      }
    }
  }
  run.items = run.items.filter((item) => !item.got && item.x > -30);

  if (run.phase === 'play') {
    for (const gate of run.gates) {
      if (run.pet.inv > 0 || run.phase !== 'play') {
        break;
      }
      if (gate.x > PET_X + HIT_R || gate.x + GATE_W < PET_X - HIT_R) {
        continue;
      }
      const center = gateCenter(gate, run.t);
      const gapTop = center - gate.gap / 2;
      const gapBottom = center + gate.gap / 2;
      if (circRect(PET_X, run.pet.y, HIT_R, gate.x, -60, GATE_W, gapTop + 60)) {
        hit(run, 'rock');
      } else if (circRect(PET_X, run.pet.y, HIT_R, gate.x, gapBottom - 2, GATE_W, run.H - gapBottom + 60)) {
        hit(run, 'coral');
      }
    }
  }
  if (run.phase === 'play') {
    for (const hazard of run.hazards) {
      if (run.pet.inv > 0 || run.phase !== 'play') {
        break;
      }
      if (hazard.k === 'jelly') {
        const y = jellyY(hazard, run.t);
        if (
          Math.hypot(hazard.x - PET_X, y - run.pet.y) < HIT_R + 14 ||
          circRect(PET_X, run.pet.y, HIT_R - 2, hazard.x - 10, y + 4, 20, 22)
        ) {
          hit(run, 'jelly');
        }
      } else {
        const puff = puffRadius(hazard, run.t);
        const y = hazard.y + Math.sin(run.t * 2 + hazard.bob) * 6;
        if (Math.hypot(hazard.x - PET_X, y - run.pet.y) < HIT_R + puff.r * 0.88) {
          hit(run, 'puffer');
        }
      }
    }
  }
  tickPopups(run, dt, scroll);
}

function updateDying(run: Run, dt: number): void {
  run.t += dt * 0.6;
  run.dieT += dt;
  run.pet.spin += dt * 8;
  run.pet.vy += (-50 - run.pet.vy) * dt * 2;
  const floor = floorY(run);
  run.pet.y = clamp(run.pet.y + run.pet.vy * dt, TOP, floor - 16);
  ambient(run, dt, 0);
  tickPopups(run, dt, 0);
  if (run.dieT > 1.1) {
    finish(run);
  }
}

function updateReady(run: Run, dt: number): void {
  run.t += dt;
  if (!run.reduced) {
    run.pet.ph += dt * 6;
    run.pet.y = run.H * 0.45 + Math.sin(run.t * 1.5) * 10;
    run.pet.rot = Math.cos(run.t * 1.5) * 0.08;
    run.decoT += dt;
  }
  ambient(run, dt, run.reduced ? 0 : 40 * dt);
  run.dist = (run.dist + (run.reduced ? 0 : 40 * dt)) % 2000;
}

export function step(run: Run, dt: number): void {
  if (run.phase === 'play') {
    updatePlay(run, dt);
  } else if (run.phase === 'dying') {
    updateDying(run, dt);
  } else if (run.phase === 'ready') {
    updateReady(run, dt);
  }
}

export function beginRun(run: Run): void {
  run.phase = 'play';
  run.t = 0;
  run.dist = 0;
  run.speed = SCROLL_BASE;
  run.score = 0;
  run.cause = '';
  run.dieT = 0;
  run.lastDir = 0;
  run.bump = 0;
  run.pet.y = run.H * 0.45;
  run.pet.vy = 0;
  run.pet.rot = 0;
  run.pet.inv = 0;
  run.pet.shield = false;
  run.pet.spin = 0;
  run.gates = [];
  run.hazards = [];
  run.items = [];
  run.fx = [];
  run.prevGate = null;
  run.gateCount = 0;
  run.lastCenter = (TOP + floorY(run)) / 2;
  run.spawnX = FIRST_GATE_X;
  run.touches.clear();
  run.touchOrder = [];
  spawnGate(run, FIRST_GATE_X);
  sound(run, 'start');
}

export function pauseRun(run: Run): void {
  if (run.phase !== 'play') {
    return;
  }
  run.phase = 'paused';
  run.touches.clear();
  run.touchOrder = [];
  run.lastDir = 0;
}

export function resumeRun(run: Run): void {
  if (run.phase !== 'paused') {
    return;
  }
  run.phase = 'play';
}

export function endRun(run: Run): void {
  run.cause = 'quit';
  finish(run);
}

export function pointerDown(run: Run, id: number | string, y: number): void {
  if (run.phase !== 'play') {
    return;
  }
  const key = touchKey(id);
  run.touchOrder = run.touchOrder.filter((touch) => touch !== key);
  run.touchOrder.push(key);
  run.touches.set(key, y);
}

export function pointerMove(run: Run, id: number | string, y: number): void {
  const key = touchKey(id);
  if (!run.touches.has(key)) {
    return;
  }
  run.touches.set(key, y);
}

export function pointerUp(run: Run, id: number | string): void {
  const key = touchKey(id);
  run.touches.delete(key);
  run.touchOrder = run.touchOrder.filter((touch) => touch !== key);
}

export function hudSignature(run: Run): string {
  return `${metersOf(run)}|${run.score}|${run.pet.shield ? 1 : 0}|${run.phase}|${Math.ceil(run.bump * 20)}`;
}
