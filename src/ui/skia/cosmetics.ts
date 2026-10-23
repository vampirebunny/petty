import { ClipOp, PathOp, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia';
import type { SkCanvas, SkPath } from '@shopify/react-native-skia';

import { isDarkCoat, type Geom } from '../../actor';
import type { HeadFace } from '../../actor/geometry';
import { wardrobeSizes } from '../../actor/data/wardrobeSizes';
import type { WearItem } from '../../actor/wardrobe';
import { clamp, deg, fillCircle, mix, oval, paintOf, polygon, strokeLine } from './draw';

type Pt = { x: number; y: number };

const sizes = wardrobeSizes;

const INK = '#1e140e';

// Same recipe as the pet outline: the item color pushed toward the warm ink.
export function outlineOf(color: string): string {
  return mix(color, INK, 0.75);
}

export function shadowTone(color: string): string {
  return mix(color, '#000000', 0.2);
}

export function highlightTone(color: string): string {
  return mix(color, '#ffffff', 0.3);
}

// Accent when the item has no `d`. Owned colors stay on `c`.
export function stripeTint(color: string): string {
  return mix(color, '#ffffff', 0.65);
}

function accentOf(item: WearItem, fallback: string): string {
  return item.colorway.d ?? fallback;
}

function edgePaint(color: string, alpha: number, width: number) {
  const paint = paintOf(color, alpha, width);
  paint.setStrokeJoin(StrokeJoin.Round);
  paint.setStrokeCap(StrokeCap.Round);
  return paint;
}

function paintShape(c: SkCanvas, path: SkPath, fill: string, fur?: string, details?: () => void, alpha = 1): void {
  const edge = outlineOf(fill);
  if (fur && isDarkCoat(fur)) {
    c.drawPath(path, edgePaint('#FFF4FA', 0.8 * alpha, 4));
  }
  c.drawPath(path, edgePaint(edge, alpha, sizes.outline));
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
  if (fur && isDarkCoat(fur)) {
    stroke('#FFF4FA', width + 4);
  }
  stroke(outlineOf(color), width + sizes.outline);
  stroke(color, width);
}

function outlinedQuad(c: SkCanvas, a: Pt, mid: Pt, b: Pt, color: string, width: number, fur?: string, alpha = 1): void {
  const path = Skia.Path.Make();
  path.moveTo(a.x, a.y);
  path.quadTo(mid.x, mid.y, b.x, b.y);
  if (fur && isDarkCoat(fur)) {
    c.drawPath(path, edgePaint('#FFF4FA', 0.8 * alpha, width + 4));
  }
  c.drawPath(path, edgePaint(outlineOf(color), alpha, width + sizes.outline));
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
  const color = tone(item.colorway.c);
  const k = sizes.sleeveUpper;
  const end = { x: hip.x + (knee.x - hip.x) * k, y: hip.y + (knee.y - hip.y) * k };
  const r = geom.legWidth / 2 + sizes.sleeveExtra / 2;
  paintShape(c, polygon(capsulePts(hip, end, r)), color, fur);
  const len = Math.hypot(end.x - hip.x, end.y - hip.y) || 1;
  const u = { x: (end.x - hip.x) / len, y: (end.y - hip.y) / len };
  const cuffStart = { x: end.x - u.x * r * 0.9, y: end.y - u.y * r * 0.9 };
  const cuff = item.shape === 'sweater' ? accentOf(item, highlightTone(item.colorway.c)) : shadowTone(item.colorway.c);
  paintShape(c, polygon(capsulePts(cuffStart, end, r + 0.6)), tone(cuff), fur);
}

// One rounded silhouette: the shaft and an oversized toe are merged so there is a single outline.
// `tilt` is 0 for a planted paw and 1 for a paw that follows the shin (sitting hind legs, lying, belly up, a jump tuck).
export function drawBoot(c: SkCanvas, knee: Pt, paw: Pt, geom: Geom, boot: WearItem, far: boolean, fur: string, tilt: number): void {
  const sneaker = boot.id === 'sneaker';
  const rain = boot.id === 'rain';
  const tone = (color: string) => (far ? mix(color, '#000000', 0.3) : color);
  const color = tone(boot.colorway.c);
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
  const sole = sneaker ? tone('#e4e1dc') : tone(mix(boot.colorway.c, '#000000', 0.55));

  paintShape(c, shape, color, fur, () => {
    // Sole: a band across the bottom of the foot in the foot's own frame, clipped to the boot.
    c.save();
    c.translate(paw.x, paw.y);
    c.rotate(deg(footRot), 0, 0);
    c.drawRect(Skia.XYWHRect(-toeRx * 4, toeLy + toeRy - soleH, toeRx * 8, soleH * 4), paintOf(sole));
    c.restore();
    if (sneaker) {
      const accent = tone(boot.colorway.d ?? '#d64545');
      const s0 = at(toeLx - toeRx * 0.6, toeLy + toeRy * 0.05);
      const s1 = at(toeLx + toeRx * 0.35, toeLy - toeRy * 0.5);
      strokeLine(c, s0.x, s0.y, s1.x, s1.y, accent, toeRy * 0.32);
      for (let i = 0; i < 2; i += 1) {
        const lace = { x: top.x + u.x * shaftR * (0.6 + i * 0.9) - side.x * shaftR * 0.35, y: top.y + u.y * shaftR * (0.6 + i * 0.9) - side.y * shaftR * 0.35 };
        fillCircle(c, lace.x, lace.y, Math.max(0.8, shaftR * 0.16), outlineOf(boot.colorway.c));
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
    const shine = at(toeLx + toeRx * 0.2, toeLy - toeRy * 0.35);
    c.drawPath(ovalArc(shine.x, shine.y, toeRx * 0.35, toeRy * 0.22, 210, 80), roundStroke(highlightTone(boot.colorway.c), 0.85, Math.max(0.7, toeRy * 0.18)));
  }

  // Red boots: a rounded cuff band in a darker shade of the boot color, slightly wider than the shaft.
  // No white and no separate puffs.
  if (!sneaker && !rain) {
    const cuffColor = tone(mix(boot.colorway.c, '#000000', 0.22));
    const cuffEnd = { x: top.x + u.x * shaftR * 1.1, y: top.y + u.y * shaftR * 1.1 };
    paintShape(c, polygon(capsulePts(top, cuffEnd, shaftR + 1)), cuffColor, fur);
  }
}

export type JacketPass = 'side' | 'front' | 'back';

export type JacketPose = {
  pass?: JacketPass;
  sit?: number;
  theta?: number;
  dy?: number;
  foreshorten?: number;
  belly?: number;
  alpha?: number;
};

function jacketAlpha(c: SkCanvas, alpha: number, draw: () => void): void {
  if (alpha <= 0.01) {
    return;
  }
  if (alpha >= 0.999) {
    draw();
    return;
  }
  const layer = Skia.Paint();
  layer.setAlphaf(alpha);
  c.saveLayer(layer);
  draw();
  c.restore();
}

function toActor(p: Pt, geom: Geom, theta: number, dy: number, foreshorten: number): Pt {
  const x = geom.Px + (p.x - geom.Px) * foreshorten;
  const rx = x - geom.Px;
  const ry = p.y - geom.Py;
  const cs = Math.cos(theta);
  const sn = Math.sin(theta);
  return { x: geom.Px + rx * cs - ry * sn, y: geom.Py + rx * sn + ry * cs + dy };
}

function fromActor(a: Pt, geom: Geom, theta: number, dy: number, foreshorten: number): Pt {
  const cs = Math.cos(theta);
  const sn = Math.sin(theta);
  const qx = a.x - geom.Px;
  const qy = a.y - dy - geom.Py;
  const x = geom.Px + qx * cs + qy * sn;
  const y = geom.Py - qx * sn + qy * cs;
  const fs = Math.max(foreshorten, 0.001);
  return { x: geom.Px + (x - geom.Px) / fs, y };
}

// Sitting pools the hem on the foot line. The coat is inside the sit rotation, so the clamp is in actor space.
function poolHem(p: Pt, geom: Geom, pose: JacketPose): Pt {
  const sit = pose.sit ?? 0;
  if (sit <= 0.001) {
    return p;
  }
  const theta = pose.theta ?? 0;
  const dy = pose.dy ?? 0;
  const fs = pose.foreshorten ?? 1;
  const actor = toActor(p, geom, theta, dy, fs);
  const back = fromActor({ x: actor.x, y: Math.min(actor.y, 0) }, geom, theta, dy, fs);
  return { x: p.x + (back.x - p.x) * sit, y: p.y + (back.y - p.y) * sit };
}

function ovalPath(cx: number, cy: number, rx: number, ry: number): SkPath {
  const path = Skia.Path.Make();
  path.addOval(oval(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5)));
  return path;
}

function clipTo(path: SkPath, mask: SkPath): SkPath {
  return Skia.Path.MakeFromOp(path, mask, PathOp.Intersect) ?? path;
}

function rectPath(x: number, y: number, w: number, h: number): SkPath {
  const path = Skia.Path.Make();
  path.addRect(Skia.XYWHRect(x, y, w, h));
  return path;
}

function sideSilhouette(geom: Geom, item: WearItem, breath: number, pose: JacketPose): SkPath {
  const cy = geom.bodyY;
  const ry = (geom.bodyH / 2) * breath;
  const shape = item.shape;
  if (shape === 'puffer') {
    const bulge = 0.12 * geom.bodyH * geom.thick;
    const seg = geom.bodyLen / 3;
    const parts: SkPath[] = [];
    for (let i = 0; i < 3; i += 1) {
      const cx = -geom.bodyLen / 2 + seg * (i + 0.5);
      parts.push(ovalPath(cx, cy, seg * 0.58, ry + bulge));
    }
    return unionOf(parts);
  }
  if (shape === 'vest') {
    const body = ovalPath(0, cy, geom.bodyLen / 2, ry);
    const cut = geom.bodyLen / 2 - geom.bodyLen * 0.55;
    return clipTo(body, rectPath(cut, cy - ry * 2, geom.bodyLen, ry * 4));
  }
  if (shape === 'raincoat') {
    const rearTop = { x: -geom.bodyLen / 2, y: cy - ry * 0.9 };
    const frontTop = { x: geom.bodyLen * 0.4, y: cy - ry * 0.2 };
    const hemY = cy + geom.bodyH / 2 + 0.25 * geom.L;
    const hemRear = poolHem({ x: -geom.bodyLen / 2 - geom.bodyLen * 0.15, y: hemY }, geom, pose);
    const hemFront = poolHem({ x: geom.bodyLen * 0.5, y: hemY }, geom, pose);
    const path = Skia.Path.Make();
    path.moveTo(rearTop.x, rearTop.y);
    path.quadTo(0, cy - ry, frontTop.x, frontTop.y);
    path.lineTo(hemFront.x, hemFront.y);
    path.quadTo((hemFront.x + hemRear.x) / 2, hemY + geom.bodyH * 0.05, hemRear.x, hemRear.y);
    path.close();
    return path;
  }
  const extra = shape === 'hoodie' ? geom.bodyH * 0.04 : 0;
  const body = ovalPath(0, cy, geom.bodyLen / 2, ry + extra);
  if (shape === 'sweater') {
    const rear = -geom.bodyLen / 2 + geom.bodyLen * 0.15;
    return clipTo(body, rectPath(rear, cy - ry * 3, geom.bodyLen, ry * 6));
  }
  return body;
}

function panelOval(geom: Geom, pass: 'front' | 'back'): { cx: number; cy: number; rx: number; ry: number } {
  if (pass === 'front') {
    const chestH = geom.bodyH;
    return { cx: 0, cy: geom.bodyY + chestH * 0.08, rx: geom.bodyH * 0.55, ry: chestH / 2 };
  }
  return { cx: 0, cy: geom.bodyY, rx: geom.bodyH * 0.52, ry: geom.bodyH * 0.48 };
}

function panelPath(geom: Geom, item: WearItem, pass: 'front' | 'back', pose: JacketPose): SkPath {
  const oval = panelOval(geom, pass);
  let { rx, ry, cx, cy } = oval;
  const shape = item.shape;
  if (shape === 'puffer') {
    rx += 0.12 * geom.bodyH;
  }
  if (shape === 'vest' && pass === 'back') {
    const strip = ry * 0.28;
    return ovalPath(cx, cy - ry + strip, rx * 0.9, strip);
  }
  let path = ovalPath(cx, cy, rx, ry);
  if (shape === 'sweater') {
    path = clipTo(path, rectPath(cx - rx * 2, cy - ry, rx * 4, ry * 1.7));
  }
  if (shape === 'raincoat') {
    const hem = cy + ry;
    const flare = rx * 0.15 * 2;
    const left = poolHem({ x: cx - rx - flare, y: hem }, geom, pose);
    const right = poolHem({ x: cx + rx + flare, y: hem }, geom, pose);
    const top = cy - ry * 0.85;
    const flared = Skia.Path.Make();
    flared.moveTo(cx - rx * 0.7, top);
    flared.lineTo(cx + rx * 0.7, top);
    flared.lineTo(right.x, right.y);
    flared.lineTo(left.x, left.y);
    flared.close();
    path = clipTo(unionOf([path, flared]), flared);
    path = unionOf([ovalPath(cx, cy, rx, ry * 0.8), flared]);
  }
  return path;
}

function quilt(c: SkCanvas, x: number, y: number, w: number, h: number, color: string): void {
  const q = Skia.Path.Make();
  const step = h * 0.45;
  for (let i = x - w; i < x + w * 2; i += step) {
    q.moveTo(i, y - h);
    q.lineTo(i + h, y + h);
    q.moveTo(i, y + h);
    q.lineTo(i + h, y - h);
  }
  c.drawPath(q, paintOf(color, 0.55, 1.2));
}

function drawJacketDetails(c: SkCanvas, geom: Geom, item: WearItem, path: SkPath, breath: number, pose: JacketPose): void {
  const color = item.colorway.c;
  const shadow = shadowTone(color);
  const light = highlightTone(color);
  const cy = geom.bodyY;
  const ry = (geom.bodyH / 2) * breath;
  const shape = item.shape;
  const belly = pose.belly ?? 0;
  const pass = pose.pass ?? 'side';
  if (shape === 'puffer') {
    const seg = pass === 'side' ? geom.bodyLen / 3 : geom.bodyH * 0.55;
    const origin = pass === 'side' ? -geom.bodyLen / 2 : -seg;
    for (let i = 1; i < 3; i += 1) {
      const x = origin + seg * i;
      strokeLine(c, x, cy - ry * 1.3, x, cy + ry * 1.3, shadow, 1.4);
    }
    for (let i = 0; i < 3; i += 1) {
      const x = origin + seg * (i + 0.5);
      c.drawPath(ovalArc(x, cy - ry * 0.35, seg * 0.28, ry * 0.22, 200, 140), roundStroke(light, 0.7, ry * 0.1));
    }
    const scallop = Skia.Path.Make();
    const y = cy + ry;
    for (let i = 0; i < 6; i += 1) {
      const x = -geom.bodyLen * 0.4 + i * geom.bodyLen * 0.16;
      scallop.moveTo(x, y);
      scallop.quadTo(x + geom.bodyLen * 0.08, y + ry * 0.18, x + geom.bodyLen * 0.16, y);
    }
    c.drawPath(scallop, roundStroke(shadow, 0.9, 1.6));
  } else if (shape === 'sweater') {
    const stripe = accentOf(item, stripeTint(color));
    if (pass !== 'front') {
      for (const k of [0.15, 0.38]) {
        strokeLine(c, -geom.bodyLen * k, cy - ry, -geom.bodyLen * k, cy + ry * 0.7, stripe, ry * 0.16);
      }
    }
    const hem = cy + ry * (pass === 'side' ? 0.72 : 0.7);
    strokeLine(c, -geom.bodyLen * 0.4, hem, geom.bodyLen * 0.4, hem, shadow, ry * 0.14);
    c.drawPath(path, dashed(shadow, 1.3, 1.2, 1.8));
  } else if (shape === 'vest') {
    quilt(c, 0, cy, geom.bodyLen, ry, shadow);
    const zx = pass === 'side' ? geom.bodyLen * 0.28 : 0;
    strokeLine(c, zx, cy - ry * 0.7, zx, cy + ry * 0.65, '#e0b43c', 1.8);
    paintShape(c, circlePath(zx, cy - ry * 0.55, geom.headR * sizes.zipPull), light);
  } else if (shape === 'raincoat') {
    c.drawPath(ovalArc(0, cy - ry * 0.2, geom.bodyLen * 0.22, ry * 0.55, 250, 70), roundStroke(light, 0.55, ry * 0.1));
    const hem = cy + (pass === 'side' ? geom.bodyH / 2 + 0.2 * geom.L : ry * 0.85);
    strokeLine(c, -geom.bodyLen * 0.45, hem, geom.bodyLen * 0.4, hem, shadow, 1.8);
    if (pass !== 'back' && belly < 0.45) {
      const button = mix(color, INK, 0.6);
      const bx = pass === 'front' ? 0 : geom.bodyLen * 0.32;
      for (let i = 0; i < 3; i += 1) {
        paintShape(c, circlePath(bx, cy - ry * 0.35 + i * ry * 0.32, geom.headR * 0.11), button);
      }
    }
  }
}

// Side silhouette, or a filled panel matched to the front chest oval or the back rump oval.
export function drawJacket(c: SkCanvas, geom: Geom, item: WearItem, breath: number, fur: string, pose: JacketPose = {}): void {
  const pass = pose.pass ?? 'side';
  const alpha = pose.alpha ?? 1;
  jacketAlpha(c, alpha, () => {
    const path = pass === 'side' ? sideSilhouette(geom, item, breath, pose) : panelPath(geom, item, pass, pose);
    paintShape(c, path, item.colorway.c, fur, () => drawJacketDetails(c, geom, item, path, breath, pose));
    if (item.shape === 'raincoat' && pass !== 'back' && (pose.belly ?? 0) < 0.45) {
      drawCollarFlaps(c, geom, item, fur);
    }
  });
}

function drawCollarFlaps(c: SkCanvas, geom: Geom, item: WearItem, fur: string): void {
  const y = geom.bodyY - geom.bodyH * 0.42;
  const x = geom.bodyLen * 0.28;
  const flap = (sign: number) => {
    const path = Skia.Path.Make();
    path.moveTo(x * 0.2, y);
    path.lineTo(x * sign, y + geom.headR * 0.45);
    path.lineTo(x * sign * 0.35, y + geom.headR * 0.15);
    path.close();
    paintShape(c, path, shadowTone(item.colorway.c), fur);
  };
  flap(1);
  flap(-0.15);
}

// Pocket, drawstrings, and the vest armhole. Drawn after the near fore leg.
export function drawChestDetails(
  c: SkCanvas,
  geom: Geom,
  item: WearItem,
  fur: string,
  theta: number,
  dy: number,
  swing: number,
  dir: number,
  belly: number,
  alpha = 1,
): void {
  jacketAlpha(c, alpha, () => {
    if (item.shape === 'hoodie') {
      const pocket = torsoPoint(geom, theta, dy, geom.bodyLen * 0.12, geom.bodyY + geom.bodyH * 0.28);
      const pw = geom.bodyLen * 0.22;
      const ph = geom.bodyH * 0.16;
      const path = Skia.Path.Make();
      path.addRRect(Skia.RRectXY(Skia.XYWHRect(pocket.x - pw, pocket.y - ph, pw * 2, ph * 2), ph * 0.4, ph * 0.4));
      paintShape(c, path, highlightTone(item.colorway.c), fur, () => {
        strokeLine(c, pocket.x - pw, pocket.y - ph * 0.7, pocket.x + pw, pocket.y - ph * 0.7, accentOf(item, item.colorway.c), 1.6);
      });
      if (belly < 0.45) {
        const throat = torsoPoint(geom, theta, dy, geom.bodyLen / 2 - 14, geom.bodyY - 2);
        const hang = swing * dir;
        const len = geom.headR * 0.4;
        const string = mix(item.colorway.c, '#ffffff', 0.6);
        const tip = accentOf(item, item.colorway.c);
        for (const sign of [-1, 1]) {
          const end = {
            x: throat.x + Math.sin(hang + sign * 0.25) * len * 0.35 + sign * geom.headR * 0.06,
            y: throat.y + Math.cos(hang) * len,
          };
          strokeLine(c, throat.x + sign * 2, throat.y, end.x, end.y, string, 1.4);
          paintShape(c, circlePath(end.x, end.y, 2.2), tip, fur);
        }
      }
    }
    if (item.shape === 'vest') {
      const hip = torsoPoint(geom, theta, dy, geom.foreX, geom.hipY);
      c.drawPath(ovalArc(hip.x, hip.y - geom.bodyH * 0.05, geom.bodyH * 0.22, geom.bodyH * 0.16, 200, 140), roundStroke(shadowTone(item.colorway.c), 0.9, 1.6));
    }
  });
}

function torsoPoint(geom: Geom, theta: number, dy: number, x: number, y: number): Pt {
  const rx = x - geom.Px;
  const ry = y - geom.Py;
  const cs = Math.cos(theta);
  const sn = Math.sin(theta);
  return { x: geom.Px + rx * cs - ry * sn, y: geom.Py + rx * sn + ry * cs + dy };
}

// A bunched hood behind the head. `perp` points to the throat, so the back is -perp.
export function drawHood(c: SkCanvas, base: Pt, perp: Pt, along: Pt, item: WearItem, r: number, neckWidth: number, fur: string, alpha = 1): void {
  jacketAlpha(c, alpha, () => {
    const blob = r * 0.55;
    const center = offset(offset(base, along, r * 0.08), perp, -neckWidth * 0.35);
    paintShape(c, circlePath(center.x, center.y, blob), item.colorway.c, fur, () => {
      c.drawPath(ovalArc(center.x, center.y, blob * 0.5, blob * 0.4, 30, 130), roundStroke(shadowTone(item.colorway.c), 1, blob * 0.08));
    });
  });
}

// Drawn after the neck stroke, so the neck comes out of the coat instead of being painted over it.
export function drawJacketCollar(c: SkCanvas, base: Pt, perp: Pt, along: Pt, item: WearItem, r: number, neckWidth: number, fur: string): void {
  const at = offset(base, along, r * sizes.collarRise);
  const reach = neckWidth * 0.55;
  const a = offset(at, perp, -reach);
  const b = offset(at, perp, reach);
  const mid = { x: at.x - along.x * r * 0.18, y: at.y - along.y * r * 0.18 };
  if (item.shape === 'hoodie') {
    return;
  }
  const thick = r * (item.shape === 'puffer' ? 0.44 : item.shape === 'sweater' ? 0.4 : item.shape === 'vest' ? 0.36 : 0.3);
  const color = item.shape === 'raincoat' ? shadowTone(item.colorway.c) : item.colorway.c;
  outlinedQuad(c, a, mid, b, color, thick, fur);
  const line = Skia.Path.Make();
  line.moveTo(a.x, a.y);
  line.quadTo(mid.x, mid.y, b.x, b.y);
  if (item.shape === 'sweater') {
    c.drawPath(line, dashed(shadowTone(item.colorway.c), thick * 0.9, 1.3, 1.7));
    c.drawPath(line, dashed(shadowTone(item.colorway.c), thick * 0.45, 1.3, 1.7));
  } else if (item.shape === 'puffer') {
    const hi = Skia.Path.Make();
    const lift = thick * 0.22;
    hi.moveTo(a.x + along.x * lift, a.y + along.y * lift);
    hi.quadTo(mid.x + along.x * lift, mid.y + along.y * lift, b.x + along.x * lift, b.y + along.y * lift);
    c.drawPath(hi, roundStroke(highlightTone(item.colorway.c), 0.7, thick * 0.25));
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
    outlinedQuad(c, a, mid, b, item.colorway.c, r * sizes.collarBand, fur);
    if (studs && item.colorway.d) {
      paintShape(c, circlePath(at.x, at.y, r * sizes.collarStud), item.colorway.d);
    }
    return offset(at, perp, r * 0.1);
  }
  const { a, b, mid, lower } = bandEnds(chin, perp, along, r, r * 0.62, view, pitch);
  outlinedQuad(c, a, mid, b, item.colorway.c, r * sizes.collarBand, fur);
  if (studs && item.colorway.d) {
    const across = spanDir(perp, view, pitch);
    for (let i = -1; i <= 1; i += 1) {
      const at = offset(chin, across, i * r * 0.22);
      paintShape(c, circlePath(at.x, at.y, r * sizes.collarStud), item.colorway.d);
    }
  }
  // Side view hangs the tag from the low tip. A turned head hangs it from the middle of the throat.
  return { x: lower.x + (chin.x - lower.x) * view, y: lower.y + (chin.y - lower.y) * view };
}

export type HangPose = { sit?: number; lie?: number; belly?: number; theta?: number; swing?: number; dir?: number };

function hangVector(hang: HangPose): Pt {
  const sit = clamp(hang.sit ?? 0, 0, 1);
  const lie = clamp(hang.lie ?? 0, 0, 1);
  const stand = clamp(1 - sit - lie, 0, 1);
  const theta = hang.theta ?? 0;
  const chest = theta + Math.PI / 2;
  const droop = (10 * Math.PI) / 180;
  const x = stand * 0 + sit * Math.cos(chest) + lie * Math.cos(droop);
  const y = stand * 1 + sit * Math.sin(chest) + lie * Math.sin(droop);
  const len = Math.hypot(x, y) || 1;
  const swing = (hang.swing ?? 0) * (hang.dir ?? 1);
  const cs = Math.cos(swing);
  const sn = Math.sin(swing);
  const ux = x / len;
  const uy = y / len;
  return { x: ux * cs - uy * sn, y: ux * sn + uy * cs };
}

function drawScarf(
  c: SkCanvas,
  chin: Pt,
  perp: Pt,
  along: Pt,
  item: WearItem,
  r: number,
  fur: string,
  view: number,
  pitch: number,
  hang: HangPose,
): void {
  const belly = hang.belly ?? 0;
  const flat = neckFlat(along);
  const knotAt = flat > 0.45 ? offset(chin, perp, r * sizes.collarFlatDrop) : chin;
  const { a, b, mid } = bandEnds(chin, perp, along, r, r * 0.55, flat > 0.45 ? 0 : view, pitch);
  const color = item.colorway.c;
  const stripe = stripeTint(color);
  const shadow = shadowTone(color);
  outlinedQuad(c, a, mid, b, color, r * 0.32, fur);
  const across = { x: b.x - a.x, y: b.y - a.y };
  for (let i = 0; i < 3; i += 1) {
    const t = 0.25 + i * 0.22;
    const at = { x: a.x + across.x * t, y: a.y + across.y * t };
    strokeLine(c, at.x - perp.x * r * 0.12, at.y - perp.y * r * 0.12, at.x + perp.x * r * 0.16, at.y + perp.y * r * 0.16, stripe, 1.5);
  }
  const knit = Skia.Path.Make();
  knit.moveTo(a.x, a.y);
  knit.quadTo(mid.x, mid.y, b.x, b.y);
  c.drawPath(knit, dashed(shadow, 1.2, 2, 2));
  if (belly > 0.45) {
    return;
  }
  const dir = hangVector(hang);
  const sitOff = (hang.sit ?? 0) * r * 0.05;
  const knot = {
    x: knotAt.x + dir.x * r * 0.08 + along.x * sitOff,
    y: knotAt.y + dir.y * r * 0.08 + along.y * sitOff,
  };
  paintShape(c, ovalPath(knot.x, knot.y, r * 0.15, r * 0.125), color, fur);
  const side = { x: -dir.y, y: dir.x };
  const tail = (spread: number) => {
    const start = { x: knot.x + side.x * spread, y: knot.y + side.y * spread };
    const length = r * 0.75;
    const width = r * 0.15;
    const end = { x: start.x + dir.x * length, y: start.y + dir.y * length };
    paintShape(c, polygon(capsulePts(start, end, width)), color, fur, () => {
      const band = { x: start.x + dir.x * length * 0.45, y: start.y + dir.y * length * 0.45 };
      strokeLine(c, band.x - side.x * width, band.y - side.y * width, band.x + side.x * width, band.y + side.y * width, stripe, 1.6);
      for (let i = -1; i <= 1; i += 1) {
        const tip = { x: end.x + side.x * i * width * 0.7, y: end.y + side.y * i * width * 0.7 };
        strokeLine(c, tip.x, tip.y, tip.x + dir.x * r * 0.08, tip.y + dir.y * r * 0.08, shadow, 1.1);
      }
    });
  };
  tail(-r * 0.08);
  tail(r * 0.1);
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
  hang: HangPose = {},
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
      const bell = item.colorway.d ?? '#f0c94a';
      const bellR = r * sizes.bell * (0.55 + 0.45 * hangK);
      paintShape(c, circlePath(hang.x, hang.y, bellR), bell, fur);
      strokeLine(c, hang.x - bellR * 0.5, hang.y - bellR * 0.12, hang.x + bellR * 0.5, hang.y - bellR * 0.12, outlineOf(bell), sizes.outline * 0.7);
      paintShape(c, circlePath(hang.x, hang.y + bellR * 0.35, bellR * 0.18), outlineOf(bell));
      c.drawPath(ovalArc(hang.x - bellR * 0.15, hang.y - bellR * 0.2, bellR * 0.35, bellR * 0.22, 210, 90), roundStroke('#ffffff', 0.75, Math.max(0.6, bellR * 0.22)));
    } else {
      const tag = item.colorway.d ?? '#f0c94a';
      const tagR = r * sizes.collarTag * (0.55 + 0.45 * hangK);
      paintShape(c, circlePath(hang.x, hang.y, tagR), tag);
      c.drawPath(ovalArc(hang.x - tagR * 0.1, hang.y - tagR * 0.15, tagR * 0.4, tagR * 0.24, 200, 80), roundStroke('#ffffff', 0.7, Math.max(0.6, tagR * 0.2)));
    }
    return;
  }
  if (item.id === 'bandana') {
    drawBandana(c, chin, perp, along, item, sway + (hang.swing ?? 0) * (hang.dir ?? 1), r, fur, view);
    return;
  }
  if (item.id === 'bow') {
    const knot = flat > 0.45 ? offset(chin, perp, r * sizes.collarFlatDrop) : chin;
    const reach = r * 0.34 * (flat > 0.45 ? 0.55 : 1);
    if (flat > 0.45) {
      outlinedQuad(c, offset(knot, along, -reach), offset(knot, perp, r * 0.08), offset(knot, along, reach * 0.4), item.colorway.c, r * 0.08, fur);
    } else {
      const { a, b, mid } = bandEnds(chin, perp, along, r, reach, turned, pitch);
      outlinedQuad(c, a, mid, b, item.colorway.c, r * 0.08, fur);
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
    paintShape(c, left, item.colorway.c, fur);
    paintShape(c, right, item.colorway.c, fur);
    paintShape(c, circlePath(knot.x, knot.y + hangDir.y * r * 0.1, r * 0.12 * hangK), mix(item.colorway.c, '#000000', 0.2));
    return;
  }
  drawScarf(c, chin, perp, along, item, r, fur, view, pitch, hang);
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
  const deep = mix(item.colorway.c, '#000000', 0.2);
  const bandColor = mix(item.colorway.c, '#000000', 0.12);

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
      paintShape(c, polygon(capsulePts(a, { x: a.x + dx * r, y: a.y + dy * r }, r * 0.07)), item.colorway.c, fur, undefined, knotK);
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
  paintShape(c, cloth, item.colorway.c, fur, () => {
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
  if (isDarkCoat(fur)) {
    c.drawPath(path, edgePaint('#FFF4FA', 0.8 * alpha, L.frame + 4));
  }
  c.drawPath(path, edgePaint(outlineOf(item.colorway.c), alpha, L.frame + sizes.outline));
  c.drawPath(path, edgePaint(item.colorway.c, alpha, L.frame));
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
    outlinedQuad(c, start, mid, end, item.colorway.c, arm, fur, sideK);
  }
  if (face.front > 0.01) {
    // Front: short stubs from each lens's outer edge toward the side of the head.
    const sign = Math.sign(L.near.x - L.far.x) || -1;
    const nearEdge = { x: L.near.x + sign * L.w * 0.95, y: L.near.y - L.h * 0.3 };
    const farEdge = { x: L.far.x - sign * L.w * 0.95 * face.farEyeScale.x, y: L.near.y - L.h * 0.3 };
    outlinedLine(c, nearEdge.x, nearEdge.y, nearEdge.x + sign * headR * 0.25, nearEdge.y - headR * 0.02, item.colorway.c, arm, fur, face.front);
    outlinedLine(c, farEdge.x, farEdge.y, farEdge.x - sign * headR * 0.25, farEdge.y - headR * 0.02, item.colorway.c, arm, fur, face.front * face.farEyeAlpha);
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
    outlinedQuad(c, p0, mid, p1, item.colorway.c, L.frame * 0.9, fur, a);
  } else {
    // Side view only: a short nose pad from the front of the lens, so the lens doesn't float. Never onto the muzzle.
    const side = 1 - L.view;
    if (side > 0.01) {
      const from = { x: L.near.x + L.w * 0.9, y: L.near.y - L.h * 0.3 };
      outlinedLine(c, from.x, from.y, from.x + face.eyeR * 0.45, from.y + face.eyeR * 0.1, item.colorway.c, L.frame * 0.9, fur, side);
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
    paintShape(c, cap, item.colorway.c, fur, () => {
      const rib = mix(item.colorway.c, '#000000', 0.18);
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
    paintShape(c, band, mix(item.colorway.c, '#000000', 0.12), fur);
    paintShape(c, circlePath(-r * 0.05, -r * 1.4, r * sizes.beaniePom), '#f6f6f6');
    return;
  }
  if (item.id === 'party') {
    const stripe = item.colorway.d ?? '#ffd34d';
    const cone = polygon([
      [-r * 0.55, -r * 0.72],
      [r * 0.48, -r * 0.72],
      [-r * 0.04, -r * sizes.partyTip],
    ]);
    paintShape(c, cone, item.colorway.c, fur, () => {
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
  paintShape(c, crown, item.colorway.c, fur);
  const brim = Skia.Path.Make();
  brim.addOval(oval(0, -r * 0.92, r * sizes.topBrim, r * 0.2));
  paintShape(c, brim, item.colorway.c, fur);
  const band = item.colorway.d ?? mix(item.colorway.c, '#ffffff', 0.55);
  const wrap = Skia.Path.Make();
  wrap.addRect(Skia.XYWHRect(-r * 0.42, -r * 1.22, r * 0.84, r * 0.18));
  paintShape(c, wrap, band);
  c.restore();
}
