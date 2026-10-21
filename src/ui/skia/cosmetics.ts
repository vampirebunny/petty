import { ClipOp, PathOp, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia';
import type { SkCanvas, SkPath } from '@shopify/react-native-skia';

import type { Geom } from '../../actor';
import type { HeadFace } from '../../actor/geometry';
import { wardrobeSizes } from '../../actor/data/wardrobeSizes';
import type { WearItem } from '../../actor/wardrobe';
import { clamp, deg, fillCircle, fillOval, mix, oval, paintOf, polygon, rgb, strokeLine } from './draw';

type Pt = { x: number; y: number };

const sizes = wardrobeSizes;

export function outlineOf(color: string): string {
  return mix(color, '#000000', 0.45);
}

export function needsTrim(itemColor: string, furColor: string): boolean {
  const item = rgb(itemColor);
  const fur = rgb(furColor);
  const distance = Math.hypot(item[0] - fur[0], item[1] - fur[1], item[2] - fur[2]);
  return distance < sizes.trimDistance;
}

function trimOf(furColor: string): string {
  const [r, g, b] = rgb(furColor);
  const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
  return lum > 200 ? '#2a241c' : '#ffffff';
}

function edgePaint(color: string, alpha: number, width: number) {
  const paint = paintOf(color, alpha, width);
  paint.setStrokeJoin(StrokeJoin.Round);
  paint.setStrokeCap(StrokeCap.Round);
  return paint;
}

function paintShape(c: SkCanvas, path: SkPath, fill: string, fur?: string, details?: () => void, alpha = 1): void {
  const edge = outlineOf(fill);
  if (fur && needsTrim(fill, fur)) {
    c.drawPath(path, edgePaint(edge, alpha, sizes.outline + sizes.trim * 2));
    c.drawPath(path, edgePaint(trimOf(fur), alpha, sizes.trim * 2));
  } else {
    c.drawPath(path, edgePaint(edge, alpha, sizes.outline));
  }
  c.drawPath(path, paintOf(fill, alpha));
  if (details) {
    c.save();
    c.clipPath(path, ClipOp.Intersect, true);
    details();
    c.restore();
  }
  c.drawPath(path, edgePaint(edge, alpha, sizes.outline));
}

function outlinedLine(
  c: SkCanvas,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
  fur?: string,
  alpha = 1,
  cap: StrokeCap = StrokeCap.Round,
): void {
  const stroke = (strokeColor: string, strokeWidth: number) => {
    const paint = edgePaint(strokeColor, alpha, strokeWidth);
    paint.setStrokeCap(cap);
    c.drawLine(x1, y1, x2, y2, paint);
  };
  if (fur && needsTrim(color, fur)) {
    stroke(outlineOf(color), width + sizes.outline + sizes.trim);
    stroke(trimOf(fur), width + sizes.trim);
  } else {
    stroke(outlineOf(color), width + sizes.outline);
  }
  stroke(color, width);
}

function outlinedQuad(c: SkCanvas, a: Pt, mid: Pt, b: Pt, color: string, width: number, fur?: string, alpha = 1): void {
  const path = Skia.Path.Make();
  path.moveTo(a.x, a.y);
  path.quadTo(mid.x, mid.y, b.x, b.y);
  if (fur && needsTrim(color, fur)) {
    c.drawPath(path, edgePaint(outlineOf(color), alpha, width + sizes.outline + sizes.trim));
    c.drawPath(path, edgePaint(trimOf(fur), alpha, width + sizes.trim));
  } else {
    c.drawPath(path, edgePaint(outlineOf(color), alpha, width + sizes.outline));
  }
  c.drawPath(path, edgePaint(color, alpha, width));
}

function circlePath(x: number, y: number, r: number): SkPath {
  const path = Skia.Path.Make();
  path.addCircle(x, y, Math.max(r, 0.5));
  return path;
}

function offset(at: Pt, dir: Pt, distance: number): Pt {
  return { x: at.x + dir.x * distance, y: at.y + dir.y * distance };
}

type Pts = [number, number][];

function ellipsePts(cx: number, cy: number, rx: number, ry: number, rot = 0, steps = 28): Pts {
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  const pts: Pts = [];
  for (let i = 0; i < steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    pts.push([cx + x * cs - y * sn, cy + x * sn + y * cs]);
  }
  return pts;
}

// A stadium from a to b with round ends of radius r.
function capsulePts(a: Pt, b: Pt, r: number, steps = 10): Pts {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const pts: Pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = ang - Math.PI / 2 + (i / steps) * Math.PI;
    pts.push([b.x + Math.cos(t) * r, b.y + Math.sin(t) * r]);
  }
  for (let i = 0; i <= steps; i += 1) {
    const t = ang + Math.PI / 2 + (i / steps) * Math.PI;
    pts.push([a.x + Math.cos(t) * r, a.y + Math.sin(t) * r]);
  }
  return pts;
}

// Merged shapes get one outline, with no seams where the pieces meet.
function unionOf(paths: SkPath[]): SkPath {
  let out = paths[0];
  for (let i = 1; i < paths.length; i += 1) {
    out = Skia.Path.MakeFromOp(out, paths[i], PathOp.Union) ?? out;
  }
  return out;
}

function dashed(color: string, width: number, on: number, off: number, alpha = 1) {
  const paint = paintOf(color, alpha, width);
  paint.setPathEffect(Skia.PathEffect.MakeDash([on, off], 0));
  return paint;
}

function ovalArc(cx: number, cy: number, rx: number, ry: number, start: number, sweep: number): SkPath {
  const path = Skia.Path.Make();
  path.addArc(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2), start, sweep);
  return path;
}

function roundStroke(color: string, alpha: number, width: number) {
  const paint = paintOf(color, alpha, width);
  paint.setStrokeCap(StrokeCap.Round);
  return paint;
}

// How flat the neck is (0 upright, 1 horizontal). Sleep and lie put the head on the floor.
function neckFlat(along: Pt): number {
  return 1 - clamp(Math.abs(along.y) / 0.7, 0, 1);
}

// Sleep / lie: paint neckwear under the head so the face covers any leftover overlap.
export function neckwearUnderHead(along: Pt): boolean {
  return neckFlat(along) > 0.45;
}

// Collar center in head space. 3/4 keeps it under the jaw; a full front face centers it.
export function collarJawOf(face: HeadFace, r: number): Pt {
  const m = face.muzzle;
  return {
    x: (m.x - m.rx * sizes.collarJawBack) * (1 - face.front),
    y: m.y + m.ry + r * sizes.collarJawDrop,
  };
}

export function chinAnchor(head: Pt, base: Pt, r: number, pitch: number, cat: boolean, view: number, jaw?: Pt): Pt {
  const toBaseX = base.x - head.x;
  const toBaseY = base.y - head.y;
  const len = Math.hypot(toBaseX, toBaseY) || 1;
  const dx = toBaseX / len;
  const dy = toBaseY / len;
  const flat = neckFlat({ x: -dx, y: -dy });
  // Sleep parks the head on the shoulders: the neck segment is shorter than the head, so the chin
  // must stay on that short segment or the band lands in the face or past the chest.
  const short = clamp(1 - len / (r * 1.25), 0, 1);
  let dist = r * sizes.chin;
  if (cat) {
    const cs = Math.cos(pitch);
    const sn = Math.sin(pitch);
    const lx = dx * cs + dy * sn;
    const ly = -dx * sn + dy * cs;
    const ul = Math.hypot(lx, ly) || 1;
    const ux = lx / ul;
    const uy = ly / ul;
    const rx = r * 1.06;
    const ry = r * 0.96;
    dist = (rx * ry) / (Math.hypot(ry * ux, rx * uy) || 1);
  }
  if (short > 0.001) {
    dist = dist * (1 - short) + len * sizes.chinShort * short;
  } else if (flat > 0.001) {
    const along = Math.max(r * sizes.chinFlatClear, len * sizes.chinFlatAlong);
    dist = dist * (1 - flat) + Math.min(along, len * 0.55) * flat;
  }
  const neck = { x: head.x + dx * dist, y: head.y + dy * dist };
  // Sleep and lie keep the strap on the neck. A turned head eases toward the throat under the jaw,
  // but never leaves the neck entirely — full blend put sit/3/4 bandanas out on the chest.
  if (!jaw || view <= 0.001 || flat > 0.45) {
    return neck;
  }
  const cs = Math.cos(pitch);
  const sn = Math.sin(pitch);
  const jx = jaw.x * cs - jaw.y * sn;
  const jy = jaw.x * sn + jaw.y * cs;
  const blend = view * sizes.collarJawBlend;
  return {
    x: neck.x + (head.x + jx - neck.x) * blend,
    y: neck.y + (head.y + jy - neck.y) * blend,
  };
}

function mixDir(from: Pt, to: Pt, t: number): Pt {
  const x = from.x * (1 - t) + to.x * t;
  const y = from.y * (1 - t) + to.y * t;
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

// A turned head wears the band across the throat. Side view keeps the neck's own perpendicular.
function spanDir(perp: Pt, view: number, pitch: number): Pt {
  if (view <= 0.001) {
    return perp;
  }
  return mixDir(perp, { x: Math.cos(pitch), y: Math.sin(pitch) }, view);
}

// Tag, bell and cloth hang down the screen once the head turns, instead of along the neck toward the muzzle.
function dropDir(perp: Pt, view: number, pitch: number): Pt {
  if (view <= 0.001) {
    return perp;
  }
  return mixDir(perp, { x: -Math.sin(pitch), y: Math.cos(pitch) }, view);
}

// The sleeve covers the upper leg bone, so it bends with the knee. Sweaters get a light cuff, raincoats a dark one.
export function drawSleeve(c: SkCanvas, hip: Pt, knee: Pt, geom: Geom, item: WearItem, far: boolean, fur: string): void {
  const tone = (color: string) => (far ? mix(color, '#000000', 0.3) : color);
  const color = tone(item.c);
  const k = sizes.sleeveUpper;
  const end = { x: hip.x + (knee.x - hip.x) * k, y: hip.y + (knee.y - hip.y) * k };
  const r = geom.legWidth / 2 + sizes.sleeveExtra / 2;
  paintShape(c, polygon(capsulePts(hip, end, r)), color, fur);
  const len = Math.hypot(end.x - hip.x, end.y - hip.y) || 1;
  const u = { x: (end.x - hip.x) / len, y: (end.y - hip.y) / len };
  const cuffStart = { x: end.x - u.x * r * 0.9, y: end.y - u.y * r * 0.9 };
  const cuff = item.id === 'sweater' ? item.d ?? mix(item.c, '#ffffff', 0.35) : mix(item.c, '#000000', 0.2);
  paintShape(c, polygon(capsulePts(cuffStart, end, r + 0.6)), tone(cuff), fur);
}

// One rounded silhouette: the shaft and an oversized toe are merged so there is a single outline.
// `tilt` is 0 for a planted paw and 1 for a paw that follows the shin (sitting hind legs, lying, belly up, a jump tuck).
export function drawBoot(c: SkCanvas, knee: Pt, paw: Pt, geom: Geom, boot: WearItem, far: boolean, fur: string, tilt: number): void {
  const sneaker = boot.id === 'sneaker';
  const rain = boot.id === 'rain';
  const tone = (color: string) => (far ? mix(color, '#000000', 0.3) : color);
  const color = tone(boot.c);
  const segX = paw.x - knee.x;
  const segY = paw.y - knee.y;
  const segLen = Math.hypot(segX, segY) || 1;
  const u = { x: segX / segLen, y: segY / segLen };
  // `side` points to the back of the leg; the front is -side.
  const side = { x: -u.y, y: u.x };
  const shaftR = geom.legWidth / 2 + sizes.bootShaftExtra / 2;
  const topK = sneaker ? sizes.sneakerTop : sizes.bootTop;
  const top = { x: knee.x + segX * topK, y: knee.y + segY * topK };

  // The foot stays flat on a planted paw and turns with the shin when the paw lifts.
  const footRot = (Math.atan2(segY, segX) - Math.PI / 2) * clamp(tilt, 0, 1);
  const cs = Math.cos(footRot);
  const sn = Math.sin(footRot);
  const at = (lx: number, ly: number): Pt => ({ x: paw.x + lx * cs - ly * sn, y: paw.y + lx * sn + ly * cs });
  const toeRx = geom.pawRx * sizes.bootToeX;
  const toeRy = geom.pawRy * sizes.bootToeY;
  // Same ground line as the bare paw oval: the toe's bottom sits where the paw's bottom sits.
  const toeLx = sizes.pawOffsetX + toeRx * 0.18;
  const toeLy = sizes.pawOffsetY + geom.pawRy - toeRy;
  const toe = at(toeLx, toeLy);

  const shape = unionOf([polygon(capsulePts(top, paw, shaftR)), polygon(ellipsePts(toe.x, toe.y, toeRx, toeRy, footRot))]);
  const soleH = Math.max(sizes.bootSole, toeRy * (sneaker ? sizes.sneakerSole : sizes.bootSoleK));
  const sole = sneaker ? tone('#e4e1dc') : tone(mix(boot.c, '#000000', 0.55));

  paintShape(c, shape, color, fur, () => {
    // Sole: a band across the bottom of the foot in the foot's own frame, clipped to the boot.
    c.save();
    c.translate(paw.x, paw.y);
    c.rotate(deg(footRot), 0, 0);
    c.drawRect(Skia.XYWHRect(-toeRx * 4, toeLy + toeRy - soleH, toeRx * 8, soleH * 4), paintOf(sole));
    c.restore();
    if (sneaker) {
      const accent = tone(boot.d ?? '#d64545');
      const s0 = at(toeLx - toeRx * 0.6, toeLy + toeRy * 0.05);
      const s1 = at(toeLx + toeRx * 0.35, toeLy - toeRy * 0.5);
      strokeLine(c, s0.x, s0.y, s1.x, s1.y, accent, toeRy * 0.32);
      for (let i = 0; i < 2; i += 1) {
        const lace = { x: top.x + u.x * shaftR * (0.6 + i * 0.9) - side.x * shaftR * 0.35, y: top.y + u.y * shaftR * (0.6 + i * 0.9) - side.y * shaftR * 0.35 };
        fillCircle(c, lace.x, lace.y, Math.max(0.8, shaftR * 0.16), outlineOf(boot.c));
      }
    } else if (rain) {
      // Glossy rubber: a shine down the front of the shaft and a dark rim at the top.
      const a = { x: top.x + u.x * shaftR * 0.9 - side.x * shaftR * 0.45, y: top.y + u.y * shaftR * 0.9 - side.y * shaftR * 0.45 };
      const b = { x: paw.x - u.x * shaftR * 0.4 - side.x * shaftR * 0.45, y: paw.y - u.y * shaftR * 0.4 - side.y * shaftR * 0.45 };
      strokeLine(c, a.x, a.y, b.x, b.y, '#ffffff', shaftR * 0.38, 0.45);
      const rim = { x: top.x + u.x * shaftR * 0.2, y: top.y + u.y * shaftR * 0.2 };
      strokeLine(
        c,
        rim.x + side.x * shaftR * 1.3,
        rim.y + side.y * shaftR * 1.3,
        rim.x - side.x * shaftR * 1.3,
        rim.y - side.y * shaftR * 1.3,
        mix(color, '#000000', 0.3),
        shaftR * 0.6,
        1,
        StrokeCap.Butt,
      );
    }
  });

  if (!far) {
    const shine = at(toeLx + toeRx * 0.25, toeLy - toeRy * 0.45);
    fillOval(c, shine.x, shine.y, toeRx * 0.28, toeRy * 0.16, mix(boot.c, '#ffffff', 0.35), 0.7);
  }

  // Red boots: a rounded cuff band in a darker shade of the boot color, slightly wider than the shaft.
  // No white and no separate puffs.
  if (!sneaker && !rain) {
    const cuffColor = tone(mix(boot.c, '#000000', 0.22));
    const cuffEnd = { x: top.x + u.x * shaftR * 1.1, y: top.y + u.y * shaftR * 1.1 };
    paintShape(c, polygon(capsulePts(top, cuffEnd, shaftR + 1)), cuffColor, fur);
  }
}

// Shaped like a dog coat: follows the back, stops before the rump, belly line rising toward the back legs,
// front edge behind the shoulder. The roll collar (drawJacketCollar) covers the join with the neck.
function jacketPath(geom: Geom, breath: number, puff: number): SkPath {
  const rx = geom.bodyLen / 2 + puff;
  const ry = (geom.bodyH / 2) * breath + puff;
  const cy = geom.bodyY;
  const body = Skia.Path.Make();
  body.addOval(oval(0, cy, rx, ry));
  const L = geom.bodyLen;
  const rear = -L * sizes.jacketRear;
  const front = L * sizes.jacketFront;
  const bulge = L * sizes.jacketBulge;
  const high = cy - ry * 2;
  const rearLow = cy + ry * sizes.jacketDropRear;
  const frontLow = cy + ry * sizes.jacketDropFront;
  const mask = Skia.Path.Make();
  mask.moveTo(rear, high);
  mask.quadTo(rear - bulge * 2, cy - ry * 0.1, rear + bulge, rearLow);
  mask.quadTo((rear + front) / 2, cy + ry * sizes.jacketBelly, front - bulge, frontLow);
  mask.quadTo(front + bulge * 2.5, cy, front + bulge, high);
  mask.close();
  return Skia.Path.MakeFromOp(body, mask, PathOp.Intersect) ?? body;
}

export function drawJacket(c: SkCanvas, geom: Geom, item: WearItem, breath: number, fur: string): void {
  const puffer = item.id === 'puffer';
  const vest = item.id === 'vest';
  const puff = geom.bodyH * (puffer || vest ? sizes.vestPuff : sizes.jacketPuff);
  const rx = geom.bodyLen / 2 + puff;
  const ry = (geom.bodyH / 2) * breath + puff;
  const cy = geom.bodyY;
  const path = jacketPath(geom, breath, puff);
  const r = geom.headR;
  const deep = mix(item.c, '#000000', 0.2);
  const light = mix(item.c, '#ffffff', 0.45);
  const band = ry * sizes.jacketRib;
  const ring = (k: number) => {
    const p = Skia.Path.Make();
    p.addOval(oval(0, cy, rx * k, ry * k));
    return p;
  };

  paintShape(c, path, item.c, fur, () => {
    if (item.id === 'sweater') {
      // Two wide stripes that follow the back, and ribbing round every edge.
      const stripe = item.d ?? light;
      for (const k of [0.66, 0.3]) {
        c.drawPath(ring(k), paintOf(stripe, 0.95, ry * sizes.sweaterStripe));
      }
      c.drawPath(path, paintOf(deep, 1, band * 2));
      c.drawPath(path, dashed(mix(deep, '#000000', 0.18), band * 2, 1.2, 1.8));
    } else if (puffer) {
      // Stacked baffles with a soft highlight on each, so it reads as puffy at any size.
      for (const k of [0.68, 0.36]) {
        c.drawPath(ring(k), paintOf(deep, 1, 1.8));
      }
      for (const k of [0.86, 0.52, 0.18]) {
        c.drawPath(ovalArc(0, cy, rx * k, ry * k, 205, 130), roundStroke(light, 0.6, ry * 0.12));
      }
    } else if (vest) {
      // Diamond quilting, light piping round the edge, and a zip at the front.
      const q = Skia.Path.Make();
      const step = ry * 0.55;
      for (let x = -rx * 1.5; x < rx * 1.5; x += step) {
        q.moveTo(x, cy - ry);
        q.lineTo(x + ry * 2, cy + ry);
        q.moveTo(x, cy + ry);
        q.lineTo(x + ry * 2, cy - ry);
      }
      c.drawPath(q, paintOf(deep, 0.55, 1.2));
      c.drawPath(path, paintOf(light, 1, band * 1.2));
      const zx = geom.bodyLen * (sizes.jacketFront - 0.04);
      strokeLine(c, zx, cy - ry, zx, cy + ry, deep, 1.6);
    } else if (item.id === 'rain') {
      // Glossy shine along the back and dark piping round the edge.
      c.drawPath(ovalArc(0, cy, rx * 0.8, ry * 0.8, 215, 95), roundStroke('#ffffff', 0.45, ry * 0.14));
      c.drawPath(path, paintOf(deep, 1, band * 1.6));
    }
  });

  if (item.id === 'rain') {
    const bx = geom.bodyLen * (sizes.jacketFront - 0.08);
    for (let i = 0; i < 2; i += 1) {
      paintShape(c, circlePath(bx, cy - ry * 0.3 + i * ry * 0.4, r * sizes.jacketButton), mix(item.c, '#000000', 0.45));
    }
  }
  if (vest) {
    const zx = geom.bodyLen * (sizes.jacketFront - 0.04);
    paintShape(c, circlePath(zx, cy - ry * 0.55, r * sizes.zipPull), light);
  }
}

// A folded-down hood lying along the back of the neck. `perp` points to the throat side, so the back is -perp.
export function drawHood(c: SkCanvas, base: Pt, perp: Pt, along: Pt, item: WearItem, r: number, neckWidth: number, fur: string): void {
  const back = -neckWidth * 0.42;
  const a = offset(offset(base, along, r * 0.15), perp, back);
  const b = offset(offset(base, along, r * 0.75), perp, back);
  paintShape(c, polygon(capsulePts(a, b, r * sizes.hood)), mix(item.c, '#000000', 0.08), fur);
}

// Drawn after the neck stroke, so the neck comes out of the coat instead of being painted over it.
export function drawJacketCollar(c: SkCanvas, base: Pt, perp: Pt, along: Pt, item: WearItem, r: number, neckWidth: number, fur: string): void {
  const at = offset(base, along, r * sizes.collarRise);
  const reach = neckWidth * 0.55;
  const a = offset(at, perp, -reach);
  const b = offset(at, perp, reach);
  const mid = { x: at.x - along.x * r * 0.18, y: at.y - along.y * r * 0.18 };
  const thick = r * (sizes.jacketCollar[item.id] ?? 0.3);
  const color = item.id === 'rain' ? mix(item.c, '#000000', 0.1) : item.c;
  outlinedQuad(c, a, mid, b, color, thick, fur);
  const line = Skia.Path.Make();
  line.moveTo(a.x, a.y);
  line.quadTo(mid.x, mid.y, b.x, b.y);
  if (item.id === 'sweater') {
    c.drawPath(line, dashed(mix(item.c, '#000000', 0.25), thick * 0.9, 1.3, 1.7));
  } else if (item.id === 'puffer') {
    const hi = Skia.Path.Make();
    const lift = thick * 0.22;
    hi.moveTo(a.x - along.x * -lift, a.y - along.y * -lift);
    hi.quadTo(mid.x + along.x * lift, mid.y + along.y * lift, b.x + along.x * lift, b.y + along.y * lift);
    c.drawPath(hi, roundStroke(mix(item.c, '#ffffff', 0.45), 0.6, thick * 0.25));
  }
}

function bandEnds(chin: Pt, perp: Pt, along: Pt, r: number, reach: number, view = 0, pitch = 0): { a: Pt; b: Pt; mid: Pt; lower: Pt } {
  // Flat or short necks make a full-size band read as a tall slash through the face; keep it small.
  const flat = neckFlat(along);
  const span = reach * (1 - sizes.neckFlatShrink * flat);
  const across = spanDir(perp, view, pitch);
  const a = offset(chin, across, -span);
  const b = offset(chin, across, span);
  const bow = r * (0.16 + 0.12 * flat);
  const down = { x: -Math.sin(pitch), y: Math.cos(pitch) };
  const mid = {
    x: chin.x + (-along.x * (1 - view) + down.x * view) * bow,
    y: chin.y + (-along.y * (1 - view) + down.y * view) * bow,
  };
  const lower = a.y >= b.y ? a : b;
  return { a, b, mid, lower };
}

function drawCollarBand(
  c: SkCanvas,
  chin: Pt,
  perp: Pt,
  along: Pt,
  item: WearItem,
  r: number,
  fur: string,
  studs: boolean,
  view = 0,
  pitch = 0,
): Pt {
  const flat = neckFlat(along);
  // Sleep / lie: the neck is nearly horizontal and often shorter than the head, so a perp-spanning
  // band becomes a tall slash through the face. Draw a short strap under the jaw along the neck instead.
  if (flat > 0.45) {
    const at = offset(chin, perp, r * sizes.collarFlatDrop);
    const half = r * sizes.collarFlatLen;
    const a = offset(at, along, -half);
    const b = offset(at, along, half * 0.4);
    const mid = offset(at, perp, r * 0.1);
    outlinedQuad(c, a, mid, b, item.c, r * sizes.collarBand, fur);
    if (studs && item.d) {
      paintShape(c, circlePath(at.x, at.y, r * sizes.collarStud), item.d);
    }
    return offset(at, perp, r * 0.1);
  }
  const { a, b, mid, lower } = bandEnds(chin, perp, along, r, r * 0.62, view, pitch);
  outlinedQuad(c, a, mid, b, item.c, r * sizes.collarBand, fur);
  if (studs && item.d) {
    const across = spanDir(perp, view, pitch);
    for (let i = -1; i <= 1; i += 1) {
      const at = offset(chin, across, i * r * 0.22);
      paintShape(c, circlePath(at.x, at.y, r * sizes.collarStud), item.d);
    }
  }
  // Side view hangs the tag from the low tip. A turned head hangs it from the middle of the throat.
  return { x: lower.x + (chin.x - lower.x) * view, y: lower.y + (chin.y - lower.y) * view };
}

export function drawNeckwear(
  c: SkCanvas,
  chin: Pt,
  perp: Pt,
  along: Pt,
  item: WearItem,
  sway: number,
  r: number,
  fur: string,
  view = 0,
  pitch = 0,
): void {
  const flat = neckFlat(along);
  const hangK = 1 - sizes.neckFlatHang * flat;
  const turned = flat > 0.45 ? 0 : view;
  const hangDir = dropDir(perp, turned, pitch);
  if (item.id === 'collar' || item.id === 'gold' || item.id === 'bell') {
    const lower = drawCollarBand(c, chin, perp, along, item, r, fur, item.id === 'gold', turned, pitch);
    const hang = {
      x: lower.x + hangDir.x * r * 0.28 * hangK + sway * r * hangK,
      y: lower.y + hangDir.y * r * 0.28 * hangK,
    };
    if (item.id === 'bell') {
      const bell = item.d ?? '#f0c94a';
      const bellR = r * sizes.bell * (0.55 + 0.45 * hangK);
      paintShape(c, circlePath(hang.x, hang.y, bellR), bell, fur);
      strokeLine(c, hang.x - bellR * 0.5, hang.y - bellR * 0.12, hang.x + bellR * 0.5, hang.y - bellR * 0.12, outlineOf(bell), sizes.outline * 0.7);
      paintShape(c, circlePath(hang.x, hang.y + bellR * 0.35, bellR * 0.18), outlineOf(bell));
      fillCircle(c, hang.x - bellR * 0.3, hang.y - bellR * 0.35, bellR * 0.18, '#ffffff', 0.75);
    } else {
      const tag = item.d ?? '#f0c94a';
      const tagR = r * sizes.collarTag * (0.55 + 0.45 * hangK);
      paintShape(c, circlePath(hang.x, hang.y, tagR), tag);
      fillCircle(c, hang.x - tagR * 0.35, hang.y - tagR * 0.35, tagR * 0.35, '#ffffff', 0.7);
    }
    return;
  }
  if (item.id === 'bandana') {
    drawBandana(c, chin, perp, along, item, sway, r, fur, view);
    return;
  }
  if (item.id === 'bow') {
    const knot = flat > 0.45 ? offset(chin, perp, r * sizes.collarFlatDrop) : chin;
    const reach = r * 0.34 * (flat > 0.45 ? 0.55 : 1);
    if (flat > 0.45) {
      outlinedQuad(c, offset(knot, along, -reach), offset(knot, perp, r * 0.08), offset(knot, along, reach * 0.4), item.c, r * 0.08, fur);
    } else {
      const { a, b, mid } = bandEnds(chin, perp, along, r, reach, turned, pitch);
      outlinedQuad(c, a, mid, b, item.c, r * 0.08, fur);
    }
    const wing = r * sizes.bowWing * hangK;
    const drop = r * sizes.bowHeight * hangK;
    const spread = spanDir(perp, turned, pitch);
    const left = polygon([
      [knot.x, knot.y + hangDir.y * r * 0.08],
      [knot.x - spread.x * wing, knot.y - spread.y * drop * 0.2],
      [knot.x - spread.x * wing * 0.7, knot.y + hangDir.y * drop],
    ]);
    const right = polygon([
      [knot.x, knot.y + hangDir.y * r * 0.08],
      [knot.x + spread.x * wing, knot.y - spread.y * drop * 0.2],
      [knot.x + spread.x * wing * 0.7, knot.y + hangDir.y * drop],
    ]);
    paintShape(c, left, item.c, fur);
    paintShape(c, right, item.c, fur);
    paintShape(c, circlePath(knot.x, knot.y + hangDir.y * r * 0.1, r * 0.12 * hangK), mix(item.c, '#000000', 0.2));
    return;
  }
  const knot = flat > 0.45 ? offset(chin, perp, r * sizes.collarFlatDrop) : chin;
  if (flat > 0.45) {
    const half = r * 0.35;
    outlinedQuad(c, offset(knot, along, -half), offset(knot, perp, r * 0.1), offset(knot, along, half * 0.4), item.c, r * sizes.scarfBand, fur);
  } else {
    const { a, b, mid } = bandEnds(chin, perp, along, r, r * 0.58, turned, pitch);
    outlinedQuad(c, a, mid, b, item.c, r * sizes.scarfBand, fur);
  }
  const wave = sway * r * hangK;
  const tail = (length: number, spread: number) => {
    const start = offset(knot, hangDir, spread * hangK);
    const path = Skia.Path.Make();
    path.moveTo(start.x, start.y);
    path.quadTo(start.x - r * 0.35 + wave, start.y + length * 0.45, start.x - r * 0.15 + wave * 1.4, start.y + hangDir.y * length);
    const end = { x: start.x - r * 0.15 + wave * 1.4, y: start.y + hangDir.y * length };
    const side = { x: -hangDir.y, y: hangDir.x };
    path.lineTo(end.x + side.x * r * sizes.scarfTail, end.y + side.y * r * sizes.scarfTail);
    path.quadTo(start.x - r * 0.1 + wave, start.y + length * 0.4, start.x + side.x * r * sizes.scarfTail, start.y + side.y * r * sizes.scarfTail);
    path.close();
    paintShape(c, path, item.c, fur);
  };
  tail(r * sizes.scarfTailLong * hangK, -r * 0.12);
  tail(r * sizes.scarfTailShort * hangK, r * 0.16);
}

function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function unit(p: Pt): Pt {
  const l = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / l, y: p.y / l };
}

// A tied band around the neck and a triangle that hangs from its front, tip pointing down (gravity).
// Side view: the band crosses the neck along perp, the triangle hangs from its throat half, and a knot
// with two tails sits at the back of the neck. 3/4 and front: the band crosses under the chin
// horizontally and the triangle is centered under it.
function drawBandana(c: SkCanvas, chin: Pt, perp: Pt, along: Pt, item: WearItem, sway: number, r: number, fur: string, view: number): void {
  const flat = neckFlat(along);
  const lying = flat > 0.45;
  const hangK = 1 - sizes.neckFlatHang * flat;
  const deep = mix(item.c, '#000000', 0.2);
  const bandColor = mix(item.c, '#000000', 0.12);

  // Band ends. Lying down: a short strap under the jaw along the neck, as the collar does.
  let a: Pt;
  let b: Pt;
  let mid: Pt;
  if (lying) {
    const at = offset(chin, perp, r * sizes.collarFlatDrop);
    a = offset(at, along, -r * sizes.bandanaBand * 0.6);
    b = offset(at, along, r * sizes.bandanaBand * 0.3);
    mid = offset(at, perp, r * 0.08);
  } else {
    const across = unit(lerpPt(perp, { x: 1, y: 0 }, view));
    const span = r * sizes.bandanaBand * (1 - sizes.neckFlatShrink * flat);
    a = offset(chin, across, -span);
    b = offset(chin, across, span);
    mid = { x: chin.x - along.x * r * 0.16 * (1 - view), y: chin.y - along.y * r * 0.16 * (1 - view) + r * 0.06 * view };
  }

  // Knot and tails at the back of the neck, side view only (hidden behind the neck from the front).
  const knotK = lying ? 1 : 1 - view;
  if (knotK > 0.05) {
    const tail = (dx: number, dy: number) =>
      paintShape(c, polygon(capsulePts(a, { x: a.x + dx * r, y: a.y + dy * r }, r * 0.07)), item.c, fur, undefined, knotK);
    tail(-sizes.bandanaKnot, sizes.bandanaKnot * 0.6);
    tail(-sizes.bandanaKnot * 0.4, sizes.bandanaKnot * 1.1);
    paintShape(c, circlePath(a.x, a.y, r * 0.1), bandColor, fur, undefined, knotK);
  }

  // The cloth hangs from the front part of the band: the throat half in side view, the whole width from the front.
  const start = lying ? 0.2 : 0.45 * (1 - view) + 0.08 * view;
  const end = lying ? 1 : 1 - 0.08 * view;
  const top1 = lerpPt(a, b, start);
  const top2 = lerpPt(a, b, end);
  const topMid = lerpPt(top1, top2, 0.5);
  const tip = {
    x: topMid.x + r * 0.18 * (1 - view) * hangK + sway * r * 1.2 * hangK,
    y: topMid.y + r * sizes.bandanaDrop * hangK,
  };
  const bow = r * 0.1;
  const cloth = Skia.Path.Make();
  cloth.moveTo(top1.x, top1.y);
  cloth.lineTo(top2.x, top2.y);
  cloth.quadTo((top2.x + tip.x) / 2 + bow, (top2.y + tip.y) / 2, tip.x, tip.y);
  cloth.quadTo((top1.x + tip.x) / 2 - bow, (top1.y + tip.y) / 2, top1.x, top1.y);
  cloth.close();
  paintShape(c, cloth, item.c, fur, () => {
    // A darker hem along the two lower edges, and a soft fold shadow just under the band.
    const hem = Skia.Path.Make();
    hem.moveTo(top1.x, top1.y);
    hem.quadTo((top1.x + tip.x) / 2 - bow, (top1.y + tip.y) / 2, tip.x, tip.y);
    hem.quadTo((top2.x + tip.x) / 2 + bow, (top2.y + tip.y) / 2, top2.x, top2.y);
    c.drawPath(hem, edgePaint(deep, 1, r * sizes.bandanaHem * 2));
    strokeLine(c, top1.x, top1.y + r * 0.08, top2.x, top2.y + r * 0.08, '#000000', r * 0.12, 0.14, StrokeCap.Round);
  });

  // The band goes on top, so the cloth tucks under it.
  outlinedQuad(c, a, mid, b, bandColor, r * sizes.bandanaBandWidth, fur);
}

type GlassesLayout = {
  st: (typeof sizes.glassesStyles)[string];
  view: number;
  w: number;
  h: number;
  frame: number;
  near: Pt;
  far: Pt;
};

function glassesLayout(face: HeadFace, item: WearItem): GlassesLayout {
  const st = sizes.glassesStyles[item.id] ?? sizes.glassesStyles.classic;
  const eyeR = face.eyeR;
  const view = Math.max(face.turn, face.front);
  // Close-set eyes (husky) shrink the lenses at the 3/4 and front views so they never overlap.
  const need = 2 * st.w * eyeR + st.frame * eyeR + eyeR * 0.4;
  const fit = clamp(face.gap3 / need, 0.6, 1);
  const k = 1 + (fit - 1) * view;
  const y = face.nearEye.y - eyeR * 0.05;
  return {
    st,
    view,
    w: st.w * eyeR * k,
    h: st.h * eyeR * k,
    frame: st.frame * eyeR,
    near: { x: face.nearEye.x + eyeR * 0.05, y },
    far: { x: face.farEye.x + eyeR * 0.05 * face.farEyeScale.x, y },
  };
}

function lensPath(shape: 'wayfarer' | 'round' | 'soft', w: number, h: number): SkPath {
  const p = Skia.Path.Make();
  if (shape === 'round') {
    p.addOval(oval(0, 0, w, h));
    return p;
  }
  if (shape === 'soft') {
    const rr = Math.min(w, h) * 0.6;
    p.addRRect(Skia.RRectXY(Skia.XYWHRect(-w, -h, w * 2, h * 2), rr, rr));
    return p;
  }
  // Wayfarer: a straight brow line and a rounded bottom that dips toward the cheek.
  p.moveTo(-w, -h * 0.8);
  p.lineTo(w * 0.95, -h);
  p.quadTo(w * 1.12, h * 0.55, w * 0.25, h);
  p.quadTo(-w * 0.7, h * 1.05, -w, h * 0.15);
  p.close();
  return p;
}

function drawLensAt(c: SkCanvas, L: GlassesLayout, at: Pt, scale: Pt, alpha: number, item: WearItem, fur: string): void {
  c.save();
  c.translate(at.x, at.y);
  c.scale(scale.x, scale.y);
  const path = lensPath(L.st.shape, L.w, L.h);
  c.drawPath(path, paintOf(L.st.lens, L.st.lensAlpha * alpha));
  // Glare streaks on the lens, so the eye still sparkles through dark lenses.
  c.save();
  c.clipPath(path, ClipOp.Intersect, true);
  strokeLine(c, -L.w * 0.55, L.h * 0.15, -L.w * 0.05, -L.h * 0.62, '#ffffff', L.w * 0.22, 0.75 * alpha, StrokeCap.Round);
  if (L.st.glares > 1) {
    strokeLine(c, L.w * 0.08, L.h * 0.22, L.w * 0.32, -L.h * 0.12, '#ffffff', L.w * 0.12, 0.6 * alpha, StrokeCap.Round);
  }
  c.restore();
  // Frame: trim (only when the frame is close to the fur color), then outline, then the frame itself.
  if (needsTrim(item.c, fur)) {
    c.drawPath(path, edgePaint(trimOf(fur), alpha, L.frame + sizes.outline + sizes.trim * 2));
  }
  c.drawPath(path, edgePaint(outlineOf(item.c), alpha, L.frame + sizes.outline));
  c.drawPath(path, edgePaint(item.c, alpha, L.frame));
  c.restore();
}

// Drawn BEFORE the near ear: temple arms, so hanging ears cover them.
export function drawGlassesBack(c: SkCanvas, item: WearItem, face: HeadFace, headR: number, fur: string): void {
  const L = glassesLayout(face, item);
  const arm = L.frame * sizes.glassesArm;
  const sideK = 1 - face.front;
  if (sideK > 0.01) {
    // Side and 3/4: from the back of the near lens to above the ear root, with a slight lift.
    const start = { x: L.near.x - L.w * 0.92, y: L.near.y - L.h * 0.35 };
    const end = { x: -headR * sizes.glassesArmReach, y: L.near.y - headR * 0.08 };
    const mid = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) - headR * 0.05 };
    outlinedQuad(c, start, mid, end, item.c, arm, fur, sideK);
  }
  if (face.front > 0.01) {
    // Front: short stubs from each lens's outer edge toward the side of the head.
    const sign = Math.sign(L.near.x - L.far.x) || -1;
    const nearEdge = { x: L.near.x + sign * L.w * 0.95, y: L.near.y - L.h * 0.3 };
    const farEdge = { x: L.far.x - sign * L.w * 0.95 * face.farEyeScale.x, y: L.near.y - L.h * 0.3 };
    outlinedLine(c, nearEdge.x, nearEdge.y, nearEdge.x + sign * headR * 0.25, nearEdge.y - headR * 0.02, item.c, arm, fur, face.front);
    outlinedLine(c, farEdge.x, farEdge.y, farEdge.x - sign * headR * 0.25, farEdge.y - headR * 0.02, item.c, arm, fur, face.front * face.farEyeAlpha);
  }
}

// Drawn AFTER the near ear: far lens, bridge, near lens.
export function drawGlassesFront(c: SkCanvas, item: WearItem, face: HeadFace, headR: number, fur: string): void {
  const L = glassesLayout(face, item);
  if (face.farEyeAlpha > 0.001) {
    const a = face.farEyeAlpha;
    drawLensAt(c, L, L.far, face.farEyeScale, a, item, fur);
    // Bridge: an arch over the snout between the two inner edges.
    const sign = Math.sign(L.far.x - L.near.x) || 1;
    const p0 = { x: L.near.x + sign * L.w * 0.95, y: L.near.y - L.h * 0.3 };
    const p1 = { x: L.far.x - sign * L.w * 0.95 * face.farEyeScale.x, y: L.near.y - L.h * 0.3 };
    const mid = { x: (p0.x + p1.x) / 2, y: p0.y - L.h * 0.45 };
    outlinedQuad(c, p0, mid, p1, item.c, L.frame * 0.9, fur, a);
  } else {
    // Side view only: a short nose pad from the front of the lens, so the lens doesn't float. Never onto the muzzle.
    const side = 1 - L.view;
    if (side > 0.01) {
      const from = { x: L.near.x + L.w * 0.9, y: L.near.y - L.h * 0.3 };
      outlinedLine(c, from.x, from.y, from.x + face.eyeR * 0.45, from.y + face.eyeR * 0.1, item.c, L.frame * 0.9, fur, side);
    }
  }
  drawLensAt(c, L, L.near, { x: 1, y: 1 }, 1, item, fur);
}

export function drawHat(c: SkCanvas, item: WearItem, r: number, face: HeadFace, fur: string): void {
  c.save();
  c.translate(face.top.x, 0);
  c.scale(sizes.hatScale * (1 + sizes.hatTurn * Math.max(face.turn, face.front)), sizes.hatScale);
  drawHatShape(c, item, r, fur);
  c.restore();
}

export function drawHatShape(c: SkCanvas, item: WearItem, r: number, fur: string): void {
  if (item.id === 'beanie') {
    const cap = Skia.Path.Make();
    cap.moveTo(-r * 0.98, -r * 0.28);
    cap.quadTo(-r * 1.05, -r * 1.4, -r * 0.05, -r * 1.34);
    cap.quadTo(r * 0.98, -r * 1.3, r * 0.92, -r * 0.28);
    cap.close();
    paintShape(c, cap, item.c, fur, () => {
      const rib = mix(item.c, '#000000', 0.18);
      for (let i = -3; i <= 3; i += 1) {
        const x = i * r * 0.22;
        strokeLine(c, x, -r * 0.05, x * 0.92, -r * (0.05 + sizes.beanieRib), rib, r * sizes.ribLine);
      }
    });
    const band = Skia.Path.Make();
    band.moveTo(-r * 0.98, -r * 0.02);
    band.lineTo(r * 0.92, -r * 0.04);
    band.lineTo(r * 0.9, -r * (0.04 + sizes.beanieRib));
    band.lineTo(-r * 0.96, -r * sizes.beanieRib);
    band.close();
    paintShape(c, band, mix(item.c, '#000000', 0.12), fur);
    paintShape(c, circlePath(-r * 0.05, -r * 1.4, r * sizes.beaniePom), '#f6f6f6');
    return;
  }
  if (item.id === 'party') {
    const stripe = item.d ?? '#ffd34d';
    const cone = polygon([
      [-r * 0.55, -r * 0.72],
      [r * 0.48, -r * 0.72],
      [-r * 0.04, -r * sizes.partyTip],
    ]);
    paintShape(c, cone, item.c, fur, () => {
      for (let i = 0; i < 3; i += 1) {
        const y = -r * (0.95 + i * 0.38);
        strokeLine(c, -r * 0.42 + i * r * 0.06, y, r * 0.28 - i * r * 0.05, y - r * 0.08, stripe, r * sizes.partyStripe);
      }
    });
    paintShape(c, circlePath(-r * 0.04, -r * sizes.partyTip, r * sizes.partyPom), stripe);
    return;
  }
  c.save();
  c.rotate(-0.1 * (180 / Math.PI), 0, 0);
  const crown = Skia.Path.Make();
  crown.addRRect(Skia.RRectXY(Skia.XYWHRect(-r * 0.42, -r * 1.95, r * 0.84, r * 1.05), r * 0.08, r * 0.08));
  paintShape(c, crown, item.c, fur);
  const brim = Skia.Path.Make();
  brim.addOval(oval(0, -r * 0.92, r * sizes.topBrim, r * 0.2));
  paintShape(c, brim, item.c, fur);
  const band = item.d ?? mix(item.c, '#ffffff', 0.55);
  const wrap = Skia.Path.Make();
  wrap.addRect(Skia.XYWHRect(-r * 0.42, -r * 1.22, r * 0.84, r * 0.18));
  paintShape(c, wrap, band);
  c.restore();
}
