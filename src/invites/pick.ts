import { inviteConfig } from './config';
import { isPlayableEvent, type RaceEvent } from '../sim/stadium';
import type { RaceOption } from './types';

function byStart(a: RaceOption, b: RaceOption): number {
  return a.startsAt - b.startsAt;
}

function qualifying(options: RaceOption[], now: number): RaceOption[] {
  const lead = now + inviteConfig.leadMs;
  return options
    .filter((row) => row.state === 'open' && isPlayableEvent(row.event) && row.startsAt >= lead)
    .sort(byStart);
}

/** Soonest open playable card at least `leadMs` out. The first race prefers Fun Run when one qualifies. */
export function soonestRace(options: RaceOption[], now: number, preferFunRun: boolean): RaceOption | null {
  const open = qualifying(options, now);
  if (preferFunRun) {
    return open.find((row) => row.event === 'funRun') ?? open[0] ?? null;
  }
  return open[0] ?? null;
}

/** Next open start of the same event that is still at least `leadMs` out. */
export function retargetRace(options: RaceOption[], event: RaceEvent, now: number): RaceOption | null {
  return qualifying(options, now).find((row) => row.event === event) ?? null;
}

export function raceStillValid(option: RaceOption, now: number): boolean {
  return option.state === 'open' && isPlayableEvent(option.event) && option.startsAt >= now + inviteConfig.leadMs;
}
