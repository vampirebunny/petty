export type FlickVelocity = { vx: number; vy: number; vz: number };

// Map a stage-space flick (pixels/ms-ish from RNGH) into throw velocity.
export function flickToThrow(vx: number, vy: number): FlickVelocity {
  const speed = Math.hypot(vx, vy);
  const scale = Math.min(1.6, Math.max(0.45, speed / 900));
  const dirX = speed > 1 ? vx / speed : 1;
  const dirY = speed > 1 ? vy / speed : 0;
  return {
    vx: dirX * (220 + 180 * scale),
    vy: dirY * (90 + 70 * scale),
    vz: 280 + 120 * scale,
  };
}

export const flickSpeedThreshold = 420;
