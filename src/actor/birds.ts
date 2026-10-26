// NPC park birds. Pure simulation: no rendering, no Skia, no React.
//
// A scene lists bird *spots* (where birds can be). Each spot hosts one bird, or a small flock for
// ground spots. Birds pick a species from what fits the spot, the season and the time of day, then
// loop through small behaviors (hop, walk, peck, preen, look around, swim, dabble). Anything in
// `threats` (the pet, a friend's pet, a thrown toy) that gets too close makes them fly off; they
// come back after a while. Day birds leave at dusk and an owl takes the tree at night.
//
// The renderer reads `bird.pose`, which this file fills in every step.

export type BirdSpecies = 'sparrow' | 'pigeon' | 'robin' | 'cardinal' | 'duck' | 'owl';
export type BirdHabitat = 'ground' | 'perch' | 'water';

export const birdSpeciesIds: readonly BirdSpecies[] = ['sparrow', 'pigeon', 'robin', 'cardinal', 'duck', 'owl'];
export const birdHabitats: readonly BirdHabitat[] = ['ground', 'perch', 'water'];

/** Stable for an hour, and different per scene. */
export function birdVisitSeed(sceneId: string, nowMs: number): number {
  let h = 2166136261;
  for (let i = 0; i < sceneId.length; i += 1) {
    h = Math.imul(h ^ sceneId.charCodeAt(i), 16777619);
  }
  return (Math.floor(nowMs / 3_600_000) ^ h) | 0;
}

/** Scene data. Add `birds?: BirdSpot[]` to the Scene type. */
export interface BirdSpot {
  /** Ground and water: the centre of the area the bird roams. Perch: the exact point its feet sit on. */
  x: number;
  y: number;
  on: BirdHabitat;
  /** Species allowed here. Omit for the habitat default. Only species that fit the habitat are used. */
  species?: BirdSpecies[];
  /** Half-width of the roam area (ground, water). Default 40 ground, 60 water. */
  roam?: number;
  /** Half-height of the roam area (ground, water). Default roam * 0.35. */
  roamY?: number;
  /** Depth used for sorting a perched bird with props and pets (the floor y of the thing it sits on). */
  sortY?: number;
  /** Ground spots: how many birds can share it (a little flock). Default 1. */
  count?: number;
  /** Chance (0..1) the spot is occupied on a given visit. Default 0.85. */
  chance?: number;
}

export type BirdState =
  | 'away' // offscreen, waiting to come back
  | 'flyIn'
  | 'flyOut'
  | 'idle'
  | 'look'
  | 'hop'
  | 'walk'
  | 'peck'
  | 'preen'
  | 'swim'
  | 'dabble'
  | 'doze';

export interface BirdPose {
  /** Height above the ground point (flying, hopping). Drawn as an upward offset; the shadow stays down. */
  lift: number;
  /** Small body bob or breathing, in local units. */
  bob: number;
  /** Head offset from rest, in local units (peck pushes it forward and down). */
  headX: number;
  headY: number;
  /** Head tilt in degrees (the robin "listening", the curious look). */
  tilt: number;
  /** 0 open, 1 closed. */
  blink: number;
  /** 0 folded, 1 flying. Blends the wings between perched and flight shapes. */
  fly: number;
  /** Wing angle in degrees while flying: positive is up. */
  flap: number;
  /** Body pitch in degrees: positive noses down. */
  pitch: number;
  /** Duck dabbling: 0 upright, 1 tail up and head under. */
  dabble: number;
  /** Owl: face swivel -1..1. Preening: 0..1 head tucked into the wing. */
  swivel: number;
  preen: number;
  /** Owl and night: eyelids half shut. */
  sleepy: number;
}

export interface BirdRipple {
  x: number;
  y: number;
  age: number;
}

export interface Bird {
  id: string;
  species: BirdSpecies;
  /** Variant for species that have one (duck: 0 drake, 1 hen). */
  variant: number;
  spot: BirdSpot;
  /** Ground position (feet). For perched birds this is the perch point. */
  x: number;
  y: number;
  face: 1 | -1;
  state: BirdState;
  /** Seconds in the current state. */
  st: number;
  /** Planned length of the current state. */
  dur: number;
  /** Movement targets and flight endpoints. */
  tx: number;
  ty: number;
  fx: number;
  fy: number;
  flyH: number;
  /** When `away`, seconds left before trying to return. */
  wait: number;
  /** Per-bird timers. */
  blinkIn: number;
  blinkT: number;
  phase: number;
  /** Set when a flock mate startles, so the others follow a beat later. */
  spook: number;
  spookX: number;
  rng: number;
  pose: BirdPose;
  ripples: BirdRipple[];
  /** Depth for sorting against props and actors. */
  depth: number;
  /** Whether this bird draws above everything (in the air). */
  airborne: boolean;
}

/** Anything birds should be scared of. Speed in stage px per second. */
export interface BirdThreat {
  x: number;
  y: number;
  speed?: number;
  /** Multiplier on the scare distance. A cat stalking can pass < 1, a toy flying in > 1. */
  scare?: number;
}

/** What the birds need to know about the world each step. */
export interface BirdWorld {
  /** 0 full day .. 1 full night. Use the same value as env.tod.dark. */
  dark: number;
  precip: 'rain' | 'snow' | null;
  /** 0..11. */
  month: number;
  /** Stage edges, used for flying offscreen. */
  xMin: number;
  xMax: number;
  /** Top of the visible stage (birds fly out past this). */
  yTop: number;
}

export type BirdEvent = { type: 'chirp' | 'coo' | 'quack' | 'hoot' | 'flap' | 'land' | 'splash'; bird: Bird };

interface SpeciesInfo {
  habitats: BirdHabitat[];
  /** Scare distance in stage px at scare 1. */
  startle: number;
  gait: 'hop' | 'walk' | 'swim' | 'none';
  /** Months present (0..11). Omit for all year. */
  months?: number[];
  night?: boolean;
  /** Leaves when it rains. */
  shy?: boolean;
  sound: BirdEvent['type'];
  /** Seconds away after being scared, min and max. */
  away: [number, number];
  /** Ground step for hops or walking speed. */
  step: number;
  /** Wing beats per second in flight. */
  beat: number;
}

export const BIRD_SPECIES: Record<BirdSpecies, SpeciesInfo> = {
  sparrow: { habitats: ['ground', 'perch'], startle: 70, gait: 'hop', shy: true, sound: 'chirp', away: [5, 12], step: 9, beat: 11 },
  pigeon: { habitats: ['ground', 'perch'], startle: 44, gait: 'walk', sound: 'coo', away: [4, 9], step: 20, beat: 7 },
  robin: { habitats: ['ground', 'perch'], startle: 80, gait: 'hop', months: [2, 3, 4, 5, 6, 7, 8, 9], shy: true, sound: 'chirp', away: [7, 15], step: 12, beat: 10 },
  cardinal: { habitats: ['perch', 'ground'], startle: 95, gait: 'hop', shy: true, sound: 'chirp', away: [9, 18], step: 10, beat: 10 },
  duck: { habitats: ['water'], startle: 48, gait: 'swim', sound: 'quack', away: [8, 16], step: 10, beat: 6 },
  owl: { habitats: ['perch'], startle: 0, gait: 'none', night: true, sound: 'hoot', away: [20, 40], step: 0, beat: 5 },
};

const DEFAULTS: Record<BirdHabitat, BirdSpecies[]> = {
  ground: ['sparrow', 'pigeon', 'robin', 'sparrow'],
  perch: ['sparrow', 'cardinal', 'robin'],
  water: ['duck'],
};

/** Night begins for birds a little before full dark, so they leave at dusk. */
const NIGHT_AT = 0.55;
const DAY_AT = 0.35;

// ---- small helpers ----

function rand(b: Bird): number {
  // mulberry32
  let t = (b.rng = (b.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const range = (b: Bird, lo: number, hi: number) => lo + (hi - lo) * rand(b);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h | 0;
}

function emptyPose(): BirdPose {
  return { lift: 0, bob: 0, headX: 0, headY: 0, tilt: 0, blink: 0, fly: 0, flap: 0, pitch: 0, dabble: 0, swivel: 0, preen: 0, sleepy: 0 };
}

export function speciesFits(species: BirdSpecies, spot: BirdSpot, world: BirdWorld): boolean {
  const info = BIRD_SPECIES[species];
  if (!info.habitats.includes(spot.on)) {
    return false;
  }
  if (info.months && !info.months.includes(world.month)) {
    return false;
  }
  return true;
}

/** Whether a bird of this species wants to be in the scene right now. */
function wantsToBeHere(b: Bird, world: BirdWorld): boolean {
  const info = BIRD_SPECIES[b.species];
  const night = world.dark > (b.state === 'away' ? NIGHT_AT - 0.05 : NIGHT_AT);
  const day = world.dark < DAY_AT;
  if (info.night) {
    return world.dark > 0.6;
  }
  if (night || (!day && b.state === 'away')) {
    return false;
  }
  if (world.precip === 'rain' && info.shy) {
    return false;
  }
  return true;
}

// ---- spawning ----

/**
 * Creates the birds for a scene visit. `seed` should change per visit (e.g. the visit start time
 * rounded to the hour) so the cast varies but is stable within a visit.
 */
export function spawnBirds(spots: BirdSpot[], world: BirdWorld, seed: number): Bird[] {
  const birds: Bird[] = [];
  let owlPlaced = false;
  spots.forEach((spot, si) => {
    const base = hashSeed(`${seed}|${si}|${spot.x},${spot.y}`);
    const probe = { rng: base } as Bird;
    const chance = spot.chance ?? 0.85;
    const pool = (spot.species ?? DEFAULTS[spot.on]).filter((s) => speciesFits(s, spot, world));
    // An owl is a night bird: it gets its own perch spot when listed, regardless of chance.
    const owlHere = !owlPlaced && pool.includes('owl');
    const dayPool = pool.filter((s) => s !== 'owl');
    if (owlHere) {
      owlPlaced = true;
      birds.push(makeBird(`b${si}o`, 'owl', spot, base ^ 0x51, world, 0));
    }
    if (dayPool.length === 0 || rand(probe) > chance) {
      return;
    }
    const species = dayPool[Math.floor(rand(probe) * dayPool.length)];
    const flock = spot.on === 'ground' ? Math.max(1, Math.min(spot.count ?? 1, species === 'sparrow' || species === 'pigeon' ? 4 : 2)) : 1;
    const n = flock === 1 ? 1 : 1 + Math.floor(rand(probe) * flock);
    for (let k = 0; k < n; k++) {
      birds.push(makeBird(`b${si}_${k}`, species, spot, base + k * 7919, world, k));
    }
  });
  return birds;
}

function makeBird(id: string, species: BirdSpecies, spot: BirdSpot, seed: number, world: BirdWorld, k: number): Bird {
  const b: Bird = {
    id,
    species,
    variant: 0,
    spot,
    x: spot.x,
    y: spot.y,
    face: 1,
    state: 'idle',
    st: 0,
    dur: 1,
    tx: spot.x,
    ty: spot.y,
    fx: 0,
    fy: 0,
    flyH: 0,
    wait: 0,
    blinkIn: 1,
    blinkT: 0,
    phase: 0,
    spook: 0,
    spookX: 0,
    rng: seed,
    pose: emptyPose(),
    ripples: [],
    depth: spot.sortY ?? spot.y,
    airborne: false,
  };
  b.variant = species === 'duck' ? (rand(b) < 0.5 ? 0 : 1) : 0;
  b.face = rand(b) < 0.5 ? 1 : -1;
  b.phase = rand(b) * 10;
  b.blinkIn = range(b, 0.5, 4);
  if (spot.on !== 'perch') {
    const p = roamPoint(b);
    b.x = k === 0 && spot.on === 'ground' ? spot.x + range(b, -8, 8) : p.x;
    b.y = k === 0 && spot.on === 'ground' ? spot.y + range(b, -4, 4) : p.y;
  }
  if (wantsToBeHere(b, world)) {
    enter(b, spot.on === 'water' ? 'swim' : 'idle', range(b, 0.3, 2));
  } else {
    enter(b, 'away', 0);
    b.wait = range(b, 0.5, 3);
  }
  return b;
}

function roamPoint(b: Bird): { x: number; y: number } {
  const s = b.spot;
  const rx = s.roam ?? (s.on === 'water' ? 60 : 40);
  const ry = s.roamY ?? rx * 0.35;
  const a = rand(b) * Math.PI * 2;
  const r = Math.sqrt(rand(b));
  return { x: s.x + Math.cos(a) * rx * r, y: s.y + Math.sin(a) * ry * r };
}

function enter(b: Bird, state: BirdState, dur: number): void {
  b.state = state;
  b.st = 0;
  b.dur = dur;
}

// ---- stepping ----

/** Advances every bird. Call once per frame with dt in seconds (clamp dt to ~0.05 on resume). */
export function stepBirds(birds: Bird[], dt: number, threats: BirdThreat[], world: BirdWorld, onEvent?: (e: BirdEvent) => void): void {
  const emit = (type: BirdEvent['type'], bird: Bird) => onEvent?.({ type, bird });
  for (const b of birds) {
    b.st += dt;
    b.phase += dt;
    updateBlink(b, dt);
    ageRipples(b, dt);
    const grounded = b.state !== 'away' && b.state !== 'flyIn' && b.state !== 'flyOut';

    if (grounded) {
      // Leave for the night, the rain, or because something came too close.
      const threat = nearestThreat(b, threats);
      if (threat) {
        startle(b, threat.x, world, emit);
        for (const mate of birds) {
          if (mate !== b && mate.spot === b.spot && mate.spook <= 0 && mate.state !== 'flyOut' && mate.state !== 'away') {
            mate.spook = range(mate, 0.05, 0.25);
            mate.spookX = threat.x;
          }
        }
      } else if (b.spook > 0) {
        b.spook -= dt;
        if (b.spook <= 0) {
          startle(b, b.spookX, world, emit);
        }
      } else if (!wantsToBeHere(b, world)) {
        if (b.st > range(b, 0, 0.6)) {
          startle(b, b.x + (rand(b) < 0.5 ? -1 : 1), world, emit);
        }
      }
    }

    switch (b.state) {
      case 'away':
        b.wait -= dt;
        if (b.wait <= 0) {
          if (wantsToBeHere(b, world)) {
            startFlyIn(b, world, emit);
          } else {
            b.wait = range(b, 3, 8);
          }
        }
        break;
      case 'flyIn':
        stepFlyIn(b, emit);
        break;
      case 'flyOut':
        stepFlyOut(b, dt, world);
        break;
      default:
        stepGrounded(b, dt, world, emit);
    }
    writePose(b, world);
    b.airborne = b.state === 'flyIn' || b.state === 'flyOut';
    b.depth = b.spot.on === 'perch' && !b.airborne ? (b.spot.sortY ?? b.y) : b.y;
  }
}

function nearestThreat(b: Bird, threats: BirdThreat[]): BirdThreat | null {
  const info = BIRD_SPECIES[b.species];
  if (info.startle <= 0) {
    return null;
  }
  // A perched bird is safer: things on the ground have to get closer.
  const perchFactor = b.spot.on === 'perch' ? 0.75 : 1;
  for (const t of threats) {
    const ty = b.spot.on === 'perch' ? (b.spot.sortY ?? b.y) : b.y;
    const dx = t.x - b.x;
    const dy = (t.y - ty) * 1.7; // depth distance counts more: the floor is foreshortened
    const d = Math.hypot(dx, dy);
    const fast = (t.speed ?? 0) > 140 ? 1.5 : (t.speed ?? 0) > 60 ? 1.15 : 1;
    if (d < info.startle * perchFactor * fast * (t.scare ?? 1)) {
      return t;
    }
  }
  return null;
}

function startle(b: Bird, fromX: number, world: BirdWorld, emit: (t: BirdEvent['type'], b: Bird) => void): void {
  const dir: 1 | -1 = b.x >= fromX ? 1 : -1;
  b.face = dir;
  b.fx = b.x;
  b.fy = b.y;
  b.spook = 0;
  // Head for the near edge in the direction away from the threat, climbing out over the top.
  const edge = dir > 0 ? world.xMax + 60 : world.xMin - 60;
  b.tx = edge;
  b.flyH = b.y - world.yTop + 80;
  enter(b, 'flyOut', 0);
  emit('flap', b);
  if (rand(b) < 0.6) {
    emit(BIRD_SPECIES[b.species].sound, b);
  }
}

function startFlyIn(b: Bird, world: BirdWorld, emit: (t: BirdEvent['type'], b: Bird) => void): void {
  const land = b.spot.on === 'perch' ? { x: b.spot.x, y: b.spot.y } : roamPoint(b);
  const fromLeft = rand(b) < 0.5;
  b.fx = fromLeft ? world.xMin - 50 : world.xMax + 50;
  b.fy = land.y;
  b.tx = land.x;
  b.ty = land.y;
  b.flyH = clamp(land.y - world.yTop + range(b, 20, 90), 80, 420);
  b.face = fromLeft ? 1 : -1;
  const dist = Math.abs(b.tx - b.fx);
  enter(b, 'flyIn', clamp(dist / range(b, 150, 190), 1.3, 3));
  emit('flap', b);
}

function stepFlyIn(b: Bird, emit: (t: BirdEvent['type'], b: Bird) => void): void {
  const u = clamp(b.st / b.dur, 0, 1);
  const e = 1 - (1 - u) * (1 - u);
  b.x = b.fx + (b.tx - b.fx) * e;
  b.y = b.fy + (b.ty - b.fy) * e;
  if (u >= 1) {
    b.x = b.tx;
    b.y = b.ty;
    enter(b, b.spot.on === 'water' ? 'swim' : 'idle', range(b, 0.6, 1.4));
    b.tx = b.x;
    b.ty = b.y;
    emit(b.spot.on === 'water' ? 'splash' : 'land', b);
    if (b.spot.on === 'water') {
      b.ripples.push({ x: b.x, y: b.y, age: 0 }, { x: b.x, y: b.y, age: -0.25 });
    }
  }
}

function stepFlyOut(b: Bird, dt: number, world: BirdWorld): void {
  const info = BIRD_SPECIES[b.species];
  const speed = 150;
  b.x += b.face * speed * dt;
  if (b.x < world.xMin - 50 || b.x > world.xMax + 50 || b.st > 3.4) {
    enter(b, 'away', 0);
    b.wait = range(b, info.away[0], info.away[1]);
  }
}

function stepGrounded(b: Bird, dt: number, world: BirdWorld, emit: (t: BirdEvent['type'], b: Bird) => void): void {
  const info = BIRD_SPECIES[b.species];
  const s = b.state;
  if (s === 'hop' || s === 'walk' || s === 'swim') {
    const dx = b.tx - b.x;
    const dy = b.ty - b.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.5) {
      b.face = dx >= 0 ? 1 : -1;
    }
    if (s === 'hop') {
      // Discrete hops: move only during the airborne part of each 0.26 s hop.
      const hopLen = 0.26;
      const inHop = (b.st % hopLen) / hopLen;
      if (inHop < 0.7 && d > 0.5) {
        const v = (info.step / (hopLen * 0.7)) * dt;
        const k = Math.min(1, v / d);
        b.x += dx * k;
        b.y += dy * k;
      }
      if (d <= 0.5 && inHop > 0.7) {
        next(b, world, emit);
      }
    } else {
      const v = (s === 'swim' ? info.step : info.step) * dt;
      if (d > 0.5) {
        const k = Math.min(1, v / d);
        b.x += dx * k;
        b.y += dy * k;
        if (s === 'swim' && Math.floor(b.st * 1.3) !== Math.floor((b.st - dt) * 1.3)) {
          b.ripples.push({ x: b.x, y: b.y, age: 0 });
        }
      } else if (b.st > b.dur) {
        next(b, world, emit);
      }
    }
    return;
  }
  if (s === 'dabble' && Math.abs(b.st - 0.25) < dt) {
    b.ripples.push({ x: b.x, y: b.y, age: 0 });
    emit('splash', b);
  }
  if (b.st >= b.dur) {
    next(b, world, emit);
  }
}

/** Picks the next behavior. */
function next(b: Bird, world: BirdWorld, emit: (t: BirdEvent['type'], b: Bird) => void): void {
  const info = BIRD_SPECIES[b.species];
  const r = rand(b);
  if (b.species === 'owl') {
    if (r < 0.35) {
      enter(b, 'look', range(b, 1.2, 2.4));
    } else if (r < 0.5) {
      enter(b, 'doze', range(b, 3, 6));
    } else {
      if (rand(b) < 0.12) {
        emit('hoot', b);
      }
      enter(b, 'idle', range(b, 1.5, 3.5));
    }
    return;
  }
  if (b.spot.on === 'water') {
    if (r < 0.45) {
      const p = roamPoint(b);
      b.tx = p.x;
      b.ty = p.y;
      enter(b, 'swim', range(b, 2, 5));
    } else if (r < 0.75) {
      enter(b, 'dabble', range(b, 1.4, 2.4));
    } else if (r < 0.85) {
      enter(b, 'preen', range(b, 1.2, 2));
    } else {
      if (rand(b) < 0.4) {
        emit('quack', b);
      }
      b.tx = b.x;
      b.ty = b.y;
      enter(b, 'swim', range(b, 1, 2.5));
    }
    return;
  }
  const perched = b.spot.on === 'perch';
  if (perched) {
    if (r < 0.3) {
      enter(b, 'look', range(b, 0.8, 1.6));
    } else if (r < 0.45) {
      enter(b, 'preen', range(b, 1, 2));
    } else if (r < 0.6) {
      // Hop round to face the other way.
      b.face = (b.face * -1) as 1 | -1;
      enter(b, 'hop', 0);
      b.tx = b.x;
      b.ty = b.y;
    } else {
      if (rand(b) < 0.15) {
        emit(info.sound, b);
      }
      enter(b, 'idle', range(b, 0.8, 2.6));
    }
    return;
  }
  // Ground.
  if (r < 0.38) {
    const p = roamPoint(b);
    const span = info.gait === 'walk' ? 50 : 34;
    b.tx = clamp(p.x, b.x - span, b.x + span);
    b.ty = clamp(p.y, b.y - span * 0.4, b.y + span * 0.4);
    enter(b, info.gait === 'walk' ? 'walk' : 'hop', 0.8);
  } else if (r < 0.68) {
    enter(b, 'peck', range(b, 0.7, 1.6));
  } else if (r < 0.8) {
    enter(b, 'look', range(b, 0.8, 1.8));
  } else if (r < 0.88) {
    enter(b, 'preen', range(b, 1, 1.8));
  } else {
    if (rand(b) < 0.3) {
      emit(info.sound, b);
    }
    enter(b, 'idle', range(b, 0.6, 2));
  }
}

function updateBlink(b: Bird, dt: number): void {
  if (b.blinkT > 0) {
    b.blinkT -= dt;
    return;
  }
  b.blinkIn -= dt;
  if (b.blinkIn <= 0) {
    b.blinkT = b.species === 'owl' ? 0.45 : 0.14;
    b.blinkIn = range(b, 1.5, 5);
  }
}

function ageRipples(b: Bird, dt: number): void {
  for (const r of b.ripples) {
    r.age += dt;
  }
  if (b.ripples.length && b.ripples[0].age > 1.6) {
    b.ripples = b.ripples.filter((r) => r.age <= 1.6);
  }
}

// ---- pose ----

function writePose(b: Bird, world: BirdWorld): void {
  const p = b.pose;
  const t = b.phase;
  const s = b.state;
  const info = BIRD_SPECIES[b.species];
  p.lift = 0;
  p.headX = 0;
  p.headY = 0;
  p.tilt = 0;
  p.fly = 0;
  p.flap = 0;
  p.pitch = 0;
  p.swivel = 0;
  p.preen = 0;
  p.dabble = Math.max(0, p.dabble - 0.08);
  p.bob = Math.sin(t * 3.1) * 0.25; // breathing
  p.blink = b.blinkT > 0 ? 1 : 0;
  p.sleepy = b.species === 'owl' ? 0.25 : 0;

  if (s === 'flyIn' || s === 'flyOut') {
    const u = s === 'flyIn' ? clamp(b.st / b.dur, 0, 1) : clamp(b.st / 2.6, 0, 1);
    // Flight height: in, a glide down that flattens at the end; out, a steep climb.
    p.lift = s === 'flyIn' ? b.flyH * Math.pow(1 - u, 2.2) : b.flyH * u * u * 1.1 + 16 * Math.min(1, b.st * 5);
    p.fly = s === 'flyIn' && u > 0.92 ? 1 - (u - 0.92) / 0.08 : 1;
    const gliding = s === 'flyIn' && u > 0.55 && u < 0.85;
    const beat = Math.sin(t * info.beat * Math.PI * 2);
    // Strong upstroke, short downstroke: a wing that swings straight down reads as a leg.
    p.flap = gliding ? 35 + Math.sin(t * 2) * 6 : beat > 0 ? beat * 62 : beat * 26;
    p.pitch = s === 'flyIn' ? (u > 0.85 ? -18 : 8) : -16;
    p.bob = 0;
    return;
  }
  if (s === 'hop') {
    const hopLen = 0.26;
    const u = (b.st % hopLen) / hopLen;
    p.lift = u < 0.7 ? Math.sin((u / 0.7) * Math.PI) * 4.2 : 0;
    p.pitch = u < 0.7 ? -6 : 3;
  } else if (s === 'walk') {
    // Pigeon head bob: the head pushes forward then holds while the body catches up.
    const step = (b.st * 2.6) % 1;
    p.headX = step < 0.45 ? (step / 0.45) * 2.6 - 1.3 : 1.3 - ((step - 0.45) / 0.55) * 2.6;
    p.bob = Math.abs(Math.sin(b.st * 2.6 * Math.PI)) * -0.7;
  } else if (s === 'peck') {
    const k = Math.max(0, Math.sin(b.st * Math.PI * 2 * 2.4));
    const into = Math.min(1, b.st * 5, (b.dur - b.st) * 5);
    p.pitch = 26 * into;
    p.headX = 2.2 * into + k * 1.2;
    p.headY = 3.4 * into + k * 2.4;
  } else if (s === 'look') {
    const into = Math.min(1, b.st * 4, (b.dur - b.st) * 4);
    const dir = Math.sin(b.phase * 0.7) >= 0 ? 1 : -1;
    p.tilt = (b.species === 'robin' ? 24 : 16) * dir * into;
    p.swivel = dir * into;
  } else if (s === 'preen') {
    const into = Math.min(1, b.st * 4, (b.dur - b.st) * 4);
    p.preen = into;
    p.headX = -3.2 * into + Math.sin(b.st * 14) * 0.5 * into;
    p.headY = 2.6 * into;
  } else if (s === 'dabble') {
    const into = Math.min(1, b.st * 3.5, (b.dur - b.st) * 3.5);
    p.dabble = Math.max(p.dabble, into);
  } else if (s === 'doze') {
    const into = Math.min(1, b.st * 1.5, (b.dur - b.st) * 1.5);
    p.sleepy = 0.25 + 0.65 * into;
    p.blink = 0;
  }
  if (s === 'swim' || s === 'dabble') {
    p.bob = Math.sin(t * 2.2) * 0.5;
  }
  // Day birds at dusk look a little drowsy, which reads nicely just before they leave.
  if (b.species !== 'owl' && world.dark > 0.4) {
    p.sleepy = Math.max(p.sleepy, clamp((world.dark - 0.4) * 2, 0, 0.4));
  }
}
