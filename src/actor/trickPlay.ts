import { facingRing, type Facing } from './data/facing';
import { stepsFor, type TrickOutcome, type TrickStep } from './data/trickScripts';
import { jump, jumpConfig, resolveJump } from './jump';
import { defaultPose } from './pose';
import { approachSign, barTop, hoopApex, propPoint, TUNNEL, type PlacedTrickProp } from '../sim/trickProps';
import { stageDayThresholds } from '../sim/config';
import type { Actor, Pose, World } from './types';

export type TrickPlayback = {
  trickId: string;
  steps: TrickStep[];
  index: number;
  t: number;
  done: boolean;
  face: 1 | -1;
  pace: number;
  senior: boolean;
  armed: boolean;
  noteAt: number;
  spinFace: 1 | -1;
  propIds: string[];
  propCursor: number;
  // Locked when the pet commits to a prop. Recomputed each frame, the exit flips once they pass the middle and they turn around.
  pathSign: 1 | -1 | null;
  // Side of the bar the pet jumped from on a knock. The bar falls once the pet crosses it. 0 means no knock pending.
  knockSide: number;
};

export function beginPlayback(
  trickId: string,
  outcome: TrickOutcome,
  face: 1 | -1,
  pace: number,
  senior: boolean,
  propIds: string[] = [],
): TrickPlayback {
  const steps = stepsFor(trickId, outcome);
  return {
    trickId,
    steps,
    index: 0,
    t: 0,
    done: steps.length === 0,
    face,
    pace: Math.max(pace, 0.4),
    senior,
    armed: false,
    noteAt: -1,
    spinFace: face,
    propIds,
    propCursor: 0,
    pathSign: null,
    knockSide: 0,
  };
}

type Env = {
  x: number;
  y: number;
  bodyLength: number;
  limit: number;
  prop: PlacedTrickProp | null;
  ballX: number | null;
  setFace: (face: 1 | -1) => void;
  setOctant: (octant: Facing) => void;
  moveTo: (x: number, y: number, speed: number, walk: boolean) => void;
  pose: (pose: Partial<Pose>, rate?: Partial<Record<keyof Pose, number>>, wag?: { amp: number; rate: number }) => void;
  hop: (step: TrickStep) => void;
  sound: (kind: NonNullable<TrickStep['sound']>, rate: number) => void;
  toss: (step: TrickStep) => void;
  carry: (mode: 'pickup' | 'drop') => void;
  clap: () => void;
  jumping: boolean;
};

// The side the pet started from stays the side for the whole prop. Crossing the middle must not reverse the course.
function courseSign(play: TrickPlayback, x: number, y: number, prop: PlacedTrickProp, face: 1 | -1): 1 | -1 {
  if (play.pathSign != null) {
    return play.pathSign;
  }
  const sign = approachSign(x, y, prop.x, prop.y, face, 80);
  play.pathSign = sign;
  return sign;
}

function targetOf(step: TrickStep, env: Env, play: TrickPlayback): { x: number; y: number } | null {
  const move = step.move;
  if (!move) {
    return null;
  }
  if (move.dx != null && move.to == null) {
    return { x: env.x + play.face * move.dx, y: env.y + (move.dy ?? 0) };
  }
  const to = move.to;
  if (!to) {
    return null;
  }
  if (to === 'front') {
    return { x: env.x, y: env.y + 40 };
  }
  if ('ball' in to) {
    return { x: env.ballX ?? env.x + play.face * 40, y: env.y };
  }
  if ('x' in to) {
    return { x: to.x, y: env.y + (move.dy ?? 0) };
  }
  if (!env.prop) {
    return { x: env.x, y: env.y };
  }
  const sign = courseSign(play, env.x, env.y, env.prop, play.face);
  const point = propPoint(
    env.prop.type,
    to.at,
    env.prop.x,
    env.prop.y,
    sign,
    env.bodyLength,
    jumpConfig.hurdleApproach,
    jumpConfig.hurdlePast,
  );
  return { x: point.x, y: point.y + (move.dy ?? 0) };
}

export function advancePlayback(play: TrickPlayback, dt: number, env: Env): void {
  if (play.done) {
    return;
  }
  const step = play.steps[play.index];
  if (!step) {
    play.done = true;
    return;
  }
  if (!play.armed) {
    play.armed = true;
    play.t = 0;
    play.noteAt = -1;
    if (step.spin) {
      play.spinFace = play.face;
    }
    if (step.toss) {
      env.toss(step);
    }
    if (step.jump) {
      env.hop(step);
    }
    if (step.carry) {
      env.carry(step.carry);
    }
    if (step.clap) {
      env.clap();
    }
    if (step.sound) {
      env.sound(step.sound, 1);
    }
  }
  play.t += dt;
  const pose = { ...(step.pose ?? {}) };
  if (play.senior && pose.stand != null) {
    pose.stand = Math.min(pose.stand, 0.8);
  }
  if (step.spin) {
    const turns = step.spin.turns;
    const count = Math.max(1, Math.round(Math.abs(turns) * 8));
    const dur = (step.dur ?? 1) * play.pace;
    const at = Math.min(count, Math.floor((play.t / Math.max(dur, 0.05)) * count));
    const start = facingRing.indexOf(play.spinFace === 1 ? 'E' : 'W');
    env.setOctant(facingRing[(start + at) % facingRing.length]);
    pose.walk = 0.55;
    if (play.t >= dur) {
      const flips = Math.round(turns * 2) % 2 !== 0;
      const next = flips ? (play.spinFace === 1 ? -1 : 1) : play.spinFace;
      play.face = next;
      env.setFace(next);
    }
  }
  if (step.sing) {
    let cursor = 0;
    const voice = step.sing.voice;
    step.sing.notes.forEach((note, index) => {
      const rate = Math.min(2.2, Math.max(0.6, 2 ** (note.st / 12)));
      if (play.t >= cursor && play.noteAt < index) {
        play.noteAt = index;
        env.sound(voice === 'meow' ? 'meow' : 'woof', rate);
      }
      cursor += note.d;
    });
  }
  env.pose(pose, step.rate, step.wag);
  const goal = targetOf(step, env, play);
  if (goal && step.move) {
    env.moveTo(goal.x, goal.y, step.move.speed * Math.max(env.limit, 40), !step.move.slide);
    if (!step.move.backward && !step.move.slide && Math.abs(goal.x - env.x) > 6) {
      const next = goal.x >= env.x ? 1 : -1;
      play.face = next;
      env.setFace(next);
    }
  }
  const dur = (step.dur ?? (step.jump || step.sing ? 0.8 : 0.4)) * play.pace;
  const arrived = goal != null && Math.hypot(goal.x - env.x, goal.y - env.y) < 16;
  const jumpDone = step.jump ? !env.jumping && play.t > 0.2 : true;
  const finished = step.untilArrive ? (arrived || play.t >= dur) && jumpDone : play.t >= dur && jumpDone;
  if (!finished) {
    return;
  }
  play.index += 1;
  play.armed = false;
  play.t = 0;
  if (play.index < play.steps.length) {
    return;
  }
  if (play.propCursor + 1 < play.propIds.length) {
    play.propCursor += 1;
    play.pathSign = null;
    play.index = 0;
    play.steps = stepsFor(play.trickId, 'success');
    return;
  }
  play.done = true;
}

export function seniorStand(ageDays: number): boolean {
  return ageDays >= stageDayThresholds[3];
}

export function applyTrickPose(
  actor: Actor,
  play: TrickPlayback,
  world: World,
  dt: number,
  targets: Pose,
  limit: number,
): { move: { x: number; y: number } | null; vmax: number; wagRate: number } {
  let move: { x: number; y: number } | null = null;
  let vmax = 0;
  let wagRate = 5;
  const propId = play.propIds[play.propCursor];
  const prop = (world.trickProps ?? []).find((item) => item.instanceId === propId) ?? null;
  const ball = world.items.find((item) => item.id === 'trick-ball');
  const bodyLength = Math.max(actor.anchors.scale * 48, 36);
  const bodyHeight = Math.max(actor.anchors.scale * 36, 28);
  advancePlayback(play, dt, {
    x: actor.x,
    y: actor.y,
    bodyLength,
    limit,
    prop,
    ballX: ball?.x ?? null,
    setFace: (face) => {
      actor.face = face;
    },
    setOctant: (octant) => {
      actor.octant = octant;
      actor.octantTarget = octant;
      actor.octantFrom = octant;
      actor.octantBlend = 1;
    },
    moveTo: (x, y, speed, walk) => {
      move = { x, y };
      vmax = speed;
      if (walk) {
        targets.walk = Math.max(targets.walk, 0.65);
      }
    },
    pose: (pose, rate, wag) => {
      const base = defaultPose();
      for (const key of Object.keys(base) as (keyof Pose)[]) {
        targets[key] = pose[key] != null ? pose[key] : base[key];
      }
      if (wag) {
        targets.wagAmp = wag.amp;
        wagRate = wag.rate;
      }
      actor.task.trickRates = rate;
    },
    hop: (step) => {
      const hop = step.jump;
      if (!hop || actor.jump) {
        return;
      }
      let targetX = hop.inPlace ? actor.x : undefined;
      let landZ = 0;
      if (hop.to && prop && typeof hop.to === 'object' && 'prop' in hop.to) {
        const sign = courseSign(play, actor.x, actor.y, prop, play.face);
        const point = propPoint(prop.type, hop.to.at, prop.x, prop.y, sign, bodyLength, jumpConfig.hurdleApproach, jumpConfig.hurdlePast);
        targetX = point.x;
        landZ = hop.landZ === 'top' ? point.landZ : 0;
      } else if (hop.to && typeof hop.to === 'object' && 'ball' in hop.to && ball) {
        targetX = ball.x;
      }
      if (hop.landZ === 0) {
        landZ = 0;
      }
      const bodyHPx = resolveJump(actor)?.bodyHPx ?? bodyHeight;
      let obstacleHeight: number | undefined;
      let heightPx: number | undefined;
      if (prop?.type === 'hurdle' && hop.knock) {
        // A miss: the apex stays under the bar so the feet clip it.
        heightPx = barTop(prop) * 0.6;
      } else if (prop?.type === 'hurdle' && hop.clear === 'bar') {
        // The jump clears the drawn bar. The bar was fitted to this pet's ceiling when the trick began.
        obstacleHeight = barTop(prop);
      } else if (prop?.type === 'hoop' && hop.heightPx === 'hoop') {
        // The body's middle passes through the ring's middle.
        heightPx = hoopApex(prop, bodyHPx);
      }
      const launched = jump(actor, {
        targetX,
        landZ,
        height: hop.height,
        fast: hop.fast,
        wiggle: hop.wiggle,
        obstacleHeight,
        heightPx,
      });
      if (hop.knock && prop) {
        if (launched) {
          play.knockSide = Math.sign(actor.x - prop.x) || -play.face;
        } else {
          prop.knocked = true;
        }
      }
    },
    sound: (kind, rate) => {
      const sound = kind === 'meow' || kind === 'trill' ? 'meow' : 'bark';
      if (world.sounds.length < 8) {
        world.sounds.push({ actorId: actor.id, sound, rate });
      }
      actor.bark = { active: true, t: 0, fired: [true, true], open: 1, sound: false };
    },
    toss: (step) => {
      const fromX = actor.x + play.face * 120;
      const item = {
        id: 'trick-ball',
        kind: 'ball',
        x: fromX,
        y: actor.y,
        z: 70,
        vx: ((step.toss?.dx ?? 0) * play.face) / 0.7,
        vy: 0,
        vz: step.toss?.target === 'mouth' ? 80 : 20,
        state: 'free' as const,
      };
      world.items = world.items.filter((entry) => entry.id !== 'trick-ball');
      world.items.push(item);
    },
    carry: (mode) => {
      const item = world.items.find((entry) => entry.id === 'trick-ball');
      if (!item) {
        return;
      }
      if (mode === 'pickup') {
        item.state = 'carried';
        item.holderId = actor.id;
      } else {
        item.state = 'free';
        item.holderId = undefined;
        item.z = 12;
      }
    },
    clap: () => {
      actor.hearts.push({ x: play.face * 16, y: -28, t: 0, life: 0.6 });
    },
    jumping: actor.jump != null,
  });
  // The bar drops when the pet passes over it, not when it leaves the ground.
  if (play.knockSide !== 0 && prop) {
    const side = Math.sign(actor.x - prop.x);
    if ((side !== 0 && side !== play.knockSide) || !actor.jump) {
      prop.knocked = true;
      play.knockSide = 0;
    }
  }
  // Inside the tube the crawl is immediate. A slow ease leaves the head above the roof, and the pet stalls there.
  if (
    prop?.type === 'tunnel' &&
    actor.z <= 0.5 &&
    Math.abs(actor.y - prop.y) < 28 &&
    Math.abs(actor.x - prop.x) < TUNNEL.half + TUNNEL.mouth
  ) {
    targets.stalk = 1;
    targets.crouch = 1;
    targets.headDown = Math.max(targets.headDown, 0.9);
    targets.earBack = 1;
    targets.headUp = 0;
    targets.sit = 0;
    actor.pose.stalk = 1;
    actor.pose.crouch = 1;
    actor.pose.headDown = Math.max(actor.pose.headDown, 0.9);
    actor.pose.earBack = 1;
    actor.pose.headUp = 0;
    actor.pose.sit = 0;
    const dashing = play.steps[play.index]?.move?.to;
    if (dashing && typeof dashing === 'object' && 'at' in dashing && dashing.at === 'out') {
      vmax = Math.max(vmax, Math.max(limit, 90) * 2.6);
    }
  }
  return { move, vmax, wagRate };
}
