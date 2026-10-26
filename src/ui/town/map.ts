import type { RoadSpot } from '../../sim/road';

export const mapWidth = 390;
export const mapHeight = 640;

export type Point = { x: number; y: number };

export type NodeId = RoadSpot | 'plazaA' | 'plazaB';

export type Cubic = {
  a: Point;
  c1: Point;
  c2: Point;
  b: Point;
};

export type Edge = {
  id: string;
  from: NodeId;
  to: NodeId;
  cubic: Cubic;
};

export type Building = {
  id: RoadSpot;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export const grass = {
  ground: '#C9F2D6',
  light: '#E5FAEE',
  dark: '#A6E4BC',
  pathOuter: '#E4CBA8',
  pathInner: '#FFF6E4',
  plaza: '#FFF6E4',
  water: '#9FD4F2',
  waterDeep: '#6EB8E8',
};

export const buildings: Building[] = [
  { id: 'home', name: 'Home', x: 46, y: 22, w: 104, h: 96 },
  { id: 'petShop', name: 'Pet Shop', x: 234, y: 30, w: 110, h: 100 },
  { id: 'park', name: 'Park', x: 22, y: 226, w: 140, h: 110 },
  { id: 'trainingSchool', name: 'Training School', x: 232, y: 212, w: 110, h: 108 },
  { id: 'arcade', name: 'Arcade', x: 52, y: 418, w: 104, h: 110 },
];

export const nodes: Record<NodeId, Point> = {
  home: { x: 98, y: 136 },
  petShop: { x: 289, y: 148 },
  park: { x: 118, y: 354 },
  trainingSchool: { x: 290, y: 338 },
  arcade: { x: 104, y: 560 },
  plazaA: { x: 195, y: 205 },
  plazaB: { x: 195, y: 410 },
};

function cubic(a: Point, c1: Point, c2: Point, b: Point): Cubic {
  return { a, c1, c2, b };
}

export const edges: Edge[] = [
  {
    id: 'home-plazaA',
    from: 'home',
    to: 'plazaA',
    cubic: cubic(nodes.home, { x: 120, y: 175 }, { x: 165, y: 190 }, nodes.plazaA),
  },
  {
    id: 'petShop-plazaA',
    from: 'petShop',
    to: 'plazaA',
    cubic: cubic(nodes.petShop, { x: 270, y: 180 }, { x: 230, y: 192 }, nodes.plazaA),
  },
  {
    id: 'plazaA-park',
    from: 'plazaA',
    to: 'park',
    cubic: cubic(nodes.plazaA, { x: 185, y: 260 }, { x: 145, y: 310 }, nodes.park),
  },
  {
    id: 'plazaA-trainingSchool',
    from: 'plazaA',
    to: 'trainingSchool',
    cubic: cubic(nodes.plazaA, { x: 210, y: 255 }, { x: 260, y: 300 }, nodes.trainingSchool),
  },
  {
    id: 'park-plazaB',
    from: 'park',
    to: 'plazaB',
    cubic: cubic(nodes.park, { x: 140, y: 375 }, { x: 175, y: 395 }, nodes.plazaB),
  },
  {
    id: 'trainingSchool-plazaB',
    from: 'trainingSchool',
    to: 'plazaB',
    cubic: cubic(nodes.trainingSchool, { x: 270, y: 365 }, { x: 220, y: 395 }, nodes.plazaB),
  },
  {
    id: 'plazaB-arcade',
    from: 'plazaB',
    to: 'arcade',
    cubic: cubic(nodes.plazaB, { x: 175, y: 455 }, { x: 130, y: 510 }, nodes.arcade),
  },
];

export function buildingById(id: RoadSpot): Building {
  const found = buildings.find((building) => building.id === id);
  if (!found) {
    return buildings[0];
  }
  return found;
}

export function edgeBetween(from: NodeId, to: NodeId): Edge | null {
  return edges.find((edge) => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from)) ?? null;
}
