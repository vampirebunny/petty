import type { Actor, Pose, World } from '../actor/types';
import { parkFinds } from '../sim/parkFindsConfig';
import type { FindVariant } from './types';

export type ParkFindStage =
  | 'notice'
  | 'trot'
  | 'stalk'
  | 'sniff'
  | 'dig'
  | 'wiggle'
  | 'pounce'
  | 'paw'
  | 'rear'
  | 'falls'
  | 'pop'
  | 'sniffItem'
  | 'grab'
  | 'bring'
  | 'spin'
  | 'drop'
  | 'done';

export type ParkFindRun = {
  variant: FindVariant;
  itemId: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  spot: { x: number; y: number };
  bushPropId?: string;
  legendary: boolean;
  revealed: boolean;
  itemX: number;
  itemY: number;
  itemZ: number;
  carrying: boolean;
  stage: ParkFindStage;
  stageT: number;
};

const LIGHT_FALL = new Set([
  'blue-jay-feather',
  'cherry-blossom-petal',
  'red-maple-leaf',
  'dandelion-puff',
  'paper-boat',
  'party-hat',
]);

export function beatDuration(run: ParkFindRun, stage: ParkFindStage): number {
  const extra = run.legendary ? parkFinds.legendaryBeatExtraSec : 0;
  switch (stage) {
    case 'notice':
      return 0.6;
    case 'sniff':
      return 1.0;
    case 'dig':
      return 2.0 + extra;
    case 'wiggle':
      return run.variant === 'bush' ? 0.6 : 0.8;
    case 'pounce':
      return 0.6;
    case 'paw':
      return 1.2 + extra;
    case 'rear':
      return 1.8 + extra;
    case 'falls':
      return 0.7;
    case 'pop':
      return 0.6;
    case 'sniffItem':
      return 0.8;
    case 'grab':
      return 0.6;
    case 'spin':
      return run.legendary ? 0.8 : 0;
    case 'drop':
      return 0.4;
    default:
      return 0;
  }
}

export function beginParkFind(
  actor: Actor,
  args: {
    variant: FindVariant;
    itemId: string;
    rarity: ParkFindRun['rarity'];
    spot: { x: number; y: number };
    bushPropId?: string;
  },
): void {
  const legendary = args.rarity === 'legendary';
  actor.task = {
    type: 'parkFind',
    stage: 'notice',
    t: 0,
    bats: 0,
    cool: 0,
    parkFind: {
      variant: args.variant,
      itemId: args.itemId,
      rarity: args.rarity,
      spot: args.spot,
      bushPropId: args.bushPropId,
      legendary,
      revealed: false,
      itemX: args.spot.x,
      itemY: args.spot.y,
      itemZ: 0,
      carrying: false,
      stage: 'notice',
      stageT: 0,
    },
  };
  actor.idle = { mode: 'still', t: 0, dur: 999, target: null, sit: false, arrived: true };
}

function advance(run: ParkFindRun, next: ParkFindStage): void {
  run.stage = next;
  run.stageT = 0;
}

function dropPoint(world: World): { x: number; y: number } {
  const floor = world.scene.floor;
  return {
    x: (floor.xMin + floor.xMax) / 2,
    y: floor.yMax - parkFinds.dropFrontYOffset,
  };
}

/** Drive park-find poses and movement for one frame. Returns true when the run finished. */
export function updateParkFindTask(
  world: World,
  actor: Actor,
  targets: Pose,
  dt: number,
  setMove: (point: { x: number; y: number } | null, vmax?: number) => void,
): { done: boolean; justRevealed: boolean; goldFlash: boolean } {
  const run = actor.task.parkFind;
  if (!run || actor.task.type !== 'parkFind') {
    return { done: true, justRevealed: false, goldFlash: false };
  }

  run.stageT += dt;
  actor.task.stage = run.stage;
  actor.task.t = run.stageT;

  let justRevealed = false;
  let goldFlash = false;
  const spot = run.spot;
  const faceSpot = (): void => {
    if (Math.abs(spot.x - actor.x) > 4) {
      actor.face = spot.x >= actor.x ? 1 : -1;
    }
  };

  const distTo = (p: { x: number; y: number }) => Math.hypot(p.x - actor.x, p.y - actor.y);

  switch (run.stage) {
    case 'notice': {
      targets.headUp = 1;
      targets.earBack = -0.4;
      targets.tailLift = 0.6;
      targets.wagAmp = 0.55;
      faceSpot();
      setMove(null);
      if (run.stageT >= beatDuration(run, 'notice')) {
        advance(run, run.variant === 'dig' ? 'trot' : 'stalk');
      }
      break;
    }
    case 'trot': {
      faceSpot();
      setMove(spot, 90);
      if (distTo(spot) < 18) {
        setMove(null);
        advance(run, 'sniff');
      }
      break;
    }
    case 'stalk': {
      targets.stalk = 1;
      targets.crouch = 0.6;
      targets.headDown = 0.35;
      targets.tailLift = -0.2;
      faceSpot();
      const stopShort = run.variant === 'bush' ? 28 : 110;
      const goal = {
        x: spot.x - actor.face * Math.min(stopShort, Math.max(20, distTo(spot) - 4)),
        y: spot.y,
      };
      // Walk toward a point stopShort units short of the spot.
      const dx = spot.x - actor.x;
      const dy = spot.y - actor.y;
      const len = Math.hypot(dx, dy) || 1;
      const approach = {
        x: spot.x - (dx / len) * stopShort,
        y: spot.y - (dy / len) * Math.min(stopShort * 0.2, Math.abs(dy)),
      };
      setMove(approach, 42);
      if (distTo(spot) <= stopShort + 8) {
        setMove(null);
        advance(run, 'wiggle');
      }
      void goal;
      break;
    }
    case 'sniff': {
      targets.headDown = 1;
      targets.wagAmp = 0.7;
      faceSpot();
      setMove(null);
      if (run.stageT >= beatDuration(run, 'sniff')) {
        advance(run, 'dig');
      }
      break;
    }
    case 'dig': {
      targets.bow = 0.6;
      targets.dig = 1;
      targets.headDown = 0.5;
      targets.wagAmp = 0.8;
      faceSpot();
      setMove(null);
      if (run.stageT >= beatDuration(run, 'dig')) {
        advance(run, 'pop');
      }
      break;
    }
    case 'wiggle': {
      targets.wiggle = 1;
      targets.crouch = 0.85;
      targets.stalk = 0.8;
      setMove(null);
      if (run.stageT >= beatDuration(run, 'wiggle')) {
        advance(run, run.variant === 'bush' ? 'rear' : 'pounce');
      }
      break;
    }
    case 'pounce': {
      targets.tuck = run.stageT < 0.3 ? 1 : 0;
      targets.land = run.stageT > 0.35 ? 1 : 0;
      targets.headUp = run.stageT < 0.25 ? 1 : 0;
      targets.headDown = run.stageT > 0.4 ? 0.6 : 0;
      setMove(spot, 160);
      if (run.stageT >= beatDuration(run, 'pounce') || distTo(spot) < 14) {
        setMove(null);
        advance(run, 'paw');
      }
      break;
    }
    case 'paw': {
      targets.swat = 1;
      targets.crouch = 0.5;
      targets.headDown = 0.7;
      setMove(null);
      if (run.stageT >= beatDuration(run, 'paw')) {
        advance(run, 'pop');
      }
      break;
    }
    case 'rear': {
      targets.rearUp = 1;
      targets.pawHigh = 1;
      targets.swat = 1;
      targets.headUp = 1;
      setMove(null);
      if (run.stageT >= beatDuration(run, 'rear')) {
        advance(run, 'falls');
      }
      break;
    }
    case 'falls': {
      targets.rearUp = 0;
      targets.pawHigh = 0;
      targets.swat = 0;
      targets.headDown = Math.min(1, run.stageT * 1.4);
      const flutter = LIGHT_FALL.has(run.itemId);
      const u = Math.min(1, run.stageT / beatDuration(run, 'falls'));
      run.itemX = spot.x + (flutter ? Math.sin(u * Math.PI * 3) * 18 : 0);
      run.itemY = spot.y;
      run.itemZ = (1 - u) * 56 + (flutter ? 0 : Math.max(0, 1 - u * 2) * 10);
      setMove(null);
      if (run.stageT >= beatDuration(run, 'falls')) {
        if (!run.revealed) {
          run.revealed = true;
          justRevealed = true;
          goldFlash = run.legendary;
        }
        run.itemZ = 0;
        advance(run, 'sniffItem');
      }
      break;
    }
    case 'pop': {
      targets.land = run.stageT < 0.25 ? 1 : 0.2;
      targets.headDown = 0.3;
      targets.earBack = run.variant !== 'dig' && run.stageT < 0.2 ? 0.5 : 0;
      const u = Math.min(1, run.stageT / beatDuration(run, 'pop'));
      const arc = Math.sin(u * Math.PI);
      run.itemX = spot.x + actor.face * 30 * u;
      run.itemY = spot.y;
      run.itemZ = arc * 56;
      setMove(null);
      if (!run.revealed && u > 0.15) {
        run.revealed = true;
        justRevealed = true;
        goldFlash = run.legendary;
      }
      if (run.stageT >= beatDuration(run, 'pop')) {
        run.itemZ = 0;
        advance(run, run.variant === 'dig' ? 'grab' : 'sniffItem');
      }
      break;
    }
    case 'sniffItem': {
      targets.headDown = 1;
      targets.tailLift = 0.5;
      setMove(null);
      if (run.stageT >= beatDuration(run, 'sniffItem')) {
        advance(run, 'grab');
      }
      break;
    }
    case 'grab': {
      targets.headDown = 1;
      targets.jawHold = 1;
      run.carrying = true;
      setMove(null);
      if (run.stageT >= beatDuration(run, 'grab')) {
        advance(run, 'bring');
      }
      break;
    }
    case 'bring': {
      targets.jawHold = 1;
      targets.tailLift = 0.7;
      targets.wagAmp = 0.45;
      run.carrying = true;
      const front = dropPoint(world);
      setMove(front, 95);
      if (Math.abs(front.x - actor.x) > 4) {
        actor.face = front.x >= actor.x ? 1 : -1;
      }
      if (distTo(front) < 16) {
        setMove(null);
        // Face the player (toward front of stage = +face toward camera-ish: face down-screen by flipping to look "out").
        actor.face = actor.x < front.x ? 1 : -1;
        advance(run, run.legendary ? 'spin' : 'drop');
      }
      break;
    }
    case 'spin': {
      targets.jawHold = 1;
      targets.wagAmp = 0.8;
      run.carrying = true;
      setMove(null);
      if (run.stageT >= beatDuration(run, 'spin')) {
        advance(run, 'drop');
      }
      break;
    }
    case 'drop': {
      targets.jawHold = 0;
      targets.sit = 1;
      targets.wagAmp = 0.7;
      targets.headDown = run.stageT < 0.15 ? 0.6 : 0;
      run.carrying = false;
      run.itemX = actor.x + actor.face * 28;
      run.itemY = actor.y + 8;
      run.itemZ = 0;
      setMove(null);
      if (run.stageT >= beatDuration(run, 'drop')) {
        advance(run, 'done');
      }
      break;
    }
    case 'done':
      setMove(null);
      return { done: true, justRevealed: false, goldFlash: false };
    default:
      setMove(null);
      break;
  }

  return { done: false, justRevealed, goldFlash };
}

export function cancelParkFind(actor: Actor): void {
  if (actor.task.type === 'parkFind') {
    actor.task.parkFind = undefined;
    actor.task.type = 'idle';
    actor.task.stage = '';
    actor.task.t = 0;
  }
}
