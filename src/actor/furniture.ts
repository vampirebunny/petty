import { footprint } from '../ui/skia/layout';
import type { Poi, Prop, Scene } from './scenes';
import { sceneById, scenes } from './scenes';
import type { Vec } from './types';

// Owned, movable pieces. Everything else in a room is scenery.
export const furnitureKinds = ['bowl', 'bed', 'litterbox', 'catTree', 'planter', 'catioPost', 'dogHouse', 'scratcher'] as const;

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

export const shopFurniture = {
  dogHouse: {
    scenes: ['livingroom', 'bedroom'] as const,
    spot: {
      livingroom: { x: 150, y: 520 },
      bedroom: { x: 180, y: 460 },
    },
  },
  catTree: {
    scenes: ['catio', 'livingroom', 'bedroom'] as const,
    spot: {
      catio: { x: 500, y: 400 },
      livingroom: { x: 480, y: 420 },
      bedroom: { x: 420, y: 380 },
    },
  },
  scratcher: {
    scenes: ['catio', 'livingroom', 'bedroom'] as const,
    spot: {
      catio: { x: 38, y: 530 },
      livingroom: { x: 150, y: 500 },
      bedroom: { x: 160, y: 440 },
    },
  },
} as const;

export type ShopFurnitureId = keyof typeof shopFurniture;

export function furnitureDefinition(id: string): FurniturePiece | null {
  for (const scene of Object.values(scenes)) {
    for (const prop of scene.props) {
      if (prop.id === id) {
        return pieceFromProp(prop);
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(shopFurniture, id)) {
    const kind = id as ShopFurnitureId;
    return kind === 'scratcher' ? { id: kind, kind, h: 74 } : { id: kind, kind };
  }
  return null;
}

// First purchase lands in the scene the player is in when that scene is theirs, otherwise the living room.
export function shopFurnitureSpot(kind: ShopFurnitureId, sceneId: string): { sceneId: string; x: number; y: number } {
  const spec = shopFurniture[kind];
  const requested = sceneById(sceneId);
  const targetId = requested.playerOwned ? requested.id : 'livingroom';
  const spots = spec.spot as Record<string, { x: number; y: number }>;
  const recorded = spots[targetId];
  if (recorded) {
    return { sceneId: targetId, x: recorded.x, y: recorded.y };
  }
  const floor = sceneById(targetId).floor;
  return {
    sceneId: targetId,
    x: (floor.xMin + floor.xMax) / 2,
    y: (floor.yMin + floor.yMax) / 2,
  };
}

export type BowlUse = 'food' | 'water';

export function bowlUse(piece: FurniturePiece): BowlUse | null {
  if (piece.kind !== 'bowl') {
    return null;
  }
  return piece.contents === 'water' ? 'water' : 'food';
}

// A room keeps one food bowl and one water bowl. The piece already in that room does not count.
export function bowlAlreadyInRoom(
  pieces: readonly FurniturePiece[],
  placed: readonly FurniturePlacement[],
  sceneId: string,
  pieceId: string,
): BowlUse | null {
  const piece = pieces.find((item) => item.id === pieceId);
  const use = piece ? bowlUse(piece) : null;
  if (!use) {
    return null;
  }
  const taken = placed.some((place) => {
    if (place.sceneId !== sceneId || place.pieceId === pieceId) {
      return false;
    }
    const other = pieces.find((item) => item.id === place.pieceId);
    return other != null && bowlUse(other) === use;
  });
  return taken ? use : null;
}

export function bowlRoomMessage(use: BowlUse): string {
  return `There's already a ${use} bowl in this room.`;
}

export function pieceLabel(piece: FurniturePiece): string {
  if (piece.kind === 'bowl') {
    return piece.contents === 'water' ? 'Water bowl' : 'Food bowl';
  }
  if (piece.kind === 'bed') {
    return 'Bed';
  }
  if (piece.kind === 'catTree') {
    return 'Cat tree';
  }
  if (piece.kind === 'dogHouse') {
    return 'Dog house';
  }
  if (piece.kind === 'scratcher') {
    return 'Scratcher';
  }
  if (piece.kind === 'planter') {
    return 'Planter';
  }
  if (piece.kind === 'catioPost') {
    return 'Post';
  }
  return piece.id;
}

// Bowls and the bed ask before they leave. Other pieces do not. The name is the pet's.
export function stowWarning(piece: FurniturePiece, name: string): string | null {
  if (piece.kind === 'bowl' && piece.contents === 'water') {
    return `${name} won't be able to drink here.`;
  }
  if (piece.kind === 'bowl') {
    return `${name} won't be able to eat here.`;
  }
  if (piece.kind === 'bed') {
    return `${name} won't have a bed to nap on here.`;
  }
  return null;
}

export function stowPiece(placed: FurniturePlacement[], pieceId: string): FurniturePlacement[] {
  return placed.filter((place) => place.pieceId !== pieceId);
}

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
      if (prop.kind === 'litterbox') {
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

export function grantPieces(
  species: 'dog' | 'cat',
  which: 'shared' | 'species',
): { pieces: FurniturePiece[]; placed: FurniturePlacement[] } {
  const pack = starterFurniture(species);
  const pieces: FurniturePiece[] = [];
  const placed: FurniturePlacement[] = [];
  for (const piece of pack.pieces) {
    const place = pack.placed.find((row) => row.pieceId === piece.id);
    const scene = place ? sceneById(place.sceneId) : undefined;
    const speciesOnly = Boolean(scene?.species);
    if (which === 'species' ? !speciesOnly : speciesOnly) {
      continue;
    }
    pieces.push(piece);
    if (place) {
      placed.push(place);
    }
  }
  return { pieces, placed };
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

// Pieces removed from the rooms. Saved homes still list them until load drops them.
const retiredPieceIds = new Set(['bedroom-food', 'bedroom-water', 'livingroom-litter', 'bedroom-litter']);

export function isRetiredPiece(id: string): boolean {
  return retiredPieceIds.has(id);
}

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
    if (prop.kind === 'litterbox') {
      continue;
    }
    if (!prop.id || !isFurnitureKind(prop.kind)) {
      props.push(prop);
      continue;
    }
    const place = here.get(prop.id);
    if (!place || !owned.has(prop.id) || retiredPieceIds.has(prop.id)) {
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
    if (!piece || piece.kind === 'litterbox' || retiredPieceIds.has(id)) {
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
    if (poi.type === 'litter') {
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
  if (!sceneById(sceneId).playerOwned) {
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
// Furniture the layout no longer has is removed. Scenery stays. Returns the ids that left.
export function syncFurniture(live: Scene, next: Scene): string[] {
  const incoming = new Map(next.props.filter((prop) => prop.id).map((prop) => [prop.id as string, prop]));
  const removed: string[] = [];
  const kept: Prop[] = [];
  for (const prop of live.props) {
    if (!prop.id || !isFurnitureKind(prop.kind)) {
      kept.push(prop);
      if (prop.id) {
        incoming.delete(prop.id);
      }
      continue;
    }
    const updated = incoming.get(prop.id);
    if (!updated) {
      removed.push(prop.id);
      continue;
    }
    prop.x = updated.x;
    prop.y = updated.y;
    kept.push(prop);
    incoming.delete(prop.id);
  }
  for (const prop of incoming.values()) {
    if (isFurnitureKind(prop.kind)) {
      kept.push({ ...prop });
    }
  }
  live.props = kept;
  live.pois = live.pois.filter((poi) => !poi.propId || live.props.some((prop) => prop.id === poi.propId));
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
  return removed;
}

// Puts an owned piece on the live scene so it can be dragged before the layout round-trip.
export function showPiece(scene: Scene, piece: FurniturePiece, x: number, y: number): { x: number; y: number } | null {
  if (!scene.playerOwned) {
    return null;
  }
  const point = clampToFloor({ x, y }, scene.floor);
  const existing = scene.props.find((prop) => prop.id === piece.id);
  if (existing) {
    existing.x = point.x;
    existing.y = point.y;
  } else {
    scene.props.push(propFromPiece(piece, point.x, point.y));
  }
  const poi = poiForPiece(piece, point.x, point.y);
  if (poi) {
    const found = scene.pois.find((item) => item.propId === piece.id);
    if (found) {
      found.x = poi.x;
      found.y = poi.y;
    } else {
      scene.pois.push(poi);
    }
  }
  return point;
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
  if (!scene.playerOwned) {
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

// The bowl sprite sits above its floor point. A tap on the rim should still count.
function tapEllipse(prop: Prop): Obstacle | null {
  const obstacle = ellipseOf(prop);
  if (!obstacle || prop.kind !== 'bowl') {
    return obstacle;
  }
  return { ...obstacle, y: prop.y - 12, hw: Math.max(obstacle.hw, 40), hd: 36 };
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

function standingPoint(obstacle: Obstacle, vx: number, vy: number, bounds: Floor): Vec | null {
  if (Math.hypot(vx, vy) < 1e-4) {
    return null;
  }
  const point = clampToFloor(outsidePoint(obstacle, vx, vy), bounds);
  return contains(obstacle, point) ? null : point;
}

// A way around the obstacle that stays on the floor the pet can actually stand on.
// A side that clamps back into the ellipse is dropped, and a near-tie keeps the
// side closer to the pet so the choice does not flip every step.
function sidePoint(obstacle: Obstacle, from: Vec, goal: Vec, bounds: Floor): Vec {
  const dx = goal.x - from.x;
  const dy = goal.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const options = [
    standingPoint(obstacle, -dy / len, dx / len, bounds),
    standingPoint(obstacle, dy / len, -dx / len, bounds),
  ].filter((point): point is Vec => point != null);
  if (options.length === 0) {
    return clampToFloor(goal, bounds);
  }
  options.sort((a, b) => {
    const goalA = Math.hypot(a.x - goal.x, a.y - goal.y);
    const goalB = Math.hypot(b.x - goal.x, b.y - goal.y);
    if (Math.abs(goalA - goalB) > 12) {
      return goalA - goalB;
    }
    return Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y);
  });
  return options[0];
}

// Leave an obstacle the pet is already standing in. The tangent toward the goal is
// skipped when that goal sits nearly along the radius: the sign chatters and the pet spins.
// Any exit the floor clamp pushes back inside the ellipse is skipped for the next one.
function escapePoint(obstacle: Obstacle, from: Vec, goal: Vec, bounds: Floor): Vec {
  const gx = goal.x - from.x;
  const gy = goal.y - from.y;
  const rx = (from.x - obstacle.x) / obstacle.hw;
  const ry = (from.y - obstacle.y) / obstacle.hd;
  const rlen = Math.hypot(rx, ry);
  const dirs: Vec[] = [];
  if (rlen > 0.05) {
    const ox = rx / rlen;
    const oy = ry / rlen;
    const tx = -oy;
    const ty = ox;
    const glen = Math.hypot(gx, gy);
    const along = glen < 1 ? 0 : (tx * gx + ty * gy) / glen;
    if (along > 0.25) {
      dirs.push({ x: ox + tx, y: oy + ty });
    } else if (along < -0.25) {
      dirs.push({ x: ox - tx, y: oy - ty });
    }
    dirs.push({ x: ox, y: oy }, { x: tx, y: ty }, { x: -tx, y: -ty });
  }
  dirs.push({ x: gx, y: gy }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 });
  for (const dir of dirs) {
    const point = standingPoint(obstacle, dir.x, dir.y, bounds);
    if (point) {
      return point;
    }
  }
  return clampToFloor(goal, bounds);
}

// A goal the floor clamp leaves inside an obstacle can never be reached, and steering
// around it makes the pet orbit. Slide that goal out to a point the pet can stand on.
function pullGoalOut(goal: Vec, obstacles: Obstacle[], bounds: Floor): Vec {
  let next = clampToFloor(goal, bounds);
  for (let step = 0; step < 4; step += 1) {
    const obstacle = obstacles.find((item) => contains(item, next));
    if (!obstacle) {
      return next;
    }
    const outside = escapePoint(obstacle, next, goal, bounds);
    if (contains(obstacle, outside)) {
      return next;
    }
    next = outside;
  }
  return next;
}

// The point to walk toward. The goal itself when the way is clear.
export function steerAim(from: Vec, goal: Vec, obstacles: Obstacle[], floor: Floor): Vec {
  const clear = pullGoalOut(goal, obstacles, floor);
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
    return escapePoint(blocked, from, clear, floor);
  }

  let nearest: Obstacle | null = null;
  let nearestT = Infinity;
  for (const obstacle of obstacles) {
    const t = firstHitT(from, clear, obstacle);
    if (t != null && t < nearestT) {
      nearestT = t;
      nearest = obstacle;
    }
  }
  if (!nearest) {
    return clear;
  }
  return sidePoint(nearest, from, clear, floor);
}

// The front-most furniture ellipse under a stage point. Scenery returns null.
export function furnitureAt(scene: Scene, x: number, y: number): string | null {
  let best: { id: string; y: number } | null = null;
  const point = { x, y };
  for (const prop of scene.props) {
    const obstacle = tapEllipse(prop);
    if (!obstacle || !contains(obstacle, point)) {
      continue;
    }
    if (!best || prop.y >= best.y) {
      best = { id: obstacle.id, y: prop.y };
    }
  }
  return best?.id ?? null;
}
