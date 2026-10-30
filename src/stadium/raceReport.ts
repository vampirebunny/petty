import type { RaceView, StadiumResult } from './api';

export type RaceReportInputLog =
  | { taps: number[] }
  | { jumps: number[] }
  | { attempts: { at: number; down: boolean }[][] }
  | { inputs: { tMs: number; button: 'jump' | 'duck' | 'run' }[] };

export function funRunLog(taps: readonly number[]): RaceReportInputLog {
  return { taps: [...taps] };
}

export function hurdlesLog(jumps: readonly number[]): RaceReportInputLog {
  return { jumps: [...jumps] };
}

export function dockDiveLog(attempts: readonly { at: number; down: boolean }[][]): RaceReportInputLog {
  return { attempts: attempts.map((row) => row.map((input) => ({ at: input.at, down: input.down }))) };
}

export function obstacleLog(inputs: readonly { tMs: number; button: 'jump' | 'duck' | 'run' }[]): RaceReportInputLog {
  return { inputs: inputs.map((input) => ({ tMs: input.tMs, button: input.button })) };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// One dropped report used to leave the entry checked in, so later races stayed closed.
export async function deliverRaceReport(
  send: () => Promise<StadiumResult<RaceView>>,
  onRecorded: (view: RaceView) => void,
): Promise<boolean> {
  const waits = [400, 800, 1600, 3200, 5000];
  for (let attempt = 0; attempt <= waits.length; attempt += 1) {
    const result = await send();
    if (result.ok) {
      onRecorded(result.data);
      return true;
    }
    const again = result.offline || /not in race|load failed/i.test(result.reason);
    if (!again || attempt === waits.length) return false;
    await wait(waits[attempt] ?? 5000);
  }
  return false;
}
