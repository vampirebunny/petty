import { coatStyles } from '../../src/actor/breeds';

// The only colors a generated item may use. Themes reference swatches by name, never raw hex,
// so the whole catalog stays in one look and a swatch can be retuned everywhere at once.

export const PALETTE = {
  // pinks and reds
  strawberry: '#FF8CC4',
  bubblegum: '#FFB3D6',
  rose: '#E85A8C',
  berry: '#C2407A',
  cherry: '#E0526A',
  // oranges and yellows
  peach: '#FFB89A',
  coral: '#FF7F6B',
  tangerine: '#F28C28',
  butter: '#FFE16B',
  sunflower: '#FFC93C',
  mustard: '#D9A43A',
  rust: '#C4643A',
  // greens
  pistachio: '#A8DB8F',
  mint: '#7FE3BA',
  sage: '#8FB89A',
  forest: '#2F7A5A',
  // blues
  aqua: '#6FD6D9',
  sky: '#7EC8F5',
  cornflower: '#5AA9E6',
  periwinkle: '#9AA8F5',
  navy: '#2B3A6B',
  // purples
  lavender: '#D9CCFF',
  lilac: '#B9A2F5',
  grape: '#7A4FC4',
  midnight: '#2B1F4A',
  // neutrals
  cream: '#FFF6E6',
  snow: '#F7F7FA',
  oat: '#E8D9C0',
  cocoa: '#6B4532',
  espresso: '#3B2A1E',
  charcoal: '#33333B',
  // metals
  gold: '#E0B43C',
  silver: '#C8CDD6',
} as const;

export type Swatch = keyof typeof PALETTE;

export function hex(s: Swatch): string {
  return PALETTE[s];
}

// Every adoption coat, both species. Pointed styles also sample the dark points.
function furSamples(): Record<string, string> {
  const samples: Record<string, string> = {};
  for (const species of ['dog', 'cat'] as const) {
    for (const style of coatStyles[species]) {
      samples[style.id] = style.coat;
      if (style.accent) {
        samples[`${style.id}-points`] = style.accent;
      }
    }
  }
  return samples;
}

export const FUR_SAMPLES: Record<string, string> = furSamples();
