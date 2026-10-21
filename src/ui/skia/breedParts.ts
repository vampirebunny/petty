import { ClipOp, Skia } from '@shopify/react-native-skia';
import type { SkCanvas, SkPath } from '@shopify/react-native-skia';

import type { Geom } from '../../actor';
import { earProfiles } from '../../actor/data/breedShapes';
import type { HeadFace } from '../../actor/geometry';
import { markingOf } from '../../actor/markings';
import type { Breed, ResolvedMarking } from '../../actor/types';
import { clipOval, deg, fillCircle, fillOval, mix, oval, paintOf, strokeLine } from './draw';

type Pt = { x: number; y: number };

export type HeadCtx = { breed: Breed; geom: Geom; face: HeadFace; markings: readonly ResolvedMarking[] };

const rad = (degrees: number): number => (degrees * Math.PI) / 180;

function bez3(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function bez2(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
}

// ---------------------------------------------------------------- tails

export type TailDeco = {
  // Lighter tint used for feathered fringes.
  feather: string;
  // Tail tip color, or null for none.
  tip: string | null;
  // Ring stripes across the tail (Maine Coon), or null for none.
  rings: string | null;
};

function tuftsAlong(c: SkCanvas, points: Pt[], r: number, color: string, side: number): void {
  for (const p of points) {
    fillCircle(c, p.x, p.y + side * r * 0.8, r, color);
  }
}

// Draws the breed's tail and returns nothing: each tail type is one branch, all from data.
export function drawTail(c: SkCanvas, breed: Breed, geom: Geom, wag: number, color: string, lift: number, deco: TailDeco): void {
  const tx = -geom.bodyLen / 2 + 6;
  const ty = geom.bodyY - geom.bodyH * 0.1;
  // Per-pet tail fluffiness widens the thick tails (1 is the breed's own).
  const fluff = breed.tailFluff ?? 1;
  const body = (): void => {
    let width = 9;
    let tip: Pt = { x: tx - 20, y: ty - 10 };
    switch (breed.tailType) {
      case 'sickleBushy': {
        // A bushy tail that sweeps up and curls forward over the back.
        const p0 = { x: tx, y: ty };
        const p1 = { x: tx - 16, y: ty - 6 };
        const p2 = { x: tx - 18 + wag * 10, y: ty - 34 };
        const p3 = { x: tx + 6 + wag * 8, y: ty - 44 };
        const path = Skia.Path.Make();
        path.moveTo(p0.x, p0.y);
        path.cubicTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        width = 13 * fluff;
        c.drawPath(path, paintOf(color, 1, width));
        tuftsAlong(c, [bez3(p0, p1, p2, p3, 0.3), bez3(p0, p1, p2, p3, 0.55), bez3(p0, p1, p2, p3, 0.8)].map((p) => ({ x: p.x - 3, y: p.y })), 5, color, 0);
        fillCircle(c, p3.x, p3.y, 7, color);
        tip = p3;
        break;
      }
      case 'fluffyRump': {
        // No tail: a fluffy rump instead, drawn as a scalloped puff.
        const cx = tx + 3;
        const cy = ty + 2;
        fillOval(c, cx, cy, 11 * fluff, 10 * fluff, color);
        for (let i = 0; i < 6; i += 1) {
          const a = rad(110 + i * 28);
          fillCircle(c, cx + Math.cos(a) * 10, cy + Math.sin(a) * 9, 4.6, color);
        }
        tip = { x: cx - 9, y: cy };
        break;
      }
      case 'plume': {
        // A long feathered tail carried level, with a fringe hanging under it.
        const angle = 0.5 + wag;
        const length = 48;
        const p0 = { x: tx, y: ty };
        const p1 = { x: tx - length * 0.4, y: ty - 4 };
        const p2 = { x: tx - Math.cos(angle) * length, y: ty - Math.sin(angle) * length };
        const path = Skia.Path.Make();
        path.moveTo(p0.x, p0.y);
        path.quadTo(p1.x, p1.y, p2.x, p2.y);
        c.drawPath(path, paintOf(color, 1, 9));
        for (let k = 1; k <= 6; k += 1) {
          const p = bez2(p0, p1, p2, k / 7);
          fillOval(c, p.x, p.y + 5, 5, 6.5 - k * 0.3, deco.feather);
        }
        tip = p2;
        break;
      }
      case 'thinTaper': {
        // A long thin tail that tapers to a point.
        const angle = 0.9 + wag;
        const length = 50;
        const p0 = { x: tx, y: ty };
        const p1 = { x: tx - length * 0.4, y: ty - 4 };
        const p2 = { x: tx - Math.cos(angle) * length, y: ty - Math.sin(angle) * length };
        const steps = 7;
        for (let i = 0; i < steps; i += 1) {
          const a = bez2(p0, p1, p2, i / steps);
          const b = bez2(p0, p1, p2, (i + 1) / steps);
          strokeLine(c, a.x, a.y, b.x, b.y, color, 8 - (i / (steps - 1)) * 6.4);
        }
        width = 3;
        tip = p2;
        break;
      }
      case 'doubleCurl': {
        // A tight double curl sitting on the rump.
        const cx = tx - 3 + wag * 4;
        const cy = ty - 11;
        const outer = Skia.Path.Make();
        outer.addArc(oval(cx, cy, 11, 11), 80, 300);
        c.drawPath(outer, paintOf(color, 1, 7));
        const inner = Skia.Path.Make();
        inner.addArc(oval(cx + 1, cy + 1, 5.5, 5.5), 80, 300);
        c.drawPath(inner, paintOf(mix(color, '#000000', 0.18), 1, 4.6));
        tip = { x: cx, y: cy };
        break;
      }
      case 'catThin':
      case 'catLong': {
        const thin = breed.tailType === 'catThin';
        width = thin ? 4.4 : 6.2;
        const sway = wag * 30;
        const path = Skia.Path.Make();
        path.moveTo(tx, ty);
        if (thin) {
          path.cubicTo(tx - 28, ty + 6, tx - 54, ty - 6, tx - 46 + sway, ty - 44);
          tip = { x: tx - 46 + sway, y: ty - 44 };
        } else {
          path.cubicTo(tx - 24, ty + 8, tx - 40, ty - 8, tx - 34 + sway, ty - 38);
          tip = { x: tx - 34 + sway, y: ty - 38 };
        }
        c.drawPath(path, paintOf(color, 1, width));
        break;
      }
      case 'catPlume':
      case 'catBushy': {
        // Plume: a flowing medium tail with a fringe. Bushy: a long, very thick tail with ring stripes.
        const bushy = breed.tailType === 'catBushy';
        width = (bushy ? 16 : 12) * fluff;
        const sway = wag * (bushy ? 26 : 22);
        const p0 = { x: tx, y: ty };
        const p1 = { x: tx - (bushy ? 26 : 22), y: ty + 10 };
        const p2 = { x: tx - (bushy ? 48 : 34), y: ty - 8 };
        const p3 = { x: tx - (bushy ? 40 : 28) + sway, y: ty - (bushy ? 48 : 34) };
        const path = Skia.Path.Make();
        path.moveTo(p0.x, p0.y);
        path.cubicTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        c.drawPath(path, paintOf(color, 1, width));
        const samples = bushy ? [0.2, 0.34, 0.48, 0.62, 0.76, 0.9] : [0.35, 0.6, 0.85];
        for (const sample of samples) {
          const p = bez3(p0, p1, p2, p3, sample);
          fillCircle(c, p.x - width * 0.38, p.y, bushy ? 6.4 : 4.6, bushy ? color : deco.feather);
          fillCircle(c, p.x + width * 0.38, p.y, bushy ? 6.4 : 4.6, bushy ? color : deco.feather);
        }
        fillCircle(c, p3.x, p3.y, bushy ? 9 : 6.6, color);
        if (deco.rings) {
          for (const sample of [0.25, 0.42, 0.6, 0.78]) {
            const p = bez3(p0, p1, p2, p3, sample);
            strokeLine(c, p.x - width * 0.5, p.y, p.x + width * 0.5, p.y, deco.rings, 3, 0.85);
          }
        }
        tip = p3;
        break;
      }
    }
    if (deco.tip) {
      fillCircle(c, tip.x, tip.y, Math.max(3, width * 0.55), deco.tip);
    }
  };
  // A raised tail swings up about its root. Cuddle uses it for the cat's upright, contented tail.
  if (Math.abs(lift) > 0.001) {
    c.save();
    c.rotate(deg(lift * 1.2), tx, ty);
    body();
    c.restore();
    return;
  }
  body();
}

// ---------------------------------------------------------------- body markings and texture

export type BodyDeco = {
  // Chest mane scallops (Maine Coon ruff), or null.
  chestRuff: string | null;
  // Scalloped body outline in this color (Persian long coat), or null.
  scallop: string | null;
};

// Chest, belly, tabby stripes and feathering shapes, drawn inside the torso transform. Clipped to the body so
// they follow weight; scallops and fringes sit on the outline.
export function drawBodyMarkings(c: SkCanvas, geom: Geom, markings: readonly ResolvedMarking[], breath: number, deco: BodyDeco): void {
  const ry = (geom.bodyH / 2) * breath;
  const rx = geom.bodyLen / 2;
  if (deco.scallop) {
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2;
      fillCircle(c, Math.cos(a) * rx, geom.bodyY + Math.sin(a) * ry, 4.4, deco.scallop);
    }
  }
  const chest = markingOf(markings, 'chest');
  const belly = markingOf(markings, 'belly');
  const back = markingOf(markings, 'tabbyBack');
  if (chest || belly || back) {
    c.save();
    clipOval(c, 0, geom.bodyY, rx, ry);
    if (belly) {
      fillOval(c, geom.bodyLen * 0.02, geom.bodyY + geom.bodyH * 0.34, geom.bodyLen * 0.42, geom.bodyH * 0.22, belly.color);
    }
    if (chest) {
      fillOval(c, geom.bodyLen * 0.36, geom.bodyY + geom.bodyH * 0.16, geom.bodyLen * 0.13, geom.bodyH * 0.4, chest.color);
    }
    if (back) {
      // Tabby stripes down the back and sides.
      const stripes = Skia.Path.Make();
      for (let i = 0; i < 7; i += 1) {
        const sx = -geom.bodyLen * 0.38 + i * geom.bodyLen * 0.12;
        stripes.moveTo(sx, geom.bodyY - geom.bodyH * 0.5);
        stripes.quadTo(sx + 6, geom.bodyY - geom.bodyH * 0.12, sx + 2, geom.bodyY + geom.bodyH * 0.14);
      }
      c.drawPath(stripes, paintOf(back.color, 0.6, 4));
    }
    c.restore();
  }
  const fringe = markingOf(markings, 'feathering');
  if (fringe) {
    // Scalloped fringe along the underside and the front of the chest.
    for (let i = 0; i < 6; i += 1) {
      const x = -geom.bodyLen * 0.3 + i * geom.bodyLen * 0.11;
      const edge = Math.sqrt(Math.max(0, 1 - ((x / rx) ** 2)));
      fillCircle(c, x, geom.bodyY + ry * edge - 1, 4.2, fringe.color);
    }
    fillCircle(c, geom.bodyLen * 0.43, geom.bodyY + geom.bodyH * 0.2, 4.6, fringe.color);
    fillCircle(c, geom.bodyLen * 0.4, geom.bodyY + geom.bodyH * 0.36, 4.6, fringe.color);
  }
  if (deco.chestRuff) {
    // Maine Coon mane: a column of scallops down the front of the chest.
    for (let i = 0; i < 5; i += 1) {
      fillCircle(c, geom.bodyLen * (0.44 - 0.015 * Math.abs(i - 2)), geom.bodyY + geom.bodyH * (-0.06 + i * 0.13), 5.6, deco.chestRuff);
    }
  }
}

// ---------------------------------------------------------------- head: back layer

const ruffConfig = {
  // Husky neck ruff, in the coat color.
  texture: { n: 7, size: 0.3, a0: 60, a1: 200, r: 0.92 },
  // Persian neck ruff, in a lighter tint.
  neck: { n: 9, size: 0.34, a0: 40, a1: 215, r: 0.95 },
} as const;

// Scalloped ruff behind the head: husky neck ruff, Persian neck ruff.
export function drawRuff(c: SkCanvas, ctx: HeadCtx, coat: string, ruffColor: string): void {
  const kind = ctx.breed.ruff === 'neck' ? 'neck' : ctx.breed.texture === 'ruff' ? 'texture' : null;
  if (!kind) {
    return;
  }
  const cfg = ruffConfig[kind];
  const color = kind === 'neck' ? ruffColor : coat;
  const R = ctx.geom.headR;
  for (let i = 0; i < cfg.n; i += 1) {
    const a = rad(cfg.a0 + ((cfg.a1 - cfg.a0) * i) / (cfg.n - 1));
    fillCircle(c, Math.cos(a) * R * cfg.r, Math.sin(a) * R * cfg.r, R * cfg.size, color);
  }
  if (ctx.face.turn > 0.01) {
    // At the 3/4 turn the ruff also shows under the chin on the near side.
    const t = ctx.face.turn;
    for (let i = 0; i < 3; i += 1) {
      fillCircle(c, R * (0.15 + i * 0.28) * t, R * 0.88, R * cfg.size * t, color);
    }
  }
}

// ---------------------------------------------------------------- ears

export type EarPaint = { color: string; inner: string; feather: string };

type EarPaths = { outer: SkPath; inner: SkPath; tuft: SkPath | null };

function stiffEar(breed: Breed, R: number, e: number): EarPaths {
  const outer = Skia.Path.Make();
  const inner = Skia.Path.Make();
  let tuft: SkPath | null = null;
  switch (breed.earType) {
    case 'erectTall': {
      const tipY = -R * (0.7 + 1.2 * e);
      outer.moveTo(-R * 0.52, -R * 0.6);
      outer.quadTo(-R * 0.5, tipY + R * 0.4, -R * 0.12, tipY);
      outer.quadTo(R * 0.42, tipY + R * 0.45, R * 0.46, -R * 0.7);
      outer.close();
      inner.moveTo(-R * 0.34, -R * 0.68);
      inner.quadTo(-R * 0.3, tipY + R * 0.7, -R * 0.12, tipY + R * 0.3);
      inner.quadTo(R * 0.2, tipY + R * 0.8, R * 0.28, -R * 0.74);
      inner.close();
      break;
    }
    case 'bat': {
      const tipY = -R * (0.6 + 1.0 * e);
      outer.moveTo(-R * 0.72, -R * 0.45);
      outer.cubicTo(-R * 0.86, tipY + R * 0.2, -R * 0.5, tipY - R * 0.02, -R * 0.15, tipY);
      outer.cubicTo(R * 0.26, tipY + R * 0.02, R * 0.64, tipY + R * 0.4, R * 0.62, -R * 0.5);
      outer.close();
      inner.moveTo(-R * 0.5, -R * 0.55);
      inner.cubicTo(-R * 0.58, tipY + R * 0.45, -R * 0.3, tipY + R * 0.25, -R * 0.12, tipY + R * 0.24);
      inner.cubicTo(R * 0.14, tipY + R * 0.26, R * 0.4, tipY + R * 0.55, R * 0.4, -R * 0.56);
      inner.close();
      break;
    }
    case 'wedgeLarge': {
      const tipY = -R * (0.7 + 0.95 * e);
      outer.moveTo(-R * 0.55, -R * 0.62);
      outer.lineTo(R * 0.18, tipY);
      outer.lineTo(R * 0.72, -R * 0.55);
      outer.close();
      inner.moveTo(-R * 0.3, -R * 0.72);
      inner.lineTo(R * 0.18, tipY + R * 0.4);
      inner.lineTo(R * 0.5, -R * 0.68);
      inner.close();
      break;
    }
    case 'smallLow': {
      const tipY = -R * (0.7 + 0.6 * e);
      outer.moveTo(-R * 0.45, -R * 0.68);
      outer.cubicTo(-R * 0.55, tipY + R * 0.12, -R * 0.15, tipY, R * 0.1, tipY + R * 0.02);
      outer.cubicTo(R * 0.4, tipY + R * 0.06, R * 0.62, -R * 0.52, R * 0.6, -R * 0.62);
      outer.close();
      inner.moveTo(-R * 0.22, -R * 0.74);
      inner.cubicTo(-R * 0.26, tipY + R * 0.28, 0, tipY + R * 0.18, R * 0.1, tipY + R * 0.2);
      inner.cubicTo(R * 0.3, tipY + R * 0.25, R * 0.42, -R * 0.66, R * 0.4, -R * 0.7);
      inner.close();
      break;
    }
    case 'tufted':
    case 'standard':
    default: {
      const tipY = -R * (0.7 + 1.0 * e);
      outer.moveTo(-R * 0.4, -R * 0.7);
      outer.lineTo(R * 0.12, tipY);
      outer.lineTo(R * 0.62, -R * 0.62);
      outer.close();
      inner.moveTo(-R * 0.2, -R * 0.78);
      inner.lineTo(R * 0.12, tipY + R * 0.34);
      inner.lineTo(R * 0.44, -R * 0.74);
      inner.close();
      if (breed.earType === 'tufted') {
        // Lynx tufts: three short spikes at the tip.
        tuft = Skia.Path.Make();
        for (const dx of [-0.1, 0.06, 0.22]) {
          tuft.moveTo(R * (0.12 + dx - 0.05), tipY + R * 0.14);
          tuft.lineTo(R * (0.12 + dx * 1.6), tipY - R * 0.42 * (0.7 + e * 0.3));
          tuft.lineTo(R * (0.12 + dx + 0.07), tipY + R * 0.14);
          tuft.close();
        }
      }
      break;
    }
  }
  return { outer, inner, tuft };
}

export type EarArgs = {
  far: boolean;
  // Offset from the layout: the 3/4 shift for the far ear, the slide-back for the near one.
  shift: Pt;
  // Hanging ears: swing angle in radians. Stiff ears: unused.
  angle: number;
  earBack: number;
  alpha: number;
  // Full front shows the inner ear on both sides.
  showInner?: boolean;
};

// One ear of the breed's ear type. Stiff types rotate about their base, hanging types swing from the top.
export function drawEar(c: SkCanvas, breed: Breed, geom: Geom, paint: EarPaint, args: EarArgs): void {
  const R = geom.headR;
  const e = geom.ear;
  const profile = earProfiles[breed.earType];
  const color = paint.color;
  // A rare dog has one erect ear that flops: the near ear then draws as a soft flop.
  const flopped = breed.oneEarFlop === true && !args.far && profile.rises;
  if (profile.stiff && !flopped) {
    c.save();
    c.translate(args.shift.x + (args.far ? -R * 0.35 : 0), args.shift.y);
    c.rotate(deg(-args.earBack * 1.2), R * 0.05, -R * 0.7);
    if (profile.rises && geom.earRise < 1) {
      // Puppy ears are folded forward and a little shorter; they rise as the pet grows.
      const fold = 1 - geom.earRise;
      c.rotate(deg(fold * 1.1), R * 0.05, -R * 0.7);
      c.translate(R * 0.05, -R * 0.7);
      c.scale(1, 1 - 0.35 * fold);
      c.translate(-R * 0.05, R * 0.7);
    }
    const { outer, inner, tuft } = stiffEar(breed, R, e);
    c.drawPath(outer, paintOf(color, args.alpha));
    if (!args.far || args.showInner) {
      c.drawPath(inner, paintOf(paint.inner, args.alpha));
    }
    if (tuft) {
      c.drawPath(tuft, paintOf(color, args.alpha));
    }
    c.restore();
    return;
  }
  if (breed.earType === 'folded') {
    // Small cap lying forward on top of the head, one per side.
    const s = Math.max(0.6, e * 1.6);
    c.save();
    c.translate(-R * 0.1 + args.shift.x + (args.far ? -R * 0.35 : 0), -R * 0.62 + args.shift.y);
    c.rotate(deg(args.far ? 0.28 : 0.4), 0, 0);
    const cap = Skia.Path.Make();
    cap.moveTo(-R * 0.34 * s, R * 0.1 * s);
    cap.quadTo(-R * 0.1 * s, -R * 0.34 * s, R * 0.3 * s, -R * 0.12 * s);
    cap.quadTo(R * 0.4 * s, R * 0.2 * s, R * 0.1 * s, R * 0.32 * s);
    cap.quadTo(-R * 0.2 * s, R * 0.3 * s, -R * 0.34 * s, R * 0.1 * s);
    cap.close();
    c.drawPath(cap, paintOf(color, args.alpha));
    if (!args.far || args.showInner) {
      fillOval(c, R * 0.02 * s, R * 0.05 * s, R * 0.16 * s, R * 0.11 * s, paint.inner, 0.7 * args.alpha);
    }
    c.restore();
    return;
  }
  if (breed.earType === 'button' ) {
    // Small folded ear: a rounded triangle tipping forward over the brow.
    const s = Math.max(0.5, e * 1.5);
    c.save();
    c.translate(-R * 0.1 + args.shift.x, -R * 0.62 + args.shift.y);
    c.rotate(deg(args.far ? -0.12 : 0.1 + args.angle * 0.3), 0, 0);
    const path = Skia.Path.Make();
    path.moveTo(-R * 0.34 * s, R * 0.02);
    path.quadTo(-R * 0.05 * s, -R * 0.42 * s, R * 0.34 * s, -R * 0.06 * s);
    path.quadTo(R * 0.4 * s, R * 0.36 * s, R * 0.08 * s, R * 0.46 * s);
    path.quadTo(-R * 0.26 * s, R * 0.34 * s, -R * 0.34 * s, R * 0.02);
    path.close();
    c.drawPath(path, paintOf(color, args.alpha));
    c.restore();
    return;
  }
  c.save();
  c.translate(-R * 0.15 + args.shift.x, -R * 0.35 + args.shift.y);
  c.rotate(deg(args.angle), 0, 0);
  if (breed.earType === 'longDrape') {
    // Long drape: narrow at the top, hanging well below the jaw.
    const path = Skia.Path.Make();
    path.moveTo(-R * 0.2 * e, 0);
    path.cubicTo(-R * 0.55 * e, R * 0.5 * e, -R * 0.45 * e, R * 1.5 * e, 0, R * 1.62 * e);
    path.cubicTo(R * 0.45 * e, R * 1.5 * e, R * 0.5 * e, R * 0.5 * e, R * 0.2 * e, 0);
    path.close();
    c.drawPath(path, paintOf(color, args.alpha));
  } else {
    // Soft flop: a rounded ear with a feathered edge.
    fillOval(c, 0, R * 0.55 * e, R * 0.4 * e, R * 0.85 * e, color, args.alpha);
    if (breed.texture === 'feathered' && !args.far) {
      for (let i = 0; i < 4; i += 1) {
        fillCircle(c, (i - 1.5) * R * 0.2 * e, R * (1.28 - Math.abs(i - 1.5) * 0.14) * e, R * 0.13 * e, paint.feather);
      }
    }
  }
  c.restore();
}

// ---------------------------------------------------------------- head: skull, markings

// Skull shape in coat color, drawn over the head circle: brow step, snout bridge, jaw and dome.
export function drawSkull(c: SkCanvas, ctx: HeadCtx, coat: string): void {
  const { breed, geom, face } = ctx;
  const R = geom.headR;
  const t = Math.max(face.turn, face.front);
  const side = 1 - t;
  const m = face.muzzle;
  const stop = breed.stop;
  if (breed.skull === 'dome') {
    fillOval(c, R * 0.08 * (1 - face.front), -R * 0.1, R * 1.07, R * 1.1, coat);
  }
  if (breed.skull === 'broad' || breed.skull === 'square') {
    fillOval(c, R * 0.3 * (1 - face.front), R * 0.4, R * 0.82, R * 0.55, coat);
  }
  if (breed.skull === 'flat') {
    fillOval(c, R * 0.34 * (1 - face.front), R * 0.32, R * 0.72, R * 0.58, coat);
  }
  // Brow: a bulge over the eyes whose size is the stop. It fades with the turn, as the face turns toward us.
  if (stop > 0.25 && side > 0.01) {
    fillOval(c, R * 0.5, -R * 0.28, R * 0.38 * side, R * (0.18 + 0.3 * stop) * side, coat);
  }
  const bridged =
    breed.skull === 'wedge' || breed.skull === 'long' || breed.skull === 'fox' || breed.skull === 'broad' || breed.skull === 'square';
  if (bridged && side > 0.01) {
    // Side view: forehead to muzzle. A low stop makes this a straight slope, a high stop scoops it.
    const ax = breed.skull === 'wedge' ? R * 0.1 : R * 0.3;
    const ay = breed.skull === 'wedge' ? -R * 0.92 : -R * 0.86;
    const mx = m.x + m.rx * 0.85;
    const my = m.y - m.ry * 0.7;
    const cx = (ax + mx) / 2 - stop * R * 0.1;
    const cy = (ay + my) / 2 + stop * R * 0.3;
    const path = Skia.Path.Make();
    path.moveTo(ax - R * 0.2, ay + R * 0.05);
    path.quadTo(cx, cy, mx, my);
    path.lineTo(m.x + m.rx * 0.9, m.y + m.ry * 0.5);
    path.lineTo(R * 0.1, R * 0.7);
    path.close();
    c.drawPath(path, paintOf(coat, side));
  }
  if (bridged && t > 0.01) {
    // 3/4: the snout bridge runs from between the eyes down to the muzzle.
    const cxEyes = (face.nearEye.x + face.farEye.x) / 2;
    const topY = face.nearEye.y + R * 0.05;
    const topW = R * 0.22 * breed.muzzleWidth;
    const path = Skia.Path.Make();
    path.moveTo(cxEyes - topW, topY);
    path.lineTo(cxEyes + topW, topY);
    path.lineTo(m.x + m.rx * 0.9, m.y - m.ry * 0.1);
    path.lineTo(m.x - m.rx * 0.9, m.y - m.ry * 0.1);
    path.close();
    c.drawPath(path, paintOf(coat, t));
  }
}

function eyeAt(ctx: HeadCtx): { near: Pt; far: Pt; farAlpha: number } {
  return { near: ctx.face.nearEye, far: ctx.face.farEye, farAlpha: ctx.face.farEyeAlpha };
}

// Head markings that sit under the muzzle and eyes: cap, face mask, blaze, black mask. All are built from the
// same face anchors the eyes and muzzle use, so they follow the head turn without popping.
export function drawHeadMarkingsBelow(c: SkCanvas, ctx: HeadCtx): void {
  const { geom, face } = ctx;
  const R = geom.headR;
  const t = face.turn;
  const m = face.muzzle;
  const { near, far, farAlpha } = eyeAt(ctx);
  const eyeR = face.eyeR;
  const midX = (near.x + far.x) / 2;

  const cap = markingOf(ctx.markings, 'cap');
  if (cap) {
    c.save();
    clipOval(c, 0, 0, R, R);
    fillOval(c, midX * 0.5 + R * 0.1 * (1 - t), -R * 0.62, R * 1.02, R * 0.62, cap.color);
    c.restore();
  }

  const tabbyM = markingOf(ctx.markings, 'tabbyM');
  if (tabbyM) {
    // Forehead stripes: seen along the top of the head from the side, in a row with an "M" at the 3/4 turn.
    const sideXs = [-0.36, -0.1, 0.15];
    const frontXs = [-0.2, 0, 0.2];
    const marks = Skia.Path.Make();
    c.save();
    clipOval(c, 0, 0, R, R);
    sideXs.forEach((sx, i) => {
      const x = R * (sx * (1 - t)) + (midX + R * frontXs[i]) * t;
      marks.moveTo(x, -R * 0.95);
      marks.lineTo(x + R * 0.02, -R * (0.58 + 0.04 * i));
    });
    if (t > 0.01) {
      marks.moveTo(midX - R * 0.22, -R * 0.4);
      marks.lineTo(midX - R * 0.11, -R * 0.56);
      marks.lineTo(midX, -R * 0.44);
      marks.lineTo(midX + R * 0.11, -R * 0.56);
      marks.lineTo(midX + R * 0.22, -R * 0.4);
    }
    c.drawPath(marks, paintOf(tabbyM.color, 0.65, Math.max(2, R * 0.1)));
    c.restore();
  }
  const cheekBars = markingOf(ctx.markings, 'cheekBars');
  if (cheekBars) {
    // Two curved bars running back from under each eye.
    const bars = Skia.Path.Make();
    const bar = (x: number, dir: number, alpha: number): void => {
      if (alpha <= 0.01) {
        return;
      }
      for (const dy of [1.9, 2.9]) {
        bars.moveTo(x - dir * eyeR * 0.6, near.y + eyeR * dy);
        bars.quadTo(x - dir * eyeR * 2.4, near.y + eyeR * (dy + 0.5), x - dir * eyeR * 4.2, near.y + eyeR * (dy + 0.1));
      }
    };
    c.save();
    clipOval(c, 0, 0, R, R);
    bar(near.x, 1, 1);
    c.drawPath(bars, paintOf(cheekBars.color, 0.6, Math.max(1.6, R * 0.07)));
    if (farAlpha > 0.01) {
      const farBars = Skia.Path.Make();
      for (const dy of [1.9, 2.9]) {
        farBars.moveTo(far.x + eyeR * 0.6, far.y + eyeR * dy);
        farBars.quadTo(far.x + eyeR * 2.2, far.y + eyeR * (dy + 0.5), far.x + eyeR * 3.4, far.y + eyeR * (dy + 0.1));
      }
      c.drawPath(farBars, paintOf(cheekBars.color, 0.6 * farAlpha, Math.max(1.6, R * 0.07)));
    }
    c.restore();
  }

  const faceMask = markingOf(ctx.markings, 'faceMask');
  if (faceMask) {
    c.save();
    clipOval(c, 0, 0, R, R);
    fillOval(c, R * 0.2 + (midX - R * 0.2) * t, R * 0.4, R * (0.62 + 0.1 * t), R * 0.5, faceMask.color);
    if (t > 0.01) {
      // A white stripe up between the eyes at the 3/4 turn.
      fillOval(c, midX, -R * 0.12, R * 0.1 * t + 0.1, R * 0.5 * t + 0.1, faceMask.color);
    }
    c.restore();
    fillOval(c, m.x - m.rx * 0.05, m.y - m.ry * 0.15, m.rx * 1.05 + R * 0.06, m.ry * 1.25, faceMask.color);
  }

  const blaze = markingOf(ctx.markings, 'blaze');
  if (blaze) {
    // A stripe from the forehead to the muzzle. In side view it follows the profile, in 3/4 it runs down the middle.
    const p0 = { x: R * 0.45 * (1 - t) + midX * t, y: -R * 0.9 };
    const p1 = { x: m.x + m.rx * 0.7 * (1 - t), y: m.y - m.ry * 0.6 };
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const w0 = R * (0.06 + 0.08 * t);
    const w1 = R * (0.16 + 0.16 * t);
    const path = Skia.Path.Make();
    path.moveTo(p0.x + nx * w0, p0.y + ny * w0);
    path.lineTo(p1.x + nx * w1, p1.y + ny * w1);
    path.lineTo(p1.x - nx * w1, p1.y - ny * w1);
    path.lineTo(p0.x - nx * w0, p0.y - ny * w0);
    path.close();
    c.drawPath(path, paintOf(blaze.color));
  }

  const mask = markingOf(ctx.markings, 'blackMask');
  if (mask) {
    c.save();
    clipOval(c, 0, 0, R, R);
    fillOval(c, near.x, near.y + eyeR * 0.1, eyeR * 1.6, eyeR * 1.45, mask.color, 0.8);
    if (farAlpha > 0.01) {
      fillOval(c, far.x, far.y + eyeR * 0.1, eyeR * 1.3, eyeR * 1.4, mask.color, 0.8 * farAlpha);
      fillOval(c, midX, near.y + eyeR * 0.6, (far.x - near.x) / 2 * farAlpha + 0.1, eyeR * 0.9, mask.color, 0.8 * farAlpha);
    }
    c.restore();
    // The mask covers the whole muzzle, so a flat face reads as one dark mask.
    fillOval(c, m.x, m.y - m.ry * 0.3, m.rx * 1.0, m.ry * 1.25, mask.color);
  }
}

// Head markings drawn over the eyes' surroundings: brow dots and forehead wrinkles.
export function drawHeadMarkingsAbove(c: SkCanvas, ctx: HeadCtx): void {
  const { geom, face } = ctx;
  const R = geom.headR;
  const t = face.turn;
  const { near, far, farAlpha } = eyeAt(ctx);
  const eyeR = face.eyeR;
  const midX = (near.x + far.x) / 2;
  const dots = markingOf(ctx.markings, 'browDots');
  if (dots) {
    fillOval(c, near.x + eyeR * 0.1, near.y - eyeR * 2.0, eyeR * 0.75, eyeR * 0.5, dots.color);
    if (farAlpha > 0.01) {
      fillOval(c, far.x + eyeR * 0.1, far.y - eyeR * 2.0, eyeR * 0.6, eyeR * 0.45, dots.color, farAlpha);
    }
  }
  const wrinkles = markingOf(ctx.markings, 'wrinkles');
  if (wrinkles) {
    const cx = R * 0.35 * (1 - t) + midX * t;
    const w = R * (0.28 + 0.2 * t);
    const lines = Skia.Path.Make();
    for (const y of [-0.62, -0.46]) {
      lines.moveTo(cx - w, R * y + R * 0.04);
      lines.quadTo(cx, R * y - R * 0.12, cx + w, R * y + R * 0.04);
    }
    lines.moveTo(cx, near.y - eyeR * 2.6);
    lines.quadTo(cx - R * 0.03, near.y - eyeR * 3.4, cx, near.y - eyeR * 4.2);
    c.drawPath(lines, paintOf(wrinkles.color, 0.85, Math.max(1.4, R * 0.07)));
  }
}

// Muzzle color: a marking can lock or derive it, otherwise the breed's own.
export function muzzleColorOf(breed: Breed, markings: readonly ResolvedMarking[]): string {
  return markingOf(markings, 'muzzle')?.color ?? breed.muzzle;
}

export function earColorOf(breed: Breed, markings: readonly ResolvedMarking[]): string {
  return markingOf(markings, 'ears')?.color ?? breed.earColor;
}

// ---------------------------------------------------------------- eyes

// Dog and cat eyes by the breed's eye shape: almond is slanted and narrow, round is plain, big round is wide and glossy.
export function drawEye(c: SkCanvas, ex: number, ey: number, eyeR: number, closed: number, breed: Breed, cf: number): void {
  const cat = breed.species === 'cat';
  if (closed > 0.6) {
    const lid = Skia.Path.Make();
    lid.addArc(oval(ex, ey - eyeR * 0.3, eyeR * 1.1, eyeR * 1.1), 27, 126);
    c.drawPath(lid, paintOf('#1b1512', 1, 2));
    return;
  }
  const open = 1 - closed;
  const slanted = breed.eyeShape === 'slanted';
  const almond = breed.eyeShape === 'almond' || slanted;
  const big = breed.eyeShape === 'bigRound';
  c.save();
  if (almond) {
    // The outer corner sits higher than the inner one.
    c.rotate(deg(slanted ? 0.42 : 0.2), ex, ey);
  }
  const ry = almond ? 0.8 : 1;
  if (cat) {
    fillOval(c, ex, ey, eyeR * 1.12, eyeR * 1.1 * ry * open, breed.eyeColor ?? '#79bd5a');
    fillOval(c, ex + eyeR * 0.05, ey, eyeR * (big ? 0.5 : 0.4), eyeR * 1.02 * ry * open, '#15110f');
  } else {
    if (big) {
      fillCircle(c, ex, ey, eyeR * 1.08, '#ffffff', 0.18);
    }
    fillOval(c, ex, ey, eyeR * (almond ? 1.12 : 1), eyeR * ry * open, '#1b1512');
  }
  fillCircle(c, ex + eyeR * 0.38, ey - eyeR * 0.38 * open, eyeR * (big ? 0.4 : 0.34) * open, '#ffffff');
  fillCircle(c, ex - eyeR * 0.35, ey + eyeR * 0.4 * open, eyeR * (0.12 + 0.1 * cf) * open, '#ffffff', 0.75);
  c.restore();
}

// Nose size and head clip helpers kept together for the head layer.
export function clipHead(c: SkCanvas, R: number, cat: boolean): void {
  clipOval(c, 0, 0, R, cat ? R * 0.96 : R);
}

export function clipRectAbove(c: SkCanvas, y: number, width: number): void {
  c.clipRect(Skia.XYWHRect(-width, -width * 3, width * 2, width * 3 + y), ClipOp.Intersect, true);
}
