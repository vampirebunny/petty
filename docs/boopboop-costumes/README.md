# Boop Boop runway costume pieces

23 costume pieces for The Catwalk. They are runway-only: their own catalog (`src/runway/catalog.ts`) with the same `WearItem` shape as `wardrobe.ts`, never in the Closet or playdates.

Visual reference: `docs/Runway Costume Pieces.html` (every piece on the reference pet, with its rack thumbnail).

## Where things live

| What | Path |
| --- | --- |
| Rack thumbnails (backstage picker) | `assets/runway-costumes/rack/<id>.png` + `@2x` / `@3x` (64 px base). Mapped in `src/runway/costumeRackImages.ts`. |
| Worn art (drawn on the pet) | `assets/runway-costumes/worn/<id>.svg`, embedded as XML in `src/runway/costumeSvgXml.ts`, drawn by `src/ui/skia/costumeWorn.ts` |
| Ids, labels, slots, frames, paws | `assets/runway-costumes/catalog.json` |
| Fit check (each piece on the reference dog) | `docs/boopboop-costumes/on-pet/`, `reference-pet.svg` (docs only) |

`costumeSvgXml.ts` is generated from `assets/runway-costumes/worn/`. Regenerate it when a worn SVG changes.

## Slots

| Slot | Pieces |
| --- | --- |
| hat | crown, goggles, antennae, flowercrown, tophat, bandana |
| glasses | starglasses, mask, mustache |
| neckwear | ruffle, bowtie, shells, chain |
| jacket | vest, tutu, jacket, stripes |
| back (new) | cape, wings, jetpack |
| boots | glitterboots, cowboyboots, rainboots |

`back` is used only by runway costumes. It lives on the runway look type and is passed to the pet as `backWear`, not in `outfitSlots`.

## Costume ids vs Closet ids

Some ids are also Closet items (`crown`, `bowtie`, `vest`, `bandana`). Worn art is chosen by the `costume: true` flag on the `WearItem` (set by `lookEquip` / `wearFromFrozen` for costume pieces), never by id alone (`usesCostumeWorn`). A Closet crown keeps its Closet art.

## Frames

The reference rig is a side-view dog facing +x, ground at y 0: head radius 21 centered at (54, −88), body ellipse 92 × 48 centered at (0, −56), leg width 10.

| Slot | Origin on the rig | How the app places it |
| --- | --- | --- |
| hat | head center (54, −88) | Head space (position + pitch); scale `headR / 21` |
| glasses | head center (54, −88) | Fit to this pet's face, like Closet glasses: lenses on the near eye (reference eye (6, −4), r 3.8), scaled by `eyeR / 3.8`; the mustache on the muzzle (reference (17, 7), rx 14), scaled by `muzzle.rx / 14`. Clamped to 0.7–1.4 × `headR / 21`. |
| neckwear | front of the neck (40, −66) | `chinAnchor`; scale `headR / 21` (no Closet neck nudge) |
| jacket | body center (0, −56) | `(0, bodyY)` in torso space; scale x `bodyLen / 92`, y `bodyH / 48` |
| back | withers (14, −80) | Torso rotation; the withers point follows the torso's 3/4 foreshorten and pose scale; art scale `bodyH / 48` |
| boots | each paw center | Shin angle; scale `legWidth / 10`; all four paws, far pair darkened |

Worn art is side-view. Front and back jacket passes skip it.

## Draw order

far legs → far boots (darkened 28%) → tail → neck and body → jacket → near legs → near boots → back → neckwear → head → glasses → hat.

- The eye mask is drawn over the eye, then the near eye is drawn again on top so it shows through the hole.
- Cats use the same frames; the scale factors handle the smaller head and body.
