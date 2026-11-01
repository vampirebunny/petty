import { buildBeats, lookForRound, modelsForViewer, skipToNextModel, skipToNextRound, venueScrolls } from '../playback';
import type { LocalRunwayShow } from '../types';

function show(): LocalRunwayShow {
  return {
    id: 's1',
    mode: 'solo',
    themeId: 'royal',
    trackId: 'fashion-show-music',
    createdAt: 1,
    submissions: [
      {
        submissionId: 'self',
        pet: {
          snapshotId: 'self',
          source: 'self',
          name: 'A',
          species: 'dog',
          breedId: 'retriever',
          look: { coat: '#111' },
          ageDays: 1,
          weight: 0,
        },
        looks: [
          { lookNumber: 1, pieces: [] },
          { lookNumber: 2, pieces: [] },
          { lookNumber: 3, pieces: [] },
        ],
        submittedAt: 10,
        claimedCostumeIds: [],
      },
      {
        submissionId: 'npc',
        pet: {
          snapshotId: 'npc',
          source: 'npc',
          name: 'B',
          species: 'cat',
          breedId: 'domesticShorthair',
          look: { coat: '#222' },
          ageDays: 1,
          weight: 0,
        },
        looks: [
          { lookNumber: 1, pieces: [] },
          { lookNumber: 2, pieces: [] },
          { lookNumber: 3, pieces: [] },
        ],
        submittedAt: 20,
        claimedCostumeIds: [],
      },
    ],
  };
}

describe('runway playback', () => {
  it('puts the viewer first then submission order', () => {
    const order = modelsForViewer(show(), 'self');
    expect(order.map((row) => row.submission.submissionId)).toEqual(['self', 'npc']);
  });

  it('skips a model and a round', () => {
    const beats = buildBeats(show(), 'self');
    expect(beats.length).toBeGreaterThan(10);
    const afterModel = skipToNextModel(beats, 0);
    expect(beats[afterModel].modelIndex).not.toBe(beats[0].modelIndex);
    const afterRound = skipToNextRound(beats, 0);
    expect(beats[afterRound].lookIndex).toBe(1);
  });

  it('plays the outfit for that look number', () => {
    const looks = [
      { lookNumber: 3, pieces: [] },
      { lookNumber: 1, pieces: [] },
    ];
    expect(lookForRound(looks, 0)?.lookNumber).toBe(1);
    expect(lookForRound(looks, 2)?.lookNumber).toBe(3);
  });

  it('scrolls only on walkOut and walkBack', () => {
    expect(venueScrolls('enter')).toBe('still');
    expect(venueScrolls('walkOut')).toBe('out');
    expect(venueScrolls('stop')).toBe('still');
    expect(venueScrolls('pose')).toBe('still');
    expect(venueScrolls('turn')).toBe('still');
    expect(venueScrolls('walkBack')).toBe('back');
    expect(venueScrolls('exit')).toBe('still');
  });
});
