export type Needs = {
  fullness: number;
  energy: number;
  happiness: number;
};

export type PetState = {
  needs: Needs;
  asleep: boolean;
  lastUpdatedAt: number;
  rngState: number;
};

export type PetEvent = { type: 'feed' } | { type: 'toggleRest' } | { type: 'pet' };

export type Mood = 'happy' | 'content' | 'hungry' | 'sleepy' | 'sad' | 'sleeping';

export type Cue = { kind: 'none' | 'eat' | 'wiggle' | 'purr' | 'stir' | 'yawn' };
