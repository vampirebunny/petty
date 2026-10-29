import { Image, type ImageSourcePropType } from 'react-native';
import { Skia, type SkImage } from '@shopify/react-native-skia';
import {
  chestArt,
  cubeArt,
  parkFindColorArt,
  parkFindSilhouetteArt,
  type ParkFindArtSize,
} from './artMap';

const cache = new Map<string, SkImage | null>();
const inflight = new Map<string, Promise<SkImage | null>>();

async function decode(source: ImageSourcePropType, key: string): Promise<SkImage | null> {
  if (cache.has(key)) {
    return cache.get(key) ?? null;
  }
  const existing = inflight.get(key);
  if (existing) {
    return existing;
  }
  const work = (async () => {
    try {
      const resolved = Image.resolveAssetSource(source);
      if (!resolved?.uri) {
        cache.set(key, null);
        return null;
      }
      const response = await fetch(resolved.uri);
      const buffer = await response.arrayBuffer();
      const data = Skia.Data.fromBytes(new Uint8Array(buffer));
      const image = Skia.Image.MakeImageFromEncoded(data);
      cache.set(key, image);
      return image;
    } catch {
      cache.set(key, null);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, work);
  return work;
}

export function preloadParkFindArt(artKey: string, size: ParkFindArtSize = '2x'): void {
  const color = parkFindColorArt(artKey, size);
  const sil = parkFindSilhouetteArt(artKey, size);
  if (color) void decode(color, `c:${artKey}:${size}`);
  if (sil) void decode(sil, `s:${artKey}:${size}`);
}

export function parkFindSkiaImage(
  artKey: string,
  opts: { silhouette?: boolean; size?: ParkFindArtSize } = {},
): SkImage | null {
  const size = opts.size ?? '2x';
  const key = `${opts.silhouette ? 's' : 'c'}:${artKey}:${size}`;
  if (cache.has(key)) {
    return cache.get(key) ?? null;
  }
  const source = opts.silhouette
    ? parkFindSilhouetteArt(artKey, size)
    : parkFindColorArt(artKey, size);
  if (source) {
    void decode(source, key);
  }
  return null;
}

export function cubeSkia(layer: 'back' | 'front'): SkImage | null {
  const key = `cube:${layer}`;
  if (cache.has(key)) {
    return cache.get(key) ?? null;
  }
  const source = layer === 'back' ? cubeArt.back2x : cubeArt.front2x;
  void decode(source, key);
  return null;
}

export function chestSkia(): SkImage | null {
  const key = 'chest';
  if (cache.has(key)) {
    return cache.get(key) ?? null;
  }
  void decode(chestArt.closed2x, key);
  return null;
}

export function warmParkFindArtCache(): void {
  void decode(cubeArt.back2x, 'cube:back');
  void decode(cubeArt.front2x, 'cube:front');
  void decode(chestArt.closed2x, 'chest');
}
