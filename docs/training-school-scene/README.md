# Training School scene — art layers

Final art for the Training School room. Use these SVGs as-is (convert with react-native-svg / SVGR or load as assets). Do not redraw them.

All files are **390 × 600**, sharing one coordinate space, so they stack exactly on top of each other. Scale the whole stack uniformly to the scene's width.

## Layer order (bottom → top)

| # | Layer | File(s) | Notes |
|---|---|---|---|
| 1 | Sky | `ts-sky-day.svg` / `ts-sky-night.svg` | Shows through the window only. Swap with the existing time-of-day system (dawn/dusk can crossfade the two). |
| 2 | Room | `ts-room.svg` | The wall has a transparent arched window opening. Shared by dogs and cats. |
| 3 | Back props | `ts-props-dog-back.svg` / `ts-props-cat-back.svg` | Always behind the pet. |
| 4 | **Pet** | (procedural pet) | Rendered by the app. |
| 5 | Front props | `ts-props-dog-front.svg` / `ts-props-cat-front.svg` | Always in front of the pet. |
| 6 | Night overlay | `ts-night-overlay.svg` | Evening and night only: room tint, glowing garland bulbs, warm floor glow. Fade it in. |

## Pet placement (scene coordinates)
- Walkable floor band: **y 366–600**, x 0–390. Keep the pet's feet in this band.
- Training mat (where tricks are performed): center **≈ (195, 488)**, about 300 × 116.
- Podium / jump stool top surface: **≈ (312, 392)**, about 80 wide. This is the landing spot for Jump Up.
- Back props sit around y 340–420 and front props around y 510–595. Keep the pet's resting spots off the front props so it isn't hidden.

## Named groups (ids) you may want to address
- `ts-room.svg`: `wall`, `window`, `curtains`, `garland`, `trick-chart`, `shelf`, `hook-rosette`, `floor`, `sunpatch`, `mat`
  - Hide `sunpatch` (the window light on the floor) at night.
- Dog props: `weave-poles`, `cone-back`, `podium`, `cone-corner`, `tunnel`, `hurdle`
- Cat props: `cat-steps`, `toy-basket`, `podium`, `tunnel`, `hoop`

## Species
Same room for both; only the prop files change.
- **Dog:** weave poles, cones, podium, pink tunnel, agility hurdle.
- **Cat:** cushioned steps, toy basket with yarn and feather wand, jump stool, blue crinkle tunnel, jump hoop.
