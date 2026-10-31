# Boop Boop runway venues

Final art for The Catwalk's 12 venue themes. One folder per theme, six SVG layers per folder. Every layer repeats seamlessly every 1200 px, so draw it side by side as many times as the screen needs.

Theme folders: `space`, `sea`, `royal`, `beach`, `winter`, `rock`, `garden`, `spooky`, `west`, `hero`, `pirate`, `safari` (these match the theme ids in the Supabase theme catalog).

## Layers

| File | Size (px) | Scroll speed | Position in the stack |
| --- | --- | --- | --- |
| `1-sky.svg` | 1200 × 600 | 0.10 × | top, y 0 |
| `2-far.svg` | 1200 × 600 | 0.30 × | top, y 0 (transparent, over sky) |
| `3-near.svg` | 1200 × 600 | 0.60 × | top, y 0 (transparent, over far) |
| `4-audience-back.svg` | 1200 × 70 | 0.75 × | y 600 |
| `5-floor.svg` | 1200 × 110 | 1.00 × | y 670 |
| `6-audience-front.svg` | 1200 × 170 | 1.25 × | y 780 |

The full stack is 950 px tall. Scroll speed is a multiple of the pet's ground speed: the floor moves exactly with the pet so planted paws don't slide, and the layers above and below move slower and faster for depth.

## Placing it on screen

- Scale every layer by the same factor: `s = screenHeight / 950`, anchored to the bottom of the screen.
- The pet's paws sit on the floor layer at y 62 (stack y 732), so the paw line is at `732 × s` from the top.
- Each frame, for a layer with speed `k`: `offset = -((scroll × k × s) mod (1200 × s))`, then draw copies at `offset`, `offset + 1200 × s`, … until the screen is covered. `scroll` grows while the pet walks out and shrinks while it walks back; it stays still during the enter, pose, turn and exit steps.
- In Skia, load each SVG once (`Skia.SVG.MakeFromString`), record it into a picture or image at the current scale, and reuse it for every copy. Don't re-parse per frame.
- A screen taller than 950 × s (if you cap `s`): fill the space above the stack with the theme's sky color, which is the background rect in `1-sky.svg`.

## Style

Outlines are #4B3B7A, 4 px at 1× scale, matching the Town map buildings and costume pieces. The audience is drawn as silhouettes (pointy and floppy ears) so it never competes with the pet.
