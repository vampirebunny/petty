import { Skia } from '@shopify/react-native-skia';
import type { SkCanvas, SkFont } from '@shopify/react-native-skia';

import { bodyFrame } from '../../actor';
import type { Actor, Breed } from '../../actor';
import type { Env } from './env';
import { weatherOf } from './env';
import { hash } from './ink';
import { drawActor } from './pet';
import { drawSkyPane } from './sky';
import { drawPrecip } from './weatherFx';

// Where the player's pet sits across the screen.
const anchor = 0.33;
// Tallest the pet may draw, as a share of the stage.
const petShare = 0.3;
const rulerM = 10;
// Meters across the screen. The camera follows the pet, so the landing stays in view.
const viewM = 9;
// The pet's body is drawn this long on the ruler, so a 6 m jump reads as several body lengths.
const bodyM = 1.3;

export const diveLayout = { deck: 0.7, water: 0.8, wallTop: 0.36, wallBottom: 0.52 };

export type DiveFit = { fit: number; legPx: number; pawPx: number; bodyPx: number; ppm: number; legsPerMeter: number };

export type DivePet = {
  /** Body position in meters from the dock's start. */
  x: number;
  /** 0 on the deck, 1 at the waterline. */
  level: number;
  /** Lift above `level`, in screen pixels. */
  liftPx: number;
  wet: boolean;
  actor: Actor;
  breed: Breed;
};

export type DiveFlag = { m: number; mine: boolean; fresh: boolean };

export type DiveSplash = { m: number; ageS: number; size: number; flop: boolean };

/** A distance pop-up over the splash. */
export type DiveLabel = { m: number; text: string; big: boolean; alpha: number };

export type DiveFonts = { ruler: SkFont | null; label: SkFont | null; big: SkFont | null };

function paint(color: string, alpha = 1) {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  if (alpha < 1) p.setAlphaf(alpha);
  return p;
}

function stroke(color: string, width: number, alpha = 1) {
  const p = paint(color, alpha);
  p.setStyle(1);
  p.setStrokeWidth(width);
  return p;
}

// Scale for the player's pet, sized to the ruler. The gait rate follows, so paws stay planted.
export function diveFit(actor: Actor, breed: Breed, width: number, height: number): DiveFit {
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
  const ppm = width / viewM;
  const byLength = (bodyM * ppm) / Math.max(frame.scale * frame.geom.bodyLen, 1);
  const fit = Math.min(byLength, (height * petShare) / Math.max(drawn, 1));
  const legPx = frame.scale * frame.geom.L * fit;
  return {
    fit,
    legPx,
    pawPx: frame.scale * frame.geom.bodyLen * 0.4 * fit,
    bodyPx: frame.scale * frame.geom.bodyH * fit,
    ppm,
    legsPerMeter: ppm / Math.max(legPx, 1),
  };
}

export function drawDockDive(
  c: SkCanvas,
  width: number,
  height: number,
  env: Env,
  cameraX: number,
  fit: DiveFit,
  dock: { dockM: number; zoneM: number },
  pet: DivePet | null,
  flags: DiveFlag[],
  splashes: DiveSplash[],
  labels: DiveLabel[],
  fonts: DiveFonts,
): void {
  const font = fonts.ruler;
  const { ppm } = fit;
  const farM = dock.dockM + rulerM + 1;
  const camera = Math.min(cameraX, Math.max(0, farM - (width * (1 - anchor)) / ppm));
  // Meters are measured at the front paws, so course lines sit a paw ahead of the body.
  const screenX = (meters: number) => width * anchor + (meters - camera) * ppm + fit.pawPx;
  const deckY = height * diveLayout.deck;
  const waterY = height * diveLayout.water;
  const wallTop = height * diveLayout.wallTop;
  const wallBottom = height * diveLayout.wallBottom;
  const dark = env.tod.dark > 0.22;
  const edgeX = screenX(dock.dockM);

  drawSkyPane(c, 0, 0, width, wallTop, env);
  // Hedge and stadium wall behind the pool, drifting slower than the water.
  const hedgeShift = -camera * ppm * 0.2;
  c.drawRect(Skia.XYWHRect(0, wallTop - height * 0.08, width, height * 0.08), paint(dark ? '#2F4A3A' : '#8CCB8F'));
  for (let i = -1; i < width / 30 + 2; i += 1) {
    const x = ((((i * 30 + hedgeShift) % (width + 60)) + width + 60) % (width + 60)) - 30;
    c.drawCircle(x, wallTop - height * 0.08, 16, paint(dark ? '#2F4A3A' : '#8CCB8F'));
  }
  c.drawRect(Skia.XYWHRect(0, wallTop, width, wallBottom - wallTop), paint(dark ? '#C9C2E0' : '#FFFFFF'));
  const tile = stroke(dark ? '#A79FC4' : '#D8EEF6', 1);
  const tileM = 0.5;
  const firstTile = Math.floor((camera - width / ppm) / tileM) * tileM;
  for (let m = firstTile; screenX(m) < width + 4; m += tileM) {
    const x = screenX(m);
    if (x > -4) c.drawLine(x, wallTop, x, wallBottom, tile);
  }
  c.drawLine(0, (wallTop + wallBottom) / 2, width, (wallTop + wallBottom) / 2, tile);

  // Distance ruler along the far wall, 0 m at the dock edge.
  const rulerY = wallTop + (wallBottom - wallTop) * 0.72;
  c.drawRect(Skia.XYWHRect(edgeX, rulerY - 2, rulerM * ppm, 4), paint('#4A3560'));
  for (let m = 0; m <= rulerM; m += 1) {
    const x = screenX(dock.dockM + m);
    if (x < -20 || x > width + 20) continue;
    const major = m % 5 === 0;
    c.drawRect(Skia.XYWHRect(x - 1, rulerY - (major ? 12 : 7), 2, major ? 14 : 9), paint('#4A3560'));
    if (font) {
      const label = `${m}`;
      c.drawText(label, x - font.getTextWidth(label) / 2, rulerY - 15, paint('#4A3560'), font);
    }
  }

  // Water, then the pool lip at the far wall.
  c.drawRect(Skia.XYWHRect(0, wallBottom, width, height - wallBottom), paint(dark ? '#2B5C8A' : '#7FD3F0'));
  c.drawRect(Skia.XYWHRect(0, wallBottom, width, 4), paint(dark ? '#9FB4D6' : '#E9F8FF'));
  const shimmer = stroke('#FFFFFF', 1.5, dark ? 0.2 : 0.45);
  const t = env.reduced ? 0 : env.t;
  for (let i = 0; i < 12; i += 1) {
    const wx = ((hash(i, 3) * (width + 80) - camera * ppm * 0.9 + t * 12 * (i % 2 === 0 ? 1 : -1)) % (width + 80) + width + 80) % (width + 80) - 40;
    const wy = wallBottom + 10 + hash(i, 5) * (height - wallBottom - 20);
    c.drawLine(wx, wy, wx + 14 + hash(i, 7) * 12, wy, shimmer);
  }
  const weather = weatherOf(env);
  if (weather.precip === 'rain' && weather.intensity > 0.02) {
    const rings = Math.round(6 + weather.intensity * 10);
    for (let i = 0; i < rings; i += 1) {
      const k = (t * 1.4 + i / rings) % 1;
      const n = Math.floor(t * 1.4 + i / rings);
      const rx = hash(n * 7 + i, 11) * width;
      const ry = wallBottom + 8 + hash(n * 7 + i, 13) * (height - wallBottom - 12);
      c.drawOval(Skia.XYWHRect(rx - 10 * k - 2, ry - 3 * k - 1, 20 * k + 4, 6 * k + 2), stroke('#FFFFFF', 1.2, 0.6 * (1 - k)));
    }
  }

  // Flags stand on the ruler: older attempts faded, the latest bright.
  for (const flag of [...flags].sort((a, b) => Number(a.mine) - Number(b.mine))) {
    const x = screenX(dock.dockM + flag.m);
    if (x < -10 || x > width + 10) continue;
    drawFlag(c, x, rulerY, flag.mine ? '#FF8FC0' : '#FFFFFF', flag.fresh ? 1 : 0.45);
  }

  for (const splash of splashes) drawSplashRings(c, screenX(dock.dockM + splash.m), waterY, splash, ppm, env.reduced);

  drawDock(c, edgeX, deckY, waterY, height, ppm, dock.zoneM, dark);

  if (pet) {
    const x = screenX(pet.x) - fit.pawPx;
    const y = deckY + (waterY - deckY) * pet.level - pet.liftPx;
    // A swimming pet floats with its body half under the waterline.
    const sink = pet.wet ? fit.bodyPx * 0.5 + fit.legPx : 0;
    drawPet(c, x, y + sink, fit.fit, pet.actor, pet.breed, env);
    if (pet.wet) {
      c.drawRect(Skia.XYWHRect(0, waterY - 2, width, height - waterY + 2), paint(dark ? '#2B5C8A' : '#7FD3F0', 0.72));
      c.drawLine(x - fit.pawPx * 2, waterY, x + fit.pawPx * 2, waterY, stroke('#FFFFFF', 2, 0.7));
    }
  }

  for (const splash of splashes) drawSplashDrops(c, screenX(dock.dockM + splash.m), waterY, splash, ppm, env.reduced);

  for (const label of labels) {
    const labelFont = label.big ? fonts.big : fonts.label;
    if (!labelFont || label.alpha <= 0) continue;
    const w = labelFont.getTextWidth(label.text);
    const x = clampX(screenX(dock.dockM + label.m) - w / 2, 4, width - w - 4);
    const y = wallBottom + (waterY - wallBottom) * 0.35;
    const outline = stroke('#4A3560', 4, label.alpha);
    outline.setStrokeJoin(1);
    c.drawText(label.text, x, y, outline, labelFont);
    c.drawText(label.text, x, y, paint(label.big ? '#FFE38A' : '#FFFFFF', label.alpha), labelFont);
  }

  drawPrecip(c, 0, 0, width, height, env);
  if (dark) c.drawRect(Skia.XYWHRect(0, 0, width, height), paint('rgba(20,16,40,0.12)'));
}

function clampX(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(lo, hi), Math.max(lo, x));
}

function drawDock(c: SkCanvas, edgeX: number, deckY: number, waterY: number, height: number, ppm: number, zoneM: number, dark: boolean): void {
  if (edgeX < 0) return;
  const plank = paint(dark ? '#8A6A4E' : '#C99A6B');
  const side = paint(dark ? '#6B4F3A' : '#A27650');
  const seam = stroke(dark ? '#5A4030' : '#8E6342', 1.5);
  const thick = Math.max(8, (waterY - deckY) * 0.5);
  for (const px of [edgeX - ppm * 0.4, edgeX - ppm * 4, edgeX - ppm * 8]) {
    if (px > -10) c.drawRect(Skia.XYWHRect(px - 4, deckY + thick, 8, height - deckY - thick), side);
  }
  c.drawRect(Skia.XYWHRect(0, deckY, edgeX, thick), plank);
  c.drawRect(Skia.XYWHRect(0, deckY + thick - 4, edgeX, 4), side);
  for (let x = edgeX - ppm * 0.6; x > 0; x -= ppm * 0.6) c.drawLine(x, deckY, x, deckY + thick - 4, seam);
  // The edge zone is a mint band on the deck.
  const from = Math.max(0, edgeX - zoneM * ppm);
  c.drawRect(Skia.XYWHRect(from, deckY, edgeX - from, thick - 4), paint('#79C8A0', 0.55));
  const dash = stroke('#2DAA6C', 2);
  for (let y = deckY; y < deckY + thick - 4; y += 6) c.drawLine(from, y, from, Math.min(deckY + thick - 4, y + 3), dash);
  c.drawRect(Skia.XYWHRect(edgeX - 3, deckY, 3, thick), paint('#FFFFFF'));
}

function drawFlag(c: SkCanvas, x: number, y: number, color: string, alpha: number): void {
  c.drawRect(Skia.XYWHRect(x - 1, y - 30, 2, 30), paint('#4A3560', alpha));
  const path = Skia.Path.Make();
  path.moveTo(x + 1, y - 30);
  path.lineTo(x + 15, y - 25);
  path.lineTo(x + 1, y - 20);
  path.close();
  c.drawPath(path, paint(color, alpha));
  c.drawPath(path, stroke('#4A3560', 1.5, alpha));
}

const splashS = 1.6;

function drawSplashRings(c: SkCanvas, x: number, y: number, splash: DiveSplash, ppm: number, reduced: boolean): void {
  if (splash.ageS < 0 || splash.ageS > splashS * 1.5) return;
  const rings = reduced ? 1 : 3;
  for (let i = 0; i < rings; i += 1) {
    const k = Math.min(1, (splash.ageS - i * 0.25) / splashS);
    if (k <= 0) continue;
    const w = ppm * (0.4 + 1.4 * k) * (splash.flop ? 1.4 : 1) * (0.6 + 0.4 * splash.size);
    c.drawOval(Skia.XYWHRect(x - w / 2, y - w * 0.09, w, w * 0.18), stroke('#FFFFFF', 2, 0.8 * (1 - k)));
  }
}

function drawSplashDrops(c: SkCanvas, x: number, y: number, splash: DiveSplash, ppm: number, reduced: boolean): void {
  const life = splash.flop ? 0.6 : 0.85;
  if (splash.ageS < 0 || splash.ageS > life) return;
  const k = splash.ageS / life;
  const count = reduced ? 6 : Math.round(10 + 12 * splash.size);
  const drop = paint('#FFFFFF', 0.9 * (1 - k));
  const rise = ppm * (splash.flop ? 0.5 : 0.9 + 0.9 * splash.size);
  const spread = ppm * (splash.flop ? 1.4 : 0.8);
  for (let i = 0; i < count; i += 1) {
    const dir = hash(i, 17) * 2 - 1;
    const up = 0.5 + hash(i, 19) * 0.5;
    const dx = dir * spread * k;
    const dy = -rise * up * (4 * k * (1 - k));
    c.drawCircle(x + dx, y + dy, 2 + hash(i, 23) * 2.5 * (1 - k), drop);
  }
  if (!splash.flop) {
    const col = rise * (1 - k) * 0.7;
    c.drawOval(Skia.XYWHRect(x - ppm * 0.18, y - col, ppm * 0.36, col + 4), paint('#FFFFFF', 0.55 * (1 - k)));
  }
}

function drawPet(c: SkCanvas, x: number, y: number, fit: number, actor: Actor, breed: Breed, env: Env): void {
  actor.x = x;
  actor.y = y;
  c.save();
  c.translate(x, y);
  c.scale(fit, fit);
  c.translate(-x, -y);
  drawActor(c, actor, breed, { yMin: y, yMax: y + 1 }, env.t, null, false, env.reduced);
  c.restore();
}
