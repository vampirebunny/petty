export {
  breedById,
  breedsFor,
  catBreeds,
  catTasks,
  coatStyles,
  coatStylesFor,
  defaultLook,
  dogBreeds,
  dogTasks,
  eyeColorsFor,
  isCoatStyle,
  isDarkCoat,
  limbSize,
  lookWithCoat,
  pitchFor,
  resolveBreed,
  resolveBreedById,
  sharedTasks,
  voiceRate,
} from './breeds';
export type { CoatStyle, LookOption } from './breeds';
export { canBehave, isUserTask, reactionFor, userTasks } from './behavior';
export { bagAmount, bodyFrame, depthScale, geomOf, thickOf } from './geometry';
export { easeOut, growthFor, smoothstep, visualProgress } from './growth';
export { gaitFoot, jumpArc, solveKnee } from './legs';
export {
  airTime,
  blendedFoot,
  bounceOf,
  chooseGait,
  energySpeedScale,
  gaitFootFor,
  isGaitAllowed,
  jumpSpeed,
  landImpact,
  locoModsOf,
  maxGaitOf,
  newGaitState,
  phaseRate,
  predictCrossing,
  predictLanding,
  sampleChaseSpeed,
  stageProfileOf,
  stepGait,
  stepStamina,
  strideOf,
} from './locomotion';
export { gaitDefs } from './data/locomotion';
export { defaultPose, easeInOutSine, easePose, springUp } from './pose';
export { greetingIds, motionMods, GREET } from './greetings';
export { cuddleParamsFor, stageFactor } from './data/cuddle';
export { cuddleBackPath, cuddleTouch, cuddleZoneAt, endCuddle, isCuddling, setCuddleGesturing, takeCuddleOut } from './cuddle';
export type { CuddleTouch } from './cuddle';
export {
  actionEnabled,
  actionReason,
  compileScene,
  hasRefillableWaterBowl,
  isPreset,
  loadScene,
  poiOf,
  sceneById,
  sceneForSpecies,
  sceneList,
  sceneSource,
  scenes,
  tuftsFor,
} from './scenes';
export { statusOf } from './status';
export { phaseOf, stars, todAt } from './timeOfDay';
export { outfitSlots, wardrobe, wearItem } from './wardrobe';
export {
  createWorld,
  dropBallAt,
  flickBallAt,
  frameDt,
  isSceneTravel,
  setWorldScene,
  settleOnResume,
  spawnActor,
  startSceneEnter,
  startSceneExit,
  setDirection,
  stagePoint,
  startUserTask,
  syncActor,
  syncWorldFood,
  syncWorldWater,
  takeBowlDrinks,
  takeMeals,
  takeEnergyDelta,
  takeEnergyPops,
  takeMoodPops,
  takeHungerDelta,
  takeThirstDelta,
  takeSounds,
  takeWeightDelta,
  beginGreeting,
  patGreeting,
  takePendingGreeting,
  debugFlipFace,
  debugGreeting,
  planGreeting,
  throwFromEdge,
  update,
} from './sim';
export type { Geom } from './geometry';
export type { Scene } from './scenes';
export type { TimeOfDay } from './timeOfDay';
export type {
  Actor,
  ActorSource,
  Anchors,
  Breed,
  CuddleExit,
  CuddleOut,
  CuddleZone,
  Direction,
  Pose,
  SoundEvent,
  TaskType,
  World,
} from './types';
export { applyVariant, neutralVariant, variantFor } from './variation';
export type { Variant } from './variation';
