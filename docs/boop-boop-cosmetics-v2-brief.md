# Cosmetics v2

This is the drawing spec for neckwear, jackets, and item styling. `docs/boop-boop-wardrobe-brief.md` still owns hats, glasses, and boots. Content ids do not change. The hoodie is the one new id.

## Style

Every item is stroked at width 2 in its color mixed 75% toward `#1e140e`. There is no second outline and no near-fur trim. The pet's sticker outline already wraps worn items.

Shadow is the item color darkened 20%. Highlight is the item color lightened 30%. `d` is the accent and is never recolored. An item with no `d` stripes in its color mixed 65% toward white. Raincoat buttons are the coat color mixed 60% toward `#1e140e`. Hoodie drawstring tips and the pocket edge use `d`. The strings are the coat color lightened 60%. The pocket fill is the highlight.

Bell, tag, and boot shine are short arcs. On a dark coat (fur luminance under 0.22) each part is stroked first at 4px `#FFF4FA` at 80% opacity, inside the pet outline layer.

`pattern` is reserved. When it is absent, or present, the fill is the solid color `c`.

## Neckwear

Side and 3/4 neckwear drops about `0.12 × headR` below the chin anchor, so the band sits on the jaw, covers the neck stroke, and leaves the mouth clear. Front stays on the chest. Back and back 3/4 stay knot only.

Draw order: on the side the neckwear draws after the head, including when the face is turned. On the front and front 3/4 it draws before the head, so the face covers the part that crosses the muzzle and the tails below the chin stay visible. While the pet is lying, neckwear still draws under the head. The neck stroke is fur, drawn before any jacket, so the coat covers it. The collar and hood still draw after the coat.

The scarf keeps id `scarf` and color `#e8c53a`. Its band is `0.32 × headR` along the neck stroke, with three diagonal stripes and a dashed knit line. The knot is about `0.3 × 0.25 headR`. Two tails are `0.75 × headR` by `0.3 × headR`, each with one stripe and a three-stroke fringe. Collar, bandana, bow, bell, and gold keep their shapes. Bell and gold share the collar shape.

Dangling parts hang from a pose base, then the swing spring:

- Stand and walk hang straight down.
- Sit hangs along the chest, `0.05 × headR` off the chest.
- Lie hangs forward, 10° below horizontal, on the foot line.
- Belly-up draws the band only and hides scarf tails, the hood, drawstrings, and collar flaps.

## Swing

The actor carries `swing`, `swingVel`, `prevVx`, and `axSmooth`. Acceleration is `(vx − prevVx) / dt`, smoothed over about 150ms. Lean is `clamp(−0.0006 × axSmooth, ±0.21)`. The target is that lean plus `0.06 × sin(phase) × walk`, or 0 when motion is reduced. The spring uses stiffness 60 and damping 9, and `swing` stays within ±0.21. Dangling parts rotate by `swing × facing`. `prevVx` starts equal to `vx`, and it is seeded again whenever a teleport or scene change clears `swingVel`.

`0.0006` is the starting gain: about 350 px/s² reads as 12°. It can be tuned if the tails pin against the clamp.

## Jackets

Each shape is the pet's own body oval, plus `coatPad` (0.16 of the smaller body radius) so a long dog and a round cat both stay covered. Numbers live in `wardrobeSizes`.

Sleeves are sweater and hoodie only. `jacketHasSleeves` is false for the vest, puffer, and raincoat. A sleeve starts `sleeveTuck` back up the hip-to-knee bone so it sits inside the coat, then runs `sleeveUpper` (0.92) of that bone. Its radius is `sleeveWidth × legWidth` (0.78). The leg stroke's own radius is 0.5 of `legWidth`, so the sleeve is wider than the leg. The armhole radius is `armhole × legWidth` (0.42), inside the sleeve, so the coat overlaps the top of the leg. Far sleeves darken like far legs.

Draw order for the torso: neck stroke, then a puffer (no armhole), then the near legs. Vest, sweater, hoodie, and raincoat paint after those legs, with a hole at each fore hip, so the leg or sleeve passes through. The collar and the hoodie or rain hood paint after that.

- Puffer: baffles around the full body oval, each bulging past it, with vertical seams and a rolled collar. No sleeves.
- Sweater: the full body oval, a ribbed hem on that bottom edge, cables, and sleeves.
- Hoodie: the sweater body and sleeves, plus a hood about `0.55 × headR`, a pocket, and two strings `0.4 × headR`.
- Raincoat: the full body oval, hem at the bottom of that oval, flare past the sides. While sitting, each hem point is clamped so it does not pass the foot line. No sleeves. The hood is the collar pass.
- Vest: the full body oval, quilting, a gold zip, and a collar. No sleeves. Forelegs use the same armholes as the sleeved coats.

Front and back fill a panel on that view's body oval, padded the same way. 3/4 uses the foreshortened side silhouette. The fur chest bib hides while a jacket is worn in 3/4. A belly-up jacket flips with the torso.

## Turns

Side, front 3/4, and back 3/4 share the side coat, so they do not crossfade with each other. A turn between that family and the front panel draws both fills in the torso pass. The outgoing view is `octantFrom` at `1 − octantBlend`. The incoming view is `octant` at `octantBlend`.

While the back panel's weight is above 0, the side coat still draws in the first torso pass at the side weight, and the back jacket draws again after the head. That second pass is the jacket only. The fur rump oval stays tied to a settled back view.

The near legs draw once. They draw in the early leg pass, unless the back weight is above 0, in which case they draw after the hood. A settled pet keeps `octantBlend` at 1, so the previous coat is at weight 0. Leaving back can leave `octantFrom` on back with weight 0, and that does not move the legs.

The hoodie hood draws at the old raincoat-hood site on side and back 3/4, weighted by the side coat, and again in the back pass, weighted by the back coat. The front hides the hood.

## Shop

The hoodie is sold the same way as the sweater and the vest: 1600 coins, always in stock. Its id is `hoodie`, its label is Hoodie, and its colors are `#FF9FCB` and `#8A5AD6`.
