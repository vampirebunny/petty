import { useEffect, useRef } from 'react';

/** Runs the race tick on the display refresh. `dt` is seconds, capped so a hitch does not jump the gait. */
export function useRaceLoop(tick: (dt: number) => void): void {
  const tickRef = useRef(tick);

  useEffect(() => {
    tickRef.current = tick;
  });

  useEffect(() => {
    let alive = true;
    let id = 0;
    let last = 0;
    const loop = (now: number) => {
      if (!alive) return;
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, Math.max(0, now - last) / 1000);
      last = now;
      tickRef.current(dt);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, []);
}
