import { packSvgXml } from './packSvgXml';

export const packArtWidth = 84;
export const packArtBoxHeight = 70;

export type Sparkle = {
  d: string;
  x: number;
  y: number;
  scale: number;
  fill: string;
  stroke: string | null;
  strokeWidth: number | null;
};

const sparkleTag = /<path\b[^>]*\bclass="sparkle"[^>]*\/>/g;

function attr(tag: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag);
  return match ? match[1] : null;
}

export function splitSparkles(xml: string): { body: string; sparkles: Sparkle[] } {
  const sparkles: Sparkle[] = [];
  const body = xml.replace(sparkleTag, (tag) => {
    const transform = attr(tag, 'transform') ?? '';
    const move = /translate\(\s*([-\d.]+)[\s,]+([-\d.]+)\s*\)/.exec(transform);
    const scale = /scale\(\s*([-\d.]+)\s*\)/.exec(transform);
    const width = attr(tag, 'stroke-width');
    sparkles.push({
      d: attr(tag, 'd') ?? '',
      x: move ? Number(move[1]) : 0,
      y: move ? Number(move[2]) : 0,
      scale: scale ? Number(scale[1]) : 1,
      fill: attr(tag, 'fill') ?? '#FFE27A',
      stroke: attr(tag, 'stroke'),
      strokeWidth: width == null ? null : Number(width),
    });
    return '';
  });
  return { body, sparkles };
}

/** Keep gradient and symbol ids unique when the same pack is drawn twice. */
export function suffixSvgIds(xml: string, suffix: string): string {
  if (!suffix) {
    return xml;
  }
  return xml
    .replace(/\bid="([^"]+)"/g, (_, id: string) => `id="${id}${suffix}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#${id}${suffix})`)
    .replace(/\bhref="#([^"]+)"/g, (_, id: string) => `href="#${id}${suffix}"`);
}

export function packArtHeight(width: number): number {
  return width * (100 / 120);
}

export function packArtKeys(): string[] {
  return Object.keys(packSvgXml);
}

export function packArtXml(artKey: string): string | null {
  return packSvgXml[artKey] ?? null;
}

export function preparePackArt(
  artKey: string,
  instanceId: string,
): { body: string; sparkles: Sparkle[] } | null {
  const xml = packSvgXml[artKey];
  if (!xml) {
    return null;
  }
  const split = splitSparkles(xml);
  return { body: suffixSvgIds(split.body, instanceId), sparkles: split.sparkles };
}
