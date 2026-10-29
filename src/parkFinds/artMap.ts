/* Static require map for park find PNGs. Scale lives in the folder name — Metro treats @2x in paths as asset scales. */
import type { ImageSourcePropType } from 'react-native';

export type ParkFindArtSize = '2x' | '3x';

type ArtEntry = { color2x: ImageSourcePropType; color3x: ImageSourcePropType; silhouette2x: ImageSourcePropType; silhouette3x: ImageSourcePropType };

const finds: Record<string, ArtEntry> = {
  'perfect-stick': {
    color2x: require('../../assets/park-finds/finds-2x/perfect-stick.png'),
    color3x: require('../../assets/park-finds/finds-3x/perfect-stick.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/perfect-stick.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/perfect-stick.png'),
  },
  'tennis-ball': {
    color2x: require('../../assets/park-finds/finds-2x/tennis-ball.png'),
    color3x: require('../../assets/park-finds/finds-3x/tennis-ball.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/tennis-ball.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/tennis-ball.png'),
  },
  'buried-bone': {
    color2x: require('../../assets/park-finds/finds-2x/buried-bone.png'),
    color3x: require('../../assets/park-finds/finds-3x/buried-bone.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/buried-bone.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/buried-bone.png'),
  },
  'rope-toy': {
    color2x: require('../../assets/park-finds/finds-2x/rope-toy.png'),
    color3x: require('../../assets/park-finds/finds-3x/rope-toy.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/rope-toy.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/rope-toy.png'),
  },
  'lost-frisbee': {
    color2x: require('../../assets/park-finds/finds-2x/lost-frisbee.png'),
    color3x: require('../../assets/park-finds/finds-3x/lost-frisbee.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/lost-frisbee.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/lost-frisbee.png'),
  },
  'squeaky-duck': {
    color2x: require('../../assets/park-finds/finds-2x/squeaky-duck.png'),
    color3x: require('../../assets/park-finds/finds-3x/squeaky-duck.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/squeaky-duck.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/squeaky-duck.png'),
  },
  'dinosaur-bone': {
    color2x: require('../../assets/park-finds/finds-2x/dinosaur-bone.png'),
    color3x: require('../../assets/park-finds/finds-3x/dinosaur-bone.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/dinosaur-bone.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/dinosaur-bone.png'),
  },
  'blue-jay-feather': {
    color2x: require('../../assets/park-finds/finds-2x/blue-jay-feather.png'),
    color3x: require('../../assets/park-finds/finds-3x/blue-jay-feather.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/blue-jay-feather.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/blue-jay-feather.png'),
  },
  'toy-mouse': {
    color2x: require('../../assets/park-finds/finds-2x/toy-mouse.png'),
    color3x: require('../../assets/park-finds/finds-3x/toy-mouse.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/toy-mouse.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/toy-mouse.png'),
  },
  'jingle-bell-ball': {
    color2x: require('../../assets/park-finds/finds-2x/jingle-bell-ball.png'),
    color3x: require('../../assets/park-finds/finds-3x/jingle-bell-ball.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/jingle-bell-ball.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/jingle-bell-ball.png'),
  },
  'cats-eye-marble': {
    color2x: require('../../assets/park-finds/finds-2x/cats-eye-marble.png'),
    color3x: require('../../assets/park-finds/finds-3x/cats-eye-marble.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/cats-eye-marble.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/cats-eye-marble.png'),
  },
  'golden-yarn-ball': {
    color2x: require('../../assets/park-finds/finds-2x/golden-yarn-ball.png'),
    color3x: require('../../assets/park-finds/finds-3x/golden-yarn-ball.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/golden-yarn-ball.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/golden-yarn-ball.png'),
  },
  'smooth-pebble': {
    color2x: require('../../assets/park-finds/finds-2x/smooth-pebble.png'),
    color3x: require('../../assets/park-finds/finds-3x/smooth-pebble.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/smooth-pebble.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/smooth-pebble.png'),
  },
  'clover': {
    color2x: require('../../assets/park-finds/finds-2x/clover.png'),
    color3x: require('../../assets/park-finds/finds-3x/clover.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/clover.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/clover.png'),
  },
  'snail-shell': {
    color2x: require('../../assets/park-finds/finds-2x/snail-shell.png'),
    color3x: require('../../assets/park-finds/finds-3x/snail-shell.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/snail-shell.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/snail-shell.png'),
  },
  'heart-shaped-rock': {
    color2x: require('../../assets/park-finds/finds-2x/heart-shaped-rock.png'),
    color3x: require('../../assets/park-finds/finds-3x/heart-shaped-rock.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/heart-shaped-rock.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/heart-shaped-rock.png'),
  },
  'toy-crown': {
    color2x: require('../../assets/park-finds/finds-2x/toy-crown.png'),
    color3x: require('../../assets/park-finds/finds-3x/toy-crown.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/toy-crown.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/toy-crown.png'),
  },
  'tiny-key': {
    color2x: require('../../assets/park-finds/finds-2x/tiny-key.png'),
    color3x: require('../../assets/park-finds/finds-3x/tiny-key.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/tiny-key.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/tiny-key.png'),
  },
  'old-compass': {
    color2x: require('../../assets/park-finds/finds-2x/old-compass.png'),
    color3x: require('../../assets/park-finds/finds-3x/old-compass.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/old-compass.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/old-compass.png'),
  },
  'message-in-a-bottle': {
    color2x: require('../../assets/park-finds/finds-2x/message-in-a-bottle.png'),
    color3x: require('../../assets/park-finds/finds-3x/message-in-a-bottle.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/message-in-a-bottle.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/message-in-a-bottle.png'),
  },
  'dandelion-puff': {
    color2x: require('../../assets/park-finds/finds-2x/dandelion-puff.png'),
    color3x: require('../../assets/park-finds/finds-3x/dandelion-puff.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/dandelion-puff.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/dandelion-puff.png'),
  },
  'cherry-blossom-petal': {
    color2x: require('../../assets/park-finds/finds-2x/cherry-blossom-petal.png'),
    color3x: require('../../assets/park-finds/finds-3x/cherry-blossom-petal.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/cherry-blossom-petal.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/cherry-blossom-petal.png'),
  },
  'four-leaf-clover': {
    color2x: require('../../assets/park-finds/finds-2x/four-leaf-clover.png'),
    color3x: require('../../assets/park-finds/finds-3x/four-leaf-clover.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/four-leaf-clover.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/four-leaf-clover.png'),
  },
  'seashell': {
    color2x: require('../../assets/park-finds/finds-2x/seashell.png'),
    color3x: require('../../assets/park-finds/finds-3x/seashell.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/seashell.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/seashell.png'),
  },
  'sea-glass': {
    color2x: require('../../assets/park-finds/finds-2x/sea-glass.png'),
    color3x: require('../../assets/park-finds/finds-3x/sea-glass.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/sea-glass.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/sea-glass.png'),
  },
  'red-maple-leaf': {
    color2x: require('../../assets/park-finds/finds-2x/red-maple-leaf.png'),
    color3x: require('../../assets/park-finds/finds-3x/red-maple-leaf.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/red-maple-leaf.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/red-maple-leaf.png'),
  },
  'acorn': {
    color2x: require('../../assets/park-finds/finds-2x/acorn.png'),
    color3x: require('../../assets/park-finds/finds-3x/acorn.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/acorn.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/acorn.png'),
  },
  'golden-acorn': {
    color2x: require('../../assets/park-finds/finds-2x/golden-acorn.png'),
    color3x: require('../../assets/park-finds/finds-3x/golden-acorn.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/golden-acorn.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/golden-acorn.png'),
  },
  'pinecone': {
    color2x: require('../../assets/park-finds/finds-2x/pinecone.png'),
    color3x: require('../../assets/park-finds/finds-3x/pinecone.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/pinecone.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/pinecone.png'),
  },
  'holly-sprig': {
    color2x: require('../../assets/park-finds/finds-2x/holly-sprig.png'),
    color3x: require('../../assets/park-finds/finds-3x/holly-sprig.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/holly-sprig.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/holly-sprig.png'),
  },
  'lost-mitten': {
    color2x: require('../../assets/park-finds/finds-2x/lost-mitten.png'),
    color3x: require('../../assets/park-finds/finds-3x/lost-mitten.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/lost-mitten.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/lost-mitten.png'),
  },
  'paper-boat': {
    color2x: require('../../assets/park-finds/finds-2x/paper-boat.png'),
    color3x: require('../../assets/park-finds/finds-3x/paper-boat.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/paper-boat.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/paper-boat.png'),
  },
  'snow-globe': {
    color2x: require('../../assets/park-finds/finds-2x/snow-globe.png'),
    color3x: require('../../assets/park-finds/finds-3x/snow-globe.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/snow-globe.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/snow-globe.png'),
  },
  'rainbow-marble': {
    color2x: require('../../assets/park-finds/finds-2x/rainbow-marble.png'),
    color3x: require('../../assets/park-finds/finds-3x/rainbow-marble.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/rainbow-marble.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/rainbow-marble.png'),
  },
  'dewdrop-gem': {
    color2x: require('../../assets/park-finds/finds-2x/dewdrop-gem.png'),
    color3x: require('../../assets/park-finds/finds-3x/dewdrop-gem.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/dewdrop-gem.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/dewdrop-gem.png'),
  },
  'glow-stone': {
    color2x: require('../../assets/park-finds/finds-2x/glow-stone.png'),
    color3x: require('../../assets/park-finds/finds-3x/glow-stone.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/glow-stone.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/glow-stone.png'),
  },
  'fallen-star': {
    color2x: require('../../assets/park-finds/finds-2x/fallen-star.png'),
    color3x: require('../../assets/park-finds/finds-3x/fallen-star.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/fallen-star.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/fallen-star.png'),
  },
  'moonstone': {
    color2x: require('../../assets/park-finds/finds-2x/moonstone.png'),
    color3x: require('../../assets/park-finds/finds-3x/moonstone.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/moonstone.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/moonstone.png'),
  },
  'heart-locket': {
    color2x: require('../../assets/park-finds/finds-2x/heart-locket.png'),
    color3x: require('../../assets/park-finds/finds-3x/heart-locket.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/heart-locket.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/heart-locket.png'),
  },
  'jack-o-lantern-charm': {
    color2x: require('../../assets/park-finds/finds-2x/jack-o-lantern-charm.png'),
    color3x: require('../../assets/park-finds/finds-3x/jack-o-lantern-charm.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/jack-o-lantern-charm.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/jack-o-lantern-charm.png'),
  },
  'snowflake-ornament': {
    color2x: require('../../assets/park-finds/finds-2x/snowflake-ornament.png'),
    color3x: require('../../assets/park-finds/finds-3x/snowflake-ornament.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/snowflake-ornament.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/snowflake-ornament.png'),
  },
  'party-hat': {
    color2x: require('../../assets/park-finds/finds-2x/party-hat.png'),
    color3x: require('../../assets/park-finds/finds-3x/party-hat.png'),
    silhouette2x: require('../../assets/park-finds/silhouette-2x/party-hat.png'),
    silhouette3x: require('../../assets/park-finds/silhouette-3x/party-hat.png'),
  },
};

export const cubeArt = {
  back2x: require('../../assets/park-finds/cube/cube-back-2x.png'),
  back3x: require('../../assets/park-finds/cube/cube-back-3x.png'),
  front2x: require('../../assets/park-finds/cube/cube-front-2x.png'),
  front3x: require('../../assets/park-finds/cube/cube-front-3x.png'),
} as const;

export const chestArt = {
  closed2x: require('../../assets/park-finds/chest/chest-closed-2x.png'),
  closed3x: require('../../assets/park-finds/chest/chest-closed-3x.png'),
} as const;

export function hasParkFindArt(artKey: string): boolean {
  return artKey in finds;
}

export function parkFindColorArt(artKey: string, size: ParkFindArtSize = '2x'): ImageSourcePropType | null {
  const entry = finds[artKey];
  if (!entry) return null;
  return size === '3x' ? entry.color3x : entry.color2x;
}

export function parkFindSilhouetteArt(artKey: string, size: ParkFindArtSize = '2x'): ImageSourcePropType | null {
  const entry = finds[artKey];
  if (!entry) return null;
  return size === '3x' ? entry.silhouette3x : entry.silhouette2x;
}

export function bundledArtKeys(): string[] {
  return Object.keys(finds);
}
