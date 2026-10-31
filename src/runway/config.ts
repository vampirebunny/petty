export const runwayConfig = {
  venueName: 'The Catwalk',
  npcCount: 3,
  looksPerModel: 3,
  maxInvites: 5,
  recentShown: 5,
  rackCap: 12,
  dripFirstUnlockMin: 5,
  dripNextUnlockMin: 1,
  pollCloseMin: 15,
  poseEnabled: true,
  runwayZoom: 1.8,
  styles: ['glam', 'sporty', 'cozy', 'goofy'] as const,
  // Style → category/tag weight. Missing tags keep weight 1.
  styleWeights: {
    glam: { sequin: 3, cape: 3, crown: 3, glitter: 3, tutu: 3, jewel: 2.5, hat: 1.2, boots: 1.2 },
    sporty: { bandana: 3, goggles: 3, sneaker: 3, jacket: 2.5, boots: 2, primary: 2 },
    cozy: { sweater: 3, scarf: 3, beanie: 3, rain: 2.5, pastel: 2, boots: 1.5 },
    goofy: { mustache: 3, antennae: 3, mismatch: 3, odd: 2.5, hat: 1.2 },
  } as Record<'glam' | 'sporty' | 'cozy' | 'goofy', Record<string, number>>,
};

export type RunwayStyle = (typeof runwayConfig.styles)[number];
