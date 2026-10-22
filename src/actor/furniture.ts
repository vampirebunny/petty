import { footprint } from '../ui/skia/layout';
import type { Poi, Prop, Scene } from './scenes';
import { sceneById, scenes } from './scenes';
import type { Vec } from './types';

// Owned, movable pieces. Everything else in a room is scenery.
export const furnitureKinds = ['bowl', 'bed', 'litterbox', 'catTree', 'planter', 'catioPost'] as const;

export type FurnitureKind = (typeof furnitureKinds)[number];

export type FurniturePiece = {
  id: string;
  kind: FurnitureKind;
  contents?: string;
  color?: string;
  w?: number;
  h?: number;
  plant?: 'catgrass' | 'flowers' | 'catnip';
  scale?: number;
  layer?: 'back' | 'sorted' | 'front';
};

export type FurniturePlacement = {
  pieceId: string;
  sceneId: string;
  x: number;
  y: number;
};

// Half-depth of the floor ellipse. Matches the band a hurdle uses.
export const furnitureDepth = 28;

const skirt = 1.18;

export type Obstacle = {
  id: string;
  x: number;
  y: number;
  hw: number;
  hd: number;
};

type Floor = { xMin: number; xMax: number; yMin: number; yMax: number };

export function isFurnitureKind(kind: string): kind is FurnitureKind {
  return (furnitureKinds as readonly string[]).includes(kind);
}

function pieceFromProp(prop: Prop): FurniturePiece | null {
  if (!prop.id || !isFurnitureKind(prop.kind)) {
    return null;
  }
  const piece: FurniturePiece = { id: prop.id, kind: prop.kind };
  if (prop.contents) {
    piece.contents = prop.contents;
  }
  if (prop.color) {
    piece.color = prop.color;
  }
  if (prop.w != null) {
    piece.w = prop.w;
  }
  if (prop.h != null) {
    piece.h = prop.h;
  }
  if (prop.plant) {
    piece.plant = prop.plant;
  }
  if (prop.scale != null) {
    piece.scale = prop.scale;
  }
  if (prop.layer) {
    piece.layer = prop.layer;
  }
  return piece;
}

function propFromPiece(piece: FurniturePiece, x: number, y: number): Prop {
  const prop: Prop = { kind: piece.kind, id: piece.id, x, y };
  if (piece.contents) {
    prop.contents = piece.contents;
  }
  if (piece.color) {
    prop.color = piece.color;
  }
  if (piece.w != null) {
    prop.w = piece.w;
  }
  if (piece.h != null) {
    prop.h = piece.h;
  }
  if (piece.plant) {
    prop.plant = piece.plant;
  }
  if (piece.scale != null) {
    prop.scale = piece.scale;
  }
  if (piece.layer) {
    prop.layer = piece.layer;
  }
  return prop;
}

function poiForPiece(piece: FurniturePiece, x: number, y: number): Poi | null {
  if (piece.kind === 'bowl' && piece.contents === 'kibble') {
    return { id: piece.id, type: 'food', x, y, face: 1, propId: piece.id };
  }
  if (piece.kind === 'bowl') {
    return { id: piece.id, type: 'water', x, y, face: 1, propId: piece.id };
  }
  if (piece.kind === 'bed') {
    return { id: piece.id, type: 'bed', x, y: y + 2, propId: piece.id };
  }
  if (piece.kind === 'litterbox') {
    return { id: piece.id, type: 'litter', x, y, face: -1, propId: piece.id };
  }
  return null;
}

const starterCache = new Map<'dog' | 'cat', { pieces: FurniturePiece[]; placed: FurniturePlacement[] }>();

// One owned piece per furniture prop already in the rooms, sitting where the scene drew it.
export function starterFurniture(species: 'dog' | 'cat'): { pieces: FurniturePiece[]; placed: FurniturePlacement[] } {
  const cached = starterCache.get(species);
  if (cached) {
    return cached;
  }
  const pieces: FurniturePiece[] = [];
  const placed: FurniturePlacement[] = [];
  for (const scene of [scenes.livingroom, scenes.bedroom, scenes.catio]) {
    if (scene.species && scene.species !== species) {
      continue;
    }
    for (const prop of scene.props) {
      if (species === 'dog' && prop.kind === 'litterbox') {
        continue;
      }
      const piece = pieceFromProp(prop);
      if (!piece) {
        continue;
      }
      pieces.push(piece);
      placed.push({ pieceId: piece.id, sceneId: scene.id, x: prop.x, y: prop.y });
    }
  }
  const starter = { pieces, placed };
  starterCache.set(species, starter);
  return starter;
}

function isPiece(value: unknown): value is FurniturePiece {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const piece = value as FurniturePiece;
  return typeof piece.id === 'string' && isFurnitureKind(piece.kind);
}

function isPlacement(value: unknown): value is FurniturePlacement {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const place = value as FurniturePlacement;
  return typeof place.pieceId === 'string' && typeof place.sceneId === 'string' && typeof place.x === 'number' && typeof place.y === 'number';
}

function readPieces(value: unknown): FurniturePiece[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  if (value.every(isPiece)) {
    return value;
  }
  return value.filter(isPiece);
}

function readPlaced(value: unknown): FurniturePlacement[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  if (value.every(isPlacement)) {
    return value;
  }
  return value.filter(isPlacement);
}

// Bowls that used to live in the bedroom. Saved pets still own them until load drops them.
const retiredPieceIds = new Set(['bedroom-food', 'bedroom-water']);

function dropRetired(pieces: FurniturePiece[], placed: FurniturePlacement[]): { furniture: FurniturePiece[]; placed: FurniturePlacement[] } {
  return {
    furniture: pieces.filter((piece) => !retiredPieceIds.has(piece.id)),
    placed: placed.filter((place) => !retiredPieceIds.has(place.pieceId)),
  };
}

// Missing fields load the starter set. A saved list is kept, including an empty one.
export function normalizeFurniture(
  species: 'dog' | 'cat',
  furniture: unknown,
  placed: unknown,
): { furniture: FurniturePiece[]; placed: FurniturePlacement[] } {
  const starter = starterFurniture(species);
  const pieces = readPieces(furniture);
  const spots = readPlaced(placed);
  if (pieces && spots) {
    return dropRetired(pieces, spots);
  }
  const owned = pieces ?? starter.pieces.map((piece) => ({ ...piece }));
  const where =
    spots ??
    starter.placed
      .filter((place) => owned.some((piece) => piece.id === place.pieceId))
      .map((place) => ({ ...place }));
  return dropRetired(owned, where);
}

// A new scene: scenery copied through, furniture drawn only where this home placed it.
// Does not mutate the shared presets. An owned piece with no placement in this layout is not drawn.
export function applyFurniture(scene: Scene, pieces: FurniturePiece[], placed: FurniturePlacement[]): Scene {
  const owned = new Map(pieces.map((piece) => [piece.id, piece]));
  const here = new Map(
    placed.filter((place) => place.sceneId === scene.id).map((place) => [place.pieceId, place]),
  );
  const props: Prop[] = [];
  const shift = new Map<string, { dx: number; dy: number }>();

  for (const prop of scene.props) {
    if (!prop.id || !isFurnitureKind(prop.kind)) {
      props.push(prop);
      continue;
    }
    const place = here.get(prop.id);
    if (!place || !owned.has(prop.id)) {
      continue;
    }
    const x = place.x;
    const y = place.y;
    props.push({ ...prop, x, y });
    shift.set(prop.id, { dx: x - prop.x, dy: y - prop.y });
    here.delete(prop.id);
  }

  const added: string[] = [];
  for (const [id, place] of here) {
    const piece = owned.get(id);
    if (!piece) {
      continue;
    }
    props.push(propFromPiece(piece, place.x, place.y));
    added.push(id);
  }

  const pois: Poi[] = [];
  for (const poi of scene.pois) {
    if (poi.propId && !props.some((prop) => prop.id === poi.propId)) {
      continue;
    }
    const delta = poi.propId ? shift.get(poi.propId) : undefined;
    pois.push(delta ? { ...poi, x: poi.x + delta.dx, y: poi.y + delta.dy } : { ...poi });
  }
  for (const id of added) {
    const piece = owned.get(id);
    const prop = props.find((item) => item.id === id);
    if (!piece || !prop) {
      continue;
    }
    const poi = poiForPiece(piece, prop.x, prop.y);
    if (poi && !pois.some((item) => item.propId === id)) {
      pois.push(poi);
    }
  }

  return { ...scene, props, pois };
}

// One placement per piece inside a single species home. Unknown pieces are ignored.
export function placePiece(
  placed: FurniturePlacement[],
  pieceId: string,
  sceneId: string,
  x: number,
  y: number,
  owned: readonly string[],
): FurniturePlacement[] | null {
  if (!owned.includes(pieceId)) {
    return null;
  }
  const floor = sceneById(sceneId).floor;
  const nextX = Math.min(floor.xMax, Math.max(floor.xMin, x));
  const nextY = Math.min(floor.yMax, Math.max(floor.yMin, y));
  return [
    ...placed.filter((place) => place.pieceId !== pieceId),
    { pieceId, sceneId, x: nextX, y: nextY },
  ];
}

// Copy placed positions onto the live scene without replacing it, so the pet is not sent home.
export function syncFurniture(live: Scene, next: Scene): void {
  const incoming = new Map(next.props.filter((prop) => prop.id).map((prop) => [prop.id as string, prop]));
  for (const prop of live.props) {
    if (!prop.id) {
      continue;
    }
    const updated = incoming.get(prop.id);
    if (!updated) {
      continue;
    }
    prop.x = updated.x;
    prop.y = updated.y;
    incoming.delete(prop.id);
  }
  for (const prop of incoming.values()) {
    if (isFurnitureKind(prop.kind)) {
      live.props.push({ ...prop });
    }
  }
  for (const poi of next.pois) {
    const found = live.pois.find((item) => item.id === poi.id);
    if (found) {
      found.x = poi.x;
      found.y = poi.y;
      found.propId = poi.propId;
    } else {
      live.pois.push({ ...poi });
    }
  }
}

function clampToFloor(point: Vec, floor: Floor): Vec {
  return {
    x: Math.min(floor.xMax, Math.max(floor.xMin, point.x)),
    y: Math.min(floor.yMax, Math.max(floor.yMin, point.y)),
  };
}

// Move a piece on the live scene and slide its point of interest by the same amount.
export function movePiece(scene: Scene, pieceId: string, x: number, y: number): { sceneId: string; x: number; y: number } | null {
  const prop = scene.props.find((item) => item.id === pieceId);
  if (!prop || !isFurnitureKind(prop.kind)) {
    return null;
  }
  const next = clampToFloor({ x, y }, scene.floor);
  const dx = next.x - prop.x;
  const dy = next.y - prop.y;
  prop.x = next.x;
  prop.y = next.y;
  for (const poi of scene.pois) {
    if (poi.propId === pieceId) {
      poi.x += dx;
      poi.y += dy;
    }
  }
  return { sceneId: scene.id, x: next.x, y: next.y };
}

function ellipseOf(prop: Prop): Obstacle | null {
  if (!prop.id || !isFurnitureKind(prop.kind)) {
    return null;
  }
  return { id: prop.id, x: prop.x, y: prop.y, hw: Math.max(1, footprint(prop)), hd: furnitureDepth };
}

export function obstaclesIn(scene: Scene, openPropId: string | null): Obstacle[] {
  const list: Obstacle[] = [];
  for (const prop of scene.props) {
    const obstacle = ellipseOf(prop);
    if (obstacle && obstacle.id !== openPropId) {
      list.push(obstacle);
    }
  }
  return list;
}

function contains(obstacle: Obstacle, point: Vec): boolean {
  const nx = (point.x - obstacle.x) / obstacle.hw;
  const ny = (point.y - obstacle.y) / obstacle.hd;
  return nx * nx + ny * ny <= 1;
}

// Smallest t in (0, 1) where the segment enters the ellipse, or a stand-in when the goal is inside.
function firstHitT(from: Vec, goal: Vec, obstacle: Obstacle): number | null {
  const ax = (from.x - obstacle.x) / obstacle.hw;
  const ay = (from.y - obstacle.y) / obstacle.hd;
  const bx = (goal.x - obstacle.x) / obstacle.hw;
  const by = (goal.y - obstacle.y) / obstacle.hd;
  const dx = bx - ax;
  const dy = by - ay;
  const a = dx * dx + dy * dy;
  const b = 2 * (ax * dx + ay * dy);
  const c = ax * ax + ay * ay - 1;
  if (a < 1e-8) {
    return c < 0 ? 0 : null;
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) {
    return null;
  }
  const root = Math.sqrt(disc);
  const t1 = (-b - root) / (2 * a);
  const t2 = (-b + root) / (2 * a);
  for (const t of [t1, t2]) {
    if (t > 0.001 && t < 0.999) {
      return t;
    }
  }
  if (bx * bx + by * by < 1) {
    return 0.5;
  }
  return null;
}

function outsidePoint(obstacle: Obstacle, vx: number, vy: number): Vec {
  const len = Math.hypot(vx, vy);
  const ux = len < 1e-4 ? 1 : vx / len;
  const uy = len < 1e-4 ? 0 : vy / len;
  return {
    x: obstacle.x + ux * obstacle.hw * skirt,
    y: obstacle.y + uy * obstacle.hd * skirt,
  };
}

function sidePoint(obstacle: Obstacle, from: Vec, goal: Vec): Vec {
  const dx = goal.x - from.x;
  const dy = goal.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const left = outsidePoint(obstacle, -dy / len, dx / len);
  const right = outsidePoint(obstacle, dy / len, -dx / len);
  const leftDist = Math.hypot(left.x - goal.x, left.y - goal.y);
  const rightDist = Math.hypot(right.x - goal.x, right.y - goal.y);
  return leftDist <= rightDist ? left : right;
}

// The point to walk toward. The goal itself when the way is clear.
export function steerAim(from: Vec, goal: Vec, obstacles: Obstacle[], floor: Floor): Vec {
  let blocked: Obstacle | null = null;
  let depth = Infinity;
  for (const obstacle of obstacles) {
    const nx = (from.x - obstacle.x) / obstacle.hw;
    const ny = (from.y - obstacle.y) / obstacle.hd;
    const distance = nx * nx + ny * ny;
    if (distance < 1 && distance < depth) {
      depth = distance;
      blocked = obstacle;
    }
  }
  if (blocked) {
    // Step out toward the goal, not only straight away from the middle. A straight-out step
    // beside a wall points off the floor, and the pet stays inside and never reaches the bowl.
    const gx = goal.x - from.x;
    const gy = goal.y - from.y;
    const rx = (from.x - blocked.x) / blocked.hw;
    const ry = (from.y - blocked.y) / blocked.hd;
    const rlen = Math.hypot(rx, ry);
    let vx = gx;
    let vy = gy;
    if (rlen > 0.15) {
      const tx = -ry / rlen;
      const ty = rx / rlen;
      const sign = tx * gx + ty * gy >= 0 ? 1 : -1;
      vx = rx / rlen + sign * tx;
      vy = ry / rlen + sign * ty;
    }
    return clampToFloor(outsidePoint(blocked, vx, vy), floor);
  }

  let nearest: Obstacle | null = null;
  let nearestT = Infinity;
  for (const obstacle of obstacles) {
    const t = firstHitT(from, goal, obstacle);
    if (t != null && t < nearestT) {
      nearestT = t;
      nearest = obstacle;
    }
  }
  if (!nearest) {
    return goal;
  }
  return clampToFloor(sidePoint(nearest, from, goal), floor);
}

// The front-most furniture ellipse under a stage point. Scenery returns null.
export function furnitureAt(scene: Scene, x: number, y: number): string | null {
  let best: { id: string; y: number } | null = null;
  const point = { x, y };
  for (const prop of scene.props) {
    const obstacle = ellipseOf(prop);
    if (!obstacle || !contains(obstacle, point)) {
      continue;
    }
    if (!best || prop.y >= best.y) {
      best = { id: obstacle.id, y: prop.y };
    }
  }
  return best?.id ?? null;
}
