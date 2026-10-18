import type { Scene, SceneTime } from './scenes';
import type { Rgba, TimeOfDay } from './timeOfDay';

export const lighting = {
  actorTint: { indoor: 0.35, outdoor: 0.85, fixed: 0 },
  indoorAlphaCap: 0.35,
  petLight: {
    radius: 92,
    strength: 0.62,
    color: [255, 196, 100] as [number, number, number],
    darkAbove: 0.5,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(t: number): number {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
}

export function defaultActorTint(time: SceneTime): number {
  return lighting.actorTint[time];
}

export function sceneryTint(scene: Scene, tod: TimeOfDay): Rgba {
  if (scene.time === 'fixed') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  if (scene.time === 'outdoor') {
    return { ...tod.tintChannels };
  }
  return { ...tod.inTintChannels, a: Math.min(tod.inTintChannels.a, lighting.indoorAlphaCap) };
}

export function actorTint(scene: Scene, tod: TimeOfDay): Rgba {
  const tint = sceneryTint(scene, tod);
  return { ...tint, a: tint.a * scene.lighting.actorTint };
}

export function petLightAmount(dark: number): number {
  const { strength, darkAbove } = lighting.petLight;
  const span = 1 - darkAbove;
  const rise = span <= 0 ? (dark > darkAbove ? 1 : 0) : (dark - darkAbove) / span;
  return strength * dark * smoothstep(rise);
}

function channel(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function linear(value: number): number {
  const unit = value / 255;
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

export function blendTint(color: string, tint: Rgba): { r: number; g: number; b: number } {
  const [r, g, b] = channel(color);
  const alpha = clamp(tint.a, 0, 1);
  return {
    r: r * (1 - alpha) + tint.r * alpha,
    g: g * (1 - alpha) + tint.g * alpha,
    b: b * (1 - alpha) + tint.b * alpha,
  };
}

export function luminance(color: { r: number; g: number; b: number }): number {
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

export function petLuminance(coat: string, scene: Scene, tod: TimeOfDay): number {
  return luminance(blendTint(coat, actorTint(scene, tod)));
}
