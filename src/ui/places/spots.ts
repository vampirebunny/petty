import { scenesFor } from '../../actor';

// Where to? order. A new spot appends here. Rooms stay hidden unless this species is offered the scene.
const order = ['shop', 'school', 'park', 'livingroom', 'bedroom', 'catio', 'arcade'] as const;

export type SpotId = (typeof order)[number];

export type SpotDest = 'scene' | 'shop' | 'arcade';

export type Spot = {
  id: SpotId;
  label: string;
  dest: SpotDest;
  sceneId: string | null;
};

export function spotsFor(species: 'dog' | 'cat'): Spot[] {
  const home = new Map(
    scenesFor(species)
      .filter((scene) => scene.group === 'home')
      .map((scene) => [scene.id, scene.name]),
  );
  const spots: Spot[] = [];
  for (const id of order) {
    if (id === 'shop') {
      spots.push({ id, label: 'Pet Shop', dest: 'shop', sceneId: null });
      continue;
    }
    if (id === 'arcade') {
      spots.push({ id, label: 'Arcade', dest: 'arcade', sceneId: null });
      continue;
    }
    const label = home.get(id);
    if (label) {
      spots.push({ id, label, dest: 'scene', sceneId: id });
    }
  }
  return spots;
}
