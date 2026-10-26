import { boopsPacks } from '../../../economy/boopsPacks';
import { packArtHeight, packArtXml, preparePackArt, splitSparkles, suffixSvgIds } from '../packDrawing';

const keys = ['boops_600', 'boops_2000', 'boops_3500', 'boops_7500', 'boops_16000', 'boops_45000'];

it('resolves art from art_key and ignores an unknown key', () => {
  expect(boopsPacks.map((pack) => pack.artKey)).toEqual(keys);
  for (const pack of boopsPacks) {
    expect(pack.artKey).toBe(pack.productId);
    expect(preparePackArt(pack.artKey, 'i1')).not.toBeNull();
  }
  expect(preparePackArt('boops_missing', 'i1')).toBeNull();
  expect(packArtXml('nope')).toBeNull();
});

it('splits sparkles out of each pack file and keeps the rest of the drawing', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as { readFileSync(path: string, encoding: 'utf8'): string };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as { join(...parts: string[]): string };
  for (const key of keys) {
    const file = fs.readFileSync(path.join('assets/boops-packs', `${key}.svg`), 'utf8').trim();
    expect(packArtXml(key)).toBe(file);
    const { body, sparkles } = splitSparkles(file);
    expect(sparkles.length).toBeGreaterThan(0);
    expect(body).not.toContain('class="sparkle"');
    expect(body).toContain('viewBox="0 0 120 100"');
    for (const sparkle of sparkles) {
      expect(sparkle.d.startsWith('M0 -6')).toBe(true);
      expect(sparkle.fill.length).toBeGreaterThan(0);
    }
  }
  expect(packArtHeight(84)).toBe(70);
});

it('suffixes gradient ids so two copies of one pack can share a screen', () => {
  const xml = packArtXml('boops_600');
  expect(xml).not.toBeNull();
  const once = suffixSvgIds(xml ?? '', 'A');
  const twice = suffixSvgIds(xml ?? '', 'B');
  expect(once).toContain('id="a-faceA"');
  expect(once).toContain('url(#a-faceA)');
  expect(once).toContain('href="#a-coinA"');
  expect(twice).toContain('id="a-faceB"');
  expect(once).not.toContain('id="a-face"');
});
