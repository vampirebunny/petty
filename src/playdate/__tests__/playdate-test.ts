import { attributeScore, withDerived } from '../../sim/attributes';
import { createWorld, sceneById, setDirection, spawnActor, update } from '../../actor';
import { testPet } from '../../sim/__fixtures__/pets';
import type { Stats } from '../../sim/types';
import { activityById, legalActivities, offerActivities, speciesCanPlay } from '../activities';
import { closingActions, playdateConfig, warmupActions } from '../config';
import { bodyOf, separate } from '../contact';
import { getCooldownRemaining } from '../cooldown';
import { beatAt, directionFor, playdateEndMs, poseFor, replayBeats, targetFor } from '../direct';
import { generatePlaydate } from '../generate';
import { dailyCast, generateCast } from '../npcs';
import { createPlaydateRecord } from '../record';
import { applyPlaydateRewards, attributeGains } from '../rewards';
import { clearPet, emptyPlaydateSave, settlePlaydate } from '../save';
import { voiceCues } from '../voice';
import { actorSourceOf, snapshotPet } from '../snapshot';
import type { ActivityDefinition, PetSnapshot, PlaydateRecord } from '../types';

const stats = (value: number): Stats => ({
  stamina: value,
  agility: value,
  intelligence: value,
  boldness: value,
  affection: value,
  obedience: value,
});

function snap(patch: Partial<PetSnapshot> & { snapshotId: string }): PetSnapshot {
  const base: PetSnapshot = {
    source: 'npc',
    name: patch.snapshotId,
    species: 'dog',
    breedId: 'retriever',
    look: { coat: '#d9a441' },
    equipped: {},
    ageDays: 16,
    weight: 0,
    vitality: 1,
    seed: 1,
    originArchetype: 'athlete',
    currentStyle: 'athlete',
    attributes: stats(50),
    potential: stats(80),
    favoriteActivities: [],
    partyTricks: ['paw'],
    createdAt: 't',
    snapshotId: patch.snapshotId,
  };
  return {
    ...base,
    ...patch,
    attributes: { ...base.attributes, ...patch.attributes },
    potential: { ...base.potential, ...patch.potential },
  };
}

function activity(id: string): ActivityDefinition {
  const found = activityById(id);
  if (!found) {
    throw new Error(id);
  }
  return found;
}

function recordFor(id: string, partnerId: string, petId = 'pet'): PlaydateRecord {
  const petA = snap({ snapshotId: `${id}-a`, petId, source: 'self', name: 'Pip' });
  const petB = snap({ snapshotId: partnerId, name: 'Miso' });
  return {
    version: 1,
    playdateId: id,
    ownerId: 'owner',
    createdAt: '2026-10-19T12:00:00.000Z',
    sceneId: 'park',
    hour: 14,
    petA,
    petB,
    activityId: 'nap',
    outfit: { hat: 'beanie' },
    seed: 1,
    beats: [{ t: 0, actor: 'both', action: 'nap' }],
    outcome: { moodDelta: 12, attributeXp: { affection: 3 }, bondDelta: 8, rareEvents: [] },
  };
}

describe('playdate generator', () => {
  const bold = snap({ snapshotId: 'bold', attributes: { ...stats(50), boldness: 80, affection: 20 } });
  const shy = snap({ snapshotId: 'shy', attributes: { ...stats(50), boldness: 10, affection: 20 } });
  const cat = snap({
    snapshotId: 'cat',
    species: 'cat',
    breedId: 'domesticShorthair',
    attributes: { ...stats(50), boldness: 80, affection: 20 },
  });

  it('returns the same beats for the same inputs and seed', () => {
    const input = { petA: bold, petB: shy, activity: activity('race'), sceneId: 'park', seed: 7 };
    expect(generatePlaydate(input).beats).toEqual(generatePlaydate(input).beats);
  });

  it('replays the saved beats without generating them again', () => {
    const pet = testPet(4, 'retriever', 1_000, 'Pip', 'pet');
    const record = createPlaydateRecord({
      pet,
      partner: shy,
      activity: activity('nap'),
      sceneId: 'park',
      outfit: { hat: 'beanie' },
      seed: 11,
      createdAt: '2026-10-19T18:00:00.000Z',
      ownerId: 'owner',
    });
    expect(record.hour).toBe(14);
    expect(replayBeats(record)).toBe(record.beats);
    expect(generatePlaydate({ petA: record.petA, petB: record.petB, activity: activity('nap'), sceneId: 'park', seed: 11 }).beats).toEqual(
      record.beats,
    );
  });

  it('stays between 45 and 90 seconds and ends warmly', () => {
    const generated = generatePlaydate({ petA: bold, petB: bold, activity: activity('chase'), sceneId: 'park', seed: 3 });
    const end = playdateEndMs(generated.beats);
    expect(end).toBeGreaterThanOrEqual(45_000);
    expect(end).toBeLessThanOrEqual(90_000);
    expect(closingActions).toContain(generated.beats[generated.beats.length - 1].action);
  });

  it('opens a shy pairing with warm-up beats', () => {
    const generated = generatePlaydate({ petA: shy, petB: shy, activity: activity('race'), sceneId: 'park', seed: 2 });
    expect(generated.beats.slice(0, 3).map((beat) => beat.action)).toEqual(['sniff', 'hide', 'approach']);
    expect(warmupActions).toContain(generated.beats[0].action);
    expect(closingActions).toContain(generated.beats[generated.beats.length - 1].action);
  });

  it('uses a different template for a dog and a cat', () => {
    const dogs = generatePlaydate({ petA: bold, petB: bold, activity: activity('fetch'), sceneId: 'park', seed: 5 });
    const mixed = generatePlaydate({ petA: bold, petB: cat, activity: activity('fetch'), sceneId: 'park', seed: 5 });
    expect(mixed.beats.map((beat) => beat.action)).toContain('pounce');
    expect(dogs.beats.map((beat) => beat.action)).not.toContain('pounce');
    expect(mixed.beats.map((beat) => beat.action).join()).not.toBe(dogs.beats.map((beat) => beat.action).join());
  });

  it('places a few voices inside the playdate, the same way each time', () => {
    const cues = voiceCues(4, 60_000);
    expect(cues.length).toBeGreaterThanOrEqual(2);
    expect(cues.length).toBeLessThanOrEqual(3);
    expect(voiceCues(4, 60_000)).toEqual(cues);
    for (const cue of cues) {
      expect(cue.t).toBeGreaterThan(0);
      expect(cue.t).toBeLessThan(52_000);
      expect(cue.actor === 'A' || cue.actor === 'B').toBe(true);
    }
  });

  it('skips an unknown action and keeps the previous beat', () => {
    const beats = [
      { t: 0, actor: 'A' as const, action: 'sit' },
      { t: 1000, actor: 'A' as const, action: 'teleport' },
    ];
    expect(poseFor('teleport')).toBeNull();
    expect(beatAt(beats, 1500, 'A')?.action).toBe('sit');
  });
});

describe('playdate roster and activities', () => {
  it('keeps a mixed cast and a stable daily trio', () => {
    const cast = generateCast('owner-1');
    expect(cast.length).toBeGreaterThanOrEqual(10);
    expect(cast.length).toBeLessThanOrEqual(12);
    expect(cast.some((pet) => pet.species === 'dog')).toBe(true);
    expect(cast.some((pet) => pet.species === 'cat')).toBe(true);
    for (const pet of cast) {
      expect(Object.keys(pet.equipped).length).toBeGreaterThanOrEqual(1);
      expect(Object.keys(pet.equipped).length).toBeLessThanOrEqual(3);
      for (const favorite of pet.favoriteActivities) {
        const found = activityById(favorite);
        expect(found && speciesCanPlay(found, pet.species)).toBe(true);
      }
    }
    const today = dailyCast(cast, 'owner-1', '2026-10-19');
    expect(dailyCast(cast, 'owner-1', '2026-10-19').map((pet) => pet.snapshotId)).toEqual(today.map((pet) => pet.snapshotId));
    expect(today.some((pet) => pet.species === 'dog')).toBe(true);
    expect(today.some((pet) => pet.species === 'cat')).toBe(true);
    const changed = ['20', '21', '22', '23', '24', '25', '26'].some(
      (day) => dailyCast(cast, 'owner-1', `2026-10-${day}`).map((pet) => pet.snapshotId).join() !== today.map((pet) => pet.snapshotId).join(),
    );
    expect(changed).toBe(true);
  });

  it('hides a race from a senior and splash from anywhere but the park', () => {
    const adult = snap({ snapshotId: 'adult', ageDays: 16 });
    const senior = snap({ snapshotId: 'senior', ageDays: 24 });
    const park = legalActivities(adult, senior, 'park').map((entry) => entry.id);
    const room = legalActivities(adult, adult, 'livingroom').map((entry) => entry.id);
    expect(park).not.toContain('race');
    expect(park).toContain('splash');
    expect(room).not.toContain('splash');
    expect(room).toContain('race');
  });

  it('offers a dog and a cat their own activities', () => {
    const dog = snap({ snapshotId: 'dog', ageDays: 16 });
    const kitten = snap({ snapshotId: 'kitten', species: 'cat', breedId: 'siamese', ageDays: 16 });
    const ids = legalActivities(dog, kitten, 'park').map((entry) => entry.id);
    expect(ids).not.toContain('tug');
    expect(ids).not.toContain('splash');
    expect(ids).toContain('race');
    expect(legalActivities(dog, kitten, 'park', false)).toEqual([]);
  });

  it('keeps activity options stable for a day and leans on favorites', () => {
    const dog = snap({ snapshotId: 'dog' });
    const partner = snap({ snapshotId: 'pal', favoriteActivities: ['nap'] });
    const first = offerActivities(dog, partner, 'park', '2026-10-19').map((entry) => entry.id);
    expect(offerActivities(dog, partner, 'park', '2026-10-19').map((entry) => entry.id)).toEqual(first);
    let nap = 0;
    let tug = 0;
    for (let day = 1; day <= 40; day += 1) {
      const ids = offerActivities(dog, partner, 'park', `2026-11-${String(day).padStart(2, '0')}`).map((entry) => entry.id);
      if (ids.includes('nap')) {
        nap += 1;
      }
      if (ids.includes('tug')) {
        tug += 1;
      }
    }
    expect(nap).toBeGreaterThan(tug);
  });
});

describe('playdate rewards, cooldown, and history', () => {
  it('caps happiness and attributes and leaves level, bond, and outfit alone', () => {
    const pet = testPet(8, 'corgi', 50, 'Pip', 'pet');
    pet.needs.happiness = 95;
    pet.attributes.current.agility = pet.attributes.potential.agility - 1;
    const xp = pet.xp;
    const bond = pet.bond;
    const equipped = { ...pet.equipped };
    const next = applyPlaydateRewards(pet, {
      moodDelta: playdateConfig.happinessGain,
      attributeXp: { agility: 10 },
      bondDelta: playdateConfig.bondGain,
      rareEvents: [],
    });
    expect(next.needs.happiness).toBe(100);
    expect(next.attributes.current.agility).toBe(pet.attributes.potential.agility);
    expect(next.xp).toBe(xp);
    expect(next.bond).toBe(bond);
    expect(next.equipped).toEqual(equipped);
  });

  it('raises the attributes the activity trains, even when natural growth is ahead', () => {
    const grown = withDerived({ ...testPet(8, 'corgi', 50, 'Pip', 'pet'), ageDays: 80 });
    const affection = attributeScore(grown, 'affection');
    const stamina = attributeScore(grown, 'stamina');
    const agility = attributeScore(grown, 'agility');
    const napped = applyPlaydateRewards(grown, {
      moodDelta: 0,
      attributeXp: { affection: 3 },
      bondDelta: 0,
      rareEvents: [],
    });
    expect(attributeScore(napped, 'affection')).toBeGreaterThan(affection);
    expect(attributeScore(napped, 'stamina')).toBeCloseTo(stamina);
    expect(napped.attributes.current.stamina).toBe(grown.attributes.current.stamina);

    const raced = applyPlaydateRewards(grown, {
      moodDelta: 0,
      attributeXp: { agility: 4, stamina: 2 },
      bondDelta: 0,
      rareEvents: [],
    });
    expect(attributeScore(raced, 'agility')).toBeGreaterThan(agility);
    expect(attributeScore(raced, 'stamina')).toBeGreaterThan(stamina);
    expect(raced.attributes.current.affection).toBe(grown.attributes.current.affection);
  });

  it('pays a playdate once and keeps only the newest three', () => {
    const pet = testPet(8, 'corgi', 50, 'Pip', 'pet');
    let save = emptyPlaydateSave();
    save = { ...save, cast: generateCast('owner') };
    const cast = save.cast;
    let paid = pet;
    for (let i = 1; i <= 4; i += 1) {
      const settled = settlePlaydate(save, paid, recordFor(`pd-${i}`, `npc-${i}`), i * 1000);
      expect(settled.applied).toBe(true);
      save = settled.save;
      paid = settled.pet;
    }
    expect(save.history.map((entry) => entry.playdateId)).toEqual(['pd-4', 'pd-3', 'pd-2']);
    expect(save.relationships.pet['npc-1'].bond).toBe(playdateConfig.bondGain);
    expect(save.cast).toBe(cast);
    const again = settlePlaydate(save, paid, recordFor('pd-4', 'npc-4'), 9999);
    expect(again.applied).toBe(false);
    expect(again.pet.needs.happiness).toBe(paid.needs.happiness);
    expect(again.save.lastPlaydateCompletedAt).toBe(4000);
  });

  it('clears one pet and keeps the cast', () => {
    const pet = testPet(8, 'corgi', 50, 'Pip', 'pet');
    const settled = settlePlaydate(emptyPlaydateSave(), pet, recordFor('pd-1', 'npc-1'), 1000);
    const save = { ...settled.save, cast: generateCast('owner') };
    const cleared = clearPet(save, 'pet');
    expect(cleared.history).toEqual([]);
    expect(cleared.relationships.pet).toBeUndefined();
    expect(cleared.lastPlaydateCompletedAt).toBeNull();
    expect(cleared.cast).toBe(save.cast);
  });

  it('clamps a clock moved backward and follows the config', () => {
    const full = 60 * 60 * 1000;
    expect(getCooldownRemaining(1_000_000, 0, 60)).toBe(full);
    expect(getCooldownRemaining(0, full + 1, 60)).toBe(0);
    expect(getCooldownRemaining(0, 0, 10)).toBe(10 * 60 * 1000);
    const original = playdateConfig.cooldownMinutes;
    playdateConfig.cooldownMinutes = 15;
    expect(getCooldownRemaining(0, 0)).toBe(15 * 60 * 1000);
    playdateConfig.cooldownMinutes = original;
  });

  it('stores the playdate outfit without changing the everyday one', () => {
    const pet = testPet(8, 'corgi', 50, 'Pip', 'pet');
    pet.equipped = { collar: 'red' };
    const shot = snapshotPet(pet, { hat: 'beanie' }, 't', 'snap');
    expect(shot.equipped).toEqual({ hat: 'beanie' });
    expect(pet.equipped).toEqual({ collar: 'red' });
  });
});

describe('playdate choreography', () => {
  const dogA = snap({ snapshotId: 'dog-a', attributes: { ...stats(50), boldness: 80, agility: 70 } });
  const dogB = snap({ snapshotId: 'dog-b', attributes: { ...stats(50), boldness: 60, agility: 40 } });
  const ids = ['fetch', 'tug', 'race', 'chase', 'hide', 'sniff', 'splash', 'nap', 'trick'];

  function play(id: string, seed = 9) {
    return generatePlaydate({ petA: dogA, petB: dogB, activity: activity(id), sceneId: 'park', seed }).beats;
  }

  it('gives every activity its own sequence of moves', () => {
    const shapes = ids.map((id) =>
      play(id)
        .map((beat) => `${beat.actor}:${beat.action}:${beat.params?.toward ?? (beat.params?.spread ?? '')}`)
        .join('|'),
    );
    expect(new Set(shapes).size).toBe(ids.length);
  });

  it('sends the pets at each other: a chase has one following while the other runs away', () => {
    const beats = play('chase');
    const follows = beats.filter((beat) => beat.params?.toward === 'partner');
    const flees = beats.filter((beat) => beat.params?.toward === 'away');
    expect(follows.length).toBeGreaterThanOrEqual(2);
    expect(flees.length).toBeGreaterThanOrEqual(2);
    for (const run of follows) {
      expect(flees.some((other) => other.t === run.t && other.actor !== run.actor)).toBe(true);
    }
  });

  it('runs a race in two lanes to one finish, the winner faster', () => {
    const runs = play('race').filter((beat) => beat.action === 'run_to');
    expect(runs).toHaveLength(2);
    expect(runs[0].actor).not.toBe(runs[1].actor);
    expect(runs[0].t).toBe(runs[1].t);
    expect(runs[0].params?.x).toBe(runs[1].params?.x);
    expect(runs[0].params?.spread).toBe('y');
    expect(runs[0].params?.pace).toBeGreaterThan(runs[1].params?.pace ?? 1);
  });

  it('follows the partner, meets halfway, and runs away inside the floor', () => {
    const floor = sceneById('park').floor;
    const self = { x: 400, y: 300 };
    const other = { x: 200, y: 300 };
    const context = { self, other, reach: 100, floor };
    const follow = targetFor({ t: 0, actor: 'A', action: 'run_to', params: { toward: 'partner', gap: 1.5 } }, 'A', context);
    expect(follow).toEqual({ x: 350, y: 300 });
    const meet = targetFor({ t: 0, actor: 'both', action: 'approach', params: { toward: 'meet', gap: 1 } }, 'A', context);
    expect(meet?.x).toBe(350);
    const away = targetFor({ t: 0, actor: 'A', action: 'run_to', params: { toward: 'away' } }, 'A', context);
    expect(away).not.toBeNull();
    expect(away!.x).toBeGreaterThanOrEqual(floor.xMin);
    expect(away!.x).toBeLessThanOrEqual(floor.xMax);
    expect(away!.y).toBeGreaterThanOrEqual(floor.yMin);
    expect(away!.y).toBeLessThanOrEqual(floor.yMax);
    const cornered = targetFor(
      { t: 0, actor: 'A', action: 'run_to', params: { toward: 'away' } },
      'A',
      { ...context, self: { x: floor.xMax - 5, y: 300 } },
    );
    expect(cornered!.x).toBeLessThan(floor.xMax - 100);
  });

  it('keeps two pets from standing inside each other, and lets different rows pass', () => {
    const floor = sceneById('park').floor;
    const y = (floor.yMin + floor.yMax) / 2;
    const left = spawnActor(actorSourceOf(dogA), { x: 300, y });
    const right = spawnActor(actorSourceOf(dogB), { x: 320, y });
    const world = createWorld([left, right], 1, sceneById('park'));
    update(world, 0.05);
    const rx = (bodyOf(left, floor).radius + bodyOf(right, floor).radius) * 0.88;
    for (let i = 0; i < 90; i += 1) {
      separate(left, right, floor, 1 / 30);
    }
    expect(Math.hypot((right.x - left.x) / rx, (right.y - left.y) / 20)).toBeGreaterThanOrEqual(0.97);

    const front = spawnActor(actorSourceOf(dogA), { x: 300, y: y - 40 });
    const behind = spawnActor(actorSourceOf(dogB), { x: 310, y: y + 40 });
    separate(front, behind, floor, 1 / 30);
    expect([front.x, behind.x, front.y, behind.y]).toEqual([300, 310, y - 40, y + 40]);
  });
});

describe('playdate attribute gains', () => {
  it('reports before, after, and the gain for exactly the trained attributes', () => {
    const pet = withDerived({ ...testPet(8, 'corgi', 50, 'Pip', 'pet'), ageDays: 80 });
    const outcome = { moodDelta: 12, attributeXp: { stamina: 3, agility: 2 }, bondDelta: 8, rareEvents: [] };
    const gains = attributeGains(pet, outcome);
    expect(gains.map((entry) => entry.trait).sort()).toEqual(['agility', 'stamina']);
    for (const entry of gains) {
      expect(entry.before).toBeCloseTo(attributeScore(pet, entry.trait));
      expect(entry.after).toBeCloseTo(attributeScore(applyPlaydateRewards(pet, outcome), entry.trait));
      expect(entry.gain).toBeCloseTo(entry.after - entry.before);
      expect(entry.gain).toBeGreaterThan(0);
      expect(entry.potential).toBe(pet.attributes.potential[entry.trait]);
    }
  });

  it('shows no gain once the attribute is at its cap', () => {
    const pet = withDerived({ ...testPet(8, 'corgi', 50, 'Pip', 'pet'), ageDays: 400 });
    pet.attributes.current.affection = pet.attributes.potential.affection;
    pet.drift.affection = 0;
    const [entry] = attributeGains(pet, { moodDelta: 0, attributeXp: { affection: 3 }, bondDelta: 0, rareEvents: [] });
    expect(entry.gain).toBeGreaterThanOrEqual(0);
    expect(entry.after).toBeLessThanOrEqual(entry.potential);
  });
});

describe('playdate playback', () => {
  const dogA = snap({ snapshotId: 'dog-a', attributes: { ...stats(60), boldness: 80, agility: 70 } });
  const dogB = snap({ snapshotId: 'dog-b', attributes: { ...stats(60), boldness: 60, agility: 40 } });

  // Runs the same loop the stage runs, without drawing.
  function simulate(id: string, seed: number) {
    const sceneId = id === 'splash' ? 'park' : 'livingroom';
    const { beats } = generatePlaydate({ petA: dogA, petB: dogB, activity: activity(id), sceneId, seed });
    const scene = sceneById(sceneId);
    const floor = scene.floor;
    const y = (floor.yMin + floor.yMax) / 2;
    const left = spawnActor(actorSourceOf(dogA), { x: 200, y });
    const right = spawnActor(actorSourceOf(dogB), { x: 440, y });
    const world = createWorld([left, right], seed, scene);
    const end = playdateEndMs(beats);
    const dt = 1 / 30;
    let closest = Infinity;
    let overlap = Infinity;
    for (let elapsed = 0; elapsed < end; elapsed += dt * 1000) {
      const reach = bodyOf(left, floor).radius + bodyOf(right, floor).radius;
      const beatA = beatAt(beats, elapsed, 'A');
      const beatB = beatAt(beats, elapsed, 'B');
      if (beatA) {
        setDirection(left, directionFor(beatA, 'A', { self: left, other: right, reach, floor }));
      }
      if (beatB) {
        setDirection(right, directionFor(beatB, 'B', { self: right, other: left, reach, floor }));
      }
      update(world, dt);
      separate(left, right, floor, dt);
      const rx = reach * 0.88;
      const gap = Math.hypot((right.x - left.x) / rx, (right.y - left.y) / 20);
      // A jump is not a walk-through: separation only applies while both pets are on the floor.
      if (left.z <= 8 && right.z <= 8) {
        overlap = Math.min(overlap, gap);
      }
      closest = Math.min(closest, Math.abs(right.x - left.x) / reach);
    }
    return { closest, overlap };
  }

  const ids = ['fetch', 'tug', 'race', 'chase', 'hide', 'sniff', 'splash', 'nap', 'trick'];

  it('never lets one pet walk through the other, in any activity', () => {
    for (const id of ids) {
      for (const seed of [1, 2, 3]) {
        const { overlap } = simulate(id, seed);
        expect({ id, seed, ok: overlap > 0.7 }).toEqual({ id, seed, ok: true });
      }
    }
  });

  it('brings the pets close for the activities that are about contact', () => {
    for (const id of ['tug', 'chase', 'sniff', 'nap', 'hide']) {
      const { closest } = simulate(id, 4);
      expect({ id, close: closest < 1.6 }).toEqual({ id, close: true });
    }
  });
});
