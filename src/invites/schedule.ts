import { inviteConfig } from './config';
import type { FormatState, InviteCounters, InviteFormat, InviteTrigger } from './types';

export function freshFormat(): FormatState {
  return {
    offered: false,
    offeredOpenedDays: null,
    enteredOpenedDays: null,
    consecutiveDismissals: 0,
    totalDismissals: 0,
    pausedUntil: 0,
    stopped: false,
  };
}

export function freshCounters(): InviteCounters {
  return {
    shownDay: null,
    lastFormat: null,
    seenThemeIds: [],
    seenTrickIds: [],
    lastClass: null,
    pushesEnabled: true,
    friendPushDay: null,
    unansweredPushes: 0,
    pushesStopped: false,
    pendingPushAt: null,
    runway: freshFormat(),
    race: freshFormat(),
  };
}

export function daySpent(counters: InviteCounters, today: string): boolean {
  return counters.shownDay === today;
}

export function formatEligible(
  row: FormatState,
  openedDays: number,
  now: number,
  hasNew: boolean,
): boolean {
  if (row.stopped || row.pausedUntil > now) {
    return false;
  }
  if (!row.offered) {
    return true;
  }
  if (hasNew) {
    return true;
  }
  const since = row.enteredOpenedDays ?? row.offeredOpenedDays ?? openedDays;
  return openedDays - since >= inviteConfig.lapsedActiveDays;
}

export function formatTrigger(row: FormatState, hasNew: boolean): InviteTrigger {
  if (!row.offered) {
    return 'first';
  }
  if (hasNew) {
    return 'new';
  }
  return 'lapsed';
}

/** What's new leads. Otherwise alternate, starting with runway. */
export function chooseFormat(
  runway: boolean,
  race: boolean,
  last: InviteFormat | null,
  runwayNew: boolean,
  raceNew: boolean,
): InviteFormat | null {
  if (runway && race) {
    if (runwayNew !== raceNew) {
      return runwayNew ? 'runway' : 'race';
    }
    return last === 'runway' ? 'race' : 'runway';
  }
  if (runway) {
    return 'runway';
  }
  if (race) {
    return 'race';
  }
  return null;
}

export function spendDay(counters: InviteCounters, today: string, format: InviteFormat, openedDays: number): InviteCounters {
  const row = counters[format];
  return {
    ...counters,
    shownDay: today,
    lastFormat: format,
    [format]: {
      ...row,
      offered: true,
      offeredOpenedDays: row.offeredOpenedDays ?? openedDays,
    },
  };
}

export function dismissFormat(counters: InviteCounters, format: InviteFormat, now: number): InviteCounters {
  const row = counters[format];
  const consecutiveDismissals = row.consecutiveDismissals + 1;
  const totalDismissals = row.totalDismissals + 1;
  return {
    ...counters,
    [format]: {
      ...row,
      offered: true,
      consecutiveDismissals,
      totalDismissals,
      stopped: totalDismissals >= inviteConfig.stopAfterDismissals,
      pausedUntil:
        consecutiveDismissals >= inviteConfig.pauseAfterDismissals ? now + inviteConfig.pauseMs : row.pausedUntil,
    },
  };
}

export function enterFormat(counters: InviteCounters, format: InviteFormat, openedDays: number): InviteCounters {
  const row = counters[format];
  return {
    ...counters,
    [format]: {
      ...row,
      offered: true,
      offeredOpenedDays: row.offeredOpenedDays ?? openedDays,
      enteredOpenedDays: openedDays,
      consecutiveDismissals: 0,
    },
  };
}

export function inQuietHours(hour: number, start = inviteConfig.quietStartHour, end = inviteConfig.quietEndHour): boolean {
  if (start === end) {
    return false;
  }
  if (start < end) {
    return hour >= start && hour < end;
  }
  return hour >= start || hour < end;
}

/** The next usual-play hour that is outside quiet hours and not before `earliest`. */
export function quietSafeAt(earliest: number, usualHour: number, start = inviteConfig.quietStartHour, end = inviteConfig.quietEndHour): number {
  const hour = inQuietHours(usualHour, start, end) ? end : usualHour;
  const candidate = new Date(earliest);
  candidate.setHours(hour, 0, 0, 0);
  if (candidate.getTime() < earliest) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.getTime();
}

export function nextPushAt(lastOpenAt: number, usualHour: number, unanswered: number, stopped: boolean): number | null {
  if (stopped || unanswered >= inviteConfig.pushStopAfter) {
    return null;
  }
  const gap = unanswered === 0 ? inviteConfig.firstPushMs : inviteConfig.pushBackoffMs[unanswered - 1];
  if (gap == null) {
    return null;
  }
  return quietSafeAt(lastOpenAt + gap, usualHour);
}

/**
 * A push whose fire time has passed, and was not the reason this open happened, is unanswered.
 * Reaching the stop count holds further pushes until a later open, which clears the hold.
 */
export function noteAppOpen(counters: InviteCounters, now: number, openedFromPush: boolean): InviteCounters {
  const pending = counters.pendingPushAt;
  if (pending != null && pending <= now && !openedFromPush) {
    const unansweredPushes = counters.unansweredPushes + 1;
    return {
      ...counters,
      unansweredPushes,
      pendingPushAt: null,
      pushesStopped: unansweredPushes >= inviteConfig.pushStopAfter,
    };
  }
  if (counters.pushesStopped && pending == null) {
    return { ...counters, pushesStopped: false, unansweredPushes: 0 };
  }
  if (openedFromPush) {
    return { ...counters, pendingPushAt: null };
  }
  return counters;
}
