import { breedById } from './breeds';
import { racePoses } from './data/locomotion';
import { geomOf } from './geometry';
import { fitBarZ } from '../sim/trickProps';
import { attachRaceVisual, clearRaceVisual, jumpConfig, puffDust, raceLeapVisual, resolveJump, stumbleVisualAt } from './jump';
import { phaseRate, stepGait, streamOf } from './locomotion';
import type { Actor, Breed, Gait } from './types';

export function raceGaitFor(mps: number): Gait {
  if (mps < racePoses.bands.walk) {
    return 'walk';
  }
  if (mps < racePoses.bands.trot) {
    return 'trot';
  }
  if (mps < racePoses.bands.canter) {
    return 'canter';
  }
  return 'gallop';
}

function legLength(actor: Actor, breed: Breed): number {
  return geomOf(breed, actor.displayAgeDays, actor.displayWeight, actor.vitality).L;
}

// 0.65 at a standstill and 1.8 at the race cap. Paired with a short fixed stride, so the gallop
// visibly quickens as taps get faster and lengthens when they slow down. Feet still match the ground.
export function raceCadence(mps: number): number {
  const top = racePoses.topMps;
  const share = top > 0 ? Math.min(1, Math.max(0, mps) / top) : 0;
  return 0.65 + 1.15 * share;
}

// Faces the pet right and advances the gait from race speed. Does not run the home sim.
export function stepRaceRun(
  actor: Actor,
  breed: Breed,
  mps: number,
  dt: number,
  legsPerMeter: number = racePoses.legsPerMeter,
): void {
  const speed = Math.max(0, mps);
  actor.face = 1;
  actor.aimFace = 1;
  actor.yawFace = 1;
  actor.octant = 'E';
  actor.octantFrom = 'E';
  actor.octantTarget = 'E';
  actor.octantBlend = 1;
  actor.turning = false;
  const px = speed * legLength(actor, breed) * legsPerMeter;
  actor.vx = px;
  actor.vy = 0;
  actor.speed = px;
  actor.share = racePoses.topMps > 0 ? Math.min(1, speed / racePoses.topMps) : 0;
  actor.strideShare = 0;
  actor.raceCadence = raceCadence(speed);
  stepGait(actor.gait, raceGaitFor(speed), dt);
  actor.phase += dt * phaseRate(actor.gait, px, legLength(actor, breed), actor.strideShare) * actor.raceCadence;
  const flow = streamOf(actor.gait);
  const moving = speed > 0.2 ? 1 : 0;
  actor.pose.walk = moving;
  actor.pose.stretch = flow.stretch * moving;
  actor.pose.stream = flow.stream * moving;
  actor.pose.lie = 0;
  actor.pose.sit = 0;
  if (actor.jump) {
    for (const puff of actor.jump.dust) {
      puff.t += dt;
    }
    actor.jump.dust = actor.jump.dust.filter((puff) => puff.t < puff.life);
  }
  if (actor.stumble) {
    for (const puff of actor.stumble.dust) {
      puff.t += dt;
    }
    actor.stumble.dust = actor.stumble.dust.filter((puff) => puff.t < puff.life);
  }
}

// Ballistic lift across the air: 0 at take-off and touchdown, 1 at the peak.
export function leapLift(airU: number): number {
  const u = Math.max(0, Math.min(1, airU));
  return 4 * u * (1 - u);
}

// Lift where a jump from the edge of the zone passes over the hurdle (a quarter of the air from one end).
const edgeLift = 0.75;
// Peak height as a share of the leap's length on the ground, so a long leap reads as a long, high arc.
const apexPerLength = 0.3;

// Bar height fitted to this pet the same way the Training School fits its hurdle, and a race leap tall
// enough that the feet clear it with the jump's usual margin even from the edge of the zone.
// `airPx` is the leap's ground length in the pet's own pixels.
export function raceHurdleSize(actor: Actor, airPx: number): { barZ: number; apex: number } {
  const reach = resolveJump(actor, { heightPx: 1e4 });
  const bodyH = reach?.bodyHPx ?? 30;
  const ceiling = reach?.heightPx ?? racePoses.leapApexPx;
  const barZ = fitBarZ(ceiling, bodyH, jumpConfig.obstacleMargin);
  const clear = (barZ + jumpConfig.obstacleMargin * bodyH) / edgeLift;
  return { barZ, apex: Math.max(racePoses.leapApexPx, clear, airPx * apexPerLength) };
}

// The leap's ground length in the pet's own pixels at a track scale.
export function raceAirPx(actor: Actor, breed: Breed, airM: number, legsPerMeter: number): number {
  return airM * legLength(actor, breed) * legsPerMeter;
}

export function applyRaceLeap(actor: Actor, airU: number, afterLandS: number, apex: number): boolean {
  const visual = raceLeapVisual(actor, airU, afterLandS);
  actor.stumble = null;
  if (!visual) {
    clearRaceVisual(actor);
    actor.z = 0;
    return false;
  }
  const species = breedById(actor.breedId)?.species ?? 'dog';
  const landing = jumpConfig[species].landingMs / 1000;
  const phase = afterLandS <= 0 ? 'airborne' : afterLandS < landing ? 'landing' : 'recovery';
  attachRaceVisual(actor, visual, phase, apex);
  actor.z = afterLandS > 0 ? 0 : leapLift(airU) * apex;
  return true;
}

export function applyStumble(actor: Actor, breed: Breed, t: number, reduced: boolean): void {
  clearRaceVisual(actor);
  actor.z = 0;
  const prev = actor.stumble;
  const dust = prev?.dust ?? [];
  const dusted = prev?.dusted ?? false;
  if (!dusted && t >= 0.15 && !reduced) {
    puffDust(actor, dust);
  }
  actor.stumble = {
    t,
    visual: stumbleVisualAt(t, legLength(actor, breed)),
    dust,
    dusted: dusted || t >= 0.15,
  };
}

export function clearPose(actor: Actor): void {
  clearRaceVisual(actor);
  actor.stumble = null;
  actor.z = 0;
}

export type RaceLeap = {
  airU: number;
  afterLandS: number;
  airSeconds: number;
  apex: number;
  landed: boolean;
};

// Advances a gallop, or a leap that is already in the air. The leap plays through landing and
// recovery, then the pet gallops. Crossing the finish line does not cancel it: pass the same clock.
export function stepRaceMotion(
  actor: Actor,
  breed: Breed,
  mps: number,
  dt: number,
  leap: RaceLeap | null,
  reduced: boolean,
  legsPerMeter: number = racePoses.legsPerMeter,
): RaceLeap | null {
  stepRaceRun(actor, breed, mps, dt, legsPerMeter);
  if (!leap) return null;

  let airU = leap.airU;
  let afterLandS = leap.afterLandS;
  let landed = leap.landed;
  const airSeconds = Math.max(0.001, leap.airSeconds);

  if (airU < 1) {
    const nextU = airU + dt / airSeconds;
    if (nextU < 1) {
      applyRaceLeap(actor, nextU, 0, leap.apex);
      return { ...leap, airU: nextU, afterLandS: 0, landed: false };
    }
    afterLandS += (nextU - 1) * airSeconds;
    airU = 1;
  } else {
    afterLandS += dt;
  }

  if (!landed && afterLandS > 0 && !reduced) {
    const dust = actor.jump?.dust ?? [];
    puffDust(actor, dust);
    if (actor.jump) actor.jump.dust = dust;
  }
  if (afterLandS > 0) landed = true;

  const playing = applyRaceLeap(actor, 1, afterLandS, leap.apex);
  if (!playing) {
    clearPose(actor);
    return null;
  }
  return { ...leap, airU, afterLandS, landed };
}

export type PoseMode = 'off' | 'gallop' | 'leap' | 'stumble' | 'loop';

export type PosePreview = {
  mode: PoseMode;
  rate: number;
  clock: number;
  landed: boolean;
};

export function freshPreview(): PosePreview {
  return { mode: 'off', rate: 1, clock: 0, landed: false };
}

function leapSpan(actor: Actor): { air: number; land: number } {
  const species = breedById(actor.breedId)?.species ?? 'dog';
  return {
    air: racePoses.leapAirSeconds,
    land: jumpConfig[species].landingMs / 1000 + jumpConfig[species].recoveryMs / 1000,
  };
}

export function stepPosePreview(actor: Actor, breed: Breed, preview: PosePreview, dt: number, reduced: boolean): void {
  if (preview.mode === 'off') {
    return;
  }
  const step = dt * preview.rate;
  preview.clock += step;
  const span = leapSpan(actor);
  const run = (mps: number) => {
    clearPose(actor);
    stepRaceRun(actor, breed, mps, step);
  };
  const playLeap = (local: number) => {
    stepRaceRun(actor, breed, racePoses.topMps, step);
    if (local < span.air) {
      preview.landed = false;
      applyRaceLeap(actor, local / span.air, 0, racePoses.leapApexPx);
      return;
    }
    const after = local - span.air;
    if (!preview.landed) {
      preview.landed = true;
      if (!reduced) {
        const dust = actor.jump?.dust ?? [];
        puffDust(actor, dust);
        if (actor.jump) {
          actor.jump.dust = dust;
        }
      }
    }
    const playing = applyRaceLeap(actor, 1, after, racePoses.leapApexPx);
    if (!playing && preview.mode === 'leap') {
      preview.mode = 'gallop';
      preview.clock = 0;
    }
  };
  const playStumble = (local: number) => {
    const t = local / racePoses.stumbleSeconds;
    if (t >= 1) {
      clearPose(actor);
      stepRaceRun(actor, breed, racePoses.topMps, step);
      if (preview.mode === 'stumble') {
        preview.mode = 'gallop';
        preview.clock = 0;
      }
      return;
    }
    stepRaceRun(actor, breed, racePoses.stumbleMps, step);
    applyStumble(actor, breed, t, reduced);
  };
  if (preview.mode === 'gallop') {
    run(racePoses.topMps);
    return;
  }
  if (preview.mode === 'leap') {
    playLeap(preview.clock);
    return;
  }
  if (preview.mode === 'stumble') {
    playStumble(preview.clock);
    return;
  }
  const cycle = 1.5 + span.air + span.land + 1 + racePoses.stumbleSeconds;
  let cursor = preview.clock % cycle;
  if (cursor < 1.5) {
    run(racePoses.topMps);
    return;
  }
  cursor -= 1.5;
  if (cursor < span.air + span.land) {
    playLeap(cursor);
    return;
  }
  cursor -= span.air + span.land;
  if (cursor < 1) {
    run(racePoses.topMps);
    return;
  }
  playStumble(cursor - 1);
}
