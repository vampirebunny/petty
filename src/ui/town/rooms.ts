import { ownedScenes } from '../../actor';

export type HomeRoom = {
  id: 'livingroom' | 'bedroom' | 'catio';
  name: string;
};

const order: HomeRoom['id'][] = ['livingroom', 'bedroom', 'catio'];

export function homeRooms(species: 'dog' | 'cat'): HomeRoom[] {
  const owned = new Map(ownedScenes(species).map((scene) => [scene.id, scene.name]));
  const rooms: HomeRoom[] = [];
  for (const id of order) {
    const name = owned.get(id);
    if (name) {
      rooms.push({ id, name });
    }
  }
  return rooms;
}
