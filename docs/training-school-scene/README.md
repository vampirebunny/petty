# Training School scene — art layers

Final art for the Training School room. Use these SVGs as-is (convert with react-native-svg / SVGR or load as assets). Do not redraw them.

All files are **390 × 600**, sharing one coordinate space, so they stack exactly on top of each other. The stage shows the whole room. It uses this aspect ratio, capped like the other home stages so Practice and the shop stay on screen. The sim maps the art onto the usual 640-wide stage so the pet stays the size it is in other rooms. The art's right edge is that stage's right edge.

## Layer order (bottom → top)

| # | Layer | File(s) | Notes |
|---|---|---|---|
| 1 | Sky | `ts-sky-day.svg`, then `ts-sky-night.svg` | The night sky fades in with the same darkness as other indoor rooms. Dawn and dusk are that crossfade. |
| 2 | Room | `ts-room.svg` | The wall has a transparent arched window opening. Shared by dogs and cats. |
| 3 | Back props | `ts-props-dog-back.svg` / `ts-props-cat-back.svg` | Always behind the pet. |
| 4 | Night overlay | `ts-night-overlay.svg` | Behind the pet, so the purple tint does not color the pet. Fade it with the same darkness. The bulbs sit at the ceiling, above where the pet stands. |
| 5 | **Pet** | (procedural pet) | Rendered by the app. |
| 6 | Front props | `ts-props-dog-front.svg` / `ts-props-cat-front.svg` | Always in front of the pet. |

## Pet placement (scene coordinates)
- Walkable floor band: **y 430–500**, x about 130–270. That keeps the feet between the back props and the front props.
- Training mat (where tricks are performed): center **≈ (195, 488)**, about 300 × 116.
- Podium / jump stool top surface: **≈ (312, 392)**, about 80 wide. Jump Up can use this later. The pet does not path onto it yet.
- Back props sit around y 340–420 and front props around y 510–595.

## Named groups (ids) you may want to address
- `ts-room.svg`: `wall`, `window`, `curtains`, `garland`, `trick-chart`, `shelf`, `hook-rosette`, `floor`, `sunpatch`, `mat`
  - Hide `sunpatch` (the window light on the floor) at night.
- Dog props: `weave-poles`, `cone-back`, `podium`, `cone-corner`, `tunnel`, `hurdle`
- Cat props: `cat-steps`, `toy-basket`, `podium`, `tunnel`, `hoop`

## Species
Same room for both; only the prop files change.
- **Dog:** weave poles, cones, podium, pink tunnel, agility hurdle.
- **Cat:** cushioned steps, toy basket with yarn and feather wand, jump stool, blue crinkle tunnel, jump hoop.
