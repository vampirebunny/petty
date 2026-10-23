import { scenesFor } from '../../actor';

// Where to? order. A new spot appends here. Rooms stay hidden unless this species is offered the scene.
const order = ['shop', 'park', 'livingroom', 'bedroom', 'catio'] as const;

export type SpotId = (typeof order)[number];

export type Spot = {
  id: SpotId;
  label: string;
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
      spots.push({ id, label: 'Pet Shop', sceneId: null });
      continue;
    }
    const label = home.get(id);
    if (label) {
      spots.push({ id, label, sceneId: id });
    }
  }
  return spots;
}
