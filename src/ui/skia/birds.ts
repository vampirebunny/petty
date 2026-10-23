import { ClipOp, Skia } from '@shopify/react-native-skia';
import type { SkCanvas } from '@shopify/react-native-skia';

import type { Bird, BirdPose, BirdSpecies } from '../../actor/birds';
import { circle, darken, ellipse, lighten, line, ov, poly, stroke } from './ink';

// NPC birds, drawn in the same hand as the scenery: flat fills, one soft highlight, a slightly darker
// underside, no outlines, and the pets' big sparkly eyes with a touch of blush.
//
// Everything is drawn in local units with the feet (or the duck's waterline) at (0, 0), facing +x.
// The caller depth-sorts birds with props and pets by `bird.depth` and draws airborne birds last.
// Colours go through ink.ts, so the scene tint and night lighting apply automatically.

/** Overall bird size against the stage. Tune once against the real pets. */
export const BIRD_SCALE = 1.3;

export const BIRD_SIZE: Record<BirdSpecies, number> = {
  sparrow: 1,
  robin: 1.12,
  cardinal: 1.05,
  pigeon: 1.28,
  duck: 1.35,
  owl: 1.25,
};

/** The fields of Env the birds use. The app's Env satisfies this. */
export interface BirdEnv {
  t: number;
  reduced?: boolean;
}

const INK = '#1f1b2a';
const SPARKLE = '#ffffff';
const BLUSH = '#ff8fa3';

interface Songbird {
  body: string;
  belly: string;
  wing: string;
  wingTip: string;
  tail: string;
  head: string;
  beak: string;
  legs: string;
  /** Optional markings, drawn by name. */
  cap?: string;
  cheek?: string;
  bib?: string;
  mask?: string;
  crest?: string;
  neck?: [string, string];
  ring?: string;
  streaks?: string;
  bars?: string;
  /** Proportions. */
  bodyRx: number;
  bodyRy: number;
  headR: number;
  headX: number;
  headY: number;
  tailLen: number;
}

const SPARROW: Songbird = {
  body: '#a77b52',
  belly: '#e7dccb',
  wing: '#8c6240',
  wingTip: '#5e3f28',
  tail: '#6f4c31',
  head: '#b79b80',
  cap: '#93583a',
  cheek: '#ece4d8',
  bib: '#4a3a32',
  beak: '#4d4038',
  legs: '#c99b7c',
  streaks: '#5e3f28',
  bodyRx: 7,
  bodyRy: 5.6,
  headR: 4.9,
  headX: 5.6,
  headY: -12.6,
  tailLen: 1,
};

const ROBIN: Songbird = {
  body: '#6e6258',
  belly: '#f08a3c',
  wing: '#5e5249',
  wingTip: '#3f3630',
  tail: '#3f3630',
  head: '#3d3532',
  beak: '#f2c14e',
  legs: '#b9967e',
  ring: '#ffffff',
  bodyRx: 7.4,
  bodyRy: 6,
  headR: 4.9,
  headX: 5.8,
  headY: -13.2,
  tailLen: 1.1,
};

const CARDINAL: Songbird = {
  body: '#e0403a',
  belly: '#ee5a4c',
  wing: '#c4322f',
  wingTip: '#9c2525',
  tail: '#b52b2a',
  head: '#e84a40',
  crest: '#e0403a',
  mask: '#2a1f22',
  beak: '#ff8a3d',
  legs: '#c98f86',
  bodyRx: 7,
  bodyRy: 5.7,
  headR: 4.9,
  headX: 5.6,
  headY: -12.8,
  tailLen: 1.25,
};

const PIGEON: Songbird = {
  body: '#9aa3b4',
  belly: '#aeb6c5',
  wing: '#b7bfcc',
  wingTip: '#5c6272',
  tail: '#6b7182',
  head: '#7d8598',
  neck: ['#5fbf9a', '#a77cc9'],
  bars: '#4c5262',
  beak: '#3b3a40',
  legs: '#e0707a',
  ring: '#f0a04a',
  bodyRx: 8.6,
  bodyRy: 6.4,
  headR: 4.3,
  headX: 6.8,
  headY: -13.6,
  tailLen: 1,
};

const SONGBIRDS: Partial<Record<BirdSpecies, Songbird>> = { sparrow: SPARROW, robin: ROBIN, cardinal: CARDINAL, pigeon: PIGEON };

// ---- entry points ----

/** Ripples and shadows, drawn under the bird at its depth. Call just before drawBird. */
export function drawBirdGround(c: SkCanvas, b: Bird, env: BirdEnv): void {
  for (const r of b.ripples) {
    if (r.age < 0) {
      continue;
    }
    const k = r.age / 1.6;
    const rx = (7 + r.age * 16) * BIRD_SCALE;
    c.drawOval(ov(r.x, r.y + 0.5, rx, rx * 0.28), stroke('#ffffff', 1.1, 0.55 * (1 - k)));
  }
  // Perched and swimming birds have no ground shadow (a bird flying to a perch has no ground we know of).
  if (b.spot.on !== 'ground') {
    return;
  }
  const s = BIRD_SIZE[b.species] * BIRD_SCALE;
  const fade = Math.max(0, 1 - b.pose.lift / 140);
  if (fade > 0.02) {
    const w = (7.5 - Math.min(4, b.pose.lift / 25)) * s;
    ellipse(c, b.x, b.y + 0.6, w, w * 0.28, '#000000', 0.16 * fade);
  }
}

export function drawBird(c: SkCanvas, b: Bird, env: BirdEnv): void {
  const s = BIRD_SIZE[b.species] * BIRD_SCALE;
  c.save();
  c.translate(b.x, b.y - b.pose.lift);
  c.scale(s * b.face, s);
  if (b.species === 'owl') {
    drawOwl(c, b.pose);
  } else if (b.species === 'duck') {
    drawDuck(c, b.pose, b.variant, b.airborne);
  } else {
    drawSongbird(c, SONGBIRDS[b.species] as Songbird, b.pose, b.species);
  }
  c.restore();
}

/** Ground shadow, ripples and bird in one call, for callers that don't split passes. */
export function drawBirdFull(c: SkCanvas, b: Bird, env: BirdEnv): void {
  drawBirdGround(c, b, env);
  drawBird(c, b, env);
}

// ---- pieces shared by all birds ----

function eye(c: SkCanvas, x: number, y: number, r: number, p: BirdPose, lid: string): void {
  if (p.blink > 0.5) {
    line(c, x - r * 1.05, y + r * 0.15, x + r * 1.05, y + r * 0.15, INK, r * 0.55);
    return;
  }
  circle(c, x, y, r, INK);
  circle(c, x + r * 0.32, y - r * 0.36, r * 0.38, SPARKLE);
  circle(c, x - r * 0.3, y + r * 0.32, r * 0.16, SPARKLE, 0.9);
  if (p.sleepy > 0.02) {
    // A lid sliding down: a head-coloured disc lowered over the eye.
    circle(c, x, y - r * 2.15 * (1 - p.sleepy) - r * 0.1, r * 1.15, lid);
  }
}

/** A wing in flight, hinged at the shoulder. `angle` > 0 lifts it. */
function flightWing(c: SkCanvas, x: number, y: number, angle: number, len: number, color: string, tip: string): void {
  c.save();
  c.translate(x, y);
  c.rotate(angle, 0, 0);
  ellipse(c, -len * 0.48, 0, len * 0.55, len * 0.2, color);
  // Primaries: a darker rounded tip.
  ellipse(c, -len * 0.86, 0.2, len * 0.22, len * 0.15, tip);
  ellipse(c, -len * 0.3, -len * 0.06, len * 0.24, len * 0.07, lighten(color, 0.2), 0.5);
  c.restore();
}

// ---- songbirds (sparrow, robin, cardinal, pigeon) ----

function drawSongbird(c: SkCanvas, k: Songbird, p: BirdPose, species: BirdSpecies): void {
  const flying = p.fly > 0.5;
  const by = -8 + p.bob; // body centre
  // Legs first, so the body sits on them.
  if (!flying) {
    const legTop = by + k.bodyRy * 0.55;
    line(c, -1.6, legTop, -1.9, -0.3, k.legs, 1.05);
    line(c, 1.3, legTop, 1.6, -0.3, k.legs, 1.05);
    line(c, -1.9, -0.2, 0.2, -0.2, k.legs, 0.9);
    line(c, 1.6, -0.2, 3.6, -0.2, k.legs, 0.9);
  }
  c.save();
  c.rotate(p.pitch, 0, by + 2);
  const shoulderX = -0.4;
  const shoulderY = by - k.bodyRy * 0.45;
  if (flying) {
    flightWing(c, shoulderX + 1.2, shoulderY - 0.4, p.flap * 0.85 + 8, 13, darken(k.wing, 0.18), darken(k.wingTip, 0.1));
  }
  // Tail: a fan behind the body, a little longer on the cardinal.
  const tl = 7.5 * k.tailLen;
  poly(c, [-k.bodyRx + 2.2, by - 1.6, -k.bodyRx - tl, by - 4.8, -k.bodyRx - tl + 0.4, by - 1.4, -k.bodyRx + 2.4, by + 2.2], k.tail);
  ellipse(c, 0, by, k.bodyRx, k.bodyRy, k.body);
  // Underside: belly, with a slightly darker band at the very bottom for weight.
  ellipse(c, 1.6, by + 1.4, k.bodyRx * 0.74, k.bodyRy * 0.66, k.belly);
  ellipse(c, 0.6, by + k.bodyRy * 0.72, k.bodyRx * 0.55, k.bodyRy * 0.22, darken(k.belly, 0.08), 0.6);
  if (k.streaks) {
    // Sparrow back streaks.
    line(c, -4.6, by - 3.4, -1.4, by - 4.6, k.streaks, 0.8, 0.7);
    line(c, -5.2, by - 1.6, -2.2, by - 2.8, k.streaks, 0.8, 0.7);
  }
  if (!flying) {
    // Folded wing.
    ellipse(c, -1.6, by - 0.4, k.bodyRx * 0.74, k.bodyRy * 0.58, k.wing);
    poly(c, [-3.4, by - 1.6, -k.bodyRx - 3.2, by - 2.6, -3.8, by + 2.1], k.wingTip);
    if (k.bars) {
      line(c, -3.6, by + 0.2, -0.2, by - 0.6, k.bars, 1.1);
      line(c, -4.4, by + 1.8, -1.2, by + 1.1, k.bars, 1.1);
    }
    ellipse(c, -1.2, by - 2.6, 2.6, 0.9, lighten(k.wing, 0.3), 0.45);
  }
  ellipse(c, 0.8, by - k.bodyRy * 0.66, 3, 1.15, lighten(k.body, 0.32), 0.45);
  if (k.neck) {
    ellipse(c, 4.4, by - 3.2, 3, 2.6, k.neck[0], 0.85);
    ellipse(c, 4.8, by - 1.6, 2.6, 1.8, k.neck[1], 0.7);
  }
  drawSongHead(c, k, p, species);
  if (flying) {
    flightWing(c, shoulderX, shoulderY, p.flap, 14, k.wing, k.wingTip);
  }
  c.restore();
}

function drawSongHead(c: SkCanvas, k: Songbird, p: BirdPose, species: BirdSpecies): void {
  const hx = k.headX + p.headX;
  const hy = k.headY + p.bob + p.headY;
  c.save();
  c.rotate(p.tilt, hx, hy);
  if (p.preen > 0.5) {
    // Turned back into the wing.
    c.translate(hx, 0);
    c.scale(-1, 1);
    c.translate(-hx, 0);
  }
  const r = k.headR;
  if (k.crest) {
    poly(c, [hx - r * 0.9, hy - r * 0.35, hx - r * 1.75, hy - r * 1.85, hx - r * 0.95, hy - r * 1.55, hx + r * 0.25, hy - r * 0.85], k.crest);
  }
  circle(c, hx, hy, r, k.head);
  if (k.cap) {
    ellipse(c, hx - r * 0.25, hy - r * 0.55, r * 0.82, r * 0.5, k.cap);
  }
  if (k.cheek) {
    ellipse(c, hx + r * 0.2, hy + r * 0.32, r * 0.62, r * 0.42, k.cheek);
  }
  ellipse(c, hx - r * 0.3, hy - r * 0.62, r * 0.42, r * 0.2, lighten(k.cap ?? k.head, 0.35), 0.45);
  const ex = hx + r * 0.42;
  const ey = hy - r * 0.18;
  const er = r * 0.33;
  if (k.mask) {
    poly(c, [ex - er * 1.6, ey - er * 1.2, hx + r * 1.15, hy - r * 0.32, hx + r * 1.2, hy + r * 0.55, ex - er * 0.4, hy + r * 0.95], k.mask);
  }
  if (k.bib) {
    ellipse(c, hx + r * 0.62, hy + r * 0.92, r * 0.36, r * 0.3, k.bib, 0.85);
  }
  // Beak: upper and a darker lower half.
  const bx = hx + r * 0.9;
  const blen = species === 'pigeon' ? 3 : 3.6;
  poly(c, [bx, hy - r * 0.34, bx + blen, hy + r * 0.02, bx, hy + r * 0.16], k.beak);
  poly(c, [bx, hy + r * 0.16, bx + blen * 0.86, hy + r * 0.06, bx, hy + r * 0.38], darken(k.beak, 0.2));
  if (species === 'pigeon') {
    ellipse(c, bx + 0.2, hy - r * 0.3, 1, 0.55, '#f1eef0', 0.9); // cere
  }
  if (k.ring && p.blink < 0.5) {
    circle(c, ex, ey, er * 1.42, k.ring, species === 'robin' ? 0.95 : 0.9);
    if (species === 'robin') {
      // A broken eye ring: cover the middle so it reads as two arcs.
      ellipse(c, ex + er * 1.2, ey, er * 0.6, er * 0.5, k.head);
      ellipse(c, ex - er * 1.2, ey, er * 0.6, er * 0.5, k.head);
    }
  }
  eye(c, ex, ey, er, p, k.mask ?? k.head);
  ellipse(c, hx + r * 0.36, hy + r * 0.5, r * 0.3, r * 0.17, BLUSH, k.mask ? 0.2 : 0.35);
  c.restore();
}

// ---- duck ----

const DRAKE = { body: '#cfd2d6', chest: '#8a4f37', head: '#2f8a5a', headHi: '#47b07a', ring: '#ffffff', bill: '#f3c64a', back: '#a8adb4', tail: '#2b2b33', wing: '#b8bcc2', spec: '#4767c9' };
const HEN = { body: '#b68a5c', chest: '#a87a4e', head: '#a07850', headHi: '#c09a70', ring: '', bill: '#f0954a', back: '#8f6a45', tail: '#7a5636', wing: '#9b744c', spec: '#4767c9' };

function drawDuck(c: SkCanvas, p: BirdPose, variant: number, flying: boolean): void {
  const k = variant === 0 ? DRAKE : HEN;
  const floating = !flying;
  c.save();
  if (floating) {
    // Everything below the waterline is hidden, which also hides the head when dabbling.
    c.clipRect(Skia.XYWHRect(-40, -60, 80, 60), ClipOp.Intersect, true);
    c.rotate(p.dabble * 108, 1, -1);
  } else {
    c.rotate(p.pitch * 0.6, 0, -6);
  }
  const by = (floating ? -1.6 : -8) + p.bob;
  if (flying) {
    flightWing(c, 0.5, by - 4.4, p.flap * 0.85 + 8, 16, darken(k.wing, 0.18), darken(k.wing, 0.35));
  }
  // Tail curl and stern.
  poly(c, [-8.5, by - 1.5, -14.5, by - 5.2, -13, by + 0.6, -8, by + 2.5], k.tail);
  if (variant === 0) {
    c.drawPath(curl(-12.2, by - 4.6), stroke(k.tail, 1.1));
  }
  ellipse(c, 0, by, 11.5, 6.4, k.body);
  ellipse(c, 6.2, by - 0.4, 5.4, 5.4, k.chest);
  ellipse(c, -2.4, by - 3.2, 7.6, 3, k.back);
  if (!flying) {
    ellipse(c, -2.4, by - 1.6, 7, 3.6, k.wing);
    ellipse(c, -5.6, by - 1.2, 2.8, 1.3, k.spec, 0.9); // speculum
    ellipse(c, -1.6, by - 3.6, 3.2, 1, lighten(k.wing, 0.3), 0.5);
  }
  if (variant === 1) {
    // Hen mottling.
    for (const [mx, my] of [[-4, -1.5], [0, -0.4], [3.4, -1.8], [-7, 0.2], [1.6, 1.4]] as const) {
      ellipse(c, mx, by + my, 1.2, 0.7, darken(k.body, 0.2), 0.6);
    }
  }
  // Neck and head.
  const hx = 8.4 + p.headX;
  const hy = by - 10.4 + p.headY;
  c.save();
  c.rotate(p.tilt * 0.6, hx, hy);
  if (p.preen > 0.5) {
    c.translate(hx - 4, 0);
    c.scale(-1, 1);
    c.translate(-(hx - 4), 0);
  }
  ellipse(c, hx - 1.2, hy + 5, 3, 5.4, k.head);
  if (variant === 0) {
    ellipse(c, hx - 1, hy + 8.2, 3.4, 1, k.ring);
  }
  circle(c, hx, hy, 5.2, k.head);
  ellipse(c, hx - 1.2, hy - 2.6, 2.6, 1.3, k.headHi, 0.6);
  if (variant === 1) {
    line(c, hx - 4.2, hy - 0.6, hx + 3.2, hy - 1.2, darken(k.head, 0.3), 0.9); // eye stripe
  }
  // Bill: a soft rounded paddle.
  ellipse(c, hx + 6.6, hy + 0.9, 3.6, 1.6, k.bill);
  ellipse(c, hx + 6.4, hy + 1.8, 3.2, 0.9, darken(k.bill, 0.15));
  eye(c, hx + 1.9, hy - 0.8, 1.5, p, k.head);
  ellipse(c, hx + 1.8, hy + 2.1, 1.4, 0.8, BLUSH, 0.3);
  c.restore();
  if (flying) {
    flightWing(c, -0.5, by - 4.8, p.flap, 17, k.wing, darken(k.wing, 0.3));
    // Tucked orange feet.
    ellipse(c, -9, by + 4.2, 2.2, 0.9, '#f0954a');
  }
  c.restore();
  if (floating && p.dabble > 0.45) {
    // Bottoms up: little orange feet paddling above the water.
    const k2 = (p.dabble - 0.45) / 0.55;
    const kick = Math.sin(p.bob * 9 + p.dabble * 20) * 2.2;
    for (const [fx, ph] of [[-4.5, 0], [-1.2, 1]] as const) {
      const fy = -7 * k2 - (ph ? -kick : kick) * k2;
      line(c, fx, -2, fx - 0.6, fy + 1.5, '#f0954a', 1);
      poly(c, [fx - 2.6, fy, fx + 1.6, fy - 0.6, fx - 0.4, fy + 2.2], '#f6a24f');
    }
  }
  if (floating) {
    // Waterline sparkle across the hull.
    c.drawOval(ov(0, 0, 13.5, 1.6), stroke('#ffffff', 0.9, 0.45));
  }
}

function curl(x: number, y: number) {
  const path = Skia.Path.Make();
  path.moveTo(x, y);
  path.quadTo(x + 1.6, y - 3.2, x + 3.4, y - 1.6);
  return path;
}

// ---- owl (night, perched) ----

const OWL = { body: '#8b6a4f', belly: '#d9c3a2', face: '#e9d8bd', disc: '#c49d78', tuft: '#6e533e', iris: '#f2b43a', beak: '#5a4636', claw: '#e0a24a', bars: '#9c7d60' };

function drawOwl(c: SkCanvas, p: BirdPose): void {
  const k = OWL;
  const by = -11.5 + p.bob;
  // Talons over the branch.
  for (const fx of [-3.2, 2.6]) {
    ellipse(c, fx, -0.6, 2.2, 1.3, k.claw);
  }
  // Tail peeking below.
  poly(c, [-4, by + 8, 4, by + 8, 2.4, by + 13.4, -2.4, by + 13.4], darken(k.body, 0.1));
  ellipse(c, 0, by, 9.4, 11.6, k.body);
  ellipse(c, 0, by + 3, 6.4, 7.6, k.belly);
  for (const [vx, vy] of [[-2.6, 0.6], [2.6, 0.6], [0, 3.4], [-3, 6], [3, 6], [0, 8.6]] as const) {
    poly(c, [vx - 1.1, by + vy, vx, by + vy + 1.1, vx + 1.1, by + vy], k.bars, 0.8);
  }
  // Wings hugging the sides.
  ellipse(c, -7.6, by + 2.4, 3.2, 8, darken(k.body, 0.08));
  ellipse(c, 7.6, by + 2.4, 3.2, 8, darken(k.body, 0.08));
  ellipse(c, -2, by - 8, 4, 1.6, lighten(k.body, 0.3), 0.4);
  // Head, which can swivel.
  const hx = p.swivel * 2.2;
  const hy = by - 10 + p.headY;
  c.save();
  c.rotate(p.tilt * 0.5, hx, hy);
  poly(c, [hx - 8, hy - 3, hx - 7.6, hy - 10.4, hx - 3.6, hy - 6], k.tuft);
  poly(c, [hx + 8, hy - 3, hx + 7.6, hy - 10.4, hx + 3.6, hy - 6], k.tuft);
  ellipse(c, hx, hy, 9.4, 8.2, k.body);
  ellipse(c, hx - 3.8, hy + 0.4, 4.6, 4.4, k.disc);
  ellipse(c, hx + 3.8, hy + 0.4, 4.6, 4.4, k.disc);
  ellipse(c, hx - 3.8, hy + 0.4, 3.9, 3.8, k.face);
  ellipse(c, hx + 3.8, hy + 0.4, 3.9, 3.8, k.face);
  for (const ex of [-3.7, 3.7]) {
    const x = hx + ex;
    const y = hy + 0.2;
    if (p.blink > 0.5) {
      line(c, x - 2.4, y + 0.4, x + 2.4, y + 0.4, INK, 1);
      continue;
    }
    circle(c, x, y, 2.9, k.iris);
    circle(c, x + p.swivel * 0.4, y, 2.1, INK);
    circle(c, x + 0.75, y - 0.8, 0.8, SPARKLE);
    circle(c, x - 0.6, y + 0.7, 0.35, SPARKLE, 0.9);
    if (p.sleepy > 0.02) {
      circle(c, x, y - 6.2 * (1 - p.sleepy) - 0.3, 3.3, k.face);
    }
  }
  poly(c, [hx - 1.2, hy + 2.2, hx + 1.2, hy + 2.2, hx, hy + 4.8], k.beak);
  ellipse(c, hx - 5.8, hy + 4.4, 1.6, 0.9, BLUSH, 0.3);
  ellipse(c, hx + 5.8, hy + 4.4, 1.6, 0.9, BLUSH, 0.3);
  c.restore();
}
