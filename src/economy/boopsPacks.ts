export type BoopsPack = {
  productId: string;
  artKey: string;
  boops: number;
  tag: string | null;
  sortOrder: number;
};

// Local stand-in until the boops_packs table (including art_key) ships with purchases.
export const boopsPacks: BoopsPack[] = [
  { productId: 'boops_600', artKey: 'boops_600', boops: 600, tag: null, sortOrder: 1 },
  { productId: 'boops_2000', artKey: 'boops_2000', boops: 2000, tag: null, sortOrder: 2 },
  { productId: 'boops_3500', artKey: 'boops_3500', boops: 3500, tag: 'Popular', sortOrder: 3 },
  { productId: 'boops_7500', artKey: 'boops_7500', boops: 7500, tag: null, sortOrder: 4 },
  { productId: 'boops_16000', artKey: 'boops_16000', boops: 16000, tag: null, sortOrder: 5 },
  { productId: 'boops_45000', artKey: 'boops_45000', boops: 45000, tag: 'Best value', sortOrder: 6 },
];
