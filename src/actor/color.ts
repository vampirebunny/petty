// Small hex colour helpers for logic modules. The Skia renderer has its own `mix` for paints.

function channels(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((ch) => ch + ch).join('') : clean;
  const value = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(value)) {
    return [0, 0, 0];
  }
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
}

export function mixHexColor(from: string, toward: string, amount: number): string {
  const a = channels(from);
  const b = channels(toward);
  return toHex([a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount]);
}

// The pale, desaturated gray a coat frosts toward: the color drained of most of its hue, then pushed to #d9d9d9.
// A very light coat barely changes, a dark or locked one shows a clear gray.
export function frostColorOf(hex: string): string {
  const level = Math.round(luminance(hex) * 255);
  const gray = toHex([level, level, level]);
  return mixHexColor(mixHexColor(hex, gray, 0.6), '#d9d9d9', 0.7);
}

// Relative luminance from 0 (black) to 1 (white).
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
