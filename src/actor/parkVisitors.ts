import { stageDayThresholds } from '../sim/config';
import { breedById } from './breeds';
import { snapFacing } from './facing';
import type { Actor, ActorSource, Direction, ParkBook, ParkGuestState, ParkOffer, Vec, World } from './types';

export const parkVisitorRules = {
  shyBoldness: 40,
  warmAffection: 40,
  outgoing: 65,
  tiredEnergy: 35,
  lowMood: 25,
  lowMoodScale: 0.4,
  maxOnScreen: 1,
  checkMin: 20,
  checkSpan: 15,
  arriveChanceEmpty: 0.45,
  arriveChanceOne: 0.2,
  visitMin: 30,
  visitSpan: 45,
  visitCap: 90,
  greetDistance: 70,
  personalSpace: 45,
  meetGap: 36,
  crossGap: 52,
  spawnClear: 120,
  strangerChance: 0.3,
  helloInterval: 8,
  seekOutgoing: 0.55,
  seekFriendly: 0.28,
  helloMood: 2,
  moodCap: 6,
  moodWindow: 600,
  helloMin: 2,
  helloSpan: 4,
  avoidLingerCut: 15,
  arrivalEmpty: 0.5,
  arrivalOne: 0.85,
} as const;

const rules = parkVisitorRules;

export type SocialBand = 'shy' | 'aloof' | 'friendly' | 'outgoing';

export type SocialIntent = 'avoid' | 'tolerate' | 'seek';

export type HelloPose = 'sniff' | 'bow' | 'sit' | 'run';

type Spawn = (source: ActorSource, at?: Vec) => Actor;

type Direct = (actor: Actor, direction: Direction | null) => void;

export function socialBand(boldness: number, affection: number): SocialBand {
  if (boldness < rules.shyBoldness) {
    return 'shy';
  }
  if (affection < rules.warmAffection) {
    return 'aloof';
  }
  if (boldness >= rules.outgoing && affection >= rules.outgoing) {
    return 'outgoing';
  }
  return 'friendly';
}

export function socialIntent(boldness: number, affection: number, energy: number): SocialIntent {
  if (boldness < rules.shyBoldness && affection < rules.warmAffection) {
    return 'avoid';
  }
  if (boldness < rules.shyBoldness || energy < rules.tiredEnergy) {
    return 'tolerate';
  }
  return 'seek';
}

export function seekChance(band: SocialBand, mood: number): number {
  if (band === 'shy') {
    return 0;
  }
  const base = band === 'outgoing' ? rules.seekOutgoing : rules.seekFriendly;
  return mood < rules.lowMood ? base * rules.lowMoodScale : base;
}

export function approachKind(a: SocialIntent, b: SocialIntent, distance: number): 'meet' | 'none' {
  if (a === 'avoid' || b === 'avoid') {
    return 'none';
  }
  if (a === 'seek' || b === 'seek') {
    return 'meet';
  }
  return distance <= rules.greetDistance ? 'meet' : 'none';
}

export function arrivalCount(roll: number): number {
  if (roll < rules.arrivalEmpty) {
    return 0;
  }
  return 1;
}

export function arriveChance(count: number): number {
  if (count <= 0) {
    return rules.arriveChanceEmpty;
  }
  if (count === 1) {
    return rules.arriveChanceOne;
  }
  return 0;
}

export function moodGrant(times: readonly number[], now: number): { amount: number; times: number[] } {
  const recent = times.filter((time) => now - time < rules.moodWindow);
  if (recent.length * rules.helloMood + rules.helloMood > rules.moodCap) {
    return { amount: 0, times: recent };
  }
  return { amount: rules.helloMood, times: [...recent, now] };
}

export function helloPose(
  a: { species: 'dog' | 'cat'; band: SocialBand; ageDays: number },
  b: { species: 'dog' | 'cat'; band: SocialBand; ageDays: number },
): { pose: HelloPose; gap: number } {
  const cross = a.species !== b.species;
  if (cross || a.band === 'aloof' || b.band === 'aloof') {
    return { pose: 'sniff', gap: cross ? rules.crossGap : rules.meetGap };
  }
  const grown = (ageDays: number) => ageDays >= stageDayThresholds[0] && ageDays < stageDayThresholds[3];
  if (a.species === 'dog' && a.band === 'outgoing' && b.band === 'outgoing' && grown(a.ageDays) && grown(b.ageDays)) {
    return { pose: 'run', gap: rules.meetGap };
  }
  if (a.species === 'cat') {
    return { pose: 'sit', gap: rules.meetGap };
  }
  return { pose: 'bow', gap: rules.meetGap };
}

export function emptyParkBook(): ParkBook {
  return {
    enabled: false,
    offers: [],
    stranger: null,
    nonce: 1,
    nextCheck: 0,
    recentId: null,
    moodAt: [],
    staying: false,
    helloAt: 0,
    guests: [],
  };
}

export function ensurePark(world: World): ParkBook {
  if (!world.park) {
    world.park = emptyParkBook();
  }
  return world.park;
}

export function syncParkVisitors(
  world: World,
  input: { enabled: boolean; offers: ParkOffer[]; stranger: ((nonce: number) => ParkOffer) | null },
): void {
  const book = ensurePark(world);
  book.offers = input.offers;
  book.stranger = input.stranger;
  if (book.enabled === input.enabled) {
    return;
  }
  book.enabled = input.enabled;
  if (!input.enabled) {
    clearParkGuests(world);
  }
}

export function clearParkGuests(world: World): void {
  world.actors = world.actors.filter((actor) => !actor.guest);
  const book = world.park;
  if (!book) {
    return;
  }
  book.guests = [];
  book.staying = false;
}

export function abortParkHello(world: World): void {
  const book = world.park;
  if (!book) {
    return;
  }
  const active = book.guests.filter((guest) => guest.phase === 'hello');
  if (active.length === 0) {
    return;
  }
  const player = playerOf(world);
  if (player) {
    player.direction = null;
  }
  for (const guest of active) {
    guest.phase = 'wander';
    guest.done = true;
    guest.partnerId = null;
    guest.helloUntil = 0;
    const actor = actorById(world, guest.actorId);
    if (actor) {
      actor.direction = null;
    }
  }
}

export function stepParkVisitors(world: World, spawn: Spawn, direct: Direct): void {
  const book = world.park;
  if (!book?.enabled || world.scene.id !== 'park') {
    if (book?.guests.length) {
      clearParkGuests(world);
    }
    return;
  }
  settlePhases(world);
  separateGuests(world);
  if (!book.staying) {
    book.staying = true;
    const count = arrivalCount(world.rng());
    book.nextCheck = world.t + checkGap(world.rng());
    for (let i = 0; i < count; i += 1) {
      spawnVisitor(world, spawn);
    }
  } else if (world.t >= book.nextCheck) {
    book.nextCheck = world.t + checkGap(world.rng());
    if (book.guests.length < rules.maxOnScreen && world.rng() < arriveChance(book.guests.length)) {
      spawnVisitor(world, spawn);
    }
  }
  advanceGuests(world, direct);
  considerHellos(world, direct);
}

function checkGap(roll: number): number {
  return rules.checkMin + roll * rules.checkSpan;
}

function playerOf(world: World): Actor | null {
  return world.actors.find((actor) => !actor.guest) ?? null;
}

function actorById(world: World, id: string): Actor | null {
  return world.actors.find((actor) => actor.id === id) ?? null;
}

function speciesOf(actor: Actor): 'dog' | 'cat' {
  return breedById(actor.breedId)?.species === 'cat' ? 'cat' : 'dog';
}

type Side = {
  actor: Actor;
  guest: ParkGuestState | null;
  boldness: number;
  affection: number;
  energy: number;
  mood: number;
  species: 'dog' | 'cat';
  ageDays: number;
};

function sideOf(actor: Actor, guest: ParkGuestState | null): Side {
  if (guest) {
    return {
      actor,
      guest,
      boldness: guest.boldness,
      affection: guest.affection,
      energy: actor.energy * 100,
      mood: actor.mood * 100,
      species: guest.species,
      ageDays: guest.ageDays,
    };
  }
  return {
    actor,
    guest: null,
    boldness: actor.stats.boldness * 100,
    affection: actor.cuddleAffinity * 100,
    energy: actor.energy * 100,
    mood: actor.mood * 100,
    species: speciesOf(actor),
    ageDays: actor.ageDays,
  };
}

function sidesOf(world: World): Side[] {
  const book = world.park;
  if (!book) {
    return [];
  }
  const sides: Side[] = [];
  const player = playerOf(world);
  if (player) {
    sides.push(sideOf(player, null));
  }
  for (const guest of book.guests) {
    const actor = actorById(world, guest.actorId);
    if (actor) {
      sides.push(sideOf(actor, guest));
    }
  }
  return sides;
}

function freeSide(side: Side): boolean {
  const actor = side.actor;
  if (side.guest) {
    return side.guest.phase === 'wander' && !side.guest.done && actor.task.type === 'idle' && actor.direction == null;
  }
  return (
    !actor.asleep &&
    actor.collapseLeft <= 0 &&
    actor.direction == null &&
    actor.cuddle == null &&
    actor.task.greet == null &&
    actor.task.type === 'idle'
  );
}

function pickOffer(world: World): ParkOffer | null {
  const book = world.park;
  if (!book) {
    return null;
  }
  const used = new Set(book.guests.map((guest) => guest.snapshotId));
  const cast = book.offers.filter((offer) => !used.has(offer.id) && offer.id !== book.recentId);
  if ((world.rng() < rules.strangerChance || cast.length === 0) && book.stranger) {
    for (let i = 0; i < 4; i += 1) {
      const offer = book.stranger(book.nonce);
      book.nonce += 1;
      if (!used.has(offer.id) && offer.id !== book.recentId) {
        return offer;
      }
    }
  }
  if (cast.length === 0) {
    return null;
  }
  const index = Math.min(cast.length - 1, Math.floor(world.rng() * cast.length));
  return cast[index] ?? null;
}

function grassY(world: World): number {
  const floor = world.scene.floor;
  const span = Math.max(20, floor.yMax - floor.yMin - 20);
  return floor.yMin + 10 + world.rng() * span;
}

function entrySide(world: World, y: number): { fromLeft: boolean; entryX: number; targetX: number } {
  const floor = world.scene.floor;
  const player = playerOf(world);
  const leftRoom = player ? player.x - floor.xMin : floor.xMax;
  const rightRoom = player ? floor.xMax - player.x : floor.xMax;
  let fromLeft = leftRoom > rightRoom;
  if (Math.abs(leftRoom - rightRoom) < 40) {
    fromLeft = world.rng() < 0.5;
  }
  const crowded = (x: number) =>
    world.actors.some((actor) => Math.hypot(actor.x - x, actor.y - y) < rules.spawnClear);
  const inset = Math.max(140, (floor.xMax - floor.xMin) * 0.28);
  let targetX = fromLeft ? floor.xMin + inset : floor.xMax - inset;
  if (crowded(targetX)) {
    fromLeft = !fromLeft;
    targetX = fromLeft ? floor.xMin + inset : floor.xMax - inset;
  }
  const entryX = fromLeft ? floor.xMin - 70 : floor.xMax + 70;
  return { fromLeft, entryX, targetX };
}

function spawnVisitor(world: World, spawn: Spawn, at?: Vec, wandering = false): Actor | null {
  const book = world.park;
  if (!book || book.guests.length >= rules.maxOnScreen) {
    return null;
  }
  const offer = pickOffer(world);
  if (!offer) {
    return null;
  }
  const y = at?.y ?? grassY(world);
  const gate = entrySide(world, y);
  const spot = at ?? { x: gate.entryX, y };
  const actor = spawn(
    {
      id: `park-${offer.id}-${book.nonce}`,
      breedId: offer.breedId,
      ageDays: offer.ageDays,
      weight: offer.weight,
      vitality: offer.vitality,
      equipped: offer.equipped,
      wearDefs: offer.wearDefs,
      look: offer.look,
      asleep: false,
      seed: offer.seed,
      energy: 0.8,
      mood: 0.8,
      hydration: 0.8,
      cuddleAffinity: Math.min(1, Math.max(0, offer.affection / 100)),
      stats: {
        stamina: 0.5,
        agility: 0.5,
        boldness: Math.min(1, Math.max(0, offer.boldness / 100)),
        obedience: 0.5,
      },
    },
    spot,
  );
  book.nonce += 1;
  actor.guest = true;
  if (!wandering) {
    snapFacing(actor, gate.fromLeft ? 1 : -1);
  }
  const stay = rules.visitMin + world.rng() * rules.visitSpan;
  const guest: ParkGuestState = {
    actorId: actor.id,
    snapshotId: offer.id,
    boldness: offer.boldness,
    affection: offer.affection,
    species: offer.species,
    ageDays: offer.ageDays,
    leaveAt: world.t + stay,
    hardLeaveAt: world.t + rules.visitCap,
    phase: wandering ? 'wander' : 'enter',
    helloUntil: 0,
    partnerId: null,
    done: false,
    paid: false,
    tried: false,
  };
  if (wandering) {
    actor.task = { type: 'idle', stage: '', t: 0, bats: 0, cool: 0 };
    actor.idle = { mode: 'still', t: 0, dur: 30, target: null, sit: false, arrived: true };
  } else {
    actor.task = {
      type: 'travel',
      stage: 'enter',
      t: 0,
      bats: 0,
      cool: 0,
      poi: { x: gate.targetX, y },
    };
  }
  book.recentId = offer.id;
  book.guests.push(guest);
  world.actors.push(actor);
  return actor;
}

export function addWanderingGuest(world: World, offer: ParkOffer, at: Vec, spawn: Spawn): Actor | null {
  const book = ensurePark(world);
  book.enabled = true;
  book.staying = true;
  book.offers = [offer, ...book.offers.filter((item) => item.id !== offer.id)];
  book.recentId = null;
  const actor = spawnVisitor(world, spawn, at, true);
  return actor;
}

function settlePhases(world: World): void {
  const book = world.park;
  if (!book) {
    return;
  }
  for (const guest of book.guests) {
    const actor = actorById(world, guest.actorId);
    if (!actor) {
      continue;
    }
    if (actor.asleep || actor.collapseLeft > 0 || actor.task.type === 'sleep' || actor.idle.mode === 'nap') {
      actor.asleep = false;
      actor.collapseLeft = 0;
      actor.sleepSec = 0;
      actor.task = { type: 'idle', stage: '', t: 0, bats: 0, cool: 0 };
      actor.idle.mode = 'still';
      actor.idle.t = 0;
      actor.idle.dur = 2;
      actor.idle.target = null;
      actor.idle.arrived = true;
    }
    if (guest.phase === 'enter' && actor.task.type === 'idle') {
      guest.phase = 'wander';
    }
  }
  book.guests = book.guests.filter((guest) => actorById(world, guest.actorId));
}

function startLeave(world: World, actor: Actor, guest: ParkGuestState): void {
  guest.phase = 'leave';
  guest.partnerId = null;
  guest.helloUntil = 0;
  actor.direction = null;
  const floor = world.scene.floor;
  const toLeft = actor.x - floor.xMin <= floor.xMax - actor.x;
  actor.task = {
    type: 'travel',
    stage: 'exit',
    t: 0,
    bats: 0,
    cool: 0,
    poi: { x: toLeft ? floor.xMin - 90 : floor.xMax + 90, y: actor.y },
  };
}

function offstage(world: World, actor: Actor): boolean {
  const floor = world.scene.floor;
  return actor.x < floor.xMin - 20 || actor.x > floor.xMax + 20;
}

function advanceGuests(world: World, direct: Direct): void {
  const book = world.park;
  if (!book) {
    return;
  }
  const leaving: string[] = [];
  for (const guest of book.guests) {
    const actor = actorById(world, guest.actorId);
    if (!actor) {
      leaving.push(guest.actorId);
      continue;
    }
    if (guest.phase === 'hello' && world.t >= guest.hardLeaveAt) {
      finishHello(world, guest, direct, false);
      startLeave(world, actor, guest);
      continue;
    }
    if (guest.phase === 'hello' && world.t >= guest.helloUntil) {
      finishHello(world, guest, direct, true);
      if (world.t >= guest.leaveAt) {
        startLeave(world, actor, guest);
      }
      continue;
    }
    if (guest.phase === 'wander' && world.t >= guest.leaveAt) {
      startLeave(world, actor, guest);
      continue;
    }
    if (guest.phase === 'leave' && (offstage(world, actor) || world.t > guest.hardLeaveAt + 8)) {
      leaving.push(guest.actorId);
    }
  }
  if (leaving.length > 0) {
    const drop = new Set(leaving);
    world.actors = world.actors.filter((actor) => !drop.has(actor.id));
    book.guests = book.guests.filter((guest) => !drop.has(guest.actorId));
  }
}

function finishHello(world: World, guest: ParkGuestState, direct: Direct, pay: boolean): void {
  if (guest.phase !== 'hello') {
    return;
  }
  const book = world.park;
  const player = playerOf(world);
  const actor = actorById(world, guest.actorId);
  const partnerGuest = book?.guests.find((other) => other.actorId === guest.partnerId) ?? null;
  const partner = guest.partnerId && guest.partnerId !== player?.id ? actorById(world, guest.partnerId) : player;
  guest.phase = 'wander';
  guest.done = true;
  guest.helloUntil = 0;
  if (actor) {
    direct(actor, null);
    if (actor.task.type === 'idle') {
      actor.idle.mode = 'still';
      actor.idle.t = 0;
      actor.idle.dur = 4;
      actor.idle.target = null;
    }
  }
  if (partnerGuest && partnerGuest.phase === 'hello') {
    partnerGuest.phase = 'wander';
    partnerGuest.done = true;
    partnerGuest.helloUntil = 0;
    partnerGuest.partnerId = null;
  }
  if (partner && partner !== actor) {
    direct(partner, null);
  }
  const withPlayer = player != null && (guest.partnerId === player.id || partner === player);
  guest.partnerId = null;
  if (pay && withPlayer && player && book && !guest.paid) {
    guest.paid = true;
    const grant = moodGrant(book.moodAt, world.t);
    book.moodAt = grant.times;
    if (grant.amount > 0) {
      player.moodPops.push(grant.amount);
    }
  }
}

function considerHellos(world: World, direct: Direct): void {
  const book = world.park;
  if (!book || book.guests.some((guest) => guest.phase === 'hello')) {
    return;
  }
  const due = world.t >= book.helloAt;
  if (due) {
    book.helloAt = world.t + rules.helloInterval;
  }
  const sides = sidesOf(world).filter(freeSide);
  for (let i = 0; i < sides.length; i += 1) {
    for (let j = i + 1; j < sides.length; j += 1) {
      const pair = orderedPair(sides[i], sides[j]);
      if (!pair) {
        continue;
      }
      if (tryHello(world, pair[0], pair[1], due, direct)) {
        return;
      }
    }
  }
  nudgeAvoiders(world, sides);
}

function orderedPair(a: Side, b: Side): [Side, Side] | null {
  if (a.guest && b.guest) {
    return [a, b];
  }
  if (!a.guest) {
    return [a, b];
  }
  if (!b.guest) {
    return [b, a];
  }
  return null;
}

function tryHello(world: World, a: Side, b: Side, due: boolean, direct: Direct): boolean {
  if (b.guest?.done) {
    return false;
  }
  const distance = Math.hypot(a.actor.x - b.actor.x, a.actor.y - b.actor.y);
  const intentA = socialIntent(a.boldness, a.affection, a.energy);
  const intentB = socialIntent(b.boldness, b.affection, b.energy);
  if (approachKind(intentA, intentB, distance) !== 'meet') {
    return false;
  }
  const proximity = intentA === 'tolerate' && intentB === 'tolerate';
  if (proximity && distance > rules.greetDistance) {
    return false;
  }
  if (!proximity && !due) {
    return false;
  }
  if (!proximity) {
    const bandA = socialBand(a.boldness, a.affection);
    const bandB = socialBand(b.boldness, b.affection);
    const aStarts = intentA === 'seek' && world.rng() < seekChance(bandA, a.mood);
    const bStarts = intentB === 'seek' && world.rng() < seekChance(bandB, b.mood);
    if (!aStarts && !bStarts) {
      return false;
    }
  }
  beginHello(world, a, b, direct);
  return true;
}

function beginHello(world: World, a: Side, b: Side, direct: Direct): void {
  const pose = helloPose(
    { species: a.species, band: socialBand(a.boldness, a.affection), ageDays: a.ageDays },
    { species: b.species, band: socialBand(b.boldness, b.affection), ageDays: b.ageDays },
  );
  const points = meetPoints(a.actor, b.actor, pose.gap, world);
  const until = world.t + rules.helloMin + world.rng() * rules.helloSpan;
  const pace = pose.pose === 'run' ? 0.85 : 0.5;
  aimHello(world, a, b.actor.id, points.a, pose.pose, pace, until, direct);
  aimHello(world, b, a.actor.id, points.b, pose.pose, pace, until, direct);
  if (b.guest && world.t + (until - world.t) > b.guest.leaveAt && b.guest.hardLeaveAt > until) {
    b.guest.leaveAt = until;
  }
}

function aimHello(
  world: World,
  side: Side,
  partnerId: string,
  target: Vec,
  pose: HelloPose,
  pace: number,
  until: number,
  direct: Direct,
): void {
  const book = world.park;
  direct(side.actor, { target, pace, pose, token: book ? book.nonce : 1 });
  if (book) {
    book.nonce += 1;
  }
  side.actor.face = target.x >= side.actor.x ? 1 : -1;
  if (!world.reducedMotion) {
    side.actor.bark = { active: true, t: 0, fired: [false, false], open: 0, sound: true };
  }
  if (side.guest) {
    side.guest.phase = 'hello';
    side.guest.partnerId = partnerId;
    side.guest.helloUntil = until;
    if (world.t + (until - world.t) > side.guest.leaveAt && side.guest.hardLeaveAt > until) {
      side.guest.leaveAt = until;
    }
  }
}

function meetPoints(a: Actor, b: Actor, gap: number, world: World): { a: Vec; b: Vec } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy) || 1;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const ux = dx / distance;
  const uy = dy / distance;
  const floor = world.scene.floor;
  const clampPoint = (point: Vec): Vec => ({
    x: Math.min(floor.xMax - 36, Math.max(floor.xMin + 36, point.x)),
    y: Math.min(floor.yMax - 8, Math.max(floor.yMin + 8, point.y)),
  });
  return {
    a: clampPoint({ x: mid.x - ux * (gap / 2), y: mid.y - uy * (gap / 2) }),
    b: clampPoint({ x: mid.x + ux * (gap / 2), y: mid.y + uy * (gap / 2) }),
  };
}

function nudgeAvoiders(world: World, sides: Side[]): void {
  for (const side of sides) {
    if (!side.guest || side.guest.tried || side.guest.phase !== 'wander') {
      continue;
    }
    if (socialIntent(side.boldness, side.affection, side.energy) !== 'avoid') {
      continue;
    }
    for (const other of sides) {
      if (other.actor === side.actor) {
        continue;
      }
      const distance = Math.hypot(side.actor.x - other.actor.x, side.actor.y - other.actor.y);
      if (distance >= rules.personalSpace) {
        continue;
      }
      if (socialIntent(other.boldness, other.affection, other.energy) !== 'seek') {
        continue;
      }
      side.guest.tried = true;
      side.guest.leaveAt = Math.max(world.t + 2, side.guest.leaveAt - rules.avoidLingerCut);
      const away = side.actor.x < other.actor.x ? -28 : 28;
      const floor = world.scene.floor;
      side.actor.x = Math.min(floor.xMax - 36, Math.max(floor.xMin + 36, side.actor.x + away));
      break;
    }
  }
}

function separateGuests(world: World): void {
  const book = world.park;
  const actors = world.actors.filter((actor) => actor.task.type !== 'travel');
  for (let i = 0; i < actors.length; i += 1) {
    for (let j = i + 1; j < actors.length; j += 1) {
      const a = actors[i];
      const b = actors[j];
      if (helloPair(book, a, b)) {
        continue;
      }
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= rules.personalSpace || distance < 0.001) {
        continue;
      }
      const push = (rules.personalSpace - distance) / 2;
      const ux = dx / distance;
      const uy = dy / distance;
      const floor = world.scene.floor;
      a.x -= ux * push;
      a.y = Math.min(floor.yMax, Math.max(floor.yMin, a.y - uy * push));
      b.x += ux * push;
      b.y = Math.min(floor.yMax, Math.max(floor.yMin, b.y + uy * push));
    }
  }
}

function helloPair(book: ParkBook | undefined, a: Actor, b: Actor): boolean {
  if (!book) {
    return false;
  }
  return book.guests.some(
    (guest) =>
      guest.phase === 'hello' &&
      ((guest.actorId === a.id && guest.partnerId === b.id) || (guest.actorId === b.id && guest.partnerId === a.id)),
  );
}
