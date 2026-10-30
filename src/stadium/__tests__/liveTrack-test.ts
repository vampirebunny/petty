import { liveFinish, liveStateOf, parseLiveState, pushSample, sampleLive, type LiveState } from '../liveTrack';

function state(t: number, x: number, extra: Partial<LiveState> = {}): LiveState {
  return {
    entryId: 'friend',
    t,
    x,
    v: 8,
    finishMs: null,
    jumpX: null,
    airM: 0,
    duckX: null,
    duckUntilX: 0,
    clipAtMs: null,
    bonkAtMs: null,
    outcomes: [],
    outcomeMs: [],
    ...extra,
  };
}

it('reads a runner into the broadcast shape', () => {
  const live = liveStateOf('me', {
    x: 12,
    v: 9,
    tMs: 1500,
    finishMs: null,
    jumpX: 10,
    clipAtMs: 1200,
    outcomes: ['clip', 'perfect'],
    outcomeMs: [1200, 1400],
  }, 1.6);
  expect(live).toMatchObject({ entryId: 'me', t: 1500, x: 12, jumpX: 10, airM: 1.6, outcomes: ['clip', 'perfect'] });
  expect(parseLiveState(live)).toEqual(live);
});

it('rejects payloads that are malformed or out of range', () => {
  expect(parseLiveState(null)).toBeNull();
  expect(parseLiveState({ ...state(100, 5), entryId: '' })).toBeNull();
  expect(parseLiveState({ ...state(100, 5), x: Number.NaN })).toBeNull();
  expect(parseLiveState({ ...state(100, 5), v: 999 })).toBeNull();
  expect(parseLiveState({ ...state(100, 5), t: -1 })).toBeNull();
  expect(parseLiveState({ ...state(100, 5), finishMs: 'soon' })).toBeNull();
  expect(parseLiveState({ ...state(100, 5), outcomes: ['perfect'], outcomeMs: [] })).toBeNull();
  expect(parseLiveState({ ...state(100, 5), outcomes: ['teleport'], outcomeMs: [50] })).toBeNull();
  expect(parseLiveState({ entryId: 'a', t: 10, x: 1, v: 2 })).toMatchObject({ jumpX: null, outcomes: [], finishMs: null });
});

it('interpolates distance between the two samples around the render time', () => {
  let track = pushSample(undefined, state(1000, 10), 0);
  track = pushSample(track, state(1100, 11, { v: 10 }), 0);
  const view = sampleLive(track, 1050, 0);
  expect(view?.x).toBeCloseTo(10.5);
  expect(view?.v).toBeCloseTo(9);
  expect(view?.t).toBe(1050);
  expect(view?.stale).toBe(false);
});

it('keeps samples in race order and holds the newest when the clock runs ahead', () => {
  let track = pushSample(undefined, state(1100, 11), 0);
  track = pushSample(track, state(1000, 10), 0);
  expect(track.samples.map((s) => s.t)).toEqual([1000, 1100]);
  expect(sampleLive(track, 5000, 0)?.x).toBe(11);
  expect(sampleLive(track, 500, 0)?.x).toBe(10);
});

it('goes stale after the timeout and recovers on the next update', () => {
  let track = pushSample(undefined, state(1000, 10), 0);
  const frozen = sampleLive(track, 4000, 3500);
  expect(frozen).toMatchObject({ stale: true, x: 10, v: 0 });
  track = pushSample(track, state(4200, 40), 3600);
  expect(sampleLive(track, 4300, 3600)).toMatchObject({ stale: false, x: 40 });
});

it('reports the finish from the newest sample that has one', () => {
  let track = pushSample(undefined, state(9000, 69), 0);
  expect(liveFinish(track)).toBeNull();
  track = pushSample(track, state(9100, 70.2, { finishMs: 9050 }), 0);
  expect(liveFinish(track)).toBe(9050);
  expect(liveFinish(undefined)).toBeNull();
});
