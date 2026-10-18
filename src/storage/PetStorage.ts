import type { PetState } from '../sim/types';

export interface PetStorage {
  load(): Promise<PetState | null>;
  save(state: PetState): Promise<void>;
  clear(): Promise<void>;
}
