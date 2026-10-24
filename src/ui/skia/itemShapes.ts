import { PaintStyle, StrokeCap, StrokeJoin, Skia, TileMode, vec } from '@shopify/react-native-skia';
import type { SkCanvas, SkPaint, SkPath } from '@shopify/react-native-skia';

import { catalogItem } from '../../economy/catalog';

// Toy and treat art for the Pet Shop and the play scene.
//
// Every item is drawn in a 100×100 box, using the same numbers as the design mockup. A call's
// `radius` maps to a box of radius × BOX_PER_RADIUS centred on (x, y), so a ball keeps roughly the
// radius it had before this redraw.
//
// Two levels of detail share one drawing, so the toy the pet chases is the toy the player bought:
//   icon   shop and inventory: gradients, inner details, a contact shadow
//   scene  in the room: silhouette, a thicker outline, flat base colour, one highlight. The room's
//          own lighting and shadows apply on top, so the art adds no shadow of its own.

export type ArtDetail = 'icon' | 'scene';
export type TreatArt = 'bone' | 'fish' | 'energy' | 'mood' | 'meal' | 'kibble' | 'special' | 'cookie';

export const BOX_PER_RADIUS = 3;
// Scene outlines never get thinner than this on screen, however small the item is.
const MIN_OUTLINE_PX = 1.5;

// Fallback ids → art. `biscuit` and catalog effects are handled in treatArt.
// Unlisted ids draw the cookie.
export const TREAT_ART: Record<string, TreatArt> = {
  second_wind: 'special',
};

// The rotating cookie's frosting. Swap per day or per item if the cookie of the day should vary.
const COOKIE_FROSTING = '#FFB8D2';

// ---------- draw state ----------

let S = 1; // box units → px for the current draw
let icon = true;

function withScale(c: SkCanvas, x: number, y: number, k: number, detail: ArtDetail, fn: () => void): void {
  const prevS = S;
  const prevIcon = icon;
  S = k;
  icon = detail === 'icon';
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  fn();
  c.restore();
  S = prevS;
  icon = prevIcon;
}

function inBox(c: SkCanvas, x: number, y: number, radius: number, detail: ArtDetail, fn: () => void): void {
  const k = (radius * BOX_PER_RADIUS) / 100;
  withScale(c, x, y, k, detail, () => {
    c.translate(-50, -50);
    fn();
  });
}

// Outline width in box units: thin in the shop, thick and never under MIN_OUTLINE_PX in the scene.
function ow(iconW: number, sceneW: number): number {
  return icon ? iconW : Math.max(sceneW, MIN_OUTLINE_PX / S);
}

// ---------- cached paths and paints ----------

const paths = new Map<string, SkPath>();
function path(d: string): SkPath {
  let p = paths.get(d);
  if (!p) {
    const made = Skia.Path.MakeFromSVGString(d);
    if (!made) {
      throw new Error(`itemShapes: bad path ${d}`);
    }
    p = made;
    paths.set(d, p);
  }
  return p;
}

const paints = new Map<string, SkPaint>();

function fillP(color: string, alpha = 1): SkPaint {
  const key = `f|${color}|${alpha}`;
  let p = paints.get(key);
  if (!p) {
    p = Skia.Paint();
    p.setAntiAlias(true);
    p.setColor(Skia.Color(color));
    p.setAlphaf(alpha);
    paints.set(key, p);
  }
  return p;
}

function strokeP(color: string, width: number, alpha = 1, dash = 0): SkPaint {
  const w = Math.round(width * 100) / 100;
  const key = `s|${color}|${w}|${alpha}|${dash}`;
  let p = paints.get(key);
  if (!p) {
    p = Skia.Paint();
    p.setAntiAlias(true);
    p.setColor(Skia.Color(color));
    p.setAlphaf(alpha);
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(w);
    p.setStrokeCap(StrokeCap.Round);
    p.setStrokeJoin(StrokeJoin.Round);
    if (dash > 0) {
      p.setPathEffect(Skia.PathEffect.MakeDash([dash, dash], 0));
    }
    paints.set(key, p);
  }
  return p;
}

// Vertical linear gradient, in box units.
function gradP(key: string, y0: number, y1: number, colors: string[]): SkPaint {
  const k = `g|${key}`;
  let p = paints.get(k);
  if (!p) {
    p = Skia.Paint();
    p.setAntiAlias(true);
    p.setShader(
      Skia.Shader.MakeLinearGradient(vec(50, y0), vec(50, y1), colors.map((col) => Skia.Color(col)), null, TileMode.Clamp),
    );
    paints.set(k, p);
  }
  return p;
}

function radP(key: string, cx: number, cy: number, r: number, colors: string[], pos: number[]): SkPaint {
  const k = `r|${key}`;
  let p = paints.get(k);
  if (!p) {
    p = Skia.Paint();
    p.setAntiAlias(true);
    p.setShader(
      Skia.Shader.MakeRadialGradient(vec(cx, cy), r, colors.map((col) => Skia.Color(col)), pos, TileMode.Clamp),
    );
    paints.set(k, p);
  }
  return p;
}

// Gradient in the shop, flat colour in the scene.
function base(key: string, y0: number, y1: number, colors: string[], flat: string): SkPaint {
  return icon ? gradP(key, y0, y1, colors) : fillP(flat);
}

// ---------- primitives ----------

function ellipse(c: SkCanvas, cx: number, cy: number, rx: number, ry: number, p: SkPaint, rot = 0): void {
  if (rot) {
    c.save();
    c.rotate(rot, cx, cy);
  }
  c.drawOval(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2), p);
  if (rot) {
    c.restore();
  }
}

function rrect(c: SkCanvas, x: number, y: number, w: number, h: number, r: number, p: SkPaint): void {
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r), p);
}

function shadow(c: SkCanvas, rx: number, cy = 88): void {
  if (icon) {
    ellipse(c, 50, cy, rx, 4.5, fillP('#8A5A7A', 0.18));
  }
}

const STAR4 = 'M0 -10 L2.5 -2.5 L10 0 L2.5 2.5 L0 10 L-2.5 2.5 L-10 0 L-2.5 -2.5 Z';
function sparkle(c: SkCanvas, cx: number, cy: number, size: number, color: string): void {
  c.save();
  c.translate(cx, cy);
  c.scale(size / 10, size / 10);
  c.drawPath(path(STAR4), fillP(color));
  c.restore();
}

// Several shapes that read as one: a doubled outline underneath, then the fill on top.
function union(c: SkCanvas, draw: (p: SkPaint) => void, outline: string, fill: SkPaint, iconW: number, sceneW: number): void {
  draw(strokeP(outline, ow(iconW, sceneW) * 2));
  draw(fill);
}

function boneParts(c: SkCanvas, p: SkPaint, y0: number, h: number, r: number, cyTop: number, cyBottom: number, corner: number): void {
  rrect(c, 26, y0, 48, h, corner, p);
  for (const cx of [25, 75]) {
    for (const cy of [cyTop, cyBottom]) {
      c.drawCircle(cx, cy, r, p);
    }
  }
}

// ---------- toys ----------

function ball(c: SkCanvas): void {
  shadow(c, 25);
  c.drawCircle(50, 52, 33, icon ? radP('ball', 40.8, 38.8, 47.5, ['#FF9E8A', '#F0533F', '#C2352B'], [0, 0.55, 1]) : fillP('#F0533F'));
  c.drawPath(path('M22 42 C38 56 62 56 78 42'), strokeP('#FFF1E2', icon ? 6 : 9));
  if (icon) {
    c.drawPath(path('M23 48 C38 60 62 60 77 48'), strokeP('#C2352B', 1.2, 0.5));
  }
  c.drawCircle(50, 52, 33, strokeP('#9C2B25', ow(2.5, 7)));
  ellipse(c, 37, 31, 10, 5.5, fillP('#FFFFFF', 0.75), -30);
}

function frisbee(c: SkCanvas): void {
  shadow(c, 30, 86);
  const ol = strokeP('#174F86', ow(2.5, 7));
  ellipse(c, 50, 59, 40, 17, fillP('#2368AE'));
  ellipse(c, 50, 59, 40, 17, ol);
  ellipse(c, 50, 53, 40, 17, base('frisbee', 36, 70, ['#9AD6FF', '#3489D8'], '#5FAEF0'));
  ellipse(c, 50, 53, 40, 17, ol);
  if (icon) {
    ellipse(c, 50, 52, 29, 11, strokeP('#DDF1FF', 2, 0.85));
    const paw = fillP('#1F64A8', 0.6);
    ellipse(c, 50, 55, 6.5, 4, paw);
    for (const [x, y] of [[41.5, 49.5], [46.5, 47.5], [53.5, 47.5], [58.5, 49.5]]) {
      ellipse(c, x, y, 2.4, 1.8, paw);
    }
  }
  c.drawPath(path('M20 47 C28 40 42 37 56 37'), strokeP('#FFFFFF', icon ? 3 : 5, 0.75));
}

function yarn(c: SkCanvas): void {
  shadow(c, 30);
  const tail = icon ? 'M70 67 C80 74 86 66 80 60 C74 54 64 64 74 76 C80 84 88 82 93 77' : 'M70 67 C80 75 88 82 96 78';
  c.drawPath(path(tail), strokeP('#C94C84', ow(3, 5)));
  c.drawCircle(46, 50, 30, icon ? radP('yarn', 37.6, 38, 43, ['#FFB8D2', '#E5679A', '#B9447A'], [0, 0.6, 1]) : fillP('#E5679A'));
  const dark = strokeP('#B84679', icon ? 2.2 : 5, 0.9);
  c.drawPath(path('M28 32 C42 42 52 62 50 78'), dark);
  c.drawPath(path('M44 22 C60 32 70 50 70 68'), dark);
  if (icon) {
    c.drawPath(path('M34 24 C50 34 62 56 62 74'), dark);
    c.drawPath(path('M24 44 C38 50 54 64 60 76'), strokeP('#FFC6DB', 2.2, 0.85));
  }
  c.drawCircle(46, 50, 30, strokeP('#9E3A68', ow(2.5, 7)));
  ellipse(c, 35, 34, 8, 4.5, fillP('#FFFFFF', 0.6), -30);
}

function stick(c: SkCanvas): void {
  shadow(c, 34, 84);
  c.save();
  c.rotate(-22, 50, 52);
  const branch = path('M58 50 C62 41 66 37 72 34');
  const branchW = icon ? 3.5 : 4;
  c.drawPath(branch, strokeP('#7A4A22', branchW + 2 * ow(2, 3.5)));
  c.drawPath(branch, strokeP('#B57A45', branchW));
  const leaf = path('M72 34 C74 25 84 22 87 24 C85 31 78 36 72 34 Z');
  c.drawPath(leaf, fillP('#82CC6E'));
  c.drawPath(leaf, strokeP('#3F8A3A', ow(2, 5)));
  if (icon) {
    c.drawPath(path('M73 33 C77 30 81 27 85 25'), strokeP('#3F8A3A', 1.2));
  }
  const body = path('M14 50 C30 46 52 49 86 47 L86 57 C60 59 32 58 14 60 Z');
  c.drawPath(body, fillP('#B57A45'));
  c.drawPath(body, strokeP('#7A4A22', ow(2.5, 7)));
  c.drawPath(path('M20 51 C36 48 56 50 80 49'), strokeP('#E1AE77', icon ? 2 : 4));
  if (icon) {
    c.drawPath(path('M26 55 C32 54 38 54 42 55 M50 54 C56 53 62 54 67 54'), strokeP('#8A5730', 1.6));
    const end = fillP('#EBC694');
    const endInk = strokeP('#7A4A22', 2);
    for (const [ex, ey] of [[86, 52], [14, 55]]) {
      ellipse(c, ex, ey, 3.5, 5, end);
      ellipse(c, ex, ey, 3.5, 5, endInk);
    }
  }
  c.restore();
}

function rope(c: SkCanvas): void {
  shadow(c, 36, 80);
  c.save();
  c.rotate(-12, 50, 50);
  const ol = strokeP('#8C3A2A', ow(2.5, 6));
  if (icon) {
    c.drawPath(path('M11 45 L4 39 M10 50 L2 50 M11 55 L4 61 M89 45 L96 39 M90 50 L98 50 M89 55 L96 61'), strokeP('#D8BE92', 2.6));
  }
  rrect(c, 24, 44, 52, 12, 6, fillP('#F6E7CC'));
  const stripes = icon
    ? 'M30 55 L35 45 M40 55 L45 45 M50 55 L55 45 M60 55 L65 45 M70 55 L73 49'
    : 'M34 55 L40 45 M46 55 L52 45 M58 55 L64 45';
  c.drawPath(path(stripes), strokeP('#E0553E', icon ? 4 : 5.5));
  rrect(c, 24, 44, 52, 12, 6, ol);
  const twist = strokeP('#F6E7CC', icon ? 2.4 : 4);
  for (const kx of [20, 80]) {
    c.drawCircle(kx, 50, 11, fillP('#E0553E'));
    c.drawPath(path(`M${kx - 7} 46 C${kx - 3} 42 ${kx + 3} 42 ${kx + 7} 46`), twist);
    if (icon) {
      c.drawPath(path(`M${kx - 7} 54 C${kx - 3} 50 ${kx + 3} 50 ${kx + 7} 54`), twist);
    }
    c.drawCircle(kx, 50, 11, ol);
  }
  c.restore();
}

function mouse(c: SkCanvas): void {
  shadow(c, 32, 78);
  c.drawPath(path('M24 64 C12 62 8 52 14 44 C18 38 25 40 23 46'), strokeP('#9B88B3', ow(2.8, 5)));
  const body = path('M22 64 C20 44 40 34 58 40 C70 44 80 52 85 60 C78 67 60 71 40 70 C30 69 23 68 22 64 Z');
  c.drawPath(body, base('mouse', 36, 71, ['#ECE3F6', '#B4A2CB'], '#CDBEDF'));
  if (icon) {
    c.drawPath(path('M30 62 C44 53 60 51 77 57'), strokeP('#8D79A3', 1.6, 1, 3));
    const leaf = path('M38 51 C42 45 50 44 53 46 C49 52 43 54 38 51 Z');
    c.drawPath(leaf, fillP('#8ED07A'));
    c.drawPath(leaf, strokeP('#4A8F3E', 1.6));
  }
  c.drawPath(body, strokeP('#7E6A93', ow(2.5, 7)));
  c.drawPath(path('M33 50 C39 44 47 41 54 41'), strokeP('#FFFFFF', icon ? 2.6 : 4, 0.65));
  ellipse(c, 64, 40, 8, 9, fillP('#CDBEDF'), -15);
  ellipse(c, 64, 40, 8, 9, strokeP('#7E6A93', ow(2.2, 5)), -15);
  ellipse(c, 64, 41, 4.5, 5.5, fillP('#F4A9C4'), -15);
  c.drawCircle(74, 53, icon ? 2.7 : 3.8, fillP('#3A2A44'));
  c.drawCircle(85, 60, icon ? 3.5 : 4.5, fillP('#F27BA6'));
  if (icon) {
    c.drawCircle(75, 52, 0.9, fillP('#FFFFFF'));
    c.drawCircle(85, 60, 3.5, strokeP('#B9467A', 1.5));
    c.drawPath(path('M82 61 L93 57 M82 62 L93 64'), strokeP('#7E6A93', 1.2));
  }
}

function crinkle(c: SkCanvas, t: number): void {
  shadow(c, 25);
  c.drawCircle(50, 52, 32, fillP('#5FB8D9'));
  const facet = (d: string, color: string, alpha = 1) => c.drawPath(path(d), fillP(color, alpha));
  if (icon) {
    facet('M24 46 L30 34 L46 48 L30 62 Z', '#A9E2F6');
    facet('M54 56 L72 68 L58 80 Z', '#2F84AC');
    facet('M46 48 L50 24 L62 34 Z', '#E7D9FF', 0.85);
  }
  facet('M30 34 L50 24 L46 48 Z', '#BEEBFA');
  facet('M56 50 L76 42 L72 68 Z', '#3E97BE');
  facet('M30 62 L54 56 L44 78 Z', '#8AD3EE');
  c.drawCircle(50, 52, 32, strokeP('#23708F', ow(2.5, 7)));
  sparkle(c, 34, 36, 10 * (0.9 + Math.sin(t * 5) * 0.1), '#FFFFFF');
}

function chewBone(c: SkCanvas): void {
  shadow(c, 32, 82);
  c.save();
  c.rotate(-20, 50, 52);
  union(c, (p) => boneParts(c, p, 45, 14, 9, 44, 60, 4), '#2F7F70', base('bone', 35, 69, ['#BDF2E2', '#55BFA5'], '#86DCC4'), 2.5, 6);
  const shine = icon ? 'M19 40 C21 37 25 36 28 37 M71 37 C74 36 78 37 80 40 M34 48 L66 48' : 'M34 48 L66 48';
  c.drawPath(path(shine), strokeP('#FFFFFF', icon ? 2.6 : 4, 0.75));
  if (icon) {
    c.drawPath(path('M40 54 L44 54 M48 54 L52 54 M56 54 L60 54'), strokeP('#2F7F70', 1.8, 0.5));
  }
  c.restore();
}

const FEATHER = 'M0 0 C7 7 9 20 2 32 C-5 22 -7 8 0 0 Z';
const FEATHERS: [number, string, string][] = [
  [32, '#7FD6C8', '#3E9C8A'],
  [-32, '#FFD45A', '#C9971E'],
  [0, '#FF8FB8', '#C94C84'],
];

// Bell at (0, -3) with three feathers hanging from (0, 0).
function feathers(c: SkCanvas, sway: number): void {
  const f = path(FEATHER);
  for (const [rot, fill, ink] of FEATHERS) {
    c.save();
    c.rotate(rot + sway, 0, 0);
    c.drawPath(f, fillP(fill));
    c.drawPath(f, strokeP(ink, ow(1.8, 4)));
    if (icon) {
      c.drawPath(path('M0 3 L1.5 29'), strokeP(ink, 1.2));
    }
    c.restore();
  }
  c.drawCircle(0, -3, 4.5, fillP('#FFD45A'));
  c.drawCircle(0, -3, 4.5, strokeP('#B8891E', ow(1.6, 3)));
  if (icon) {
    c.drawPath(path('M-2 -4 C-1 -5 0 -5 1 -5'), strokeP('#FFFFFF', 1.2));
  }
}

function wand(c: SkCanvas, t: number): void {
  shadow(c, 28, 92);
  const stem = path('M20 88 L56 18');
  const stemW = icon ? 3 : 5;
  c.drawPath(stem, strokeP('#7A4A22', stemW + 2 * ow(1.75, 2.5)));
  c.drawPath(stem, strokeP('#C98C55', stemW));
  const grip = path('M20 88 L27 74');
  const gripW = icon ? 5.5 : 8;
  c.drawPath(grip, strokeP('#B9447A', gripW + 2 * ow(1.75, 2.5)));
  c.drawPath(grip, strokeP('#F07AA8', gripW));
  c.drawPath(path('M56 18 C68 20 75 30 74 42'), strokeP('#9E8AB0', icon ? 1.6 : 3));
  c.save();
  c.translate(74, 49);
  feathers(c, Math.sin(t * 3) * 6);
  c.restore();
}

// The pointer body, tip pointing along +x, roughly centred on the origin (55 units long).
function pointerBody(c: SkCanvas): void {
  rrect(c, 22, -5, 7, 10, 2, fillP('#3B3450'));
  rrect(c, -26, -7, 50, 14, 7, base('laser', -7, 7, ['#D9C9F7', '#8C6FD6'], '#A68AE4'));
  rrect(c, -26, -7, 50, 14, 7, strokeP('#5E46A6', ow(2.5, 6)));
  c.drawPath(path('M-20 -3 L14 -3'), strokeP('#FFFFFF', 2, 0.7));
  rrect(c, -9, -11, 11, 5.5, 2.75, fillP('#FF6F91'));
  if (icon) {
    rrect(c, -9, -11, 11, 5.5, 2.75, strokeP('#C23E62', 1.6));
  }
}

function laser(c: SkCanvas, t: number): void {
  shadow(c, 26, 62);
  c.drawPath(path('M62 45 L84 74'), strokeP('#FF4D6A', icon ? 2 : 4, 0.5));
  c.drawCircle(84, 75, 10 * (0.9 + Math.sin(t * 8) * 0.1), fillP('#FF4D6A', 0.22));
  c.drawCircle(84, 75, 4.5, fillP('#FF3355'));
  if (icon) {
    c.drawCircle(83, 74, 1.4, fillP('#FFE3E8'));
  }
  c.save();
  c.translate(38, 28);
  c.rotate(35, 0, 0);
  pointerBody(c);
  c.restore();
}

function duck(c: SkCanvas): void {
  shadow(c, 30, 86);
  union(
    c,
    (p) => {
      ellipse(c, 46, 64, 30, 17, p);
      c.drawCircle(64, 38, 15, p);
      c.drawPath(path('M19 58 L11 43 L30 52 Z'), p);
    },
    '#B8820F',
    base('duck', 21, 81, ['#FFEC94', '#F5B921'], '#FFD84A'),
    2.5,
    6,
  );
  if (icon) {
    const wing = path('M34 61 C40 53 54 55 58 63 C52 71 40 71 34 61 Z');
    c.drawPath(wing, fillP('#F5B921'));
    c.drawPath(wing, strokeP('#C98E14', 1.8));
  }
  const beak = path('M76 38 C86 35 91 40 89 43 C85 47 78 47 76 44 Z');
  c.drawPath(beak, fillP('#FF9A3D'));
  c.drawPath(beak, strokeP('#C26A1E', ow(2, 4)));
  c.drawCircle(68, 34, icon ? 3 : 4, fillP('#3A2A10'));
  if (icon) {
    c.drawCircle(69, 33, 1, fillP('#FFFFFF'));
    ellipse(c, 66, 43, 4, 2.4, fillP('#FF9AB0', 0.65));
    c.drawPath(path('M28 56 C34 52 42 50 50 50'), strokeP('#FFFFFF', 2.4, 0.6));
    c.drawPath(path('M92 28 L97 23 M93 34 L99 34'), strokeP('#F5B921', 2.4));
  }
  ellipse(c, 57, 29, 5, 3, fillP('#FFFFFF', 0.7), -25);
}

const TOYS: Record<string, (c: SkCanvas, t: number) => void> = {
  ball,
  frisbee,
  yarn,
  stick,
  rope,
  mouse,
  crinkle,
  bone: chewBone,
  wand,
  laser,
  squeaky: duck,
};

// ---------- treats ----------

function boneBiscuit(c: SkCanvas): void {
  shadow(c, 32, 82);
  c.save();
  c.rotate(-18, 50, 52);
  union(c, (p) => boneParts(c, p, 43, 18, 10.5, 42, 62, 5), '#9A5E24', base('biscuit', 31, 73, ['#F9D48E', '#D68F3A'], '#EDB462'), 2.5, 6);
  const shine = icon ? 'M18 37 C20 34 24 33 27 34 M70 34 C74 33 78 34 81 37 M34 47 L66 47' : 'M34 47 L66 47';
  c.drawPath(path(shine), strokeP('#FFF0CF', icon ? 2.6 : 4));
  if (icon) {
    for (const [hx, hy] of [[38, 54], [46, 52], [54, 54], [62, 52]]) {
      c.drawCircle(hx, hy, 1.7, fillP('#A8692C'));
    }
  }
  c.restore();
  if (icon) {
    c.drawPath(path('M80 80 L83 78 L84 81 Z M18 78 L21 77 L20 80 Z'), fillP('#D68F3A'));
  }
}

function fish(c: SkCanvas): void {
  shadow(c, 32, 80);
  const body = path('M14 52 C24 32 56 30 70 46 L86 34 C83 45 83 59 86 70 L70 58 C56 74 24 72 14 52 Z');
  c.drawPath(body, base('fish', 30, 74, ['#F9CF85', '#DA8E3E'], '#EDB462'));
  c.drawPath(body, strokeP('#9A5E24', ow(2.5, 7)));
  c.drawPath(path('M34 40 C38 46 38 58 34 64'), strokeP('#B8742F', icon ? 2 : 4));
  if (icon) {
    c.drawPath(
      path('M44 46 Q48 50 52 46 M52 46 Q56 50 60 46 M44 56 Q48 60 52 56 M52 56 Q56 60 60 56 M48 51 Q52 55 56 51'),
      strokeP('#B8742F', 1.8),
    );
    c.drawPath(path('M74 46 L82 42 M74 58 L82 62'), strokeP('#B8742F', 1.6));
    c.drawPath(path('M22 40 C30 35 42 34 52 36'), strokeP('#FFF0CF', 2.6));
  }
  c.drawCircle(25, 48, icon ? 3 : 4.2, fillP('#4A2A14'));
  if (icon) {
    c.drawCircle(26, 47, 1, fillP('#FFFFFF'));
  }
}

function energy(c: SkCanvas): void {
  shadow(c, 34, 84);
  c.save();
  c.rotate(-22, 50, 52);
  rrect(c, 12, 42, 76, 20, 10, base('energy', 42, 62, ['#F29A6A', '#C2552E'], '#D9663A'));
  if (icon) {
    c.drawPath(path('M22 44 L26 60 M32 44 L36 60 M64 44 L68 60 M74 44 L78 60'), strokeP('#A8462A', 2));
    c.drawPath(path('M18 47 L82 47'), strokeP('#FFC9A6', 2.2, 0.8));
  }
  rrect(c, 12, 42, 76, 20, 10, strokeP('#8E3A1C', ow(2.5, 7)));
  c.restore();
  c.drawCircle(50, 52, 15, fillP('#FFE27A'));
  c.drawCircle(50, 52, 15, strokeP('#C9971E', ow(2.5, 5)));
  const bolt = path('M53 40 L43 54 L50 54 L46 64 L57 49 L50 49 Z');
  c.drawPath(bolt, fillP('#FF8A3D'));
  c.drawPath(bolt, strokeP('#B85A1A', icon ? 1.8 : 3));
}

function mood(c: SkCanvas): void {
  shadow(c, 28, 86);
  const heart = path('M50 82 C20 62 14 44 22 34 C30 24 44 26 50 36 C56 26 70 24 78 34 C86 44 80 62 50 82 Z');
  c.drawPath(heart, fillP('#E2A55A'));
  c.drawPath(heart, strokeP('#9A5E24', ow(2.5, 7)));
  c.drawPath(
    path('M50 74 C27 59 22 46 28 38 C34 31 45 32 50 40 C55 32 66 31 72 38 C78 46 73 59 50 74 Z'),
    base('mood', 31, 74, ['#FFC9DD', '#F27BA6'], '#F78DB4'),
  );
  if (icon) {
    c.drawPath(path('M30 44 L36 48 L40 42 L46 48 L50 42 L54 48 L60 42 L64 48 L70 44'), strokeP('#C23E6A', 2));
  }
  c.drawPath(path('M30 39 C33 35 37 34 41 35'), strokeP('#FFFFFF', icon ? 2.6 : 4, 0.75));
}

function kibble(c: SkCanvas): void {
  shadow(c, 32, 86);
  const bit = fillP('#C4A574');
  const edge = strokeP('#8A5A32', ow(1.6, 3));
  for (const [x, y, r] of [
    [36, 46, 6],
    [50, 42, 6.5],
    [64, 46, 6],
    [43, 52, 5],
    [58, 51, 5.5],
  ] as const) {
    c.drawCircle(x, y, r, bit);
    c.drawCircle(x, y, r, edge);
  }
  const bowl = path('M18 56 L82 56 C80 72 70 80 50 80 C30 80 20 72 18 56 Z');
  c.drawPath(bowl, base('kibble', 56, 80, ['#7DCAA8', '#2F7D5B'], '#3E9A72'));
  c.drawPath(bowl, strokeP('#1F5A40', ow(2.5, 7)));
  const rim = path('M16 56 L84 56');
  c.drawPath(rim, strokeP('#1F5A40', 2 + 2 * ow(1.5, 3)));
  c.drawPath(rim, strokeP('#D7F5E8', 2));
}

function meal(c: SkCanvas): void {
  shadow(c, 32, 86);
  if (icon) {
    c.drawPath(path('M40 22 C36 18 44 14 40 10 M52 24 C48 19 56 15 52 10 M64 22 C60 18 68 14 64 10'), strokeP('#D6C3E3', 2.4));
  }
  const mound = path('M22 56 C24 40 40 34 50 36 C62 34 76 40 78 56 Z');
  c.drawPath(mound, fillP('#B8743A'));
  c.drawPath(mound, strokeP('#7A4A22', ow(2.2, 5)));
  if (icon) {
    const meat = fillP('#8F4A2A');
    c.drawCircle(36, 48, 4.5, meat);
    c.drawCircle(58, 44, 5, meat);
    const carrot = fillP('#FF9A3D');
    c.save();
    c.rotate(20, 47, 47);
    rrect(c, 44, 45, 7, 5, 1.5, carrot);
    c.restore();
    c.save();
    c.rotate(-15, 69, 51);
    rrect(c, 66, 49, 6, 4.5, 1.5, carrot);
    c.restore();
    const pea = fillP('#7BC86A');
    c.drawCircle(48, 52, 2.6, pea);
    c.drawCircle(28, 53, 2.4, pea);
    c.drawCircle(70, 42, 2.4, pea);
    c.drawPath(path('M50 37 C50 32 54 29 58 30 M50 37 C48 33 44 32 42 33'), strokeP('#3F8A3A', 2));
  } else {
    c.drawCircle(38, 46, 5.5, fillP('#FF9A3D'));
    c.drawCircle(60, 44, 5.5, fillP('#7BC86A'));
  }
  const bowl = path('M18 56 L82 56 C80 72 70 80 50 80 C30 80 20 72 18 56 Z');
  c.drawPath(bowl, base('meal', 56, 80, ['#D9C9F7', '#8C6FD6'], '#A68AE4'));
  c.drawPath(bowl, strokeP('#5E46A6', ow(2.5, 7)));
  const rim = path('M16 56 L84 56');
  c.drawPath(rim, strokeP('#5E46A6', 2 + 2 * ow(1.5, 3)));
  c.drawPath(rim, strokeP('#E7DBFB', 2));
  const star = path('M50 61 L52.3 66.2 L58 66.7 L53.7 70.4 L55 76 L50 73 L45 76 L46.3 70.4 L42 66.7 L47.7 66.2 Z');
  c.drawPath(star, fillP('#FFD45A'));
  c.drawPath(star, strokeP('#B8891E', icon ? 1.4 : 2.5));
}

const STAR5 = 'M52 20 L60.8 39.9 L82.4 42.1 L66.3 56.6 L70.8 77.9 L52 67 L33.2 77.9 L37.7 56.6 L21.6 42.1 L43.2 39.9 Z';

// Second Wind ends the training rest, so it reads as a burst of air: no moons, no Zs.
function secondWind(c: SkCanvas, t: number): void {
  shadow(c, 26);
  if (icon) {
    const wind = strokeP('#7FC4F5', 3);
    c.drawPath(path('M6 32 C16 27 24 31 20 36 C17 39 12 36 15 33'), wind);
    c.drawPath(path('M3 50 L16 50'), wind);
    c.drawPath(path('M7 64 C13 62 17 64 19 67'), wind);
  }
  union(c, (p) => c.drawPath(path(STAR5), p), '#9A5E24', base('special', 20, 78, ['#F9D48E', '#D68F3A'], '#EDB462'), 2.75, 6);
  c.drawCircle(52, 52, 8.5, fillP('#FF6F9B'));
  c.drawCircle(52, 52, 8.5, strokeP('#C23E6A', ow(1.8, 3)));
  if (icon) {
    c.drawPath(path('M48 49 C49 47 51 46 53 46'), strokeP('#FFD3E1', 1.8));
  }
  sparkle(c, 84, 29, 7 * (0.85 + Math.sin(t * 6) * 0.15), '#FF8FB8');
}

const FROSTING =
  'M28 46 C26 36 36 26 46 28 C52 22 64 26 66 32 C76 32 80 44 74 50 C78 58 70 68 62 66 C58 74 44 74 40 68 C30 70 24 60 28 54 C24 52 24 48 28 46 Z';
const SPRINKLES: [string, string][] = [
  ['M38 40 L42 38', '#4FB7C9'],
  ['M62 46 L66 45', '#8C6FD6'],
  ['M44 52 L46 56', '#FF8A3D'],
  ['M54 34 L57 37', '#F5B921'],
  ['M56 58 L60 56', '#4FB7C9'],
  ['M36 58 L39 60', '#8C6FD6'],
  ['M50 44 L53 46', '#7BC86A'],
  ['M66 56 L68 59', '#F5B921'],
];

function cookie(c: SkCanvas): void {
  shadow(c, 26);
  c.drawCircle(50, 52, 32, fillP('#E2A55A'));
  const frosting = path(FROSTING);
  c.drawPath(frosting, fillP(COOKIE_FROSTING));
  if (icon) {
    c.drawPath(frosting, strokeP('#E07AA4', 1.8));
  }
  c.drawCircle(50, 52, 32, strokeP('#9A5E24', ow(2.5, 7)));
  for (const [d, color] of icon ? SPRINKLES : SPRINKLES.slice(0, 3)) {
    c.drawPath(path(d), strokeP(color, icon ? 3 : 6));
  }
  if (icon) {
    c.drawPath(path('M34 38 C37 33 42 31 46 31'), strokeP('#FFFFFF', 2.4, 0.75));
  }
}

const TREATS: Record<TreatArt, (c: SkCanvas, t: number) => void> = {
  bone: boneBiscuit,
  fish,
  energy,
  mood,
  meal,
  kibble,
  special: secondWind,
  cookie,
};

// ---------- public API ----------

export function treatArt(id: string, species: 'dog' | 'cat' | null): TreatArt {
  if (id === 'kibble') {
    return 'kibble';
  }
  if (id === 'biscuit') {
    return species === 'cat' ? 'fish' : 'bone';
  }
  const item = catalogItem(id);
  if (id === 'second_wind' || item?.effects?.endRest) {
    return 'special';
  }
  if (item?.effects?.fill === 'energy') {
    return 'energy';
  }
  if (item?.effects?.fill === 'mood') {
    return 'mood';
  }
  if (item?.effects?.premiumMeal) {
    return 'meal';
  }
  return TREAT_ART[id] ?? 'cookie';
}

export function drawToyShape(
  c: SkCanvas,
  kind: string,
  x: number,
  y: number,
  radius: number,
  t = 0,
  detail: ArtDetail = 'scene',
): void {
  const draw = TOYS[kind] ?? ball;
  inBox(c, x, y, radius, detail, () => draw(c, t));
}

export function drawTreatShape(
  c: SkCanvas,
  id: string,
  x: number,
  y: number,
  radius: number,
  t = 0,
  species: 'dog' | 'cat' | null = null,
  detail: ArtDetail = 'scene',
): void {
  const draw = TREATS[treatArt(id, species)];
  inBox(c, x, y, radius, detail, () => draw(c, t));
}

export function drawBallShape(c: SkCanvas, x: number, y: number, radius: number): void {
  drawToyShape(c, 'ball', x, y, radius);
}

// Held laser: the pointer body centred on (x, y), pointing along angleDeg, `length` px long.
export function drawLaserPointer(
  c: SkCanvas,
  x: number,
  y: number,
  angleDeg: number,
  length: number,
  detail: ArtDetail = 'scene',
): void {
  withScale(c, x, y, length / 55, detail, () => {
    c.rotate(angleDeg, 0, 0);
    pointerBody(c);
  });
}

// Held wand: the bell sits at (x, y - 3 × scale) and the feathers hang below, swaying with t.
export function drawFeatherBundle(c: SkCanvas, x: number, y: number, scale: number, t = 0, detail: ArtDetail = 'scene'): void {
  withScale(c, x, y, scale, detail, () => feathers(c, Math.sin(t * 3) * 6));
}

// Where the laser beam leaves the pointer drawn by drawLaserPointer.
export function laserTip(x: number, y: number, angleDeg: number, length: number): { x: number; y: number } {
  const k = length / 55;
  const a = (angleDeg * Math.PI) / 180;
  return { x: x + Math.cos(a) * 29 * k, y: y + Math.sin(a) * 29 * k };
}
