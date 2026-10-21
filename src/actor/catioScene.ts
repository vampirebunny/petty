import { lighting } from './lighting';
import type { Prop, Scene } from './scenes';

// The catio: a screened, roofed porch for cats. Outdoor sky and weather, but the roof keeps the
// rain and snow off the deck (it falls beyond the mesh and drips from the roof edge).
//
// The back wall is taller than the other rooms so the garden reads behind the mesh. Pets walk
// the deck in front of that wall.

export function createCatioScene(stageWidth: number, stageHeight: number): Scene {
  const horizon = Math.round(stageHeight * 0.46);
  const roofY = Math.round(horizon * 0.2);
  const bowlX = stageWidth * 0.62;
  const bowlY = stageHeight - 70;

  const props: Prop[] = [
    // Back: the garden beyond the mesh, then the screen itself (mesh, posts, roof, beam).
    { kind: 'garden', x: stageWidth / 2, y: horizon - 2, w: stageWidth, layer: 'back' },
    { kind: 'catioScreen', x: stageWidth / 2, y: horizon, w: stageWidth, h: horizon - roofY, layer: 'back' },
    // Wall shelves on the posts, for climbing and lookout.
    { kind: 'shelf', x: stageWidth / 3, y: horizon * 0.56, w: 64, layer: 'back' },
    { kind: 'shelf', x: (stageWidth * 2) / 3, y: horizon * 0.38, w: 64, layer: 'back' },
    // Deck furniture.
    { kind: 'catTree', x: stageWidth * 0.8, y: horizon + 70 },
    { kind: 'planter', x: stageWidth * 0.2, y: horizon + 48, w: 64, plant: 'catgrass' },
    { kind: 'planter', x: stageWidth * 0.42, y: horizon + 40, w: 48, plant: 'flowers' },
    { kind: 'hammock', x: stageWidth * 0.35, y: stageHeight - 120, w: 96 },
    { kind: 'scratcher', x: stageWidth * 0.06, y: stageHeight - 150, h: 74 },
    { kind: 'bowl', x: bowlX, y: bowlY, contents: 'water', color: '#5aa1c9' },
    // Corner posts in front, so it reads as an enclosure.
    { kind: 'catioPost', x: 4, y: stageHeight, h: stageHeight, layer: 'front' },
    { kind: 'catioPost', x: stageWidth - 4, y: stageHeight, h: stageHeight, layer: 'front' },
  ];

  return {
    v: 1,
    id: 'catio',
    name: 'Catio',
    species: 'cat',
    time: 'outdoor',
    shelter: 'roofed',
    roofY,
    sky: ['#9fd1f0', '#e8f4fb'],
    layers: [],
    floor: {
      horizon,
      yMin: horizon + 26,
      yMax: stageHeight - 30,
      xMin: 28,
      xMax: stageWidth - 28,
      color: ['#c49466', '#a97b50'],
      pattern: 'planks',
      lineColor: 'rgba(70,40,20,0.28)',
    },
    surface: { bounce: 0.5, friction: 2.2 },
    props,
    pois: [
      { id: 'water', type: 'water', x: bowlX, y: bowlY, face: 1 },
      { id: 'home', type: 'home', x: stageWidth * 0.5, y: horizon + 80 },
    ],
    lighting: { actorTint: lighting.actorTint.outdoor },
    ambient: {},
  };
}
