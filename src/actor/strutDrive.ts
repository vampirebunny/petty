import { breedById } from './breeds';
import { strutCadenceHz, strutDef, strutPose } from './data/strut';
import { geomOf } from './geometry';
import { stepGait } from './locomotion';
import type { Actor, Breed } from './types';

function legLength(actor: Actor, breed: Breed): number {
  return geomOf(breed, actor.displayAgeDays, actor.displayWeight, actor.vitality).L;
}

/** Ground speed in pet pixels/sec for one strut cycle per second. */
export function strutGroundSpeed(actor: Actor, breed: Breed): number {
  const L = legLength(actor, breed);
  return L * strutDef.stride * strutCadenceHz;
}

/**
 * Faces the pet and advances the strut. Keeps gait state on walk; feet use strutDef via strutFoot at draw time.
 * Does not run the home sim.
 */
export function stepStrutRun(actor: Actor, breed: Breed, dt: number, moving: boolean, face: 1 | -1 = 1): void {
  actor.face = face;
  actor.aimFace = face;
  actor.yawFace = face;
  if (!actor.turning) {
    actor.octant = face > 0 ? 'E' : 'W';
    actor.octantFrom = actor.octant;
    actor.octantTarget = actor.octant;
    actor.octantBlend = 1;
  }
  const px = moving ? strutGroundSpeed(actor, breed) : 0;
  actor.vx = face * px;
  actor.vy = 0;
  actor.speed = px;
  actor.share = moving ? 0.35 : 0;
  actor.strideShare = 0;
  actor.raceCadence = strutCadenceHz;
  stepGait(actor.gait, 'walk', dt);
  if (moving) {
    actor.phase += dt * Math.PI * 2 * strutCadenceHz;
  }
  actor.pose.walk = moving ? 1 : actor.pose.walk;
  actor.pose.lie = 0;
  actor.pose.sit = 0;
  if (moving) {
    actor.pose.headUp = strutPose.headUp ?? actor.pose.headUp;
    actor.pose.tailLift = strutPose.tailLift ?? actor.pose.tailLift;
    actor.pose.wagAmp = strutPose.wagAmp ?? actor.pose.wagAmp;
    actor.pose.spineArch = strutPose.spineArch ?? actor.pose.spineArch;
  }
}

export function breedOfActor(actor: Actor): Breed | null {
  return breedById(actor.breedId) ?? null;
}
