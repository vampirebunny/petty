# Boop Boop — Catalog art brief (rev 2): patterns, new shapes, toys, furniture

This replaces rev 1 and answers your review. **Treats are on hold** (Part F) until we settle how they work. Build this after cosmetics v2.

**Visual reference:** the "Boop Boop cosmetics v2" canvas: **New clothing shapes**, **New toys, furniture and treats**, and **Patterns**. The canvas dog is hand-drawn. Place everything with our anchors.

**Scope**
- In: drawing code and item definitions; toy play rules; the furniture plumbing for the dog house and the cat tree; the new squeak sound.
- Out: prices, tiers, caps, NPC access and shop availability, which belong to the seed brief. Every new shop row stays `hidden`, including `food_fish`.
- **Dev grant screen** (dev builds only): a list of every catalog item **plus every furniture kind** (`dogHouse`, `catTree`, which aren't catalog rows yet), each with a Grant button. It writes to the right store by kind: clothing to the Closet, toys to `owned_toys`, furniture to an owned-furniture row (which also places it at its default spot).

---

## Part 0: Switch drawing on shape, not id (do this first)

Hats, boots, neckwear and glasses still pick their drawing by id, so a new id such as `beanie-pink` falls through to the wrong shape.

- **Every slot draws by `shape`**, as jackets already do: hats, boots, neckwear and glasses. Unknown shapes draw nothing and log a warning. They never fall back to another item's shape.
- **Glasses:** key `glassesStyles` by shape. Existing ids map to their current styles: `classic` → wayfarer, `square` → round, `red-rim` → soft.
- **Ids:**
  - The wear id stays the **short id** (`bandana-cherry`), used by `wearItem` and the Closet.
  - The shop and ledger id is `slot:wearId` (`neckwear:bandana-cherry`).
  - The tables below give the short id.
- Existing items must draw exactly as before. Screenshot-diff them before and after.

---

## Part A: Patterns

### Data
`Colorway.pattern`: `stripes | gingham | plaid | daisies | stars | rainbow`. Base `c`, motif `d`. The plaid accent is always `#F0C94A` for now.

### Unit
`u = 0.1 × headR`.

### Drawing
1. Fill the part with `c`.
2. Clip to the part and draw the pattern in **item-local space**, so it rotates, flips and squashes with the item. That includes stars: they're upright relative to the item, so they tilt with a tilted beret.
3. Shading from `c` on top at 35% alpha, then the 2.0 item line.
4. **Which parts get a pattern is explicit per shape** (`patternParts`). No width threshold.
   - **Patterned:** body panels, hat crowns, bandana triangles, scarf bands and tails, bow-tie wings, collar bands.
   - **Solid `c`:** straps, strings, cuffs, brim edges, the bow-tie band, knots, buttons.
   - `top-velvet` patterns the **hatband only**. A patterned top-hat band fills with `c` and lays the `d` stars on top. The plain top hat has no pattern, so its band keeps today's fill (its `d`, the pale band) and stays pixel-identical.

### Cache
- **Cache one tile per `(pattern, c, d, u rounded to 0.5 px)`** as a recorded Skia picture, drawn untransformed, horizontal, at the origin. **The tile is the whole repeat cell**: two rows for the staggered daisy and star grids, so it repeats seamlessly.
- **At draw time**, apply the item transform plus a per-slot angle and tile it across the clipped part, so angle and placement aren't in the key.
- **Daisies:** the tile holds two daisies at two fixed rotations (as on the Patterns board), so no per-item seed is needed.
- **Rainbow isn't cached.** It's six bands sized to each part's own height, drawn directly as six rects per part.
- If a cached picture tiled under a clip is too slow on a low-end device, tell me before reaching for a runtime effect.

### Specs (in u)

| Pattern | Spec | Angle at draw time |
|---|---|---|
| Stripes | `d` bands, 1u wide, 1u apart | 30° on scarves and bandanas; horizontal on hats and boots; on jackets, **horizontal in each pass's own panel space** (along the spine in the side view, across the chest on the front panel, across the rump on the back panel) |
| Gingham | Drawn as three explicit tones in the tile, not by blending: `c` base, `d` bands at 45% mixed into `c`, and the **crossings as their own squares**, `d` at 75% mixed into `c`. 1u bands, 1u apart. | 0° (item axis) |
| Plaid | Explicit opaque tones in the tile, no alpha: base `c`; wide bands 1.4u wide every 4u both ways, filled with `mix(c, d, 0.5)`; band crossings as their own squares in `mix(c, d, 0.75)`; a 0.3u accent line halfway between bands in `mix(c, #F0C94A, 0.8)` | 0° |
| Daisies | 5 petals (0.6u × 1u) in `d` around a gold center (`#FFC93C`, r 0.55u), 1.6u across, staggered every 4u, two fixed rotations in the tile | 0° |
| Stars | 5-point stars in `d`, 1.2u across, inner radius 45%, staggered every 3.5u | 0° (tilts with the item) |
| Rainbow | 6 bands, each 1/6 of the part's height: `#FF7A8A #FFB86B #FFE38F #8FE3A6 #8FD3FF #B9A2F5`. Not cached. | **Horizontal in each part's own local frame** (after the part's own tilt), stacked top to bottom: across the body on puffer panels (side, front and back), level with a beret's tilt, across a hat crown |

---

## Part B: New clothing shapes

Sizes are in `headR` unless marked as eye radii.

### Hats (head transform, after the near ear)

**3/4 view:** use the side drawing, positioned by `headFaceOf(...).top` at the current turn, exactly as the existing hats do. Front and back are their own drawings.

**Erect ears:** every new hat (cap, bucket, beret, crown) uses the beanie's existing **`hatPoke`** behavior: after the hat, the erect ears are redrawn through it. No 85% scaling.

| Shape | Side (and 3/4) | Front | Back |
|---|---|---|---|
| **Cap** | Dome ~1.7 headR wide, tilted −6°. Brim ~0.9 headR long over the snout, a seam, a band line at the base. **In 3/4,** the brim length is `0.9 × (1 − 0.3 × turn)` headR (0.63 headR at a full 3/4 turn). If its lower edge would still cross the near eye's top (`eyeY − eyeR − 0.05 × headR`), **tilt the brim up** about its base, up to +15°, rather than shortening it further. `d` = brim and top button. | Dome, brim as a flat ellipse below it, above the eyes | Dome and a strap arc, no brim |
| **Bucket** | Crown ~1.5 headR wide, band in `d`, drooping brim ~2.5 headR across with a dashed stitch line | Same, brim as a wide ellipse | Same |
| **Beret** | Tilted disc (rx 0.95, ry 0.35 headR) at −12°, a rolled band underneath, a curled stem on top | Flatter disc | Mirrored tilt |
| **Crown** | Gold band (`c`), 3 points tipped with balls. Center tip gem and band gems use `d` (pink) alternating with fixed `#5AA9E6`. Tilted −8°. | Points centered | Points, no gems |

**Sparkle:** the crown glints every 3–5 s. With reduced motion, show one static sparkle and no animation. The star shades work the same way.

### Glasses (new styles keyed by shape; sizes in eye radii, like the existing styles)

| Shape | Lens | `w`, `h` (half-sizes, eye radii) | Lens color | Glares |
|---|---|---|---|---|
| `heart` | Heart | 1.15, 1.05 | **From `d`** at `lensAlpha` **0.45**, within the range of today's lenses, so the eyes stay visible (new styles only; existing styles keep their hardcoded lenses) | 1 short arc |
| `star` | 5-point star, inner radius 45% | 1.25, 1.25 | From `d` at 0.45 | none, plus the sparkle beside the near lens |

### Neckwear: bow tie

- **Front and side:** two rounded-triangle wings ~1.15 headR across in total, a `d` knot 0.35 × 0.4 headR, and a 0.12 headR band running back along the neck. Same order and anchor as v2 neckwear.
- **Back mode is per shape now:** `neckBackMode: 'knot' | 'band'`. The bow tie uses **`band`**: in back and back-3/4 it draws the band only, replacing the knot dot. Every other neckwear keeps `knot`.
- **Belly-up:** the wings are hidden and only the band shows, like the scarf tails.

---

## Part C: New clothing items

| Wear id | Slot | Label | Shape | c | d | Pattern |
|---|---|---|---|---|---|---|
| `bandana-cherry` | neckwear | Cherry Bandana | bandana | `#E0526A` | — | — |
| `scarf-stripe` | neckwear | Candy Stripe Scarf | scarf | `#FF8CC4` | `#FFFFFF` | stripes |
| `bandana-gingham` | neckwear | Picnic Bandana | bandana | `#E0526A` | `#FFFFFF` | gingham |
| `bowtie` | neckwear | Navy Bow Tie | bowtie | `#2B3A6B` | `#F0C94A` | — |
| `bowtie-plaid` | neckwear | Plaid Bow Tie | bowtie | `#C84A4A` | `#2B3A6B` | plaid |
| `heart` | glasses | Heart Shades | heart | `#FF5FA2` | `#FFB3D6` | — |
| `heart-sky` | glasses | Sky Heart Shades | heart | `#5AA9E6` | `#BFE3FF` | — |
| `star` | glasses | Star Shades | star | `#FFC93C` | `#FFE38F` | — |
| `beanie-pink` | hat | Pink Beanie | beanie | `#FF8CC4` | — | — |
| `beanie-stripe` | hat | Stripe Beanie | beanie | `#2B3A6B` | `#FFFFFF` | stripes |
| `cap` | hat | Red Ball Cap | cap | `#D64545` | `#B23434` | — |
| `cap-sky` | hat | Sky Ball Cap | cap | `#5AA9E6` | `#3F8FCC` | — |
| `bucket` | hat | Sunny Bucket Hat | bucket | `#FFC93C` | `#E0A01E` | — |
| `bucket-daisy` | hat | Daisy Bucket Hat | bucket | `#BFE9FF` | `#FFFFFF` | daisies |
| `beret` | hat | Rose Beret | beret | `#E85A8C` | — | — |
| `top-velvet` | hat | Midnight Top Hat | top | `#2B1F4A` | `#FFC93C` | stars (band only) |
| `crown` | hat | Golden Crown | crown | `#FFC93C` | `#FF5FA2` | — |
| `rain-blue` | boots | Puddle Blue Boots | rain | `#5AA9E6` | — | — |
| `sneaker-pink` | boots | Bubblegum Sneakers | sneaker | `#FFC2E0` | `#8A5AD6` | — |
| `sneaker-gold` | boots | Gold High-Tops | hightop | `#E0B43C` | `#FFF3C4` | — |
| `puffer-mint` | jacket | Mint Puffer | puffer | `#7FE3BA` | `#CFFBE8` | — |
| `sweater-lilac` | jacket | Lilac Sweater | sweater | `#B9A2F5` | `#F1EBFF` | — |
| `puffer-rainbow` | jacket | Rainbow Puffer | puffer | `#FF8CC4` | — | baffles `#FF8CC4 #FFB15C #FFE16B #8FE3A8 #7EC8F5 #B9A2F5` |

---

## Part D: Toys

Two kinds of toy:
- **Thrown toys** (everything except the wand and the laser) use the existing play task: a flick throws, and `PLAY_RULES` decides what the pet does. No "give" mode.
- **Held toys** (`wand`, `laser`) use a new held mode, specified below.

**Mood.** Leaving a toy out does not change mood, and neither does a pet chasing or chewing on its own. Mood rises by **+3** when the toy keeps moving for **3 seconds**, or when the user **taps or throws 5 times**. Either one is enough. The movement clock clears when the toy stops, so the next stretch has to last the full 3 seconds. The tap count clears when the grant lands, or when the toy is put away. Tummy and energy both have to be at least 30. The bone's old chew bonus and the laser's +10 win bonus are not used.

New toy ids are plain, like the existing `ball` and `yarn`. A toy with no play rule stays out of the picker.

### Thrown toys

| Id | Species | Rule |
|---|---|---|
| `crinkle` | cat | **The cat ball rule** (stalk, pounce, bat, no carry), plus the crinkle sound **on each bat and each time it hits the floor after a bat**. The sound comes later; it's silent until then. |
| `mouse` | cat | **The yarn rule exactly.** A **squeak toy**: it plays the new squeak on each pounce, each bat, and each time it hits the floor (after the throw and after a bat). |
| `bone` | dog | **One id everywhere:** the existing `bone` kind in `ITEM_KINDS` (gripped in the mouth) is the chew bone. Give it a drawing (the Icons board's Chewy Bone) and a play rule. Thrown. The dog fetches it in the mouth, then instead of returning it, **lies down where it caught it and chews** (`jawHold` oscillating, a slight head bob) for 20–40 s. Chewing does not raise mood. Mood is the shared clock above: 3 seconds of the toy moving, or 5 taps or throws. A flick works as it does for every toy: it ends the chew, removes the bone and spawns a new one in the air at the finger. Label "Chewy Bone". |
| `rope` | dog | **No rule**, so it isn't in the picker. Icon only. |

### Held toys: a new held play mode

**Entering and leaving:**
- Picking `wand` or `laser` in the toy picker starts **held mode** instead of a throw.
- While held mode is on, every touch on the stage steers the toy. No throws, no prop dragging, and taps on props don't trigger actions.
- A small glossy **Done** button at the **bottom-left of the stage** ends it. The top right is the Boops counter; the bottom center is the laser pointer. So do picking another toy, or 8 s with no touch.
- When the finger lifts, the toy stays where it was last placed; touching again picks it back up from there.
- **Entering held mode stops play:** end the current `fetch` task and put the pet into idle. A thrown toy on the floor stays where it is, untouched, and the pet ignores it.
- **Leaving held mode:** the pet stays idle. It doesn't go back to the floor toy. A new throw starts play as usual.

**Coordinates (all in world space, through the stage scale, never screen pixels):**
- **Wand:** the finger maps into the world at the **pet's current depth (y)**. Above the pet's floor line, the finger's height becomes the feathers' height `z`; below it, `z` = 0. Clamp x to the stage edges.
- **Laser:** the dot ignores the pet's depth. It sits on the **finger's own floor point**: x from the finger, y from the finger clamped to the floor's `yMin..yMax`, `z` = 0, depth-scaled like any floor prop.

**Feather wand (`wand`, cat):**
- **Drawing:** the whole wand is drawn on screen, in the UI layer above the scene. The **feathers sit 0.6 × headR × the actor's scale above the finger point, in world space**, so the finger doesn't hide them and the reach is the same on every phone. The stick runs from the feathers down and out toward the **bottom-right** corner, off-screen, away from the Done button. Between the stick tip and the feathers is a short string on a damped spring, so the feathers lag, swing and flutter when moved. The feathers' position is the target the cat reacts to.
- **The cat's behavior:**
  - **Numbers** (world units; `B` = the cat's body length × scale, `H` = bodyH × scale, `R` = headR × scale; `v` = the feathers' speed in world px/s, smoothed over 100 ms; `d` = horizontal distance from the cat's head to the feathers):
    - **Slow:** `v` < 60. **Fast:** `v` > 250.
    - **Within reach (leap):** `d` ≤ 1.5 B, and the feathers' height is at most the clamped ceiling from `resolveJump(actor, { heightPx: 10000 })`. A bare `resolveJump(actor)` is the normal hop, not the ceiling. The leap itself passes `targetX` as the feathers' x and `heightPx` as the feathers' height; `resolveJump` clamps that height to the same cap.
    - **Low:** feathers' height < 0.8 H. **Close:** `d` ≤ 0.8 B.
  - It always tracks the feathers with its head.
  - **Stalk:** slow and `d` ≤ 3 B. It crouches and creeps toward them.
  - **Leap:** fast and within reach. `jump` with `targetX` and `heightPx` set to the feathers' position. At most one leap every 1.2 s.
  - **Swat:** low and close. A paw swipe, at most one every 0.6 s.
  - **Otherwise:** it watches, with its tail twitching, or trots toward the feathers if `d` > 3 B.
  - **Priority** when several match in the same frame (first match wins): **catch → leap → swat → stalk → trot or watch**. Cooldowns count as "doesn't match," so a leap on cooldown falls through to swat.
  - **On a catch** (paw or mouth within 0.4 R of the feathers), the feathers stick for 0.8 s while the cat wiggles, then pop free with a small tug.
- **Sound:** a soft rustle while moving fast. Silent is fine until we have one.
- **Reduced motion:** no string swing; the feathers follow the finger with a short ease.

**Laser pointer (`laser`, cat):**
- **Drawing:** the pointer device is **fixed at the bottom center of the stage**, in the UI layer. It only **rotates to aim** at the dot. A thin red beam (`#FF4D4D`, 1.5 px, 40% alpha) runs from its tip to the dot. The **dot sits on the floor** at the finger's position, clamped to the floor area and depth-scaled like other floor items, with a soft red glow.
- **The cat's behavior:**
  - **Same numbers as the wand:** `v` = the dot's speed (world px/s, smoothed over 100 ms), slow < 60, fast > 250; `d` = distance from the cat's front paws to the dot.
  - **Chase:** it runs at its normal chase speed, and **sprints** while the dot is fast.
  - **Pounce:** when the dot is slow and `d` ≤ 1.2 B. At most one pounce every 0.8 s.
  - **Priority:** watch → pounce → chase. During the 10 s sit, pounce and chase do not match.
  - **The dot can never be caught:** on a pounce, the dot is drawn at the finger point plus a slip offset of 0.5 R **in the cat's facing direction** (just ahead of the paw), clamped to the floor. The offset eases back to 0 over 400 ms.
  - **Stamina** works as for any chase: when it runs out, the cat is held to a trot and keeps chasing.
  - **Watch break** (a separate, new behavior): after 60 s of chase-plus-pounce time, the cat sits and watches the dot for 10 s, tracking it with its head and twitching its tail. The clock counts chase and pounce time and does not reset when the cat pounces. The sit is not part of the clock. When the 10 s end, the clock starts over and the chase resumes.
  - **Ending on a win:** when held mode ends, if the cat chased for at least 15 s, its last pounce lands on a little sparkle burst. The sparkle is visual only. Mood is the shared play clock above.
- **Sound:** none; lasers are silent.

**Dogs:** neither held toy is offered to dogs for now. Both are `species: cat`.

**Squeaky:** wire the empty `squeak` sound entry to the new file (below). Play it on each bite or shake during the squeaky toy's chew, and once on landing.

### New sound: `assets/sounds/freesound_community-squeeze-toy-104733.mp3`
- It's already in the bundle. **Re-encode it in place as mp3**, matching the bark and meow files' bitrate and sample rate. Mono. Trim leading and trailing silence. Normalize loudness to the bark's level. Keep it under about 0.5 s; if it's longer, keep the cleanest single squeeze.
- **Example** (match `-b:a` and `-ar` to the bark file):
  `ffmpeg -i original.mp3 -af "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5" -ac 1 -ar 44100 -b:a 96k squeak.mp3`
- Re-encode in place at that same path. Keep the original in a new, unbundled folder, `design/audio-sources/`.
- **License:** all our sounds, this one included, are royalty-free for commercial use with no attribution required. No credits file needed.
- **Pitch variance:** set `playbackRate` to a random value in 0.92–1.08 on each play, through the voice player's existing setting.

---

## Part E: Furniture

Today the cat tree is hardcoded in the catio scene and copied into starter furniture, and there's no furniture kind for the dog house. Build the general version:

1. **Furniture kinds registry:** `{ id, label, species, footprint, defaultSpot per scene, napSpot?, perchSpot? }`. Where a piece can go is the scene's player-owned flag, not a per-kind room list. Drawing is per kind.
2. **Ownership:** player-owned, through the existing owned-furniture rows. A purchase or the dev grant adds a row.
3. **Placement:** a newly owned piece appears at its `defaultSpot` when the current scene belongs to the player, otherwise in the living room. Holding it offers Put in storage or Move. Move is a drag. Put in storage clears that placement and leaves it owned. Saved furniture can come back in any scene marked as the player's (living room, bedroom, catio, and later scenes with that flag), not the park or Training School. A room holds one food bowl and one water bowl. Feed and Water follow those saved bowls in the room on screen, and the same spots are still there after the player leaves the room and comes back.
4. **Cat tree:** keep the existing kind name, **`catTree`**. Remove the hardcoded prop from the catio scene and from starter furniture. It becomes a normal owned kind, placeable in any scene that belongs to the player. Update the furniture test that expects `catio-tree`: it should now pass only when the cat tree is owned and placed. Test installs lose it; that's fine.
5. **Glass Conservatory** (`dogHouse`, dog): a 2.5× bed at 8,000 Boops. Placeable in the living room or bedroom. A room holds this or another bed, not both.
   - Dogs walk in, turn on the cushion until they face the door, and rest. Energy pays at 2.5×. Guests can use the house and do not get the multiplier.
   - **Doorway:** split the drawing into a **back layer** (roof back, interior shadow) and a **front layer** (front wall with the door opening cut out, roof front).
   - **Normally**, both layers sort together with the house's baseline, the way the bed sorts against pets today, so a dog standing in front of the house draws in front of it.
   - **Only while the napping dog is at the house's `napSpot`**, use the sandwich: back layer, then that dog, then front layer. The body is hidden behind the wall and only the head and front paws show through the doorway. No clipping inside the pet's outline, so no halo. Other pets keep normal baseline sorting.

---

## Part F: Treats (on hold)

Don't add treat or meal rows yet. We're settling how treats work first, and the next brief will cover it, including merging `catalog.ts` and `treats/kinds.ts` into one definition, species art for the biscuit, and the species filter. `food_fish` stays hidden.

---

## Done when

- [ ] Hats, boots, neckwear and glasses draw by shape; existing items are pixel-identical
- [ ] Patterns tile from cached pictures with the angle applied at draw time; rainbow draws directly; `patternParts` decides where patterns go
- [ ] The cap, bucket, beret and crown work in side, 3/4, front and back, with `hatPoke` ears; the cap brim never covers the eyes; sparkles respect reduced motion
- [ ] Heart and star lenses take their tint from `d`
- [ ] The bow tie uses `neckBackMode: 'band'` and hides its wings belly-up
- [ ] All 23 Part C items can be granted with the dev action; shop rows stay `hidden`
- [ ] `crinkle`, `mouse` and `bone` play by their thrown rules (flicks replace the toy, as today); the crinkle sounds on bats and floor hits, and the mouse squeaks on pounces, bats and floor hits; `rope` stays out of the picker; the squeaky uses the new squeak with pitch variance
- [ ] Held mode works for `wand` (feathers follow the finger on a spring; stalk, leap, swat, catch) and `laser` (pointer fixed at the bottom and aiming; the dot on the floor never caught; sessions end on a win); Done, the 8 s idle and switching toys all exit cleanly
- [ ] Held mode ends any fetch and idles the pet on entry; wand and laser positions are in world space
- [ ] Furniture kinds exist; `dogHouse` (Glass Conservatory, 8,000, 2.5×, one bed per room) and `catTree` are owned, placed and draggable in their allowed scenes; the cat tree is gone from the hardcoded catio and starter furniture; the furniture test is updated
- [ ] The dev grant screen writes clothing, toys and furniture to their own stores

Send screenshots of every Part C item on a light and a dark pet (a dog and a cat), and short recordings of each new toy.
