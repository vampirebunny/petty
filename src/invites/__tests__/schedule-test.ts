import { inviteConfig } from '../config';
import {
  chooseFormat,
  dismissFormat,
  formatEligible,
  freshCounters,
  freshFormat,
  inQuietHours,
  nextPushAt,
  noteAppOpen,
  quietSafeAt,
  spendDay,
} from '../schedule';

function at(year: number, month: number, day: number, hour: number, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

describe('invitation schedule', () => {
  it('offers a format the first time, then waits four active days', () => {
    const row = freshFormat();
    expect(formatEligible(row, 3, 0, false)).toBe(true);
    const offered = { ...row, offered: true, offeredOpenedDays: 3 };
    expect(formatEligible(offered, 6, 0, false)).toBe(false);
    expect(formatEligible(offered, 7, 0, false)).toBe(true);
    expect(formatEligible(offered, 4, 0, true)).toBe(true);
  });

  it('pauses after two dismissals and stops after three', () => {
    const now = 1_000;
    let counters = freshCounters();
    counters = dismissFormat(counters, 'race', now);
    expect(counters.race.pausedUntil).toBe(0);
    expect(counters.race.stopped).toBe(false);
    counters = dismissFormat(counters, 'race', now);
    expect(counters.race.pausedUntil).toBe(now + inviteConfig.pauseMs);
    expect(formatEligible(counters.race, 10, now, true)).toBe(false);
    counters = dismissFormat(counters, 'race', now);
    expect(counters.race.stopped).toBe(true);
    expect(formatEligible(counters.race, 40, now + inviteConfig.pauseMs + 1, true)).toBe(false);
  });

  it('spends the day without counting a dismissal', () => {
    const spent = spendDay(freshCounters(), '2026-10-31', 'runway', 4);
    expect(spent.shownDay).toBe('2026-10-31');
    expect(spent.runway.consecutiveDismissals).toBe(0);
    expect(spent.runway.totalDismissals).toBe(0);
    expect(spent.runway.offered).toBe(true);
  });

  it('leads with what is new, otherwise alternates', () => {
    expect(chooseFormat(true, true, 'runway', false, false)).toBe('race');
    expect(chooseFormat(true, true, 'race', false, false)).toBe('runway');
    expect(chooseFormat(true, true, 'runway', true, false)).toBe('runway');
    expect(chooseFormat(true, false, null, false, false)).toBe('runway');
    expect(chooseFormat(false, false, null, false, false)).toBeNull();
  });

  it('keeps the push outside quiet hours and near the usual hour', () => {
    expect(inQuietHours(22)).toBe(true);
    expect(inQuietHours(8)).toBe(false);
    expect(inQuietHours(15)).toBe(false);
    const earliest = at(2026, 10, 31, 11);
    expect(quietSafeAt(earliest, 15)).toBe(at(2026, 10, 31, 15));
    expect(quietSafeAt(at(2026, 10, 31, 18), 22)).toBe(at(2026, 11, 1, 8));
  });

  it('backs a missed push off by two days, then a week, then stops', () => {
    const opened = at(2026, 10, 31, 15);
    const first = nextPushAt(opened, 15, 0, false);
    expect(first).toBe(quietSafeAt(opened + inviteConfig.firstPushMs, 15));
    const second = nextPushAt(opened, 15, 1, false);
    expect(second).toBe(quietSafeAt(opened + inviteConfig.pushBackoffMs[0], 15));
    const third = nextPushAt(opened, 15, 2, false);
    expect(third).toBe(quietSafeAt(opened + inviteConfig.pushBackoffMs[1], 15));
    expect(nextPushAt(opened, 15, 3, false)).toBeNull();
    expect(nextPushAt(opened, 15, 0, true)).toBeNull();
  });

  it('counts an unanswered push and clears the stop on a later open', () => {
    const now = at(2026, 10, 31, 12);
    const pending = { ...freshCounters(), pendingPushAt: now - 1000, unansweredPushes: 2 };
    const missed = noteAppOpen(pending, now, false);
    expect(missed.unansweredPushes).toBe(3);
    expect(missed.pushesStopped).toBe(true);
    expect(missed.pendingPushAt).toBeNull();
    const returned = noteAppOpen(missed, now + 1000, false);
    expect(returned.pushesStopped).toBe(false);
    expect(returned.unansweredPushes).toBe(0);
  });

  it('does not count a push the player opened', () => {
    const now = at(2026, 10, 31, 12);
    const pending = { ...freshCounters(), pendingPushAt: now - 1000 };
    const opened = noteAppOpen(pending, now, true);
    expect(opened.unansweredPushes).toBe(0);
    expect(opened.pendingPushAt).toBeNull();
    expect(opened.pushesStopped).toBe(false);
  });
});
