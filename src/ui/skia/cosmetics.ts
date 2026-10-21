import { ClipOp, Skia } from '@shopify/react-native-skia';
import type { SkCanvas, SkPath } from '@shopify/react-native-skia';

import type { Geom } from '../../actor';
import type { HeadFace } from '../../actor/geometry';
import { wardrobeSizes } from '../../actor/data/wardrobeSizes';
import type { WearItem } from '../../actor/wardrobe';
import { fillCircle, fillOval, mix, oval, paintOf, polygon, rgb, strokeLine } from './draw';

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

function outlinedLine(c: SkCanvas, x1: number, y1: number, x2: number, y2: number, color: string, width: number, fur?: string, alpha = 1): void {
  if (fur && needsTrim(color, fur)) {
    strokeLine(c, x1, y1, x2, y2, outlineOf(color), width + sizes.outline + sizes.trim, alpha);
    strokeLine(c, x1, y1, x2, y2, trimOf(fur), width + sizes.trim, alpha);
  } else {
    strokeLine(c, x1, y1, x2, y2, outlineOf(color), width + sizes.outline, alpha);
  }
  strokeLine(c, x1, y1, x2, y2, color, width, alpha);
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

export function drawSleeve(c: SkCanvas, hip: Pt, paw: Pt, geom: Geom, item: WearItem, far: boolean, fur: string): void {
  const reach = sizes.sleevePortion;
  const end = { x: hip.x + (paw.x - hip.x) * reach, y: hip.y + (paw.y - hip.y) * reach };
  const color = far ? mix(item.c, '#000000', 0.3) : item.c;
  outlinedLine(c, hip.x, hip.y, end.x, end.y, color, geom.legWidth + sizes.sleeveExtra, fur);
  if (item.id === 'sweater') {
    const cuff = item.d ?? mix(color, '#ffffff', 0.35);
    const cuffEnd = { x: hip.x + (paw.x - hip.x) * (reach - 0.08), y: hip.y + (paw.y - hip.y) * (reach - 0.08) };
    outlinedLine(c, cuffEnd.x, cuffEnd.y, end.x, end.y, far ? mix(cuff, '#000000', 0.25) : cuff, geom.legWidth + sizes.sleeveExtra + sizes.outline, fur);
  }
}

export function drawBoot(c: SkCanvas, knee: Pt, paw: Pt, geom: Geom, boot: WearItem, far: boolean, fur: string): void {
  const sneaker = boot.id === 'sneaker';
  const color = far ? mix(boot.c, '#000000', 0.3) : boot.c;
  const shaft = geom.legWidth + sizes.bootWidth;
  const top = sneaker ? 0.72 : 0.5;
  const origin = { x: knee.x + (paw.x - knee.x) * top, y: knee.y + (paw.y - knee.y) * top };
  outlinedLine(c, origin.x, origin.y, paw.x, paw.y, color, shaft, fur);
  const foot = Skia.Path.Make();
  foot.addOval(oval(paw.x, paw.y - geom.pawRy * 0.15, geom.pawRx + sizes.bootWidth, geom.pawRy + sizes.bootWidth * 0.45));
  paintShape(c, foot, color, fur);
  const sole = mix(boot.c, '#000000', far ? 0.62 : 0.48);
  const solePath = Skia.Path.Make();
  solePath.addRRect(
    Skia.RRectXY(
      Skia.XYWHRect(paw.x - geom.pawRx - sizes.bootWidth * 0.2, paw.y + geom.pawRy * 0.15, (geom.pawRx + sizes.bootWidth) * 2, sizes.bootSole),
      sizes.bootSole * 0.4,
      sizes.bootSole * 0.4,
    ),
  );
  paintShape(c, solePath, sole);
  if (!sneaker) {
    const cuffColor = far ? mix(boot.d ?? '#f7f7f7', '#000000', 0.28) : (boot.d ?? '#f7f7f7');
    const cuffAt = top + sizes.bootCuff;
    const cuff = { x: knee.x + (paw.x - knee.x) * cuffAt, y: knee.y + (paw.y - knee.y) * cuffAt };
    outlinedLine(c, origin.x, origin.y, cuff.x, cuff.y, cuffColor, shaft + sizes.outline, fur);
  } else if (boot.d) {
    const stripe = { x: knee.x + (paw.x - knee.x) * 0.86, y: knee.y + (paw.y - knee.y) * 0.86 };
    outlinedLine(c, stripe.x, stripe.y, paw.x, paw.y - geom.pawRy * 0.2, boot.d, sizes.outline, fur);
  }
  if (!far) {
    fillOval(c, paw.x - geom.pawRx * 0.2, paw.y - geom.pawRy * 0.35, geom.pawRx * 0.28, geom.pawRy * 0.18, '#ffffff', 0.7);
  }
}

function jacketPath(geom: Geom, breath: number, puff: number): SkPath {
  const rx = geom.bodyLen / 2 + puff;
  const ry = (geom.bodyH / 2) * breath + puff * 0.35;
  const back = -geom.bodyLen * sizes.jacketBack;
  const path = Skia.Path.Make();
  path.moveTo(back, geom.bodyY - ry * 0.72);
  path.quadTo(rx * 0.15, geom.bodyY - ry, rx * 0.92, geom.bodyY - ry * 0.05);
  path.quadTo(rx * 0.15, geom.bodyY + ry, back, geom.bodyY + ry * 0.78);
  path.close();
  return path;
}

export function drawJacket(c: SkCanvas, geom: Geom, item: WearItem, breath: number, fur: string): void {
  const puff = item.id === 'vest' || item.id === 'puffer' ? sizes.vestPuff : sizes.jacketPuff;
  const path = jacketPath(geom, breath, puff);
  const r = geom.headR;
  paintShape(c, path, item.c, fur, () => {
    const front = geom.bodyLen * 0.22;
    const top = geom.bodyY - geom.bodyH * 0.42 * breath;
    const bottom = geom.bodyY + geom.bodyH * 0.48 * breath;
    if (item.id === 'sweater') {
      const stripe = item.d ?? mix(item.c, '#ffffff', 0.35);
      for (let i = 0; i < 3; i += 1) {
        const y = top + (bottom - top) * (0.22 + i * 0.24);
        strokeLine(c, -geom.bodyLen * 0.3, y, front + geom.bodyLen * 0.2, y, stripe, sizes.sweaterStripe, 0.9);
      }
    } else if (item.id === 'rain') {
      strokeLine(c, -geom.bodyLen * 0.2, bottom - geom.bodyH * 0.12, front + geom.bodyLen * 0.25, bottom - geom.bodyH * 0.08, mix(item.c, '#000000', 0.28), geom.bodyH * 0.14);
      fillOval(c, front, geom.bodyY - geom.bodyH * 0.2, geom.bodyLen * 0.12, geom.bodyH * 0.16, '#ffffff', 0.28);
    } else if (item.id === 'vest' || item.id === 'puffer') {
      const line = mix(item.c, '#ffffff', 0.35);
      for (let i = 0; i < 3; i += 1) {
        const x = -geom.bodyLen * 0.12 + i * geom.bodyLen * 0.16;
        strokeLine(c, x, top, x + geom.bodyLen * 0.04, bottom, line, sizes.quilt);
      }
      if (item.id === 'vest') {
        strokeLine(c, front, top, front, bottom, line, sizes.quilt);
        fillCircle(c, front, geom.bodyY, r * 0.06, line);
      }
    }
    if (item.id !== 'vest') {
      const hem = mix(item.c, '#000000', 0.25);
      strokeLine(c, -geom.bodyLen * 0.28, bottom - geom.bodyH * 0.04, front + geom.bodyLen * 0.16, bottom, hem, geom.bodyH * 0.1);
    }
  });
  if (item.id === 'rain') {
    for (let i = 0; i < 3; i += 1) {
      const button = circlePath(geom.bodyLen * 0.3, geom.bodyY - geom.bodyH * 0.18 + i * r * 0.55, r * sizes.jacketButton);
      paintShape(c, button, mix(item.c, '#000000', 0.35));
    }
    const hood = circlePath(geom.bodyLen * 0.34, geom.bodyY - geom.bodyH * 0.78, r * 0.42);
    paintShape(c, hood, item.c, fur);
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
      if (!item.d) {
        return;
      }
      for (const [u, v] of [
        [0.5, 0.34],
        [0.34, 0.58],
        [0.66, 0.58],
      ] as const) {
        fillCircle(
          c,
          a.x + (b.x - a.x) * u + (tip.x - (a.x + b.x) / 2) * v,
          a.y + (b.y - a.y) * u + (tip.y - (a.y + b.y) / 2) * v,
          r * sizes.bandanaDot,
          item.d,
        );
      }
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
