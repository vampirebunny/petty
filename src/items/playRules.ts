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

export type PlayRule = {
  species: 'dog' | 'cat';
  itemKind: string;
  steps: PlayStep[];
  endWith: 'sit_pant' | 'purr' | 'idle';
};

export const PLAY_RULES: PlayRule[] = [
  {
    species: 'dog',
    itemKind: 'ball',
    steps: ['chase', 'grab', 'carry', 'drop'],
    endWith: 'sit_pant',
  },
  {
    species: 'cat',
    itemKind: 'ball',
    steps: ['chase', 'bat', 'bat', 'bat'],
    endWith: 'purr',
  },
];

export function playRuleFor(species: 'dog' | 'cat', itemKind: string): PlayRule | null {
  return PLAY_RULES.find((rule) => rule.species === species && rule.itemKind === itemKind) ?? null;
}
