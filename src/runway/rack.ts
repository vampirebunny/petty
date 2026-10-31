import { allCostumes, type RunwayCostume } from './catalog';
import { runwayConfig } from './config';

/** Mulberry32 from a string seed (stable across JS runs). */
function rngFromSeed(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

export function soloRackSize(catalogSize = allCostumes().length): number {
  return Math.round(catalogSize * runwayConfig.soloRackShare);
}

/** Seeded shuffle of the full catalog; take the solo share (8 of 23). */
export function soloShowRack(showId: string): RunwayCostume[] {
  const catalog = allCostumes();
  const rng = rngFromSeed(`solo-rack:${showId}`);
  const shuffled = shuffleInPlace([...catalog], rng);
  return shuffled.slice(0, soloRackSize(catalog.length));
}

export function soloShowRackIds(showId: string): string[] {
  return soloShowRack(showId).map((piece) => piece.id);
}

/**
 * Friend drip unlock count from invites_sent_at.
 * Tranche 1 at +5m (8), tranche 2 at +7m (16), tranche 3 at +9m (23).
 */
export function friendUnlockCount(invitesSentAt: number, now: number): number {
  const elapsedMin = (now - invitesSentAt) / 60_000;
  const sizes = runwayConfig.dripTrancheSizes;
  const first = runwayConfig.dripFirstUnlockMin;
  const gap = runwayConfig.dripTrancheGapMin;
  if (elapsedMin < first) {
    return 0;
  }
  if (elapsedMin < first + gap) {
    return sizes[0];
  }
  if (elapsedMin < first + gap * 2) {
    return sizes[0] + sizes[1];
  }
  return sizes[0] + sizes[1] + sizes[2];
}

/** Catalog-order slice of unlocked friend-rack pieces. */
export function friendUnlockedCostumes(invitesSentAt: number, now: number): RunwayCostume[] {
  const count = friendUnlockCount(invitesSentAt, now);
  return allCostumes().slice(0, count);
}

/** Milliseconds until the next friend tranche unlocks (0 if fully unlocked). */
export function friendNextUnlockAt(invitesSentAt: number, now: number): number | null {
  const elapsedMin = (now - invitesSentAt) / 60_000;
  const first = runwayConfig.dripFirstUnlockMin;
  const gap = runwayConfig.dripTrancheGapMin;
  const thresholds = [first, first + gap, first + gap * 2];
  for (const min of thresholds) {
    if (elapsedMin < min) {
      return invitesSentAt + min * 60_000;
    }
  }
  return null;
}

export function minFriendDeadlineAt(createdAt = Date.now()): number {
  return createdAt + runwayConfig.minDeadlineMin * 60_000;
}
