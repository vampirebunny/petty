import { breedById } from './breeds';
import type { Actor, IdleMode } from './types';

const idleText: Record<IdleMode, string> = {
  still: 'Standing',
  pant: 'Panting',
  purr: 'Purring',
  nap: 'Napping',
  walk: 'Wandering',
  zoom: 'Zooming',
};

// One short line for what the pet is doing, as the reference demo shows it.
export function statusOf(actor: Actor): string {
  const cat = breedById(actor.breedId)?.species === 'cat';
  const { task } = actor;
  if (task.type === 'idle') {
    return `Idle, ${idleText[actor.idle.mode].toLowerCase()}`;
  }
  if (task.type === 'fetch') {
    const stages: Record<string, string> = {
      bow: 'Play bowing',
      stalk: 'Stalking the toy',
      wiggle: 'Getting ready to pounce',
      pounce: 'Pouncing',
      tumble: 'Tumbling',
      zoom: 'Zooming',
      shake: 'Shaking the toy',
      chew: 'Chewing the toy',
      roll: 'Rolling around',
      tangle: 'Tangled up',
      carry: 'Showing off the toy',
    };
    if (stages[task.stage]) {
      return stages[task.stage];
    }
    return cat || task.stage === 'chase' ? 'Chasing the toy' : 'Bringing it back';
  }
  if (task.type === 'eat') {
    const drink = task.kind === 'drink';
    if (task.stage === 'go') {
      return drink ? 'Walking to the water' : 'Walking to the bowl';
    }
    return drink ? 'Drinking' : 'Eating';
  }
  if (task.type === 'sleep') {
    return task.stage === 'go' ? 'Heading to bed' : 'Sleeping';
  }
  if (task.type === 'travel') {
    return task.stage === 'exit' ? 'Heading out' : 'Coming in';
  }
  if (task.type === 'winddown') {
    if (task.stage === 'flop') {
      return 'Flopped down';
    }
    return cat ? (task.stage === 'groom' ? 'Grooming' : 'Purring') : 'Panting';
  }
  const names: Partial<Record<typeof task.type, string>> = {
    sit: 'Sitting',
    paw: 'Giving paw',
    purr: 'Purring',
    groom: 'Grooming',
  };
  return names[task.type] ?? task.type;
}
