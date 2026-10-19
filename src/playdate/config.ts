// Tunable playdate numbers. Cooldown and the cross-species flag are read from here
// so a later remote config can replace the values without other code changes.
export const playdateConfig = {
  cooldownMinutes: 60,
  allowCrossSpecies: true,
  happinessGain: 12,
  bondGain: 8,
  historyLimit: 3,
  dayHour: 14,
  castMin: 10,
  castMax: 12,
  dailyCount: 3,
  // Current boldness under this opens the timeline with warm-up beats.
  shyBoldness: 40,
  bondMax: 100,
};

export const closingHoldMs = 4000;
export const minDurationMs = 45000;
export const maxDurationMs = 90000;

export const warmupActions = ['sniff', 'hide', 'approach'] as const;

export const closingActions = ['nap', 'celebrate', 'walk_off'] as const;
