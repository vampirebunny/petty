import type { CachedAward, CachedDefinition, CachedProgress, ThemeRackPiece, WornPiece } from './cache';
import {
  CAREER_TIERS,
  CLASSED_EVENTS,
  COVER_TIERS,
  FEATS,
  LOOKBOOK_THEMES,
  METAL_TIERS,
  RACE_CLASSES,
  RACE_EVENTS,
  STAMP_KINDS,
  careerId,
  classTrophyId,
  coverId,
  featId,
  friendAwardId,
  lookbookId,
  stampId,
} from './ids';

export const CAREER_THRESHOLDS = [5, 15, 40, 100, 250] as const;
export const CLASS_WINS_NEED = 3;
export const CHAMP_STREAK_NEED = 3;
export const COVER_THRESHOLDS = [5, 15, 40, 100] as const;
export const HOST_THRESHOLDS = [1, 5, 15] as const;
export const CREW_THRESHOLDS = [3, 10, 25] as const;
export const FRONT_THRESHOLDS = [10, 30, 75] as const;
export const LOOKBOOK_BRONZE_KINDS = ['debut'] as const;
export const LOOKBOOK_SILVER_KINDS = ['debut', 'encore', 'party'] as const;
export const LOOKBOOK_GOLD_KINDS = ['debut', 'encore', 'party', 'rack'] as const;

export const CLASS_PILLS = ['beginner', 'novice', 'open', 'expert', 'championship'] as const;

export type LeftoverRibbon = { raceId: string; event: string; classId: string; place: number; at?: number };

export type CaseRibbon = {
  raceId: string;
  event: string;
  classId: string;
  place: number;
  earnedAt: number;
};

export type RibbonGroup = {
  event: string;
  classId: string;
  place: number;
  count: number;
  latestAt: number;
};

export type CareerCard = {
  event: string;
  tier: (typeof CAREER_TIERS)[number] | null;
  wins: number;
  nextTier: (typeof CAREER_TIERS)[number] | null;
  nextNeed: number | null;
};

export type ClassTrophyRow = {
  event: string;
  earned: boolean;
  wins: number;
  need: number;
  locked: boolean;
  unlockClass: string | null;
};

export type FeatRow = {
  id: string;
  feat: (typeof FEATS)[number];
  earned: boolean;
  count: number | null;
  earnedAt: string | null;
  detail: string | null;
};

export type LookbookTierRow = {
  tier: (typeof METAL_TIERS)[number];
  earned: boolean;
  have: number;
  need: number;
};

export type ThemeTile = {
  themeId: (typeof LOOKBOOK_THEMES)[number];
  earned: Record<(typeof STAMP_KINDS)[number], boolean>;
  mainHave: number;
  bonus: boolean;
};

export type CoverRow = {
  tier: (typeof COVER_TIERS)[number];
  earned: boolean;
  have: number;
  need: number;
};

export type FriendRow = {
  kind: 'host' | 'crew' | 'front';
  have: number;
  tiers: { tier: (typeof METAL_TIERS)[number]; earned: boolean; need: number }[];
};

export type TrophySheetKind = 'career' | 'class' | 'feat';

export type TrophySheetModel = {
  kind: TrophySheetKind;
  title: string;
  event?: string;
  classId?: string;
  feat?: string;
  rungs: {
    id: string;
    label: string;
    earned: boolean;
    earnedAt: string | null;
    classId: string | null;
  }[];
  nextLabel: string | null;
  have: number;
  need: number | null;
};

export function progressValue(progress: CachedProgress[], key: string): number {
  return progress.find((row) => row.key === key)?.value ?? 0;
}

export function hasAward(awards: CachedAward[], definitionId: string): boolean {
  return awards.some((award) => award.definitionId === definitionId);
}

export function awardsFor(awards: CachedAward[], definitionId: string): CachedAward[] {
  return awards.filter((award) => award.definitionId === definitionId);
}

export function isRacesEmpty(awards: CachedAward[], leftover: LeftoverRibbon[] = []): boolean {
  if (leftover.some((row) => row.place >= 1 && row.place <= 3 && Boolean(row.raceId))) {
    return false;
  }
  return !awards.some((award) => award.source === 'race' || award.source === 'runway');
}

export function caseRibbons(awards: CachedAward[], leftover: LeftoverRibbon[] = []): CaseRibbon[] {
  const byRace = new Map<string, CaseRibbon>();
  for (const row of leftover) {
    if (!row.raceId || row.place < 1 || row.place > 3) {
      continue;
    }
    byRace.set(row.raceId, {
      raceId: row.raceId,
      event: row.event,
      classId: row.classId,
      place: row.place,
      earnedAt: row.at ?? 0,
    });
  }
  for (const award of awards) {
    if (award.definitionId !== 'ribbon' || !award.raceId || award.placing == null || award.placing < 1 || award.placing > 3) {
      continue;
    }
    const event = text(award.snapshot.event_type ?? award.snapshot.event) ?? '';
    const classId = text(award.snapshot.class ?? award.snapshot.classId) ?? '';
    const prior = byRace.get(award.raceId);
    byRace.set(award.raceId, {
      raceId: award.raceId,
      event: event || prior?.event || '',
      classId: classId || prior?.classId || '',
      place: award.placing,
      earnedAt: Date.parse(award.earnedAt) || prior?.earnedAt || 0,
    });
  }
  return [...byRace.values()];
}

export function raceTotals(awards: CachedAward[], ribbons: CaseRibbon[], progress: CachedProgress[]) {
  const trophies = awards.filter((award) => award.source === 'race' && award.definitionId !== 'ribbon').length;
  const winsFromProgress = RACE_EVENTS.reduce((sum, event) => sum + progressValue(progress, `wins:${event}`), 0);
  const winsFromRibbons = ribbons.filter((row) => row.place === 1).length;
  return {
    trophies,
    ribbons: ribbons.length,
    wins: Math.max(winsFromProgress, winsFromRibbons),
  };
}

export function bestAllRounder(awards: CachedAward[]): { classId: string; earnedAt: string } | null {
  let best: { classId: string; earnedAt: string; rank: number } | null = null;
  for (const cls of RACE_CLASSES) {
    const row = awards.find((award) => award.definitionId === `range_all_rounder_${cls}`);
    if (!row) {
      continue;
    }
    const rank = CLASS_PILLS.indexOf(cls as (typeof CLASS_PILLS)[number]);
    if (!best || rank > best.rank) {
      best = { classId: cls, earnedAt: row.earnedAt, rank };
    }
  }
  return best ? { classId: best.classId, earnedAt: best.earnedAt } : null;
}

export function careerNextTier(wins: number): {
  tier: (typeof CAREER_TIERS)[number] | null;
  nextTier: (typeof CAREER_TIERS)[number] | null;
  nextNeed: number | null;
} {
  let tier: (typeof CAREER_TIERS)[number] | null = null;
  for (let i = 0; i < CAREER_THRESHOLDS.length; i += 1) {
    if (wins >= CAREER_THRESHOLDS[i]) {
      tier = CAREER_TIERS[i];
    } else {
      return { tier, nextTier: CAREER_TIERS[i], nextNeed: CAREER_THRESHOLDS[i] };
    }
  }
  return { tier, nextTier: null, nextNeed: null };
}

export function careerCards(awards: CachedAward[], progress: CachedProgress[]): CareerCard[] {
  return RACE_EVENTS.map((event) => {
    const wins = progressValue(progress, `wins:${event}`);
    const earned = CAREER_TIERS.filter((tier) => hasAward(awards, careerId(event, tier)));
    const highest = earned.at(-1) ?? null;
    const next = careerNextTier(wins);
    return {
      event,
      tier: highest ?? next.tier,
      wins,
      nextTier: next.nextTier,
      nextNeed: next.nextNeed,
    };
  });
}

export function classIndex(cls: string): number {
  return CLASS_PILLS.indexOf(cls as (typeof CLASS_PILLS)[number]);
}

export function classTrophies(
  awards: CachedAward[],
  progress: CachedProgress[],
  selectedClass: string,
  currentClass: string,
): ClassTrophyRow[] {
  const locked = classIndex(selectedClass) > classIndex(currentClass);
  return CLASSED_EVENTS.map((event) => {
    const earned = hasAward(awards, classTrophyId(event, selectedClass));
    const wins =
      selectedClass === 'championship'
        ? progressValue(progress, `champ_streak:${event}`)
        : progressValue(progress, `class_wins:${event}:${selectedClass}`);
    return {
      event,
      earned,
      wins,
      need: selectedClass === 'championship' ? CHAMP_STREAK_NEED : CLASS_WINS_NEED,
      locked,
      unlockClass: locked ? selectedClass : null,
    };
  });
}

const FEAT_DETAIL: Record<(typeof FEATS)[number], string> = {
  flawless: 'Win Championship Hurdles without a miss',
  photo_finish: 'Win by under 0.1 s',
  comeback: 'Win after being last at halfway',
  win_streak: 'Five first places in a row',
  perfect_recall: 'Finish the longest Trick Show without a miss',
  personal_best: 'Beat your own best time',
};

export function personalBestCount(awards: CachedAward[], progress: CachedProgress[]): number {
  const named = progressValue(progress, 'personal_bests') || progressValue(progress, 'feat_personal_best');
  if (named > 0) {
    return named;
  }
  const keys = progress.filter((row) => row.key.startsWith('personal_best:') && row.value > 0).length;
  if (keys > 0) {
    return keys;
  }
  return awardsFor(awards, featId('personal_best')).length;
}

export function featRows(awards: CachedAward[], progress: CachedProgress[]): FeatRow[] {
  return FEATS.map((feat) => {
    const rows = awardsFor(awards, featId(feat));
    const latest = rows[0];
    return {
      id: featId(feat),
      feat,
      earned: rows.length > 0,
      count: feat === 'personal_best' ? personalBestCount(awards, progress) : null,
      earnedAt: latest?.earnedAt ?? null,
      detail: text(latest?.snapshot.detail) ?? FEAT_DETAIL[feat],
    };
  });
}

export function groupRibbons(ribbons: CaseRibbon[]): RibbonGroup[] {
  const groups = new Map<string, RibbonGroup>();
  for (const row of ribbons) {
    const key = `${row.event}|${row.classId}|${row.place}`;
    const prior = groups.get(key);
    if (prior) {
      prior.count += 1;
      prior.latestAt = Math.max(prior.latestAt, row.earnedAt);
      continue;
    }
    groups.set(key, {
      event: row.event,
      classId: row.classId,
      place: row.place,
      count: 1,
      latestAt: row.earnedAt,
    });
  }
  return [...groups.values()].sort((a, b) => b.latestAt - a.latestAt);
}

export function recentRibbonEvents(groups: RibbonGroup[], limit = 2): { event: string; rows: RibbonGroup[] }[] {
  const seen: string[] = [];
  for (const row of groups) {
    if (!seen.includes(row.event)) {
      seen.push(row.event);
    }
    if (seen.length >= limit) {
      break;
    }
  }
  return seen.map((event) => ({ event, rows: groups.filter((row) => row.event === event) }));
}

export function lookbookTiers(awards: CachedAward[]): LookbookTierRow[] {
  const specs = [
    { tier: 'bronze' as const, kinds: LOOKBOOK_BRONZE_KINDS },
    { tier: 'silver' as const, kinds: LOOKBOOK_SILVER_KINDS },
    { tier: 'gold' as const, kinds: LOOKBOOK_GOLD_KINDS },
  ];
  return specs.map(({ tier, kinds }) => {
    let have = 0;
    const need = kinds.length * LOOKBOOK_THEMES.length;
    for (const theme of LOOKBOOK_THEMES) {
      for (const kind of kinds) {
        if (hasAward(awards, stampId(theme, kind))) {
          have += 1;
        }
      }
    }
    return { tier, earned: hasAward(awards, lookbookId(tier)), have, need };
  });
}

export function themeTiles(awards: CachedAward[]): ThemeTile[] {
  return LOOKBOOK_THEMES.map((themeId) => {
    const earned = {
      debut: hasAward(awards, stampId(themeId, 'debut')),
      encore: hasAward(awards, stampId(themeId, 'encore')),
      party: hasAward(awards, stampId(themeId, 'party')),
      rack: hasAward(awards, stampId(themeId, 'rack')),
      star: hasAward(awards, stampId(themeId, 'star')),
    };
    return {
      themeId,
      earned,
      mainHave: Number(earned.debut) + Number(earned.encore) + Number(earned.party) + Number(earned.rack),
      bonus: earned.star,
    };
  });
}

export function wornForTheme(worn: WornPiece[], themeId: string, rack: ThemeRackPiece[]): { have: number; need: number } {
  const needIds = rack.filter((row) => row.themeId === themeId).map((row) => row.pieceId);
  const wornIds = new Set(worn.filter((row) => row.themeId === themeId).map((row) => row.pieceId));
  if (needIds.length === 0) {
    return { have: wornIds.size, need: 0 };
  }
  return { have: needIds.filter((id) => wornIds.has(id)).length, need: needIds.length };
}

export function coverRows(awards: CachedAward[], progress: CachedProgress[]): CoverRow[] {
  const have = progressValue(progress, 'shows_walked');
  return COVER_TIERS.map((tier, index) => ({
    tier,
    earned: hasAward(awards, coverId(tier)),
    have,
    need: COVER_THRESHOLDS[index],
  }));
}

export function crowdFavoriteCount(awards: CachedAward[]): number {
  return awardsFor(awards, 'crowd_favorite').length;
}

export function friendRows(awards: CachedAward[], progress: CachedProgress[]): FriendRow[] {
  const crew = progress.filter((row) => row.key.startsWith('runway_friend:') && row.value > 0).length;
  const specs: { kind: FriendRow['kind']; have: number; needs: readonly number[] }[] = [
    { kind: 'host', have: progressValue(progress, 'hosted'), needs: HOST_THRESHOLDS },
    { kind: 'crew', have: crew, needs: CREW_THRESHOLDS },
    { kind: 'front', have: progressValue(progress, 'front_row'), needs: FRONT_THRESHOLDS },
  ];
  return specs.map(({ kind, have, needs }) => ({
    kind,
    have,
    tiers: METAL_TIERS.map((tier, index) => ({
      tier,
      earned: hasAward(awards, friendAwardId(kind, tier)),
      need: needs[index],
    })),
  }));
}

export function firstGoals(awards: CachedAward[], leftover: LeftoverRibbon[] = []) {
  const ribbons = caseRibbons(awards, leftover);
  return [
    { id: 'ribbon', label: 'Win a first ribbon', done: ribbons.length > 0 },
    { id: 'class', label: 'Win a Beginner class trophy', done: awards.some((award) => award.definitionId.startsWith('class_') && award.definitionId.endsWith('_beginner')) },
    { id: 'career', label: 'Earn a Bronze career cup', done: awards.some((award) => /^career_.*_bronze$/.test(award.definitionId)) },
    { id: 'stamp', label: 'Collect a first Lookbook stamp', done: awards.some((award) => award.definitionId.startsWith('stamp_')) },
  ];
}

export function trophySheet(
  kind: TrophySheetKind,
  awards: CachedAward[],
  progress: CachedProgress[],
  opts: { event?: string; classId?: string; feat?: string },
): TrophySheetModel | null {
  if (kind === 'career' && opts.event) {
    const wins = progressValue(progress, `wins:${opts.event}`);
    const next = careerNextTier(wins);
    return {
      kind,
      title: 'Career',
      event: opts.event,
      rungs: CAREER_TIERS.map((tier, index) => {
        const row = awardsFor(awards, careerId(opts.event!, tier))[0];
        return {
          id: careerId(opts.event!, tier),
          label: titleCase(tier),
          earned: Boolean(row) || wins >= CAREER_THRESHOLDS[index],
          earnedAt: row?.earnedAt ?? null,
          classId: text(row?.snapshot.class ?? row?.snapshot.classId),
        };
      }),
      nextLabel: next.nextTier ? titleCase(next.nextTier) : null,
      have: wins,
      need: next.nextNeed,
    };
  }
  if (kind === 'class' && opts.event) {
    return {
      kind,
      title: 'Class trophies',
      event: opts.event,
      classId: opts.classId,
      rungs: CLASS_PILLS.map((cls) => {
        const row = awardsFor(awards, classTrophyId(opts.event!, cls))[0];
        return {
          id: classTrophyId(opts.event!, cls),
          label: titleCase(cls),
          earned: Boolean(row),
          earnedAt: row?.earnedAt ?? null,
          classId: cls,
        };
      }),
      nextLabel: null,
      have: opts.classId
        ? opts.classId === 'championship'
          ? progressValue(progress, `champ_streak:${opts.event}`)
          : progressValue(progress, `class_wins:${opts.event}:${opts.classId}`)
        : 0,
      need: opts.classId === 'championship' ? CHAMP_STREAK_NEED : CLASS_WINS_NEED,
    };
  }
  if (kind === 'feat' && opts.feat) {
    const id = featId(opts.feat);
    const row = awardsFor(awards, id)[0];
    return {
      kind,
      title: featTitle(opts.feat),
      feat: opts.feat,
      rungs: [
        {
          id,
          label: featTitle(opts.feat),
          earned: Boolean(row),
          earnedAt: row?.earnedAt ?? null,
          classId: text(row?.snapshot.class ?? row?.snapshot.classId),
        },
      ],
      nextLabel: row ? null : FEAT_DETAIL[opts.feat as (typeof FEATS)[number]] ?? 'Not earned yet',
      have: opts.feat === 'personal_best' ? personalBestCount(awards, progress) : row ? 1 : 0,
      need: opts.feat === 'personal_best' ? null : 1,
    };
  }
  return null;
}

export function stampHowTo(kind: string): string {
  if (kind === 'debut') return 'Walk a show in this theme';
  if (kind === 'encore') return 'Walk 5 shows in this theme';
  if (kind === 'party') return 'Walk a friend show in this theme';
  if (kind === 'rack') return 'Wear every theme-specific piece at least once';
  if (kind === 'star') return 'Win Crowd Favorite in this theme';
  return '';
}

export function stampLabel(kind: string): string {
  if (kind === 'debut') return 'Debut';
  if (kind === 'encore') return 'Encore';
  if (kind === 'party') return 'Runway Party';
  if (kind === 'rack') return 'Full Rack';
  if (kind === 'star') return 'Showstopper';
  return kind;
}

export function featTitle(feat: string): string {
  if (feat === 'photo_finish') return 'Photo Finish';
  if (feat === 'win_streak') return 'Win Streak';
  if (feat === 'perfect_recall') return 'Perfect Recall';
  if (feat === 'personal_best') return 'Personal Best';
  return titleCase(feat);
}

export function titleCase(value: string): string {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const CLASS_RANK: Record<string, number> = {
  championship: 5,
  expert: 4,
  open: 3,
  novice: 2,
  beginner: 1,
  veteran: 0,
  none: 0,
};

const TIER_SIZE: Record<string, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  diamond: 5,
};

export type CardShelfTrophy = {
  kind: 'trophy';
  definitionId: string;
  earnedAt: number;
  size: number;
};

export type CardShelfRibbon = {
  kind: 'ribbon';
  event: string;
  classId: string;
  place: number;
  earnedAt: number;
};

export type CardShelfStamp = {
  kind: 'stamp';
  definitionId: string;
  earnedAt: number;
};

export type CardShelfItem = CardShelfTrophy | CardShelfRibbon | CardShelfStamp;

export type SettingsCardModel = {
  empty: boolean;
  shelf: CardShelfItem[];
  trophies: number;
  ribbons: number;
  stamps: number;
};

export function isTrophyId(id: string): boolean {
  return (
    id.startsWith('career_') ||
    id.startsWith('class_') ||
    id.startsWith('feat_') ||
    id.startsWith('range_') ||
    id.startsWith('lookbook_') ||
    id.startsWith('veteran_') ||
    id.startsWith('lifetime_')
  );
}

export function isStampId(id: string): boolean {
  return id.startsWith('stamp_');
}

export function trophySizeOf(id: string, definitions: CachedDefinition[] = []): number {
  const listed = definitions.find((row) => row.id === id)?.size;
  if (listed && listed > 0) {
    return listed;
  }
  const tail = id.split('_').at(-1) ?? '';
  if (id.startsWith('career_') || id.startsWith('lookbook_') || id.startsWith('veteran_') || id.startsWith('lifetime_') || id.startsWith('cover_')) {
    return TIER_SIZE[tail] ?? 1;
  }
  if (id.startsWith('class_')) {
    const rank = classIndex(tail);
    return rank >= 0 ? rank + 1 : 1;
  }
  if (id === 'range_grand_champion') {
    return 5;
  }
  if (id.startsWith('range_')) {
    return 4;
  }
  if (id === 'feat_personal_best') {
    return 2;
  }
  if (id.startsWith('feat_')) {
    return 3;
  }
  return 1;
}

function compareTrophies(a: CardShelfTrophy, b: CardShelfTrophy): number {
  if (b.size !== a.size) {
    return b.size - a.size;
  }
  return b.earnedAt - a.earnedAt;
}

function compareRibbons(a: CaseRibbon, b: CaseRibbon): number {
  if (a.place !== b.place) {
    return a.place - b.place;
  }
  const classDelta = (CLASS_RANK[b.classId] ?? 0) - (CLASS_RANK[a.classId] ?? 0);
  if (classDelta !== 0) {
    return classDelta;
  }
  return b.earnedAt - a.earnedAt;
}

function centerTallest(items: CardShelfItem[]): CardShelfItem[] {
  if (items.length <= 1) {
    return items;
  }
  if (items.length === 2) {
    return [items[1], items[0]];
  }
  return [items[1], items[0], items[2]];
}

export function settingsCardModel(
  awards: CachedAward[],
  leftover: LeftoverRibbon[] = [],
  definitions: CachedDefinition[] = [],
): SettingsCardModel {
  const ribbons = caseRibbons(awards, leftover);
  const trophies = awards.filter((award) => isTrophyId(award.definitionId));
  const stamps = awards.filter((award) => isStampId(award.definitionId)).length;
  const empty = trophies.length === 0 && stamps === 0 && ribbons.length === 0;
  const rankedTrophies = trophies
    .map((award) => ({
      kind: 'trophy' as const,
      definitionId: award.definitionId,
      earnedAt: Date.parse(award.earnedAt) || 0,
      size: trophySizeOf(award.definitionId, definitions),
    }))
    .sort(compareTrophies);
  const picked: CardShelfItem[] = rankedTrophies.slice(0, 3);
  if (picked.length < 3) {
    const extras = [...ribbons].sort(compareRibbons).slice(0, 3 - picked.length);
    for (const row of extras) {
      picked.push({
        kind: 'ribbon',
        event: row.event,
        classId: row.classId,
        place: row.place,
        earnedAt: row.earnedAt,
      });
    }
  }
  if (picked.length < 3) {
    const extras = awards
      .filter((award) => isStampId(award.definitionId))
      .map((award) => ({
        kind: 'stamp' as const,
        definitionId: award.definitionId,
        earnedAt: Date.parse(award.earnedAt) || 0,
      }))
      .sort((a, b) => b.earnedAt - a.earnedAt)
      .slice(0, 3 - picked.length);
    picked.push(...extras);
  }
  return {
    empty,
    shelf: centerTallest(picked),
    trophies: trophies.length,
    ribbons: ribbons.length,
    stamps,
  };
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
