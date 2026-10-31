import type { RunwayThemeId } from '../../runway/catalog';

export const themeBands: Record<RunwayThemeId, { band: string; eyebrow: string; name: string }> = {
  space: { band: '#4B3B7A', eyebrow: '#D3CEFF', name: '#FFFFFF' },
  sea: { band: '#2C5A8A', eyebrow: '#CFE6FA', name: '#FFFFFF' },
  royal: { band: '#5C4A92', eyebrow: '#E3DBFF', name: '#FFFFFF' },
  beach: { band: '#F0CF9A', eyebrow: '#5E4424', name: '#3B2A14' },
  winter: { band: '#3F6690', eyebrow: '#DDF0FF', name: '#FFFFFF' },
  rock: { band: '#1A1533', eyebrow: '#F7A9C9', name: '#FFFFFF' },
  garden: { band: '#387A52', eyebrow: '#DFF6E7', name: '#FFFFFF' },
  spooky: { band: '#251C4A', eyebrow: '#FFAD7A', name: '#FFFFFF' },
  west: { band: '#6E4630', eyebrow: '#FFD3B5', name: '#FFFFFF' },
  hero: { band: '#2E2458', eyebrow: '#FFD45E', name: '#FFFFFF' },
  pirate: { band: '#1E3F66', eyebrow: '#FFE9A8', name: '#FFFFFF' },
  safari: { band: '#6B5222', eyebrow: '#FFE9A8', name: '#FFFFFF' },
};
