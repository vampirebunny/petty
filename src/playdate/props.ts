import type { Beat, BeatProp } from './types';

const throwMs = 500;

export type PropView = {
  kind: BeatProp['kind'];
  holder: 'A' | 'B' | 'both' | null;
  x: number;
  y: number;
  z: number;
};

function pointOf(point: { x: number; y: number } | undefined, fallback: { x: number; y: number }): { x: number; y: number } {
  return point ?? fallback;
}

// The prop on screen is the latest beat that named one. A throw flies for 500ms, then rests at throwTo.
export function propAt(beats: readonly Beat[], elapsed: number): PropView | null {
  let beat: Beat | null = null;
  for (const candidate of beats) {
    if (candidate.t > elapsed) {
      break;
    }
    if (candidate.prop) {
      beat = candidate;
    }
  }
  const prop = beat?.prop;
  if (!beat || !prop) {
    return null;
  }
  if (prop.throwTo) {
    const from = pointOf(prop.at, prop.throwTo);
    const age = elapsed - beat.t;
    if (age < throwMs) {
      const k = Math.max(0, age) / throwMs;
      return {
        kind: prop.kind,
        holder: null,
        x: from.x + (prop.throwTo.x - from.x) * k,
        y: from.y + (prop.throwTo.y - from.y) * k,
        z: Math.sin(k * Math.PI) * 80,
      };
    }
    return { kind: prop.kind, holder: null, x: prop.throwTo.x, y: prop.throwTo.y, z: 0 };
  }
  const holder = prop.holder ?? null;
  const at = pointOf(prop.at, { x: 0, y: 0 });
  return { kind: prop.kind, holder, x: at.x, y: at.y, z: 0 };
}

// The butterfly follows the same stored waypoints as the pet that is chasing it.
export function butterflyAt(beats: readonly Beat[], elapsed: number): { x: number; y: number } | null {
  const marks = beats.filter((beat) => beat.fx === 'butterfly' && beat.params?.x != null && beat.params.y != null);
  if (marks.length === 0) {
    return null;
  }
  const first = marks[0];
  const last = marks[marks.length - 1];
  if (!first || !last || elapsed < first.t || elapsed > last.t + 900) {
    return null;
  }
  let index = 0;
  for (let i = 0; i < marks.length; i += 1) {
    if ((marks[i]?.t ?? 0) <= elapsed) {
      index = i;
    }
  }
  const current = marks[index];
  const previous = marks[index - 1] ?? current;
  if (!current?.params || !previous?.params || current.params.x == null || current.params.y == null || previous.params.x == null || previous.params.y == null) {
    return null;
  }
  const span = Math.max(1, current.t - previous.t);
  const k = index === 0 ? 1 : Math.min(1, (elapsed - previous.t) / span);
  return {
    x: previous.params.x + (current.params.x - previous.params.x) * k,
    y: previous.params.y + (current.params.y - previous.params.y) * k,
  };
}
