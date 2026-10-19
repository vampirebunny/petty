import { breedById } from './breeds';
import type { Actor, TaskType } from './types';

export const userTasks = [
  'idle',
  'sit',
  'paw',
  'speak',
  'eat',
  'drink',
  'refuse',
  'sleep',
  'wake',
  'react',
  'fetch',
  'cuddle',
] as const;

export type UserTask = (typeof userTasks)[number];

export function isUserTask(value: string): value is UserTask {
  return (userTasks as readonly string[]).includes(value);
}

export function reactionFor(breedId: string, roll: number): TaskType | null {
  const breed = breedById(breedId);
  if (!breed) {
    return null;
  }
  if (breed.species === 'dog') {
    return roll >= 0.5 ? 'bark' : 'paw';
  }
  if (breed.species === 'cat') {
    return roll >= 0.5 ? 'purr' : 'groom';
  }
  return null;
}

export function canBehave(actor: Actor, task: TaskType): boolean {
  const breed = breedById(actor.breedId);
  return breed != null && breed.behaviors.includes(task);
}
