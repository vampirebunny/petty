import { birdHabitats, birdSpeciesIds } from './birds';
import type { BirdHabitat, BirdSpecies, BirdSpot } from './birds';
import { createCatioScene } from './catioScene';
import { defaultActorTint } from './lighting';
import { mulberry, seedOf } from './mulberry';

export const stageWidth = 640;
export const stageHeight = 680;

/** Extra stage units on each side when the view is wider than the stage. Matches drawWorld. */
export function stageBleed(width: number, height: number, visibleHeight = stageHeight): number {
  if (width <= 0 || height <= 0) {
    return 0;
  }
  const scaleY = height / visibleHeight;
  const contentPx = stageWidth * scaleY;
  if (width > contentPx + 0.5) {
    return (width - contentPx) / 2 / scaleY;
  }
  return 0;
}
// The adoption preview shows only the top of the stage, so it keeps the original proportions.
export const previewStageHeight = 340;

export const propKinds = [
  'shape',
  'bowl',
  'bed',
  'rug',
  'couch',
  'window',
  'lamp',
  'tree',
  'bench',
  'pond',
  'bush',
  'fence',
  'litterbox',
  'garden',
  'catioScreen',
  'catioPost',
  'catTree',
  'dogHouse',
  'shelf',
  'hammock',
  'planter',
  'scratcher',
  'goalPost',
  'fieldLines',
] as const;

export const shapeTypes = ['rect', 'ellipse', 'circle', 'poly', 'line', 'sky'] as const;

export type SceneTime = 'outdoor' | 'indoor' | 'fixed';

export type Shape = {
  t: (typeof shapeTypes)[number];
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  r?: number;
  rx?: number;
  ry?: number;
  pts?: [number, number][];
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  lw?: number;
  fill?: string;
  stroke?: string;
  alpha?: number;
};

export type Prop = {
  kind: string;
  // Stable id on furniture, so a move keeps the point of interest attached.
  id?: string;
  x: number;
  y: number;
  layer?: 'back' | 'sorted' | 'front';
  scale?: number;
  w?: number;
  h?: number;
  color?: string;
  contents?: string;
  glow?: boolean;
  // Shop beds. Missing means the original bolster, which rests at 1×.
  bedStyle?: 'standard' | 'cloud' | 'bone' | 'cave' | 'moon';
  restMultiplier?: number;
  // A low obstacle a fast pet hops over when it runs through it.
  hurdle?: boolean;
  shapes?: Shape[];
  // Trees: keep leaves all year, or drop them with the season.
  foliage?: 'evergreen' | 'deciduous';
  // Windows: curtain colour, or false for a bare frame.
  curtain?: string | false;
  // Planters: what grows in them.
  plant?: 'catgrass' | 'flowers' | 'catnip';
  // Mirror the prop left to right.
  flip?: boolean;
};

export type Poi = {
  id: string;
  type: string;
  x: number;
  y: number;
  face?: 1 | -1;
  // Furniture prop this spot follows when the player moves it.
  propId?: string;
};

export type Scene = {
  v: 1;
  id: string;
  name: string;
  time: SceneTime;
  // When set, only that species is offered the scene at home. Playdates include it when any pet matches.
  species?: 'cat' | 'dog';
  group?: 'home' | 'town';
  // The player can store furniture here and put it back. Park and school are not the player's.
  playerOwned?: boolean;
  blurb?: string;
  iconId?: string;
  // Rain and snow stay off the floor. The catio is roofed.
  shelter?: 'roofed';
  // Where the roof beam is, for garlands.
  roofY?: number;
  sky: [string, string];
  layers: Shape[];
  floor: {
    horizon: number;
    yMin: number;
    yMax: number;
    xMin: number;
    xMax: number;
    color: [string, string];
    pattern: 'lines' | 'planks' | 'grass' | 'none';
    lineColor?: string;
  };
  surface: { bounce: number; friction: number };
  props: Prop[];
  pois: Poi[];
  lighting: { actorTint: number };
  birds?: BirdSpot[];
  ambient?: {
    tint?: string;
    particles?: { kind: 'rain' | 'snow' | 'leaves'; count?: number; color?: string };
  };
};

export const particleKinds = ['rain', 'snow', 'leaves'] as const;

function readActorTint(value: unknown, time: SceneTime): number {
  if (value == null) {
    return defaultActorTint(time);
  }
  if (!isRecord(value) || typeof value.actorTint !== 'number' || !Number.isFinite(value.actorTint) || value.actorTint < 0 || value.actorTint > 1) {
    throw new Error('"lighting.actorTint" must be a number from 0 to 1.');
  }
  return value.actorTint;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function checkShapes(list: unknown, where: string): Shape[] {
  if (!Array.isArray(list)) {
    throw new Error(`"${where}" must be a list of shapes.`);
  }
  return list.map((shape, index) => {
    if (!isRecord(shape) || typeof shape.t !== 'string' || !shapeTypes.includes(shape.t as Shape['t'])) {
      throw new Error(`${where}[${index}]: shape type "t" must be one of ${shapeTypes.join(', ')}.`);
    }
    return shape as Shape;
  });
}

function readBirds(value: unknown): BirdSpot[] | undefined {
  if (value == null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error('"birds" must be a list of spots.');
  }
  return value.map((spot, index) => {
    if (!isRecord(spot) || typeof spot.x !== 'number' || typeof spot.y !== 'number') {
      throw new Error(`birds[${index}]: "x" and "y" must be numbers.`);
    }
    if (typeof spot.on !== 'string' || !birdHabitats.includes(spot.on as BirdHabitat)) {
      throw new Error(`birds[${index}]: "on" must be ground, perch or water.`);
    }
    const species = spot.species;
    if (species != null) {
      if (!Array.isArray(species) || species.some((name) => typeof name !== 'string' || !birdSpeciesIds.includes(name as BirdSpecies))) {
        throw new Error(`birds[${index}]: "species" must be sparrow, pigeon, robin, cardinal, duck or owl.`);
      }
    }
    const compiled: BirdSpot = { x: spot.x, y: spot.y, on: spot.on as BirdHabitat };
    if (species) {
      compiled.species = species as BirdSpecies[];
    }
    if (typeof spot.roam === 'number') {
      compiled.roam = spot.roam;
    }
    if (typeof spot.roamY === 'number') {
      compiled.roamY = spot.roamY;
    }
    if (typeof spot.sortY === 'number') {
      compiled.sortY = spot.sortY;
    }
    if (typeof spot.count === 'number') {
      compiled.count = spot.count;
    }
    if (typeof spot.chance === 'number') {
      compiled.chance = spot.chance;
    }
    return compiled;
  });
}

export function compileScene(def: unknown): Scene {
  if (!isRecord(def)) {
    throw new Error('A scene must be a JSON object.');
  }
  if (def.v != null && def.v !== 1) {
    throw new Error(`Unknown schema version ${String(def.v)}.`);
  }
  const sky = def.sky;
  if (!Array.isArray(sky) || sky.length !== 2 || sky.some((color) => typeof color !== 'string')) {
    throw new Error('"sky" needs two colors, for example ["#a9d8f0", "#e2f3f8"].');
  }
  const time = def.time == null ? 'fixed' : def.time;
  if (time !== 'outdoor' && time !== 'indoor' && time !== 'fixed') {
    throw new Error('"time" must be outdoor, indoor or fixed.');
  }
  const floor = def.floor;
  if (!isRecord(floor)) {
    throw new Error('"floor" is required: { horizon, yMin, yMax, color: [top, bottom] }.');
  }
  for (const key of ['horizon', 'yMin', 'yMax'] as const) {
    if (typeof floor[key] !== 'number') {
      throw new Error(`"floor.${key}" must be a number.`);
    }
  }
  if (!((floor.yMin as number) < (floor.yMax as number))) {
    throw new Error('"floor.yMin" must be smaller than "floor.yMax".');
  }
  if ((floor.horizon as number) > (floor.yMax as number) - 20) {
    throw new Error('"floor.horizon" must sit above the walkable band.');
  }
  const color = floor.color;
  if (!Array.isArray(color) || color.length !== 2) {
    throw new Error('"floor.color" needs two colors: [top, bottom].');
  }
  const pattern = floor.pattern == null ? 'lines' : floor.pattern;
  if (pattern !== 'lines' && pattern !== 'planks' && pattern !== 'grass' && pattern !== 'none') {
    throw new Error('"floor.pattern" must be lines, planks, grass or none.');
  }
  const surface = isRecord(def.surface) ? def.surface : {};
  const species = def.species == null ? undefined : def.species;
  if (species != null && species !== 'cat' && species !== 'dog') {
    throw new Error('"species" must be cat or dog.');
  }
  const group = def.group == null ? 'home' : def.group;
  if (group !== 'home' && group !== 'town') {
    throw new Error('"group" must be home or town.');
  }
  if (def.blurb != null && typeof def.blurb !== 'string') {
    throw new Error('"blurb" must be a string.');
  }
  if (def.iconId != null && typeof def.iconId !== 'string') {
    throw new Error('"iconId" must be a string.');
  }
  const shelter = def.shelter == null ? undefined : def.shelter;
  if (shelter != null && shelter !== 'roofed') {
    throw new Error('"shelter" must be roofed.');
  }
  if (def.roofY != null && typeof def.roofY !== 'number') {
    throw new Error('"roofY" must be a number.');
  }
  if (def.playerOwned != null && typeof def.playerOwned !== 'boolean') {
    throw new Error('"playerOwned" must be true or false.');
  }
  const actorTint = readActorTint(def.lighting, time);
  const props = Array.isArray(def.props) ? def.props : [];
  const compiledProps = props.map((prop, index) => {
    if (!isRecord(prop) || typeof prop.kind !== 'string' || !propKinds.includes(prop.kind as (typeof propKinds)[number])) {
      throw new Error(
        `props[${index}]: unknown kind "${isRecord(prop) ? String(prop.kind) : ''}". Known kinds: ${propKinds.join(', ')}.`,
      );
    }
    if (typeof prop.x !== 'number' || typeof prop.y !== 'number') {
      throw new Error(`props[${index}]: "x" and "y" must be numbers.`);
    }
    if (prop.layer != null && prop.layer !== 'back' && prop.layer !== 'sorted' && prop.layer !== 'front') {
      throw new Error(`props[${index}]: "layer" must be back, sorted or front.`);
    }
    if (prop.kind === 'shape') {
      checkShapes(prop.shapes, `props[${index}].shapes`);
    }
    return prop as Prop;
  });
  const ambient = isRecord(def.ambient) ? def.ambient : undefined;
  if (ambient && isRecord(ambient.particles) && !particleKinds.includes(ambient.particles.kind as (typeof particleKinds)[number])) {
    throw new Error('"ambient.particles.kind" must be rain, snow or leaves.');
  }
  const pois = Array.isArray(def.pois) ? def.pois : [];
  const compiledPois = pois.map((poi, index) => {
    if (!isRecord(poi) || typeof poi.type !== 'string' || typeof poi.x !== 'number' || typeof poi.y !== 'number') {
      throw new Error(`pois[${index}]: needs type, x, and y.`);
    }
    const compiled: Poi = {
      id: typeof poi.id === 'string' ? poi.id : `${poi.type}-${index}`,
      type: poi.type,
      x: poi.x,
      y: poi.y,
      face: poi.face === -1 ? -1 : 1,
    };
    if (typeof poi.propId === 'string') {
      compiled.propId = poi.propId;
    }
    return compiled;
  });
  return {
    v: 1,
    id: typeof def.id === 'string' ? def.id : 'custom',
    name: typeof def.name === 'string' ? def.name : typeof def.id === 'string' ? def.id : 'custom',
    time,
    species,
    group,
    playerOwned: typeof def.playerOwned === 'boolean' ? def.playerOwned : undefined,
    blurb: typeof def.blurb === 'string' ? def.blurb : undefined,
    iconId: typeof def.iconId === 'string' ? def.iconId : undefined,
    shelter,
    roofY: typeof def.roofY === 'number' ? def.roofY : undefined,
    sky: [sky[0] as string, sky[1] as string],
    layers: def.layers == null ? [] : checkShapes(def.layers, 'layers'),
    floor: {
      horizon: floor.horizon as number,
      yMin: floor.yMin as number,
      yMax: floor.yMax as number,
      xMin: typeof floor.xMin === 'number' ? floor.xMin : 28,
      xMax: typeof floor.xMax === 'number' ? floor.xMax : stageWidth - 28,
      color: [color[0] as string, color[1] as string],
      pattern,
      lineColor: typeof floor.lineColor === 'string' ? floor.lineColor : undefined,
    },
    surface: {
      bounce: typeof surface.bounce === 'number' ? surface.bounce : 0.55,
      friction: typeof surface.friction === 'number' ? surface.friction : 1.8,
    },
    props: compiledProps,
    pois: compiledPois,
    lighting: { actorTint },
    birds: readBirds(def.birds),
    ambient: ambient as Scene['ambient'],
  };
}

export function loadScene(def: unknown): Scene | null {
  if (isRecord(def) && typeof def.v === 'number' && def.v !== 1) {
    return null;
  }
  try {
    return compileScene(def);
  } catch {
    return null;
  }
}

const sceneDefs = {
  livingroom: {
    v: 1,
    id: 'livingroom',
    name: 'Living room',
    group: 'home',
    playerOwned: true,
    blurb: 'Food & water',
    iconId: 'livingroom',
    time: 'indoor',
    sky: ['#efe3d2', '#e2d2bb'],
    layers: [
      { t: 'rect', x: 0, y: 176, w: 640, h: 14, fill: '#b9a389' },
      { t: 'rect', x: 40, y: 48, w: 54, h: 70, fill: '#8a6a52', r: 3 },
      { t: 'sky', x: 46, y: 54, w: 42, h: 58 },
      { t: 'rect', x: 360, y: 40, w: 70, h: 52, fill: '#8a6a52', r: 3 },
      { t: 'sky', x: 366, y: 46, w: 58, h: 40 },
    ],
    floor: { horizon: 190, yMin: 224, yMax: 654, color: ['#c19463', '#a67a4d'], pattern: 'planks', lineColor: 'rgba(70,40,10,0.22)' },
    surface: { bounce: 0.55, friction: 1.8 },
    props: [
      { kind: 'window', x: 210, y: 150, w: 96, h: 92, layer: 'back' },
      { kind: 'rug', x: 330, y: 440, w: 400, h: 130, color: '#7c5a8a', layer: 'back' },
      { kind: 'couch', x: 510, y: 204, w: 190, color: '#4f7c8a' },
      { kind: 'lamp', x: 604, y: 206 },
      { kind: 'bed', id: 'livingroom-bed', x: 110, y: 540, w: 112, color: '#c2653d' },
      { kind: 'bowl', id: 'livingroom-food', x: 540, y: 330, color: '#2f7d5b', contents: 'kibble' },
      { kind: 'bowl', id: 'livingroom-water', x: 500, y: 560, color: '#3f78b5', contents: 'water' },
    ],
    pois: [
      { id: 'bowl', type: 'food', x: 540, y: 330, face: 1, propId: 'livingroom-food' },
      { id: 'water', type: 'water', x: 500, y: 560, face: 1, propId: 'livingroom-water' },
      { id: 'bed', type: 'bed', x: 110, y: 542, propId: 'livingroom-bed' },
      { id: 'home', type: 'home', x: 300, y: 440 },
    ],
  },
  park: {
    v: 1,
    id: 'park',
    name: 'Park',
    group: 'home',
    blurb: 'Room to play fetch',
    iconId: 'park',
    time: 'outdoor',
    sky: ['#a9d8f0', '#e2f3f8'],
    layers: [
      { t: 'ellipse', x: 120, y: 70, rx: 48, ry: 12, fill: '#ffffff', alpha: 0.85 },
      { t: 'ellipse', x: 150, y: 62, rx: 34, ry: 10, fill: '#ffffff', alpha: 0.85 },
      { t: 'ellipse', x: 400, y: 92, rx: 56, ry: 12, fill: '#ffffff', alpha: 0.7 },
      { t: 'ellipse', x: 140, y: 182, rx: 210, ry: 48, fill: '#9ccf91' },
      { t: 'ellipse', x: 470, y: 186, rx: 240, ry: 56, fill: '#8bc482' },
    ],
    floor: { horizon: 176, yMin: 214, yMax: 654, color: ['#86c46f', '#6fae5b'], pattern: 'grass', lineColor: 'rgba(40,100,40,0.45)' },
    surface: { bounce: 0.42, friction: 3.4 },
    props: [
      { kind: 'fence', x: 320, y: 182, w: 640, layer: 'back' },
      { kind: 'pond', x: 505, y: 268, w: 150, h: 34, layer: 'back' },
      { kind: 'tree', x: 70, y: 196, scale: 1.1 },
      { kind: 'bush', x: 190, y: 198 },
      { kind: 'bench', x: 340, y: 206, w: 96 },
      { kind: 'tree', x: 590, y: 228, scale: 1.3 },
    ],
    pois: [
      { id: 'pond', type: 'water', x: 474, y: 268, face: 1 },
      { id: 'home', type: 'home', x: 220, y: 274 },
    ],
    birds: [
      { x: 180, y: 480, on: 'ground', count: 3, roam: 55, roamY: 22, species: ['sparrow', 'robin', 'cardinal', 'pigeon'] },
      { x: 420, y: 560, on: 'ground', count: 2, roam: 50, roamY: 20, species: ['sparrow', 'robin', 'cardinal', 'pigeon'] },
      { x: 240, y: 149, on: 'perch', sortY: 182, species: ['sparrow', 'robin', 'cardinal', 'pigeon'] },
      { x: 340, y: 154, on: 'perch', sortY: 206, species: ['sparrow', 'robin', 'cardinal', 'pigeon'] },
      { x: 37, y: 84, on: 'perch', sortY: 196, species: ['sparrow', 'robin', 'cardinal', 'pigeon'] },
    ],
    ambient: { particles: { kind: 'leaves', count: 12 } },
  },
  bedroom: {
    v: 1,
    id: 'bedroom',
    name: 'Bedroom',
    group: 'home',
    playerOwned: true,
    blurb: 'Cozy nap spot',
    iconId: 'bedroom',
    time: 'indoor',
    sky: ['#ddd5ee', '#cdc4e3'],
    layers: [
      { t: 'rect', x: 0, y: 178, w: 640, h: 12, fill: '#b3a9d2' },
      { t: 'rect', x: 450, y: 50, w: 64, h: 50, fill: '#efe8f7', r: 3 },
      { t: 'sky', x: 456, y: 56, w: 52, h: 38 },
    ],
    floor: { horizon: 190, yMin: 226, yMax: 654, color: ['#c7b8dd', '#b3a3cc'], pattern: 'planks', lineColor: 'rgba(60,40,100,0.22)' },
    surface: { bounce: 0.38, friction: 3 },
    props: [
      { kind: 'window', x: 130, y: 150, w: 100, h: 96, layer: 'back' },
      {
        kind: 'shape',
        x: 350,
        y: 206,
        shapes: [
          { t: 'rect', x: -100, y: -80, w: 200, h: 34, fill: '#5a4268', r: 6 },
          { t: 'rect', x: -96, y: -54, w: 192, h: 42, fill: '#e6dff0', r: 6 },
          { t: 'rect', x: -96, y: -40, w: 192, h: 28, fill: '#5e7fc4', r: 6 },
          { t: 'ellipse', x: -52, y: -52, rx: 30, ry: 9, fill: '#ffffff' },
          { t: 'ellipse', x: 52, y: -52, rx: 30, ry: 9, fill: '#ffffff' },
          { t: 'rect', x: -98, y: -12, w: 8, h: 12, fill: '#3d2f4a' },
          { t: 'rect', x: 90, y: -12, w: 8, h: 12, fill: '#3d2f4a' },
        ],
      },
      { kind: 'lamp', x: 540, y: 208 },
      { kind: 'rug', x: 330, y: 470, w: 380, h: 120, color: '#9a86c0', layer: 'back' },
    ],
    pois: [{ id: 'home', type: 'home', x: 320, y: 470 }],
  },
  sidewalk: {
    v: 1,
    id: 'sidewalk',
    name: 'Sidewalk',
    time: 'outdoor',
    sky: ['#a9d8f0', '#e2f3f8'],
    layers: [
      { t: 'rect', x: 0, y: 150, w: 640, h: 40, fill: '#c5ccd4' },
      { t: 'rect', x: 0, y: 168, w: 640, h: 8, fill: '#9aa3ad' },
    ],
    floor: { horizon: 176, yMin: 220, yMax: 654, color: ['#c9c2b6', '#b7b0a4'], pattern: 'lines', lineColor: 'rgba(80,70,60,0.25)' },
    surface: { bounce: 0.3, friction: 2.4 },
    props: [
      { kind: 'tree', x: 80, y: 200, scale: 0.9 },
      { kind: 'tree', x: 560, y: 210, scale: 1.05 },
      { kind: 'bench', x: 400, y: 214, w: 90 },
    ],
    pois: [{ id: 'home', type: 'home', x: 300, y: 420 }],
  },
  school: {
    v: 1,
    id: 'school',
    name: 'Training School',
    group: 'home',
    blurb: 'Tricks and treats',
    iconId: 'school',
    // Built like the park: the live sky, seasonal grass, and props that react to weather and season.
    time: 'outdoor',
    sky: ['#a9d8f0', '#e2f3f8'],
    layers: [
      { t: 'ellipse', x: 110, y: 184, rx: 220, ry: 46, fill: '#8ed9d0' },
      { t: 'ellipse', x: 500, y: 182, rx: 230, ry: 50, fill: '#6ec4be' },
    ],
    floor: { horizon: 176, yMin: 214, yMax: 654, color: ['#6ec4bc', '#3f9694'], pattern: 'grass', lineColor: 'rgba(20,80,80,0.4)' },
    surface: { bounce: 0.42, friction: 3.4 },
    props: [
      { kind: 'fence', x: 320, y: 182, w: 640, layer: 'back' },
      { kind: 'fieldLines', x: 0, y: 0, layer: 'back' },
      { kind: 'tree', x: 52, y: 200, scale: 1.05 },
      { kind: 'bush', x: 160, y: 198 },
      { kind: 'goalPost', x: 320, y: 200, w: 96, h: 100 },
      { kind: 'bush', x: 470, y: 198, scale: 0.9 },
      { kind: 'bench', x: 548, y: 206, w: 90 },
      { kind: 'tree', x: 612, y: 224, scale: 1.2 },
    ],
    pois: [{ id: 'home', type: 'home', x: 330, y: 470 }],
    birds: [
      { x: 170, y: 520, on: 'ground', count: 3, roam: 55, roamY: 22, species: ['sparrow', 'robin', 'cardinal', 'pigeon'] },
      { x: 470, y: 590, on: 'ground', count: 2, roam: 50, roamY: 20, species: ['sparrow', 'robin', 'cardinal', 'pigeon'] },
      { x: 272, y: 101, on: 'perch', sortY: 200, species: ['sparrow', 'robin', 'cardinal'] },
      { x: 548, y: 154, on: 'perch', sortY: 206, species: ['sparrow', 'robin', 'cardinal', 'pigeon'] },
    ],
    ambient: { particles: { kind: 'leaves', count: 10 } },
  },
} as const;

export const scenes = {
  livingroom: compileScene(sceneDefs.livingroom),
  park: compileScene(sceneDefs.park),
  bedroom: compileScene(sceneDefs.bedroom),
  sidewalk: compileScene(sceneDefs.sidewalk),
  catio: createCatioScene(stageWidth, stageHeight),
  school: compileScene(sceneDefs.school),
};

export const sceneList = [scenes.livingroom, scenes.bedroom, scenes.park, scenes.catio, scenes.school];

// Home offers a species-limited scene only to that species. A playdate passes every pet in the pair,
// so the catio shows up when at least one of them is a cat.
export function scenesFor(species: 'dog' | 'cat' | readonly ('dog' | 'cat')[]): Scene[] {
  const allowed = typeof species === 'string' ? [species] : species;
  return sceneList.filter((scene) => scene.species == null || allowed.includes(scene.species));
}

// Rooms this pet owns. Park and training school are not the player's.
export function ownedScenes(species: 'dog' | 'cat'): Scene[] {
  return scenesFor(species).filter((scene) => scene.playerOwned === true);
}

// The data a preset was built from, as plain JSON, so it can be edited and applied back.
export function sceneSource(id: string): unknown {
  const def = (sceneDefs as Record<string, unknown>)[id] ?? sceneDefs.livingroom;
  return JSON.parse(JSON.stringify(def));
}

export function isPreset(id: string): boolean {
  return id in sceneDefs;
}

export type Tuft = { x: number; y: number; s: number };

const tuftCache = new WeakMap<Scene, Tuft[]>();

// Grass tufts are seeded by the scene id so a scene always looks the same.
export function tuftsFor(scene: Scene): Tuft[] {
  const cached = tuftCache.get(scene);
  if (cached) {
    return cached;
  }
  const roll = mulberry(seedOf(scene.id));
  const list: Tuft[] = [];
  const horizon = scene.floor.horizon;
  for (let i = 0; i < 110; i += 1) {
    const y = horizon + 6 + roll() * (stageHeight - horizon - 8);
    const x = roll() * stageWidth;
    list.push({ x, y, s: 3 + ((y - horizon) / (stageHeight - horizon)) * 6 });
  }
  tuftCache.set(scene, list);
  return list;
}

export function sceneById(id: string): Scene {
  if (id === 'sidewalk') {
    return scenes.sidewalk;
  }
  return sceneList.find((scene) => scene.id === id) ?? scenes.livingroom;
}

const noLitterCache = new WeakMap<Scene, Scene>();

function hasLitter(scene: Scene): boolean {
  return scene.props.some((prop) => prop.kind === 'litterbox') || scene.pois.some((poi) => poi.type === 'litter');
}

// No home keeps a litter box. Drop one if a scene still lists it.
// A species-limited scene (the catio) falls back to the living room for the other species.
export function sceneForSpecies(scene: Scene, species: 'dog' | 'cat'): Scene {
  if (scene.species && scene.species !== species) {
    return sceneForSpecies(scenes.livingroom, species);
  }
  if (!hasLitter(scene)) {
    return scene;
  }
  const cached = noLitterCache.get(scene);
  if (cached) {
    return cached;
  }
  const next: Scene = {
    ...scene,
    props: scene.props.filter((prop) => prop.kind !== 'litterbox'),
    pois: scene.pois.filter((poi) => poi.type !== 'litter'),
  };
  noLitterCache.set(scene, next);
  return next;
}

export function poiOf(scene: Scene, type: string): Poi | null {
  return scene.pois.find((poi) => poi.type === type) ?? null;
}

// The closest spot of a type, so a scene with two bowls sends the pet to the nearer one.
export function nearestPoi(scene: Scene, type: string, from: { x: number; y: number }): Poi | null {
  let best: Poi | null = null;
  let bestDistance = Infinity;
  for (const poi of scene.pois) {
    if (poi.type === type) {
      const distance = Math.hypot(poi.x - from.x, poi.y - from.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = poi;
      }
    }
  }
  return best;
}

export function hasRefillableWaterBowl(scene: Scene): boolean {
  return scene.props.some((prop) => prop.kind === 'bowl' && prop.contents === 'water');
}

function hasFoodBowl(scene: Scene): boolean {
  return (
    poiOf(scene, 'food') != null || scene.props.some((prop) => prop.kind === 'bowl' && prop.contents !== 'water')
  );
}

export function actionEnabled(
  scene: Scene,
  action: 'feed' | 'drink' | 'refillWater' | 'rest',
  waterLevel = 1,
): boolean {
  if (action === 'feed') {
    return hasFoodBowl(scene);
  }
  if (action === 'drink') {
    return poiOf(scene, 'water') != null;
  }
  if (action === 'refillWater') {
    return hasRefillableWaterBowl(scene) && waterLevel < 1;
  }
  // Sleep walks to a bed when the scene has one and otherwise sleeps where the pet stands.
  return true;
}

export function actionReason(
  scene: Scene,
  action: 'feed' | 'drink' | 'refillWater' | 'rest',
  waterLevel = 1,
): string {
  if (actionEnabled(scene, action, waterLevel)) {
    return '';
  }
  if (action === 'feed') {
    return 'There is no food bowl in this scene.';
  }
  if (action === 'refillWater') {
    if (!hasRefillableWaterBowl(scene)) {
      return 'There is no water bowl to refill here.';
    }
    return 'The water bowl is already full.';
  }
  return 'There is no water in this scene.';
}
