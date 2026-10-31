import type { RoadSpot } from '../../sim/road';

export type Point = { x: number; y: number };

/** `bend` is the switchback under The Catwalk. It is not a door. */
export type NodeId = RoadSpot | 'bend';

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
  /** Art width. The button is wider so the label can sit on one line. */
  art: number;
};

export type PlaceBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  art: number;
};

export type CloudSpec = {
  x: number;
  y: number;
  w: number;
  h: number;
  duration: number;
  opacity: number;
  /** 0–1, where the drift has already reached when the map opens. */
  phase: number;
};

export const grass = {
  page: '#F5F6FB',
  ground: '#D3F1DE',
  light: '#E3F7EA',
  dark: '#C6EBD3',
  pathOuter: '#E2CDA6',
  pathInner: '#FFF6E6',
  pathDash: '#F1E2C6',
  water: '#A9DAF7',
  waterLine: '#7CC4F5',
  ink: '#4B3B7A',
  trunk: '#C98A66',
  leaf: '#9FE3B4',
  pine: '#7FD3A0',
  bush: '#BFEFD4',
};

export type TownLayout = {
  id: 'portrait' | 'wide';
  width: number;
  height: number;
  pathOuter: number;
  pathInner: number;
  buildings: Building[];
  catwalk: PlaceBox;
  nodes: Record<NodeId, Point>;
  edges: Edge[];
  /** Painted with the road. Not walked. */
  extras: Cubic[];
  clouds: CloudSpec[];
};

const portraitNodes: Record<NodeId, Point> = {
  home: { x: 100, y: 140 },
  petShop: { x: 290, y: 194 },
  park: { x: 100, y: 304 },
  trainingSchool: { x: 290, y: 358 },
  bend: { x: 100, y: 468 },
  arcade: { x: 290, y: 522 },
  stadium: { x: 195, y: 650 },
};

const wideNodes: Record<NodeId, Point> = {
  home: { x: 180, y: 169.3 },
  petShop: { x: 460, y: 171.9 },
  park: { x: 740, y: 175.5 },
  trainingSchool: { x: 1020, y: 172 },
  bend: { x: 1020, y: 526 },
  arcade: { x: 740, y: 531.1 },
  stadium: { x: 420, y: 534 },
};

function cubic(a: Point, c1: Point, c2: Point, b: Point): Cubic {
  return { a, c1, c2, b };
}

function edge(id: string, from: NodeId, to: NodeId, c1: Point, c2: Point, nodes: Record<NodeId, Point>): Edge {
  return { id, from, to, cubic: cubic(nodes[from], c1, c2, nodes[to]) };
}

const door = (id: RoadSpot, name: string, x: number, y: number, w: number, art: number, h: number): Building => ({
  id,
  name,
  x,
  y,
  w,
  h,
  art,
});

export const portraitLayout: TownLayout = {
  id: 'portrait',
  width: 390,
  height: 724,
  pathOuter: 30,
  pathInner: 20,
  buildings: [
    door('home', 'Home', 25, 16, 150, 120, 108),
    door('petShop', 'Pet Shop', 215, 70, 150, 120, 108),
    door('park', 'Park', 25, 180, 150, 120, 108),
    door('trainingSchool', 'Training School', 215, 234, 150, 120, 108),
    door('arcade', 'Arcade', 215, 398, 150, 120, 108),
    door('stadium', 'Stadium', 105, 512, 180, 160, 150),
  ],
  catwalk: { x: 25, y: 344, w: 150, h: 108, art: 120 },
  nodes: portraitNodes,
  edges: [
    edge('home-petShop', 'home', 'petShop', { x: 190, y: 140 }, { x: 260, y: 155 }, portraitNodes),
    edge('petShop-park', 'petShop', 'park', { x: 320, y: 235 }, { x: 180, y: 280 }, portraitNodes),
    edge('park-trainingSchool', 'park', 'trainingSchool', { x: 60, y: 316 }, { x: 200, y: 330 }, portraitNodes),
    edge('trainingSchool-bend', 'trainingSchool', 'bend', { x: 320, y: 395 }, { x: 180, y: 440 }, portraitNodes),
    edge('bend-arcade', 'bend', 'arcade', { x: 60, y: 480 }, { x: 200, y: 495 }, portraitNodes),
    edge('arcade-stadium', 'arcade', 'stadium', { x: 330, y: 560 }, { x: 230, y: 620 }, portraitNodes),
  ],
  extras: [],
  clouds: [
    { x: 0, y: 150, w: 120, h: 44, duration: 60000, opacity: 0.75, phase: 0.2 },
    { x: 0, y: 470, w: 96, h: 36, duration: 75000, opacity: 0.65, phase: 0.56 },
  ],
};

export const wideLayout: TownLayout = {
  id: 'wide',
  width: 1194,
  height: 722,
  pathOuter: 32,
  pathInner: 22,
  buildings: [
    door('home', 'Home', 95, 36, 170, 140, 126),
    door('petShop', 'Pet Shop', 375, 36, 170, 140, 126),
    door('park', 'Park', 655, 36, 170, 140, 126),
    door('trainingSchool', 'Training School', 935, 36, 170, 140, 126),
    door('arcade', 'Arcade', 655, 390, 170, 140, 126),
    door('stadium', 'Stadium', 320, 362, 200, 180, 168.75),
  ],
  catwalk: { x: 935, y: 390, w: 170, h: 126, art: 140 },
  nodes: wideNodes,
  edges: [
    edge('home-petShop', 'home', 'petShop', { x: 257, y: 167.3 }, { x: 348, y: 169.6 }, wideNodes),
    edge('petShop-park', 'petShop', 'park', { x: 541.4, y: 173.6 }, { x: 633.8, y: 175.3 }, wideNodes),
    edge('park-trainingSchool', 'park', 'trainingSchool', { x: 824.2, y: 175.6 }, { x: 917.1, y: 174.7 }, wideNodes),
    edge('trainingSchool-bend', 'trainingSchool', 'bend', { x: 1170, y: 168 }, { x: 1170, y: 528 }, wideNodes),
    edge('bend-arcade', 'bend', 'arcade', { x: 943.1, y: 525 }, { x: 843.1, y: 528.2 }, wideNodes),
    edge('arcade-stadium', 'arcade', 'stadium', { x: 628.6, y: 534.3 }, { x: 513.5, y: 537.1 }, wideNodes),
  ],
  extras: [
    cubic({ x: 120, y: 172 }, { x: 139.1, y: 170.7 }, { x: 159, y: 169.9 }, wideNodes.home),
    cubic(wideNodes.stadium, { x: 300, y: 530 }, { x: 200, y: 560 }, { x: 110, y: 600 }),
  ],
  clouds: [
    { x: 0, y: 250, w: 140, h: 52, duration: 60000, opacity: 0.75, phase: 0.33 },
    { x: 0, y: 600, w: 110, h: 40, duration: 130000, opacity: 0.65, phase: 0.58 },
  ],
};

export function layoutFor(wide: boolean): TownLayout {
  return wide ? wideLayout : portraitLayout;
}

export function buildingById(layout: TownLayout, id: RoadSpot): Building {
  const found = layout.buildings.find((building) => building.id === id);
  if (!found) {
    return layout.buildings[0];
  }
  return found;
}

export function edgeBetween(graph: Edge[], from: NodeId, to: NodeId): Edge | null {
  return graph.find((item) => (item.from === from && item.to === to) || (item.from === to && item.to === from)) ?? null;
}

export function curvePath(cubic: Cubic): string {
  return `M${cubic.a.x} ${cubic.a.y} C ${cubic.c1.x} ${cubic.c1.y}, ${cubic.c2.x} ${cubic.c2.y}, ${cubic.b.x} ${cubic.b.y}`;
}

export function roadCubics(layout: TownLayout): Cubic[] {
  return [...layout.extras, ...layout.edges.map((item) => item.cubic)];
}
