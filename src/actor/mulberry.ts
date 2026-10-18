export function mulberry(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedOf(text: string): number {
  let seed = 7;
  for (let i = 0; i < text.length; i += 1) {
    seed = (Math.imul(seed, 31) + text.charCodeAt(i)) | 0;
  }
  return seed;
}
