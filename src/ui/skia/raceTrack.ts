import { Skia } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import { bodyFrame } from '../../actor';
import type { Actor, Breed } from '../../actor';
import { racePoses } from '../../actor/data/locomotion';
import type { Env } from './env';
import { drawActor } from './pet';
import { drawSkyPane } from './sky';
import { drawPrecip } from './weatherFx';

export const TRACK_DISTANCE = 70;

// Where the player's pet sits across the screen.
const anchor = 0.33;
// The front lane takes this share of the track. Back lanes share the rest and overlap in depth.
const frontShare = 0.5;
// A back-lane pet is drawn this much smaller than the player's.
const backScale = 0.6;
const frontFill = 0.86;
const dashM = 1.2;

export type TrackRacer = {
  x: number;
  name: string;
  mine: boolean;
  actor: Actor;
  breed: Breed;
};

function paint(color: string) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  return p;
}

function stroke(color: string, width: number) {
  const p = paint(color);
  p.setStyle(1);
  p.setStrokeWidth(width);
  return p;
}

type Fit = { fit: number; legPx: number; nosePx: number };

function fitFor(racer: TrackRacer, targetH: number): Fit {
  const { actor, breed } = racer;
  const frame = bodyFrame(
    breed,
    actor.displayAgeDays,
    actor.displayWeight,
    actor.vitality,
    actor.pose,
    actor.bark.open,
    actor.phase,
    0,
    0,
    1,
    { yMin: 0, yMax: 1 },
    actor.speed,
    actor.gait,
    actor.share,
  );
  const drawn = frame.scale * (frame.geom.bodyH + frame.geom.headR * 1.8 + frame.geom.L);
  const fit = targetH / Math.max(drawn, 1);
  return {
    fit,
    legPx: frame.scale * frame.geom.L * fit,
    nosePx: frame.scale * (frame.geom.bodyLen / 2 + frame.geom.headR * 1.7) * fit,
  };
}

// A scrolling stadium track. The player's pet stays about a third of the way across, in the front lane.
export function drawRaceTrack(
  c: SkCanvas,
  width: number,
  height: number,
  env: Env,
  cameraX: number,
  racers: TrackRacer[],
): void {
  const trackTop = height * 0.42;
  const trackH = height - trackTop;
  const frontH = trackH * frontShare;
  const frontTop = height - frontH;
  const petH = frontH * frontFill;
  const mine = racers.find((racer) => racer.mine) ?? racers[0];
  const others = racers.filter((racer) => racer !== mine);
  const mineFit = mine ? fitFor(mine, petH) : null;
  // Screen pixels per meter follow the player's pet, so its paws match the ground it runs over.
  const ppm = mineFit ? mineFit.legPx * racePoses.legsPerMeter : 40;
  // Stop following before the line so it sits left of the edge and pets can run off the right.
  const camera = Math.min(cameraX, Math.max(0, TRACK_DISTANCE - (width * 0.42) / ppm));
  const screenX = (meters: number) => width * anchor + (meters - camera) * ppm;

  drawSkyPane(c, 0, 0, width, height * 0.36, env);
  const stands = paint(env.tod.dark > 0.22 ? '#3A2A55' : '#CDB4F0');
  c.drawRect(Skia.XYWHRect(0, height * 0.18, width, height * 0.18), stands);
  const crowd = paint('#F7D7EA');
  const bob = env.reduced ? 0 : Math.sin(env.t * 2.2) * 2;
  const crowdShift = -camera * ppm * 0.12;
  for (let i = 0; i < 16; i += 1) {
    const x = ((((i * 34 + crowdShift) % (width + 34)) + width + 34) % (width + 34)) - 17;
    c.drawCircle(x, height * 0.29 + bob * (i % 2 === 0 ? 1 : -1), 7, crowd);
  }
  const wall = paint('#F48FB8');
  const wallShift = -camera * ppm * 0.4;
  c.drawRect(Skia.XYWHRect(0, height * 0.34, width, height * 0.08), wall);
  const stripe = paint('#FFE4F1');
  for (let x = ((wallShift % 44) + 44) % 44 - 44; x < width; x += 44) {
    c.drawRect(Skia.XYWHRect(x, height * 0.36, 18, height * 0.04), stripe);
  }
  c.drawRect(Skia.XYWHRect(0, trackTop, width, trackH), paint('#F6E7C1'));
  c.drawRect(Skia.XYWHRect(0, frontTop, width, frontH), paint('#F2DFB2'));

  const backLanes = Math.max(1, others.length);
  const backLaneH = (frontTop - trackTop) / backLanes;
  const dashOff = (((-camera * ppm) % (dashM * 2 * ppm)) + dashM * 2 * ppm) % (dashM * 2 * ppm);
  const dashes = stroke('#E1CD98', 2);
  for (let lane = 1; lane <= backLanes; lane += 1) {
    const y = trackTop + lane * backLaneH;
    for (let x = dashOff - dashM * 2 * ppm; x < width; x += dashM * 2 * ppm) {
      c.drawLine(x, y, x + dashM * ppm, y, dashes);
    }
  }
  const pebble = paint('#E6D3A2');
  for (let x = dashOff - dashM * 2 * ppm; x < width; x += dashM * ppm) {
    c.drawCircle(x, frontTop + frontH * 0.55, 2, pebble);
    c.drawCircle(x + dashM * ppm * 0.5, frontTop + frontH * 0.85, 1.5, pebble);
  }

  for (let mark = 10; mark < TRACK_DISTANCE; mark += 10) {
    const x = screenX(mark);
    if (x < -20 || x > width + 20) continue;
    c.drawLine(x, trackTop, x, height, stroke('#D9C79A', 1.5));
  }
  // Every racer starts with its body centered on 0 m, so the line sits just past the player's nose.
  drawStart(c, screenX(0) + (mineFit?.nosePx ?? 30) + 4, width, trackTop, height);
  drawFinish(c, screenX(TRACK_DISTANCE), width, trackTop, height);

  drawPrecip(c, 0, 0, width, height * 0.7, env);
  if (env.tod.dark > 0.22) {
    c.drawRect(Skia.XYWHRect(0, 0, width, height), paint('rgba(20,16,40,0.12)'));
  }

  others.forEach((racer, index) => {
    const footY = trackTop + (index + 1) * backLaneH - 2;
    const x = screenX(racer.x);
    if (x > width + width * 0.55) return;
    if (x < -40) {
      if (racer.x >= TRACK_DISTANCE) return;
      drawOffscreen(c, 10, footY - backLaneH * 0.5, -1);
      return;
    }
    if (x > width + 40 && racer.x < TRACK_DISTANCE) {
      drawOffscreen(c, width - 10, footY - backLaneH * 0.5, 1);
      return;
    }
    const { fit } = fitFor(racer, petH * backScale);
    drawRacer(c, x, footY, fit, racer, env);
  });
  if (mine && mineFit) {
    const x = screenX(mine.x);
    if (x < width + width * 0.55) drawRacer(c, x, height - frontH * 0.12, mineFit.fit, mine, env);
  }
}

function drawStart(c: SkCanvas, x: number, width: number, top: number, bottom: number): void {
  if (x < -12 || x > width + 12) return;
  c.drawRect(Skia.XYWHRect(x - 1, top, 8, bottom - top), paint('rgba(120,96,60,0.25)'));
  c.drawRect(Skia.XYWHRect(x - 3, top, 6, bottom - top), paint('#FFFFFF'));
  const post = paint('#4A3560');
  const flag = paint('#2DAA6C');
  c.drawRect(Skia.XYWHRect(x - 1.5, top - 26, 3, 26), post);
  const path = Skia.Path.Make();
  path.moveTo(x + 1.5, top - 26);
  path.lineTo(x + 18, top - 20);
  path.lineTo(x + 1.5, top - 14);
  path.close();
  c.drawPath(path, flag);
}

function drawFinish(c: SkCanvas, x: number, width: number, top: number, bottom: number): void {
  const size = 7;
  if (x < -size * 2 || x > width) return;
  const dark = paint('#2A2238');
  const light = paint('#FFFFFF');
  let row = 0;
  for (let y = top; y < bottom; y += size) {
    for (let col = 0; col < 2; col += 1) {
      c.drawRect(Skia.XYWHRect(x + col * size, y, size, Math.min(size, bottom - y)), (row + col) % 2 === 0 ? dark : light);
    }
    row += 1;
  }
}

function drawOffscreen(c: SkCanvas, x: number, y: number, dir: -1 | 1): void {
  const path = Skia.Path.Make();
  path.moveTo(x + dir * 6, y);
  path.lineTo(x - dir * 4, y - 7);
  path.lineTo(x - dir * 4, y + 7);
  path.close();
  c.drawPath(path, paint('#CDB4F0'));
  c.drawPath(path, stroke('#3B2F4A', 2));
}

function drawRacer(c: SkCanvas, x: number, y: number, fit: number, racer: TrackRacer, env: Env): void {
  const { actor, breed } = racer;
  actor.x = x;
  actor.y = y;
  c.save();
  c.translate(x, y);
  c.scale(fit, fit);
  c.translate(-x, -y);
  drawActor(c, actor, breed, { yMin: y, yMax: y + 1 }, env.t, null, false, env.reduced);
  c.restore();
}
