import { ClipOp, PathOp, Skia, StrokeCap } from '@shopify/react-native-skia';
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

function paintShape(c: SkCanvas, path: SkPath, fill: string, fur?: string, details?: () => void, alpha = 1): void {
  const edge = outlineOf(fill);
  if (fur && needsTrim(fill, fur)) {
    c.drawPath(path, paintOf(edge, alpha, sizes.outline + sizes.trim * 2));
    c.drawPath(path, paintOf(trimOf(fur), alpha, sizes.trim * 2));
  } else {
    c.drawPath(path, paintOf(edge, alpha, sizes.outline));
  }
  c.drawPath(path, paintOf(fill, alpha));
  if (details) {
    c.save();
    c.clipPath(path, ClipOp.Intersect, true);
    details();
    c.restore();
  }
  c.drawPath(path, paintOf(edge, alpha, sizes.outline));
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
  if (fur && needsTrim(color, fur)) {
    strokeLine(c, x1, y1, x2, y2, outlineOf(color), width + sizes.outline + sizes.trim, alpha, cap);
    strokeLine(c, x1, y1, x2, y2, trimOf(fur), width + sizes.trim, alpha, cap);
  } else {
    strokeLine(c, x1, y1, x2, y2, outlineOf(color), width + sizes.outline, alpha, cap);
  }
  strokeLine(c, x1, y1, x2, y2, color, width, alpha, cap);
}

function outlinedQuad(c: SkCanvas, a: Pt, mid: Pt, b: Pt, color: string, width: number, fur?: string): void {
  const path = Skia.Path.Make();
  path.moveTo(a.x, a.y);
  path.quadTo(mid.x, mid.y, b.x, b.y);
  if (fur && needsTrim(color, fur)) {
    c.drawPath(path, paintOf(outlineOf(color), 1, width + sizes.outline + sizes.trim));
    c.drawPath(path, paintOf(trimOf(fur), 1, width + sizes.trim));
  } else {
    c.drawPath(path, paintOf(outlineOf(color), 1, width + sizes.outline));
  }
  c.drawPath(path, paintOf(color, 1, width));
}

function circlePath(x: number, y: number, r: number): SkPath {
  const path = Skia.Path.Make();
  path.addCircle(x, y, Math.max(r, 0.5));
  return path;
}

function roundRectPath(cx: number, cy: number, half: number, radius: number): SkPath {
  const path = Skia.Path.Make();
  const side = Math.max(half * 2, 1);
  path.addRRect(Skia.RRectXY(Skia.XYWHRect(cx - half, cy - half, side, side), radius, radius));
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

export function chinAnchor(head: Pt, base: Pt, r: number, pitch: number, cat: boolean, view: number): Pt {
  const toBaseX = base.x - head.x;
  const toBaseY = base.y - head.y;
  const len = Math.hypot(toBaseX, toBaseY) || 1;
  const dx = toBaseX / len;
  const dy = toBaseY / len;
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
  return { x: head.x + dx * dist + r * sizes.neckShift * view, y: head.y + dy * dist };
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

function bandEnds(chin: Pt, perp: Pt, along: Pt, r: number, reach: number): { a: Pt; b: Pt; mid: Pt; lower: Pt } {
  const a = offset(chin, perp, -reach);
  const b = offset(chin, perp, reach);
  const mid = { x: chin.x - along.x * r * 0.16, y: chin.y - along.y * r * 0.16 };
  const lower = a.y >= b.y ? a : b;
  return { a, b, mid, lower };
}

function drawCollarBand(c: SkCanvas, chin: Pt, perp: Pt, along: Pt, item: WearItem, r: number, fur: string, studs: boolean): Pt {
  const { a, b, mid, lower } = bandEnds(chin, perp, along, r, r * 0.62);
  outlinedQuad(c, a, mid, b, item.c, r * sizes.collarBand, fur);
  if (studs && item.d) {
    for (let i = -1; i <= 1; i += 1) {
      const at = offset(chin, perp, i * r * 0.22);
      paintShape(c, circlePath(at.x, at.y, r * sizes.collarStud), item.d);
    }
  }
  return lower;
}

export function drawNeckwear(c: SkCanvas, chin: Pt, perp: Pt, along: Pt, item: WearItem, sway: number, r: number, fur: string): void {
  if (item.id === 'collar' || item.id === 'gold' || item.id === 'bell') {
    const lower = drawCollarBand(c, chin, perp, along, item, r, fur, item.id === 'gold');
    const hang = { x: lower.x + perp.x * r * 0.28 + sway * r, y: lower.y + perp.y * r * 0.28 };
    if (item.id === 'bell') {
      const bell = item.d ?? '#f0c94a';
      paintShape(c, circlePath(hang.x, hang.y, r * sizes.bell), bell, fur);
      strokeLine(c, hang.x - r * 0.16, hang.y - r * 0.04, hang.x + r * 0.16, hang.y - r * 0.04, outlineOf(bell), sizes.outline * 0.7);
      paintShape(c, circlePath(hang.x, hang.y + r * 0.12, r * 0.06), outlineOf(bell));
      fillCircle(c, hang.x - r * 0.1, hang.y - r * 0.12, r * 0.06, '#ffffff', 0.75);
    } else {
      const tag = item.d ?? '#f0c94a';
      paintShape(c, circlePath(hang.x, hang.y, r * sizes.collarTag), tag);
      fillCircle(c, hang.x - r * 0.08, hang.y - r * 0.08, r * 0.08, '#ffffff', 0.7);
    }
    return;
  }
  if (item.id === 'bandana') {
    const reach = r * sizes.bandanaWidth * 0.5;
    const { a, b } = bandEnds(chin, perp, along, r, reach);
    const tip = {
      x: chin.x + perp.x * r * sizes.bandanaDrop + sway * r * 1.4 + r * 0.12,
      y: chin.y + perp.y * r * sizes.bandanaDrop,
    };
    const cloth = Skia.Path.Make();
    cloth.moveTo(a.x, a.y);
    cloth.lineTo(b.x, b.y);
    cloth.quadTo((b.x + tip.x) / 2 + r * 0.08, (b.y + tip.y) / 2, tip.x, tip.y);
    cloth.quadTo((a.x + tip.x) / 2 - r * 0.08, (a.y + tip.y) / 2, a.x, a.y);
    cloth.close();
    paintShape(c, cloth, item.c, fur, () => {
      const hem = Skia.Path.Make();
      hem.moveTo(a.x, a.y);
      hem.quadTo((a.x + tip.x) / 2 - r * 0.08, (a.y + tip.y) / 2, tip.x, tip.y);
      hem.quadTo((b.x + tip.x) / 2 + r * 0.08, (b.y + tip.y) / 2, b.x, b.y);
      c.drawPath(hem, paintOf(mix(item.c, '#000000', 0.18), 1, r * 0.12));
    });
    outlinedLine(c, a.x, a.y, b.x, b.y, mix(item.c, '#000000', 0.28), r * 0.1, fur);
    return;
  }
  if (item.id === 'bow') {
    const reach = r * 0.34;
    const { a, b, mid } = bandEnds(chin, perp, along, r, reach);
    outlinedQuad(c, a, mid, b, item.c, r * 0.08, fur);
    const wing = r * sizes.bowWing;
    const drop = r * sizes.bowHeight;
    const left = polygon([
      [chin.x, chin.y + perp.y * r * 0.08],
      [chin.x - perp.x * wing, chin.y - perp.y * drop * 0.2],
      [chin.x - perp.x * wing * 0.7, chin.y + perp.y * drop],
    ]);
    const right = polygon([
      [chin.x, chin.y + perp.y * r * 0.08],
      [chin.x + perp.x * wing, chin.y - perp.y * drop * 0.2],
      [chin.x + perp.x * wing * 0.7, chin.y + perp.y * drop],
    ]);
    paintShape(c, left, item.c, fur);
    paintShape(c, right, item.c, fur);
    paintShape(c, circlePath(chin.x, chin.y + perp.y * r * 0.1, r * 0.12), mix(item.c, '#000000', 0.2));
    return;
  }
  const { a, b, mid } = bandEnds(chin, perp, along, r, r * 0.58);
  outlinedQuad(c, a, mid, b, item.c, r * sizes.scarfBand, fur);
  const wave = sway * r;
  const tail = (length: number, spread: number) => {
    const start = offset(chin, perp, spread);
    const path = Skia.Path.Make();
    path.moveTo(start.x, start.y);
    path.quadTo(start.x - r * 0.35 + wave, start.y + length * 0.45, start.x - r * 0.15 + wave * 1.4, start.y + perp.y * length);
    const end = { x: start.x - r * 0.15 + wave * 1.4, y: start.y + perp.y * length };
    const side = { x: -perp.y, y: perp.x };
    path.lineTo(end.x + side.x * r * sizes.scarfTail, end.y + side.y * r * sizes.scarfTail);
    path.quadTo(start.x - r * 0.1 + wave, start.y + length * 0.4, start.x + side.x * r * sizes.scarfTail, start.y + side.y * r * sizes.scarfTail);
    path.close();
    paintShape(c, path, item.c, fur);
  };
  tail(r * sizes.scarfTailLong, -r * 0.12);
  tail(r * sizes.scarfTailShort, r * 0.16);
}

function drawLens(c: SkCanvas, item: WearItem, ex: number, ey: number, eyeR: number, k: number, sx: number, sy: number, alpha: number, fur: string): void {
  const half = eyeR * sizes.glassesLens * k;
  const radius = half * sizes.glassesCorner;
  const frame = eyeR * sizes.glassesFrame;
  const gold = item.id === 'square';
  c.save();
  c.translate(ex + eyeR * 0.1 * k * sx, ey);
  c.scale(sx, sy);
  const lens = roundRectPath(0, 0, half, radius);
  if (gold) {
    c.drawPath(lens, paintOf('#82beff', sizes.squareLensAlpha * alpha));
  } else {
    c.drawPath(lens, paintOf('#12141c', sizes.glassesLensAlpha * alpha));
    strokeLine(c, -half * 0.42, -half * 0.38, -half * 0.42 + sizes.glassesGlare, -half * 0.38 - sizes.glassesGlare * 0.7, '#ffffff', sizes.glareWidth, sizes.glassesGlareAlpha * alpha);
  }
  const rim = roundRectPath(0, 0, half, radius);
  if (needsTrim(item.c, fur)) {
    c.drawPath(rim, paintOf(trimOf(fur), alpha, frame + sizes.trim * 2));
  }
  c.drawPath(rim, paintOf(outlineOf(item.c), alpha, frame + sizes.outline));
  c.drawPath(rim, paintOf(item.c, alpha, frame));
  c.restore();
}

export function drawGlasses(c: SkCanvas, item: WearItem, face: HeadFace, headR: number, fur: string): void {
  const { eyeR, nearEye, farEye, turn } = face;
  const view = Math.max(turn, face.front);
  const ex = nearEye.x;
  const ey = nearEye.y;
  const frame = eyeR * sizes.glassesFrame;
  const fit = Math.min(1, Math.max(0.6, face.gap3 / (3.3 * eyeR)));
  const k = 1 + (fit - 1) * view;
  outlinedLine(c, ex - eyeR * sizes.glassesLens * k, ey - eyeR * 0.1, -headR * 0.62, ey - headR * 0.06, item.c, frame, fur);
  if (view < 0.999) {
    outlinedLine(c, ex + eyeR * (sizes.glassesLens + 0.1) * k, ey + eyeR * 0.05, ex + eyeR * 2.9, ey + eyeR * 0.35, item.c, frame, fur, 1 - view);
  }
  drawLens(c, item, ex, ey, eyeR, k, 1, 1, 1, fur);
  if (face.farEyeAlpha > 0.001) {
    const a = face.farEyeAlpha;
    const { x: sx, y: sy } = face.farEyeScale;
    drawLens(c, item, farEye.x, ey, eyeR, k, sx, sy, a, fur);
    const nearEdge = ex + eyeR * (0.1 + sizes.glassesLens) * k;
    const farEdge = farEye.x + eyeR * (0.1 - sizes.glassesLens) * k * sx;
    outlinedLine(c, nearEdge - 1, ey - eyeR * 0.1, farEdge + 1, ey - eyeR * 0.1, item.c, frame, fur, a);
    if (face.front > 0.02) {
      outlinedLine(c, farEye.x + eyeR * sizes.glassesLens * k, ey - eyeR * 0.1, headR * 0.62, ey - headR * 0.06, item.c, frame, fur, face.front);
    }
  }
}

export function drawHat(c: SkCanvas, item: WearItem, r: number, face: HeadFace, fur: string): void {
  c.save();
  c.translate(face.top.x, 0);
  c.scale(sizes.hatScale * (1 + sizes.hatTurn * Math.max(face.turn, face.front)), sizes.hatScale);
  drawHatShape(c, item, r, fur);
  c.restore();
}

function drawHatShape(c: SkCanvas, item: WearItem, r: number, fur: string): void {
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
