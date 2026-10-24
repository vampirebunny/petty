export const KNOWN_TREAT_ART = ['bone', 'fish', 'cookie', 'cookie_center', 'chew_stick', 'can', 'steak', 'bowl'] as const;

export type TreatArtTemplate = (typeof KNOWN_TREAT_ART)[number];

export const KNOWN_REACTIONS = ['wag_burst', 'hop', 'spin', 'purr_headbump'] as const;

export type TreatArt = { template: TreatArtTemplate; c: string; d?: string };

const bundledTreatArt: Record<string, TreatArt> = {
  treat_jerky: { template: 'chew_stick', c: '#C9842F', d: '#8A5A32' },
  treat_tuna: { template: 'can', c: '#E7B15A', d: '#C45B6E' },
  food_fish: { template: 'fish', c: '#E8A87C', d: '#C46B4A' },
  food_steak: { template: 'steak', c: '#8C3A2F', d: '#E7B15A' },
  food_gourmet: { template: 'bowl', c: '#F4E2C4', d: '#C45B6E' },
};

const extraTreatArt = new Map<string, TreatArt>();

export function setExtraTreatArt(id: string, art: TreatArt | null): void {
  if (art) {
    extraTreatArt.set(id, art);
  } else {
    extraTreatArt.delete(id);
  }
}

export function clearExtraTreatArt(): void {
  extraTreatArt.clear();
}

export function treatArtFor(id: string): TreatArt | null {
  return bundledTreatArt[id] ?? extraTreatArt.get(id) ?? null;
}

export function treatTemplateFor(id: string, species: 'dog' | 'cat' | null = null): TreatArtTemplate {
  if (id === 'biscuit' && species === 'cat') {
    return 'fish';
  }
  if (id === 'biscuit') {
    return 'bone';
  }
  if (id === 'special') {
    return 'cookie_center';
  }
  return treatArtFor(id)?.template ?? 'cookie';
}
