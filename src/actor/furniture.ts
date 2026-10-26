import { daysToSenior } from '../sim/config';
import { footprint } from '../ui/skia/layout';
import { catBreeds } from './breeds';
import { HOUSE_POINTS, HOUSE_REST, HOUSE_WIDTH, houseBlocks, houseContains, houseWorld, placeHouse } from './conservatory';
import { geomOf, PET_SIZE } from './geometry';
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
  catalogId?: string;
  bedStyle?: 'standard' | 'cloud' | 'bone' | 'cave' | 'moon';
  restMultiplier?: number;
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
      livingroom: { x: 320, y: 530 },
      bedroom: { x: 320, y: 520 },
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

export type BedStyle = 'standard' | 'cloud' | 'bone' | 'cave' | 'moon';

// World width of a dog shop bed. 280 SVG units of bed art map onto this width.
export const styledBedWidth = 120;

// Kitty-cave mouth in the 280-unit bed drawing. The stroke sits on the oval, so the
// hole a cat can lie in is one stroke narrower than the oval.
export const caveDoorRx = 90;
export const caveDoorRy = 44;
export const caveDoorStroke = 10;

// Moon cradle basket, the path from x = 58 to x = 222 in the 280-unit bed drawing.
export const moonCradleSvgWidth = 164;

const bedArtWidth = 280;

function catBedFitSvg(style: 'cave' | 'moon'): number {
  if (style === 'cave') {
    return caveDoorRx * 2 - caveDoorStroke;
  }
  return moonCradleSvgWidth;
}

// Widest adult cat torso, in world pixels. Growth through the adult stage ends at
// daysToSenior, and depth 1 is a cat standing at the front of the room.
export function adultCatBodyWidth(): number {
  let widest = 0;
  for (const breed of catBreeds()) {
    const geom = geomOf(breed, daysToSenior, 0, 1);
    widest = Math.max(widest, geom.bodyLen * PET_SIZE * geom.sc);
  }
  return widest;
}

// World width of a premium cat bed so the part the cat lies in is at least one adult body wide.
export function catBedWidth(style: 'cave' | 'moon'): number {
  return (adultCatBodyWidth() * bedArtWidth) / catBedFitSvg(style);
}

function shopBedWidth(bed: { style: BedStyle; species?: 'dog' | 'cat' }): number {
  if (bed.species === 'cat' && (bed.style === 'cave' || bed.style === 'moon')) {
    return catBedWidth(bed.style);
  }
  return bed.style === 'standard' ? 112 : styledBedWidth;
}

function resolvedBedWidth(piece: FurniturePiece): number | undefined {
  const sku = shopSku(piece);
  const bed = sku ? bedCatalog[sku] : undefined;
  const style = piece.bedStyle ?? bed?.style;
  if (bed?.species === 'cat' && (style === 'cave' || style === 'moon')) {
    return Math.max(piece.w ?? 0, catBedWidth(style));
  }
  if (piece.w != null) {
    return piece.w;
  }
  if (style === 'standard') {
    return 112;
  }
  if (style) {
    return styledBedWidth;
  }
  return undefined;
}

const bedCatalog: Record<string, { name: string; style: BedStyle; rest: number; species?: 'dog' | 'cat' }> = {
  bed_standard: { name: 'Standard Bed', style: 'standard', rest: 1 },
  bed_cloud_puff: { name: 'Cloud Puff Bolster', style: 'cloud', rest: 2, species: 'dog' },
  bed_bone_sofa: { name: 'Bone Pillow Sofa', style: 'bone', rest: 2.5, species: 'dog' },
  bed_kitty_cave: { name: 'Kitty Cave Pod', style: 'cave', rest: 2, species: 'cat' },
  bed_moon_cradle: { name: 'Moon Cradle', style: 'moon', rest: 2.5, species: 'cat' },
};

const bowlSpots: Record<string, Record<string, { x: number; y: number }>> = {
  bowl_food: {
    livingroom: { x: 540, y: 330 },
    bedroom: { x: 180, y: 500 },
    catio: { x: 400, y: 500 },
  },
  bowl_water: {
    livingroom: { x: 500, y: 560 },
    bedroom: { x: 240, y: 520 },
    catio: { x: 400, y: 540 },
  },
};

export function bedSkuOf(id: string): string | null {
  const sku = id.split(':')[0] ?? id;
  return bedCatalog[sku] ? sku : null;
}

export function shopSku(piece: FurniturePiece): string | null {
  if (piece.catalogId) {
    return piece.catalogId;
  }
  if (piece.kind === 'bowl') {
    return piece.contents === 'water' ? 'bowl_water' : 'bowl_food';
  }
  if (piece.kind === 'bed') {
    return bedSkuOf(piece.id) ?? 'bed_standard';
  }
  if (piece.kind === 'dogHouse' || piece.kind === 'catTree' || piece.kind === 'scratcher') {
    return piece.kind;
  }
  return null;
}

export function skuCap(sku: string): number {
  if (sku === 'bowl_food' || sku === 'bowl_water' || sku === 'bed_standard') {
    return 3;
  }
  return 1;
}

export function skuCount(pieces: readonly FurniturePiece[], sku: string): number {
  return pieces.filter((piece) => shopSku(piece) === sku).length;
}

// Shop cards hide a sku once the player owns its cap. Piece ids stay out of this set.
export function stockedSkus(pieces: readonly FurniturePiece[]): Set<string> {
  const counts = new Map<string, number>();
  for (const piece of pieces) {
    const sku = shopSku(piece);
    if (!sku) {
      continue;
    }
    counts.set(sku, (counts.get(sku) ?? 0) + 1);
  }
  const stocked = new Set<string>();
  for (const [sku, count] of counts) {
    if (count >= skuCap(sku)) {
      stocked.add(sku);
    }
  }
  return stocked;
}

export function nextFurnitureId(sku: string, pieces: readonly FurniturePiece[]): string {
  if (skuCap(sku) === 1) {
    return sku;
  }
  const taken = new Set(pieces.map((piece) => piece.id));
  let n = 1;
  while (taken.has(`${sku}:${n}`)) {
    n += 1;
  }
  return `${sku}:${n}`;
}

export function isBedSku(sku: string): boolean {
  return bedSkuOf(sku) != null;
}

const bedAnchors: Record<BedStyle, { x: number; y: number } | null> = {
  standard: null,
  cloud: { x: 140, y: 128 },
  bone: { x: 140, y: 118 },
  cave: { x: 140, y: 150 },
  moon: { x: 140, y: 124 },
};

// Visible art in the 280-unit bed drawing. y grows downward and the floor anchor is y = 184.
const styledTapBox: Record<Exclude<BedStyle, 'standard'>, { x0: number; y0: number; x1: number; y1: number }> = {
  cloud: { x0: 20, y0: 66, x1: 260, y1: 192 },
  bone: { x0: 24, y0: 70, x1: 256, y1: 190 },
  cave: { x0: 36, y0: 18, x1: 244, y1: 190 },
  moon: { x0: 24, y0: 8, x1: 256, y1: 192 },
};

const bedTapPad = 8;

// How far above a bed's floor point a sleeper still counts as on the cushion.
// Styled beds draw the cushion above the floor anchor, and a wider bed lifts it further.
export function bedCushionReach(prop: { w?: number; bedStyle?: BedStyle }): number {
  const style = prop.bedStyle ?? 'standard';
  const anchor = bedAnchors[style];
  if (!anchor) {
    return 48;
  }
  const scale = (prop.w ?? styledBedWidth) / bedArtWidth;
  const lift = (184 - anchor.y) * scale;
  return Math.max(48, lift + 16);
}

export function bedPoiOffset(piece: FurniturePiece): { x: number; y: number } {
  const style = piece.bedStyle ?? 'standard';
  const anchor = bedAnchors[style];
  if (!anchor) {
    return { x: 0, y: 2 };
  }
  const scale = (resolvedBedWidth(piece) ?? styledBedWidth) / bedArtWidth;
  return { x: (anchor.x - 140) * scale, y: (anchor.y - 184) * scale };
}

export function bedDisplayName(piece: FurniturePiece): string {
  const sku = shopSku(piece);
  if (piece.kind === 'bed' && sku && bedCatalog[sku]) {
    return bedCatalog[sku].name;
  }
  return 'Bed';
}

export function countsAsBed(piece: { kind: string }): boolean {
  return piece.kind === 'bed' || piece.kind === 'dogHouse';
}

export function restBadge(multiplier: number | undefined): '×2' | '×2.5' | null {
  if (multiplier === 2) {
    return '×2';
  }
  if (multiplier === 2.5) {
    return '×2.5';
  }
  return null;
}

export function roomRestBadge(
  pieces: readonly FurniturePiece[],
  placed: readonly FurniturePlacement[],
  sceneId: string,
  asleep: boolean,
): '×2' | '×2.5' | null {
  if (!asleep) {
    return null;
  }
  for (const place of placed) {
    if (place.sceneId !== sceneId) {
      continue;
    }
    const piece = pieces.find((item) => item.id === place.pieceId);
    if (piece && countsAsBed(piece)) {
      const rest = piece.kind === 'dogHouse' ? (piece.restMultiplier ?? HOUSE_REST) : (piece.restMultiplier ?? bedCatalog[shopSku(piece) ?? '']?.rest ?? 1);
      return restBadge(rest);
    }
  }
  return null;
}

// The first bed in the saved list stays. The others leave the room and remain owned.
export function keepFirstBedPerRoom(
  pieces: readonly FurniturePiece[],
  placed: readonly FurniturePlacement[],
): { placed: FurniturePlacement[]; stored: { sceneId: string; pieceId: string }[] } {
  const seen = new Set<string>();
  const next: FurniturePlacement[] = [];
  const stored: { sceneId: string; pieceId: string }[] = [];
  for (const place of placed) {
    const piece = pieces.find((item) => item.id === place.pieceId);
    if (!piece || !countsAsBed(piece)) {
      next.push(place);
      continue;
    }
    if (seen.has(place.sceneId)) {
      stored.push({ sceneId: place.sceneId, pieceId: place.pieceId });
      continue;
    }
    seen.add(place.sceneId);
    next.push(place);
  }
  return { placed: next, stored };
}

export function otherBedInRoom(
  pieces: readonly FurniturePiece[],
  placed: readonly FurniturePlacement[],
  sceneId: string,
  pieceId: string,
): FurniturePlacement | null {
  for (const place of placed) {
    if (place.sceneId !== sceneId || place.pieceId === pieceId) {
      continue;
    }
    const other = pieces.find((item) => item.id === place.pieceId);
    if (other && countsAsBed(other)) {
      return place;
    }
  }
  return null;
}

function pieceForSku(id: string, sku: string): FurniturePiece | null {
  const bed = bedCatalog[sku];
  if (bed) {
    return {
      id,
      kind: 'bed',
      catalogId: sku,
      bedStyle: bed.style,
      restMultiplier: bed.rest,
      w: shopBedWidth(bed),
      color: bed.style === 'standard' ? '#c2653d' : undefined,
    };
  }
  if (sku === 'bowl_food') {
    return { id, kind: 'bowl', catalogId: sku, contents: 'kibble', color: '#2f7d5b' };
  }
  if (sku === 'bowl_water') {
    return { id, kind: 'bowl', catalogId: sku, contents: 'water', color: '#3f78b5' };
  }
  return null;
}

export function furnitureDefinition(id: string): FurniturePiece | null {
  for (const scene of Object.values(scenes)) {
    for (const prop of scene.props) {
      if (prop.id === id) {
        return pieceFromProp(prop);
      }
    }
  }
  const sku = id.split(':')[0] ?? id;
  const shaped = pieceForSku(id, sku);
  if (shaped) {
    return shaped;
  }
  if (Object.prototype.hasOwnProperty.call(shopFurniture, id)) {
    const kind = id as ShopFurnitureId;
    if (kind === 'scratcher') {
      return { id: kind, kind, h: 74 };
    }
    if (kind === 'dogHouse') {
      return { id: kind, kind, w: HOUSE_WIDTH, restMultiplier: HOUSE_REST };
    }
    return { id: kind, kind };
  }
  return null;
}

export function buySpot(sku: string, sceneId: string): { sceneId: string; x: number; y: number } | null {
  if (isBedSku(sku)) {
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(shopFurniture, sku)) {
    return shopFurnitureSpot(sku as ShopFurnitureId, sceneId);
  }
  const spots = bowlSpots[sku];
  if (!spots) {
    return null;
  }
  const requested = sceneById(sceneId);
  const targetId = requested.playerOwned ? requested.id : 'livingroom';
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

// A bowl is water when it says so, or when its id is a water bowl. Anything else holds food.
export function bowlContents(piece: { kind: string; id?: string; contents?: string; catalogId?: string }): 'kibble' | 'water' | null {
  if (piece.kind !== 'bowl') {
    return null;
  }
  if (piece.contents === 'water' || piece.catalogId === 'bowl_water' || (piece.id?.includes('water') ?? false)) {
    return 'water';
  }
  return 'kibble';
}

export function bowlUse(piece: FurniturePiece): BowlUse | null {
  const contents = bowlContents(piece);
  if (!contents) {
    return null;
  }
  return contents === 'water' ? 'water' : 'food';
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

function pieceSpecies(piece: FurniturePiece): 'dog' | 'cat' | null {
  if (piece.kind === 'dogHouse') {
    return 'dog';
  }
  if (piece.kind === 'catTree' || piece.kind === 'scratcher' || piece.kind === 'litterbox' || piece.kind === 'planter' || piece.kind === 'catioPost') {
    return 'cat';
  }
  if (piece.kind === 'bed') {
    const sku = shopSku(piece);
    return (sku && bedCatalog[sku]?.species) || null;
  }
  return null;
}

// Park and school are not homes. A species-locked piece stays in storage for the other pet.
export function canPlaceFurniture(piece: FurniturePiece, sceneId: string, species: 'dog' | 'cat'): boolean {
  const scene = sceneById(sceneId);
  if (!scene.playerOwned || (scene.species != null && scene.species !== species)) {
    return false;
  }
  const locked = pieceSpecies(piece);
  if (locked != null && locked !== species) {
    return false;
  }
  const sku = shopSku(piece);
  if (sku && Object.prototype.hasOwnProperty.call(shopFurniture, sku)) {
    const allowed = shopFurniture[sku as ShopFurnitureId].scenes;
    if (!(allowed as readonly string[]).includes(sceneId)) {
      return false;
    }
  }
  if (piece.kind === 'planter' || piece.kind === 'catioPost') {
    return sceneId === 'catio';
  }
  return true;
}

export function pieceLabel(piece: FurniturePiece): string {
  if (piece.kind === 'bowl') {
    return piece.contents === 'water' ? 'Water bowl' : 'Food bowl';
  }
  if (piece.kind === 'bed') {
    return bedDisplayName(piece);
  }
  if (piece.kind === 'catTree') {
    return 'Cat tree';
  }
  if (piece.kind === 'dogHouse') {
    return 'Glass Conservatory';
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

// Bowls ask before they leave. A bed does not. The name is the pet's.
export function stowWarning(piece: FurniturePiece, name: string): string | null {
  if (piece.kind === 'bowl' && piece.contents === 'water') {
    return `${name} won't be able to drink here.`;
  }
  if (piece.kind === 'bowl') {
    return `${name} won't be able to eat here.`;
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
  if (prop.bedStyle) {
    piece.bedStyle = prop.bedStyle;
  }
  if (prop.restMultiplier != null) {
    piece.restMultiplier = prop.restMultiplier;
  }
  return piece;
}

function propFromPiece(piece: FurniturePiece, x: number, y: number): Prop {
  const prop: Prop = { kind: piece.kind, id: piece.id, x, y };
  const contents = bowlContents(piece);
  if (contents) {
    prop.contents = contents;
  } else if (piece.contents) {
    prop.contents = piece.contents;
  }
  if (piece.color) {
    prop.color = piece.color;
  }
  const bedWidth = piece.kind === 'bed' ? resolvedBedWidth(piece) : piece.w;
  if (bedWidth != null) {
    prop.w = bedWidth;
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
  if (piece.bedStyle) {
    prop.bedStyle = piece.bedStyle;
  }
  if (piece.restMultiplier != null) {
    prop.restMultiplier = piece.restMultiplier;
  }
  if (piece.kind === 'dogHouse') {
    prop.w = piece.w ?? HOUSE_WIDTH;
    prop.restMultiplier = piece.restMultiplier ?? HOUSE_REST;
  }
  return prop;
}

function poiForPiece(piece: FurniturePiece, x: number, y: number): Poi | null {
  const contents = bowlContents(piece);
  if (contents === 'kibble') {
    return { id: piece.id, type: 'food', x, y, face: 1, propId: piece.id };
  }
  if (contents === 'water') {
    return { id: piece.id, type: 'water', x, y, face: 1, propId: piece.id };
  }
  if (piece.kind === 'bed' || piece.kind === 'dogHouse') {
    const offset = piece.kind === 'bed' ? bedPoiOffset(piece) : { x: 0, y: 2 };
    return { id: piece.id, type: 'bed', x: x + offset.x, y: y + offset.y, propId: piece.id };
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

  return { ...scene, props, pois: settleHouses(scene, props, pois) };
}

function settleHouses(scene: Scene, props: Prop[], pois: Poi[]): Poi[] {
  for (const prop of props) {
    if (prop.kind !== 'dogHouse' || !prop.id) {
      continue;
    }
    placeHouse(prop, scene.floor);
    const rest = houseWorld(prop, HOUSE_POINTS.R.x, HOUSE_POINTS.R.y);
    const found = pois.find((poi) => poi.propId === prop.id && poi.type === 'bed');
    if (found) {
      found.x = rest.x;
      found.y = rest.y;
    } else {
      pois.push({ id: prop.id, type: 'bed', x: rest.x, y: rest.y, propId: prop.id });
    }
  }
  return pois;
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
    if (updated.w != null) {
      prop.w = updated.w;
    }
    if (updated.contents) {
      prop.contents = updated.contents;
    }
    if (updated.color) {
      prop.color = updated.color;
    }
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
      found.type = poi.type;
      found.face = poi.face;
      found.propId = poi.propId;
    } else {
      live.pois.push({ ...poi });
    }
  }
  settleHouses(live, live.props, live.pois);
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
  const placed = scene.props.find((prop) => prop.id === piece.id);
  if (placed) {
    settleHouses(scene, [placed], scene.pois);
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
  if (prop.kind === 'dogHouse') {
    settleHouses(scene, [prop], scene.pois);
    return { sceneId: scene.id, x: next.x, y: next.y };
  }
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

// The bed drawing sits above the floor anchor. A press on the cushion has to count.
function bedContains(prop: Prop, x: number, y: number): boolean {
  const style = prop.bedStyle;
  if (style && style !== 'standard') {
    const box = styledTapBox[style];
    const scale = (prop.w ?? styledBedWidth) / bedArtWidth;
    const left = prop.x + (box.x0 - 140) * scale - bedTapPad;
    const right = prop.x + (box.x1 - 140) * scale + bedTapPad;
    const top = prop.y + (box.y0 - 184) * scale - bedTapPad;
    const bottom = prop.y + (box.y1 - 184) * scale + bedTapPad;
    return x >= left && x <= right && y >= top && y <= bottom;
  }
  const half = (prop.w ?? 112) / 2 + bedTapPad;
  return Math.abs(x - prop.x) <= half && y >= prop.y - 40 && y <= prop.y + 12;
}

export function obstaclesIn(scene: Scene, openPropId: string | null): Obstacle[] {
  const list: Obstacle[] = [];
  for (const prop of scene.props) {
    if (prop.kind === 'dogHouse') {
      if (!prop.id || prop.id === openPropId) {
        continue;
      }
      for (const block of houseBlocks(prop)) {
        list.push({ id: prop.id, ...block });
      }
      continue;
    }
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
  const chosen = options[0];
  // Already standing on this side, and the goal is still behind the piece.
  // A point a step further around the rim keeps the pet moving instead of parking there.
  if (Math.hypot(chosen.x - from.x, chosen.y - from.y) > 16 || firstHitT(chosen, goal, obstacle) == null) {
    return chosen;
  }
  const rx = (from.x - obstacle.x) / obstacle.hw;
  const ry = (from.y - obstacle.y) / obstacle.hd;
  const rlen = Math.hypot(rx, ry) || 1;
  const ox = rx / rlen;
  const oy = ry / rlen;
  const gx = (goal.x - obstacle.x) / obstacle.hw;
  const gy = (goal.y - obstacle.y) / obstacle.hd;
  const turn = (ox * gy - oy * gx >= 0 ? 1 : -1) * 0.9;
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const nx = ox * c - oy * s;
  const ny = ox * s + oy * c;
  return standingPoint(obstacle, nx * obstacle.hw, ny * obstacle.hd, bounds) ?? chosen;
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
    if (prop.kind === 'dogHouse') {
      if (!prop.id || !houseContains(prop, x, y)) {
        continue;
      }
      if (!best || prop.y >= best.y) {
        best = { id: prop.id, y: prop.y };
      }
      continue;
    }
    if (prop.kind === 'bed') {
      if (!prop.id || !bedContains(prop, x, y)) {
        continue;
      }
      if (!best || prop.y >= best.y) {
        best = { id: prop.id, y: prop.y };
      }
      continue;
    }
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
