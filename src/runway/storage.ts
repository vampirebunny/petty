import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LocalRunwayShow, RunwaySave } from './types';

function key(ownerId: string): string {
  return `petty.runway.${ownerId}`;
}

function empty(): RunwaySave {
  return { history: [] };
}

export async function loadRunwaySave(ownerId: string): Promise<RunwaySave> {
  try {
    const raw = await AsyncStorage.getItem(key(ownerId));
    if (!raw) {
      return empty();
    }
    const parsed = JSON.parse(raw) as RunwaySave;
    if (!parsed || !Array.isArray(parsed.history)) {
      return empty();
    }
    return { history: parsed.history };
  } catch {
    return empty();
  }
}

export async function saveRunwaySave(ownerId: string, save: RunwaySave): Promise<void> {
  await AsyncStorage.setItem(key(ownerId), JSON.stringify(save));
}

export function rememberShow(save: RunwaySave, show: LocalRunwayShow): RunwaySave {
  const rest = save.history.filter((row) => row.id !== show.id);
  return { history: [show, ...rest] };
}

export function deleteSoloShow(save: RunwaySave, showId: string): RunwaySave {
  return {
    history: save.history.filter((row) => !(row.id === showId && row.mode === 'solo')),
  };
}

export function hideFriendShow(save: RunwaySave, showId: string): RunwaySave {
  return {
    history: save.history.map((row) => (row.id === showId && row.mode === 'friends' ? { ...row, hidden: true } : row)),
  };
}

function seenKey(ownerId: string): string {
  return `petty.runway.seenResults.${ownerId}`;
}

/** Friend shows whose results this player has opened. They leave the lobby and stay in Past Shows. */
export async function loadSeenResults(ownerId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(seenKey(ownerId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function markResultsSeen(ownerId: string, showId: string): Promise<string[]> {
  const seen = await loadSeenResults(ownerId);
  if (seen.includes(showId)) {
    return seen;
  }
  const next = [showId, ...seen].slice(0, 200);
  await AsyncStorage.setItem(seenKey(ownerId), JSON.stringify(next));
  return next;
}

export function visibleShows(save: RunwaySave): LocalRunwayShow[] {
  return save.history.filter((row) => !row.hidden);
}
