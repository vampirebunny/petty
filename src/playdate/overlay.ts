import { springUp } from '../actor/pose';
import { rngFrom } from './rng';

export const emoteIds = ['heart', 'exclaim', 'question', 'sweat', 'sparkle', 'note', 'anger'] as const;
export const fxIds = ['dust', 'skidmarks', 'confetti', 'splash'] as const;

export type EmoteId = (typeof emoteIds)[number];
export type FxId = (typeof fxIds)[number];

const emotePop = 0.25;
const emoteHold = 0.7;
const emoteFade = 0.2;
export const emoteLife = emotePop + emoteHold + emoteFade;

export type OverlayParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  spin: number;
  kind: FxId;
};

export type OverlayBurst = {
  emote: EmoteId | null;
  emoteT: number;
  x: number;
  y: number;
  particles: OverlayParticle[];
};

export function emoteScale(t: number): number {
  if (t >= emotePop) {
    return 1;
  }
  return Math.max(0, springUp(t / emotePop));
}

export function emoteAlpha(t: number): number {
  if (t < emotePop + emoteHold) {
    return 1;
  }
  return Math.max(0, 1 - (t - emotePop - emoteHold) / emoteFade);
}

function isEmote(id: string | undefined): id is EmoteId {
  return emoteIds.some((known) => known === id);
}

function isFx(id: string | undefined): id is FxId {
  return fxIds.some((known) => known === id);
}

function particleLife(kind: FxId): number {
  if (kind === 'dust') {
    return 0.4;
  }
  if (kind === 'skidmarks') {
    return 1.5;
  }
  if (kind === 'confetti') {
    return 1.1;
  }
  return 0.7;
}

function particleCount(kind: FxId): number {
  if (kind === 'dust') {
    return 5;
  }
  if (kind === 'skidmarks') {
    return 4;
  }
  if (kind === 'confetti') {
    return 12;
  }
  return 8;
}

export function burstFor(input: {
  version: number;
  emote?: string;
  fx?: string;
  seed: number;
  actor: 'A' | 'B';
  beatT: number;
  x: number;
  y: number;
  reduced: boolean;
}): OverlayBurst | null {
  if (input.version < 2) {
    return null;
  }
  const emote = isEmote(input.emote) ? input.emote : null;
  const fx = isFx(input.fx) ? input.fx : null;
  if (!emote && !fx) {
    return null;
  }
  const particles: OverlayParticle[] = [];
  if (fx) {
    const rng = rngFrom(input.seed, input.beatT, input.actor, fx);
    const life = particleLife(fx);
    const count = input.reduced ? Math.min(6, particleCount(fx)) : particleCount(fx);
    for (let i = 0; i < count; i += 1) {
      const angle = rng() * Math.PI * 2;
      const speed = fx === 'skidmarks' ? 8 + rng() * 10 : 24 + rng() * (fx === 'dust' ? 36 : 90);
      particles.push({
        x: input.x + (rng() - 0.5) * (fx === 'skidmarks' ? 28 : 8),
        y: input.y + (fx === 'skidmarks' ? 18 : (rng() - 0.5) * 8),
        vx: Math.cos(angle) * speed * (fx === 'skidmarks' ? 0.15 : 1),
        vy: fx === 'skidmarks' ? 0 : -30 - rng() * (fx === 'splash' ? 110 : 70),
        life,
        age: 0,
        spin: input.reduced || fx !== 'confetti' ? 0 : (rng() - 0.5) * 8,
        kind: fx,
      });
    }
  }
  return { emote, emoteT: 0, x: input.x, y: input.y, particles };
}

export function stepBursts(bursts: readonly OverlayBurst[], dt: number): OverlayBurst[] {
  const next: OverlayBurst[] = [];
  for (const burst of bursts) {
    const emoteT = burst.emoteT + dt;
    const particles = burst.particles.flatMap((bit) => {
      const age = bit.age + dt;
      if (age >= bit.life) {
        return [];
      }
      const fall = bit.kind === 'skidmarks' ? 0 : 90 * dt;
      return [{ ...bit, age, x: bit.x + bit.vx * dt, y: bit.y + bit.vy * dt, vy: bit.vy + fall }];
    });
    const emoteAlive = burst.emote != null && emoteT < emoteLife;
    if (emoteAlive || particles.length > 0) {
      next.push({ ...burst, emoteT, particles });
    }
  }
  return next;
}
