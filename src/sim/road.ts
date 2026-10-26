export const roadSpots = ['home', 'petShop', 'park', 'trainingSchool', 'arcade'] as const;

export type RoadSpot = (typeof roadSpots)[number];

export function readRoadSpot(value: unknown): RoadSpot | undefined {
  return typeof value === 'string' && (roadSpots as readonly string[]).includes(value) ? (value as RoadSpot) : undefined;
}

/** The door a pet uses when it leaves this scene for the road. */
export function roadSpotForScene(sceneId: string): RoadSpot {
  if (sceneId === 'park') {
    return 'park';
  }
  if (sceneId === 'school') {
    return 'trainingSchool';
  }
  return 'home';
}
