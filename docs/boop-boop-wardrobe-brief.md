# Boop Boop: wardrobe drawing refinement (Cursor brief)

## Goal

Make every wardrobe item clearly visible on a phone, for **dogs and cats, every breed, every life stage**, in both the side view and the 3/4 idle head turn.

Fur color is set at adoption and is **not** a user choice. Every item must work against whatever fur and markings the pet was adopted with. Do not add any fur color controls.

Files:
- `src/ui/skia/cosmetics.ts` (all item drawing)
- `src/ui/skia/pet.ts` (`drawActor`, `drawLeg`, draw order)
- `src/actor/wardrobe.ts` (slots, items, `wearItem`)
- `src/actor/data/wardrobeSizes.ts` (tunable size multipliers, same pattern as `actor/data/cuddle.ts` and `jumpConfig`)
- `src/actor/data/petStyle.ts` (the pet's own outline, cel shading, and chibi proportions)
- `src/ui/skia/shade.ts` (shadow and highlight helpers shared by the body, ears, and tail)
- `src/actor/closet.ts` and `src/storage/wardrobeStorage.ts` (owned items)
- `src/ui/WardrobePicker.tsx`, `src/screens/WardrobeScreen.tsx`

Keep using the existing `bodyTint` lighting path so items darken at night with the pet.

## Decisions

These override the slot list and the wardrobe screen notes below.

- Slots are `hat`, `glasses`, `neckwear`, `jacket`, `boots`. Neckwear is one item at a time: collar or bandana or scarf or none, never two together.
- Starter closet, owned on first load: red `collar`, blue `bandana`, yellow `scarf`, green `beanie`, red-rimmed `red-rim` sunglasses, orange `puffer`, red calf `boots`.
- The full catalog also has `bell`, `bow`, gold `gold` collar, `party` and `top` hats, `classic` and `square` glasses, `sweater`, `rain`, `vest`, rain boots, and `sneaker` (a low shoe, not the calf boot). NPCs use the full catalog. The closet shows only what that user owns. Tap an item to put it on. Tap the worn item to take it off. "Take it all off" clears every slot. There is no None tile.
- Ownership is a set of `{ slot, id }` stored locally at `petty.wardrobe.${ownerId}`. It is not the treat inventory. Migration maps `equipped.collar` / `equipped.bandana` to `neckwear` (bandana wins if both were worn; `gold` stays `gold`; any other collar becomes `collar`) and `equipped.coat` to `jacket`. A still-valid equipped item is added to the closet.
- Home wardrobe and the playdate outfit step use the same closet. The pet sits above the item icons, with no mirror frame, and it does not cycle poses. Continue under the preview closes the home closet. Start (or the cooldown) under the preview begins the playdate. The playdate outfit is stored on the playdate record and does not change the pet's everyday clothes. The playdate header still has Back.

TODO: After account creation, store wardrobe inventory per user in Supabase. A playdate between two accounts must replay the exact worn items (slot, id, and colors) from the record itself, not from either user's current closet.

---

## 1. Slots: merge collar and bandana into one neckwear slot

New slot list: `hat`, `glasses`, `neckwear`, `jacket` (rename from `coat`), `boots`.

- `neckwear` items: `collar`, `bell` (new), `bandana`, `bow` (new), `scarf` (new).
- `jacket` items: `rain`, `sweater`, `vest`, and orange `puffer` (quilted, vest-level puff, no sleeves).
- Save migration: if a saved pet has `equipped.collar`, map it to `neckwear: 'collar'` (keep the `gold` variant as a collar variant). If it has only `equipped.bandana`, map it to `neckwear: 'bandana'`. If it has both, keep the bandana. Rename `equipped.coat` to `equipped.jacket`. Owned inventory must not be lost.
- Give each item its own default color in the wardrobe data instead of everything falling back to `#d64545`.

## 2. Shared helpers in `cosmetics.ts`

Add once and use for every item:

- `outlineOf(color)`: `mix(color, '#000000', 0.45)`.
- `outlined(c, path, fill, width)`: fill, then stroke with `outlineOf(fill)` at `sizes.outline` (1.6 stage units). Round joins and caps, via `edgePaint`. Item strokes only mark internal edges. The pet's shared sticker outline is separate (`petStyle.outline`).
- `needsTrim(itemColor, furColor)`: true when RGB distance is under about 110. When true, draw a thin white trim (or a dark trim on very light fur) between the outline and the fill. Use the pet's resolved base color and, for neckwear, the chest marking color if the breed has one (`markingOf(markings, 'chest')`).

## 3. Sizes come from the pet, not fixed numbers

Remove fixed stroke widths and offsets (`5`, `3.6`, `2.2`, `1.5`, `+4.5`, etc.). Every size is a multiplier on a geometry value that already scales with species, breed, life stage and weight:

- Neckwear and hats: `geom.headR` (R)
- Glasses: `face.eyeR`
- Boots and sleeves: `geom.legWidth`, `geom.pawRx`, `geom.pawRy`
- Jacket: `geom.bodyLen`, `geom.bodyH`, `breath`

Put all multipliers in `wardrobeSizes.ts`. Starting values:

| Item | Value |
|---|---|
| Item outline width | 1.6 units (internal edges only; the sticker outline is `petStyle.outline.width`, 2.4) |
| Collar band thickness | 0.22 R |
| Collar tag radius | 0.30 R |
| Turned collar | `collarJawBack` 0.45 of a muzzle radius back from the muzzle center, `collarJawDrop` 0.16 R below the muzzle |
| Bell radius | 0.33 R |
| Bandana band span / thickness | 0.62 R / 0.16 R |
| Bandana drop / hem / knot | 1.0 R / 0.1 R / 0.26 R |
| Bow wing length / height | 0.62 R / 0.40 R |
| Scarf band / tail width | 0.34 R / 0.30 R, tails about 1.15 R and 0.9 R long |
| Hat base scale | 1.12 (multiply with the existing 3/4 widen `1 + 0.12 * turn`) |
| Glasses | per style in `glassesStyles`: wayfarer shades, round gold, soft-square red. Temple arm is 0.75 of the frame and reaches 0.6 R back |
| Jacket puff | `0.05 * bodyH` (vest/puffer `0.09 * bodyH`) |
| Jacket rear / front | `0.34` / `0.36` of bodyLen |
| Jacket buttons | radius 0.13 R |
| Boot shaft top | 0.45 of knee-to-paw (sneaker 0.78) |
| Boot toe | `pawRx * 1.3`, `pawRy * 1.25` |
| Sleeve upper bone | 0.9 of hip-to-knee |

## 4. Neckwear: chin anchor and draw order

**This is the main bug.** Today `drawCollar` and `drawBandana` run before the head at `neck` (62% along the neck), so the larger head covers them.

New anchor, computed after the head position is known:

```ts
const toBase = { x: base.x - head.x, y: base.y - head.y };
const len = Math.hypot(toBase.x, toBase.y) || 1;
const chin = {
  x: head.x + (toBase.x / len) * R * 0.85,
  y: head.y + (toBase.y / len) * R * 0.85,
};
```

Draw order inside `drawActor`. The ground shadow, jump dust, hearts, and sleep marks stay outside the sticker-outline layer. Everything from the legs through the carried toy is inside it.

1. Far legs (with boots and sleeves)
2. Torso: tail, body, markings, cel shade, **jacket** (coat body only; no collar yet)
3. Near legs (with boots and sleeves)
4. Neck stroke
5. Rain hood (if raincoat), then **jacket roll collar** (`drawJacketCollar`)
6. When the neck is flat, or the head is turned (`face.turn` or `face.front` above 0): **neckwear at `chin`**, then the head. The face covers any neckwear that would cross the muzzle. The tag or triangle that hangs below the chin stays visible.
7. Otherwise: head first, then **neckwear at `chin`**, so a side-view collar sits on the neck.
8. Head contents, whenever they draw: far ear, ruff, skull, face, eyes, markings
9. Glasses temple arms (`drawGlassesBack`), near ear, glasses lenses and bridge (`drawGlassesFront`), hat (with the existing beanie ear-poke logic)

Neckwear sits under the near ear, so hanging ears overlap the bandana or collar. The head transform is restored, neckwear is drawn in body space, then the head transform is re-applied for the arms, near ear, lenses, and hat. Keep `actor.anchors.neck` for anything else that uses it.

Item shapes:
- **Collar:** a curved band across the neck at `chin` (a slight arc bowing toward the body, not a straight line), outlined. In side view the tag hangs from the lower end. In the 3/4 and front views the band sits under the jaw, runs across the throat, and the tag hangs straight down from the middle so it does not cover the mouth. It swings with speed plus a small idle sway. The `gold` variant gets studs (0.08 R).
- **Bell:** same band, a bell instead of a tag: outlined circle, slot line, clapper dot, highlight. Hook a jingle sound to fast movement and greetings if easy; otherwise leave a TODO.
- **Bandana:** a tied band around the neck plus a triangle that hangs from the front of the band, tip pointing down. Side view shows a knot and two short tails at the back of the neck, and the cloth hangs from the throat half of the band. In the 3/4 and front views the triangle is centered under the chin and the knot is hidden. Lying and sleeping use a short strap under the jaw and a smaller triangle. One color plus a darker hem. No dots. The tip sways with speed and a slow idle sway.
- **Bow tie:** thin band plus two outlined triangle wings and a knot, centered just below the chin.
- **Scarf:** thick band plus two tails trailing behind the neck that wave with speed.

In the 3/4 head turn (`face.turn`, `face.front` > 0), neckwear eases from the neck toward the throat under the jaw (`collarJawBlend`, never a full jump to the muzzle tip — that put sit bandanas out on the chest). The face is drawn over it. Hats still widen with the turn, and glasses switch to two lenses with an arched bridge.

When the neck is nearly horizontal (sleep and lie, especially with `headRest`), the head often sits on the shoulders and a normal across-the-neck band would slash through the face. In that case: park the chin on the short head→body segment, draw a short strap under the jaw along the neck, shrink tags and hanging tips, and paint neckwear under the head so the face covers any leftover overlap.

## 5. Jacket

- Shaped like a dog coat from the body oval (puff `0.05 * bodyH`, vest/puffer `0.09 * bodyH`): follows the back, stops before the rump (`jacketRear`), front edge behind the shoulder (`jacketFront`), belly line rising toward the hind legs. Never a full-body slab. Outlined.
- Draw it inside the same torso transforms as the body, including the `posed.scaleX/scaleY` block.
- Clip **details** to the jacket shape. Signature details: puffer baffles with soft highlights; sweater ribbing and wide stripes; vest diamond quilting, piping, and zip; raincoat gloss, piping, and toggles. No heavy dark band around the whole oval.
- **Roll collar:** drawn after the neck stroke via `drawJacketCollar`, so the neck comes out of the coat. Raincoat also gets a folded hood along the back of the neck (`drawHood`) before the collar.
- **Sleeves (raincoat and sweater only):** cover the upper leg bone (hip to knee, `sleeveUpper`), with a cuff. Far sleeve darkened like far legs. Follows every leg pose because it uses the computed knee.

## 6. Glasses

Each id in `glassesStyles` has its own shape. `classic` is a wayfarer (flat brow, rounded bottom, dark lens, two glare streaks). `square` is a thin round gold wire with a light blue lens. `red-rim` is a soft square with a pale lens. A saved `round` id still resolves to `square`.

- Lenses are sized from `eyeR` (`w` and `h` in the style row) and shrink at the 3/4 and front views when the eyes are close-set, so they do not overlap.
- Every lens is translucent and gets at least one white glare streak, so the eye still shows through shades.
- Temple arms draw before the near ear (`drawGlassesBack`) and tuck under hanging and erect ears. In side view the arm runs back toward the ear and a short nose pad leaves the front of the lens. Nothing extends onto the muzzle.
- Lenses and the bridge draw after the near ear (`drawGlassesFront`). In the 3/4 and front views the far lens uses the far eye's scale and fade, and the bridge arches over the snout. Full front adds short stubs from the outer edges.
- A frame close to the fur color gets the light or dark trim, so classic shades stay visible on a black coat.

## 7. Hats

- Apply the 1.12 base scale and outline every shape.
- **Beanie:** wider rib band (0.4 R) with rib lines, pompom 0.3 R with outline. Keep the ear-poke redraw for `profile.hatPoke` breeds.
- **Party hat:** taller cone (tip at about -2.4 R), three thick stripes (0.14 R) clipped to the cone, pompom 0.24 R.
- **Top hat:** wider brim (1.05 R), band in a light contrasting color, outline.

## 8. Boots

- One rounded silhouette: shaft (capsule from ~45% of the knee-to-paw segment) unioned with an oversized toe oval, single outline. Bare paw is not drawn under a boot.
- Toe stays on the same ground line as the bare paw (`pawOffsetX/Y`). Sole band is clipped inside the shape.
- Red boots: a rounded cuff in a darker red (no white). Rain boots: gloss shine and dark rim. Sneakers: side stripe, lace dots, light sole; shaft from ~78%, no cuff.
- The foot rotates with the shin when the paw is not planted: sitting hind legs, lying, side lying, belly up, and the jump tuck.
- Sizes from `legWidth`, `pawRx`, `pawRy`, so cats and puppies get proportionally smaller boots.

---

## 9. Species and breed coverage

All of this must work from geometry already in `geom`, `face`, `breed`, and `earProfiles`, with no per-breed special cases unless a check below fails. Confirm these:

- **Cats:** head is an oval (`R * 1.06` by `R * 0.96`). Base the chin anchor on the oval's lower edge, not the circle. Glasses must sit correctly over whiskers. Boots must fit smaller paws.
- **Ear types:** erect ears with hats (beanie poke, party and top hat placement between or in front of ears), hanging ears over neckwear (they must overlap the neckwear, per the draw order), folded `overHead` ears.
- **Ruffs and long coats** (`breed.ruff === 'chest'`, `texture === 'longCoat'`): neckwear must sit on top of the ruff and stay readable.
- **Short and long necks, close-set and wide-set eyes, small and large muzzles** (pug, husky and similar).
- **Life stages:** puppy and kitten through senior. Items must scale with growth. Senior frosting must not draw over items.
- **Weight index:** jackets follow underweight to overweight body thickness through `bodyH` and `breath`.
- **Poses:** walk, run, gallop stream, jump, sit, lie, side lie, belly up, play bow, eat at bowl (head down), bark, petting reactions, carrying a toy.
- **3/4 and front:** neckwear under the jaw and behind the muzzle, glasses with two lenses and an arched bridge, hat widened. Side view keeps the bandana knot visible and the glasses arm under the ear.

If a breed still fails after the shared rules, add a small per-breed override in breed data (for example a neckwear offset or hat scale), not branching in draw code.

## 10. The pet's own look

Tunables live in `src/actor/data/petStyle.ts`. Shading helpers live in `src/ui/skia/shade.ts`.

- **Sticker outline.** One Skia layer dilates the pet and tints that copy with the coat mixed toward `outline.ink`. Legs, body, head, ears, tail, worn items, and a carried toy share that one edge. The ground shadow, jump dust, hearts, and sleep marks are outside the layer. The radius is in the pet's local units, so wardrobe zoom and the playdate camera do not change its thickness relative to the pet.
- **Cel shading.** Each body, head, muzzle, paw, ear, and tail gets one translucent shadow on the underside and, where the part reads as round, one highlight near the top. Markings and senior frost are shaded with the coat. Erect ears get only the base shadow. Eyes, nose, and blush are not shaded. The overlays sit under the scene's `bodyTint`, so they darken with the pet at night.
- **Chibi proportions.** `proportions.enabled` is false. Turning it on multiplies leg length, leg width, paws, body height, body length, neck, and head radius after breed, age, and weight are combined, and rebuilds hip height, lie drop, and the resting head from the new values. Leave it off until every breed and life stage has been checked in the gallery.

## Acceptance criteria

- Every item is clearly identifiable at normal phone scale on every breed of both species, in every life stage, in side view, 3/4 view, and full front.
- In side view the collar and bandana read on the neck, with the bandana's knot at the back. In 3/4 and front they sit under the chin and do not cover the muzzle. Hanging ears still overlap the band.
- The three glasses styles are recognizable from shape alone. Sunglasses never fully hide the eye, and the temple arm does not cross the ear or the muzzle.
- Items stay attached through every pose and animation, with no gaps or popping.
- No fixed stroke sizes left in `cosmetics.ts`; all sizes come from `wardrobeSizes.ts` multipliers.
- Existing saves keep their owned and equipped items after the slot migration.
- No fur color controls added anywhere.

## Out of scope

- New hats, glasses or boot styles beyond those listed.
- Photo mode. The wardrobe screen is the closet: a sitting preview, item-only tiles, "Take it all off", and a sticky Continue or Start button.
- Effect cosmetics (sparkle trails, glow).
