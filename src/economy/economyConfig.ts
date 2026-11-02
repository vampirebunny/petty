export const economyConfig = {
  version: 2,
  starter: { boops: 1000, items: { biscuit: 10 } as Record<string, number> },
  timeAccrual: { boopsPerHour: 60, payoutStep: 15, awayCapHours: 8, dailyCap: 400 },
  firstOpen: { boops: 50 },
  streak: { length: 7, bonus: 150, graceDays: 1 },
  dayBoundary: { minGapHours: 20 },
  activities: { boops: 40, dailyCap: 120 },
  playdate: { boops: 30, dailyCap: 120 },
  competition: { finish: 10, top3: 30, dailyCap: 100 },
  parkFind: { boops: 25, dailyCap: 75 },
  levelUp: { boops: 50 },
  milestones: { trickMastered: 100, lifeStage: 200 },
  minigame: { maxPerRun: 0, dailyCap: 0 },
  secondWind: { dailyLimitPerPet: 5, energy: 10 },
  exclusiveMultiplier: 1.25,
  limitedMultiplier: 1.5,
};

export type EconomyConfig = typeof economyConfig;
