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
  tile: { label: '#4A3320', selectedBg: '#FFF8EC', ledge: '#C9A97C' },
};

// Every category uses the same count, so a hat button is as wide as a jacket or a pair of glasses.
export const tileColumns = 3;

export const storage: Record<OutfitSlot, { title: string }> = {
  hat: { title: 'Hats' },
  glasses: { title: 'Glasses' },
  neckwear: { title: 'Neckwear' },
  jacket: { title: 'Jackets' },
  boots: { title: 'Boots' },
};
