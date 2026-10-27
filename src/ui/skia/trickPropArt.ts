import { ClipOp, PaintStyle, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia';
import type { SkCanvas, SkPath, SkPicture } from '@shopify/react-native-skia';

import { barTop, CONES, HOOP, hoopCenter, HURDLE, PROP_SCALE, TUNNEL, type PlacedTrickProp } from '../../sim/trickProps';

// Cel-shaded toy props: flat base, one shade band, a highlight, and an outline in each part's own deep tone.
// Every prop draws in two passes around the pet. The back pass is everything behind the pet's depth line,
// the front pass everything in front of it.

// 'whole' draws the prop as one depth-sorted item: back and front together. Cones always use it,
// and so do callers with no pet in the scene (storage glyph, previews).
type Pass = 'back' | 'front' | 'whole';
type Pt = { x: number; y: number };
// inside and insideDeep are the dark interior colors used when this tone is a tunnel's body.
type Tone = { main: string; shade: string; deep: string; light: string; inside: string; insideDeep: string };
// a is the prop's lead color, b its trim.
type Palette = { a: Tone; b: Tone };

const s = PROP_SCALE;
const LINE = 1.15 * s;
const INK = '#3B2357';
const WHITE = '#FFFFFF';
const CREAM = '#FFF9F0';
const CREAM_DEEP = '#B9A6D1';
const PINK: Tone = { main: '#FFB3DA', shade: '#F28CBF', deep: '#C95F98', light: '#FFE3F1', inside: '#5E3560', insideDeep: '#3E2142' };
const SKY: Tone = { main: '#9FD4FF', shade: '#73B6EC', deep: '#4E8FCC', light: '#E2F2FF', inside: '#2F4466', insideDeep: '#1E2C45' };
const MINT: Tone = { main: '#9FE3CF', shade: '#6FCDB2', deep: '#3E9E86', light: '#DDF7EE', inside: '#24564F', insideDeep: '#163A35' };
const CORAL: Tone = { main: '#FFB39B', shade: '#F48E72', deep: '#C9604A', light: '#FFE4DA', inside: '#6B3428', insideDeep: '#47211A' };
const LILAC: Tone = { main: '#CDB8F5', shade: '#AA92E6', deep: '#7A62BF', light: '#EEE6FD', inside: '#43356E', insideDeep: '#2B2148' };
const SUN: Tone = { main: '#FFD978', shade: '#F5BC45', deep: '#C98D22', light: '#FFF1C7', inside: '#6A4A16', insideDeep: '#45300C' };
const GOLD: Tone = { main: '#FFD36E', shade: '#F2B13E', deep: '#C98A22', light: '#FFF0C4', inside: '#6A4A16', insideDeep: '#45300C' };
const SAND: Tone = { main: '#D9C6F2', shade: '#B49BD6', deep: '#8C72B4', light: '#F1E8FC', inside: '#43356E', insideDeep: '#2B2148' };

// Each prop has its own palette so a course of mixed props reads as a set of distinct pieces.
// A cat's copy swaps lead and trim, so dog and cat versions of the same prop still differ.
const PROP_PALETTES: Record<PlacedTrickProp['type'], Palette> = {
  tunnel: { a: MINT, b: CORAL },
  hoop: { a: CORAL, b: LILAC },
  hurdle: { a: SUN, b: SKY },
  cones: { a: PINK, b: LILAC },
  podium: { a: GOLD, b: CORAL },
};

function paletteFor(type: PlacedTrickProp['type'], species: 'dog' | 'cat'): Palette {
  const base = PROP_PALETTES[type];
  return species === 'cat' ? { a: base.b, b: base.a } : base;
}

// A tiny path builder with canvas-style arcs (degrees, clockwise unless ccw).
class Pen {
  readonly path: SkPath = Skia.Path.Make();
  m(x: number, y: number): this {
    this.path.moveTo(x, y);
    return this;
  }
  l(x: number, y: number): this {
    this.path.lineTo(x, y);
    return this;
  }
  q(cx: number, cy: number, x: number, y: number): this {
    this.path.quadTo(cx, cy, x, y);
    return this;
  }
  e(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, ccw = false): this {
    const sweep = ccw ? -((((a0 - a1) % 360) + 360) % 360) : (((a1 - a0) % 360) + 360) % 360;
    this.path.arcToOval(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2), a0, sweep, false);
    return this;
  }
  o(cx: number, cy: number, rx: number, ry: number): this {
    this.path.addOval(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2));
    return this;
  }
  r(x: number, y: number, w: number, h: number, rad: number): this {
    this.path.addRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), rad, rad));
    return this;
  }
  z(): this {
    this.path.close();
    return this;
  }
}

const pen = () => new Pen();

type Ctx = {
  fill: (p: Pen, color: string, alpha?: number) => void;
  stroke: (p: Pen, color: string, width: number, alpha?: number, cap?: 'round' | 'butt', dash?: number[]) => void;
  clip: (p: Pen) => void;
  save: () => void;
  restore: () => void;
};

function skiaCtx(canvas: SkCanvas): Ctx {
  const base = (color: string, alpha: number) => {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color(color));
    paint.setAlphaf(alpha);
    return paint;
  };
  return {
    fill: (p, color, alpha = 1) => canvas.drawPath(p.path, base(color, alpha)),
    stroke: (p, color, width, alpha = 1, cap = 'round', dash) => {
      const paint = base(color, alpha);
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(width);
      paint.setStrokeCap(cap === 'butt' ? StrokeCap.Butt : StrokeCap.Round);
      paint.setStrokeJoin(StrokeJoin.Round);
      if (dash) {
        paint.setPathEffect(Skia.PathEffect.MakeDash(dash, 0));
      }
      canvas.drawPath(p.path, paint);
    },
    clip: (p) => canvas.clipPath(p.path, ClipOp.Intersect, true),
    save: () => {
      canvas.save();
    },
    restore: () => canvas.restore(),
  };
}

// Props only change when they are knocked or refitted, so each pass is recorded once and replayed.
const pictures = new Map<string, SkPicture>();

// Cones sit on a single depth line, so they should be one depth-sorted item at prop.y ('whole'),
// not split into back and front. See splitsAroundActors.
export function splitsAroundActors(prop: PlacedTrickProp): boolean {
  return prop.type !== 'cones';
}

export function drawTrickProp(canvas: SkCanvas, prop: PlacedTrickProp, pass: Pass): void {
  const species = prop.sourceTrickId.startsWith('cat') ? 'cat' : 'dog';
  const key = [prop.type, pass, species, prop.knocked ? 1 : 0, Math.round(barTop(prop)), Math.round(hoopCenter(prop))].join('|');
  let picture = pictures.get(key);
  if (!picture) {
    const recorder = Skia.PictureRecorder();
    const recording = recorder.beginRecording(Skia.XYWHRect(-320, -320, 640, 640));
    const c = skiaCtx(recording);
    const palette = paletteFor(prop.type, species);
    if (pass === 'whole' || prop.type === 'cones') {
      // A split call on cones still draws the line once, on the back pass.
      if (pass !== 'front') {
        paintProp(c, prop, 'back', palette);
        paintProp(c, prop, 'front', palette);
      }
    } else {
      paintProp(c, prop, pass, palette);
    }
    picture = recorder.finishRecordingAsPicture();
    if (pictures.size > 64) {
      pictures.clear();
    }
    pictures.set(key, picture);
  }
  canvas.save();
  canvas.translate(prop.x, prop.y);
  canvas.drawPicture(picture);
  canvas.restore();
}

function paintProp(c: Ctx, prop: PlacedTrickProp, pass: 'back' | 'front', p: Palette): void {
  if (prop.type === 'podium') {
    podium(c, pass);
  } else if (prop.type === 'tunnel') {
    tunnel(c, pass, p);
  } else if (prop.type === 'hurdle') {
    hurdle(c, pass, prop, p);
  } else if (prop.type === 'hoop') {
    hoop(c, pass, prop, p);
  } else if (prop.type === 'cones') {
    cones(c, pass, p);
  }
}

function groundShadow(c: Ctx, cx: number, cy: number, rx: number, ry: number): void {
  c.fill(pen().o(cx, cy, rx * 1.25, ry * 1.5), INK, 0.06);
  c.fill(pen().o(cx, cy, rx, ry), INK, 0.12);
}

function star(c: Ctx, x: number, y: number, r: number): void {
  const shape = pen();
  for (let i = 0; i < 10; i += 1) {
    const a = ((-90 + i * 36) * Math.PI) / 180;
    const rad = i % 2 === 0 ? r : r * 0.5;
    if (i === 0) {
      shape.m(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    } else {
      shape.l(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
  }
  shape.z();
  c.fill(shape, GOLD.main);
  c.save();
  c.clip(shape);
  c.fill(pen().r(x + r * 0.05, y - r, r * 1.2, r * 2.2, 0), GOLD.shade);
  c.restore();
  c.stroke(shape, GOLD.deep, LINE);
  c.fill(pen().o(x - r * 0.28, y - r * 0.22, r * 0.17, r * 0.17), WHITE, 0.9);
}

function podium(c: Ctx, pass: Pass): void {
  if (pass !== 'back') {
    return;
  }
  const w = 40 * s;
  const top = -28 * s;
  groundShadow(c, 0, -2 * s, w + 4 * s, 7 * s);
  const side = pen().m(-w, top).l(-w, -6 * s).q(0, 6 * s, w, -6 * s).l(w, top).z();
  c.fill(side, GOLD.main);
  c.save();
  c.clip(side);
  c.fill(pen().r(-w - 2, -15 * s, w * 2 + 4, 4.5 * s, 0), CREAM);
  c.fill(pen().r(w * 0.35, top - 10 * s, w, 50 * s, 0), INK, 0.12);
  c.fill(pen().r(-w * 0.75, top + 4 * s, 3 * s, 16 * s, 1.5 * s), WHITE, 0.6);
  c.restore();
  c.stroke(side, GOLD.deep, LINE);
  const lid = pen().o(0, top, w, 8 * s);
  c.fill(lid, GOLD.light);
  c.fill(pen().o(0, top + 1 * s, w * 0.82, 5.6 * s), '#FFE7A8');
  c.stroke(lid, GOLD.deep, LINE);
  star(c, 0, -10 * s, 4.6 * s);
}

// Fabric agility tunnel: wire ribs, end cuffs, and two sandbags holding it down.
// Back pass: shadow, the dark openings, and the outer half of each cuff lip.
// Front pass: the wall, cut along the inner half of each opening so it never covers a mouth.
function tunnel(c: Ctx, pass: Pass, p: Palette): void {
  const { half, height, foot, mouth } = TUNNEL;
  const top = -height;
  const cy = (top + foot) / 2;
  const ry = (foot - top) / 2;
  const cuff = 9 * s;
  const lip = 4.5 * s;
  if (pass === 'back') {
    groundShadow(c, 0, 2, half + mouth * 0.6, 6 * s);
    for (const side of [-1, 1]) {
      const x = side * half;
      c.fill(pen().o(x, cy, mouth, ry), p.a.inside);
      c.fill(pen().o(x - side * mouth * 0.32, cy + 1.5 * s, mouth * 0.6, ry * 0.78), p.a.insideDeep);
      const a0 = side < 0 ? 90 : -90;
      const a1 = side < 0 ? 270 : 90;
      c.stroke(pen().e(x, cy, mouth, ry, a0, a1), p.b.deep, lip + LINE * 2, 1, 'butt');
      c.stroke(pen().e(x, cy, mouth, ry, a0, a1), p.b.main, lip, 1, 'butt');
      c.stroke(pen().e(x, cy, mouth, ry, side < 0 ? 95 : 25, side < 0 ? 155 : 85), p.b.shade, lip * 0.7, 1, 'butt');
      c.stroke(pen().e(x, cy, mouth + lip * 0.25, ry + lip * 0.25, side < 0 ? 200 : -62, side < 0 ? 242 : -22), p.b.light, 1.3 * s);
    }
    return;
  }
  const wall = pen().m(-half, top).l(half, top).e(half, cy, mouth, ry, -90, 90, true).l(-half, foot).e(-half, cy, mouth, ry, 90, -90, true).z();
  const wide = (half + mouth) * 2;
  c.fill(wall, p.a.main);
  c.save();
  c.clip(wall);
  c.fill(pen().r(-half - mouth, cy + ry * 0.3, wide, ry, 0), p.a.shade);
  c.fill(pen().r(-half - mouth, foot - 3.5 * s, wide, 6 * s, 0), p.a.deep, 0.45);
  const lo = -half + cuff;
  const hi = half - cuff;
  const panels = 7;
  for (let i = 0; i < panels; i += 1) {
    const x0 = lo + (i * (hi - lo)) / panels;
    const x1 = lo + ((i + 1) * (hi - lo)) / panels;
    c.fill(pen().r(x0 + 3 * s, top + 5 * s, x1 - x0 - 6 * s, 4 * s, 2 * s), p.a.light, 0.8);
    if (i > 0) {
      c.stroke(pen().e(x0, cy, mouth * 0.7, ry, -90, 90), p.a.deep, 2.2 * s, 0.55, 'butt');
      c.stroke(pen().e(x0 - 1.8 * s, cy, mouth * 0.7, ry, -88, -12), p.a.light, 1.3 * s, 0.9);
    }
  }
  for (const side of [-1, 1]) {
    const x = side * half;
    const xi = side * (half - cuff);
    const band =
      side < 0
        ? pen().m(x, top).l(xi, top).e(xi, cy, mouth, ry, -90, 90).l(x, foot).e(x, cy, mouth, ry, 90, -90, true).z()
        : pen().m(x, top).l(xi, top).e(xi, cy, mouth, ry, -90, 90, true).l(x, foot).e(x, cy, mouth, ry, 90, 270).z();
    c.fill(band, p.b.main);
    c.save();
    c.clip(band);
    c.fill(pen().r(-half - mouth, cy + ry * 0.3, wide, ry, 0), p.b.shade);
    c.fill(pen().r(-half - mouth, top + 3.5 * s, wide, 3 * s, 0), p.b.light, 0.8);
    c.restore();
    c.stroke(pen().e(xi, cy, mouth, ry, -90, 90, side > 0), p.b.deep, 1.4 * s, 0.85);
    // The cut edge shows only on the wall side, so nothing covers a pet standing in the mouth.
    c.stroke(pen().e(x, cy, mouth, ry, side < 0 ? -90 : 90, side < 0 ? 90 : 270), p.b.deep, 3.2 * s, 1, 'butt');
  }
  c.restore();
  c.stroke(wall, p.a.deep, LINE);
  // The opening ends on the ground line. This skirt covers the paws that cross below it.
  const skirt = pen().r(-half - mouth, 0, (half + mouth) * 2, 16, 0);
  c.fill(skirt, p.a.main);
  c.fill(pen().r(-half - mouth, 8, (half + mouth) * 2, 8, 0), p.a.shade);
  sandbag(c, -half * 0.42, cy, ry, foot, mouth);
  sandbag(c, half * 0.42, cy, ry, foot, mouth);
}

function sandbag(c: Ctx, x: number, cy: number, ry: number, foot: number, mouth: number): void {
  const strap = () => pen().e(x, cy, mouth * 0.72, ry + 1.2 * s, -90, 62);
  c.stroke(strap(), SAND.deep, 5.4 * s + LINE * 2, 1, 'butt');
  c.stroke(strap(), SAND.main, 5.4 * s, 1, 'butt');
  c.stroke(pen().e(x, cy, mouth * 0.72, ry + 1.2 * s, 10, 62), SAND.shade, 5.4 * s, 1, 'butt');
  c.stroke(pen().e(x - 1.2 * s, cy, mouth * 0.72, ry + 1.2 * s, -86, -40), SAND.light, 1.2 * s);
  const px = x + mouth * 0.42;
  const py = foot - 3 * s;
  const pouch = pen().o(px, py, 8 * s, 5 * s);
  c.fill(pouch, SAND.main);
  c.save();
  c.clip(pouch);
  c.fill(pen().o(px + 2.2 * s, py + 2.6 * s, 8 * s, 5 * s), SAND.shade);
  c.restore();
  c.stroke(pouch, SAND.deep, LINE);
  c.stroke(pen().m(px - 4.5 * s, py - 0.6 * s).l(px + 4.5 * s, py - 0.6 * s), SAND.deep, 0.8 * s, 0.6, 'round', [1.6 * s, 1.4 * s]);
  c.fill(pen().o(px - 3.2 * s, py - 2.4 * s, 2.4 * s, 1.1 * s), SAND.light, 0.95);
}

// Agility jump: striped uprights with ball tops on rubber feet, jump cups, and a candy-striped pole.
// The pole runs across the path, so its far half draws behind the pet and its near half in front.
function hurdle(c: Ctx, pass: Pass, prop: PlacedTrickProp, p: Palette): void {
  const { depth, skew, bar } = HURDLE;
  const top = barTop(prop);
  const postH = top + 12 * s;
  const far = { x: skew, y: -depth };
  const near = { x: -skew, y: depth };
  const knocked = prop.knocked;
  const z = knocked ? bar / 2 : top - bar / 2;
  const a = knocked ? { x: far.x + 16 * s, y: far.y + 4 * s } : far;
  const b = knocked ? { x: near.x + 4 * s, y: near.y } : near;
  const at = (t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - z });
  if (pass === 'back') {
    groundShadow(c, far.x, far.y, 9 * s, 2.6 * s);
    groundShadow(c, near.x, near.y, 9 * s, 2.6 * s);
    if (!knocked) {
      c.stroke(pen().m(far.x, far.y).l(near.x, near.y), INK, bar, 0.08);
    }
    upright(c, far, postH, p);
    pole(c, at, 0, 0.5, p);
    if (!knocked) {
      cup(c, far, top, p);
    }
    return;
  }
  pole(c, at, 0.5, 1, p);
  upright(c, near, postH, p);
  if (!knocked) {
    cup(c, near, top, p);
  }
}

function upright(c: Ctx, base: Pt, postH: number, p: Palette): void {
  const w = HURDLE.post;
  const foot = pen().r(base.x - 8 * s, base.y - 2.2 * s, 16 * s, 4 * s, 2 * s);
  c.fill(foot, p.b.main);
  c.fill(pen().r(base.x - 8 * s, base.y, 16 * s, 1.8 * s, 0.9 * s), p.b.shade);
  c.stroke(foot, p.b.deep, LINE);
  const post = pen().r(base.x - w / 2, base.y - postH, w, postH, w / 2);
  c.fill(post, CREAM);
  c.save();
  c.clip(post);
  for (let y = base.y - 8 * s; y > base.y - postH + 6 * s; y -= 11 * s) {
    c.fill(pen().r(base.x - w, y - 4.5 * s, w * 2, 4.5 * s, 0), p.a.main);
  }
  c.fill(pen().r(base.x + w * 0.12, base.y - postH - 2 * s, w, postH + 4 * s, 0), INK, 0.14);
  c.fill(pen().r(base.x - w * 0.32, base.y - postH + 3 * s, w * 0.16, postH - 8 * s, w * 0.08), WHITE, 0.8);
  c.restore();
  c.stroke(post, CREAM_DEEP, LINE);
  const fy = base.y - postH - 2.2 * s;
  const r = 4.4 * s;
  const ball = pen().o(base.x, fy, r, r);
  c.fill(ball, p.a.shade);
  c.save();
  c.clip(ball);
  c.fill(pen().o(base.x - 1.1 * s, fy - 1.1 * s, r * 0.92, r * 0.92), p.a.main);
  c.restore();
  c.fill(pen().o(base.x - 1.6 * s, fy - 1.8 * s, 1.3 * s, 1 * s), WHITE, 0.95);
  c.stroke(ball, p.a.deep, LINE);
}

function cup(c: Ctx, base: Pt, top: number, p: Palette): void {
  const { post: w, bar } = HURDLE;
  const shape = pen().r(base.x - w / 2 - 1.6 * s, base.y - top + bar * 0.35, w + 3.2 * s, bar * 0.75, 1.6 * s);
  c.fill(shape, p.b.main);
  c.stroke(shape, p.b.deep, LINE);
  c.stroke(pen().m(base.x - w / 2, base.y - top + bar * 0.55).l(base.x + w / 2 - 1 * s, base.y - top + bar * 0.55), p.b.light, 0.9 * s);
}

function pole(c: Ctx, at: (t: number) => Pt, t0: number, t1: number, p: Palette): void {
  const bar = HURDLE.bar;
  const A = at(0);
  const B = at(1);
  const len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
  const nx = (B.y - A.y) / len;
  const ny = -(B.x - A.x) / len;
  const seg = (u0: number, u1: number, off = 0) => {
    const q0 = at(u0);
    const q1 = at(u1);
    return pen().m(q0.x + nx * off, q0.y + ny * off).l(q1.x + nx * off, q1.y + ny * off);
  };
  const cap = (t: number, r: number, color: string) => {
    const q = at(t);
    c.fill(pen().o(q.x, q.y, r, r), color);
  };
  const ends = [0, 1].filter((t) => t >= t0 && t <= t1);
  c.stroke(seg(t0, t1), p.a.deep, bar + LINE * 2, 1, 'butt');
  ends.forEach((t) => cap(t, bar / 2 + LINE, p.a.deep));
  const stripes = 6;
  for (let k = 0; k < stripes; k += 1) {
    const u0 = Math.max(t0, k / stripes);
    const u1 = Math.min(t1, (k + 1) / stripes);
    if (u1 <= u0) {
      continue;
    }
    const color = k % 2 === 0 ? CREAM : p.a.main;
    c.stroke(seg(u0, u1), color, bar, 1, 'butt');
    if (k === 0 && t0 === 0) {
      cap(0, bar / 2, color);
    }
    if (k === stripes - 1 && t1 === 1) {
      cap(1, bar / 2, color);
    }
  }
  c.stroke(seg(t0, t1, bar * 0.22), INK, bar * 0.32, 0.16, 'butt');
  c.stroke(seg(Math.max(t0, 0.05), Math.min(t1, 0.95), -bar * 0.24), WHITE, bar * 0.2, 0.85, 'butt');
}

// Circus hoop wrapped in striped tape, clamped to a weighted stand.
// Left half behind the pet, right half in front, so the pet threads the ring.
function hoop(c: Ctx, pass: Pass, prop: PlacedTrickProp, p: Palette): void {
  const { r, ring } = HOOP;
  const z = hoopCenter(prop);
  if (pass === 'back') {
    groundShadow(c, 0, 0.5 * s, 17 * s, 4 * s);
    stand(c, z - r - ring / 2, p);
    tube(c, z, 90, 270, [192, 245], p);
    return;
  }
  tube(c, z, -90, 90, [-80, -36], p);
  star(c, 0, -z - r, 6.5 * s);
}

function tube(c: Ctx, z: number, a0: number, a1: number, glint: [number, number], p: Palette): void {
  const { r, tilt, ring: w } = HOOP;
  const arc = (rx: number, ry: number, b0 = a0, b1 = a1) => pen().e(0, -z, rx, ry, b0, b1);
  c.stroke(arc(tilt, r), p.a.deep, w + LINE * 2, 1, 'butt');
  c.stroke(arc(tilt, r), p.a.main, w, 1, 'butt');
  c.stroke(arc(tilt, r), CREAM, w, 1, 'butt', [5 * s, 6 * s]);
  c.stroke(arc(tilt - w * 0.2, r - w * 0.2), INK, w * 0.45, 0.16, 'butt');
  c.stroke(arc(tilt + w * 0.22, r + w * 0.22, glint[0], glint[1]), WHITE, w * 0.22, 0.9);
}

function stand(c: Ctx, height: number, p: Palette): void {
  const pw = 4.4 * s;
  if (height > 6 * s) {
    const post = pen().r(-pw / 2, -height - 1 * s, pw, height - 5 * s, pw / 2);
    c.fill(post, CREAM);
    c.save();
    c.clip(post);
    c.fill(pen().r(pw * 0.1, -height - 2 * s, pw, height, 0), INK, 0.14);
    c.restore();
    c.stroke(post, CREAM_DEEP, LINE);
  }
  const base = pen().m(-15 * s, 0).q(-15 * s, -7.5 * s, 0, -8 * s).q(15 * s, -7.5 * s, 15 * s, 0).z();
  c.fill(base, p.b.main);
  c.save();
  c.clip(base);
  c.fill(pen().r(2 * s, -9 * s, 16 * s, 10 * s, 0), p.b.shade);
  c.fill(pen().r(-16 * s, -2.6 * s, 32 * s, 3 * s, 0), p.b.deep);
  c.restore();
  c.fill(pen().o(-6 * s, -5 * s, 3.4 * s, 1.5 * s), p.b.light, 0.95);
  c.stroke(base, p.b.deep, LINE);
  if (height > 6 * s) {
    const collar = pen().r(-3.8 * s, -height - 1.5 * s, 7.6 * s, 5 * s, 1.8 * s);
    c.fill(collar, p.b.main);
    c.stroke(collar, p.b.deep, LINE);
    c.stroke(pen().m(-2.2 * s, -height + 0.2 * s).l(1.6 * s, -height + 0.2 * s), p.b.light, 0.9 * s);
  }
}

// Glossy training cones with reflective bands on square base plates.
// The line is one depth plane: the room sorts it against every pet by prop.y.
function cones(c: Ctx, pass: 'back' | 'front', p: Palette): void {
  if (pass !== 'back') {
    return;
  }
  const xs = CONES.xs.map((x) => x * s);
  xs.forEach((x) => groundShadow(c, x + 1 * s, 0.5 * s, CONES.w * 1.35, 3.6 * s));
  xs.forEach((x, i) => cone(c, x, i % 2 === 0 ? p.a : p.b));
}

function cone(c: Ctx, cx: number, t: Tone): void {
  const { h, w } = CONES;
  const tip = 0.17 * w;
  const foot = -3.4 * s;
  const plate = pen().r(cx - w * 1.4, -4.6 * s, w * 2.8, 6 * s, 2.4 * s);
  c.fill(plate, t.shade);
  c.fill(pen().r(cx - w * 1.4, -4.6 * s, w * 2.8, 3.6 * s, 1.8 * s), t.main);
  c.stroke(plate, t.deep, LINE);
  const body = pen().m(cx - w, foot).l(cx - tip, -h).q(cx, -h - 2.4 * s, cx + tip, -h).l(cx + w, foot).q(cx, foot + 2.6 * s, cx - w, foot).z();
  c.fill(body, t.main);
  c.save();
  c.clip(body);
  const halfAt = (u: number) => w + (tip - w) * u + 2;
  const yAt = (u: number) => foot + (-h - foot) * u;
  for (const [u0, u1] of [
    [0.3, 0.42],
    [0.58, 0.68],
  ]) {
    c.fill(pen().m(cx - halfAt(u0), yAt(u0)).l(cx - halfAt(u1), yAt(u1)).l(cx + halfAt(u1), yAt(u1)).l(cx + halfAt(u0), yAt(u0)).z(), CREAM);
  }
  c.fill(pen().m(cx + w * 0.3, foot + 4 * s).l(cx + tip * 0.25, -h - 4 * s).l(cx + w + 4 * s, -h - 4 * s).l(cx + w + 4 * s, foot + 4 * s).z(), INK, 0.16);
  c.stroke(pen().m(cx - w * 0.6, foot - 4 * s).l(cx - tip * 1.1, -h + 5 * s), WHITE, 2 * s, 0.75);
  c.restore();
  c.stroke(body, t.deep, LINE);
}
