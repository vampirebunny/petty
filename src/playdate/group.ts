import { sceneById } from '../actor/scenes';
import { playdateConfig } from './config';
import { pickIndex, rngFrom } from './rng';
import type { ActivityDefinition, Beat, PetSnapshot, PlaydateOutcome } from './types';

export const groupActivities: ActivityDefinition[] = [
  {
    id: 'conga',
    name: 'Conga',
    speciesPairs: ['dog-dog', 'cat-cat', 'dog-cat'],
    scenes: 'any',
    attributesTrained: { stamina: 3, agility: 2 },
    templates: { 'dog-dog': null, 'cat-cat': null, 'dog-cat': null },
  },
  {
    id: 'line',
    name: 'Line dance',
    speciesPairs: ['dog-dog', 'cat-cat', 'dog-cat'],
    scenes: 'any',
    attributesTrained: { obedience: 3, affection: 2 },
    templates: { 'dog-dog': null, 'cat-cat': null, 'dog-cat': null },
  },
  {
    id: 'wave',
    name: 'The wave',
    speciesPairs: ['dog-dog', 'cat-cat', 'dog-cat'],
    scenes: 'any',
    attributesTrained: { agility: 3, affection: 2 },
    templates: { 'dog-dog': null, 'cat-cat': null, 'dog-cat': null },
  },
  {
    id: 'pass',
    name: 'Pass the toy',
    speciesPairs: ['dog-dog', 'cat-cat', 'dog-cat'],
    scenes: 'any',
    attributesTrained: { intelligence: 3, affection: 2 },
    templates: { 'dog-dog': null, 'cat-cat': null, 'dog-cat': null },
  },
];

type Floor = { xMin: number; xMax: number; yMin: number; yMax: number };
type Point = { x: number; y: number };

function clamp(floor: Floor, x: number, y: number): Point {
  const pad = 36;
  return {
    x: Math.min(floor.xMax - pad, Math.max(floor.xMin + pad, x)),
    y: Math.min(floor.yMax - pad, Math.max(floor.yMin + pad, y)),
  };
}

function rowSpots(floor: Floor, count: number): Point[] {
  const y = (floor.yMin + floor.yMax) / 2;
  const left = floor.xMin + 56;
  const right = floor.xMax - 56;
  if (count <= 1) {
    return [clamp(floor, (left + right) / 2, y)];
  }
  return Array.from({ length: count }, (_, index) => clamp(floor, left + ((right - left) * index) / (count - 1), y));
}

function arcSpots(floor: Floor, count: number): Point[] {
  const midY = (floor.yMin + floor.yMax) / 2;
  return rowSpots(floor, count).map((spot, index) => {
    const lift = count <= 1 ? 0 : Math.sin((index / (count - 1)) * Math.PI) * 36;
    return clamp(floor, spot.x, midY + lift);
  });
}

function loopPoints(floor: Floor): Point[] {
  const left = floor.xMin + 72;
  const right = floor.xMax - 72;
  const back = floor.yMin + 48;
  const front = floor.yMax - 48;
  const midX = (left + right) / 2;
  const midY = (back + front) / 2;
  return [
    clamp(floor, left, midY),
    clamp(floor, midX, back),
    clamp(floor, right, midY),
    clamp(floor, midX, front),
  ];
}

function one(slot: number, t: number, action: string, point?: Point, extra: Partial<Beat> = {}): Beat {
  return {
    t,
    actor: 'all',
    slot,
    action,
    ...(point ? { params: { x: point.x, y: point.y, pace: action === 'approach' ? 0.62 : 0.35 } } : {}),
    ...extra,
  };
}

function every(t: number, action: string, extra: Partial<Beat> = {}): Beat {
  return { t, actor: 'all', action, ...extra };
}

function lineup(beats: Beat[], spots: readonly Point[], t: number, action = 'approach'): void {
  spots.forEach((spot, slot) => {
    beats.push(one(slot, t, action, spot));
  });
}

function finish(beats: Beat[]): Beat[] {
  return beats.sort((a, b) => a.t - b.t || (a.slot ?? 999) - (b.slot ?? 999));
}

function conga(floor: Floor, count: number): Beat[] {
  const beats: Beat[] = [];
  const path = loopPoints(floor);
  let step = 0;
  for (let lap = 0; lap < 2; lap += 1) {
    for (const point of path) {
      for (let slot = 0; slot < count; slot += 1) {
        beats.push(one(slot, step * 3200 + slot * 480, 'approach', point));
      }
      step += 1;
    }
  }
  lineup(beats, rowSpots(floor, count), step * 3200 + count * 480, 'approach');
  beats.push(every(step * 3200 + count * 480 + 3500, 'sit'));
  return finish(beats);
}

function lineDance(floor: Floor, count: number): Beat[] {
  const beats: Beat[] = [];
  const row = rowSpots(floor, count);
  lineup(beats, row, 0);
  row.forEach((spot, slot) => {
    beats.push(one(slot, 4500, 'approach', clamp(floor, spot.x + 28, spot.y)));
    beats.push(one(slot, 7500, 'approach', spot));
  });
  beats.push(every(10500, 'jump'));
  beats.push(every(13500, 'celebrate', { sfx: 'happy' }));
  beats.push(every(17000, 'sit'));
  return finish(beats);
}

function wave(floor: Floor, count: number): Beat[] {
  const beats: Beat[] = [];
  lineup(beats, rowSpots(floor, count), 0);
  for (let slot = 0; slot < count; slot += 1) {
    beats.push(one(slot, 4000 + slot * 550, 'jump'));
  }
  const back = 4000 + count * 550;
  for (let slot = count - 1; slot >= 0; slot -= 1) {
    beats.push(one(slot, back + (count - 1 - slot) * 550, 'celebrate'));
  }
  beats.push(every(back + count * 550 + 800, 'sit'));
  return finish(beats);
}

function pass(floor: Floor, count: number): Beat[] {
  const beats: Beat[] = [];
  const spots = arcSpots(floor, count);
  lineup(beats, spots, 0, 'sit');
  const order = [...Array(count).keys(), 0];
  order.forEach((holder, index) => {
    const t = 2500 + index * 2200;
    const spot = spots[holder];
    for (let slot = 0; slot < count; slot += 1) {
      if (slot === holder) {
        beats.push(
          one(slot, t, 'pick_up', spot, {
            prop: { kind: 'ball', holderSlot: holder, at: { x: spot.x, y: spot.y } },
          }),
        );
      } else {
        beats.push(one(slot, t, 'sit', spots[slot]));
      }
    }
  });
  const end = 2500 + order.length * 2200;
  beats.push(every(end, 'celebrate', { sfx: 'happy' }));
  beats.push(every(end + 2500, 'sit'));
  return finish(beats);
}

export function generateGroupPlaydate(input: {
  pets: readonly PetSnapshot[];
  activity: ActivityDefinition;
  sceneId: string;
}): { beats: Beat[]; outcome: PlaydateOutcome } {
  const floor = sceneById(input.sceneId).floor;
  const count = input.pets.length;
  const beats =
    input.activity.id === 'line'
      ? lineDance(floor, count)
      : input.activity.id === 'wave'
        ? wave(floor, count)
        : input.activity.id === 'pass'
          ? pass(floor, count)
          : conga(floor, count);
  return {
    beats,
    outcome: {
      moodDelta: playdateConfig.happinessGain,
      attributeXp: { ...input.activity.attributesTrained },
      bondDelta: playdateConfig.bondGain,
      rareEvents: [],
    },
  };
}

// Three of the four group activities. Stable for one day, guest list, and room.
export function offerGroupActivities(
  guests: readonly { snapshotId: string }[],
  sceneId: string,
  date: string,
): ActivityDefinition[] {
  const pool = groupActivities.slice();
  const picked: ActivityDefinition[] = [];
  const rng = rngFrom(date, guests.map((guest) => guest.snapshotId).join(','), sceneId, 'group');
  while (picked.length < 3 && pool.length > 0) {
    const index = pickIndex(rng, pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}
