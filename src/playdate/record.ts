import type { Equipped, PetState } from '../sim/types';
import { playdateConfig } from './config';
import { generatePlaydate } from './generate';
import { snapshotPet } from './snapshot';
import type { ActivityDefinition, PetSnapshot, PlaydateRecord } from './types';

export function createPlaydateRecord(input: {
  pet: PetState;
  partner: PetSnapshot;
  activity: ActivityDefinition;
  sceneId: string;
  outfit: Equipped;
  seed: number;
  createdAt: string;
  ownerId: string;
  recentTags?: readonly string[];
  latestTags?: readonly string[];
  bond?: number;
}): PlaydateRecord {
  const snapshotId = `${input.pet.id}-${input.seed}`;
  const petA = snapshotPet(input.pet, input.outfit, input.createdAt, snapshotId);
  const generated = generatePlaydate({
    petA,
    petB: input.partner,
    activity: input.activity,
    sceneId: input.sceneId,
    seed: input.seed,
    recentTags: input.recentTags,
    latestTags: input.latestTags,
    bond: input.bond ?? 0,
  });
  return {
    version: 2,
    playdateId: snapshotId,
    ownerId: input.ownerId,
    createdAt: input.createdAt,
    sceneId: input.sceneId,
    hour: playdateConfig.dayHour,
    petA,
    petB: input.partner,
    activityId: input.activity.id,
    outfit: { ...input.outfit },
    seed: input.seed,
    beats: generated.beats,
    outcome: generated.outcome,
  };
}
