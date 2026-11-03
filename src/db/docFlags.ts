import { getDb } from './database';

const CHEST_INTRO_KEY = 'park_finds_chest_intro_shown';
const CHEST_TIP_KEY = 'park_finds_chest_tooltip_done';
const OUTFIT_TIP_KEY = 'seen_daily_outfit_tooltip';

function readFlag(key: string): boolean {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value === '1';
}

function writeFlag(key: string, value: boolean): void {
  getDb().runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value ? '1' : '0');
}

export function chestIntroShown(): boolean {
  return readFlag(CHEST_INTRO_KEY);
}

export function setChestIntroShown(value: boolean): void {
  writeFlag(CHEST_INTRO_KEY, value);
}

export function chestTooltipDone(): boolean {
  return readFlag(CHEST_TIP_KEY);
}

export function setChestTooltipDone(value: boolean): void {
  writeFlag(CHEST_TIP_KEY, value);
}

export function resetChestIntroFlags(): void {
  writeFlag(CHEST_INTRO_KEY, false);
  writeFlag(CHEST_TIP_KEY, false);
}

/** Include in playerDoc sync payload. */
export function parkFindPlayerFlags(): { chestIntroShown: boolean; chestTooltipDone: boolean } {
  return {
    chestIntroShown: chestIntroShown(),
    chestTooltipDone: chestTooltipDone(),
  };
}

export function seenDailyOutfitTooltip(): boolean {
  return readFlag(OUTFIT_TIP_KEY);
}

export function setSeenDailyOutfitTooltip(value: boolean): void {
  writeFlag(OUTFIT_TIP_KEY, value);
}
