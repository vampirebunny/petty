import { scenes } from '../scenes';
import { createWorld, setWorldScene, spawnActor, startUserTask, update } from '../sim';
import type { ActorSource, ParkOffer } from '../types';
import { parkStrangerOffer } from '../../playdate/npcs';
import {
  addWanderingGuest,
  approachKind,
  arrivalCount,
  arriveChance,
  helloPose,
  moodGrant,
  seekChance,
  socialBand,
  socialIntent,
  syncParkVisitors,
} from '../parkVisitors';

function source(overrides: Partial<ActorSource> = {}): ActorSource {
  return {
    id: 'pet',
    breedId: 'retriever',
    ageDays: 16,
    weight: 0,
    vitality: 1,
    equipped: {},
    asleep: false,
    energy: 0.8,
    mood: 0.8,
    cuddleAffinity: 0.8,
    stats: { stamina: 0.5, agility: 0.5, boldness: 0.8, obedience: 0.5 },
    ...overrides,
  };
}

function offer(id: string, boldness: number, affection: number, ageDays = 16): ParkOffer {
  return {
    id,
    breedId: 'retriever',
    species: 'dog',
    ageDays,
    weight: 0,
    vitality: 1,
    seed: 3,
    boldness,
    affection,
    look: null,
    equipped: {},
  };
}

function parkWorld(pet: Partial<ActorSource> = {}) {
  const actor = spawnActor(source(pet));
  actor.x = 220;
  actor.y = 400;
  const world = createWorld([actor], 1, scenes.park);
  syncParkVisitors(world, { enabled: true, offers: [], stranger: null });
  return { world, actor };
}

function steps(world: ReturnType<typeof createWorld>, count: number) {
  for (let i = 0; i < count; i += 1) {
    update(world, 0.05);
  }
}

describe('park visitor rules', () => {
  it('bands boldness and affection the way playdates treat shyness', () => {
    expect(socialBand(39, 80)).toBe('shy');
    expect(socialBand(40, 39)).toBe('aloof');
    expect(socialBand(10, 10)).toBe('shy');
    expect(socialBand(40, 40)).toBe('friendly');
    expect(socialBand(64, 80)).toBe('friendly');
    expect(socialBand(65, 65)).toBe('outgoing');
  });

  it('keeps a tired or reluctant pet from crossing the park', () => {
    expect(socialIntent(10, 10, 80)).toBe('avoid');
    expect(socialIntent(20, 70, 80)).toBe('tolerate');
    expect(socialIntent(80, 80, 20)).toBe('tolerate');
    expect(socialIntent(50, 20, 80)).toBe('seek');
    expect(socialIntent(70, 70, 80)).toBe('seek');
    expect(seekChance('shy', 80)).toBe(0);
    expect(seekChance('outgoing', 80)).toBeGreaterThan(seekChance('friendly', 80));
    expect(seekChance('friendly', 10)).toBeLessThan(seekChance('friendly', 80));
  });

  it('needs both sides to allow a hello', () => {
    expect(approachKind('avoid', 'seek', 20)).toBe('none');
    expect(approachKind('seek', 'tolerate', 200)).toBe('meet');
    expect(approachKind('tolerate', 'tolerate', 200)).toBe('none');
    expect(approachKind('tolerate', 'tolerate', 60)).toBe('meet');
    expect(approachKind('seek', 'seek', 300)).toBe('meet');
  });

  it('picks a short pose for the pair', () => {
    const dog = { species: 'dog' as const, band: 'friendly' as const, ageDays: 16 };
    const cat = { species: 'cat' as const, band: 'friendly' as const, ageDays: 16 };
    expect(helloPose(dog, dog).pose).toBe('bow');
    expect(helloPose(cat, cat).pose).toBe('sit');
    expect(helloPose(dog, cat).pose).toBe('sniff');
    expect(helloPose(dog, cat).gap).toBeGreaterThan(helloPose(dog, dog).gap);
    expect(
      helloPose(
        { species: 'dog', band: 'outgoing', ageDays: 16 },
        { species: 'dog', band: 'outgoing', ageDays: 16 },
      ).pose,
    ).toBe('run');
    expect(
      helloPose(
        { species: 'dog', band: 'outgoing', ageDays: 1 },
        { species: 'dog', band: 'outgoing', ageDays: 16 },
      ).pose,
    ).toBe('bow');
  });

  it('rolls occupancy and caps arrivals', () => {
    expect(arrivalCount(0)).toBe(0);
    expect(arrivalCount(0.5)).toBe(1);
    expect(arrivalCount(0.9)).toBe(1);
    expect(arriveChance(0)).toBeGreaterThan(arriveChance(1));
    expect(arriveChance(2)).toBe(0);
  });

  it('caps hello mood at 6 points inside 10 minutes', () => {
    let times: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const grant = moodGrant(times, i);
      expect(grant.amount).toBe(2);
      times = grant.times;
    }
    expect(moodGrant(times, 10).amount).toBe(0);
    expect(moodGrant(times, 700).amount).toBe(2);
  });
});

describe('park visitor entry', () => {
  it('walks fully onto the grass from either side', () => {
    for (const fromLeft of [true, false]) {
      const { world } = parkWorld();
      let rolls = 0;
      world.rng = () => {
        rolls += 1;
        if (rolls === 1) {
          return 0.6;
        }
        if (rolls === 3) {
          return 0.75;
        }
        return 0.15;
      };
      syncParkVisitors(world, {
        enabled: true,
        offers: [offer('walker', 20, 20)],
        stranger: null,
      });
      const player = world.actors[0];
      player.x = fromLeft ? 500 : 120;
      player.stats.boldness = 0.1;
      player.cuddleAffinity = 0.1;
      steps(world, 1);
      const arriving = world.actors.find((actor) => actor.guest);
      expect(arriving?.task.type).toBe('travel');
      expect(world.park!.guests[0]?.phase).toBe('enter');
      steps(world, 79);
      const guest = world.actors.find((actor) => actor.guest);
      expect(guest).toBeTruthy();
      const floor = world.scene.floor;
      expect(guest!.x).toBeGreaterThan(floor.xMin + 80);
      expect(guest!.x).toBeLessThan(floor.xMax - 80);
    }
  });

  it('places some opening visitors on the grass, off the pet depth', () => {
    const { world } = parkWorld();
    const player = world.actors[0];
    player.x = 80;
    player.y = 280;
    let rolls = 0;
    world.rng = () => {
      rolls += 1;
      if (rolls === 1) {
        return 0.6;
      }
      if (rolls === 2) {
        return 0.1;
      }
      return 0.2;
    };
    syncParkVisitors(world, {
      enabled: true,
      offers: [offer('settled', 20, 20)],
      stranger: null,
    });
    steps(world, 1);
    const guest = world.actors.find((actor) => actor.guest);
    expect(guest).toBeTruthy();
    expect(guest!.task.type).toBe('idle');
    expect(world.park!.guests[0]?.phase).toBe('wander');
    expect(Math.abs(guest!.y - player.y)).toBeGreaterThanOrEqual(45);
    const floor = world.scene.floor;
    expect(guest!.x).toBeGreaterThan(floor.xMin);
    expect(guest!.x).toBeLessThan(floor.xMax);
    expect(guest!.y).toBeGreaterThanOrEqual(floor.yMin);
    expect(guest!.y).toBeLessThanOrEqual(floor.yMax);
  });

  it('walks in visitors who show up after the park is open', () => {
    const { world } = parkWorld();
    world.rng = () => 0.1;
    syncParkVisitors(world, {
      enabled: true,
      offers: [offer('later', 20, 20)],
      stranger: null,
    });
    steps(world, 1);
    expect(world.actors.some((actor) => actor.guest)).toBe(false);
    world.park!.nextCheck = 0;
    steps(world, 1);
    const guest = world.actors.find((actor) => actor.guest);
    expect(guest).toBeTruthy();
    expect(guest!.task.type).toBe('travel');
    expect(world.park!.guests[0]?.phase).toBe('enter');
  });
});

describe('park visitor sim', () => {
  it('lets a friendly pair meet and pay mood once', () => {
    const { world, actor } = parkWorld();
    world.rng = () => 0;
    const guest = addWanderingGuest(world, offer('pal', 80, 80), { x: 260, y: 400 }, spawnActor);
    expect(guest).not.toBeNull();
    steps(world, 80);
    expect(actor.moodPops.reduce((sum, amount) => sum + amount, 0)).toBe(2);
    steps(world, 80);
    expect(actor.moodPops.reduce((sum, amount) => sum + amount, 0)).toBe(2);
  });

  it('does not walk a reluctant pet into a hello', () => {
    const { world, actor } = parkWorld({
      cuddleAffinity: 0.2,
      stats: { stamina: 0.5, agility: 0.5, boldness: 0.1, obedience: 0.5 },
    });
    world.rng = () => 0;
    addWanderingGuest(world, offer('stray', 80, 80), { x: 520, y: 420 }, spawnActor);
    steps(world, 30);
    expect(actor.moodPops).toEqual([]);
    expect(actor.direction).toBeNull();
  });

  it('drops a hello when the player asks for something else', () => {
    const { world, actor } = parkWorld();
    world.rng = () => 0;
    addWanderingGuest(world, offer('pal', 80, 80), { x: 260, y: 400 }, spawnActor);
    steps(world, 2);
    expect(actor.direction).not.toBeNull();
    startUserTask(world, actor, 'sit');
    steps(world, 40);
    expect(actor.moodPops).toEqual([]);
    expect(actor.direction).toBeNull();
  });

  it('never keeps more than one visitor', () => {
    const { world } = parkWorld();
    syncParkVisitors(world, {
      enabled: true,
      offers: [offer('a', 50, 50), offer('b', 50, 50)],
      stranger: null,
    });
    world.rng = () => 0.9;
    steps(world, 1);
    expect(world.actors.filter((actor) => actor.guest)).toHaveLength(1);
    world.park!.nextCheck = 0;
    steps(world, 1);
    expect(world.actors.filter((actor) => actor.guest)).toHaveLength(1);
  });

  it('removes visitors when the scene changes', () => {
    const { world } = parkWorld();
    addWanderingGuest(world, offer('a', 50, 50), { x: 300, y: 400 }, spawnActor);
    expect(world.actors.some((actor) => actor.guest)).toBe(true);
    setWorldScene(world, scenes.livingroom);
    expect(world.actors.some((actor) => actor.guest)).toBe(false);
    expect(world.actors).toHaveLength(1);
  });

  it('does not count a visitor drink as the pet drinking', () => {
    const { world } = parkWorld();
    world.rng = () => 0.99;
    const guest = addWanderingGuest(world, offer('thirsty', 10, 10), { x: 400, y: 360 }, spawnActor);
    const pond = world.scene.pois.find((poi) => poi.type === 'water');
    expect(guest).not.toBeNull();
    guest!.task = { type: 'eat', stage: 'eating', t: 5.9, kind: 'drink', bats: 0, cool: 0, poi: pond ?? undefined };
    steps(world, 8);
    expect(world.pendingPondDrinks).toBe(0);
    expect(world.pendingBowlDrinks).toBe(0);
  });

  it('does not let a visitor nap or fall asleep', () => {
    const { world } = parkWorld();
    const guest = addWanderingGuest(world, offer('dozer', 40, 40), { x: 300, y: 400 }, spawnActor);
    expect(guest).not.toBeNull();
    guest!.asleep = true;
    guest!.collapseLeft = 5;
    guest!.task = { type: 'sleep', stage: 'sleeping', t: 0, bats: 0, cool: 0 };
    guest!.idle.mode = 'nap';
    steps(world, 2);
    expect(guest!.asleep).toBe(false);
    expect(guest!.collapseLeft).toBe(0);
    expect(guest!.task.type).not.toBe('sleep');
    expect(guest!.idle.mode).not.toBe('nap');
    guest!.idle.t = guest!.idle.dur + 1;
    steps(world, 40);
    expect(guest!.idle.mode).not.toBe('nap');
    expect(guest!.task.type).not.toBe('sleep');
    expect(guest!.asleep).toBe(false);
  });

  it('can arrive from the cast or as a stranger', () => {
    const stranger = parkStrangerOffer('owner-park', 4);
    expect(stranger.breedId.length).toBeGreaterThan(0);
    expect(stranger.boldness).toBeGreaterThan(0);
    const { world } = parkWorld();
    world.rng = () => 0.9;
    syncParkVisitors(world, {
      enabled: true,
      offers: [offer('one', 40, 40), offer('two', 70, 70)],
      stranger: null,
    });
    steps(world, 1);
    expect(world.actors.filter((actor) => actor.guest)).toHaveLength(1);
  });
});
