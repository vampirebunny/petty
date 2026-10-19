import { CuddleGesture } from '../cuddleGesture';
import type { GestureEvent } from '../cuddleGesture';
import type { CuddleZone } from '../../actor/types';

// Feeds a straight horizontal drag at `speed` px/s, sampled every 16 ms.
function drag(
  gesture: CuddleGesture,
  distance: number,
  speed: number,
  zone: CuddleZone | null = 'back',
  startT = 0,
  startX = 0,
): GestureEvent[] {
  const events: GestureEvent[] = [];
  const step = (speed * 16) / 1000;
  let x = startX;
  let t = startT;
  events.push(...gesture.move(x, 0, t, zone));
  while (x - startX < distance) {
    x += step;
    t += 16;
    events.push(...gesture.move(x, 0, t, zone));
  }
  return events;
}

const count = (events: GestureEvent[], type: GestureEvent['type']) => events.filter((e) => e.type === type).length;

describe('stroke', () => {
  it('counts a steady drag as strokes, with a trail', () => {
    const gesture = new CuddleGesture();
    gesture.begin();
    const events = drag(gesture, 220, 200);
    expect(count(events, 'stroke')).toBe(5);
    expect(count(events, 'move')).toBeGreaterThan(10);
    expect(count(events, 'tooFast')).toBe(0);
  });

  it('spawns one heart for every third stroke', () => {
    const gesture = new CuddleGesture();
    gesture.begin();
    const events = drag(gesture, 40 * 9 + 5, 250);
    expect(count(events, 'stroke')).toBe(9);
    expect(count(events, 'heart')).toBe(3);
  });

  it('keeps the heart rhythm when the finger lifts', () => {
    const gesture = new CuddleGesture();
    gesture.begin();
    drag(gesture, 85, 250);
    gesture.begin();
    const events = drag(gesture, 45, 250, 'back', 5000);
    expect(count(events, 'heart')).toBe(1);
  });

  it('ignores a hold that is too slow and a drag off the pet', () => {
    const slow = new CuddleGesture();
    slow.begin();
    expect(drag(slow, 100, 8)).toEqual([]);
    const off = new CuddleGesture();
    off.begin();
    expect(drag(off, 200, 200, null)).toEqual([]);
  });
});

describe('too fast', () => {
  it('shows no trail and no hearts, and flinches once', () => {
    const gesture = new CuddleGesture();
    gesture.begin();
    const events = drag(gesture, 400, 2500);
    expect(count(events, 'tooFast')).toBe(1);
    expect(count(events, 'move')).toBe(0);
    expect(count(events, 'stroke')).toBe(0);
    expect(count(events, 'heart')).toBe(0);
  });

  it('flinches again only after the cooldown', () => {
    const gesture = new CuddleGesture();
    gesture.begin();
    const first = drag(gesture, 300, 2500);
    expect(count(first, 'tooFast')).toBe(1);
    const later = drag(gesture, 300, 2500, 'back', 2000, 400);
    expect(count(later, 'tooFast')).toBe(1);
  });
});

describe('scratch', () => {
  function scratch(gesture: CuddleGesture, zone: CuddleZone, reversals: number, stepMs = 40): GestureEvent[] {
    const events: GestureEvent[] = [];
    let x = 0;
    let t = 0;
    let dir = 1;
    events.push(...gesture.move(x, 0, t, zone));
    for (let r = 0; r <= reversals; r += 1) {
      for (let i = 0; i < 3; i += 1) {
        x += dir * 6;
        t += stepMs;
        events.push(...gesture.move(x, 0, t, zone));
      }
      dir = -dir;
    }
    return events;
  }

  it('fires on 3 reversals within 600 ms over the head, and not as strokes', () => {
    const gesture = new CuddleGesture();
    gesture.begin();
    const events = scratch(gesture, 'head', 4);
    expect(count(events, 'scratch')).toBe(1);
    expect(count(events, 'stroke')).toBe(0);
  });

  it('does not fire on the back or when the reversals are too slow', () => {
    const back = new CuddleGesture();
    back.begin();
    expect(count(scratch(back, 'back', 4), 'scratch')).toBe(0);
    const slow = new CuddleGesture();
    slow.begin();
    expect(count(scratch(slow, 'head', 4, 400), 'scratch')).toBe(0);
  });

  it('does not fire on a straight stroke over the head', () => {
    const gesture = new CuddleGesture();
    gesture.begin();
    const events = drag(gesture, 200, 250, 'head');
    expect(count(events, 'scratch')).toBe(0);
    expect(count(events, 'stroke')).toBe(5);
  });
});
