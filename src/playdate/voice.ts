import { rngFrom } from './rng';

export type VoiceCue = { t: number; actor: 'A' | 'B' };

// A few barks or meows across the playdate, never at the start or on the closing beat.
export function voiceCues(seed: number, endMs: number): VoiceCue[] {
  const rng = rngFrom(seed, 'voice');
  const count = 2 + Math.floor(rng() * 2);
  const start = 8000;
  const end = Math.max(start + 1000, endMs - 8000);
  const cues: VoiceCue[] = [];
  for (let i = 0; i < count; i += 1) {
    cues.push({
      t: Math.round(start + rng() * (end - start)),
      actor: rng() < 0.5 ? 'A' : 'B',
    });
  }
  cues.sort((a, b) => a.t - b.t);
  return cues;
}
