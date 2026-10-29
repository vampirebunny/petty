import { getDb } from '../db/database';
import { queuePlayer } from '../sync/queue';

const INTRO_KEY = 'park_finds_chest_intro_shown';
const TIP_KEY = 'park_finds_chest_tooltip_done';

function readFlag(key: string): boolean {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value === '1';
}

function writeFlag(key: string, value: boolean): void {
  getDb().runSync(
    "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
    key,
    value ? '1' : '0',
  );
  queuePlayer();
}

export function chestIntroShown(): boolean {
  return readFlag(INTRO_KEY);
}

export function setChestIntroShown(value: boolean): void {
  writeFlag(INTRO_KEY, value);
}

export function chestTooltipDone(): boolean {
  return readFlag(TIP_KEY);
}

export function setChestTooltipDone(value: boolean): void {
  writeFlag(TIP_KEY, value);
}

export function resetChestIntroFlags(): void {
  writeFlag(INTRO_KEY, false);
  writeFlag(TIP_KEY, false);
}

/** Include in playerDoc sync payload. */
export function parkFindPlayerFlags(): { chestIntroShown: boolean; chestTooltipDone: boolean } {
  return {
    chestIntroShown: chestIntroShown(),
    chestTooltipDone: chestTooltipDone(),
  };
}
