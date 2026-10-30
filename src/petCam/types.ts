import type { Facing } from '../actor/data/facing';
import type { FurniturePiece, FurniturePlacement } from '../actor/furniture';
import type { Gait, Pose } from '../actor/types';
import type { Equipped, Look } from '../sim/types';

export const clipIds = [
  'boop',
  'sweater',
  'tail',
  'inOut',
  'hind',
  'nap',
  'bowl',
  'bedPush',
] as const;

export type ClipId = (typeof clipIds)[number];

export type RoomId = 'livingroom' | 'bedroom' | 'catio';

export const clipVersion = 2;

export type PetSnap = {
  species: 'dog' | 'cat';
  breedId: string;
  ageDays: number;
  stage: string;
  look: Look | null;
  equipped: Equipped;
  vitality: number;
  weight: number;
};

export type ClipRecord = {
  clipId: ClipId;
  clipVersion: typeof clipVersion;
  seed: number;
  roomId: RoomId;
  recordedAt: number;
  isNight: boolean;
  pet: PetSnap;
  pieces: FurniturePiece[];
  placed: FurniturePlacement[];
  sweaterItemId: string | null;
};

export type ClipFrame = {
  x: number;
  y: number;
  /** Height above the floor, for sitting on the sofa or bed. */
  z: number;
  face: 1 | -1;
  octantFrom: Facing;
  octant: Facing;
  octantBlend: number;
  pose: Partial<Pose>;
  gait: Gait | null;
  shake: number;
  flash: number;
  stuck: boolean;
  hind: boolean;
  scale: number;
  /** Placements for this frame. A new array; the record's list is left as it was. */
  placed: FurniturePlacement[];
  /** True when the pet is meant to overlap scenery, such as a nap on the sofa. */
  onScenery: boolean;
  /** The pet may leave the room frame, as in the in-and-out passes. */
  offFrame: boolean;
};
