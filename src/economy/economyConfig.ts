export const economyConfig = {
  version: 1,
  starter: { boops: 1000, items: { biscuit: 10 } as Record<string, number> },
  timeAccrual: { boopsPerHour: 60, payoutStep: 10, awayCapHours: 8, dailyCap: 600 },
  dailyLogin: { rewards: [20, 25, 30, 35, 40, 50, 100], graceDays: 1 },
  welcomeBack: { minDaysAway: 7, boops: 150 },
  minigame: { maxPerRun: 40, dailyCap: 150 },
  playdate: { boops: 30 },
  playFinds: {
    minBoops: 5,
    maxBoops: 10,
    dailyCap: 150,
    chanceByAction: { fetch_round: 0.15, toy_round: 0.15, cuddle_session: 0.05 },
  },
  levelUp: { boops: 50 },
  milestones: { trickMastered: 100, lifeStage: 200 },
  secondWind: { dailyLimitPerPet: 5 },
} as const;

export type PlayFindKind = keyof typeof economyConfig.playFinds.chanceByAction;
