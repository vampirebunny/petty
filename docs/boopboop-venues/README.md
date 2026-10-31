# Boop Boop runway venues (v2: show sets)

Venue spec for The Catwalk. The art lives only in `assets/runway/<theme>/` (7 layer SVGs + `fx.json`); the app embeds the SVG XML in `src/runway/venueSvgXml.ts` and the FX in `src/runway/venueFxData.ts`. Regenerate both when a theme's files change. Visual reference: `docs/Runway Venue Strips.html`.

Themes: beach, garden, hero, pirate, rock, royal, safari, sea, space, spooky, west, winter.

Each theme is a fashion-show set: themed scenery, uplit set panels, a lighting truss, a back row, a glossy raised runway with an LED edge, and a front row. Every SVG layer repeats seamlessly every 1200 px. Effects are drawn live from `fx.json`.

## Layers

| File | Size (px) | Scroll speed | Placed at |
| --- | --- | --- | --- |
| `1-backdrop.svg` | 1200 × 600 | 0.10 × | y 0 |
| `2-far.svg` | 1200 × 600 | 0.30 × | y 0 |
| `3-near.svg` | 1200 × 600 | 0.60 × | y 0 |
| `4-truss.svg` | 1200 × 130 | 0.80 × | y 0, over layers 1–3 |
| `5-crowd.svg` | 1200 × 70 | 0.75 × | y 600 |
| `6-runway.svg` | 1200 × 150 | 1.00 × | y 670 |
| `7-front.svg` | 1200 × 170 | 1.25 × | y 820 |

Stack height 990. Scale everything by `s = screenHeight / 990`, anchored to the bottom. The pet's paws sit at stack y 687 (the runway's top surface). The runway moves exactly with the pet.

Per frame, for a layer with speed `k`: `offset = -((scroll × k × s) mod (1200 × s))`, then draw copies until the screen is covered. Load each SVG once and record it into a picture or image at the current scale.

## Effects (`fx.json`)

Draw order: backdrop → background extra → far → near → particles → beams and follow spot → truss → crowd → runway → LED chase → front row → flashes.

- **Beams:** one per truss fixture (`fixtures.x` in truss-layer coordinates, at `fixtures.y`), alternating `beams[0]` and `beams[1]`. Each is a cone about 16 px wide at the lens and 120 px at the runway, fading from 38% to 2% opacity, swinging ±0.32 rad with `sin(t × 0.7 + i × 0.9)`. Blend with screen. Each lens gets a pulsing glow.
- **Follow spot:** a warm white cone from the top center onto the pet, plus a light pool on the runway under the pet.
- **LED chase:** 10 soft glows per 1200 px running along the runway's LED strip (runway y 46) at 260 px/s, in the walking direction, color `led`.
- **Flashes:** a camera flash from a random spot in the front row every 0.35–1.4 s: a white burst that fades over 0.28 s.
- **Particles:** `particles` names the type (stars, bubbles, glitter, glints, snow, confetti, petals, fireflies, dust, sparkle) in `colors`.
- **Extra:** `extra` is the theme's background motion: shootingStar, causticShimmer, chandelierTwinkle, sunPulse, auroraDrift, strobe, stringLightTwinkle, fog, searchlights, shipBob (use glints). Pulses and twinkles sit at `anchors.points`, in the coordinates of `anchors.layer`, and scroll with it.

The live preview (`docs/Runway Venue Strips.html`) implements all of this and is the reference for timing and look. In the app the walk steps scroll at `strutStageSpeed` (160 stack px/s, `src/actor/data/strut.ts`). With reduced motion on, stop the beams, chase, flashes and strobe, and show the set lit but still.
