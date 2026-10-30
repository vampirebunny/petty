import { facingRing, type Facing } from '../actor/data/facing';
import { furnitureKinds, type FurniturePiece, type FurniturePlacement } from '../actor/furniture';
import { sceneById, stageHeight, stageWidth } from '../actor/scenes';
import { rngFrom } from '../playdate/rng';
import { gameplayConfig } from '../sim/gameplayConfig';
import { skyAt } from '../actor/sky';

import type { ClipFrame, ClipId, ClipRecord, RoomId } from './types';
import { clipIds, clipVersion } from './types';

export { clipIds };
export type { ClipId };

type Top = { id: string; shape: string };

type Obs = { id: string; x: number; y: number; hw: number; hh: number };

const padX = 36;
const padY = 28;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function seg(t: number, a: number, b: number): number {
  if (b <= a) {
    return t >= b ? 1 : 0;
  }
  return clamp((t - a) / (b - a), 0, 1);
}

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function at(nominal: number, duration: number, script: number): number {
  return (nominal / script) * duration;
}

function young(stage: string): boolean {
  return stage === 'puppy' || stage === 'olderPuppy';
}

function senior(stage: string): boolean {
  return stage === 'senior';
}

function speedScale(record: ClipRecord, sprint: boolean): number {
  if (sprint || !senior(record.pet.stage)) {
    return 1;
  }
  return gameplayConfig.petCam.seniorSpeed;
}

function wobble(record: ClipRecord): number {
  return young(record.pet.stage) ? gameplayConfig.petCam.youngWobble : 1;
}

/** Keeps a walker inside the room frame. */
function inRoomX(x: number): number {
  const margin = gameplayConfig.petCam.edgeMargin;
  return clamp(x, margin, stageWidth - margin);
}

function inRoomY(record: ClipRecord, y: number): number {
  const floor = sceneById(record.roomId).floor;
  return clamp(y, floor.yMin + 40, floor.yMax - 40);
}

export function isNightAt(ms: number): boolean {
  return skyAt(new Date(ms)).sunAltitude <= 0;
}

export function durationOf(id: ClipId): number {
  return gameplayConfig.petCam.clips[id].duration;
}

function pieceAt(record: ClipRecord, place: FurniturePlacement): FurniturePiece | null {
  return record.pieces.find((item) => item.id === place.pieceId) ?? null;
}

function inRoom(record: ClipRecord): FurniturePlacement[] {
  return record.placed.filter((place) => place.sceneId === record.roomId);
}

function isWater(piece: FurniturePiece): boolean {
  return piece.kind === 'bowl' && (piece.contents === 'water' || piece.catalogId === 'bowl_water');
}

export function waterPlacement(record: ClipRecord): FurniturePlacement | null {
  return inRoom(record).find((place) => {
    const piece = pieceAt(record, place);
    return piece ? isWater(piece) : false;
  }) ?? null;
}

export function bedPlacement(record: ClipRecord): FurniturePlacement | null {
  return inRoom(record).find((place) => pieceAt(record, place)?.kind === 'bed') ?? null;
}

function scenery(room: RoomId): Obs[] {
  const scene = sceneById(room);
  const out: Obs[] = [];
  for (const prop of scene.props) {
    if (prop.kind === 'window' || prop.kind === 'rug' || prop.kind === 'lamp' || prop.kind === 'fence') {
      continue;
    }
    if (prop.kind === 'couch' || prop.kind === 'shape' || furnitureKinds.includes(prop.kind as (typeof furnitureKinds)[number])) {
      continue;
    }
    out.push({
      id: prop.id ?? prop.kind,
      x: prop.x,
      y: prop.y,
      hw: (prop.w ?? 70) / 2,
      hh: (prop.h ?? 40) / 2,
    });
  }
  return out;
}

function obstacles(record: ClipRecord): Obs[] {
  const out = scenery(record.roomId);
  for (const place of inRoom(record)) {
    const piece = pieceAt(record, place);
    if (!piece) {
      continue;
    }
    out.push({
      id: place.pieceId,
      x: place.x,
      y: place.y,
      hw: (piece.w ?? 80) / 2,
      hh: (piece.h ?? 48) / 2,
    });
  }
  return out;
}

function hits(x: number, y: number, obs: readonly Obs[]): boolean {
  return obs.some((item) => Math.abs(x - item.x) < item.hw + padX && Math.abs(y - item.y) < item.hh + padY);
}

function separate(x: number, y: number, obs: readonly Obs[]): number {
  let next = x;
  for (let pass = 0; pass < 4; pass += 1) {
    let moved = false;
    for (const item of obs) {
      if (Math.abs(y - item.y) >= item.hh + padY || Math.abs(next - item.x) >= item.hw + padX) {
        continue;
      }
      next = next < item.x ? item.x - item.hw - padX : item.x + item.hw + padX;
      moved = true;
    }
    if (!moved) {
      break;
    }
  }
  return next;
}

function clearSpan(y: number, obs: readonly Obs[]): number {
  const blocks = obs
    .filter((item) => Math.abs(item.y - y) < item.hh + padY)
    .map((item) => [item.x - item.hw - padX, item.x + item.hw + padX] as const)
    .sort((a, b) => a[0] - b[0]);
  let cursor = 24;
  let best = 0;
  for (const [start, end] of blocks) {
    best = Math.max(best, start - cursor);
    cursor = Math.max(cursor, end);
  }
  return Math.max(best, stageWidth - 24 - cursor);
}

export function hasOpenFloor(record: ClipRecord): boolean {
  const obs = obstacles(record);
  const floor = sceneById(record.roomId).floor;
  for (let y = floor.yMin + 36; y <= floor.yMax - 24; y += 22) {
    if (clearSpan(y, obs) >= gameplayConfig.petCam.openFloor) {
      return true;
    }
  }
  return false;
}

function laneY(record: ClipRecord, rng: () => number): number {
  const floor = sceneById(record.roomId).floor;
  const obs = obstacles(record);
  const choices: number[] = [];
  for (let y = floor.yMin + 60; y <= floor.yMax - 60; y += 18) {
    if (clearSpan(y, obs) >= gameplayConfig.petCam.openFloor * 0.65) {
      choices.push(y);
    }
  }
  if (choices.length === 0) {
    return (floor.yMin + floor.yMax) / 2;
  }
  return choices[Math.floor(rng() * choices.length)];
}

type Rolls = {
  entry: 1 | -1;
  depth: number;
  passes: number;
  lanes: number[];
};

function rolls(record: ClipRecord): Rolls {
  const rng = rngFrom('petcam', record.seed, record.clipId);
  const clips = gameplayConfig.petCam.clips;
  const passes = clips.inOut.passesMin + Math.floor(rng() * (clips.inOut.passesMax - clips.inOut.passesMin + 1));
  const lanes = [0, 1, 2, 3, 4].map(() => laneY(record, rng));
  return {
    entry: rng() < 0.5 ? -1 : 1,
    depth: laneY(record, rng),
    passes,
    lanes,
  };
}

function copyPlaced(record: ClipRecord): FurniturePlacement[] {
  return record.placed.map((place) => ({ ...place }));
}

function movePiece(placed: FurniturePlacement[], id: string, x: number, y: number): FurniturePlacement[] {
  return placed.map((place) => (place.pieceId === id ? { ...place, x, y } : place));
}

function sideOf(face: 1 | -1): Facing {
  return face === 1 ? 'E' : 'W';
}

function flip(face: 1 | -1): 1 | -1 {
  return face === 1 ? -1 : 1;
}

function base(
  record: ClipRecord,
  x: number,
  y: number,
  face: 1 | -1,
  pose: ClipFrame['pose'],
  extra?: Partial<ClipFrame>,
): ClipFrame {
  const octant = extra?.octant ?? sideOf(face);
  return {
    x,
    y,
    z: extra?.z ?? 0,
    face,
    octantFrom: extra?.octantFrom ?? octant,
    octant,
    octantBlend: extra?.octantBlend ?? 1,
    pose,
    gait: extra?.gait ?? (pose.walk && pose.walk > 0.2 ? 'trot' : null),
    shake: extra?.shake ?? 0,
    flash: extra?.flash ?? 0,
    stuck: extra?.stuck ?? false,
    hind: extra?.hind ?? false,
    scale: extra?.scale ?? 1,
    placed: extra?.placed ?? copyPlaced(record),
    onScenery: extra?.onScenery ?? false,
    offFrame: extra?.offFrame ?? false,
  };
}

function spin(turns: number, u: number): { from: Facing; octant: Facing; blend: number } {
  const steps = facingRing.length;
  const raw = u * turns * steps;
  const index = Math.floor(raw) % steps;
  const next = (index + 1) % steps;
  return { from: facingRing[index], octant: facingRing[next], blend: raw - Math.floor(raw) };
}

function boop(record: ClipRecord, t: number): ClipFrame {
  const d = durationOf('boop');
  const roll = rolls(record);
  const filter = gameplayConfig.petCam.filter;
  const depth = roll.depth;
  const edge = roll.entry < 0 ? -40 : stageWidth + 40;
  const mid = stageWidth / 2;
  const a = (s: number) => at(s, d, 8);
  let x = mid;
  let y = depth;
  let walk = 0;
  let from: Facing = sideOf(roll.entry === 1 ? -1 : 1);
  let octant: Facing = from;
  let blend = 1;
  if (t < a(2)) {
    x = lerp(edge, mid, ease(seg(t, 0, a(2))));
    walk = 0.85 * speedScale(record, false);
  } else if (t < a(2.6)) {
    from = sideOf(roll.entry === 1 ? -1 : 1);
    octant = 'S';
    blend = seg(t, a(2), a(2.6));
  } else {
    from = 'S';
    octant = 'S';
  }
  // Walking toward the lens: the pet comes forward and grows, the room stays put.
  const front = stageHeight - filter.boopFloorPad;
  let scale = 1;
  if (t >= a(2.6) && t < a(5)) {
    const u = ease(seg(t, a(2.6), a(5)));
    y = lerp(depth, front, u);
    scale = lerp(1, filter.boopScale, u);
    walk = 0.5;
  } else if (t >= a(5) && t < a(5.35)) {
    y = front;
    scale = lerp(filter.boopScale, filter.boopPeak, seg(t, a(5), a(5.35)));
  } else if (t >= a(5.35) && t < a(6.3)) {
    y = front;
    scale = lerp(filter.boopPeak, filter.boopHold, ease(seg(t, a(5.35), a(6.3))));
  } else if (t >= a(6.3)) {
    y = front;
    scale = filter.boopHold;
  }
  const sniff = t >= a(2.6) && t < a(5.3);
  const tilt = t >= a(6.3);
  const wob = wobble(record);
  let shake = 0;
  let flash = 0;
  if (t >= a(5.3) && t < a(5.3) + filter.shakeS) {
    shake = filter.shakePt * (1 - (t - a(5.3)) / filter.shakeS);
  }
  if (t >= a(5.3) && t < a(5.3) + filter.flashS) {
    flash = filter.flash * (1 - (t - a(5.3)) / filter.flashS);
  }
  const blink = t > a(7.55) && t < a(7.85) ? 1 : 0;
  return base(record, x, y, roll.entry === 1 ? -1 : 1, {
    walk,
    faceFront: octant === 'S' ? Math.max(blend, from === 'S' ? 1 : 0) : 0,
    snoutScale: sniff ? 1 + Math.sin(t * 16) * 0.06 : 1,
    headRot: sniff ? Math.sin(t * 7) * 0.12 * wob : tilt ? Math.sin(t * 3) * 0.35 * wob : 0,
    headDx: sniff ? Math.sin(t * 2.2) * 4 : 0,
    eyes: blink,
    wagAmp: tilt ? 0.7 : 0.25,
  }, {
    octantFrom: from,
    octant,
    octantBlend: blend,
    shake,
    flash,
    scale,
    offFrame: t < a(2),
    gait: walk > 0.2 ? 'trot' : null,
  });
}

function sweater(record: ClipRecord, t: number): ClipFrame {
  const d = durationOf('sweater');
  const roll = rolls(record);
  const a = (s: number) => at(s, d, 8.5);
  const y = roll.depth;
  const wob = wobble(record);
  const margin = gameplayConfig.petCam.edgeMargin;
  const left = margin + 40;
  const right = stageWidth - margin - 40;
  let x = stageWidth * 0.5;
  let face: 1 | -1 = roll.entry;
  let walk = 0;
  let stuck = true;
  let shake = 0;
  if (t < a(1)) {
    const turn = seg(t, 0, a(1));
    return base(record, x, y, face, {
      headRot: Math.sin(turn * Math.PI * 2) * 0.4,
      shake: 0.2,
    }, { stuck: true, octantFrom: sideOf(face), octant: sideOf(flip(face)), octantBlend: turn });
  }
  const bumps = gameplayConfig.petCam.filter.bumps;
  const runEnd = a(5.5);
  if (t < runEnd) {
    const u = (t - a(1)) / (runEnd - a(1));
    const leg = Math.min(bumps - 1, Math.floor(u * bumps));
    const local = u * bumps - leg;
    const toward: 1 | -1 = leg % 2 === 0 ? roll.entry : flip(roll.entry);
    const startX = leg === 0 ? stageWidth * 0.5 : toward === 1 ? left : right;
    const endX = toward === 1 ? right : left;
    const run = Math.min(1, local / 0.72);
    x = lerp(startX, endX, ease(run));
    face = toward;
    walk = local < 0.72 ? 0.9 * speedScale(record, false) : 0;
    if (local >= 0.72) {
      x = endX - toward * 14 * Math.sin(seg(local, 0.72, 0.9) * Math.PI);
    }
    shake = local < 0.72 ? 0.35 * wob : 0.6;
  } else if (t < a(6.5)) {
    x = roll.entry === 1 ? right : left;
    face = roll.entry;
    stuck = t < a(6.1);
    shake = stuck ? 1 : seg(t, a(6.1), a(6.5));
  } else {
    x = roll.entry === 1 ? right : left;
    face = roll.entry;
    stuck = false;
  }
  return base(record, x, y, face, {
    walk,
    shake,
    faceFront: t >= a(6.5) ? 1 : 0,
    wagAmp: t >= a(6.5) ? 0.85 : 0.1,
    headRot: t >= a(6.5) ? Math.sin(t) * 0.1 : 0,
  }, {
    stuck,
    octant: t >= a(6.5) ? 'S' : sideOf(face),
    gait: walk > 0.5 ? 'trot' : walk > 0.2 ? 'walk' : null,
  });
}

function tail(record: ClipRecord, t: number): ClipFrame {
  const d = durationOf('tail');
  const roll = rolls(record);
  const a = (s: number) => at(s, d, 8);
  const x = separate(stageWidth * 0.55, roll.depth, obstacles(record));
  const y = roll.depth;
  const wob = wobble(record);
  if (t < a(4.2)) {
    const u = seg(t, 0, a(4.2));
    const turns = lerp(3, 10, u);
    const spun = spin(turns, u);
    return base(record, x, y, 1, { wagAmp: 1, walk: 0.35 }, {
      octantFrom: spun.from,
      octant: spun.octant,
      octantBlend: spun.blend,
      gait: 'trot',
    });
  }
  if (t < a(5.4)) {
    const u = seg(t, a(4.2), a(5.4));
    return base(record, x + Math.sin(t * 9) * 10 * wob, y, roll.entry, {
      walk: 0.45 * (1 - u),
      headRot: Math.sin(t * 8) * 0.4 * wob,
      eyes: 0.45,
      squint: 0.4,
    }, { gait: 'walk' });
  }
  if (t < a(5.8)) {
    return base(record, x, y, roll.entry, { lie: seg(t, a(5.4), a(5.8)), side: seg(t, a(5.4), a(5.8)) });
  }
  return base(record, x, y, roll.entry, {
    lie: 1,
    side: 0.35,
    wagAmp: 0.55,
    faceFront: t > a(7.2) ? 1 : 0,
    pant: 0.6,
  }, { octant: t > a(7.2) ? 'S' : sideOf(roll.entry) });
}

function inOut(record: ClipRecord, t: number): ClipFrame {
  const d = durationOf('inOut');
  const roll = rolls(record);
  const passes = roll.passes;
  const out = gameplayConfig.petCam.offscreen;
  const empty = lerp(gameplayConfig.petCam.clips.inOut.emptyMin, gameplayConfig.petCam.clips.inOut.emptyMax, (record.seed % 100) / 100);
  const passS = 0.85;
  let cursor = 0;
  for (let index = 0; index < passes - 1; index += 1) {
    const face: 1 | -1 = index % 2 === 0 ? roll.entry : flip(roll.entry);
    const y = roll.lanes[index % roll.lanes.length];
    const end = cursor + passS;
    if (t < end) {
      const from = face === 1 ? -out : stageWidth + out;
      const to = face === 1 ? stageWidth + out : -out;
      const x = lerp(from, to, seg(t, cursor, end));
      return base(record, x, y, face, { walk: 1, stream: 1 }, { gait: 'gallop', offFrame: true });
    }
    cursor = end;
    if (t < cursor + empty) {
      return base(record, face === 1 ? stageWidth + out : -out, y, face, { walk: 0 }, { offFrame: true });
    }
    cursor += empty;
  }
  const lane = roll.lanes[0];
  const bed = bedPlacement(record);
  const rug = sceneById(record.roomId).props.find((prop) => prop.kind === 'rug');
  const destX = inRoomX(bed?.x ?? rug?.x ?? stageWidth * 0.5);
  const destY = bed ? bed.y - 10 : inRoomY(record, rug?.y ?? lane);
  const last = seg(t, cursor, d);
  const face: 1 | -1 = destX > stageWidth / 2 ? 1 : -1;
  if (last < 0.55) {
    const x = lerp(face === 1 ? -out : stageWidth + out, destX, ease(last / 0.55));
    const walk = lerp(1, 0.45, last / 0.55);
    return base(record, x, destY, face, { walk, stream: walk > 0.7 ? 1 : 0 }, {
      gait: walk > 0.7 ? 'gallop' : 'trot',
      offFrame: true,
      onScenery: true,
    });
  }
  const lie = seg(last, 0.55, 0.85);
  return base(record, destX, destY, face, {
    walk: lie > 0 ? 0 : 0.3,
    lie,
    eyes: lie,
    breathAmp: 0.02,
  }, { onScenery: true });
}

function hind(record: ClipRecord, t: number): ClipFrame {
  const d = durationOf('hind');
  const roll = rolls(record);
  const youngPet = young(record.pet.stage);
  const drop = youngPet ? gameplayConfig.petCam.clips.hind.puppyDrop : 5.8;
  const a = (s: number) => at(s, d, 8);
  const y = roll.depth;
  const wob = wobble(record);
  const start = stageWidth * 0.32;
  const end = start + stageWidth * 0.28;
  let x = start;
  let stand = 0;
  let walk = 0;
  const face: 1 | -1 = roll.entry;
  if (t < a(1)) {
    stand = 0;
  } else if (t < a(1.6)) {
    stand = seg(t, a(1), a(1.6));
  } else if (t < a(drop)) {
    stand = 1;
    const u = seg(t, a(1.6), a(drop));
    x = lerp(start, end, u);
    walk = 0.55;
    if (!youngPet && t > a(5) && t < a(5.6)) {
      x += Math.sin(t * 22) * 8;
      walk = 0.9;
    }
  } else if (t < a(drop + 0.6)) {
    stand = 1 - seg(t, a(drop), a(drop + 0.6));
    x = end;
  } else {
    x = end;
    stand = 0;
  }
  const look = t >= a(6.4);
  return base(record, x, y, face, {
    stand,
    walk: stand > 0.4 ? walk : 0,
    legPedal: stand > 0.6 ? 0.7 : 0,
    tuck: stand * 0.85,
    headRot: stand > 0.5 ? Math.sin(t * 4) * 0.12 * wob : 0,
    wagAmp: look ? 0.8 : 0.3,
    faceFront: look ? 1 : 0,
  }, {
    hind: stand > 0.2,
    octant: look ? 'S' : sideOf(face),
    gait: walk > 0.2 ? 'walk' : null,
  });
}

function nap(record: ClipRecord, t: number): ClipFrame {
  const d = durationOf('nap');
  const a = (s: number) => at(s, d, 8.5);
  const spot = gameplayConfig.petCam.napSpots[record.roomId === 'bedroom' ? 'bedroom' : 'livingroom'];
  let side = 0;
  let stretch = 0;
  let paddle = 0;
  let eyes = 1;
  if (t >= a(2) && t < a(3.2)) {
    stretch = Math.sin(seg(t, a(2), a(3.2)) * Math.PI);
  } else if (t >= a(3.2) && t < a(4)) {
    side = seg(t, a(3.2), a(4));
  } else if (t >= a(4) && t < a(6)) {
    side = 1;
    paddle = 0.35 + 0.65 * Math.abs(Math.sin(t * 8));
  } else if (t >= a(6) && t < a(7)) {
    side = 1;
    eyes = t < a(6.5) ? 0.45 : 1;
  } else if (t >= a(7)) {
    side = 1;
  }
  return base(record, spot.x, spot.y, 1, {
    lie: 1,
    side,
    stretch,
    paddle,
    eyes,
    breathAmp: 0.025,
    earBack: paddle > 0.5 ? 0.3 : 0,
  }, { onScenery: true, z: spot.z });
}

function bowl(record: ClipRecord, t: number): ClipFrame {
  const d = durationOf('bowl');
  const a = (s: number) => at(s, d, 9);
  const place = waterPlacement(record);
  const roll = rolls(record);
  const cat = record.pet.species === 'cat';
  const start = place ?? { pieceId: 'water', sceneId: record.roomId, x: stageWidth * 0.45, y: roll.depth };
  const dir: 1 | -1 = start.x < stageWidth / 2 ? 1 : -1;
  const reach = gameplayConfig.petCam.pushReach;
  const endX = inRoomX(start.x + dir * reach);
  const endY = inRoomY(record, start.y + (roll.lanes[1] > start.y ? 1 : -1) * 50);
  const gap = cat ? 64 : 74;
  const u = seg(t, a(1), a(7));
  const pulses = 4;
  const stepped = (Math.floor(u * pulses) + ease((u * pulses) % 1)) / pulses;
  const bowlX = lerp(start.x, endX, u >= 1 ? 1 : stepped);
  const bowlY = lerp(start.y, endY, u >= 1 ? 1 : stepped);
  const placed = place ? movePiece(copyPlaced(record), place.pieceId, bowlX, bowlY) : copyPlaced(record);
  const behind = inRoomX(bowlX - dir * gap);
  if (t < a(1)) {
    const x = lerp(inRoomX(start.x - dir * 200), inRoomX(start.x - dir * gap), ease(seg(t, 0, a(1))));
    return base(record, x, start.y, dir, { walk: 0.6, headDown: seg(t, a(0.6), a(1)) * 0.4 }, { placed, gait: 'walk', onScenery: true });
  }
  if (t < a(8)) {
    const moving = u < 1 && (u * pulses) % 1 < 0.7;
    return base(record, behind, bowlY, dir, {
      walk: moving ? 0.4 * speedScale(record, false) : 0,
      headDown: cat ? 0.1 : 0.45,
      paw: cat && moving ? Math.abs(Math.sin(t * 10)) : 0,
    }, { placed, gait: moving ? 'walk' : null, onScenery: true });
  }
  return base(record, behind, bowlY, dir, {
    sit: seg(t, a(8), a(8.4)),
    faceFront: 1,
    headDown: 0,
  }, { placed, octant: 'S', onScenery: true });
}

function bedPush(record: ClipRecord, t: number): ClipFrame {
  const d = durationOf('bedPush');
  const a = (s: number) => at(s, d, 9.5);
  const place = bedPlacement(record);
  const roll = rolls(record);
  const cat = record.pet.species === 'cat';
  const start = place ?? { pieceId: 'bed', sceneId: record.roomId, x: 180, y: roll.depth };
  const window = sceneById(record.roomId).props.find((prop) => prop.kind === 'window');
  const reach = gameplayConfig.petCam.pushReach;
  const towardWindow = window ? (window.x > start.x ? 1 : -1) : start.x < stageWidth / 2 ? 1 : -1;
  const dir = towardWindow as 1 | -1;
  const destX = inRoomX(window ? lerp(start.x, window.x, 0.8) : start.x + dir * reach);
  const destY = inRoomY(record, Math.min(start.y, sceneById(record.roomId).floor.yMin + 90));
  const u = seg(t, a(1), a(7));
  const bedX = lerp(start.x, destX, ease(u));
  const bedY = lerp(start.y, destY, ease(u));
  const placed = place ? movePiece(copyPlaced(record), place.pieceId, bedX, bedY) : copyPlaced(record);
  const gap = 96;
  if (t < a(1)) {
    const x = lerp(inRoomX(start.x - dir * 220), inRoomX(start.x - dir * gap), ease(seg(t, 0, a(1))));
    return base(record, x, start.y, dir, { walk: 0.55 }, { placed, gait: 'walk', onScenery: true });
  }
  if (t < a(7)) {
    const tug = Math.sin(t * (cat ? 5 : 3.2)) > 0.1;
    return base(record, inRoomX(bedX - dir * gap), bedY, dir, {
      walk: tug ? 0.4 * speedScale(record, false) : 0,
      headDown: cat ? 0.2 : 0.35,
    }, { placed, gait: tug ? 'walk' : null, onScenery: true });
  }
  if (t < a(8)) {
    const spun = spin(1, seg(t, a(7), a(8)));
    return base(record, bedX, bedY - 6, dir, { walk: 0.3 }, {
      placed,
      octantFrom: spun.from,
      octant: spun.octant,
      octantBlend: spun.blend,
      onScenery: true,
      gait: 'walk',
    });
  }
  const lie = seg(t, a(8), a(8.6));
  return base(record, bedX, bedY - 6, dir, { lie, eyes: lie, breathAmp: 0.02 }, { placed, onScenery: true });
}

const samplers: Record<ClipId, (record: ClipRecord, t: number) => ClipFrame> = {
  boop,
  sweater,
  tail,
  inOut,
  hind,
  nap,
  bowl,
  bedPush,
};

export function frameAt(record: ClipRecord, t: number): ClipFrame {
  const duration = durationOf(record.clipId);
  const time = clamp(t, 0, duration);
  const frame = samplers[record.clipId](record, time);
  if (!frame.onScenery && frame.scale <= 1) {
    frame.x = separate(frame.x, frame.y, obstacles(record));
  }
  if (!frame.offFrame) {
    frame.x = inRoomX(frame.x);
  }
  return frame;
}

export function ownsTop(tops: readonly Top[]): boolean {
  return tops.length > 0;
}

export function preferredTop(tops: readonly Top[], rng: () => number): Top | null {
  const preferred = tops.filter((item) => item.shape === 'sweater' || item.shape === 'hoodie');
  const pool = preferred.length > 0 ? preferred : tops;
  if (pool.length === 0) {
    return null;
  }
  return pool[Math.floor(rng() * pool.length)];
}

export function eligibleIds(
  species: 'dog' | 'cat',
  room: RoomId,
  pieces: FurniturePiece[],
  placed: FurniturePlacement[],
  tops: readonly Top[],
): ClipId[] {
  const probe: ClipRecord = {
    clipId: 'boop',
    clipVersion,
    seed: 1,
    roomId: room,
    recordedAt: 0,
    isNight: false,
    pet: {
      species,
      breedId: '',
      ageDays: 0,
      stage: 'adult',
      look: null,
      equipped: {},
      vitality: 1,
      weight: 0,
    },
    pieces,
    placed,
    sweaterItemId: null,
  };
  const ids: ClipId[] = [];
  for (const id of clipIds) {
    if (id === 'tail' && (species !== 'dog' || !hasOpenFloor(probe))) {
      continue;
    }
    if (id === 'sweater' && !ownsTop(tops)) {
      continue;
    }
    if (id === 'nap' && room !== 'livingroom' && room !== 'bedroom') {
      continue;
    }
    if (id === 'bowl' && !waterPlacement(probe)) {
      continue;
    }
    if (id === 'bedPush' && !bedPlacement(probe)) {
      continue;
    }
    ids.push(id);
  }
  return ids;
}

export function petOverlapsFurniture(record: ClipRecord, t: number): boolean {
  const frame = frameAt(record, t);
  if (frame.onScenery || frame.scale > 1.2) {
    return false;
  }
  return hits(frame.x, frame.y, obstacles(record));
}
