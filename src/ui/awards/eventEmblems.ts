export type AwardEvent = 'run' | 'meters' | 'hurdle' | 'weave' | 'obstacle' | 'dock' | 'sniff' | 'trick' | 'none';

type Emblem = { fill: string; stroke: string };

function circ(x: number, y: number, r: number): string {
  return `M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
}

function ell(x: number, y: number, rx: number, ry: number): string {
  return `M${x - rx} ${y} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;
}

export const eventEmblems: Record<AwardEvent, Emblem> = {
  run: {
    fill: circ(-6, -3, 2.3) + circ(-2.2, -7, 2.3) + circ(2.2, -7, 2.3) + circ(6, -3, 2.3) + ell(0, 3, 5.2, 4.2),
    stroke: '',
  },
  meters: {
    fill: '',
    stroke: 'M-7 2 A7 7 0 1 0 7 2 A7 7 0 1 0 -7 2 M0 -5 V-8.5 M-2.5 -9.5 H2.5 M0 2 L3 -1.5',
  },
  hurdle: { fill: '', stroke: 'M-7 8 V-6 M7 8 V-6 M-9.5 -2.5 H9.5' },
  weave: { fill: '', stroke: 'M-9 -6 L-4.5 6 L0 -6 L4.5 6 L9 -6' },
  obstacle: { fill: '', stroke: 'M-8.5 7 V0 A8.5 8.5 0 0 1 8.5 0 V7 M-4 7 V1 A4 4 0 0 1 4 1 V7' },
  dock: { fill: '', stroke: 'M-9 -2.5 Q-4.5 -7 0 -2.5 T9 -2.5 M-9 5 Q-4.5 0.5 0 5 T9 5' },
  sniff: { fill: '', stroke: 'M-7.5 -2 A5.5 5.5 0 1 0 3.5 -2 A5.5 5.5 0 1 0 -7.5 -2 M2 2 L7.5 7.5' },
  trick: { fill: 'M0 -9 L2.6 -3.2 L8.6 -2.8 L4 1.2 L5.4 7.2 L0 4 L-5.4 7.2 L-4 1.2 L-8.6 -2.8 L-2.6 -3.2 Z', stroke: '' },
  none: { fill: '', stroke: '' },
};
