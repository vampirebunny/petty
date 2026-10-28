# Colorway generator

Goal: produce clothing variants as data, check them on the real pet, and seed the keepers to the Supabase catalog.

Files:

- `tools/colorways/palette.ts`: the only colors generated items may use. `FUR_SAMPLES` is every adoption coat in `src/actor/breeds.ts` (dog and cat), plus each pointed coat's accent.
- `tools/colorways/themes.ts`: the launch themes (4 color roles + optional pattern each).
- `tools/colorways/generate.ts`: maps each theme onto every clothing shape and runs the checks.
- `tools/colorways/cli.ts`: writes `tools/colorways/generated/colorways.json`, `warnings.txt`, and `warnings.json`. `--lock` records published looks in `colorways.lock.json`. The launch set is already locked.
- `tools/colorways/seed.ts`: turns an allowlist in `picks.json` into insert-only shop SQL.
- `tools/colorways/picks.json`: ids to seed. It currently lists all 238 launch items. Add a new id here before seeding another drop.

Do not change the rig, anchors, shapes, `PART_NAMES`, or the hand-made items in `src/actor/wardrobe.ts`.

## Generator

`npm run colorways` (tsx). It must print 0 schema errors. Fur warnings are expected against the real coats. Leave them. Do not retune themes to clear them.

- An item is `shape + colorway`. Generator ids are `<shape>.<theme-id>`. Labels are `<Theme name> <Shape label>`.
- The wardrobe import from `tools/colorways/` is `../../src/actor/wardrobe`.
- A patterned theme puts the pattern on the shape's hero part only (`patternParts`), with `c`/`d` as the pattern's two colors. Every other mapped part gets an explicit solid color in `colorway.parts`.
- `patternParts` may name any part in `PART_NAMES`. `PATTERN_PARTS` is only the default when `patternParts` is omitted. Boots `red` and `rain` opt in on `shaft`. Bows opt in on `loop`. `patternPaint` already honors `patternParts` and does not consult `PATTERN_PARTS`.
- Glasses: `c` is the frame, scored against `FUR_SAMPLES`. `d` is the lens tint, which only heart and star shades use. Swapping coats can change frame hexes. That is expected.
- `crown` and `classic` are never generated.
- A patterned puffer keeps the pattern and omits `baffles`. Rainbow Sherbet is that case.
- Rarity is automatic: solid = common, two-tone = uncommon, patterned = rare. A theme's `tier` overrides it. That value is the `rarity` column, not `shop_items.tier`.

## Renderer

Per-part colors are read in `src/ui/skia/cosmetics.ts` through `resolvePart`. With no `parts` entry, `resolvePart` falls back to the same colors as the hand-made items.

- `drawBandana`: cloth fill, knot tails, hem, and fold highlight use `cloth.color`. The cloth pattern is `cloth.pattern`. The band and knot use `band.color`.
- `drawScarf`: wrap and knot use `band.color` / `band.pattern`. Tails use `tail.color` / `tail.pattern`. Stripe and shadow come from that part's color. Drawn stripes are skipped when the part has a pattern.
- `drawBeanie`: cuff ribbing is `shade(cuff.color, 0.3)`.
- `drawBucket`: brim stitch is `shade(brim.color, 0.25)`.
- `drawBoot`: toe shine is `highlightTone(shaftPart.color)`.
- `drawSleeve`: the non-ribbed cuff is `shadowTone(body.color)`.

## Dev contact sheet

A `__DEV__` screen, opened from the dev menu next to Clothing. It draws the real pet the same way `ClothingLab` does (`spawnActor` + `drawActor`), with the generated item passed as `wearDefs`. It does not use `iconRig`.

- Reads `tools/colorways/generated/colorways.json` and `warnings.json`, imported only when `__DEV__` is true.
- Filters: theme, slot, species.
- Cell label: item id, plus a red dot when that id is in `warnings.json`.
- Coat toggle: the same item on cream, gold, ginger, and midnight.
- Standing side view by default, with toggles for sit and 3/4.
- The grid fits an iPad width and scrolls on a phone.

## Seeding

`npm run colorways:seed` writes insert-only SQL from `picks.json` to `tools/colorways/generated/seed.sql`. An empty allowlist writes no rows. If an id already exists, the insert does nothing. Never update the look of a published id. Run `npm run colorways -- --lock` only after that seed is applied.

The launch set is already on hosted project `unfatkwtzfkqnnbgzuqs`: 190 `always` / `standard`, 24 `rotation` / `exclusive`, and 24 `featured` / `limited` with cap 500. That SQL is not a migration. Apply a later seed with `supabase db query --linked --file tools/colorways/generated/seed.sql`. A device that already has a catalog waits until local midnight to see new rows. Today's picks still chooses one clothes item per day and prefers `rotation`.

Shop id is `${slot}:${shape}.${theme}`, for example `hat:beanie.strawberry-milk`. The def is schema v2 and holds only `v`, `kind`, `slot`, `shape`, `label`, `colorway`, and `patternParts`. `theme`, `collection`, `season`, and `rarity` are columns.

`shop_items.tier` stays `standard | exclusive | limited`:

- common, uncommon, rare → `tier standard`, `shop always`, no cap.
- exclusive → `tier exclusive`, `shop rotation` (Today's picks), no cap.
- limited → `tier limited`, `shop featured`, cap 500. Purchase goes through the existing reservation path.

Price follows the shape, matching the hand-made item already on the shelf. Rarity does not change it. A shape with two standard prices uses the always-shelf one. Star shades, including Gold Star Shades, are 900 with the other shades. High-tops, including Gold High-Tops, are 2000 with the other sneakers. `20261028120000_colorway_shape_prices.sql` is applied on hosted project `unfatkwtzfkqnnbgzuqs`. A device that already has a catalog shows the new prices at the next local midnight.

| Shape | Boops | Matches |
| --- | --- | --- |
| bandana | 500 | Cherry Bandana |
| collar, bow | 600 | Brown Bell Collar, Pink Bow |
| scarf | 700 | Candy Stripe Scarf |
| bow tie | 800 | Navy Bow Tie |
| round specs, rims, star shades | 900 | Black Shades, Round Gold Specs, Gold Star Shades |
| beanie | 1100 | Pink Beanie |
| ball cap | 1200 | Red Ball Cap |
| heart shades | 1200 | Pink Heart Shades |
| bucket | 1300 | Sunny Bucket Hat |
| party hat | 1400 | Party Hat |
| beret | 1500 | Rose Beret |
| top hat | 1800 | Black Top Hat |
| boots, rain boots, sneakers, high-tops | 2000 | Yellow Rain Boots, White Sneakers, Gold High-Tops |
| sweater, puffer, vest | 3000 | Cherry Sweater, Mint Puffer, Blue Quilted Vest |
| hoodie | 3200 | Cozy Pink Hoodie |
| raincoat | 3500 | Yellow Raincoat |

Species is null, so both dogs and cats can buy them. NPCs only roll bundled wardrobe ids, so these rows never land on an NPC.

The remote validator accepts `colorway.parts`, `colorway.baffles`, and `patternParts` whose names are in `PART_NAMES[shape]`. A bad part fill is dropped, not fatal. A pattern that is not in `KNOWN_PATTERNS` drops the row, which is how an older build hides an unknown pattern.

## Patterns

`hearts`, `checker`, `paws`, and `chevron` are drawn from the item's two colors, clipped to the part, and scaled with head size, same as the first six. Paw tiles rotate by a stable hash. No white filler dots. The ids live on `PatternId` in `wardrobe.ts` and `patternSpec.ts`, and on `KNOWN_PATTERNS`. No schema bump.

## Out of scope

- New shapes, the rig, anchors, the Closet UI, and the shop UI.
- Changing existing hand-made items in `wardrobe.ts`.
