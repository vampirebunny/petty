import { s } from './story';
import type { Step, Story, Variant } from './story';
import type { BeatTemplateId } from './types';

function intros(): Variant[] {
  return [
    {
      id: 'stretch',
      weight: 1,
      steps: [s('both', 'sit', { gesture: 'big_stretch', weight: 0.8 }), s('both', 'play_bow', { weight: 0.4 })],
    },
    {
      id: 'zoom',
      weight: 1,
      steps: [
        s('bolder', 'zoomies', { place: 'center', weight: 0.7 }),
        s('shyer', 'sit', { gesture: 'double_take', parallel: true }),
      ],
    },
  ];
}

function finales(): Variant[] {
  return [
    {
      id: 'settle',
      weight: 1,
      steps: [
        s('both', 'approach', { toward: 'meet', gap: 1.35, pace: 0.35, weight: 0.8 }),
        s('both', 'sit', { weight: 0.6 }),
      ],
    },
    {
      id: 'cool',
      weight: 1,
      steps: [
        s('both', 'pant', { weight: 0.6 }),
        s('winner', 'celebrate', { weight: 0.5 }),
        s('loser', 'play_bow', { parallel: true }),
      ],
    },
  ];
}

function napFinales(): Variant[] {
  return [
    {
      id: 'curl',
      weight: 1,
      steps: [
        s('both', 'approach', { toward: 'meet', gap: 1.2, pace: 0.3, weight: 0.7 }),
        s('both', 'nap', { weight: 1.2 }),
      ],
    },
    {
      id: 'yawn',
      weight: 1,
      steps: [s('both', 'sit', { gesture: 'yawn', weight: 0.6 }), s('both', 'nap', { weight: 1.4 })],
    },
  ];
}

function story(main: Variant[], finale: Variant[] = finales()): Story {
  return { intro: intros(), main, finale };
}

function classic(steps: Step[]): Variant {
  return { id: 'classic', weight: 1, steps };
}

function falseStart(steps: Step[]): Variant {
  return {
    id: 'false_start',
    weight: 1,
    steps: [
      s('bolder', 'run_to', { place: 'right', spread: 'y', pace: 0.95, weight: 0.7 }),
      s('shyer', 'sit', { parallel: true }),
      s('bolder', 'skid', { weight: 0.35 }),
      s('bolder', 'approach', { place: 'left', spread: 'y', pace: 0.45, gesture: 'glance', weight: 0.8 }),
      s('shyer', 'sit', { parallel: true }),
      ...steps.map((step) => ({ ...step })),
    ],
  };
}

const fetchDogs: Step[] = [
  s('A', 'play_bow', { place: 'near', weight: 0.7, prop: { kind: 'ball', holder: 'A', throwTo: 'far' } }),
  s('B', 'run_to', { placeFrom: 'throwTo', pace: 0.9, weight: 1.3, prop: { kind: 'ball', holder: 'B' } }),
  s('A', 'sit', { parallel: true }),
  s('B', 'run_to', { toward: 'partner', gap: 1.15, pace: 0.8, weight: 1.2, prop: { kind: 'ball', holder: 'B' } }),
  s('A', 'celebrate', { parallel: true }),
  s('B', 'play_bow', { place: 'near', weight: 0.7, prop: { kind: 'squeaky', holder: 'B', throwTo: 'far' } }),
  s('A', 'run_to', { placeFrom: 'throwTo', pace: 0.9, weight: 1.3 }),
  s('B', 'sit', { parallel: true }),
  s('A', 'run_to', { toward: 'partner', gap: 1.15, pace: 0.8, weight: 1.2, prop: { kind: 'squeaky', holder: 'A' }, sfx: 'squeak' }),
  s('B', 'celebrate', { parallel: true }),
];

const fetchCross: Step[] = [
  s('cat', 'approach', { toward: 'partner', gap: 1.6, weight: 1 }),
  s('dog', 'play_bow', { place: 'near', weight: 0.5, prop: { kind: 'ball', holder: 'dog', throwTo: 'far' } }),
  s('dog', 'run_to', { placeFrom: 'throwTo', pace: 0.9, weight: 1.3 }),
  s('cat', 'stalk', { toward: 'partner', gap: 1.7, parallel: true }),
  s('dog', 'run_to', { toward: 'partner', gap: 1.2, pace: 0.85, weight: 1.1, prop: { kind: 'ball', holder: 'dog' } }),
  s('cat', 'pounce', { parallel: true }),
  s('dog', 'play_bow', { weight: 0.8 }),
  s('cat', 'jump', { parallel: true }),
];

const raceDogs: Step[] = [
  s('both', 'approach', { place: 'left', spread: 'y', pace: 0.45, weight: 1 }),
  s('both', 'sit', { weight: 0.5 }),
  s('winner', 'run_to', { place: 'right', spread: 'y', pace: 0.95, weight: 2 }),
  s('loser', 'run_to', { place: 'right', spread: 'y', pace: 0.78, parallel: true }),
  s('winner', 'win', { weight: 1 }),
  s('loser', 'pant', { parallel: true }),
  s('both', 'approach', { toward: 'meet', gap: 1.3, pace: 0.35, weight: 1 }),
];

const raceCats: Step[] = [
  s('both', 'approach', { place: 'left', spread: 'y', pace: 0.45, weight: 1 }),
  s('both', 'sit', { weight: 0.5 }),
  s('winner', 'run_to', { place: 'right', spread: 'y', pace: 0.95, weight: 2 }),
  s('loser', 'run_to', { place: 'right', spread: 'y', pace: 0.78, parallel: true }),
  s('winner', 'win', { weight: 1 }),
  s('loser', 'sit', { parallel: true }),
];

const raceCross: Step[] = [
  s('dog', 'play_bow', { weight: 0.7 }),
  s('cat', 'sit', { parallel: true }),
  s('both', 'approach', { place: 'left', spread: 'y', pace: 0.45, weight: 1 }),
  s('winner', 'run_to', { place: 'right', spread: 'y', pace: 0.95, weight: 2 }),
  s('loser', 'run_to', { place: 'right', spread: 'y', pace: 0.78, parallel: true }),
  s('cat', 'jump', { weight: 0.6 }),
  s('winner', 'win', { weight: 1 }),
  s('loser', 'pant', { parallel: true }),
];

const chaseDogs: Step[] = [
  s('bolder', 'run_to', { toward: 'partner', gap: 1.05, pace: 0.9, weight: 1.6 }),
  s('shyer', 'run_to', { toward: 'away', pace: 0.85, parallel: true }),
  s('bolder', 'play_bow', { weight: 0.5 }),
  s('shyer', 'sit', { parallel: true }),
  s('shyer', 'run_to', { toward: 'partner', gap: 1.05, pace: 0.9, weight: 1.6 }),
  s('bolder', 'run_to', { toward: 'away', pace: 0.85, parallel: true }),
  s('winner', 'win', { weight: 1 }),
  s('loser', 'pant', { parallel: true }),
];

const chaseCats: Step[] = [
  s('bolder', 'stalk', { toward: 'partner', gap: 1.3, weight: 1.3 }),
  s('shyer', 'sit', { parallel: true }),
  s('bolder', 'pounce', { weight: 0.5 }),
  s('shyer', 'run_to', { toward: 'away', pace: 0.9, parallel: true }),
  s('shyer', 'stalk', { toward: 'partner', gap: 1.3, weight: 1.3 }),
  s('bolder', 'run_to', { toward: 'away', pace: 0.9, parallel: true }),
  s('shyer', 'pounce', { weight: 0.5 }),
  s('winner', 'win', { weight: 1 }),
  s('loser', 'sit', { parallel: true }),
];

const chaseCross: Step[] = [
  s('dog', 'run_to', { toward: 'partner', gap: 1.1, pace: 0.9, weight: 1.5 }),
  s('cat', 'run_to', { toward: 'away', pace: 0.9, parallel: true }),
  s('cat', 'jump', { weight: 0.6 }),
  s('dog', 'play_bow', { parallel: true }),
  s('cat', 'stalk', { toward: 'partner', gap: 1.4, weight: 1.3 }),
  s('dog', 'sit', { parallel: true }),
  s('cat', 'pounce', { weight: 0.5 }),
  s('dog', 'run_to', { toward: 'away', pace: 0.85, parallel: true }),
  s('winner', 'win', { weight: 1 }),
  s('loser', 'pant', { parallel: true }),
];

export const stories: Record<BeatTemplateId, Story> = {
  'fetch-dogs': story([
    classic(fetchDogs),
    {
      id: 'overshoot',
      weight: 1,
      steps: [
        s('A', 'play_bow', { place: 'near', weight: 0.6, prop: { kind: 'ball', holder: 'A', throwTo: 'far' } }),
        s('B', 'run_to', { placeFrom: 'throwTo', pace: 1, weight: 1.1 }),
        s('A', 'sit', { parallel: true }),
        s('B', 'skid', { toward: 'partner', gap: 0.7, weight: 0.45 }),
        s('B', 'sit', { gesture: 'double_take', weight: 0.4 }),
        s('B', 'run_to', { toward: 'partner', gap: 1.2, pace: 0.55, weight: 0.8, prop: { kind: 'ball', holder: 'B' } }),
        s('A', 'celebrate', { parallel: true }),
      ],
    },
    {
      id: 'wrong_item',
      weight: 1,
      steps: [
        s('A', 'play_bow', { place: 'near', weight: 0.6, prop: { kind: 'ball', holder: 'A', throwTo: 'far' } }),
        s('B', 'run_to', { placeFrom: 'throwTo', pace: 0.9, weight: 1.1 }),
        s('A', 'sit', { parallel: true }),
        s('B', 'run_to', { toward: 'partner', gap: 1.15, pace: 0.75, weight: 1, prop: { kind: 'stick', holder: 'B' } }),
        s('A', 'sit', { gesture: 'head_tilt', emote: 'question', parallel: true }),
      ],
    },
  ]),
  'fetch-cross': story([
    classic(fetchCross),
    {
      id: 'tail',
      weight: 1,
      steps: [
        s('dog', 'play_bow', { place: 'near', weight: 0.5, prop: { kind: 'ball', holder: 'dog', throwTo: 'far' } }),
        s('dog', 'run_to', { placeFrom: 'throwTo', pace: 0.9, weight: 1.1 }),
        s('cat', 'sit', { place: 'center', gesture: 'look_at_camera', parallel: true }),
        s('dog', 'run_to', { toward: 'partner', gap: 1.15, pace: 0.85, weight: 1, prop: { kind: 'ball', holder: 'dog' } }),
        s('cat', 'pounce', { parallel: true, gesture: 'butt_wiggle' }),
        s('dog', 'sit', { gesture: 'startle', emote: 'exclaim', weight: 0.5 }),
      ],
    },
  ]),
  'tug-dogs': story([
    classic([
      s('both', 'run_to', { toward: 'meet', gap: 1.3, pace: 0.8, weight: 1.2 }),
      s('bolder', 'play_bow', { weight: 0.6 }),
      s('both', 'approach', { toward: 'meet', gap: 1.05, pace: 0.3, weight: 0.5 }),
      s('both', 'tug_rope', { weight: 3, prop: { kind: 'rope', holder: 'both' } }),
      s('winner', 'win', { weight: 1 }),
      s('loser', 'pant', { parallel: true }),
    ]),
    {
      id: 'stalemate',
      weight: 1,
      steps: [
        s('both', 'run_to', { toward: 'meet', gap: 1.2, pace: 0.7, weight: 1 }),
        s('both', 'tug_rope', { weight: 2.4, tempo: 'linger', prop: { kind: 'rope', holder: 'both' } }),
        s('both', 'pant', { weight: 0.6 }),
        s('both', 'sit', { gesture: 'shake_off', weight: 0.5 }),
        s('both', 'tug_rope', { weight: 1.6, prop: { kind: 'rope', holder: 'both' } }),
        s('winner', 'win', { weight: 0.8 }),
        s('loser', 'pant', { parallel: true }),
      ],
    },
  ]),
  'race-dogs': story([classic(raceDogs), falseStart(raceDogs)]),
  'race-cats': story([classic(raceCats), falseStart(raceCats)]),
  'race-cross': story([classic(raceCross), falseStart(raceCross)]),
  'chase-dogs': story([
    classic(chaseDogs),
    {
      id: 'reverse',
      weight: 1,
      steps: [
        s('bolder', 'run_to', { toward: 'partner', gap: 1.05, pace: 0.9, weight: 1 }),
        s('shyer', 'run_to', { toward: 'away', pace: 0.85, parallel: true }),
        s('shyer', 'skid', { weight: 0.4 }),
        s('bolder', 'skid', { parallel: true }),
        s('shyer', 'run_to', { toward: 'partner', gap: 1.05, pace: 0.9, weight: 1.2 }),
        s('bolder', 'run_to', { toward: 'away', pace: 0.85, parallel: true }),
        s('winner', 'win', { weight: 0.8 }),
        s('loser', 'pant', { parallel: true }),
      ],
    },
  ]),
  'chase-cats': story([
    classic(chaseCats),
    {
      id: 'reverse',
      weight: 1,
      steps: [
        s('bolder', 'stalk', { toward: 'partner', gap: 1.2, weight: 0.9 }),
        s('shyer', 'run_to', { toward: 'away', pace: 0.85, parallel: true }),
        s('shyer', 'skid', { weight: 0.4 }),
        s('bolder', 'skid', { parallel: true }),
        s('shyer', 'stalk', { toward: 'partner', gap: 1.15, weight: 1 }),
        s('bolder', 'run_to', { toward: 'away', pace: 0.9, parallel: true }),
        s('winner', 'win', { weight: 0.8 }),
        s('loser', 'sit', { parallel: true }),
      ],
    },
  ]),
  'chase-cross': story([
    classic(chaseCross),
    {
      id: 'reverse',
      weight: 1,
      steps: [
        s('dog', 'run_to', { toward: 'partner', gap: 1.1, pace: 0.9, weight: 1 }),
        s('cat', 'run_to', { toward: 'away', pace: 0.9, parallel: true }),
        s('cat', 'skid', { weight: 0.4 }),
        s('dog', 'skid', { parallel: true }),
        s('cat', 'stalk', { toward: 'partner', gap: 1.2, weight: 1 }),
        s('dog', 'run_to', { toward: 'away', pace: 0.85, parallel: true }),
        s('winner', 'win', { weight: 0.8 }),
        s('loser', 'pant', { parallel: true }),
      ],
    },
  ]),
  'hide-any': story([
    classic([
      s('shyer', 'hide', { place: 'far', pace: 0.55, weight: 1.4 }),
      s('bolder', 'sit', { parallel: true }),
      s('bolder', 'sniff', { place: 'random', weight: 1.1 }),
      s('bolder', 'sniff', { place: 'random', weight: 1.1 }),
      s('bolder', 'run_to', { toward: 'partner', gap: 1.1, pace: 0.8, weight: 1 }),
      s('shyer', 'celebrate', { weight: 0.8 }),
      s('bolder', 'play_bow', { parallel: true }),
    ]),
    {
      id: 'bad_hider',
      weight: 1,
      steps: [
        s('shyer', 'sit', { place: 'center', gesture: 'look_at_camera', weight: 0.8 }),
        s('bolder', 'sit', { parallel: true }),
        s('bolder', 'approach', { place: 'left', weight: 0.9 }),
        s('bolder', 'approach', { place: 'right', weight: 0.9 }),
        s('bolder', 'run_to', { toward: 'partner', gap: 1.1, pace: 0.7, weight: 0.8 }),
        s('shyer', 'celebrate', { weight: 0.6 }),
        s('bolder', 'play_bow', { parallel: true }),
      ],
    },
  ]),
  'sniff-any': story([
    classic([
      s('both', 'approach', { toward: 'meet', gap: 1.5, pace: 0.4, weight: 1.2 }),
      s('both', 'sniff', { toward: 'partner', gap: 1.1, weight: 1 }),
      s('bolder', 'sniff', { toward: 'partner', gap: 1.1, lane: 34, weight: 1 }),
      s('shyer', 'sit', { parallel: true }),
      s('bolder', 'sniff', { toward: 'partner', gap: 1.1, lane: -34, weight: 1 }),
      s('both', 'approach', { toward: 'meet', gap: 1.35, pace: 0.3, weight: 0.8 }),
      s('both', 'sit', { weight: 0.8 }),
    ]),
    {
      id: 'trade',
      weight: 1,
      steps: [
        s('both', 'approach', { toward: 'meet', gap: 1.4, pace: 0.4, weight: 1 }),
        s('bolder', 'sniff', { toward: 'partner', gap: 1.05, lane: 40, weight: 0.9 }),
        s('shyer', 'sniff', { toward: 'partner', gap: 1.05, lane: -40, parallel: true }),
        s('both', 'sit', { gesture: 'head_tilt', weight: 0.6 }),
      ],
    },
  ]),
  'splash-dogs': story([
    classic([
      s('both', 'run_to', { place: 'center', spread: 'x', pace: 0.9, weight: 1.2 }),
      s('both', 'jump', { weight: 0.6 }),
      s('both', 'jump', { weight: 0.6 }),
      s('bolder', 'run_to', { place: 'random', pace: 0.85, weight: 1.1 }),
      s('shyer', 'run_to', { toward: 'partner', gap: 1.2, pace: 0.85, parallel: true }),
      s('both', 'jump', { weight: 0.6 }),
      s('winner', 'celebrate', { weight: 0.9 }),
    ]),
    {
      id: 'cannonball',
      weight: 1,
      steps: [
        s('both', 'run_to', { place: 'center', spread: 'x', pace: 0.9, weight: 1 }),
        s('bolder', 'jump', { fx: 'splash', weight: 0.5 }),
        s('shyer', 'jump', { fx: 'splash', parallel: true }),
        s('both', 'sit', { gesture: 'shake_off', weight: 0.6 }),
        s('winner', 'celebrate', { weight: 0.7 }),
      ],
    },
  ]),
  'nap-any': story(
    [
      classic([
        s('both', 'approach', { toward: 'meet', gap: 1.3, pace: 0.35, weight: 1.2 }),
        s('both', 'sit', { weight: 0.7 }),
        s('both', 'nap', { weight: 3 }),
      ]),
      {
        id: 'flop',
        weight: 1,
        steps: [
          s('both', 'approach', { toward: 'meet', gap: 1.25, pace: 0.3, weight: 1 }),
          s('shyer', 'flop', { weight: 0.6 }),
          s('bolder', 'sit', { gesture: 'yawn', parallel: true }),
          s('both', 'nap', { weight: 2.4 }),
        ],
      },
    ],
    napFinales(),
  ),
  'trick-any': story([
    classic([
      s('both', 'approach', { toward: 'meet', gap: 1.5, pace: 0.4, weight: 1 }),
      s('B', 'trick', { weight: 1.6 }),
      s('A', 'sit', { parallel: true }),
      s('A', 'celebrate', { weight: 0.8 }),
      s('B', 'play_bow', { parallel: true }),
      s('A', 'trick', { weight: 1.4 }),
      s('B', 'sit', { parallel: true }),
      s('B', 'celebrate', { weight: 0.8 }),
      s('A', 'play_bow', { parallel: true }),
    ]),
    {
      id: 'encore',
      weight: 1,
      steps: [
        s('both', 'approach', { toward: 'meet', gap: 1.4, pace: 0.4, weight: 0.8 }),
        s('A', 'roll_over', { weight: 1 }),
        s('B', 'celebrate', { parallel: true }),
        s('B', 'trick', { weight: 1.2 }),
        s('A', 'sit', { gesture: 'big_stretch', parallel: true }),
      ],
    },
  ]),
  'trick-cross': story([
    classic([
      s('cat', 'approach', { toward: 'partner', gap: 1.5, pace: 0.4, weight: 1 }),
      s('dog', 'sit', { parallel: true }),
      s('dog', 'play_bow', { weight: 0.8 }),
      s('cat', 'trick', { weight: 1.5 }),
      s('dog', 'sit', { parallel: true }),
      s('dog', 'trick', { weight: 1.4 }),
      s('cat', 'sit', { parallel: true }),
      s('both', 'celebrate', { weight: 0.8 }),
    ]),
    {
      id: 'encore',
      weight: 1,
      steps: [
        s('cat', 'trick', { weight: 1.2 }),
        s('dog', 'sit', { gesture: 'head_tilt', parallel: true }),
        s('dog', 'roll_over', { weight: 1 }),
        s('cat', 'celebrate', { parallel: true }),
      ],
    },
  ]),
};
