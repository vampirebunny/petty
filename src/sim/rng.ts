export type RngStep = {
  value: number;
  state: number;
};

const multiplier = 1664525;
const increment = 1013904223;
const modulus = 4294967296;

export function nextRng(state: number): RngStep {
  const next = (Math.imul(multiplier, state) + increment) >>> 0;
  return { value: next / modulus, state: next };
}
