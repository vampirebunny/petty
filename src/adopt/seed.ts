// The adoption seed is created once per adoption and then persisted before any attribute set is
// shown. It is the one place that needs fresh entropy, so it lives here and not in generation:
// everything derived from the seed (the three offered sets) is a pure function of it.
export function newSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
