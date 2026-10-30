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
