import AsyncStorage from '@react-native-async-storage/async-storage';

import { enterFormat, freshCounters } from './schedule';
import type { FormatState, InviteCounters, InviteFormat } from './types';

function key(ownerId: string): string {
  return `petty.invites.${ownerId}`;
}

function formatOf(value: unknown): FormatState {
  const row = value && typeof value === 'object' ? (value as Partial<FormatState>) : {};
  return {
    offered: row.offered === true,
    offeredOpenedDays: typeof row.offeredOpenedDays === 'number' ? row.offeredOpenedDays : null,
    enteredOpenedDays: typeof row.enteredOpenedDays === 'number' ? row.enteredOpenedDays : null,
    consecutiveDismissals: typeof row.consecutiveDismissals === 'number' ? row.consecutiveDismissals : 0,
    totalDismissals: typeof row.totalDismissals === 'number' ? row.totalDismissals : 0,
    pausedUntil: typeof row.pausedUntil === 'number' ? row.pausedUntil : 0,
    stopped: row.stopped === true,
  };
}

function parse(raw: string | null): InviteCounters {
  const blank = freshCounters();
  if (!raw) {
    return blank;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<InviteCounters>;
    return {
      ...blank,
      shownDay: typeof parsed.shownDay === 'string' ? parsed.shownDay : null,
      lastFormat: parsed.lastFormat === 'runway' || parsed.lastFormat === 'race' ? parsed.lastFormat : null,
      seenThemeIds: Array.isArray(parsed.seenThemeIds) ? parsed.seenThemeIds.filter((id) => typeof id === 'string') : [],
      seenTrickIds: Array.isArray(parsed.seenTrickIds) ? parsed.seenTrickIds.filter((id) => typeof id === 'string') : [],
      lastClass: typeof parsed.lastClass === 'string' ? parsed.lastClass : null,
      pushesEnabled: parsed.pushesEnabled !== false,
      friendPushDay: typeof parsed.friendPushDay === 'string' ? parsed.friendPushDay : null,
      unansweredPushes: typeof parsed.unansweredPushes === 'number' ? parsed.unansweredPushes : 0,
      pushesStopped: parsed.pushesStopped === true,
      pendingPushAt: typeof parsed.pendingPushAt === 'number' ? parsed.pendingPushAt : null,
      runway: formatOf(parsed.runway),
      race: formatOf(parsed.race),
    };
  } catch {
    return blank;
  }
}

export async function loadCounters(ownerId: string): Promise<InviteCounters> {
  try {
    return parse(await AsyncStorage.getItem(key(ownerId)));
  } catch {
    return freshCounters();
  }
}

export async function saveCounters(ownerId: string, counters: InviteCounters): Promise<void> {
  await AsyncStorage.setItem(key(ownerId), JSON.stringify(counters));
}

export async function updateCounters(
  ownerId: string,
  change: (counters: InviteCounters) => InviteCounters,
): Promise<InviteCounters> {
  const next = change(await loadCounters(ownerId));
  await saveCounters(ownerId, next);
  return next;
}

export async function recordFormatEntered(ownerId: string, format: InviteFormat, openedDays: number): Promise<void> {
  await updateCounters(ownerId, (counters) => enterFormat(counters, format, openedDays));
}

export async function readInvitePushes(ownerId: string): Promise<boolean> {
  return (await loadCounters(ownerId)).pushesEnabled;
}

export async function writeInvitePushes(ownerId: string, enabled: boolean): Promise<void> {
  await updateCounters(ownerId, (counters) => ({ ...counters, pushesEnabled: enabled }));
}
