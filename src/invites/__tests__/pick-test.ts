import { soonestRace, retargetRace } from '../pick';
import type { RaceOption } from '../types';

const minute = 60 * 1000;

function card(partial: Partial<RaceOption> & Pick<RaceOption, 'eventId' | 'event' | 'startsAt'>): RaceOption {
  return {
    cup: 'open',
    classId: 'beginner',
    state: 'open',
    ...partial,
  };
}

describe('race invitation picking', () => {
  const now = Date.parse('2026-10-31T16:00:00Z');

  it('skips a start inside two minutes and does not assume hurdles every slot', () => {
    const options = [
      card({ eventId: 'soon-hurdles', event: 'hurdles', startsAt: now + minute }),
      card({ eventId: 'fun', event: 'funRun', startsAt: now + 3 * minute }),
      card({ eventId: 'later-hurdles', event: 'hurdles', startsAt: now + 8 * minute }),
    ];
    expect(soonestRace(options, now, false)?.eventId).toBe('fun');
    expect(retargetRace(options, 'hurdles', now)?.eventId).toBe('later-hurdles');
  });

  it('prefers a fun run for the first race when one is open', () => {
    const options = [
      card({ eventId: 'dive', event: 'dockDive', startsAt: now + 3 * minute, classId: 'open' }),
      card({ eventId: 'fun', event: 'funRun', startsAt: now + 6 * minute, classId: 'open' }),
    ];
    expect(soonestRace(options, now, true)?.eventId).toBe('fun');
    expect(soonestRace(options, now, false)?.eventId).toBe('dive');
  });

  it('ignores cards that are not open or not playable', () => {
    const options = [
      card({ eventId: 'resting', event: 'funRun', startsAt: now + 3 * minute, state: 'resting' }),
      card({ eventId: 'weave', event: 'weave', startsAt: now + 3 * minute }),
      card({ eventId: 'closed', event: 'hurdles', startsAt: now + 3 * minute, state: 'closed' }),
    ];
    expect(soonestRace(options, now, true)).toBeNull();
  });
});
