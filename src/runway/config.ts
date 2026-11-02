export const runwayConfig = {
  venueName: 'The Catwalk',
  npcCount: 2,
  looksPerModel: 3,
  maxInvites: 5,
  recentShown: 5,
  /** Solo shows seed this share of the catalog as the shared rack (round(23/3)=8). */
  soloRackShare: 1 / 3,
  /** Friend drip: unlock tranche sizes in catalog order. */
  dripTrancheSizes: [8, 8, 7] as const,
  /** Minutes after invites_sent_at before tranche 1 unlocks. */
  dripFirstUnlockMin: 5,
  /** Minutes between subsequent tranches. */
  dripTrancheGapMin: 2,
  /** Friend show deadline must be at least this many minutes from create. Below the shortest choice (15) so send time and clock drift never reject it. */
  minDeadlineMin: 10,
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
