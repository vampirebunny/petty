# Clothing redraw: brief for Cursor

Redraw every jacket, hat, neckwear piece and boot in `render/skia/cosmetics.ts`, and add per-part colors and patterns to the wardrobe data. The rig, anchors and pose logic stay as they are. Only the shapes, details and colors change.

The approved designs are in `reference/` (one SVG per item on the pet, plus its Closet icon). `reference/clothes.py` is the script that drew them, so it holds the exact numbers. Where this brief and the SVGs disagree, the SVGs win on looks and this brief wins on structure.

## Decisions

Where this section disagrees with the rest of the brief, this section wins. Dogs and cats share one drawing path. Jacket shapes are fractions of the body ellipse. Detail pitch is `headR`. Hats stay in head space. Neckwear and boots keep their current anchors. No species branches and no anchor moves.

- `PATTERN_PARTS` stays the default set for an item-level `pattern` when `patternParts` is omitted. The part table below is the fill table (`PART_DEFAULTS`), not a replacement for that set. `colorway.parts` may name any part in the fill table. A string value is a hex color. An object is `{ pattern, c?, d? }`. Unknown names and bad values are dropped, not rejected. Glasses keys stay empty, so a patterned party hat or glasses row is still rejected.
- Accept remote `v` 1 and 2. `DEF_SCHEMA_MAX` is 2 and `acceptDef` checks it. v1 rows keep working. A live row that sends `parts` or `baffles` needs `min_app_version` on the build that understands them. There is no shop SQL migration: `shop_items` has no shape column, and bundled ids ignore remote defs.
- The raincoat has no sleeves. `jacketHasSleeves` returns false for it. Its hood is drawn from `drawJacketCollar`, which already has the neck frame, so actor callers do not change. The hoodie hood stays on the side pass and the back pass.
- Bell radius follows the SVG: `0.24r`. The red-boot cuff flare is `0.047 × headR` on each side.
- Hats are transformed from the `r = 30` paths into stage space. Detail strokes scale by `r / 30`. Do not scale the canvas, so the outline and the dark-coat halo stay in stage pixels. One `hatSeat` for every breed. `hatScale` is 1.
- Icon `outlineScale = 1 / k` applies only inside the jacket and boot icon branches. Hats and neckwear icons are not scaled by `k`.
- When a part has a pattern, draw the pattern and skip `shadePattern` on that part. Texture (cables, ribs, quilting, seams) draws at `0.45×` alpha.
- These default colors change on purpose: beanie pom is `d ?? light(c, .45)`, puffer collar is `d ?? light(c, .5)`, rain-boot sole is `d ?? shade(c, .5)`.
- The parts sample (gingham bandana, plaid sweater with a solid rib, baffle puffer, sneakers with a colored sole) is a test and a debug-lab preset. It is not a closet row.

## Ground rules

- **Keep the plumbing.** Keep `paintShape`, `outlineOf`, the dark-coat trim (`isDarkCoat` → light halo), the chin, perp and along math, `bandEnds`, `hangVector`, `poolHem`, the jacket passes (`side`, `front`, `back`), `breath`, `jacketAlpha`, and every exported function signature. Callers in the actor code should not change.
- **Color helpers.** `shade(c, k)` means `mix(c, '#000000', k)` and `light(c, k)` means `mix(c, '#ffffff', k)`. The existing `shadowTone` (k = 0.2) and `highlightTone` (k = 0.3) are special cases.
- **Detail size comes from `headR`, repeat count comes from length.** Cable columns, puffer baffles, quilting and rib ticks have a size set in `headR` units. A long body (dachshund) gets *more* of them, never stretched ones. This is the main fix for the "tube" look.
- **No white dots as decoration.** Replace any round dot detail (sneaker laces, hoodie string ends, collar studs, the crown sparkle) with a line, a capsule or a diamond.
- **Add constants to `wardrobeSizes`.** Every new number in this brief becomes a named constant there, next to the ones it replaces.

Notation used below. In the jacket side pass, the torso is the ellipse centred at `(0, bodyY)` with `a = bodyLen / 2` and `b = (bodyH / 2) × breath`. Front is +x. The fit that shipped uses `o = coatPad × min(a, b)` from `wardrobeSizes`, not `0.1 b`, and the sweater, hoodie, vest, puffer, and raincoat wrap that oval. See `docs/boop-boop-cosmetics-v2-brief.md`. The two edge points are:

```
top(u, o) = ( u (a + o), bodyY − (b + o) √(1 − u²) )
bot(u, o) = ( u (a + o), bodyY + (b + o) √(1 − u²) )
```

"Arc to" means following that offset ellipse, clockwise. `r` is `headR` everywhere.

---

## 1. Data: per-part colors and patterns

In `actor/wardrobe.ts`:

```ts
export type PatternId = 'stripes' | 'gingham' | 'plaid' | 'daisies' | 'stars' | 'rainbow';

// A part is a solid color ('#RRGGBB') or a pattern, optionally with its own two colors.
export type PartFill = string | { pattern: PatternId; c?: string; d?: string };

export type Colorway = {
  c: string;
  d?: string;
  pattern?: PatternId;
  accent?: CollarAccent;
  parts?: Partial<Record<string, PartFill>>; // keyed by the part names in PATTERN_PARTS
  baffles?: string[]; // puffer only: one color per baffle, repeating
};
```

Add `resolvePart(item, part): { color: string; pattern: PatternPaint | null }` in `cosmetics.ts`. It resolves in this order:

1. `colorway.parts[part]`, if set.
2. `colorway.pattern`, if `part` is in `item.patternParts` (or in the shape's default `PATTERN_PARTS` list when `patternParts` is omitted).
3. The default color for that part from the table below.

Every shape reads its fills through `resolvePart`, so existing catalog items render exactly as before and new items can set any part.

Replace `PATTERN_PARTS` with this table (shape → parts → default fill):

| Shape | Parts and default fill |
|---|---|
| beanie | `crown` c · `cuff` shade(c, .14) · `pom` d ?? light(c, .45) |
| party | `crown` c · `trim` d · `pom` d |
| top | `crown` c · `brim` c · `band` d ?? light(c, .55) |
| cap | `crown` c · `brim` d ?? shade(c, .2) |
| bucket | `crown` c · `band` d ?? shade(c, .2) · `brim` c |
| beret | `crown` c |
| crown | none (gold c, gems d and #5AA9E6) |
| collar | `band` c · `charm` d ?? '#f0c94a' |
| bandana | `cloth` c · `band` shade(c, .12) |
| scarf | `band` c · `tail` c |
| bow | `loop` c |
| bowtie | `wing` c · `knot` d ?? c |
| sweater | `body` c · `rib` d ?? stripeTint(c) |
| hoodie | `body` c · `rib` shade(c, .1) · `pocket` light(c, .22) · `lining` light(c, .45) |
| puffer | `body` c (or `baffles`) · `collar` d ?? light(c, .5) |
| vest | `body` c · `collar` shade(c, .12) |
| raincoat | `body` c · `lining` shade(c, .3) · `strip` '#E9ECF2' |
| red (boots) | `shaft` c · `cuff` shade(c, .22) · `sole` shade(c, .55) |
| rain | `shaft` c · `sole` d ?? shade(c, .5) |
| sneaker, hightop | `upper` c · `sole` '#e4e1dc' · `stripe` d ?? '#d64545' · `laces` outlineOf(c) |

Other data changes:

- **High-tops.** Add a `hightop` shape to `KNOWN_SHAPES.boots`. It is the sneaker with a taller shaft. Change Gold High-Tops in `wardrobe` (and in the Supabase catalog) from `sneaker` to `hightop`.
- **Rainbow Puffer.** Change it to `baffles: ['#FF8CC4', '#FFB15C', '#FFE16B', '#8FE3A8', '#7EC8F5', '#B9A2F5']` and drop its `rainbow` pattern.
- **Remote catalog.** Bump `DEF_SCHEMA_MAX` to 2. Accept optional `parts` and `baffles` in remote definitions. Validate every part name against `PATTERN_PARTS`, and every value as a hex color or a known pattern. Drop unknown parts rather than rejecting the item.
- **`wear()` helper.** Add an optional `parts` argument. Do not change the existing positional arguments.

**Patterns under texture.** When a part has a pattern, draw `drawItemPattern` first and the shape's texture (knit, cables, quilting, baffle seams, ribs) on top at `0.45×` its normal alpha. Structure stays readable without fighting the pattern. Pattern scale stays `r × 0.1`, as today.

---

## 2. Jackets: side pass (`sideSilhouette` + `drawJacketDetails`)

### Sweater: neck to hips, cable knit

Silhouette:

- Start at `P0 = top(−0.70, o)`. Arc to `top(0.93, o)`, then arc around the front to `B1 = bot(0.82, o)`.
- Hem: quad via `(0.35a, bodyY + b + o)` to `H1 = (−0.15a, bodyY + 0.72b)`, then quad via `(−0.5a, bodyY + 0.6b)` to `(P0.x + 0.04b, bodyY + 0.3b)`.
- Rear: quad via `(P0.x − 0.12b, bodyY − 0.2b)` back to `P0`. Close.

Details, clipped to the silhouette:

- **Cables.** Columns every `0.5r`, from `P0.x + 0.4r` to the front. Each column is two mirrored braid lines. Each line zigzags down from `bodyY − b − 0.2r` to `bodyY + b` in quads of step `0.23r` and amplitude `0.11r`. Stroke `shade(body, .2)`, width `0.047r`.
- **Rib band.** Along the hem path from `B1` back to `P0`: a stroke of `rib`, width `0.27r`. On top, the same stroke in `shade(rib, .16)` with dash `[0.04r, 0.08r]` and a butt cap, which gives the rib ticks.
- **Highlight.** Quad from `top(−0.5, −0.17b)` via `(0, bodyY − b − 0.12b)` to `top(0.6, −0.17b)`. Stroke `light(body, .35)`, width `0.07r`, alpha 0.7.

Elsewhere:

- `drawJacketCollar` (sweater): keep the turtleneck geometry, but color it `rib` and keep the rib dashes.
- `drawSleeve`: cuff in `rib`, with rib dashes across it.

### Puffer: baffles across the back

Silhouette, as one shape (not a union of ovals):

- `ur = −0.86`, `uf = 0.92`, `ub = 0.84`.
- Baffle count: `n = max(3, round((uf − ur) · a / (0.73r)))`.
- Top boundaries: `ut[i] = ur + (uf − ur) · i / n`. Bottom boundaries: `ubt[i] = ur + (ub − ur) · i / n`.
- Path:
  1. `M top(ut[0], o)`.
  2. For each baffle, a quad via `top(mid, o + 0.29b)` to `top(ut[i+1], o)`. This bulges each baffle upward.
  3. Arc around the front to `bot(ubt[n], o)`.
  4. Back along the belly, a quad via `bot(mid, o + 0.25b)` to each `bot(ubt[i], o)`.
  5. Quad via `(top(ur).x − 0.2b, bodyY)` to the start. Close.

Details, clipped:

- **Baffle fills.** With `baffles` set, fill each baffle's x-range with its color. Otherwise use `body`.
- **Seams.** At each inner boundary, a quad from `top(ut[i], o)` via `(midX − 0.12b, bodyY)` to `bot(ubt[i], o)`. Stroke `shade(baffleColor, .28)`, width `0.06r`.
- **Per baffle.** A top highlight arc in `light(color, .5)`, width `0.09r`, alpha 0.9. A lower shadow arc at `bodyY + 0.55..0.75b` in `shade(color, .18)`, alpha 0.6.
- **Hem.** Remove the old scallop hem stroke. The silhouette now carries the scallops.
- **Collar.** The puffy collar is `collar` colored, with its existing highlight.

### Vest: shoulders and chest, quilted

Silhouette:

- `P0 = top(−0.18, o)`. Arc to `top(0.93, o)`, arc around the front to `bot(0.72, o)`, then arc along the belly back to `bot(−0.18, o)`.
- Rear: quad via `(bot(−0.18).x − 0.17b, bodyY)` to `P0`. Close.

Details, clipped:

- **Quilting.** Diagonal lines both ways, every `0.33r`. Stroke `shade(body, .28)`, width `0.04r`, alpha 0.8.
- **Binding.** Along the hem and rear edge: `shade(body, .2)`, width `0.17r`.
- **Highlight.** Along the upper back.
- **Zip.** A line from `(0.84a, bodyY − 0.5b)` to `(0.84a − 0.08b, bodyY + 0.9b)` in `#e0b43c`, width `0.07r`. A small gold pull (trapezoid, about `0.15r × 0.23r`) sits at the top.

Elsewhere:

- Remove the armhole arc in `drawChestDetails`.
- Remove the old `quilt()` helper.
- The collar is `drawJacketCollar` (vest) in `collar`.

### Raincoat: a cape that stops above the belly

Silhouette:

- Rear point `R = (−a − 0.25b, bodyY − 0.1b)`. With `o2 = 0.125b`:
  1. `M R`, then quad via `(R.x − 0.04b, top(−0.82, o2).y − 0.08b)` to `top(−0.82, o2)`.
  2. Arc to `top(0.84, o2)`.
  3. Front: quad via `(a + 0.33b, bodyY − 0.25b)` to `F = (0.97a, bodyY + 0.35b)`.
- Hem: quad via `(0.3a, bodyY + 0.5b)` to `(−0.3a, bodyY + 0.58b)`, then quad via `(R.x − 0.17b, bodyY + 0.66b)` to `(R.x − 0.25b, bodyY + 0.4b)`.
- Rear: quad via `(R.x − 0.25b, R.y + 0.08b)` to `R`. Close.
- Run the hem points through `poolHem` as the current raincoat does. The belly fur must stay visible below the hem in every pose.

Details, clipped:

- **Hem binding.** `shade(body, .25)`, width `0.15r`.
- **Reflective strip.** The hem curve shifted up by `0.33b`, drawn in three strokes: `shade(body, .35)` at width `0.15r`, then `strip` at `0.11r`, then white at `0.033r` with alpha 0.8.
- **Gloss.** Along the back: white, width `0.1r`, alpha 0.55.

Elsewhere:

- **Toggles.** Two, at `(0.86a, bodyY − 0.3b)` and `(0.9a, bodyY + 0.02b)`. Each is a `#7A4A22` rounded rect of `0.23r × 0.11r`, rotated −20°, with a short loop line in `shade(body, .45)`.
- **Hood.** Delete `drawCollarFlaps` and give the raincoat a hood. Use the same placement as `drawHood`. Shape and lining are in `reference/j-raincoat-pet.svg` (hood size about `1.25r × 1r`, lining `shade(body, .3)`, white shine arc).

### Hoodie: full sleeves, pocket, hood with ears

Silhouette:

- Same as the sweater with `ur = −0.82` (rear point `P0`).
- Hem: quad via `(0.3a, bodyY + b + o + 0.04b)` to `(−0.2a, bodyY + 0.92b)`, then quad via `(−0.62a, bodyY + 0.82b)` to `(P0.x + 0.04b, bodyY + 0.42b)`.

Details:

- **Rib band.** Along the hem in `rib`, width `0.23r`, with rib dashes.
- **Highlight.** Along the back, as on the sweater.
- **Pocket.** Moved from `drawChestDetails` into the side details. A rounded shape from `x = −0.12a` to `0.42a` and `y = bodyY + 0.1b` to `bodyY + 0.62b`. Fill `pocket`, outline `shade(body, .3)` at width `0.05r`, and a dashed stitch line just under its top edge in `d`.
- **Drawstrings.** Keep the swing logic. Replace the round ends with capsules (`0.09r × 0.17r`) in `d`.
- **Hood.** The existing `drawHood` blob, plus two ears on its top edge: circles of radius `0.2r` in `body` with `0.1r` insides in `lining`. Add a fold line in `shade(body, .25)` and a white shine.
- **Sleeves.** Cuffs in `rib`.

### Front and back passes (`panelPath`)

Apply the same part colors and textures to the panel ovals:

- **Sweater.** Cables vertical across the panel, rib band at the hem.
- **Puffer.** Two horizontal seams across the panel.
- **Vest.** Quilting. The back strip stays.
- **Raincoat.** End the flared panel at `0.6×` its current height, and draw the reflective strip across it.
- **Hoodie.** Pocket centered on the front panel. Hood only on the back pass.

---

## 3. Hats

The hats are authored as SVG path data for `r = 30`, origin at the centre of the hat's base, y up negative. Draw them with `Skia.Path.MakeFromSVGString(d)` under `c.scale(r / 30, r / 30)`. Paths are verbatim from the reference.

In `drawHat`:

- Set `hatScale` to `1` (the new hats are drawn smaller on purpose).
- Keep `translate(face.top.x, 0)`. Add `hatSeat` to `wardrobeSizes`: the y offset, in `r`, where the hat base sits. Tune it so each hat rests between the ears without floating.
- Rotate −10° in side and 3/4 view (tipped back). Use 0° in front and back view.

**Beanie** (`crown`, `cuff`, `pom`)
- `crown`: `M-19 -4 C-21 -24 -8 -31 3 -30 C14 -29 21 -20 19 -4 Z`
  - Ribs: for x in −12, −6, 0, 6, 12, a line from `(x, −6)` to `(0.8x, −28)` in shade(crown, .12), width 1.3.
  - Highlight: `M-12 -22 Q-4 -28 6 -26` in light(crown, .4), width 2.2, alpha .75.
- `cuff`: `M-21 -9 Q0 -12 21 -9 L21 0 Q0 3 -21 0 Z`
  - Ribs: `M-21 -4.5 Q0 -6 21 -4.5` in shade(c, .3), width 9, dash `[1.3, 2.4]`, butt cap.
- `pom`: circle at `(−2, −33)`, radius 7.5.
  - Texture: `M-6 -35 Q-2 -39 2 -36 M-3 -30 Q1 -32 4 -29` in shade(pom, .15), width 1.1.
  - The pom follows `pom`, never hard-coded white.

**Party** (`crown`, `trim`, `pom`)
- `crown`: `M-13 0 L13 0 L1 -42 Z`
  - Stripes, clipped: for y in −4, −14, −24, −34, a line from `(−20, y)` to `(20, y − 9)` in `d`, width 4.5.
- `trim`: `M-14 -3 Q0 -5 14 -3 L14 2 Q0 4 -14 2 Z`
- `pom`: circle at `(1, −44)`, radius 5.5.
- Elastic: `M12 1 Q20 20 14 44` in white, width 1.1, alpha .6. Side view only; never in the icon.

**Top hat** (`crown`, `brim`, `band`)
- `brim`: `M-16 -1 Q0 -6 16 -1 Q16 4 0 4 Q-16 4 -16 -1 Z`
- `crown`: `M-9.5 -2 L-9 -27 Q0 -29 9 -27 L9.5 -2 Q0 0 -9.5 -2 Z`
  - Shine: `M-5 -24 L-5 -8` in light(crown, .35), width 2, alpha .8.
- `band`: `M-9.5 -9 Q0 -11 9.5 -9 L9.5 -3 Q0 -1 -9.5 -3 Z`
- Draw order: brim, crown, band.

**Cap** (`crown`, `brim`)
- `brim`, drawn first: `M8 -3 C22 -6 34 -2 35 3 C27 7 16 6 7 3 Z`. It points toward the muzzle.
- `crown`: `M-18 0 C-19 -22 18 -24 18 0 Z`
  - Seams: `M0 -18 Q-6 -10 -8 0 M0 -18 Q6 -10 8 0` in shade(crown, .22), width 1.4.
  - Highlight: `M-11 -14 Q-4 -20 4 -19`.
- Button: circle at `(0, −19.5)`, radius 2.6, in `brim`.
- Keep the existing `eyeLimit` tilt on the brim. Front and back views keep their current logic, restyled with these fills.

**Bucket** (`crown`, `band`, `brim`)
- `crown`: `M-12.5 -3 C-13 -20 13 -20 12.5 -3 Z`, with highlight `M-8 -14 Q-2 -18 5 -17`.
- `band`: `M-13 -7 Q0 -9 13 -7 L13 -2 Q0 0 -13 -2 Z`
- `brim`: `M-25 3 C-21 -4 21 -4 25 3 C27 7 21 9 14 6.5 C6 4.5 -6 4.5 -14 6.5 C-21 9 -27 7 -25 3 Z`
  - Stitch: `M-21 3.5 C-12 -0.5 12 -0.5 21 3.5` in shade(c, .25), width 1.2, dash `[2, 1.8]`.

**Beret** (`crown`). The whole hat gets an extra rotate of −10° (0 in front view).
- Disc: `M-23 -6 C-22 -16 22 -18 24 -7 C25 -1 -24 2 -23 -6 Z`, with highlight `M-14 -12 Q-2 -17 10 -14`.
- Band: `M-12 -2 Q0 -5 12 -2 L12 1 Q0 3 -12 1 Z` in shade(c, .2).
- Stalk: `M4 -14 Q5 -18 8 -19`, stroked in outlineOf(c) at width 3.6, then in c at width 1.6.

**Crown** (no pattern parts)
- Body: `M-14 0 L-14 -14 L-7 -7 L0 -19 L7 -7 L14 -14 L14 0 Z` in c, with shine `M-9 -10 L-6 -6`.
- Band: `M-14.5 -5.5 L14.5 -5.5 L14.5 0.5 L-14.5 0.5 Z` in shade(c, .14).
- Tip balls: circles of radius 2.3 at `(−14, −15.5)`, `(0, −20.5)`, `(14, −15.5)`.
- Band gems: ellipses (rx 2.4, ry 1.8) at `(−8, −2.5)` in d, `(0, −2.5)` in #5AA9E6, `(8, −2.5)` in d.
- Center gem: diamond `M0 -13 L2.4 -10 L0 -7 L-2.4 -10 Z` in d. Its alpha pulses with `t` (unless `reduced`) in place of the old white spark.

---

## 4. Neckwear

Keep all the anchor, band, flat, lying and hang math. In the reference, x maps to `spanDir(...)` and y maps to `hangDir`.

- **Collar.**
  - `collarBand` 0.22 → 0.27, with a thin `light(band, .3)` shine along it.
  - The round tag becomes a **heart** charm. Half-size `0.24r`, hanging from a ring of radius `0.07r`, with a white shine stroke. Path: `reference/n-collar-pet.svg`, function `heart()` in `clothes.py`.
  - The bell keeps its size and gains the slot line and shine from the reference.
  - Studs: round dots become diamonds (half-size `0.08r`) in `d`, outlined in outlineOf(c).
- **Bandana.**
  - In side view, the cloth spans `0.22 → 0.96` of the band (was `0.45 → 1`), so the triangle is wider.
  - `bandanaBandWidth` 0.16 → 0.17.
  - Add a soft `light(cloth, .4)` fold highlight in the middle of the cloth.
  - Knot and tails unchanged.
- **Scarf.**
  - Band thickness `0.32r` → `0.42r`. Add rib dashes (`shade(band, .2)`, alpha .55) and a light shine.
  - Knot `0.2r × 0.16r`.
  - Tails: length about `0.9r`, half-width `0.15r`. Each has a `light(tail, .45)` stripe near the end and three short fringe strokes in `shade(tail, .2)`.
- **Bow.** Replace the triangle wings with rounded **loops**. Per side (s = ±1, from knot K):
  - Cubic to `K + s·(0.35r, −0.55r)`, `K + s·(0.75r, −0.4r)`, `K + s·(0.62r, 0.05r)`, then cubic back via `K + s·(0.5r, 0.32r)`, `K + s·(0.2r, 0.12r)` to K. The x offset is `s·`, the y offset is not.
  - A fold line inside each loop in `shade(loop, .22)`.
  - Two **tails** with notched (V-cut) ends, hanging about `0.65r`, in `shade(loop, .08)`.
  - Knot oval `0.13r × 0.15r` in shade(c, .15).
- **Bow tie.** Wing reach 0.575 → 0.6. The knot is a rounded rect `0.22r × 0.26r` in `knot`. Add a light shine line on each wing.

## 5. Boots

Edit `drawBoot`. The single-outline shaft and toe stay.

- **Red.**
  - The cuff becomes a fold-over band. It runs from `top − 0.1 shaftR` to `top + 1.1 shaftR`, is `1.4` wider than the shaft on each side, and has a rounded lower edge. Fill `cuff`.
  - Sole in `sole`.
- **Rain.**
  - `rainTop` = 0.35, so the shaft is taller than the red boot's.
  - Chunky sole: `soleH = max(bootSole, toeRy × 0.45)` in `sole`, with 4 short tread notches in `shade(sole, .35)`.
  - Add a pull-tab loop at the top back (the `side` direction), stroked as an outlined quad.
  - Keep the shine and the dark rim.
- **Sneaker and high-top.**
  - Top fraction: `sneakerTop` 0.78 for sneakers, `hightopTop` 0.55 for high-tops.
  - Replace the lace dots with 2 lines (3 for high-tops) across the front of the shaft, in `laces`.
  - Two accent stripes in `stripe` along the side of the foot, widths `0.16 toeRy` and `0.12 toeRy`.
  - A padded collar: a rounded band at the top in `shade(upper, .08)`.
  - Sole in `sole`, with a darker line along its top edge.

## 6. Closet icons (`itemIcon.ts`)

- **Remove the ghost pet.** Delete the two `fillOval(..., '#c4a882', 0.12)` calls in the jacket icon. Icons show the garment alone.
- **Thinner outline in icons.** Icons are scaled up by `k`, so their outline gets too heavy. Add a module-level `outlineScale` in `cosmetics.ts` that `paintShape`, `outlinedLine` and `outlinedQuad` multiply into `sizes.outline`. Set it to `1 / k` while `drawItemIcon` runs and restore it after.
- **Hats** in icons use side view at a −6° tilt and skip the party-hat elastic.
- **Neckwear icons** keep using the side-view neck frame.

## 7. Check on device

Test every item on:
- a retriever, a dachshund, a short-legged breed and a cat;
- puppy, adult and senior;
- a light coat and a dark coat (the dark coat should show the light halo on every new shape).

Poses to cover: stand, walk, run, sit, lie, sleep, belly-up and jump. Plus:

- **Dachshund jackets.** More cables, baffles and quilt diamonds than on the retriever, and no stretched details.
- **Raincoat.** Belly fur visible below the hem in every pose, including sit (`poolHem`).
- **Hats.** Each one sits between the ears in side, 3/4 and front view, and the cap brim never covers an eye.
- **Neckwear.** Collar charms, bells and bandana tips never sink into the floor when lying. Keep the `neckLieHang` clamps.
- **Patterns.** A `parts` test item renders with a gingham bandana cloth, a plaid sweater body with a solid rib, a color-block puffer via `baffles`, and sneakers with a colored sole and contrasting laces.
- **Catalog compatibility.** Every existing catalog item, including the remote ones, renders without changes to its data.
- **No white dots anywhere.**

## Out of scope

- Glasses.
- Toys and treats (separate brief).
- New patterns. Adding one later is one drawing in `patterns.ts`, and any part can use it.
- Any change to the rig, poses or attachment points. If a design can't fit a pose without moving an anchor, stop and send a screenshot instead of moving the anchor.
