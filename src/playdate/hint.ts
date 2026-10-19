import { archetypeStyleNames } from '../sim/config';
import { activityById } from './activities';
import type { PetSnapshot } from './types';

export function personalityHint(snapshot: PetSnapshot): string {
  const style = archetypeStyleNames[snapshot.currentStyle];
  const favorite = snapshot.favoriteActivities[0];
  const activity = favorite ? activityById(favorite) : null;
  return activity ? `${style} · loves ${activity.name}` : style;
}

export function localDateKey(now: number): string {
  const date = new Date(now);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
