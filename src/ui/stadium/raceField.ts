import { breedById, defaultLook, resolveBreed, resolveBreedById, spawnActor } from '../../actor';
import type { Actor, Breed } from '../../actor';
import type { PetState } from '../../sim/types';
import type { LineupRow } from '../../stadium/api';
import { neutralModifiers, type Modifiers, type RaceClassId } from '../../../supabase/functions/_shared/race-sim/index.ts';

/** Canvas labels on the race track, such as "Reconnecting". */
export const raceLabelFont = require('@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf');
export const raceLabelSize = 12;

export function breedOf(row: LineupRow, pet: PetState): Breed {
  if (row.mine) {
    return resolveBreedById(pet.breedId, pet.look) ?? breedById('retriever')!;
  }
  const fallback = row.species === 'cat' ? 'domesticShorthair' : 'retriever';
  const found = breedById(row.breedId || fallback) ?? breedById(fallback)!;
  if (row.look) return resolveBreed(found, row.look);
  const look = row.coat ? { ...defaultLook(found), coat: row.coat } : defaultLook(found);
  return resolveBreed(found, look);
}

export function actorOf(row: LineupRow, pet: PetState, breed: Breed): Actor {
  return spawnActor({
    id: row.key,
    breedId: breed.id,
    ageDays: row.mine ? pet.ageDays : (row.ageDays ?? 16),
    weight: row.mine ? pet.weight : 0,
    vitality: row.mine ? pet.vitality : 1,
    equipped: row.mine ? { ...pet.equipped } : { ...(row.equipped ?? {}) },
    look: row.mine ? pet.look : (row.look ?? { coat: breed.coat }),
    asleep: false,
  });
}

export function modsOf(row: LineupRow | undefined, pet: PetState | null): Modifiers {
  if (row?.mine && pet) {
    return {
      energy: pet.needs.energy,
      mood: pet.needs.happiness,
      stamina: row.modifiers?.stamina ?? pet.attributes.current.stamina,
      agility: row.modifiers?.agility ?? pet.attributes.current.agility,
      intelligence: row.modifiers?.intelligence ?? pet.attributes.current.intelligence,
    };
  }
  return row?.modifiers ?? neutralModifiers;
}

export function classOf(id: string): RaceClassId {
  if (id === 'novice' || id === 'open' || id === 'expert' || id === 'championship' || id === 'veteran') return id;
  return 'beginner';
}

export function placeSuffix(place: number): string {
  if (place === 1) return 'st';
  if (place === 2) return 'nd';
  if (place === 3) return 'rd';
  return 'th';
}
