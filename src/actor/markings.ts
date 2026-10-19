import { mixHexColor } from './color';
import type { Breed, ColorRule, MarkingRegion, MarkingShape, ResolvedMarking } from './types';

// The user palette fills a region's slot. Locked regions ignore it.
export function ruleColor(rule: ColorRule, coat: string, accent?: string, pattern?: string, intensity = 1): string {
  switch (rule.mode) {
    case 'locked':
      return rule.color;
    case 'base':
      return coat;
    case 'tint':
      return mixHexColor(coat, '#ffffff', rule.amount * intensity);
    case 'shade':
      return mixHexColor(coat, '#000000', rule.amount * intensity);
    case 'points':
      return pattern === 'points' && accent ? accent : mixHexColor(coat, '#000000', rule.amount * intensity);
  }
}

// Concrete colors for a breed's regions, given the coat on the (already look-resolved) breed.
export function resolveMarkings(breed: Pick<Breed, 'coat' | 'accent' | 'pattern' | 'markings' | 'markingIntensity'>): ResolvedMarking[] {
  return breed.markings
    .filter((region: MarkingRegion) => region.when == null || region.when === breed.pattern)
    .map((region: MarkingRegion) => ({
    name: region.name,
    shape: region.shape,
    where: region.where,
    color: ruleColor(region.color, breed.coat, breed.accent, breed.pattern, breed.markingIntensity ?? 1),
    locked: region.color.mode === 'locked',
  }));
}

// The body color. Usually the user's color; breeds with a baseRule derive it (a Siamese body is a pale tint
// of its point color).
export function baseColorOf(breed: Pick<Breed, 'coat' | 'accent' | 'pattern' | 'baseRule'>): string {
  return breed.baseRule ? ruleColor(breed.baseRule, breed.coat, breed.accent, breed.pattern) : breed.coat;
}

export function markingOf(markings: readonly ResolvedMarking[], shape: MarkingShape): ResolvedMarking | undefined {
  return markings.find((marking) => marking.shape === shape);
}
