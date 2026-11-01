import { track } from '../analytics/analytics';
import { calendarDaysBetween, localDay } from '../economy/clock';
import { serverNow } from '../db/accountMeta';
import { mergeShowAwards, readAwardsCache, type CachedAward } from './cache';

export function applyShowAwards(petId: string, bornAt: number, rows: unknown[]): CachedAward[] {
  let known = new Set<string>();
  try {
    known = new Set(readAwardsCache(petId).awards.map((award) => award.definitionId));
  } catch {
    known = new Set();
  }
  const merged = mergeShowAwards(petId, rows);
  const days = calendarDaysBetween(localDay(bornAt), localDay(serverNow()));
  const fresh: CachedAward[] = [];
  for (const award of merged) {
    if (known.has(award.definitionId)) {
      continue;
    }
    known.add(award.definitionId);
    fresh.push(award);
    track('award_granted', { award_id: award.definitionId, days_since_adoption: days });
  }
  return fresh;
}
