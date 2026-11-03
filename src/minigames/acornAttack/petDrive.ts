import { mirrorDir, aimOctant, facingFit, stepOctant } from '../../actor/facing';
import type { Facing } from '../../actor/data/facing';
import { bodyFrame } from '../../actor/geometry';
import { stepRaceRun } from '../../actor/raceDrive';
import type { Actor, Breed } from '../../actor/types';
import type { Run } from './types';

// The pet's own floor. Only depth scale reads it, and y 0 keeps that constant.
export const PET_FLOOR = { yMin: 0, yMax: 1 };
// The prototype pet's span in world units: paws 18 below the run point, the top of the head 27 above it.
export const PAW_Y = 18;
const HEAD_TOP = 27;
// Sideways speed (world units per second) that turns the pet to a back three-quarter view, and back.
const TURN_ON = 70;
const TURN_OFF = 28;

type PetFacing = {
  octant: Facing;
  octantFrom: Facing;
  octantTarget: Facing;
  octantBlend: number;
  octantHold: number;
  octantSpan: number;
  aimFace: 1 | -1;
  face: 1 | -1;
};

export type PetDrive = { facing: PetFacing; fit: Map<string, number> };

export function newPetDrive(): PetDrive {
  return {
    facing: { octant: 'N', octantFrom: 'N', octantTarget: 'N', octantBlend: 1, octantHold: 0, octantSpan: 0, aimFace: 1, face: 1 },
    fit: new Map(),
  };
}

function restore(actor: Actor, facing: PetFacing): void {
  actor.octant = facing.octant;
  actor.octantFrom = facing.octantFrom;
  actor.octantTarget = facing.octantTarget;
  actor.octantBlend = facing.octantBlend;
  actor.octantHold = facing.octantHold;
  actor.octantSpan = facing.octantSpan;
  actor.aimFace = facing.aimFace;
  actor.face = facing.face;
  actor.yawFace = facing.face;
}

function keep(actor: Actor, facing: PetFacing): void {
  facing.octant = actor.octant;
  facing.octantFrom = actor.octantFrom;
  facing.octantTarget = actor.octantTarget;
  facing.octantBlend = actor.octantBlend;
  facing.octantHold = actor.octantHold;
  facing.octantSpan = actor.octantSpan;
  facing.aimFace = actor.aimFace;
}

// Lawn speed to race meters per second: the start-card jog is a canter, play is a gallop that quickens.
function runMps(run: Run): number {
  if (run.groundSpeed <= 0) {
    return 0;
  }
  return Math.min(11, (run.groundSpeed / 110) * 7);
}

// Gallops the pet away from the camera and turns it to NE or NW while it moves sideways.
export function drivePet(drive: PetDrive, actor: Actor, breed: Breed, run: Run, dt: number): void {
  actor.equipped = {};
  actor.x = 0;
  actor.y = 0;
  if (dt <= 0) {
    restore(actor, drive.facing);
    return;
  }
  stepRaceRun(actor, breed, runMps(run), dt);
  const facing = drive.facing;
  const vx = run.phase === 'play' ? run.petVx : 0;
  if (vx > 1) {
    facing.face = 1;
  } else if (vx < -1) {
    facing.face = -1;
  }
  restore(actor, facing);
  const side = Math.abs(vx);
  if (side > TURN_ON) {
    aimOctant(actor, vx > 0 ? 'NE' : 'NW');
  } else if (side < TURN_OFF) {
    aimOctant(actor, 'N');
  }
  stepOctant(actor, dt);
  actor.turning = false;
  keep(actor, facing);
  actor.wagPh += dt * (breed.species === 'cat' ? 5 : 14);
}

// World units per pet pixel, so the drawn pet spans the prototype's paws-to-head height. Fitted once per
// breed and size from the back view at rest, so the gallop's bounce still reads.
export function petFit(drive: PetDrive, actor: Actor, breed: Breed): number {
  const key = `${breed.id}|${actor.displayAgeDays.toFixed(1)}|${actor.displayWeight.toFixed(2)}|${actor.vitality.toFixed(2)}`;
  const hit = drive.fit.get(key);
  if (hit != null) {
    return hit;
  }
  const rest = { sit: 0, lie: 0, walk: 0, headDown: 0, headRest: 0, pant: 0 };
  const frame = bodyFrame(
    breed,
    actor.displayAgeDays,
    actor.displayWeight,
    actor.vitality,
    rest,
    0,
    0,
    0,
    0,
    1,
    PET_FLOOR,
    0,
    undefined,
    0,
    facingFit('N', 'N', 1),
  );
  const top = -frame.scale * (frame.head.y - frame.geom.headR);
  const value = top > 1 ? (PAW_Y + HEAD_TOP) / top : 0.3;
  drive.fit.set(key, value);
  return value;
}

// The head's center and radius in pet pixels, for the game's headband.
export function petHead(actor: Actor, breed: Breed): { x: number; y: number; r: number } {
  const dir = mirrorDir(actor.octantFrom, actor.octant, actor.octantBlend, actor.face);
  const frame = bodyFrame(
    breed,
    actor.displayAgeDays,
    actor.displayWeight,
    actor.vitality,
    actor.pose,
    actor.bark.open,
    actor.phase,
    actor.x,
    actor.y,
    dir,
    PET_FLOOR,
    actor.speed,
    actor.gait,
    actor.share,
    facingFit(actor.octantFrom, actor.octant, actor.octantBlend),
  );
  return { x: actor.x + dir * frame.scale * frame.head.x, y: actor.y + frame.scale * frame.head.y, r: frame.geom.headR * frame.scale };
}
