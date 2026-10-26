import { ClipOp, PathOp, Skia, StrokeCap, StrokeJoin } from '@shopify/react-native-skia';
import type { SkCanvas, SkPath } from '@shopify/react-native-skia';

import { isDarkCoat, type Geom } from '../../actor';
import { torsoPoint, type HeadFace } from '../../actor/geometry';
import { wardrobeSizes } from '../../actor/data/wardrobeSizes';
import { PART_NAMES, PATTERN_PARTS, type PatternId, type WearItem } from '../../actor/wardrobe';
import { clamp, deg, fillCircle, mix, oval, paintOf, polygon, strokeLine } from './draw';
import { drawItemPattern, isPatternId, patternPaint, patternUnit, type PatternPaint } from './patterns';

type Pt = { x: number; y: number };

const sizes = wardrobeSizes;

const INK = '#1e140e';

let outlineScale = 1;

export function setOutlineScale(scale: number): void {
  outlineScale = scale;
}

function outlineWidth(): number {
  return sizes.outline * outlineScale;
}

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

function light(color: string, k: number): string {
  return mix(color, '#ffffff', k);
}

function shade(color: string, k: number): string {
  return mix(color, '#000000', k);
}

export type ResolvedPart = { color: string; pattern: PatternPaint | null };

function partPattern(item: WearItem, id: PatternId, color: string, accent: string | undefined, u: number): PatternPaint {
  const angle = id === 'stripes' && (item.shape === 'scarf' || item.shape === 'bandana') ? 30 : 0;
  return { id, c: color, d: accent, u: patternUnit(u), angle };
}

function defaultPart(item: WearItem, part: string, color: string, accent: string | undefined): string {
  switch (`${item.shape}.${part}`) {
    case 'beanie.cuff':
      return shade(color, 0.14);
    case 'beanie.pom':
      return accent ?? light(color, 0.45);
    case 'party.trim':
    case 'party.pom':
      return accent ?? color;
    case 'top.band':
      return accent ?? light(color, 0.55);
    case 'cap.brim':
      return accent ?? shade(color, 0.2);
    case 'bucket.band':
      return accent ?? shade(color, 0.2);
    case 'collar.charm':
      return accent ?? '#f0c94a';
    case 'bandana.band':
      return shade(color, 0.12);
    case 'bowtie.knot':
      return accent ?? color;
    case 'sweater.rib':
      return accent ?? stripeTint(color);
    case 'hoodie.rib':
      return shade(color, 0.1);
    case 'hoodie.pocket':
      return light(color, 0.22);
    case 'hoodie.lining':
      return light(color, 0.45);
    case 'puffer.collar':
      return accent ?? light(color, 0.5);
    case 'vest.collar':
      return shade(color, 0.12);
    case 'raincoat.lining':
      return shade(color, 0.3);
    case 'raincoat.strip':
      return '#E9ECF2';
    case 'red.cuff':
      return shade(color, 0.22);
    case 'red.sole':
      return shade(color, 0.55);
    case 'rain.sole':
      return accent ?? shade(color, 0.5);
    case 'sneaker.sole':
    case 'hightop.sole':
      return '#e4e1dc';
    case 'sneaker.stripe':
    case 'hightop.stripe':
      return accent ?? '#d64545';
    case 'sneaker.laces':
    case 'hightop.laces':
      return outlineOf(color);
    default:
      return color;
  }
}

export function resolvePart(item: WearItem, part: string, u = 1): ResolvedPart {
  const color = item.colorway.c;
  const accent = item.colorway.d;
  const named = PART_NAMES[item.shape] ?? [];
  const override = named.includes(part) ? item.colorway.parts?.[part] : undefined;
  if (typeof override === 'string') {
    return { color: override, pattern: null };
  }
  if (override && typeof override === 'object' && isPatternId(override.pattern)) {
    const fill = override.c ?? color;
    return { color: fill, pattern: partPattern(item, override.pattern, fill, override.d ?? accent, u) };
  }
  const allowed = item.patternParts ?? PATTERN_PARTS[item.shape] ?? [];
  if (item.colorway.pattern && allowed.includes(part)) {
    return { color, pattern: patternPaint(item, part, u) };
  }
  return { color: defaultPart(item, part, color, accent), pattern: null };
}

function textureAlpha(pattern: PatternPaint | null, alpha = 1): number {
  return pattern ? alpha * 0.45 : alpha;
}

function edgePaint(color: string, alpha: number, width: number) {
  const paint = paintOf(color, alpha, width);
  paint.setStrokeJoin(StrokeJoin.Round);
  paint.setStrokeCap(StrokeCap.Round);
  return paint;
}

const warnedShapes = new Set<string>();

function warnShape(item: WearItem): void {
  const key = `${item.slot}:${item.shape}`;
  if (warnedShapes.has(key)) {
    return;
  }
  warnedShapes.add(key);
  if (typeof __DEV__ === 'undefined' || __DEV__) {
    console.warn(`unknown ${item.slot} shape ${item.shape}`);
  }
}

function paintShape(
  c: SkCanvas,
  path: SkPath,
  fill: string,
  fur?: string,
  details?: () => void,
  alpha = 1,
  pattern?: PatternPaint | null,
): void {
  const edge = outlineOf(fill);
  if (fur && isDarkCoat(fur)) {
    c.drawPath(path, edgePaint('#FFF4FA', 0.8 * alpha, 4));
  }
  c.drawPath(path, edgePaint(edge, alpha, outlineWidth()));
  c.drawPath(path, paintOf(fill, alpha));
  if (pattern) {
    drawItemPattern(c, path, pattern);
  }
  if (details) {
    c.save();
    c.clipPath(path, ClipOp.Intersect, true);
    details();
    c.restore();
  }
  c.drawPath(path, edgePaint(edge, alpha, outlineWidth()));
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
  stroke(outlineOf(color), width + outlineWidth());
  stroke(color, width);
}

function outlinedQuad(c: SkCanvas, a: Pt, mid: Pt, b: Pt, color: string, width: number, fur?: string, alpha = 1): void {
  const path = Skia.PathBuilder.Make();
  path.moveTo(a.x, a.y);
  path.quadTo(mid.x, mid.y, b.x, b.y);
  if (fur && isDarkCoat(fur)) {
    c.drawPath(path.build(), edgePaint('#FFF4FA', 0.8 * alpha, width + 4));
  }
  c.drawPath(path.build(), edgePaint(outlineOf(color), alpha, width + outlineWidth()));
  c.drawPath(path.build(), edgePaint(color, alpha, width));
}

function circlePath(x: number, y: number, r: number): SkPath {
  const path = Skia.PathBuilder.Make();
  path.addCircle(x, y, Math.max(r, 0.5));
  return path.detach();
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
  const path = Skia.PathBuilder.Make();
  path.addArc(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2), start, sweep);
  return path.detach();
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

// Direction from the shoulder toward the head. A sleeping head sits on the shoulders, so the
// real segment is shorter than the stroke fudge (2px back, 3px down) and that fudge aims the
// strap through the face. A short neck wears forward, the same way the unmirrored pet faces.
export function neckAxis(head: Pt, base: Pt, r: number): Pt {
  const sx = head.x - base.x;
  const sy = head.y - base.y;
  if (Math.hypot(sx, sy) < r * 0.5) {
    return { x: 1, y: 0 };
  }
  const nx = sx - 2;
  const ny = sy + 3;
  const nl = Math.hypot(nx, ny) || 1;
  return { x: nx / nl, y: ny / nl };
}

// Sleep / lie: paint neckwear under the head so the face covers the strap and the bib
// comes out under the jaw instead of across the muzzle.
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

export function chinAnchor(head: Pt, base: Pt, r: number, pitch: number, cat: boolean, view: number, jaw?: Pt, lie = 0): Pt {
  const toBaseX = base.x - head.x;
  const toBaseY = base.y - head.y;
  const len = Math.hypot(toBaseX, toBaseY) || 1;
  const dx = toBaseX / len;
  const dy = toBaseY / len;
  const flat = neckFlat({ x: -dx, y: -dy });
  // Sleep parks the head on the shoulders: the neck segment is shorter than the head, so the chin
  // must stay on that short segment or the band lands in the face or past the chest.
  const short = clamp(1 - len / (r * 1.25), 0, 1);
  // Head on the floor: the throat is the underside of the skull, not the midpoint of a stub neck
  // and not a point past the chest. Anything else draws the bib across the muzzle.
  if (short > 0.55 || (lie > 0.45 && flat > 0.45)) {
    return { x: head.x + r * sizes.chinLieX, y: head.y + r * sizes.chinLieY };
  }
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
  const uFill = geom.headR * 0.1;
  const body = resolvePart(item, 'body', uFill);
  const color = tone(body.color);
  const k = sizes.sleeveUpper;
  const end = { x: hip.x + (knee.x - hip.x) * k, y: hip.y + (knee.y - hip.y) * k };
  const r = geom.legWidth / 2 + sizes.sleeveExtra / 2;
  paintShape(c, polygon(capsulePts(hip, end, r)), color, fur, undefined, 1, body.pattern);
  const len = Math.hypot(end.x - hip.x, end.y - hip.y) || 1;
  const axis = { x: (end.x - hip.x) / len, y: (end.y - hip.y) / len };
  const cuffStart = { x: end.x - axis.x * r * 0.9, y: end.y - axis.y * r * 0.9 };
  const ribbed = item.shape === 'sweater' || item.shape === 'hoodie';
  const cuff = ribbed ? resolvePart(item, 'rib', uFill).color : shadowTone(item.colorway.c);
  paintShape(c, polygon(capsulePts(cuffStart, end, r + 0.6)), tone(cuff), fur);
  if (ribbed) {
    const across = { x: -axis.y, y: axis.x };
    const mid = { x: (cuffStart.x + end.x) / 2, y: (cuffStart.y + end.y) / 2 };
    const tick = dashed(shade(cuff, 0.16), r * 0.35, geom.headR * 0.04, geom.headR * 0.08, textureAlpha(body.pattern));
    tick.setStrokeCap(StrokeCap.Butt);
    c.drawLine(mid.x - across.x * r, mid.y - across.y * r, mid.x + across.x * r, mid.y + across.y * r, tick);
  }
}

// One rounded silhouette: the shaft and an oversized toe are merged so there is a single outline.
// `tilt` is 0 for a planted paw and 1 for a paw that follows the shin (sitting hind legs, lying, belly up, a jump tuck).
export function drawBoot(c: SkCanvas, knee: Pt, paw: Pt, geom: Geom, boot: WearItem, far: boolean, fur: string, tilt: number): void {
  const sneaker = boot.shape === 'sneaker' || boot.shape === 'hightop';
  const high = boot.shape === 'hightop';
  const rain = boot.shape === 'rain';
  if (!sneaker && !rain && boot.shape !== 'red') {
    warnShape(boot);
    return;
  }
  const tone = (color: string) => (far ? mix(color, '#000000', 0.3) : color);
  const uFill = geom.headR * 0.1;
  const shaftPart = resolvePart(boot, sneaker ? 'upper' : 'shaft', uFill);
  const color = tone(shaftPart.color);
  const segX = paw.x - knee.x;
  const segY = paw.y - knee.y;
  const segLen = Math.hypot(segX, segY) || 1;
  const u = { x: segX / segLen, y: segY / segLen };
  // `side` points to the back of the leg; the front is -side.
  const side = { x: -u.y, y: u.x };
  const shaftR = geom.legWidth / 2 + sizes.bootShaftExtra / 2;
  const topK = high ? sizes.hightopTop : sneaker ? sizes.sneakerTop : rain ? sizes.rainTop : sizes.bootTop;
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
  const solePart = resolvePart(boot, 'sole', uFill);
  const soleH = rain ? Math.max(sizes.bootSole, toeRy * 0.45) : Math.max(sizes.bootSole, toeRy * (sneaker ? sizes.sneakerSole : sizes.bootSoleK));
  const sole = tone(solePart.color);

  paintShape(c, shape, color, fur, () => {
    c.save();
    c.translate(paw.x, paw.y);
    c.rotate(deg(footRot), 0, 0);
    c.drawRect(Skia.XYWHRect(-toeRx * 4, toeLy + toeRy - soleH, toeRx * 8, soleH * 4), paintOf(sole));
    if (sneaker) {
      c.drawLine(-toeRx * 4, toeLy + toeRy - soleH, toeRx * 4, toeLy + toeRy - soleH, paintOf(shade(sole, 0.25), 1, 1));
    }
    if (rain) {
      for (let i = 0; i < 4; i += 1) {
        const x = -toeRx * 0.2 + i * toeRx * 0.28;
        c.drawLine(x, toeLy + toeRy - soleH * 0.35, x, toeLy + toeRy + 1, paintOf(shade(sole, 0.35), 1, 1.1));
      }
    }
    c.restore();
    if (sneaker) {
      const stripe = tone(resolvePart(boot, 'stripe', uFill).color);
      const laces = tone(resolvePart(boot, 'laces', uFill).color);
      const s0 = at(toeLx - toeRx * 0.55, toeLy + toeRy * 0.15);
      const s1 = at(toeLx + toeRx * 0.2, toeLy - toeRy * 0.15);
      strokeLine(c, s0.x, s0.y, s1.x, s1.y, stripe, toeRy * 0.16);
      const s2 = at(toeLx - toeRx * 0.2, toeLy - toeRy * 0.05);
      const s3 = at(toeLx + toeRx * 0.45, toeLy - toeRy * 0.55);
      strokeLine(c, s2.x, s2.y, s3.x, s3.y, stripe, toeRy * 0.12);
      const count = high ? 3 : 2;
      for (let i = 0; i < count; i += 1) {
        const along = 0.35 + i * 0.28;
        const lace = { x: top.x + u.x * shaftR * along - side.x * shaftR * 0.15, y: top.y + u.y * shaftR * along - side.y * shaftR * 0.15 };
        const lace2 = { x: lace.x - side.x * shaftR * 0.7, y: lace.y - side.y * shaftR * 0.7 };
        strokeLine(c, lace.x, lace.y, lace2.x, lace2.y, laces, Math.max(1, shaftR * 0.14));
      }
      const collar = shade(shaftPart.color, 0.08);
      const band = { x: top.x + u.x * shaftR * 0.35, y: top.y + u.y * shaftR * 0.35 };
      paintShape(c, polygon(capsulePts(top, band, shaftR * 1.05)), tone(collar), fur);
    } else if (rain) {
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
  }, 1, shaftPart.pattern);

  if (!far && !sneaker) {
    const shine = at(toeLx + toeRx * 0.2, toeLy - toeRy * 0.35);
    c.drawPath(ovalArc(shine.x, shine.y, toeRx * 0.35, toeRy * 0.22, 210, 80), roundStroke(highlightTone(boot.colorway.c), 0.85, Math.max(0.7, toeRy * 0.18)));
  }

  if (rain) {
    const tabA = { x: top.x + side.x * shaftR * 0.2, y: top.y + side.y * shaftR * 0.2 };
    const tabB = { x: tabA.x + side.x * shaftR * 0.55 - u.x * shaftR * 0.45, y: tabA.y + side.y * shaftR * 0.55 - u.y * shaftR * 0.45 };
    const tabC = { x: tabA.x + side.x * shaftR * 0.15 - u.x * shaftR * 0.7, y: tabA.y + side.y * shaftR * 0.15 - u.y * shaftR * 0.7 };
    const tab = Skia.PathBuilder.Make();
    tab.moveTo(tabA.x, tabA.y);
    tab.quadTo(tabB.x, tabB.y, tabC.x, tabC.y);
    const tabPath = tab.detach();
    c.drawPath(tabPath, edgePaint(outlineOf(color), 1, Math.max(1.4, shaftR * 0.28)));
    c.drawPath(tabPath, edgePaint(shade(color, 0.15), 1, Math.max(0.8, shaftR * 0.12)));
  }

  if (boot.shape === 'red') {
    const cuffColor = tone(resolvePart(boot, 'cuff', uFill).color);
    const cuffTop = { x: top.x - u.x * shaftR * 0.1, y: top.y - u.y * shaftR * 0.1 };
    const cuffEnd = { x: top.x + u.x * shaftR * 1.1, y: top.y + u.y * shaftR * 1.1 };
    paintShape(c, polygon(capsulePts(cuffTop, cuffEnd, shaftR + geom.headR * sizes.bootCuffFlare)), cuffColor, fur);
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
  const path = Skia.PathBuilder.Make();
  path.addOval(oval(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5)));
  return path.detach();
}

function clipTo(path: SkPath, mask: SkPath): SkPath {
  return Skia.Path.MakeFromOp(path, mask, PathOp.Intersect) ?? path;
}

function rectPath(x: number, y: number, w: number, h: number): SkPath {
  return Skia.Path.Rect(Skia.XYWHRect(x, y, w, h));
}

type JFrame = {
  a: number;
  b: number;
  o: number;
  cy: number;
  r: number;
  top: (u: number, off?: number) => Pt;
  bot: (u: number, off?: number) => Pt;
};

function jacketFrame(geom: Geom, breath: number): JFrame {
  const a = geom.bodyLen / 2;
  const b = (geom.bodyH / 2) * breath;
  const o = 0.1 * b;
  const cy = geom.bodyY;
  const at = (u: number, off: number, sign: number): Pt => {
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    return { x: u * (a + off), y: cy + sign * (b + off) * s };
  };
  return {
    a,
    b,
    o,
    cy,
    r: geom.headR,
    top: (u, off = o) => at(clamp(u, -1, 1), off, -1),
    bot: (u, off = o) => at(clamp(u, -1, 1), off, 1),
  };
}

function arcPts(a0: number, a1: number, rx: number, ry: number, cy: number, steps = 14): Pt[] {
  let sweep = a1 - a0;
  while (sweep <= 0.0001) {
    sweep += Math.PI * 2;
  }
  const pts: Pt[] = [];
  for (let i = 1; i <= steps; i += 1) {
    const ang = a0 + sweep * (i / steps);
    pts.push({ x: Math.cos(ang) * rx, y: cy + Math.sin(ang) * ry });
  }
  return pts;
}

function topAng(u: number): number {
  return -Math.acos(clamp(u, -1, 1));
}

function botAng(u: number): number {
  return Math.acos(clamp(u, -1, 1));
}

function addLine(path: ReturnType<typeof Skia.PathBuilder.Make>, pts: Pt[]): void {
  for (const p of pts) {
    path.lineTo(p.x, p.y);
  }
}

function ribDash(color: string, width: number, r: number, alpha: number) {
  const paint = dashed(shade(color, 0.16), width, r * 0.04, r * 0.08, alpha);
  paint.setStrokeCap(StrokeCap.Butt);
  return paint;
}

function cableColumn(x: number, y0: number, y1: number, r: number, sign: number): SkPath {
  const path = Skia.PathBuilder.Make();
  const step = r * 0.23;
  const amp = r * 0.11;
  let y = y0;
  let k = sign;
  path.moveTo(x, y);
  while (y < y1) {
    const next = Math.min(y1, y + step);
    path.quadTo(x + amp * k, y + (next - y) * 0.5, x, next);
    y = next;
    k = -k;
  }
  return path.detach();
}

function drawCables(c: SkCanvas, x0: number, x1: number, y0: number, y1: number, r: number, color: string, alpha: number): void {
  const paint = paintOf(color, alpha, r * 0.047);
  for (let x = x0; x < x1; x += r * 0.5) {
    c.drawPath(cableColumn(x, y0, y1, r, 1), paint);
    c.drawPath(cableColumn(x, y0, y1, r, -1), paint);
  }
}

function baffleCount(a: number, r: number): number {
  return Math.max(3, Math.round((1.78 * a) / (0.73 * r)));
}

function baffleColor(item: WearItem, index: number, fallback: string): string {
  const list = item.colorway.baffles;
  if (!list || list.length === 0) {
    return fallback;
  }
  return list[index % list.length] ?? fallback;
}

// A loop around each front leg. The arch sits just above the hip and the oval runs
// down through the hem, so the leg leaves the coat instead of showing as a window on the body.
function rainForeLoops(xs: number[], geom: Geom): SkPath[] {
  const rx = Math.max(geom.legWidth * 1.05, 6);
  const ry = Math.max(geom.legWidth * 1.15, 7);
  const y = geom.hipY + ry * 0.15;
  return xs.map((x) => ovalPath(x, y, rx, ry));
}

// The front hem hangs just below the fore hips. Higher than that, the leg loops close on the belly.
function foreHem(p: Pt, geom: Geom, pose: JacketPose): Pt {
  return poolHem({ x: p.x, y: Math.max(p.y, geom.hipY + geom.legWidth * 0.6) }, geom, pose);
}

function punchHoles(path: SkPath, holes: SkPath[]): SkPath {
  let out = path;
  for (const hole of holes) {
    out = Skia.Path.MakeFromOp(out, hole, PathOp.Difference) ?? out;
  }
  return out;
}

function sideSilhouette(geom: Geom, item: WearItem, breath: number, pose: JacketPose): SkPath {
  const f = jacketFrame(geom, breath);
  const rx = f.a + f.o;
  const ry = f.b + f.o;
  const path = Skia.PathBuilder.Make();
  if (item.shape === 'puffer') {
    const ur = -0.86;
    const uf = 0.92;
    const ub = 0.84;
    const n = baffleCount(f.a, f.r);
    const ut = Array.from({ length: n + 1 }, (_, i) => ur + ((uf - ur) * i) / n);
    const ubt = Array.from({ length: n + 1 }, (_, i) => ur + ((ub - ur) * i) / n);
    const start = f.top(ut[0] ?? ur);
    path.moveTo(start.x, start.y);
    for (let i = 0; i < n; i += 1) {
      const mid = ((ut[i] ?? ur) + (ut[i + 1] ?? uf)) / 2;
      const tip = f.top(mid, f.o + 0.29 * f.b);
      const end = f.top(ut[i + 1] ?? uf);
      path.quadTo(tip.x, tip.y, end.x, end.y);
    }
    addLine(path, arcPts(topAng(uf), botAng(ubt[n] ?? ub), rx, ry, f.cy, 8));
    for (let i = n; i > 0; i -= 1) {
      const mid = ((ubt[i] ?? ub) + (ubt[i - 1] ?? ur)) / 2;
      const tip = f.bot(mid, f.o + 0.25 * f.b);
      const end = f.bot(ubt[i - 1] ?? ur);
      path.quadTo(tip.x, tip.y, end.x, end.y);
    }
    const rear = f.top(ur);
    path.quadTo(rear.x - 0.2 * f.b, f.cy, start.x, start.y);
    path.close();
    return path.detach();
  }
  if (item.shape === 'vest') {
    const p0 = f.top(-0.18);
    path.moveTo(p0.x, p0.y);
    addLine(path, arcPts(topAng(-0.18), topAng(0.93), rx, ry, f.cy));
    addLine(path, arcPts(topAng(0.93), botAng(0.72), rx, ry, f.cy, 8));
    addLine(path, arcPts(botAng(0.72), botAng(-0.18), rx, ry, f.cy));
    const back = f.bot(-0.18);
    path.quadTo(back.x - 0.17 * f.b, f.cy, p0.x, p0.y);
    path.close();
    return path.detach();
  }
  if (item.shape === 'raincoat') {
    const o2 = 0.125 * f.b;
    const rear = { x: -f.a - 0.25 * f.b, y: f.cy - 0.1 * f.b };
    const t0 = f.top(-0.82, o2);
    const hemA = foreHem({ x: 0.97 * f.a, y: f.cy + 0.35 * f.b }, geom, pose);
    const hemB = foreHem({ x: 0.3 * f.a, y: f.cy + 0.5 * f.b }, geom, pose);
    const hemC = poolHem({ x: -0.3 * f.a, y: f.cy + 0.58 * f.b }, geom, pose);
    const hemD = poolHem({ x: rear.x - 0.17 * f.b, y: f.cy + 0.66 * f.b }, geom, pose);
    const hemE = poolHem({ x: rear.x - 0.25 * f.b, y: f.cy + 0.4 * f.b }, geom, pose);
    path.moveTo(rear.x, rear.y);
    path.quadTo(rear.x - 0.04 * f.b, t0.y - 0.08 * f.b, t0.x, t0.y);
    addLine(path, arcPts(topAng(-0.82), topAng(0.84), f.a + o2, f.b + o2, f.cy));
    path.quadTo(f.a + 0.33 * f.b, f.cy - 0.25 * f.b, hemA.x, hemA.y);
    path.quadTo(hemB.x, hemB.y, hemC.x, hemC.y);
    path.quadTo(hemD.x, hemD.y, hemE.x, hemE.y);
    path.quadTo(rear.x - 0.25 * f.b, rear.y + 0.08 * f.b, rear.x, rear.y);
    path.close();
    // One loop at the fore hip. The coat is drawn after the legs, so both front legs pass through it.
    return punchHoles(path.detach(), rainForeLoops([geom.foreX], geom));
  }
  const ur = item.shape === 'hoodie' ? -0.82 : -0.7;
  const p0 = f.top(ur);
  path.moveTo(p0.x, p0.y);
  addLine(path, arcPts(topAng(ur), topAng(0.93), rx, ry, f.cy));
  addLine(path, arcPts(topAng(0.93), botAng(0.82), rx, ry, f.cy, 8));
  if (item.shape === 'hoodie') {
    path.quadTo(0.3 * f.a, f.cy + f.b + f.o + 0.04 * f.b, -0.2 * f.a, f.cy + 0.92 * f.b);
    path.quadTo(-0.62 * f.a, f.cy + 0.82 * f.b, p0.x + 0.04 * f.b, f.cy + 0.42 * f.b);
  } else {
    path.quadTo(0.35 * f.a, f.cy + f.b + f.o, -0.15 * f.a, f.cy + 0.72 * f.b);
    path.quadTo(-0.5 * f.a, f.cy + 0.6 * f.b, p0.x + 0.04 * f.b, f.cy + 0.3 * f.b);
  }
  path.quadTo(p0.x - 0.12 * f.b, f.cy - 0.2 * f.b, p0.x, p0.y);
  path.close();
  return path.detach();
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
  if (shape === 'raincoat') {
    ry *= 0.6;
    const hem = pass === 'front' ? Math.max(cy + ry, geom.hipY + geom.legWidth * 0.6) : cy + ry;
    const left = poolHem({ x: cx - rx * 1.1, y: hem }, geom, pose);
    const right = poolHem({ x: cx + rx * 1.1, y: hem }, geom, pose);
    const flared = Skia.PathBuilder.Make();
    flared.moveTo(cx - rx * 0.7, cy - ry);
    flared.lineTo(cx + rx * 0.7, cy - ry);
    flared.lineTo(right.x, right.y);
    flared.lineTo(left.x, left.y);
    flared.close();
    if (pass === 'back') {
      return flared.detach();
    }
    // Same lateral spacing the front-view legs use (`bodyH * 0.3`).
    const reach = geom.bodyH * 0.3;
    return punchHoles(flared.detach(), rainForeLoops([-reach, reach], geom));
  }
  let path = ovalPath(cx, cy, rx, ry);
  if (shape === 'sweater' || shape === 'hoodie') {
    path = clipTo(path, rectPath(cx - rx * 2, cy - ry, rx * 4, ry * 1.7));
  }
  return path;
}

function drawJacketDetails(c: SkCanvas, geom: Geom, item: WearItem, path: SkPath, breath: number, pose: JacketPose): void {
  const f = jacketFrame(geom, breath);
  const r = f.r;
  const u = r * 0.1;
  const body = resolvePart(item, 'body', u);
  const pass = pose.pass ?? 'side';
  const tex = textureAlpha(body.pattern);
  if (item.shape === 'puffer') {
    if (pass !== 'side') {
      const seam = shade(body.color, 0.28);
      strokeLine(c, -geom.bodyH, f.cy - f.b * 0.25, geom.bodyH, f.cy - f.b * 0.25, seam, r * 0.06, tex);
      strokeLine(c, -geom.bodyH, f.cy + f.b * 0.35, geom.bodyH, f.cy + f.b * 0.35, seam, r * 0.06, tex);
      return;
    }
    const n = baffleCount(f.a, r);
    const ur = -0.86;
    const uf = 0.92;
    const ub = 0.84;
    for (let i = 0; i < n; i += 1) {
      const u0 = ur + ((uf - ur) * i) / n;
      const u1 = ur + ((uf - ur) * (i + 1)) / n;
      const color = baffleColor(item, i, body.color);
      const x0 = i === 0 ? f.top(u0).x - r : f.top(u0).x;
      const x1 = i === n - 1 ? f.a + f.b : f.top(u1).x;
      if (!body.pattern || (item.colorway.baffles?.length ?? 0) > 0) {
        c.drawRect(Skia.XYWHRect(x0, f.cy - f.b * 2, Math.max(1, x1 - x0), f.b * 4), paintOf(color));
      }
      const mid = (u0 + u1) / 2;
      const tip = f.top(mid, f.o + 0.04 * f.b);
      c.drawPath(ovalArc(tip.x, tip.y + r * 0.08, r * 0.22, r * 0.08, 200, 140), roundStroke(light(color, 0.5), 0.9 * tex, r * 0.09));
      c.drawPath(
        ovalArc(tip.x, f.cy + f.b * 0.65, r * 0.18, r * 0.06, 20, 140),
        roundStroke(shade(color, 0.18), 0.6 * tex, r * 0.07),
      );
    }
    for (let i = 1; i < n; i += 1) {
      const ut = ur + ((uf - ur) * i) / n;
      const ubt = ur + ((ub - ur) * i) / n;
      const a = f.top(ut);
      const b = f.bot(ubt);
      const color = baffleColor(item, i, body.color);
      const seam = Skia.PathBuilder.Make();
      seam.moveTo(a.x, a.y);
      seam.quadTo((a.x + b.x) / 2 - 0.12 * f.b, f.cy, b.x, b.y);
      c.drawPath(seam.detach(), paintOf(shade(color, 0.28), tex, r * 0.06));
    }
    return;
  }
  if (item.shape === 'sweater' || item.shape === 'hoodie') {
    const rib = resolvePart(item, 'rib', u);
    if (pass === 'side') {
      const rear = item.shape === 'hoodie' ? -0.82 : -0.7;
      const p0 = f.top(rear);
      drawCables(c, p0.x + r * 0.4, f.top(0.93).x, f.cy - f.b - r * 0.2, f.cy + f.b, r, shade(body.color, 0.2), tex);
    } else {
      drawCables(c, -f.b, f.b, f.cy - f.b, f.cy + f.b * 0.7, r, shade(body.color, 0.2), tex);
    }
    const hem = Skia.PathBuilder.Make();
    const b1 = pass === 'side' ? f.bot(0.82) : { x: f.b, y: f.cy + f.b * 0.7 };
    const h1 = pass === 'side' ? { x: -0.15 * f.a, y: f.cy + (item.shape === 'hoodie' ? 0.92 : 0.72) * f.b } : { x: -f.b, y: f.cy + f.b * 0.7 };
    hem.moveTo(b1.x, b1.y);
    hem.quadTo(0, f.cy + f.b, h1.x, h1.y);
    const hemPath = hem.detach();
    const width = item.shape === 'hoodie' ? r * 0.23 : r * 0.27;
    c.drawPath(hemPath, edgePaint(rib.color, 1, width));
    c.drawPath(hemPath, ribDash(rib.color, width, r, tex));
    const hi0 = f.top(-0.5, -0.17 * f.b);
    const hi1 = f.top(0.6, -0.17 * f.b);
    const shine = Skia.PathBuilder.Make();
    shine.moveTo(hi0.x, hi0.y);
    shine.quadTo(0, f.cy - f.b - 0.12 * f.b, hi1.x, hi1.y);
    c.drawPath(shine.detach(), paintOf(light(body.color, 0.35), 0.7 * tex, r * 0.07));
    if (item.shape === 'hoodie' && pass !== 'back') {
      drawHoodiePocket(c, f, item, pass === 'front');
    }
    return;
  }
  if (item.shape === 'vest') {
    const quilt = Skia.PathBuilder.Make();
    const step = r * 0.33;
    for (let x = -f.a - f.b; x < f.a + f.b; x += step) {
      quilt.moveTo(x, f.cy - f.b * 1.4);
      quilt.lineTo(x + f.b * 2, f.cy + f.b * 1.4);
      quilt.moveTo(x, f.cy + f.b * 1.4);
      quilt.lineTo(x + f.b * 2, f.cy - f.b * 1.4);
    }
    c.drawPath(quilt.detach(), paintOf(shade(body.color, 0.28), 0.8 * tex, r * 0.04));
    c.drawPath(path, edgePaint(shade(body.color, 0.2), tex, r * 0.17));
    const zx = pass === 'side' ? 0.84 * f.a : 0;
    strokeLine(c, zx, f.cy - 0.5 * f.b, zx - 0.08 * f.b, f.cy + 0.9 * f.b, '#e0b43c', r * 0.07, tex);
    const pull = Skia.PathBuilder.Make();
    pull.moveTo(zx - r * 0.07, f.cy - 0.5 * f.b);
    pull.lineTo(zx + r * 0.08, f.cy - 0.5 * f.b);
    pull.lineTo(zx + r * 0.05, f.cy - 0.5 * f.b + r * 0.23);
    pull.lineTo(zx - r * 0.05, f.cy - 0.5 * f.b + r * 0.23);
    pull.close();
    c.drawPath(pull.detach(), paintOf('#e0b43c'));
    return;
  }
  if (item.shape === 'raincoat') {
    const hem = Skia.PathBuilder.Make();
    if (pass === 'side') {
      const rear = { x: -f.a - 0.25 * f.b, y: f.cy - 0.1 * f.b };
      const hemA = foreHem({ x: 0.97 * f.a, y: f.cy + 0.35 * f.b }, geom, pose);
      const hemB = foreHem({ x: 0.3 * f.a, y: f.cy + 0.5 * f.b }, geom, pose);
      const hemC = poolHem({ x: -0.3 * f.a, y: f.cy + 0.58 * f.b }, geom, pose);
      const hemD = poolHem({ x: rear.x - 0.17 * f.b, y: f.cy + 0.66 * f.b }, geom, pose);
      const hemE = poolHem({ x: rear.x - 0.25 * f.b, y: f.cy + 0.4 * f.b }, geom, pose);
      hem.moveTo(hemA.x, hemA.y);
      hem.quadTo(hemB.x, hemB.y, hemC.x, hemC.y);
      hem.quadTo(hemD.x, hemD.y, hemE.x, hemE.y);
    } else {
      const oval = panelOval(geom, pass === 'back' ? 'back' : 'front');
      const ry = oval.ry * 0.6;
      const y = pass === 'back' ? oval.cy + ry : Math.max(oval.cy + ry, geom.hipY + geom.legWidth * 0.6);
      hem.moveTo(oval.cx - oval.rx * 1.1, y);
      hem.lineTo(oval.cx + oval.rx * 1.1, y);
    }
    const hemPath = hem.detach();
    c.drawPath(hemPath, edgePaint(shade(body.color, 0.25), tex, r * 0.15));
    const strip = resolvePart(item, 'strip', u).color;
    c.save();
    c.translate(0, -0.33 * f.b);
    c.drawPath(hemPath, edgePaint(shade(body.color, 0.35), tex, r * 0.15));
    c.drawPath(hemPath, edgePaint(strip, 1, r * 0.11));
    c.drawPath(hemPath, edgePaint('#ffffff', 0.8, r * 0.033));
    c.restore();
    const gloss = Skia.PathBuilder.Make();
    const g0 = f.top(-0.62, -0.2 * f.b);
    const g1 = f.top(0.35, -0.2 * f.b);
    gloss.moveTo(g0.x, g0.y);
    gloss.quadTo(-0.1 * f.a, f.cy - f.b, g1.x, g1.y);
    c.drawPath(gloss.detach(), paintOf('#ffffff', 0.55 * tex, r * 0.1));
    if (pass !== 'back' && (pose.belly ?? 0) < 0.45) {
      for (const at of [
        { x: 0.86 * f.a, y: f.cy - 0.3 * f.b },
        { x: 0.9 * f.a, y: f.cy + 0.02 * f.b },
      ]) {
        c.save();
        c.translate(at.x, at.y);
        c.rotate(-20, 0, 0);
        c.drawRRect(Skia.RRectXY(Skia.XYWHRect(0, -r * 0.055, r * 0.23, r * 0.11), r * 0.05, r * 0.05), paintOf('#7A4A22'));
        c.restore();
        strokeLine(c, at.x - r * 0.2, at.y, at.x, at.y, shade(body.color, 0.45), r * 0.04, tex);
      }
    }
  }
}

function drawHoodiePocket(c: SkCanvas, f: JFrame, item: WearItem, front: boolean): void {
  const u = f.r * 0.1;
  const pocket = resolvePart(item, 'pocket', u);
  const body = resolvePart(item, 'body', u);
  const x0 = front ? -f.b * 0.35 : -0.12 * f.a;
  const x1 = front ? f.b * 0.35 : 0.42 * f.a;
  const y0 = f.cy + 0.1 * f.b;
  const y1 = f.cy + 0.62 * f.b;
  const path = Skia.PathBuilder.Make();
  path.moveTo(x0, y0);
  path.lineTo(x1, y0);
  path.quadTo(x1 + f.r * 0.12, y0, x1 + f.r * 0.08, y1);
  path.lineTo(x0 + f.r * 0.04, y1);
  path.quadTo(x0 - f.r * 0.12, (y0 + y1) / 2, x0, y0);
  path.close();
  const built = path.detach();
  paintShape(c, built, pocket.color, undefined, () => {
    const stitch = item.colorway.d ?? pocket.color;
    const paint = dashed(stitch, f.r * 0.04, f.r * 0.06, f.r * 0.06, textureAlpha(body.pattern));
    c.drawLine(x0 + f.r * 0.06, y0 + f.r * 0.08, x1 - f.r * 0.04, y0 + f.r * 0.08, paint);
  });
  c.drawPath(built, edgePaint(shade(body.color, 0.3), 1, f.r * 0.05));
}

export function drawJacket(c: SkCanvas, geom: Geom, item: WearItem, breath: number, fur: string, pose: JacketPose = {}): void {
  const pass = pose.pass ?? 'side';
  const alpha = pose.alpha ?? 1;
  jacketAlpha(c, alpha, () => {
    const path = pass === 'side' ? sideSilhouette(geom, item, breath, pose) : panelPath(geom, item, pass, pose);
    const body = resolvePart(item, 'body', geom.headR * 0.1);
    paintShape(c, path, body.color, fur, () => drawJacketDetails(c, geom, item, path, breath, pose), 1, body.pattern);
  });
}

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
    if (item.shape !== 'hoodie' || belly >= 0.45) {
      return;
    }
    const throat = torsoPoint(geom, theta, dy, geom.bodyLen / 2 - 14, geom.bodyY - 2);
    const hang = swing * dir;
    const len = geom.headR * 0.4;
    const string = light(item.colorway.c, 0.55);
    const tip = item.colorway.d ?? item.colorway.c;
    for (const sign of [-1, 1]) {
      const end = {
        x: throat.x + Math.sin(hang + sign * 0.25) * len * 0.35 + sign * geom.headR * 0.06,
        y: throat.y + Math.cos(hang) * len,
      };
      strokeLine(c, throat.x + sign * 2, throat.y, end.x, end.y, string, 1.4);
      const axis = { x: end.x - throat.x, y: end.y - throat.y };
      const al = Math.hypot(axis.x, axis.y) || 1;
      const ux = axis.x / al;
      const uy = axis.y / al;
      const cap = { x: end.x + ux * geom.headR * 0.08, y: end.y + uy * geom.headR * 0.08 };
      paintShape(c, polygon(capsulePts(end, cap, geom.headR * 0.045)), tip, fur);
    }
  });
}

function hoodCenter(base: Pt, perp: Pt, along: Pt, r: number, neckWidth: number): Pt {
  return offset(offset(base, along, r * 0.08), perp, -neckWidth * 0.35);
}

export function drawHood(c: SkCanvas, base: Pt, perp: Pt, along: Pt, item: WearItem, r: number, neckWidth: number, fur: string, alpha = 1): void {
  jacketAlpha(c, alpha, () => {
    const blob = r * 0.55;
    const center = hoodCenter(base, perp, along, r, neckWidth);
    const body = resolvePart(item, 'body', r * 0.1);
    const lining = resolvePart(item, 'lining', r * 0.1);
    for (const ex of [-0.42, 0.12]) {
      paintShape(c, circlePath(center.x + r * ex, center.y - r * 0.52, r * 0.2), body.color, fur);
      paintShape(c, circlePath(center.x + r * ex, center.y - r * 0.52, r * 0.1), lining.color);
    }
    paintShape(c, circlePath(center.x, center.y, blob), body.color, fur, () => {
      c.drawPath(ovalArc(center.x, center.y, blob * 0.5, blob * 0.4, 30, 130), roundStroke(shade(body.color, 0.25), textureAlpha(body.pattern), blob * 0.08));
      c.drawPath(ovalArc(center.x, center.y - blob * 0.35, blob * 0.45, blob * 0.2, 200, 120), roundStroke('#ffffff', 0.5, blob * 0.08));
    }, 1, body.pattern);
  });
}

function drawRainHood(c: SkCanvas, base: Pt, perp: Pt, along: Pt, item: WearItem, r: number, neckWidth: number, fur: string): void {
  const center = hoodCenter(base, perp, along, r, neckWidth);
  const body = resolvePart(item, 'body', r * 0.1);
  const lining = resolvePart(item, 'lining', r * 0.1);
  paintShape(c, ovalPath(center.x, center.y, r * 0.62, r * 0.5), body.color, fur, () => {
    c.drawPath(ovalArc(center.x, center.y - r * 0.22, r * 0.4, r * 0.18, 200, 140), roundStroke('#ffffff', 0.5, r * 0.07));
  });
  paintShape(c, ovalPath(center.x, center.y + r * 0.04, r * 0.42, r * 0.32), lining.color, fur);
}

export function drawJacketCollar(c: SkCanvas, base: Pt, perp: Pt, along: Pt, item: WearItem, r: number, neckWidth: number, fur: string): void {
  if (item.shape === 'hoodie') {
    return;
  }
  if (item.shape === 'raincoat') {
    drawRainHood(c, base, perp, along, item, r, neckWidth, fur);
    return;
  }
  const at = offset(base, along, r * sizes.collarRise);
  const reach = neckWidth * 0.55;
  const a = offset(at, perp, -reach);
  const b = offset(at, perp, reach);
  const mid = { x: at.x - along.x * r * 0.18, y: at.y - along.y * r * 0.18 };
  const part = item.shape === 'sweater' ? 'rib' : item.shape === 'puffer' || item.shape === 'vest' ? 'collar' : 'body';
  const fill = resolvePart(item, part, r * 0.1);
  const thick = r * (item.shape === 'puffer' ? 0.44 : item.shape === 'sweater' ? 0.4 : item.shape === 'vest' ? 0.36 : 0.3);
  outlinedQuad(c, a, mid, b, fill.color, thick, fur);
  const line = Skia.PathBuilder.Make();
  line.moveTo(a.x, a.y);
  line.quadTo(mid.x, mid.y, b.x, b.y);
  const built = line.detach();
  if (item.shape === 'sweater') {
    c.drawPath(built, ribDash(fill.color, thick * 0.45, r, 1));
  } else if (item.shape === 'puffer') {
    const hi = Skia.PathBuilder.Make();
    const lift = thick * 0.22;
    hi.moveTo(a.x + along.x * lift, a.y + along.y * lift);
    hi.quadTo(mid.x + along.x * lift, mid.y + along.y * lift, b.x + along.x * lift, b.y + along.y * lift);
    c.drawPath(hi.detach(), roundStroke(light(fill.color, 0.5), 0.7, thick * 0.25));
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

function diamondPath(x: number, y: number, s: number): SkPath {
  const path = Skia.PathBuilder.Make();
  path.moveTo(x, y - s);
  path.lineTo(x + s, y);
  path.lineTo(x, y + s);
  path.lineTo(x - s, y);
  path.close();
  return path.detach();
}

function heartPath(x: number, y: number, s: number): SkPath {
  const d = `M${x} ${y + s * 0.9} C${x - s * 1.3} ${y + s * 0.1} ${x - s * 0.9} ${y - s * 0.9} ${x} ${y - s * 0.35} C${x + s * 0.9} ${y - s * 0.9} ${x + s * 1.3} ${y + s * 0.1} ${x} ${y + s * 0.9} Z`;
  return Skia.Path.MakeFromSVGString(d) ?? diamondPath(x, y, s);
}

function collarShine(c: SkCanvas, a: Pt, mid: Pt, b: Pt, color: string): void {
  const path = Skia.PathBuilder.Make();
  path.moveTo(a.x, a.y);
  path.quadTo(mid.x, mid.y, b.x, b.y);
  c.drawPath(path.detach(), paintOf(light(color, 0.3), 0.8, 1.4));
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
    const band = resolvePart(item, 'band', r * 0.1);
    outlinedQuad(c, a, mid, b, band.color, r * sizes.collarBand, fur);
    collarShine(c, a, mid, b, band.color);
    if (studs) {
      const charm = resolvePart(item, 'charm', r * 0.1);
      paintShape(c, diamondPath(at.x, at.y, r * sizes.collarStud), charm.color, fur);
    }
    return offset(at, perp, r * 0.1);
  }
  const { a, b, mid, lower } = bandEnds(chin, perp, along, r, r * 0.62, view, pitch);
  const band = resolvePart(item, 'band', r * 0.1);
  outlinedQuad(c, a, mid, b, band.color, r * sizes.collarBand, fur);
  collarShine(c, a, mid, b, band.color);
  if (studs) {
    const charm = resolvePart(item, 'charm', r * 0.1);
    const across = spanDir(perp, view, pitch);
    for (let i = -1; i <= 1; i += 1) {
      const at = offset(chin, across, i * r * 0.22);
      paintShape(c, diamondPath(at.x, at.y, r * sizes.collarStud), charm.color, fur);
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
  const bandPattern = patternPaint(item, 'band', r * 0.1);
  if (bandPattern) {
    paintShape(c, polygon(capsulePts(a, b, r * 0.16)), color, fur, undefined, 1, bandPattern);
  } else {
    outlinedQuad(c, a, mid, b, color, r * sizes.scarfThick, fur);
    const shine = Skia.PathBuilder.Make();
    shine.moveTo(a.x, a.y);
    shine.quadTo(mid.x, mid.y, b.x, b.y);
    const shinePath = shine.detach();
    c.drawPath(shinePath, paintOf(light(color, 0.4), 0.8, r * 0.06));
    c.drawPath(shinePath, dashed(shade(color, 0.2), r * sizes.scarfThick, r * 0.04, r * 0.08, 0.55));
    const across = { x: b.x - a.x, y: b.y - a.y };
    for (let i = 0; i < 3; i += 1) {
      const t = 0.25 + i * 0.22;
      const at = { x: a.x + across.x * t, y: a.y + across.y * t };
      strokeLine(c, at.x - perp.x * r * 0.12, at.y - perp.y * r * 0.12, at.x + perp.x * r * 0.16, at.y + perp.y * r * 0.16, stripe, 1.5);
    }
    const knit = Skia.PathBuilder.Make();
    knit.moveTo(a.x, a.y);
    knit.quadTo(mid.x, mid.y, b.x, b.y);
    c.drawPath(knit.build(), dashed(shadow, 1.2, 2, 2));
  }
  if (belly > 0.45) {
    return;
  }
  const dir = hangVector(hang);
  const sitOff = (hang.sit ?? 0) * r * 0.05;
  const knot = {
    x: knotAt.x + dir.x * r * 0.08 + along.x * sitOff,
    y: knotAt.y + dir.y * r * 0.08 + along.y * sitOff,
  };
  paintShape(c, ovalPath(knot.x, knot.y, r * sizes.scarfKnotW, r * sizes.scarfKnotH), color, fur);
  const side = { x: -dir.y, y: dir.x };
  const tail = (spread: number) => {
    const start = { x: knot.x + side.x * spread, y: knot.y + side.y * spread };
    const length = r * sizes.scarfTailLen;
    const width = r * sizes.scarfTailHalf;
    const end = { x: start.x + dir.x * length, y: start.y + dir.y * length };
    paintShape(c, polygon(capsulePts(start, end, width)), color, fur, () => {
      if (item.colorway.pattern) {
        return;
      }
      const band = { x: start.x + dir.x * length * 0.45, y: start.y + dir.y * length * 0.45 };
      strokeLine(c, band.x - side.x * width, band.y - side.y * width, band.x + side.x * width, band.y + side.y * width, stripe, 1.6);
      for (let i = -1; i <= 1; i += 1) {
        const tip = { x: end.x + side.x * i * width * 0.7, y: end.y + side.y * i * width * 0.7 };
        strokeLine(c, tip.x, tip.y, tip.x + dir.x * r * 0.08, tip.y + dir.y * r * 0.08, shadow, 1.1);
      }
    }, 1, patternPaint(item, 'tail', r * 0.1));
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
  const lying = flat > 0.45;
  const hangK = lying ? Math.max(1 - sizes.neckFlatHang * flat, sizes.neckLieHang) : 1 - sizes.neckFlatHang * flat;
  const turned = flat > 0.45 ? 0 : view;
  const hangDir = dropDir(perp, turned, pitch);
  if (item.shape === 'collar') {
    const accent = item.colorway.accent ?? 'tag';
    const lower = drawCollarBand(c, chin, perp, along, item, r, fur, accent === 'studs', turned, pitch);
    const hang = {
      x: lower.x + hangDir.x * r * 0.28 * hangK + sway * r * hangK,
      y: lower.y + hangDir.y * r * 0.28 * hangK,
    };
    const charm = resolvePart(item, 'charm', r * 0.1);
    const ring = r * sizes.collarRing;
    c.drawCircle(hang.x, hang.y, ring, edgePaint(outlineOf(charm.color), 1, 1.4));
    const drop = { x: hang.x + hangDir.x * (ring + r * 0.08), y: hang.y + hangDir.y * (ring + r * 0.08) };
    if (accent === 'bell') {
      const bellR = r * sizes.collarCharm * (0.55 + 0.45 * hangK);
      const at = { x: drop.x + hangDir.x * bellR, y: drop.y + hangDir.y * bellR };
      paintShape(c, circlePath(at.x, at.y, bellR), charm.color, fur);
      strokeLine(c, at.x - bellR * 0.8, at.y - bellR * 0.15, at.x + bellR * 0.8, at.y - bellR * 0.15, outlineOf(charm.color), 1.3);
      strokeLine(c, at.x, at.y + bellR * 0.2, at.x, at.y + bellR * 0.85, outlineOf(charm.color), 1.8);
      c.drawPath(ovalArc(at.x - bellR * 0.2, at.y - bellR * 0.45, bellR * 0.4, bellR * 0.22, 210, 90), roundStroke('#ffffff', 0.75, Math.max(0.6, bellR * 0.18)));
    } else {
      const s = r * sizes.collarCharm * (0.55 + 0.45 * hangK);
      const at = { x: drop.x + hangDir.x * s, y: drop.y + hangDir.y * s };
      paintShape(c, heartPath(at.x, at.y, s), charm.color, fur, () => {
        c.drawPath(ovalArc(at.x - s * 0.35, at.y - s * 0.35, s * 0.35, s * 0.2, 210, 80), roundStroke('#ffffff', 0.7, Math.max(0.6, s * 0.12)));
      });
    }
    return;
  }
  if (item.shape === 'bowtie') {
    drawBowTie(c, chin, perp, along, item, r, fur, turned, pitch, hang, flat, hangK, hangDir);
    return;
  }
  if (item.shape === 'bandana') {
    drawBandana(c, chin, perp, along, item, sway + (hang.swing ?? 0) * (hang.dir ?? 1), r, fur, view, lying);
    return;
  }
  if (item.shape === 'bow') {
    const knot = flat > 0.45 ? offset(chin, perp, r * sizes.collarFlatDrop) : chin;
    const reach = r * 0.34 * (flat > 0.45 ? 0.55 : 1);
    if (flat > 0.45) {
      outlinedQuad(c, offset(knot, along, -reach), offset(knot, perp, r * 0.08), offset(knot, along, reach * 0.4), item.colorway.c, r * 0.08, fur);
    } else {
      const { a, b, mid } = bandEnds(chin, perp, along, r, reach, turned, pitch);
      outlinedQuad(c, a, mid, b, item.colorway.c, r * 0.08, fur);
    }
    const loop = resolvePart(item, 'loop', r * 0.1);
    const spread = spanDir(perp, turned, pitch);
    const at = (s: number, x: number, y: number): Pt => ({
      x: knot.x + spread.x * s * x * hangK + hangDir.x * y * hangK,
      y: knot.y + spread.y * s * x * hangK + hangDir.y * y * hangK,
    });
    for (const s of [-1, 1]) {
      const tail = Skia.PathBuilder.Make();
      const t0 = at(s, 0, 0);
      tail.moveTo(t0.x, t0.y);
      tail.lineTo(at(s, 0.12 * r, 0.62 * r).x, at(s, 0.12 * r, 0.62 * r).y);
      tail.lineTo(at(s, 0.26 * r, 0.52 * r).x, at(s, 0.26 * r, 0.52 * r).y);
      tail.lineTo(at(s, 0.36 * r, 0.66 * r).x, at(s, 0.36 * r, 0.66 * r).y);
      tail.lineTo(at(s, 0.2 * r, 0).x, at(s, 0.2 * r, 0).y);
      tail.close();
      paintShape(c, tail.detach(), shade(loop.color, 0.08), fur);
    }
    for (const s of [-1, 1]) {
      const wing = Skia.PathBuilder.Make();
      const k = at(s, 0, 0);
      const p1 = at(s, 0.35 * r, -0.55 * r);
      const p2 = at(s, 0.75 * r, -0.4 * r);
      const p3 = at(s, 0.62 * r, 0.05 * r);
      const p4 = at(s, 0.5 * r, 0.32 * r);
      const p5 = at(s, 0.2 * r, 0.12 * r);
      wing.moveTo(k.x, k.y);
      wing.cubicTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      wing.cubicTo(p4.x, p4.y, p5.x, p5.y, k.x, k.y);
      wing.close();
      paintShape(c, wing.detach(), loop.color, fur, () => {
        const fold = Skia.PathBuilder.Make();
        const f0 = at(s, 0.12 * r, -0.02 * r);
        const f1 = at(s, 0.4 * r, -0.25 * r);
        const f2 = at(s, 0.55 * r, -0.05 * r);
        fold.moveTo(f0.x, f0.y);
        fold.quadTo(f1.x, f1.y, f2.x, f2.y);
        c.drawPath(fold.detach(), paintOf(shade(loop.color, 0.22), textureAlpha(loop.pattern), r * 0.05));
      }, 1, loop.pattern);
    }
    paintShape(c, ovalPath(knot.x, knot.y, r * 0.13 * hangK, r * 0.15 * hangK), shade(loop.color, 0.15), fur);
    return;
  }
  if (item.shape === 'scarf') {
    drawScarf(c, chin, perp, along, item, r, fur, view, pitch, hang);
    return;
  }
  warnShape(item);
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
function drawBandana(
  c: SkCanvas,
  chin: Pt,
  perp: Pt,
  along: Pt,
  item: WearItem,
  sway: number,
  r: number,
  fur: string,
  view: number,
  lying = false,
): void {
  const flat = neckFlat(along);
  const hangK = lying ? Math.max(1 - sizes.neckFlatHang * flat, sizes.neckLieHang) : 1 - sizes.neckFlatHang * flat;
  const deep = mix(item.colorway.c, '#000000', 0.2);
  const bandColor = mix(item.colorway.c, '#000000', 0.12);

  // Band ends. Lying down: a short strap under the jaw. The muzzle end stays short so the
  // cloth hangs onto the chest instead of pointing out through the whiskers.
  let a: Pt;
  let b: Pt;
  let mid: Pt;
  if (lying) {
    const at = offset(chin, perp, r * sizes.collarFlatDrop);
    a = offset(at, along, -r * sizes.bandanaBand * 0.42);
    b = offset(at, along, r * sizes.bandanaBand * 0.2);
    mid = offset(at, perp, r * 0.06);
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
    const tail = (back: number, down: number) => {
      const end = {
        x: a.x - along.x * back * r + perp.x * down * r,
        y: a.y - along.y * back * r + perp.y * down * r,
      };
      paintShape(c, polygon(capsulePts(a, end, r * 0.07)), item.colorway.c, fur, undefined, knotK);
    };
    if (lying) {
      tail(sizes.bandanaKnot, sizes.bandanaKnot * 0.35);
      tail(sizes.bandanaKnot * 0.45, sizes.bandanaKnot * 0.9);
    } else {
      const stand = (dx: number, dy: number) =>
        paintShape(c, polygon(capsulePts(a, { x: a.x + dx * r, y: a.y + dy * r }, r * 0.07)), item.colorway.c, fur, undefined, knotK);
      stand(-sizes.bandanaKnot, sizes.bandanaKnot * 0.6);
      stand(-sizes.bandanaKnot * 0.4, sizes.bandanaKnot * 1.1);
    }
    paintShape(c, circlePath(a.x, a.y, r * 0.1), bandColor, fur, undefined, knotK);
  }

  // The cloth hangs from the front part of the band: the throat half in side view, the whole width from the front.
  // Sleep hangs the triangle straight down from the middle of the strap. Following the neck
  // put the point out through the muzzle once the head was lying on it.
  const start = lying ? 0.15 : sizes.bandanaClothFrom * (1 - view) + 0.08 * view;
  const end = lying ? 0.9 : sizes.bandanaClothTo - 0.04 * view;
  const top1 = lerpPt(a, b, start);
  const top2 = lerpPt(a, b, end);
  const topMid = lerpPt(top1, top2, 0.5);
  const lieDrop = r * sizes.bandanaLieDrop;
  const tip = lying
    ? {
        x: topMid.x + perp.x * lieDrop + along.x * sway * r * 0.35,
        y: topMid.y + perp.y * lieDrop + along.y * sway * r * 0.35,
      }
    : {
        x: topMid.x + r * 0.18 * (1 - view) * hangK + sway * r * 1.2 * hangK,
        y: topMid.y + r * sizes.bandanaDrop * hangK,
      };
  const bow = r * 0.1;
  const cloth = Skia.PathBuilder.Make();
  cloth.moveTo(top1.x, top1.y);
  cloth.lineTo(top2.x, top2.y);
  cloth.quadTo((top2.x + tip.x) / 2 + bow, (top2.y + tip.y) / 2, tip.x, tip.y);
  cloth.quadTo((top1.x + tip.x) / 2 - bow, (top1.y + tip.y) / 2, top1.x, top1.y);
  cloth.close();
  paintShape(c, cloth.build(), item.colorway.c, fur, () => {
    // A darker hem along the two lower edges, and a soft fold shadow just under the band.
    const hem = Skia.PathBuilder.Make();
    hem.moveTo(top1.x, top1.y);
    hem.quadTo((top1.x + tip.x) / 2 - bow, (top1.y + tip.y) / 2, tip.x, tip.y);
    hem.quadTo((top2.x + tip.x) / 2 + bow, (top2.y + tip.y) / 2, top2.x, top2.y);
    c.drawPath(hem.build(), edgePaint(deep, 1, r * sizes.bandanaHem * 2));
    strokeLine(c, top1.x, top1.y + r * 0.08, top2.x, top2.y + r * 0.08, '#000000', r * 0.12, 0.14, StrokeCap.Round);
    const fold = Skia.PathBuilder.Make();
    fold.moveTo(topMid.x - r * 0.2, topMid.y + r * 0.25);
    fold.quadTo(topMid.x, topMid.y + r * 0.12, tip.x - r * 0.05, tip.y - r * 0.2);
    c.drawPath(fold.detach(), paintOf(light(item.colorway.c, 0.4), 0.7, r * 0.06));
  }, 1, patternPaint(item, 'cloth', r * 0.1));

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

function glassesLayout(face: HeadFace, item: WearItem): GlassesLayout | null {
  const st = sizes.glassesStyles[item.shape];
  if (!st) {
    warnShape(item);
    return null;
  }
  const eyeR = face.eyeR;
  const view = Math.max(face.turn, face.front);
  // Close-set eyes (husky) shrink the lenses at the 3/4 and front views so they never overlap.
  // Hearts keep a higher floor so the lens still wraps the pupil when the face is narrow.
  const heart = st.shape === 'heart';
  const need = 2 * st.w * eyeR + st.frame * eyeR + eyeR * 0.4;
  const fit = clamp(face.gap3 / need, heart ? 0.88 : 0.6, 1);
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

function lensPath(shape: 'wayfarer' | 'round' | 'soft' | 'heart' | 'star', w: number, h: number): SkPath {
  if (shape === 'soft') {
    const rr = Math.min(w, h) * 0.6;
    return Skia.Path.RRect(Skia.RRectXY(Skia.XYWHRect(-w, -h, w * 2, h * 2), rr, rr));
  }
  const p = Skia.PathBuilder.Make();
  if (shape === 'heart') {
    // Two lobes and a point. The cleft stays above the pupil, and deep enough that the rim does not close it.
    p.moveTo(0, h * 0.98);
    p.cubicTo(-w * 0.2, h * 0.45, -w * 1.05, h * 0.35, -w * 1.02, -h * 0.05);
    p.cubicTo(-w * 1.0, -h * 0.72, -w * 0.55, -h * 1.12, -w * 0.22, -h * 0.78);
    p.cubicTo(-w * 0.08, -h * 0.62, 0, -h * 0.62, 0, -h * 0.62);
    p.cubicTo(0, -h * 0.62, w * 0.08, -h * 0.62, w * 0.22, -h * 0.78);
    p.cubicTo(w * 0.55, -h * 1.12, w * 1.0, -h * 0.72, w * 1.02, -h * 0.05);
    p.cubicTo(w * 1.05, h * 0.35, w * 0.2, h * 0.45, 0, h * 0.98);
    p.close();
    return p.detach();
  }
  if (shape === 'star') {
    const outer = Math.min(w, h);
    const inner = outer * 0.45;
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        p.moveTo(x, y);
      } else {
        p.lineTo(x, y);
      }
    }
    p.close();
    return p.detach();
  }
  if (shape === 'round') {
    p.addOval(oval(0, 0, w, h));
    return p.detach();
  }
  // Wayfarer: a straight brow line and a rounded bottom that dips toward the cheek.
  p.moveTo(-w, -h * 0.8);
  p.lineTo(w * 0.95, -h);
  p.quadTo(w * 1.12, h * 0.55, w * 0.25, h);
  p.quadTo(-w * 0.7, h * 1.05, -w, h * 0.15);
  p.close();
  return p.detach();
}

function drawLensAt(c: SkCanvas, L: GlassesLayout, at: Pt, scale: Pt, alpha: number, item: WearItem, fur: string): void {
  c.save();
  c.translate(at.x, at.y);
  c.scale(scale.x, scale.y);
  const path = lensPath(L.st.shape, L.w, L.h);
  const tinted = L.st.shape === 'heart' || L.st.shape === 'star';
  const lens = item.lensTint ?? (tinted ? (item.colorway.d ?? L.st.lens) : L.st.lens);
  const lensAlpha = tinted ? 0.45 : L.st.lensAlpha;
  c.drawPath(path, paintOf(lens, lensAlpha * alpha));
  // Glare streaks on the lens, so the eye still sparkles through dark lenses.
  if (L.st.glares > 0) {
    c.save();
    c.clipPath(path, ClipOp.Intersect, true);
    strokeLine(c, -L.w * 0.55, L.h * 0.15, -L.w * 0.05, -L.h * 0.62, '#ffffff', L.w * 0.22, 0.75 * alpha, StrokeCap.Round);
    if (L.st.glares > 1) {
      strokeLine(c, L.w * 0.08, L.h * 0.22, L.w * 0.32, -L.h * 0.12, '#ffffff', L.w * 0.12, 0.6 * alpha, StrokeCap.Round);
    }
    c.restore();
  }
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
  if (!L) {
    return;
  }
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
export function drawGlassesFront(
  c: SkCanvas,
  item: WearItem,
  face: HeadFace,
  headR: number,
  fur: string,
  t = 0,
  reduced = false,
): void {
  const L = glassesLayout(face, item);
  if (!L) {
    return;
  }
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
  if (L.st.shape === 'star') {
    const spark = reduced ? 1 : 0.45 + 0.55 * Math.max(0, Math.sin(t * ((Math.PI * 2) / 4)));
    fillCircle(c, L.near.x + L.w * 1.15, L.near.y - L.h * 0.85, Math.max(1.2, L.w * 0.12), '#ffffff', 0.9 * spark);
  }
}

export type HatView = 'side' | 'front' | 'back';

function hatPath(d: string, r: number): SkPath {
  const made = Skia.Path.MakeFromSVGString(d);
  if (!made) {
    return Skia.PathBuilder.Make().detach();
  }
  const matrix = Skia.Matrix();
  matrix.scale(r / 30, r / 30);
  made.transform(matrix);
  return made;
}

function hatStroke(c: SkCanvas, d: string, r: number, color: string, width: number, alpha = 1, dash?: [number, number], cap = StrokeCap.Round): void {
  const paint = paintOf(color, alpha, width * (r / 30));
  paint.setStrokeCap(cap);
  if (dash) {
    paint.setPathEffect(Skia.PathEffect.MakeDash([dash[0] * (r / 30), dash[1] * (r / 30)], 0));
  }
  c.drawPath(hatPath(d, r), paint);
}

export function drawHat(
  c: SkCanvas,
  item: WearItem,
  r: number,
  face: HeadFace,
  fur: string,
  view: HatView = 'side',
  t = 0,
  reduced = false,
): void {
  c.save();
  c.translate(face.top.x, 0);
  drawHatShape(c, item, r, fur, face, view, t, reduced, false);
  c.restore();
}

export function drawHatShape(
  c: SkCanvas,
  item: WearItem,
  r: number,
  fur: string,
  face?: HeadFace,
  view: HatView = 'side',
  t = 0,
  reduced = false,
  icon = false,
): void {
  c.save();
  c.translate(0, r * sizes.hatSeat);
  const tilt = icon ? sizes.hatIconTilt : view === 'front' || view === 'back' ? 0 : sizes.hatTilt;
  c.rotate(tilt, 0, 0);
  if (item.shape === 'beret' && view !== 'front') {
    c.rotate(sizes.beretTilt, 0, 0);
  }
  const u = r * 0.1;
  if (item.shape === 'beanie') {
    drawBeanie(c, item, r, fur, u);
  } else if (item.shape === 'party') {
    drawParty(c, item, r, fur, u, view === 'side' && !icon);
  } else if (item.shape === 'top') {
    drawTopHat(c, item, r, fur, u);
  } else if (item.shape === 'cap') {
    drawCap(c, item, r, fur, face, view, u);
  } else if (item.shape === 'bucket') {
    drawBucket(c, item, r, fur, u);
  } else if (item.shape === 'beret') {
    drawBeret(c, item, r, fur, u);
  } else if (item.shape === 'crown') {
    drawCrown(c, item, r, fur, u, t, reduced);
  } else {
    warnShape(item);
  }
  c.restore();
}

function drawBeanie(c: SkCanvas, item: WearItem, r: number, fur: string, u: number): void {
  const crown = resolvePart(item, 'crown', u);
  const cuff = resolvePart(item, 'cuff', u);
  const pom = resolvePart(item, 'pom', u);
  const dome = 'M-19 -4 C-21 -24 -8 -31 3 -30 C14 -29 21 -20 19 -4 Z';
  paintShape(c, hatPath(dome, r), crown.color, fur, () => {
    const alpha = textureAlpha(crown.pattern);
    for (const x of [-12, -6, 0, 6, 12]) {
      hatStroke(c, `M${x} -6 L${(x * 0.8).toFixed(1)} -28`, r, shade(crown.color, 0.12), 1.3, alpha);
    }
    hatStroke(c, 'M-12 -22 Q-4 -28 6 -26', r, light(crown.color, 0.4), 2.2, 0.75 * alpha);
  }, 1, crown.pattern);
  paintShape(c, hatPath('M-21 -9 Q0 -12 21 -9 L21 0 Q0 3 -21 0 Z', r), cuff.color, fur, () => {
    hatStroke(c, 'M-21 -4.5 Q0 -6 21 -4.5', r, shade(item.colorway.c, 0.3), 9, textureAlpha(cuff.pattern), [1.3, 2.4], StrokeCap.Butt);
  }, 1, cuff.pattern);
  paintShape(c, circlePath((-2 * r) / 30, (-33 * r) / 30, (7.5 * r) / 30), pom.color, fur, () => {
    hatStroke(c, 'M-6 -35 Q-2 -39 2 -36 M-3 -30 Q1 -32 4 -29', r, shade(pom.color, 0.15), 1.1, 0.8);
  });
}

function drawParty(c: SkCanvas, item: WearItem, r: number, fur: string, u: number, elastic: boolean): void {
  const crown = resolvePart(item, 'crown', u);
  const trim = resolvePart(item, 'trim', u);
  const pom = resolvePart(item, 'pom', u);
  paintShape(c, hatPath('M-13 0 L13 0 L1 -42 Z', r), crown.color, fur, () => {
    for (const y of [-4, -14, -24, -34]) {
      hatStroke(c, `M-20 ${y} L20 ${y - 9}`, r, trim.color, 4.5, textureAlpha(crown.pattern));
    }
  }, 1, crown.pattern);
  paintShape(c, hatPath('M-14 -3 Q0 -5 14 -3 L14 2 Q0 4 -14 2 Z', r), trim.color, fur);
  paintShape(c, circlePath(r / 30, (-44 * r) / 30, (5.5 * r) / 30), pom.color, fur);
  if (elastic) {
    hatStroke(c, 'M12 1 Q20 20 14 44', r, '#ffffff', 1.1, 0.6);
  }
}

function drawTopHat(c: SkCanvas, item: WearItem, r: number, fur: string, u: number): void {
  const crown = resolvePart(item, 'crown', u);
  const brim = resolvePart(item, 'brim', u);
  const band = resolvePart(item, 'band', u);
  paintShape(c, hatPath('M-16 -1 Q0 -6 16 -1 Q16 4 0 4 Q-16 4 -16 -1 Z', r), brim.color, fur);
  paintShape(c, hatPath('M-9.5 -2 L-9 -27 Q0 -29 9 -27 L9.5 -2 Q0 0 -9.5 -2 Z', r), crown.color, fur, () => {
    hatStroke(c, 'M-5 -24 L-5 -8', r, light(crown.color, 0.35), 2, 0.8);
  }, 1, crown.pattern);
  paintShape(c, hatPath('M-9.5 -9 Q0 -11 9.5 -9 L9.5 -3 Q0 -1 -9.5 -3 Z', r), band.color, fur, undefined, 1, band.pattern);
}

function drawCap(c: SkCanvas, item: WearItem, r: number, fur: string, face: HeadFace | undefined, view: HatView, u: number): void {
  const crown = resolvePart(item, 'crown', u);
  const brim = resolvePart(item, 'brim', u);
  if (view === 'front') {
    paintShape(c, domePath((r * 0.85), r * 0.5, -r * 0.15), crown.color, fur, undefined, 1, crown.pattern);
    paintShape(c, hatPath('M-28 2 C-18 8 18 8 28 2 C22 10 10 8 -10 8 C-22 10 -28 6 -28 2 Z', r), brim.color, fur);
    paintShape(c, circlePath(0, (-19.5 * r) / 30, (2.6 * r) / 30), brim.color);
    return;
  }
  if (view === 'back') {
    paintShape(c, domePath(r * 0.82, r * 0.55, -r * 0.12), crown.color, fur, undefined, 1, crown.pattern);
    const strap = Skia.PathBuilder.Make();
    strap.addArc(oval(0, r * 0.05, r * 0.72, r * 0.22), 15, 150);
    c.drawPath(strap.detach(), edgePaint(brim.color, 1, Math.max(1.5, r * 0.08)));
    return;
  }
  const length = (27 * r) / 30;
  const baseY = 0;
  const eyeLimit = (face ? face.nearEye.y - face.eyeR - r * sizes.hatSeat : -r * 0.5) - r * 0.05;
  let tilt = 0;
  if (baseY + r * 0.08 > eyeLimit && length > 1) {
    tilt = Math.max((-15 * Math.PI) / 180, Math.atan2(eyeLimit - baseY, length));
  }
  paintShape(c, hatPath('M-18 0 C-19 -22 18 -24 18 0 Z', r), crown.color, fur, () => {
    const alpha = textureAlpha(crown.pattern);
    hatStroke(c, 'M0 -18 Q-6 -10 -8 0 M0 -18 Q6 -10 8 0', r, shade(crown.color, 0.22), 1.4, alpha);
    hatStroke(c, 'M-11 -14 Q-4 -20 4 -19', r, light(crown.color, 0.4), 2.2, 0.75 * alpha);
  }, 1, crown.pattern);
  c.save();
  c.rotate(deg(tilt), 0, 0);
  paintShape(c, hatPath('M8 -3 C22 -6 34 -2 35 3 C27 7 16 6 7 3 Z', r), brim.color, fur);
  c.restore();
  paintShape(c, circlePath(0, (-19.5 * r) / 30, (2.6 * r) / 30), brim.color);
}

function drawBucket(c: SkCanvas, item: WearItem, r: number, fur: string, u: number): void {
  const crown = resolvePart(item, 'crown', u);
  const band = resolvePart(item, 'band', u);
  const brim = resolvePart(item, 'brim', u);
  paintShape(c, hatPath('M-12.5 -3 C-13 -20 13 -20 12.5 -3 Z', r), crown.color, fur, () => {
    hatStroke(c, 'M-8 -14 Q-2 -18 5 -17', r, light(crown.color, 0.4), 2, 0.75 * textureAlpha(crown.pattern));
  }, 1, crown.pattern);
  paintShape(c, hatPath('M-13 -7 Q0 -9 13 -7 L13 -2 Q0 0 -13 -2 Z', r), band.color, fur);
  paintShape(c, hatPath('M-25 3 C-21 -4 21 -4 25 3 C27 7 21 9 14 6.5 C6 4.5 -6 4.5 -14 6.5 C-21 9 -27 7 -25 3 Z', r), brim.color, fur, () => {
    hatStroke(c, 'M-21 3.5 C-12 -0.5 12 -0.5 21 3.5', r, shade(item.colorway.c, 0.25), 1.2, 1, [2, 1.8]);
  });
}

function drawBeret(c: SkCanvas, item: WearItem, r: number, fur: string, u: number): void {
  const crown = resolvePart(item, 'crown', u);
  paintShape(c, hatPath('M-23 -6 C-22 -16 22 -18 24 -7 C25 -1 -24 2 -23 -6 Z', r), crown.color, fur, () => {
    hatStroke(c, 'M-14 -12 Q-2 -17 10 -14', r, light(crown.color, 0.4), 2.2, 0.7 * textureAlpha(crown.pattern));
  }, 1, crown.pattern);
  paintShape(c, hatPath('M-12 -2 Q0 -5 12 -2 L12 1 Q0 3 -12 1 Z', r), shade(crown.color, 0.2), fur);
  hatStroke(c, 'M4 -14 Q5 -18 8 -19', r, outlineOf(crown.color), 3.6);
  hatStroke(c, 'M4 -14 Q5 -18 8 -19', r, crown.color, 1.6);
}

function drawCrown(c: SkCanvas, item: WearItem, r: number, fur: string, u: number, t: number, reduced: boolean): void {
  const gold = resolvePart(item, 'body', u).color || item.colorway.c;
  const gem = item.colorway.d ?? '#FF5FA2';
  paintShape(c, hatPath('M-14 0 L-14 -14 L-7 -7 L0 -19 L7 -7 L14 -14 L14 0 Z', r), gold, fur, () => {
    hatStroke(c, 'M-9 -10 L-6 -6', r, light(gold, 0.5), 1.8, 0.8);
  });
  paintShape(c, hatPath('M-14.5 -5.5 L14.5 -5.5 L14.5 0.5 L-14.5 0.5 Z', r), shade(gold, 0.14), fur);
  for (const x of [-14, 0, 14]) {
    const y = x === 0 ? -20.5 : -15.5;
    paintShape(c, circlePath((x * r) / 30, (y * r) / 30, (2.3 * r) / 30), gold, fur);
  }
  for (const gemAt of [
    { x: -8, color: gem },
    { x: 0, color: '#5AA9E6' },
    { x: 8, color: gem },
  ]) {
    const ellipse = Skia.PathBuilder.Make();
    ellipse.addOval(oval((gemAt.x * r) / 30, (-2.5 * r) / 30, (2.4 * r) / 30, (1.8 * r) / 30));
    paintShape(c, ellipse.detach(), gemAt.color);
  }
  const spark = reduced ? 1 : 0.45 + 0.55 * Math.max(0, Math.sin(t * ((Math.PI * 2) / 4)));
  paintShape(c, hatPath('M0 -13 L2.4 -10 L0 -7 L-2.4 -10 Z', r), gem, fur, undefined, spark);
}

function domePath(rx: number, ry: number, y: number): SkPath {
  const path = Skia.PathBuilder.Make();
  path.addOval(oval(0, y, rx, ry));
  return path.detach();
}
function drawBowTie(
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
  flat: number,
  hangK: number,
  hangDir: Pt,
): void {
  const knotAt = flat > 0.45 ? offset(chin, perp, r * sizes.collarFlatDrop) : chin;
  const reach = r * 0.42 * (flat > 0.45 ? 0.55 : 1);
  if (flat > 0.45) {
    outlinedQuad(c, offset(knotAt, along, -reach), offset(knotAt, perp, r * 0.06), offset(knotAt, along, reach * 0.45), item.colorway.c, r * 0.12, fur);
  } else {
    const { a, b, mid } = bandEnds(chin, perp, along, r, reach, view, pitch);
    outlinedQuad(c, a, mid, b, item.colorway.c, r * 0.12, fur);
  }
  const wingPart = resolvePart(item, 'wing', r * 0.1);
  const knotPart = resolvePart(item, 'knot', r * 0.1);
  if ((hang.belly ?? 0) <= 0.45) {
    const wing = r * sizes.bowtieReach * hangK;
    const drop = r * 0.34 * hangK;
    const spread = spanDir(perp, view, pitch);
    const left = polygon([
      [knotAt.x, knotAt.y],
      [knotAt.x - spread.x * wing, knotAt.y - spread.y * drop * 0.35],
      [knotAt.x - spread.x * wing * 0.55, knotAt.y + hangDir.y * drop],
    ]);
    const right = polygon([
      [knotAt.x, knotAt.y],
      [knotAt.x + spread.x * wing, knotAt.y - spread.y * drop * 0.35],
      [knotAt.x + spread.x * wing * 0.55, knotAt.y + hangDir.y * drop],
    ]);
    const shine = (sign: number) => {
      strokeLine(
        c,
        knotAt.x + spread.x * sign * wing * 0.25,
        knotAt.y - drop * 0.1,
        knotAt.x + spread.x * sign * wing * 0.7,
        knotAt.y - drop * 0.28,
        light(wingPart.color, 0.3),
        r * 0.045,
        0.8 * textureAlpha(wingPart.pattern),
      );
    };
    paintShape(c, left, wingPart.color, fur, () => shine(-1), 1, wingPart.pattern);
    paintShape(c, right, wingPart.color, fur, () => shine(1), 1, wingPart.pattern);
  }
  const kw = r * 0.22 * hangK;
  const kh = r * 0.26 * hangK;
  paintShape(
    c,
    Skia.Path.RRect(Skia.RRectXY(Skia.XYWHRect(knotAt.x - kw / 2, knotAt.y - kh / 2, kw, kh), r * 0.06, r * 0.06)),
    knotPart.color,
    fur,
  );
}
