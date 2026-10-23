export const AWAY_DECAY = {
  maxElapsedH: 720, // cap at 30 days
  needs: {
    tummy: { graceH: 12, graceTarget: 60, floor: 10, halfLifeH: 24 },
    mood: { graceH: 12, graceTarget: 70, floor: 20, halfLifeH: 36 },
    energy: { recovers: true, recoverTarget: 90, recoverHalfLifeH: 2 },
  },
  weight: { graceH: 24, halfLifeH: 96 },
  welcomeBackThresholdH: 12,
  returnHomeAfterH: 3,
} as const;
