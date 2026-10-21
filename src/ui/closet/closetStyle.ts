import type { OutfitSlot } from '../../sim/types';

export const closet = {
  page: '#F7EEDF',
  ink: '#3B2A1E',
  accent: '#2F7D5B',
  accentDark: '#1F5C42',
  mirror: { frame: '#9B6B3F', frameWidth: 8, wall: '#F6E6CF', floor: '#E5C9A0', rug: '#D99A84', rugInner: '#E7B3A0' },
  status: { text: '#6A4E33', buttonBg: '#FFF8EC', buttonBorder: '#C9A97C' },
  scroll: { bg: '#DCC199', topBorder: '#9B6B3F' },
  section: { bg: '#F1E0C4', border: '#C9A97C' },
  plate: { bg: '#F2D58A', border: '#B8913A', text: '#5A4210' },
  wood: { plank: '#B07D4A', edge: '#85592F' },
  rod: { bar: '#A6A6AC', edge: '#77777D' },
  tray: { bg: '#8C4A5A', border: '#6B3343', tile: '#A65E70', label: '#FFF4F6' },
  tile: { label: '#4A3320', selectedBg: '#FFF8EC', ledge: '#C9A97C' },
};

// How each slot is stored. `cols` is tiles per row.
export const storage: Record<
  OutfitSlot,
  { title: string; kind: 'shelf' | 'tray' | 'rail' | 'rod' | 'rack'; cols: number }
> = {
  hat: { title: 'Hats', kind: 'shelf', cols: 5 },
  glasses: { title: 'Glasses', kind: 'tray', cols: 3 },
  neckwear: { title: 'Neckwear', kind: 'rail', cols: 3 },
  jacket: { title: 'Jackets', kind: 'rod', cols: 4 },
  boots: { title: 'Boots', kind: 'rack', cols: 3 },
};
