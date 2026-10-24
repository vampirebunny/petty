# Remote item defs

`shop_items.def` can publish a new clothing colorway or a new treat without an app release, when every shape, pattern, part, reaction, art template, and effect field it names is already in this binary. Toys, furniture, and boosts stay in code.

The shop pull is unchanged. The first download is live. A later download waits until local midnight, then becomes the active catalog. Accepted defs are stored in SQLite `item_defs` at that moment and are never deleted or overwritten.

A def for an id that already exists in `src/economy/catalog.ts` or `src/actor/wardrobe.ts` is ignored. The bundled item stays authoritative.

## Server rules

- `price` is null or `>= 0`.
- Bundle `contents` is a non-empty JSON array.
- `tier = 'exclusive'` only with `shop` in `rotation`, `hidden`, or `coming_soon`.
- `min_app_version` is `major.minor.patch`. A binary older than that omits the row. Null means every version.
- `def_locked` is set when a non-null def is inserted or updated into `always`, `rotation`, or `featured`. Later updates to `def` are rejected. Other columns stay editable.

`shop_items.species` filters the shelf. A treat def's `species` says who can eat it. If both are set and they differ, the row is dropped.

## Schema `v: 1`

Outfit. The shop id is `${slot}:${wearId}`.

```json
{
  "id": "neckwear:sky",
  "name": "Sky Collar",
  "def": {
    "v": 1,
    "kind": "outfit",
    "slot": "neckwear",
    "shape": "collar",
    "label": "Sky Collar",
    "colorway": { "c": "#5AA9E6", "d": "#F0C94A", "accent": "bell" }
  }
}
```

`colorway.accent` is `tag` (default), `bell`, or `studs`, and only on the `collar` shape. It changes the drawing. It does not add a sound. `lensTint` is an optional hex on glasses and replaces the shape's lens color. Alpha and glare stay on the shape.

Treat. The shop id is a plain id.

```json
{
  "id": "treat_maple",
  "name": "Maple Stick",
  "def": {
    "v": 1,
    "kind": "treat",
    "reaction": "hop",
    "species": ["dog"],
    "art": { "template": "chew_stick", "c": "#C9842F", "d": "#8A5A32" },
    "effects": {
      "casual": { "hunger": -10, "weight": 0.04, "mood": 0 },
      "training": null,
      "fill": "energy"
    }
  }
}
```

A treat needs `casual` or `training` unless `fill` is `energy` or `mood`. Effect fields are only `casual`, `training`, and `fill`.

## What this binary accepts

Shapes (`KNOWN_SHAPES` in `src/actor/wardrobe.ts`):

- hat: `beanie`, `party`, `top`, `cap`, `bucket`, `beret`, `crown`
- glasses: `classic`, `square`, `red-rim`, `heart`, `star`
- neckwear: `collar`, `bandana`, `scarf`, `bow`, `bowtie`
- jacket: `puffer`, `sweater`, `hoodie`, `raincoat`, `vest`
- boots: `red`, `rain`, `sneaker`

Patterns: `stripes`, `gingham`, `plaid`, `daisies`, `stars`, `rainbow`. Parts are listed in `PATTERN_PARTS`. A shape with no parts cannot take a pattern.

Reactions: `wag_burst`, `hop`, `spin`, `purr_headbump` (`KNOWN_REACTIONS` in `src/economy/treatArt.ts`).

Treat art (`KNOWN_TREAT_ART` in the same file): `bone`, `fish`, `cookie`, `cookie_center`, `chew_stick`, `can`, `steak`, `bowl`. A def still has to name one of these, with a hex `c`, or it is dropped. That template and its colors do not change the picture. The picture comes from the effect: `fill: "energy"` is the energy bar, `fill: "mood"` is the heart, a premium meal is the bowl, `biscuit` is a bone for dogs and a fish for cats, Second Wind is wind and a sparkle, and anything else is the cookie.

An unknown `v`, shape, pattern, part, reaction, template, or effect field drops the def. `shop = 'coming_soon'` can still show a gift placeholder. Any other shop value omits the row. A bad row does not crash the shop.

## After the row is gone

Owned items stay in the local ledger. `catalogItem` and `wearItem` read `item_defs` after the bundled lists, so a deleted or hidden shop row still renders and still works.

Playdate snapshots store `wearDefs` only for worn ids that are not in the bundled wardrobe. A viewer who never downloaded that def can still draw it. Treat defs are not embedded.
