export const ui = {
  bg: '#F4F2FA',
  card: '#FFFFFF',
  cardSheenBottom: '#F3EFFA',
  cardEdge: '#DAD2EC',
  ink: '#2B2340',
  inkMuted: '#6E6684',
  disabledBg: '#EEEBF5',
  disabledInk: '#5E5675',
  segmentTrack: '#E7E2F2',
  scrim: 'rgba(43,35,64,0.45)',
  stage: '#ECE7F7',
  floor: '#DCD4EE',
  takeOff: '#5A3DBA',
  shopDash: '#CFC6E4',
  taken: '#8C84A0',
  glossPink: '#FDEAF1',
  modalSheen: '#F6F2FC',
  modalEdge: '#D6CCEA',
  itemRow: '#F1ECFA',

  primary: { top: '#EE6F98', bottom: '#D6406F', edge: '#A92D55' },
  equipped: { main: '#1F8A84', edge: '#9ED3CF', text: '#17635E', tabEdge: '#BFE3E0' },
  trainPill: { top: '#8C6EE6', bottom: '#6E4FD0', edge: '#4E34A6' },

  accent: {
    care: { main: '#D6406F', tint: '#FBE3EB' },
    bond: { main: '#2F6FD6', tint: '#E1ECFB' },
    train: { main: '#6E4FD0', tint: '#ECE6FA' },
    style: { main: '#1F7A74', tint: '#DFF2F0' },
  },

  stat: {
    tummy: { fill: '#E8803A', track: '#F1ECE6', label: '#B8501A' },
    water: { fill: '#3FA39C', track: '#E3F0EF', label: '#1F7A74' },
    energy: { fill: '#D4A22E', track: '#F4EEDD', label: '#8A6410' },
    mood: { fill: '#E2638F', track: '#F6E4EB', label: '#C03A68' },
  },

  radius: { card: 24, tile: 22, pill: 999, modal: 32 },
  space: { gutter: 16, gap: 12 },
} as const;

export type RefreshAccent = keyof typeof ui.accent;
