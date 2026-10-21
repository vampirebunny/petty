# Boop Boop: wardrobe drawing refinement (Cursor brief)

## Goal

Make every wardrobe item clearly visible on a phone, for **dogs and cats, every breed, every life stage**, in both the side view and the 3/4 idle head turn.

Fur color is set at adoption and is **not** a user choice. Every item must work against whatever fur and markings the pet was adopted with. Do not add any fur color controls.

Files:
- `src/ui/skia/cosmetics.ts` (all item drawing)
- `src/ui/skia/pet.ts` (`drawActor`, `drawLeg`, draw order)
- `src/actor/wardrobe.ts` (slots, items, `wearItem`)
- `src/actor/data/wardrobeSizes.ts` (tunable size multipliers, same pattern as `actor/data/cuddle.ts` and `jumpConfig`)
- `src/actor/closet.ts` and `src/storage/wardrobeStorage.ts` (owned items)
- `src/ui/WardrobePicker.tsx`, `src/screens/WardrobeScreen.tsx`, `src/screens/WardrobeLab.tsx`

Keep using the existing `bodyTint` lighting path so items darken at night with the pet.

## Decisions

These override the slot list, the dev gallery, and the wardrobe screen notes below.

- Slots are `hat`, `glasses`, `neckwear`, `jacket`, `boots`. Neckwear is one item at a time: collar or bandana or scarf or none, never two together.
- Starter closet, owned on first load: red `collar`, blue `bandana`, yellow `scarf`, green `beanie`, red-rimmed `red-rim` sunglasses, orange `puffer`, red calf `boots`.
- The full catalog also has `bell`, `bow`, gold `gold` collar, `party` and `top` hats, `classic` and `square` glasses, `sweater`, `rain`, `vest`, rain boots, and `sneaker` (a low shoe, not the calf boot). NPCs and the lab use the full catalog. The picker shows only what that user owns, plus None.
- Ownership is a set of `{ slot, id }` stored locally at `petty.wardrobe.${ownerId}`. It is not the treat inventory. Migration maps `equipped.collar` / `equipped.bandana` to `neckwear` (bandana wins if both were worn; `gold` stays `gold`; any other collar becomes `collar`) and `equipped.coat` to `jacket`. A still-valid equipped item is added to the closet.
- Home wardrobe and the playdate outfit step use the same animated picker. The playdate outfit is stored on the playdate record and does not change the pet's everyday clothes.
- The dev gallery is a Wardrobe lab button under Settings. It picks species, breed, any catalog item (text buttons), age (with Puppy and Adult presets), and a pose (idle, sit, lie, walk). The wardrobe gallery's sticky preview has the same pose buttons. It does not write the save.

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
- `outlined(c, path, fill, width)`: fill, then stroke with `outlineOf(fill)` at `sizes.outline` (start at 2.5 stage units). Round joins and caps.
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
| Outline width | 2.5 units |
| Collar band thickness | 0.22 R |
| Collar tag radius | 0.30 R |
| Bell radius | 0.33 R |
| Bandana width / drop | 1.7 R / 1.15 R |
| Bandana hem | darker stroke along the two lower edges |
| Bow wing length / height | 0.62 R / 0.40 R |
| Scarf band / tail width | 0.34 R / 0.30 R, tails about 1.15 R and 0.9 R long |
| Hat base scale | 1.12 (multiply with the existing 3/4 widen `1 + 0.12 * turn`) |
| Glasses frame width | 0.5 eyeR |
| Glasses lens half-size | 1.85 eyeR, corner radius 0.45 of half-size |
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

Draw order inside `drawActor`:
1. Far legs (with boots and sleeves)
2. Torso: tail, body, markings, **jacket** (coat body only; no collar yet)
3. Near legs (with boots and sleeves)
4. Neck stroke
5. Rain hood (if raincoat), then **jacket roll collar** (`drawJacketCollar`)
6. Head: far ear, ruff, skull, face, eyes, markings
7. **Neckwear at `chin`**
8. Near ear, glasses, hat (with the existing beanie ear-poke logic)

Neckwear must sit under the near ear, so hanging ears overlap the bandana or collar rather than being covered by it. The simplest way: split the head block so the head transform is restored, neckwear is drawn in body space, then the head transform is re-applied for the near ear, glasses and hat. Keep `actor.anchors.neck` for anything else that uses it.

Item shapes:
- **Collar:** a curved band across the neck at `chin` (a slight arc bowing toward the body, not a straight line), outlined. The tag hangs from the lower end and swings with speed plus a small idle sway. The `gold` variant gets a gold band and larger studs (0.08 R), or drop the studs.
- **Bell:** same band, a bell instead of a tag: outlined circle, slot line, clapper dot, highlight. Hook a jingle sound to fast movement and greetings if easy; otherwise leave a TODO.
- **Bandana:** a triangle hanging over the chest from `chin`, tip slightly forward. Outlined, a darker hem along the two lower edges, a darker knot band along the top edge. No dots. Flutter from speed plus a slow idle sway (not speed only).
- **Bow tie:** thin band plus two outlined triangle wings and a knot, centered just below the chin.
- **Scarf:** thick band plus two tails trailing behind the neck that wave with speed.

In the 3/4 head turn (`face.turn`, `face.front` > 0), neckwear shifts toward the front and centers under the muzzle, matching how `drawHat` and `drawGlasses` already respond to the turn.

## 5. Jacket

- Shaped like a dog coat from the body oval (puff `0.05 * bodyH`, vest/puffer `0.09 * bodyH`): follows the back, stops before the rump (`jacketRear`), front edge behind the shoulder (`jacketFront`), belly line rising toward the hind legs. Never a full-body slab. Outlined.
- Draw it inside the same torso transforms as the body, including the `posed.scaleX/scaleY` block.
- Clip **details** to the jacket shape. Signature details: puffer baffles with soft highlights; sweater ribbing and wide stripes; vest diamond quilting, piping, and zip; raincoat gloss, piping, and toggles. No heavy dark band around the whole oval.
- **Roll collar:** drawn after the neck stroke via `drawJacketCollar`, so the neck comes out of the coat. Raincoat also gets a folded hood along the back of the neck (`drawHood`) before the collar.
- **Sleeves (raincoat and sweater only):** cover the upper leg bone (hip to knee, `sleeveUpper`), with a cuff. Far sleeve darkened like far legs. Follows every leg pose because it uses the computed knee.

## 6. Glasses

- Lens becomes a rounded square (sizes from the table) with a thick frame in the item color and an outline.
- **Sunglasses lens is semi-transparent** (dark tint, alpha about 0.55) so the eye and its highlight still show. The eye is the cutest feature and must not be fully hidden.
- Bold diagonal glare (about 2.6 units, alpha 0.75).
- Temple arm and front arm use the frame width with outline.
- `square` (gold frames): gold rim at the frame width with a dark gold outline, light blue lens at about 0.28 alpha.
- Keep the existing two-lens 3/4 logic, `fit` for close-set and wide-set eyes, and far-lens fade.

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
- **3/4 idle turn:** neckwear centered, glasses with two lenses, hat widened.

If a breed still fails after the shared rules, add a small per-breed override in breed data (for example a neckwear offset or hat scale), not branching in draw code.

## 10. Wardrobe lab

A button under Settings opens a page that does not write the save. It chooses species and breed, any catalog item with text buttons, and age with a slider, and shows that pet in the same zoomed 3/4 idle preview as the wardrobe picker. The user-facing picker is the animated closet (sticky pet, owned items below), not a breed grid.

## Acceptance criteria

- Every item is clearly identifiable at normal phone scale on every breed of both species, in every life stage, in side view and 3/4 view.
- No neckwear is hidden by the head.
- Sunglasses never fully hide the eye.
- Items stay attached through every pose and animation, with no gaps or popping.
- No fixed stroke sizes left in `cosmetics.ts`; all sizes come from `wardrobeSizes.ts` multipliers.
- Existing saves keep their owned and equipped items after the slot migration.
- No fur color controls added anywhere.

## Out of scope

- New hats, glasses or boot styles beyond those listed.
- Wardrobe screen, photo mode or zoom (separate task).
- Effect cosmetics (sparkle trails, glow).
