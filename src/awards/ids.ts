export const CLASSED_EVENTS = ['dockDive', 'sniffOut', 'trickShow', 'hurdles', 'weave', 'obstacle'] as const;
export const OPEN_EVENTS = ['funRun', 'meters800'] as const;
export const RACE_EVENTS = [...CLASSED_EVENTS, ...OPEN_EVENTS] as const;
export const RACE_CLASSES = ['beginner', 'novice', 'open', 'expert', 'championship'] as const;
export const CAREER_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const;
export const METAL_TIERS = ['bronze', 'silver', 'gold'] as const;
export const COVER_TIERS = ['bronze', 'silver', 'gold', 'platinum'] as const;
export const LOOKBOOK_THEMES = [
  'space',
  'sea',
  'royal',
  'beach',
  'winter',
  'rock',
  'garden',
  'spooky',
  'west',
  'hero',
  'pirate',
  'safari',
] as const;
export const STAMP_KINDS = ['debut', 'encore', 'party', 'rack', 'star'] as const;
export const FEATS = ['flawless', 'photo_finish', 'comeback', 'win_streak', 'perfect_recall', 'personal_best'] as const;

export const RIBBON_ID = 'ribbon';
export const CROWD_FAVORITE_ID = 'crowd_favorite';
export const GRAND_CHAMPION_ID = 'range_grand_champion';

export function isOpenEvent(event: string): boolean {
  return event === 'funRun' || event === 'meters800';
}

export function careerId(event: string, tier: string): string {
  return `career_${event}_${tier}`;
}

export function classTrophyId(event: string, cls: string): string {
  return `class_${event}_${cls}`;
}

export function featId(feat: string): string {
  return `feat_${feat}`;
}

export function allRounderId(cls: string): string {
  return `range_all_rounder_${cls}`;
}

export function veteranId(tier: string): string {
  return `veteran_${tier}`;
}

export function stampId(theme: string, kind: string): string {
  return `stamp_${theme}_${kind}`;
}

export function lookbookId(tier: string): string {
  return `lookbook_${tier}`;
}

export function coverId(tier: string): string {
  return `cover_${tier}`;
}

export function friendAwardId(kind: 'host' | 'crew' | 'front', tier: string): string {
  return `friend_${kind}_${tier}`;
}

export function lifetimeId(track: 'wins' | 'shows' | 'collector', tier: string): string {
  return `lifetime_${track}_${tier}`;
}

export function winsKey(event: string): string {
  return `wins:${event}`;
}

export function classWinsKey(event: string, cls: string): string {
  return `class_wins:${event}:${cls}`;
}

export function champStreakKey(event: string): string {
  return `champ_streak:${event}`;
}

export function personalBestKey(event: string, cls?: string): string {
  return cls ? `personal_best:${event}:${cls}` : `personal_best:${event}`;
}

export function showsWalkedThemeKey(theme: string): string {
  return `shows_walked:${theme}`;
}

export function soloShowsOnKey(day: string): string {
  return `solo_shows_on:${day}`;
}

export function runwayFriendKey(playerId: string): string {
  return `runway_friend:${playerId}`;
}

export function votedShowKey(showId: string): string {
  return `voted:${showId}`;
}
