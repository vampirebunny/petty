import { levelAt, levelStart, powerUpOffer, settingsFor, treatShape } from '../content';
import {
  beginRun,
  claimAcorn,
  claimObstacle,
  claimPickup,
  claimSquad,
  claimSquirrel,
  createRun,
  hitSquirrel,
  step,
  takeSounds,
} from '../engine';

describe('acorn attack', () => {
  it('steps the level at 260, 560 and 900 meters', () => {
    expect(levelAt(0)).toBe(1);
    expect(levelAt(259.9)).toBe(1);
    expect(levelAt(260)).toBe(2);
    expect(levelAt(560)).toBe(3);
    expect(levelAt(900)).toBe(4);
    expect(levelStart(5)).toBe(1280);
    expect(settingsFor(1).ground).toBe(110);
    expect(settingsFor(2).ground).toBe(122);
    expect(settingsFor(2).glider).toBeCloseTo(4.28, 2);
    expect(settingsFor(12).glider).toBeCloseTo(1.1, 5);
    expect(settingsFor(12).obstacle).toBeCloseTo(0.94, 5);
  });

  it('eases speed only after the level changes', () => {
    const run = createRun({ seed: 3, logicalH: 800, species: 'dog' });
    beginRun(run);
    run.traveled = 2599;
    step(run, 0.05);
    expect(run.level).toBe(2);
    expect(run.groundTarget).toBe(122);
    expect(run.groundSpeed).toBeGreaterThan(110);
    expect(run.groundSpeed).toBeLessThan(122);
    const mid = settingsFor(2);
    step(run, 0.02);
    expect(run.level).toBe(2);
    expect(run.groundTarget).toBe(mid.ground);
  });

  it('drops the laser one level after 18 seconds', () => {
    const run = createRun({ seed: 4, logicalH: 800, species: 'dog' });
    beginRun(run);
    run.laserLevel = 2;
    run.laserTimer = 18;
    step(run, 0.05);
    expect(run.laserLevel).toBe(2);
    expect(run.laserTimer).toBeGreaterThan(17);
    run.laserTimer = 0.01;
    step(run, 0.05);
    expect(run.laserLevel).toBe(1);
  });

  it('stops a fast swipe on a log', () => {
    const run = createRun({ seed: 5, logicalH: 800, species: 'dog' });
    beginRun(run);
    run.groundSpeed = 0;
    run.groundTarget = 0;
    const log = claimObstacle(run);
    expect(log).toBeTruthy();
    if (!log) {
      return;
    }
    log.kind = 'log';
    log.r = 13;
    log.half = 80;
    log.x = 200;
    log.y = 400;
    run.petX = 200;
    run.petY = 450;
    run.pendingDy = -300;
    step(run, 0.016);
    expect(run.petY).toBeGreaterThan(log.y);
    expect(run.petY).toBeGreaterThan(420);
  });

  it('stops an acorn on a rock', () => {
    const run = createRun({ seed: 6, logicalH: 800, species: 'dog' });
    beginRun(run);
    run.groundSpeed = 0;
    run.groundTarget = 0;
    const rock = claimObstacle(run);
    const nut = claimAcorn(run);
    expect(rock && nut).toBeTruthy();
    if (!rock || !nut) {
      return;
    }
    rock.kind = 'rock';
    rock.x = 200;
    rock.y = 200;
    rock.r = 20;
    rock.half = 0;
    nut.x = 200;
    nut.y = 180;
    nut.vx = 0;
    nut.vy = 500;
    step(run, 0.05);
    expect(nut.alive).toBe(false);
    expect(run.fx.some((item) => item.alive && item.kind === 'puff')).toBe(true);
  });

  it('lets the pet take only one power-up', () => {
    const run = createRun({ seed: 7, logicalH: 800, species: 'dog' });
    beginRun(run);
    run.groundSpeed = 0;
    run.groundTarget = 0;
    for (const kind of ['laser', 'shield', 'heart'] as const) {
      const item = claimPickup(run);
      expect(item).toBeTruthy();
      if (!item) {
        return;
      }
      item.kind = kind;
      item.choice = true;
      item.x = run.petX;
      item.y = run.petY - 6;
    }
    step(run, 0.016);
    expect(run.laserLevel).toBe(2);
    expect(run.hearts).toBe(3);
    expect(run.shield).toBe(false);
    expect(run.pickups.filter((item) => item.alive && item.fade > 0)).toHaveLength(2);
  });

  it('omits a heart when the pet is already full', () => {
    for (let seed = 1; seed <= 24; seed += 1) {
      let state = seed;
      const rng = () => {
        state = (state * 16807) % 2147483647;
        return state / 2147483647;
      };
      const offer = powerUpOffer(3, 2, rng);
      expect(offer).toContain('laser');
      expect(offer).not.toContain('heart');
    }
    const full = powerUpOffer(1, 4, () => 0);
    expect(full).toContain('heart');
    expect(full).not.toContain('laser');
    expect(full).toHaveLength(3);
  });

  it('pays a squad bonus when every scout is booped', () => {
    const run = createRun({ seed: 8, logicalH: 800, species: 'dog' });
    beginRun(run);
    const group = claimSquad(run);
    expect(group).toBeTruthy();
    if (!group) {
      return;
    }
    group.id = 4;
    group.left = 2;
    const indexes: number[] = [];
    for (let i = 0; i < 2; i += 1) {
      const mob = claimSquirrel(run);
      expect(mob).toBeTruthy();
      if (!mob) {
        return;
      }
      mob.kind = 'scout';
      mob.hp = 1;
      mob.r = 15;
      mob.squadId = 4;
      mob.x = 80 + i * 40;
      mob.y = 120;
      indexes.push(run.squirrels.indexOf(mob));
    }
    hitSquirrel(run, indexes[0] ?? 0, 1);
    hitSquirrel(run, indexes[1] ?? 0, 1);
    expect(run.booped).toBe(2);
    expect(run.score).toBe(500);
    expect(run.pickups.some((item) => item.alive && item.kind === 'treat')).toBe(true);
  });

  it('multiplies a boop by the current level', () => {
    const run = createRun({ seed: 9, logicalH: 800, species: 'dog' });
    beginRun(run);
    run.level = 3;
    const mob = claimSquirrel(run);
    expect(mob).toBeTruthy();
    if (!mob) {
      return;
    }
    mob.kind = 'scout';
    mob.hp = 1;
    hitSquirrel(run, run.squirrels.indexOf(mob), 1);
    expect(run.score).toBe(300);
  });

  it('plays an impact per hit and an explosion when a tough squirrel goes down', () => {
    const run = createRun({ seed: 11, logicalH: 800, species: 'dog' });
    beginRun(run);
    const tough = claimSquirrel(run);
    const scout = claimSquirrel(run);
    expect(tough && scout).toBeTruthy();
    if (!tough || !scout) {
      return;
    }
    tough.kind = 'lobber';
    tough.hp = 3;
    scout.kind = 'scout';
    hitSquirrel(run, run.squirrels.indexOf(tough), 1);
    expect(takeSounds(run)).toEqual(['impact']);
    hitSquirrel(run, run.squirrels.indexOf(tough), 2);
    expect(takeSounds(run)).toEqual(['explode']);
    hitSquirrel(run, run.squirrels.indexOf(scout), 1);
    expect(takeSounds(run)).toEqual(['impact']);
  });

  it('plays the laser on every shot and the power-up on a bonus', () => {
    const run = createRun({ seed: 12, logicalH: 800, species: 'dog' });
    beginRun(run);
    run.groundSpeed = 0;
    run.groundTarget = 0;
    run.cool = 0;
    step(run, 0.016);
    expect(takeSounds(run)).toContain('laser');
    const item = claimPickup(run);
    expect(item).toBeTruthy();
    if (!item) {
      return;
    }
    item.kind = 'shield';
    item.choice = true;
    item.x = run.petX;
    item.y = run.petY - 6;
    run.cool = 1;
    step(run, 0.016);
    expect(takeSounds(run)).toEqual(['powerUp']);
  });

  it('drops fish crackers for a cat and biscuits for a dog', () => {
    expect(treatShape('cat')).toBe('fish');
    expect(treatShape('dog')).toBe('bone');
    const cat = createRun({ seed: 10, logicalH: 800, species: 'cat' });
    beginRun(cat);
    const mob = claimSquirrel(cat);
    expect(mob).toBeTruthy();
    if (!mob) {
      return;
    }
    mob.kind = 'hoarder';
    mob.hp = 8;
    mob.r = 24;
    hitSquirrel(cat, cat.squirrels.indexOf(mob), 8);
    const treats = cat.pickups.filter((item) => item.alive && item.kind === 'treat');
    expect(treats).toHaveLength(3);
    expect(treats.every((item) => item.shape === 'fish')).toBe(true);
  });
});
