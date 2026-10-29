import { attributeScore, withDerived } from '../../sim/attributes';
import { createWorld, sceneById, setDirection, spawnActor, update } from '../../actor';
import { testPet } from '../../sim/__fixtures__/pets';
import type { Stats } from '../../sim/types';
import { activities, activityById, legalActivities, offerActivities, speciesCanPlay } from '../activities';
import { closingHoldMs, playdateConfig, warmupActions } from '../config';
import { bodyOf, separate } from '../contact';
import { getCooldownRemaining } from '../cooldown';
import { beatAt, directionFor, playdateEndMs, poseFor, replayBeats, targetFor } from '../direct';
import { addReactions, favoriteChance, generatePlaydate, slotTimes } from '../generate';
import { burstFor } from '../overlay';
import { propAt } from '../props';
import { dailyCast, generateCast, withPlayerAge } from '../npcs';
import { createPlaydateRecord } from '../record';
import { applyPlaydateRewards, attributeGains } from '../rewards';
import { clearPet, emptyPlaydateSave, recentPlaydateTags, settlePlaydate } from '../save';
import replayFixture from './fixtures/v1-replay.json';
import { stageHeight, stageWidth } from '../../actor/geometry';
import { cameraAt } from '../camera';
import { ambientCues, crossBeats, resolveSfx, sfxShots } from '../sfx';
import { voiceCues } from '../voice';
import { actorSourceOf, snapshotPet } from '../snapshot';
import type { ActivityDefinition, PetSnapshot, PlaydateRecord, SpeciesPair } from '../types';

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

  it('returns the same beats for the same inputs, seed, and recent tags', () => {
    const input = {
      petA: bold,
      petB: shy,
      activity: activity('race'),
      sceneId: 'park',
      seed: 7,
      recentTags: ['spin', 'bow'],
      latestTags: ['twist:zoomies'],
      bond: 30,
    };
    expect(generatePlaydate(input).beats).toEqual(generatePlaydate(input).beats);
    const again = { ...input, recentTags: ['spin', 'bow'] };
    expect(generatePlaydate(again).beats).toEqual(generatePlaydate(input).beats);
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
    expect(record.version).toBe(2);
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
    expect(['nap', 'celebrate', 'walk_off', 'flop', 'nuzzle']).toContain(generated.beats[generated.beats.length - 1].action);
  });

  it('opens a shy pairing with warm-up beats', () => {
    const generated = generatePlaydate({ petA: shy, petB: shy, activity: activity('race'), sceneId: 'park', seed: 2 });
    const scripted = generated.beats.filter((beat) => beat.tag == null);
    expect(scripted.slice(0, 3).map((beat) => beat.action)).toEqual(['sniff', 'hide', 'approach']);
    expect(warmupActions).toContain(scripted[0].action);
    expect(['nap', 'celebrate', 'walk_off', 'flop', 'nuzzle']).toContain(generated.beats[generated.beats.length - 1].action);
  });

  it('uses a different template for a dog and a cat', () => {
    const dogs = generatePlaydate({ petA: bold, petB: bold, activity: activity('fetch'), sceneId: 'park', seed: 5 });
    const mixed = generatePlaydate({ petA: bold, petB: cat, activity: activity('fetch'), sceneId: 'park', seed: 5 });
    expect(mixed.beats.map((beat) => beat.action)).toContain('pounce');
    expect(dogs.beats.map((beat) => beat.action)).not.toContain('pounce');
    expect(mixed.beats.map((beat) => beat.action).join()).not.toBe(dogs.beats.map((beat) => beat.action).join());
  });

  it('reacts to a win when the watcher is free, and stays quiet when that window is taken', () => {
    const proud = snap({ snapshotId: 'proud', attributes: { ...stats(80), affection: 20, boldness: 80 } });
    const calm = snap({ snapshotId: 'calm', attributes: { ...stats(80), affection: 80, boldness: 80 } });
    const open = [
      { t: 1000, actor: 'A' as const, action: 'win' },
      { t: 8000, actor: 'both' as const, action: 'celebrate' },
    ];
    const reacted = addReactions(open.map((beat) => ({ ...beat })), calm, proud, () => 0);
    const added = reacted.filter((beat) => beat.tag === 'reaction');
    expect(added).toHaveLength(1);
    expect(added[0]?.actor).toBe('B');
    expect(added[0]?.t).toBe(1150);
    expect(added[0]?.gesture).toBe('double_take');
    expect(reacted[reacted.length - 1]?.t).toBe(8000);
    expect(reacted[reacted.length - 1]?.action).toBe('celebrate');
    for (let i = 1; i < reacted.length; i += 1) {
      expect(reacted[i].t).toBeGreaterThanOrEqual(reacted[i - 1].t);
    }

    const shyWatcher = snap({ snapshotId: 'shy-watch', attributes: { ...stats(10), affection: 10, boldness: 10 } });
    const glanced = addReactions(open.map((beat) => ({ ...beat })), calm, shyWatcher, () => 0);
    expect(glanced.find((beat) => beat.tag === 'reaction')?.gesture).toBe('glance');

    const blocked = addReactions(
      [
        { t: 1000, actor: 'A' as const, action: 'win' },
        { t: 1200, actor: 'B' as const, action: 'sit' },
        { t: 8000, actor: 'both' as const, action: 'celebrate' },
      ],
      calm,
      proud,
      () => 0,
    );
    expect(blocked.some((beat) => beat.tag === 'reaction')).toBe(false);
  });

  it('varies twists and variants without moving the closing beat', () => {
    const floor = sceneById('park').floor;
    const dog = (id: string, boldness: number, agility: number) =>
      snap({ snapshotId: id, attributes: { ...stats(50), boldness, agility, affection: 20 } });
    const kitty = (id: string, boldness: number) =>
      snap({
        snapshotId: id,
        species: 'cat',
        breedId: 'domesticShorthair',
        attributes: { ...stats(50), boldness, affection: 20 },
      });
    const pets: Record<SpeciesPair, [PetSnapshot, PetSnapshot]> = {
      'dog-dog': [dog('dog-a', 80, 70), dog('dog-b', 40, 55)],
      'cat-cat': [kitty('cat-a', 70), kitty('cat-b', 30)],
      'dog-cat': [dog('dog-c', 60, 50), kitty('cat-c', 65)],
    };
    const twistIds = new Set<string>();
    const perActivity = new Map<string, Set<string>>();
    for (const played of activities) {
      const seen = new Set<string>();
      for (const pair of played.speciesPairs) {
        const [petA, petB] = pets[pair];
        for (let seed = 0; seed < 50; seed += 1) {
          const beats = generatePlaydate({ petA, petB, activity: played, sceneId: 'park', seed, bond: 10 }).beats;
          const last = beats[beats.length - 1];
          expect(['nap', 'celebrate', 'walk_off', 'flop', 'nuzzle']).toContain(last.action);
          expect(last.t).toBe(playdateEndMs(beats) - closingHoldMs);
          expect(beats.some((beat) => beat.tag?.startsWith('twist:'))).toBe(true);
          expect(beats.some((beat) => beat.tag?.startsWith('variant:intro:'))).toBe(true);
          expect(beats.some((beat) => beat.tag?.startsWith('variant:main:'))).toBe(true);
          expect(beats.some((beat) => beat.tag?.startsWith('variant:finale:'))).toBe(true);
          for (let i = 1; i < beats.length; i += 1) {
            expect(beats[i].t).toBeGreaterThanOrEqual(beats[i - 1].t);
            if (beats[i].tag?.startsWith('twist:')) {
              expect(beats[i].t).not.toBe(beats[i - 1].t);
              const id = beats[i].tag?.slice('twist:'.length) ?? '';
              twistIds.add(id);
              seen.add(id);
            }
            const point = beats[i].params;
            if (point?.x != null && point.y != null) {
              expect(point.x).toBeGreaterThanOrEqual(floor.xMin);
              expect(point.x).toBeLessThanOrEqual(floor.xMax);
              expect(point.y).toBeGreaterThanOrEqual(floor.yMin);
              expect(point.y).toBeLessThanOrEqual(floor.yMax);
            }
          }
          if (played.id === 'fetch') {
            const runs = beats.filter((beat) => beat.action === 'run_to' && beat.params?.x != null && beat.params.toward == null);
            for (const beat of beats) {
              if (!beat.prop?.throwTo) {
                continue;
              }
              const runner = runs.find((other) => other.t >= beat.t && beats.indexOf(other) > beats.indexOf(beat));
              expect(runner?.params?.x).toBe(beat.prop.throwTo.x);
              expect(runner?.params?.y).toBe(beat.prop.throwTo.y);
            }
          }
        }
      }
      perActivity.set(played.id, seen);
    }
    expect(twistIds.size).toBeGreaterThanOrEqual(6);
    for (const ids of perActivity.values()) {
      expect(ids.size).toBeGreaterThan(0);
    }
  });

  it('skips the twist that just played when another one is eligible', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const beats = generatePlaydate({
        petA: bold,
        petB: shy,
        activity: activity('sniff'),
        sceneId: 'park',
        seed,
        latestTags: ['butterfly'],
        bond: 0,
      }).beats;
      expect(beats.some((beat) => beat.tag === 'twist:butterfly')).toBe(false);
    }
  });

  it('derives the prop from the latest beat at that time', () => {
    const beats = [
      { t: 0, actor: 'A' as const, action: 'play_bow', prop: { kind: 'ball' as const, holder: 'A' as const, throwTo: { x: 400, y: 200 }, at: { x: 100, y: 200 } } },
      { t: 1000, actor: 'B' as const, action: 'run_to', prop: { kind: 'ball' as const, holder: 'B' as const } },
    ];
    expect(propAt(beats, 0)?.holder).toBeNull();
    expect(propAt(beats, 0)?.z).toBe(0);
    expect(propAt(beats, 250)?.holder).toBeNull();
    expect(propAt(beats, 250)?.z).toBeGreaterThan(0);
    expect(propAt(beats, 500)).toMatchObject({ holder: null, x: 400, y: 200, z: 0 });
    expect(propAt(beats, 1000)?.holder).toBe('B');
  });

  it('lets a close contest go either way and keeps a long shot rare', () => {
    expect(favoriteChance(0)).toBe(0.5);
    expect(favoriteChance(10_000)).toBeCloseTo(0.88, 2);
    const even = snap({ snapshotId: 'even-a', attributes: stats(40) });
    const twin = snap({ snapshotId: 'even-b', attributes: stats(40) });
    const winners = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      const beats = generatePlaydate({ petA: even, petB: twin, activity: activity('chase'), sceneId: 'park', seed }).beats;
      const win = beats.find((beat) => beat.action === 'win');
      if (win) {
        winners.add(win.actor);
      }
      expect(generatePlaydate({ petA: even, petB: twin, activity: activity('chase'), sceneId: 'park', seed }).beats).toEqual(beats);
    }
    expect(winners.has('A')).toBe(true);
    expect(winners.has('B')).toBe(true);

    const star = snap({ snapshotId: 'star', attributes: { ...stats(5), stamina: 100 } });
    const pup = snap({ snapshotId: 'pup', attributes: { ...stats(5), stamina: 0 } });
    let upsets = 0;
    let played = 0;
    for (let seed = 0; seed < 80; seed += 1) {
      const generated = generatePlaydate({ petA: star, petB: pup, activity: activity('chase'), sceneId: 'park', seed });
      played += 1;
      if (generated.beats.some((beat) => beat.tag === 'upset')) {
        upsets += 1;
      }
    }
    expect(upsets / played).toBeLessThan(0.5);
  });

  it('celebrates an upset and shows a trick in the finale', () => {
    const star = snap({ snapshotId: 'star-2', attributes: { ...stats(90), stamina: 100, affection: 80 } });
    const pup = snap({ snapshotId: 'pup-2', attributes: { ...stats(10), stamina: 0, affection: 80 }, partyTricks: ['speak'] });
    let upset = null as ReturnType<typeof generatePlaydate> | null;
    let shown = null as ReturnType<typeof generatePlaydate> | null;
    for (let seed = 0; seed < 200 && (!upset || !shown); seed += 1) {
      const generated = generatePlaydate({ petA: star, petB: pup, activity: activity('chase'), sceneId: 'park', seed });
      if (!upset && generated.beats.some((beat) => beat.tag === 'upset')) {
        upset = generated;
      }
      if (!shown && generated.beats.some((beat) => beat.tag === 'trick_shown')) {
        shown = generated;
      }
    }
    expect(upset?.beats.some((beat) => beat.tag === 'upset' && beat.emote === 'sparkle' && beat.fx === 'confetti')).toBe(true);
    expect(upset?.beats.some((beat) => beat.tag === 'upset' && beat.gesture === 'double_take' && beat.emote === 'exclaim')).toBe(true);
    const trick = shown?.beats.find((beat) => beat.tag === 'trick_shown');
    expect(trick?.actor).toBe('B');
    expect(trick?.action).toBe('speak');
    expect(trick?.emote).toBe('sparkle');
    expect(shown?.beats.some((beat) => beat.actor === 'A' && beat.action === 'celebrate' && beat.t === trick?.t)).toBe(true);
    const finale = shown?.beats.find((beat) => beat.tag?.startsWith('variant:finale:'));
    const closing = shown?.beats[shown.beats.length - 1];
    expect(trick && finale && closing && trick.t >= finale.t && trick.t < closing.t).toBe(true);
  });

  it('tags a golden closing when that rare roll hits', () => {
    let golden = 0;
    for (let seed = 0; seed < 150; seed += 1) {
      const beats = generatePlaydate({ petA: bold, petB: shy, activity: activity('sniff'), sceneId: 'park', seed }).beats;
      if (beats[beats.length - 1]?.tag === 'golden') {
        golden += 1;
        expect(['nap', 'celebrate']).toContain(beats[beats.length - 1]?.action);
      }
    }
    expect(golden).toBeGreaterThan(0);
  });

  it('lands the closing beat at lastT for every activity', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      for (const played of activities) {
        const beats = generatePlaydate({ petA: bold, petB: shy, activity: played, sceneId: 'park', seed }).beats;
        const last = beats[beats.length - 1];
        expect(last.t).toBe(playdateEndMs(beats) - closingHoldMs);
        for (let i = 1; i < beats.length; i += 1) {
          expect(beats[i].t).toBeGreaterThanOrEqual(beats[i - 1].t);
          expect(beats[i].t).toBeLessThanOrEqual(last.t);
        }
      }
    }
  });

  it('replays a stored version 1 record at the same beatAt samples', () => {
    const record = replayFixture.record as PlaydateRecord;
    const beats = record.beats;
    expect(record.version).toBe(1);
    expect(replayBeats(record)).toBe(beats);
    for (const sample of replayFixture.samples) {
      expect(beatAt(beats, sample.ms, 'A')).toEqual(sample.A);
      expect(beatAt(beats, sample.ms, 'B')).toEqual(sample.B);
    }
  });

  it('keeps the camera off until a punch or shake is inside its window', () => {
    const quiet = [{ t: 0, actor: 'A' as const, action: 'sit' }];
    expect(cameraAt(quiet, 500, new Map(), false, 1)).toBeUndefined();
    const punch = [{ t: 1000, actor: 'both' as const, action: 'win', camera: 'punch' }];
    expect(cameraAt(punch, 1000, new Map(), false, 1)?.zoom).toBeCloseTo(1);
    expect(cameraAt(punch, 1180, new Map(), false, 1)?.zoom).toBeCloseTo(1.06);
    expect(cameraAt(punch, 1580, new Map(), false, 1)?.zoom).toBeCloseTo(1.06);
    expect(cameraAt(punch, 1780, new Map(), false, 1)?.zoom).toBeCloseTo(1);
    expect(cameraAt(punch, 1781, new Map(), false, 1)).toBeUndefined();
    expect(cameraAt(punch, 1100, new Map(), true, 1)).toBeUndefined();
    const edge = cameraAt(punch, 1180, new Map([[0, { x: 0, y: 0 }]]), false, 1);
    const half = stageWidth / 1.06 / 2;
    const top = (stageHeight * 0.62) / 1.06;
    expect(edge?.x).toBeCloseTo(half);
    expect(edge?.y).toBeCloseTo(top);
    const shake = [{ t: 400, actor: 'both' as const, action: 'flop', camera: 'shake' }];
    expect(cameraAt(shake, 480, new Map(), false, 9)).toEqual(cameraAt(shake, 480, new Map(), false, 9));
  });

  it('fires each sfx beat index once and stays quiet on an unknown name', () => {
    const beats = [
      { t: 1000, actor: 'A' as const, action: 'sit', sfx: 'bark' },
      { t: 1000, actor: 'B' as const, action: 'sit', sfx: 'meow' },
    ];
    const fired = new Set<number>();
    expect(crossBeats(beats, 1000, fired)).toEqual([0, 1]);
    expect(crossBeats(beats, 1000, fired)).toEqual([]);
    expect(sfxShots(beats[0], () => 'dog').map((shot) => shot.speak)).toEqual([true]);
    expect(sfxShots(beats[1], () => 'cat').map((shot) => shot.speak)).toEqual([true]);
    expect(resolveSfx('honk', 'dog')).toBeNull();
    expect(resolveSfx('squeak', 'cat')).toBeNull();
    expect(sfxShots({ t: 0, actor: 'A', action: 'sit', sfx: 'honk' }, () => 'dog')).toEqual([]);
    const cues = [
      { t: 10_000, actor: 'A' as const },
      { t: 30_000, actor: 'B' as const },
    ];
    expect(ambientCues(2, cues, [])).toEqual([cues[0]]);
    expect(ambientCues(2, cues, [{ t: 9000, actor: 'A', action: 'win', sfx: 'bark' }])).toEqual([]);
    expect(ambientCues(1, cues, [{ t: 9000, actor: 'A', action: 'win', sfx: 'bark' }])).toEqual(cues);
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

  it('sets playdate npcs to the player pet age and leaves friends alone', () => {
    const cast = generateCast('owner-age');
    const matched = withPlayerAge(cast, 7);
    expect(matched.every((pet) => pet.ageDays === 7)).toBe(true);
    expect(matched.map((pet) => pet.snapshotId)).toEqual(cast.map((pet) => pet.snapshotId));
    const friend = { ...cast[0], source: 'friend' as const, ageDays: 3 };
    expect(withPlayerAge([friend], 7)[0]).toBe(friend);
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
  it('reads twist tags from version 2 history only', () => {
    const older = recordFor('pd-1', 'npc-1');
    const newer = {
      ...recordFor('pd-2', 'npc-2'),
      version: 2 as const,
      beats: [
        { t: 0, actor: 'A' as const, action: 'sit', tag: 'spin' },
        { t: 1000, actor: 'both' as const, action: 'nap' },
      ],
    };
    expect(recentPlaydateTags([older, newer])).toEqual(['spin']);
  });

  it('caps happiness and attributes and leaves level, bond, and outfit alone', () => {
    const pet = testPet(8, 'corgi', 50, 'Pip', 'pet');
    pet.needs.happiness = 95;
    pet.attributes.current.agility = pet.attributes.potential.agility - 1;
    pet.attributes.trained = {
      ...(pet.attributes.trained ?? { stamina: 0, agility: 0, intelligence: 0, boldness: 0, affection: 0, obedience: 0 }),
      agility: pet.attributes.potential.agility,
    };
    const xp = pet.xpTotal;
    const bond = pet.bond;
    const equipped = { ...pet.equipped };
    const next = applyPlaydateRewards(pet, {
      moodDelta: playdateConfig.happinessGain,
      attributeXp: { agility: 10 },
      bondDelta: playdateConfig.bondGain,
      rareEvents: [],
    });
    expect(next.needs.happiness).toBe(100);
    expect(attributeScore(next, 'agility')).toBeLessThanOrEqual(pet.attributes.potential.agility);
    expect(next.attributes.current.agility).toBe(pet.attributes.current.agility);
    expect(next.xpTotal).toBe(xp);
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
    pet.equipped = { neckwear: 'collar' };
    const shot = snapshotPet(pet, { hat: 'beanie' }, 't', 'snap');
    expect(shot.equipped).toEqual({ hat: 'beanie' });
    expect(pet.equipped).toEqual({ neckwear: 'collar' });
  });
});

describe('playdate choreography', () => {
  it('gives zoomies its own pace and leaves a run at the old pace', () => {
    const floor = sceneById('park').floor;
    const context = { self: { x: 200, y: 300 }, other: { x: 400, y: 300 }, reach: 80, floor };
    const run = directionFor({ t: 0, actor: 'A', action: 'run_to' }, 'A', context);
    const zoom = directionFor({ t: 0, actor: 'A', action: 'zoomies' }, 'A', context);
    expect(run.pose).toBe('run');
    expect(run.pace).toBe(0.92);
    expect(zoom.pose).toBe('zoomies');
    expect(zoom.pace).toBe(1);
    expect(poseFor('skid')).toBe('skid');
    expect(poseFor('roll_over')).toBe('roll_over');
    expect(poseFor('flop')).toBe('flop');
  });

  it('spawns emotes and fx only for a version 2 beat that asks for them', () => {
    const at = { version: 2 as const, seed: 3, actor: 'A' as const, beatT: 1200, x: 10, y: 20, reduced: false };
    expect(burstFor({ ...at, version: 1, emote: 'heart' })).toBeNull();
    expect(burstFor(at)).toBeNull();
    const heart = burstFor({ ...at, emote: 'heart' });
    expect(heart?.emote).toBe('heart');
    expect(heart?.particles).toEqual([]);
    const confetti = burstFor({ ...at, fx: 'confetti', reduced: true });
    expect(confetti?.particles.length).toBeLessThanOrEqual(6);
    expect(confetti?.particles.every((bit) => bit.spin === 0)).toBe(true);
    expect(burstFor({ ...at, fx: 'confetti' })?.particles.length).toBe(12);
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

  it('sends the pets at each other, and an undelayed chase pair shares a start', () => {
    const beats = play('chase');
    let shared = 0;
    for (let i = 1; i < beats.length; i += 1) {
      if (beats[i].tag?.startsWith('twist:')) {
        expect(beats[i].t).not.toBe(beats[i - 1].t);
      }
      if (beats[i].t === beats[i - 1].t && beats[i].params?.toward && beats[i - 1].params?.toward) {
        shared += 1;
      }
    }
    expect(shared).toBeGreaterThan(0);
  });

  it('runs a race in two lanes that share a start when neither step is delayed', () => {
    const beats = play('race');
    for (let i = 1; i < beats.length; i += 1) {
      if (beats[i].tag?.startsWith('twist:')) {
        expect(beats[i].t).not.toBe(beats[i - 1].t);
      }
    }
    const lanes = beats.filter((beat) => beat.action === 'run_to' && beat.params?.spread === 'y');
    const groups = new Map<number, number>();
    for (const beat of lanes) {
      groups.set(beat.t, (groups.get(beat.t) ?? 0) + 1);
    }
    const paired = [...groups.values()].some((count) => count >= 2) || lanes.some((beat) => beat.actor === 'both');
    expect(paired).toBe(true);
  });

  it('starts a delayed parallel step exactly that many milliseconds later', () => {
    const still = () => 0.5;
    const times = slotTimes(
      [{ weight: 1 }, { parallel: true, delay: 250 }, { weight: 1 }, { parallel: true }],
      10_000,
      still,
    );
    expect(times[1] - times[0]).toBe(250);
    expect(times[2]).toBe(times[3]);
    const clamped = slotTimes([{ weight: 1 }, { parallel: true, delay: 9_000 }, { weight: 1 }], 10_000, still);
    expect(clamped[1]).toBe(clamped[2] - 1);
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
    pet.attributes.trained = {
      ...(pet.attributes.trained ?? { stamina: 0, agility: 0, intelligence: 0, boldness: 0, affection: 0, obedience: 0 }),
      affection: pet.attributes.potential.affection,
    };
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
