// What a pet can do with a toy. Each rule lists the behaviors a toy allows; the pet picks among them by age,
// mood and attributes (see sim). Steps are the ordered core of a session.
export type PlayStep =
  | 'chase'
  | 'pounce'
  | 'bat'
  | 'catch'
  | 'grab'
  | 'shake'
  | 'carry'
  | 'drop'
  | 'chew';

export type PlayBehavior =
  | 'catchBounce'
  | 'catchRoll'
  | 'return'
  | 'runUnder'
  | 'leapCatch'
  | 'catchAfterLand'
  | 'stalk'
  | 'pounce'
  | 'bat'
  | 'roll'
  | 'tangle'
  | 'shake'
  | 'flopChew';

export type PlayRule = {
  species: 'dog' | 'cat';
  itemKind: string;
  steps: PlayStep[];
  // The behaviors this toy allows for this species.
  allows: readonly PlayBehavior[];
  endWith: 'sit_pant' | 'purr' | 'idle';
};

export const PLAY_RULES: PlayRule[] = [
  {
    species: 'dog',
    itemKind: 'ball',
    steps: ['chase', 'grab', 'carry', 'drop'],
    allows: ['catchBounce', 'catchRoll', 'leapCatch', 'return'],
    endWith: 'sit_pant',
  },
  {
    species: 'dog',
    itemKind: 'frisbee',
    steps: ['chase', 'catch', 'carry', 'drop'],
    allows: ['runUnder', 'leapCatch', 'catchAfterLand', 'return'],
    endWith: 'sit_pant',
  },
  {
    species: 'dog',
    itemKind: 'squeaky',
    steps: ['pounce', 'grab', 'shake', 'chew'],
    allows: ['pounce', 'shake', 'flopChew'],
    endWith: 'sit_pant',
  },
  {
    species: 'cat',
    itemKind: 'ball',
    steps: ['chase', 'bat', 'bat', 'bat'],
    allows: ['stalk', 'pounce', 'bat'],
    endWith: 'purr',
  },
  {
    species: 'cat',
    itemKind: 'yarn',
    steps: ['chase', 'pounce', 'bat', 'bat'],
    allows: ['stalk', 'pounce', 'bat', 'roll', 'tangle'],
    endWith: 'purr',
  },
];

export function playRuleFor(species: 'dog' | 'cat', itemKind: string): PlayRule | null {
  return PLAY_RULES.find((rule) => rule.species === species && rule.itemKind === itemKind) ?? null;
}

export function toyAllows(species: 'dog' | 'cat', itemKind: string, behavior: PlayBehavior): boolean {
  return playRuleFor(species, itemKind)?.allows.includes(behavior) ?? false;
}
