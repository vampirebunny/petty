import { calendarDaysBetween, localDay } from '../economy/clock';
import { gameplayConfig } from './gameplayConfig';
import { grantBadgeXp } from './progress';
import { trackDef } from './tracks';
import type { PetState } from './types';

const metals = ['bronze', 'silver', 'gold'] as const;

const labels: Record<string, string> = {
  'welcome-home': 'Welcome Home',
  'came-back': 'Came Back',
  'good-listener': 'Good Listener',
  'prop-pro': 'Prop Pro',
  'treasure-hunter': 'Treasure Hunter',
  'dressed-up': 'Dressed Up',
  'playmate': 'Playmate',
  'off-to-the-races': 'First Race',
  'blue-ribbon': 'Blue Ribbon',
  'moving-up': 'Moving Up',
  'ribbon-rack-bronze': 'Ribbon Rack · Bronze',
  'ribbon-rack-silver': 'Ribbon Rack · Silver',
  'ribbon-rack-gold': 'Ribbon Rack · Gold',
  'best-friend-streak-bronze': 'Best Friend Streak · Bronze',
  'best-friend-streak-silver': 'Best Friend Streak · Silver',
  'best-friend-streak-gold': 'Best Friend Streak · Gold',
  'devoted-bronze': 'Devoted · Bronze',
  'devoted-silver': 'Devoted · Silver',
  'devoted-gold': 'Devoted · Gold',
  'trick-collector-bronze': 'Trick Collector · Bronze',
  'trick-collector-silver': 'Trick Collector · Silver',
  'trick-collector-gold': 'Trick Collector · Gold',
  'finder-bronze': 'Finder · Bronze',
  'finder-silver': 'Finder · Silver',
  'finder-gold': 'Finder · Gold',
};

export function badgeLabel(id: string): string {
  return labels[id] ?? id;
}

function xpFor(id: string): number {
  if (id.endsWith('-gold')) {
    return gameplayConfig.badges.xp.gold;
  }
  if (id.endsWith('-silver')) {
    return gameplayConfig.badges.xp.silver;
  }
  if (id.endsWith('-bronze')) {
    return gameplayConfig.badges.xp.bronze;
  }
  return gameplayConfig.badges.xp.once;
}

function mastered(state: PetState) {
  return Object.values(state.training ?? {}).flatMap((track) => {
    if (!track?.mastered) {
      return [];
    }
    const def = trackDef(track.id);
    return def ? [def] : [];
  });
}

function wearing(state: PetState): boolean {
  return Object.values(state.equipped ?? {}).some((itemId) => Boolean(itemId));
}

function tiers(prefix: string, value: number, steps: readonly number[]): string[] {
  return steps.flatMap((need, index) => (value >= need ? [`${prefix}-${metals[index]}`] : []));
}

function earnedIds(state: PetState): string[] {
  const ids = ['welcome-home'];
  const today = state.lastOpenedDay ?? '';
  if (today && calendarDaysBetween(localDay(state.bornAt), today) === 1) {
    ids.push('came-back');
  }
  const tricks = mastered(state);
  if (tricks.length > 0) {
    ids.push('good-listener');
  }
  if (tricks.some((def) => def.category === 'advanced')) {
    ids.push('prop-pro');
  }
  const finds = state.parkFinds?.items.length ?? 0;
  if (finds > 0) {
    ids.push('treasure-hunter');
  }
  if (wearing(state)) {
    ids.push('dressed-up');
  }
  if (state.hadPlaydate) {
    ids.push('playmate');
  }
  if (state.races?.entered) {
    ids.push('off-to-the-races');
  }
  const ribbons = state.ribbons ?? [];
  if (ribbons.some((row) => row.place === 1)) {
    ids.push('blue-ribbon');
  }
  if (ribbons.some((row) => row.classId !== 'beginner' && row.classId !== 'veteran')) {
    ids.push('moving-up');
  }
  const won = ribbons.filter((row) => row.place >= 1 && row.place <= 3).length;
  ids.push(...tiers('ribbon-rack', won, gameplayConfig.badges.ribbons));
  ids.push(...tiers('best-friend-streak', state.openedStreak ?? 0, gameplayConfig.badges.streak));
  ids.push(...tiers('devoted', state.openedDays ?? 0, gameplayConfig.badges.devoted));
  ids.push(...tiers('trick-collector', tricks.length, gameplayConfig.badges.tricks));
  ids.push(...tiers('finder', finds, gameplayConfig.badges.finds));
  return ids;
}

// Awards badges the pet has earned. Day counts start at the first check, not at adoption.
// A badge awarded before level 10 records its XP as skipped and never pays it later.
export function syncBadges(state: PetState, now: number): PetState {
  const today = localDay(now);
  const last = state.lastOpenedDay ?? '';
  let openedDays = state.openedDays ?? 0;
  let openedStreak = state.openedStreak ?? 0;
  if (last !== today) {
    openedDays += 1;
    openedStreak = last && calendarDaysBetween(last, today) === 1 ? openedStreak + 1 : 1;
  }
  const counted: PetState = {
    ...state,
    openedDays,
    openedStreak,
    lastOpenedDay: today,
    hadPlaydate: state.hadPlaydate ?? false,
    badges: state.badges ?? [],
    badgeXpSkipped: state.badgeXpSkipped ?? [],
  };
  const fresh = earnedIds(counted).filter((id) => !counted.badges.includes(id));
  const sameDay = last === today;
  const fieldsReady =
    state.badges != null &&
    state.badgeXpSkipped != null &&
    state.openedDays != null &&
    state.openedStreak != null &&
    state.lastOpenedDay != null &&
    state.hadPlaydate != null;
  if (sameDay && fresh.length === 0 && fieldsReady) {
    return state;
  }
  let next: PetState = { ...counted, badges: [...counted.badges, ...fresh] };
  for (const id of fresh) {
    if (next.level < gameplayConfig.tutorialLevel) {
      next = { ...next, badgeXpSkipped: [...next.badgeXpSkipped, id] };
    } else {
      next = grantBadgeXp(next, xpFor(id));
    }
  }
  return next;
}

export function awardedBadgeIds(before: PetState, after: PetState): string[] {
  const had = new Set(before.badges ?? []);
  return (after.badges ?? []).filter((id) => !had.has(id));
}
