import { buildBeats, modelsForViewer, skipToNextModel, skipToNextRound } from '../playback';
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
});
