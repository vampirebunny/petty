import { cuddleParamsFor } from './data/cuddle';
import { breedById } from './breeds';
import { geomOf, headFaceOf, headShift, noseOf, torsoPoint } from './geometry';
import { easeInOutSine, springUp } from './pose';
import type {
  Actor,
  CuddleExit,
  CuddlePhase,
  CuddleSound,
  CuddleState,
  CuddleZone,
  Pose,
  Vec,
  World,
} from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function newCuddle(actor: Actor, rng: () => number): CuddleState {
  const breed = breedById(actor.breedId);
  const params = cuddleParamsFor(actor.breedId, breed?.species ?? 'dog', actor.ageDays, actor.vitality);
  return {
    params,
    phase: 'approach',
    t: 0,
    touchT: 99,
    sinceTouch: 0,
    touchX: null,
    zone: null,
    strokes: 0,
    continuity: 0,
    sustained: 0,
    tolerance: 0,
    petted: 0,
    reaction: null,
    boopTimes: [],
    kickT: 0,
    kickCool: 0,
    buntT: 0,
    tiltT: -1,
    tiltNext: lerp(params.timing.tiltEveryMin, params.timing.tiltEveryMax, rng()),
    tiltSide: 1,
    kneading: false,
    purring: false,
    trap: false,
    trapTried: false,
    exit: null,
    leaveTarget: null,
    perkT: 99,
    announced: false,
    fired: false,
  };
}

export function isCuddling(actor: Actor): boolean {
  return actor.task.type === 'cuddle' && actor.cuddle != null;
}

function sound(world: World, actor: Actor, id: CuddleSound): void {
  if (world.sounds.length < 8) {
    world.sounds.push({ actorId: actor.id, sound: id, rate: 1 });
  }
}

const touchPhases: CuddlePhase[] = ['waiting', 'rollDown', 'rollOver', 'belly'];

function accepting(c: CuddleState): boolean {
  return c.exit == null && touchPhases.includes(c.phase);
}

function setPhase(c: CuddleState, phase: CuddlePhase): void {
  c.phase = phase;
  c.t = 0;
  c.fired = false;
}

// After a roll-back (or straight from sitting) the exit continues by reason.
function continueExit(c: CuddleState): void {
  setPhase(c, c.exit === 'tolerance' ? 'unturn' : 'hold');
}

export function requestCuddleExit(actor: Actor, reason: CuddleExit): void {
  const c = actor.cuddle;
  if (!c || c.exit != null) {
    return;
  }
  c.exit = reason;
  if (reason !== 'mode' && !c.announced) {
    c.announced = true;
    actor.cuddleOut.push({ type: 'exit', reason });
  }
  if (c.phase === 'rollDown' || c.phase === 'rollOver' || c.phase === 'belly') {
    setPhase(c, 'rollBack');
  } else if (c.phase === 'approach' || c.phase === 'settle' || c.phase === 'waiting') {
    continueExit(c);
  }
}

export function endCuddle(actor: Actor): void {
  requestCuddleExit(actor, 'mode');
}

export function takeCuddleOut(actor: Actor): Actor['cuddleOut'] {
  const out = actor.cuddleOut;
  actor.cuddleOut = [];
  return out;
}

function sideOf(actor: Actor, x: number | null): 1 | -1 {
  if (x == null) {
    return 1;
  }
  const hx = actor.x + actor.face * actor.anchors.scale * actor.anchors.head.x;
  const dir = Math.sign(actor.face * (x - hx));
  return dir < 0 ? -1 : 1;
}

// Which part of the pet a stage point touches. Null means the point is off the pet.
export function cuddleZoneAt(actor: Actor, px: number, py: number): CuddleZone | null {
  const breed = breedById(actor.breedId);
  const a = actor.anchors;
  if (!breed || a.head.radius <= 0) {
    return null;
  }
  const geom = geomOf(breed, actor.displayAgeDays, actor.displayWeight, actor.vitality);
  const sc = a.scale;
  const f = actor.face >= 0 ? 1 : -1;
  const screen = (lx: number, ly: number): Vec => ({ x: actor.x + f * sc * lx, y: actor.y - actor.z + sc * ly });
  const R = geom.headR;
  const shift = headShift(geom, a.head.y, actor.pose);
  const headLocal = { x: a.head.x + shift.x, y: a.head.y + shift.y };
  const head = screen(headLocal.x, headLocal.y);

  // The nose, in head space, rotated by the head pitch. It follows the 3/4 turn like the renderer does.
  const turn = clamp(actor.pose.headTurn, 0, 1);
  const face = headFaceOf(breed, geom, turn);
  const { x: noseX, y: noseY } = noseOf(breed, R, face);
  const cs = Math.cos(a.head.pitch + actor.pose.headRot);
  const sn = Math.sin(a.head.pitch + actor.pose.headRot);
  const nose = screen(headLocal.x + noseX * cs - noseY * sn, headLocal.y + noseX * sn + noseY * cs);
  if (Math.hypot(px - nose.x, py - nose.y) <= Math.max(R * sc * 0.55, 24)) {
    return 'nose';
  }
  if (Math.hypot(px - head.x, py - head.y) <= R * sc * 1.2) {
    return 'head';
  }
  // The torso is an ellipse tilted by the sit angle. Test the point in torso space.
  const center = screen(
    torsoPoint(geom, a.torso.theta, a.torso.dy, 0, geom.bodyY).x,
    torsoPoint(geom, a.torso.theta, a.torso.dy, 0, geom.bodyY).y,
  );
  const rx = (f * (px - center.x)) / sc;
  const ry = (py - center.y) / sc;
  const c = Math.cos(a.torso.theta);
  const s = Math.sin(a.torso.theta);
  const lx = rx * c + ry * s;
  const ly = -rx * s + ry * c;
  const ex = geom.bodyLen / 2 + 10;
  const ey = geom.bodyH / 2 + 14;
  if ((lx * lx) / (ex * ex) + (ly * ly) / (ey * ey) <= 1) {
    return actor.pose.belly > 0.5 ? 'belly' : 'back';
  }
  return null;
}

// A short path along the pet's back in stage coordinates, for the ghost finger. Null until the pet has been drawn.
export function cuddleBackPath(actor: Actor): { from: Vec; to: Vec } | null {
  const breed = breedById(actor.breedId);
  const a = actor.anchors;
  if (!breed || a.head.radius <= 0) {
    return null;
  }
  const geom = geomOf(breed, actor.displayAgeDays, actor.displayWeight, actor.vitality);
  const sc = a.scale;
  const f = actor.face >= 0 ? 1 : -1;
  const at = (x: number): Vec => {
    const local = torsoPoint(geom, a.torso.theta, a.torso.dy, x, geom.bodyY - geom.bodyH * 0.25);
    return { x: actor.x + f * sc * local.x, y: actor.y - actor.z + sc * local.y };
  };
  return { from: at(-geom.bodyLen * 0.28), to: at(geom.bodyLen * 0.22) };
}

export type CuddleTouch = {
  kind: 'move' | 'stroke' | 'scratch' | 'boop' | 'flinch';
  zone: CuddleZone | null;
  // Stage x of the touch.
  x: number;
};

export function cuddleTouch(world: World, actor: Actor, touch: CuddleTouch): void {
  const c = actor.cuddle;
  if (!c || actor.task.type !== 'cuddle' || !accepting(c)) {
    return;
  }
  const p = c.params;
  const cat = breedById(actor.breedId)?.species === 'cat';
  const side = sideOf(actor, touch.x);
  const zone: CuddleZone | null = touch.zone === 'nose' ? 'head' : touch.zone;

  if (touch.kind === 'flinch') {
    c.reaction = { kind: 'flinch', t: 0, dur: p.timing.flinch, side };
    return;
  }
  if (touch.kind === 'boop') {
    if (touch.zone !== 'nose') {
      return;
    }
    c.sinceTouch = 0;
    c.boopTimes = c.boopTimes.filter((at) => world.t - at <= 2);
    c.boopTimes.push(world.t);
    c.tolerance += p.tolerance.boopCost;
    if (c.boopTimes.length >= 4) {
      c.boopTimes = [];
      c.reaction = { kind: 'headShake', t: 0, dur: p.timing.headShake, side };
    } else {
      c.reaction = { kind: 'boop', t: 0, dur: p.timing.boop, side };
    }
    return;
  }
  if (zone == null) {
    return;
  }
  c.sinceTouch = 0;
  c.touchT = 0;
  c.touchX = touch.x;
  c.zone = zone;
  if (touch.kind === 'stroke') {
    c.strokes += 1;
  }
  if (touch.kind === 'scratch') {
    if (zone !== 'head') {
      return;
    }
    c.reaction = { kind: 'scratch', t: 0, dur: p.timing.scratch, side };
    if (!cat && c.kickCool <= 0 && world.rng() < p.kick.chance) {
      c.kickT = p.timing.kick;
      c.kickCool = p.kick.cooldown;
      sound(world, actor, 'cuddle_happy');
    }
    return;
  }
  // A belly touch on a belly-up cat is the trap: a soft swat, then it rolls back up.
  if (c.phase === 'belly' && c.trap && zone === 'belly') {
    c.reaction = { kind: 'swat', t: 0, dur: p.timing.swat * 0.6, side };
    c.tolerance += p.tolerance.swatCost;
    c.trap = false;
    setPhase(c, 'rollBack');
  }
}

export type CuddleStep = {
  move: Vec | null;
  vmax: number;
  wagRate: number;
  faceCamera: boolean;
  done: boolean;
};

// Steps the Cuddle task for one frame. It writes pose targets and reports what the task machine should do.
export function stepCuddle(
  world: World,
  actor: Actor,
  dt: number,
  limit: number,
  home: Vec,
  targets: Pose,
): CuddleStep {
  const c = actor.cuddle;
  const out: CuddleStep = { move: null, vmax: 0, wagRate: 5, faceCamera: false, done: false };
  if (!c) {
    out.done = true;
    return out;
  }
  const p = c.params;
  const tm = p.timing;
  const am = p.amps;
  const cat = breedById(actor.breedId)?.species === 'cat';
  const affinity = clamp(actor.cuddleAffinity, 0, 1);
  const posture = p.posture === 'sit' ? 1 : 0;

  c.t += dt;
  c.touchT += dt;
  c.sinceTouch += dt;
  c.kickCool = Math.max(0, c.kickCool - dt);
  c.perkT += dt;

  const touching = accepting(c) && c.touchT < tm.strokeHold;
  if (touching) {
    c.petted += dt;
    c.sustained += dt;
    c.tolerance += dt;
    c.continuity = Math.min(1, c.continuity + dt / 2.5);
  } else {
    c.sustained = Math.max(0, c.sustained - dt * p.escalation.sustainDecay);
    c.continuity = Math.max(0, c.continuity - dt / 1.2);
  }

  const tolMax = p.tolerance.max * (0.7 + 0.6 * affinity);
  const rollAt = p.escalation.rollAt * (1.4 - 0.8 * affinity);
  const kneadAt = p.escalation.kneadAt * (1.4 - 0.8 * affinity);
  if (c.exit == null && c.phase !== 'approach' && c.phase !== 'settle' && c.tolerance >= tolMax) {
    requestCuddleExit(actor, 'tolerance');
  } else if (c.exit == null && c.phase === 'waiting' && c.sinceTouch > tm.waitTimeout) {
    requestCuddleExit(actor, 'timeout');
  }

  // Accumulators that reactions and touch add to before they become pose targets.
  let squint = 0;
  let headDx = 0;
  let headDy = 0;
  let headRot = 0;
  let earBack = 0;
  let torsoShift = 0;
  let snoutScale = 1;
  let tailLift = 0;
  let paw = 0;
  let pant = 0;
  let paddle = 0;
  let knead = 0;
  let lie = 0;
  let belly = 0;
  let shake = 0;
  let sit = 0;
  let wagAmp = 0.22;
  let wagRate = 5;

  const side = sideOf(actor, c.touchX);
  const baseEars = touching ? (cat ? am.earBackCat : am.earBackDog) : 0;

  if (c.phase === 'approach') {
    out.move = home;
    out.vmax = limit * 0.5;
    wagRate = 8;
    wagAmp = 0.35;
    const near = Math.hypot(home.x - actor.x, home.y - actor.y) < 6 && actor.speed < 15;
    if (near || c.t > tm.approachMax) {
      setPhase(c, 'settle');
    }
  } else if (c.phase === 'settle') {
    sit = posture;
    wagRate = 7;
    wagAmp = 0.3;
    if (c.t >= tm.settle) {
      setPhase(c, 'waiting');
      c.perkT = 0;
      // A single blink as the head comes round.
      actor.blinkT = 0.1;
    }
  }

  const inContent =
    c.phase === 'waiting' ||
    c.phase === 'rollDown' ||
    c.phase === 'rollOver' ||
    c.phase === 'belly' ||
    c.phase === 'rollBack' ||
    c.phase === 'hold';
  if (inContent) {
    out.faceCamera = true;
  }

  // Wagging and the tail follow how continuous the petting is.
  const wagIdle = lerp(p.wag.waiting, p.wag.max, c.continuity);
  const ampIdle = lerp(p.wag.ampWaiting, p.wag.ampStroking, c.continuity);

  if (c.phase === 'waiting') {
    sit = posture;
    wagRate = wagIdle;
    wagAmp = ampIdle;
    tailLift = cat ? (touching ? am.catTailUp : am.catTailWait) : 0;
    earBack = baseEars;
    if (c.perkT < tm.perk) {
      earBack = am.earPerk * springUp(c.perkT);
    }
    if (touching) {
      squint = Math.max(squint, am.lidStroke);
      headDx += side * am.headLean;
      headRot += side * am.headRot;
      const local = (actor.face * ((c.touchX ?? actor.x) - actor.x)) / Math.max(actor.anchors.scale, 0.01);
      torsoShift = clamp(local * 0.1, -am.torsoShift, am.torsoShift);
      if (!c.purring && c.continuity > 0.4) {
        c.purring = true;
        sound(world, actor, cat ? 'cuddle_purr' : 'cuddle_happy');
      }
    } else {
      if (c.sinceTouch > 1.5) {
        c.purring = false;
      }
      // Waiting: an occasional head tilt toward the last touch, or the screen center.
      if (c.reaction == null) {
        if (c.tiltT >= 0) {
          c.tiltT += dt;
          const u = c.tiltT / tm.tilt;
          if (u >= 1) {
            c.tiltT = -1;
            c.tiltNext = lerp(tm.tiltEveryMin, tm.tiltEveryMax, world.rng());
          } else {
            headRot += c.tiltSide * am.tiltRad * easeInOutSine(1 - Math.abs(2 * u - 1));
          }
        } else {
          c.tiltNext -= dt;
          if (c.tiltNext <= 0) {
            c.tiltT = 0;
            c.tiltSide = sideOf(actor, c.touchX ?? 320);
          }
        }
      }
    }
    if (c.kneading) {
      if (c.sinceTouch > tm.kneadStop) {
        c.kneading = false;
      } else {
        knead = 1;
        squint = Math.max(squint, 0.7);
      }
    }
    if (c.exit == null) {
      if (!cat && c.sustained >= rollAt) {
        c.sustained = 0;
        setPhase(c, 'rollDown');
      } else if (cat && !c.kneading && c.sustained >= kneadAt) {
        c.kneading = true;
        sound(world, actor, 'cuddle_purr');
        if (!c.trapTried) {
          c.trapTried = true;
          if (world.rng() < p.escalation.trapChance * affinity) {
            c.trap = true;
            c.sustained = 0;
            setPhase(c, 'rollDown');
          }
        }
      }
    }
  } else if (c.phase === 'rollDown') {
    lie = 1;
    squint = 0.5;
    wagRate = wagIdle;
    wagAmp = ampIdle;
    earBack = baseEars;
    if (c.t >= tm.rollDown) {
      setPhase(c, 'rollOver');
    }
  } else if (c.phase === 'rollOver') {
    lie = 1;
    belly = 1;
    squint = 0.7;
    wagAmp = 0.2;
    if (c.t >= tm.rollOver) {
      setPhase(c, 'belly');
      if (!cat) {
        sound(world, actor, 'cuddle_pant');
      }
    }
  } else if (c.phase === 'belly') {
    lie = 1;
    belly = 1;
    wagRate = 3;
    wagAmp = cat ? 0.1 : 0.3;
    earBack = 0.1;
    // The head lolls to one side with the 3/4 view held, and the mouth hangs open when happy.
    headRot += c.tiltSide * am.bellyLoll;
    squint = c.trap ? 0.3 : touching ? am.lidBelly : 0.85;
    pant = c.trap ? 0 : am.bellyMouth;
    paddle = c.trap ? 0 : touching && c.zone === 'belly' ? 1 : 0.2;
    if (c.sinceTouch > tm.rollBackIdle && c.exit == null) {
      c.trap = false;
      setPhase(c, 'rollBack');
    }
  } else if (c.phase === 'rollBack') {
    lie = actor.pose.belly > 0.15 ? 1 : 0;
    sit = actor.pose.belly > 0.15 ? 0 : posture;
    squint = 0.5;
    earBack = 0;
    if (actor.pose.belly < 0.15 && actor.pose.lie < 0.15 && c.t >= tm.rollBack * 0.5) {
      if (c.exit == null) {
        c.sustained = 0;
        setPhase(c, 'waiting');
      } else {
        continueExit(c);
      }
    }
  } else if (c.phase === 'hold') {
    sit = posture;
    squint = 0.6;
    const dur = c.petted > 0 && c.sinceTouch < 6 ? tm.hold : tm.holdIdle;
    if (c.t >= dur) {
      out.done = true;
    }
  } else if (c.phase === 'unturn') {
    // headTurn eases 1 to 0 here, before any walk can start.
    sit = posture;
    squint = 0.3;
    if (c.t >= tm.unturnMin && actor.pose.headTurn < 0.05) {
      setPhase(c, cat ? 'swat' : 'shake');
    }
  } else if (c.phase === 'shake') {
    sit = 0;
    wagRate = 10;
    wagAmp = 0.4;
    if (c.t >= tm.shakeStand) {
      shake = Math.max(0, 1 - (c.t - tm.shakeStand) / tm.shake);
      c.fired = true;
    }
    if (c.t >= tm.shakeStand + tm.shake) {
      setPhase(c, 'leave');
    }
  } else if (c.phase === 'swat') {
    sit = posture;
    tailLift = c.t < 0.25 ? 1 : 0.4;
    paw = c.t > 0.25 && c.t < tm.swat - 0.15 ? 1 : 0;
    if (c.t >= 0.25) {
      c.fired = true;
    }
    if (c.t >= tm.swat) {
      setPhase(c, 'leave');
    }
  } else if (c.phase === 'leave') {
    if (!c.leaveTarget) {
      const floor = world.scene.floor;
      const mid = (floor.xMin + floor.xMax) / 2;
      c.leaveTarget = {
        x: actor.x < mid ? floor.xMax - 90 : floor.xMin + 90,
        y: lerp(floor.yMin, floor.yMax, world.rng()),
      };
    }
    out.move = c.leaveTarget;
    out.vmax = limit * 0.42;
    wagRate = 6;
    wagAmp = 0.3;
    const arrived = Math.hypot(c.leaveTarget.x - actor.x, c.leaveTarget.y - actor.y) < 8 && actor.speed < 15;
    if (arrived || c.t >= tm.leaveMax) {
      out.done = true;
    }
  }

  if (c.kickT > 0) {
    c.kickT -= dt;
  }

  // Reactions layer on top of whatever the phase set.
  const r = c.reaction;
  let kick = c.kickT > 0 ? 1 : 0;
  if (r) {
    r.t += dt;
    if (r.t >= r.dur && !(r.kind === 'scratch' && c.touchT < tm.strokeHold)) {
      c.reaction = null;
    } else if (r.kind === 'boop') {
      if (r.t < 0.15) {
        squint = 1;
      }
      snoutScale =
        r.t < 0.12
          ? 1 - am.boopSnout * (r.t / 0.12)
          : 1 - am.boopSnout * (1 - springUp(r.t - 0.12));
      const jolt = am.boopHeadJolt;
      headDx += r.t < 0.1 ? -jolt * (r.t / 0.1) : -jolt * (1 - springUp(r.t - 0.1));
    } else if (r.kind === 'headShake') {
      const env = Math.max(0, 1 - r.t / r.dur);
      headRot += Math.sin(r.t * Math.PI * 2 * 3.5) * am.headShakeRad * env;
      headDx += Math.sin(r.t * Math.PI * 2 * 3.5) * 1.5 * env;
      squint = Math.max(squint, 0.3);
    } else if (r.kind === 'flinch') {
      const env = easeInOutSine(1 - Math.abs((2 * r.t) / r.dur - 1));
      earBack += am.earFlinch * env;
      headDy -= 2 * env;
      torsoShift -= r.side * 2 * env;
    } else if (r.kind === 'scratch') {
      headRot += r.side * am.scratchTilt;
      squint = Math.max(squint, am.lidScratch);
      if (cat) {
        c.buntT += dt;
        headDx += r.side * am.bunt * Math.sin(Math.PI * ((c.buntT % tm.bunt) / tm.bunt));
      }
    } else if (r.kind === 'swat') {
      paw = r.t > 0.1 && r.t < r.dur - 0.1 ? 1 : 0;
      tailLift = 1;
    }
  }
  if (c.reaction?.kind !== 'scratch') {
    c.buntT = 0;
  }

  targets.sit = sit;
  targets.lie = lie;
  targets.belly = belly;
  targets.squint = Math.max(targets.squint, squint);
  targets.pant = Math.max(targets.pant, pant);
  targets.paw = Math.max(targets.paw, paw);
  targets.headDx = headDx;
  targets.headDy = headDy;
  targets.headRot = headRot;
  targets.earBack = earBack;
  targets.torsoShift = torsoShift;
  targets.snoutScale = snoutScale;
  targets.tailLift = tailLift;
  targets.knead = knead;
  targets.paddle = paddle;
  targets.kick = kick;
  targets.shake = shake;
  targets.wagAmp = wagAmp;
  if (pant > 0) {
    targets.breathAmp = 0.04;
    targets.breathRate = 1.8;
  }
  out.wagRate = wagRate;
  return out;
}
