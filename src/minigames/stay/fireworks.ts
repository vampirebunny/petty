type RGB = readonly [number, number, number];

export const fireworkColors: RGB[] = [
  [1, 0.83, 0.42],
  [1, 0.44, 0.68],
  [0.72, 0.64, 1],
  [0.48, 0.84, 1],
  [1, 0.62, 0.78],
  [1, 0.96, 0.78],
];

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: number;
  on: boolean;
};

type Rocket = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  explodeAt: number;
  gone: boolean;
  color: number;
  sparks: Spark[];
};

export type FireworkShow = {
  t: number;
  rockets: Rocket[];
  done: boolean;
};

function roll(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function createShow(width: number, height: number, seed: number): FireworkShow {
  const next = roll(seed || 1);
  const rockets: Rocket[] = [];
  for (let i = 0; i < 5; i += 1) {
    const explodeAt = 0.22 + i * 0.2 + next() * 0.1;
    const distance = height * (0.32 + next() * 0.28);
    const x = width * (0.16 + next() * 0.68);
    const sparks: Spark[] = [];
    const color = i % fireworkColors.length;
    for (let s = 0; s < 26; s += 1) {
      const angle = (s / 26) * Math.PI * 2 + next() * 0.18;
      const speed = 70 + next() * 150;
      sparks.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: 0.85 + next() * 0.4,
        size: 2 + next() * 2.4,
        color: next() < 0.25 ? (color + 1) % fireworkColors.length : color,
        on: false,
      });
    }
    rockets.push({
      x,
      y: height + 6,
      vx: (next() - 0.5) * width * 0.12,
      vy: -distance / explodeAt,
      explodeAt,
      gone: false,
      color,
      sparks,
    });
  }
  return { t: 0, rockets, done: false };
}

export function stepShow(show: FireworkShow, dt: number): void {
  if (show.done) {
    return;
  }
  const step = Math.min(0.05, Math.max(0, dt));
  show.t += step;
  let live = false;
  for (const rocket of show.rockets) {
    if (!rocket.gone) {
      live = true;
      rocket.x += rocket.vx * step;
      rocket.y += rocket.vy * step;
      if (show.t >= rocket.explodeAt) {
        rocket.gone = true;
        for (const spark of rocket.sparks) {
          spark.x = rocket.x;
          spark.y = rocket.y;
          spark.on = true;
        }
      }
    }
    for (const spark of rocket.sparks) {
      if (!spark.on || spark.age >= spark.life) {
        continue;
      }
      live = true;
      spark.age += step;
      spark.x += spark.vx * step;
      spark.y += spark.vy * step;
      spark.vy += 460 * step;
      spark.vx *= Math.exp(-0.55 * step);
    }
  }
  if (!live) {
    show.done = true;
  }
}
