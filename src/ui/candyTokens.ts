// Shared cotton-candy colors and sizes for the home action panel, coins, and tooltips.

export const needThreshold = 30;

export type CandyFlavorName = 'care' | 'bond' | 'style' | 'trick' | 'sugar' | 'muted';

export type CandyFlavor = {
  stops: [string, string, string, string];
  ledge: string;
  icon: string;
  label: string;
  header: string;
  bubble: string;
  edge: string;
  gloss: boolean;
};

export const candyFlavors: Record<CandyFlavorName, CandyFlavor> = {
  care: {
    stops: ['#FFF2F8', '#FFC4DF', '#FF92C4', '#EF68A7'],
    ledge: '#D65F98',
    icon: '#E0468E',
    label: '#6E1846',
    header: '#C2256F',
    bubble: '#FFE0EE',
    edge: '#EF68A7',
    gloss: true,
  },
  bond: {
    stops: ['#F4FAFF', '#C2E3FF', '#88C4FB', '#5CA3EA'],
    ledge: '#4D90D6',
    icon: '#2A7CD1',
    label: '#173D66',
    header: '#2A6FB8',
    bubble: '#DEEEFF',
    edge: '#5CA3EA',
    gloss: true,
  },
  style: {
    stops: ['#FAF6FF', '#DDCCFF', '#B994FF', '#9A70EE'],
    ledge: '#8660DC',
    icon: '#7B4FD6',
    label: '#3A1F73',
    header: '#6A3FC7',
    bubble: '#ECE2FF',
    edge: '#9A70EE',
    gloss: true,
  },
  trick: {
    stops: ['#F4FFF8', '#C9F6DE', '#86E4B8', '#45C992'],
    ledge: '#2EAE7A',
    icon: '#1B9466',
    label: '#14543C',
    header: '#17875C',
    bubble: '#E4F8EE',
    edge: '#45C992',
    gloss: true,
  },
  sugar: {
    stops: ['#FFFFFF', '#F7F5FA', '#F3F0F6', '#ECE8F2'],
    ledge: '#D9D4E3',
    icon: '#9B95A8',
    label: '#5C5670',
    header: '#6E6880',
    bubble: '#F7F4FA',
    edge: '#ECE8F2',
    gloss: false,
  },
  muted: {
    stops: ['#F6F6F9', '#ECECF1', '#E0E0E8', '#D2D2DC'],
    ledge: '#B7B7C4',
    icon: '#9A9AA8',
    label: '#55556A',
    header: '#55556A',
    bubble: '#F3F3F6',
    edge: '#C8C8D2',
    gloss: false,
  },
};

export const candyLayout = {
  tileHeight: 104,
  pillHeight: 56,
  tileRadius: 30,
  coin: 72,
  gap: 10,
  sectionGap: 22,
  headerGap: 10,
  ledge: 7,
  pillLedge: 6,
  sink: 4,
  pressedLedge: 3,
  bubble: 46,
  pillBubble: 40,
  coinBubble: 40,
  icon: 26,
  pillIcon: 22,
  label: 15,
  header: 17,
} as const;

export const switchTrack = {
  width: 42,
  height: 24,
  knob: 18,
  on: ['#FF9FCC', '#B994FF'] as const,
  off: '#ECE4FB',
};

export const needBadge = {
  fill: '#C2256F',
  shadow: '#8E184F',
  halo: '#FF8CC0',
  sparkYellow: '#FFD34D',
  sparkBlue: '#9FD0FF',
};

export const panelWash = ['#FFF3FA', '#F6F0FF', '#EEF7FF'] as const;

export const sprinkleColors = ['#FF9FCC', '#88C4FB', '#B994FF', '#FFD34D', '#9BE7C4'] as const;
