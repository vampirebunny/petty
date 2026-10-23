# Scenery upgrade — integration brief

Integrated. The renderer lives in `src/ui/skia/`, the sky in `src/actor/sky/`, and the catio in `src/actor/catioScene.ts`. Reference frames are in `docs/scenery-previews/`. Skia stays on 2.6.2. The catio is cats-only at home, and a playdate can use it when either pet is a cat.



This replaces `world.ts` and `scenery.ts` and adds new modules beside them. Everything typechecks against `@shopify/react-native-skia` 2.10 (strict TS).

The `previews/` PNGs were rendered from this exact code through CanvasKit, using stand-in pets and sample scenes.

## What's in it

- **Sky**
  - The sun follows the real sunrise and sunset for the date.
  - Moon phases come from a bundled phase calendar covering 2024–2050, which matches the US Naval Observatory tables to the minute.
  - The moon rises and sets according to its phase, so a full moon rises at dusk. A pale moon shows in daytime when it is up.
  - Clouds drift with the wind, stars cover wide screens, and there is atmospheric haze near the horizon.
- **Weather**
  - Weather is deterministic: computed from time and place, with no saved state, so everyone in a city sees the same shower.
  - Rain falls about 7% of the time. In winter, about 7% of the time is snow (only at latitudes of 30° or more).
  - A rainbow appears rarely: after about 1 in 4 showers that end while the sun is low (2–3 a month, about 20 minutes each).
  - Rain effects: splashes, puddles that reflect the sky, rain streaks and drops on window glass.
  - Snow settles on the ground, trees, fences, benches and roofs, and lingers for about a day.
  - The pond freezes in deep winter.
- **Seasons**
  - Trees bud, blossom, turn, drop their leaves and go bare. Bushes flower in spring and get berries in winter. Grass yellows in late autumn.
  - Seasons follow the hemisphere.
- **Seasonal decor** (all pet-themed, placed automatically in any scene):

  | Theme | Dates | Decor |
  |---|---|---|
  | Halloween | Oct 1–31 | Bat garland, jack-o'-lanterns that glow at night, bats on the window glass, bats crossing the night sky outdoors |
  | Harvest | Nov 1 – Thanksgiving | Leaf garland, gourds; a hay bale outdoors |
  | Winter holidays | After Thanksgiving – Jan 6 | String lights, paw-print stockings, a little pine with bone and fish ornaments and gifts; a "snow-pup" outdoors when there's snow |
  | Valentine's | Feb 1–14 | Hearts, heart balloon |
  | Easter | Easter week | Egg basket |
  | Spring | Mar 20 – May 31 | Tulips, pastel pennants |
  | Summer | Jun 21 – Aug 31 | Sunflower, pennants, fireflies on summer nights |

- **Windows**
  - At least 150×132, with curtains.
  - A real outside view: hills, neighbour houses whose windows light up at night, street trees and a fence.
  - The view is laid out in stage coordinates, so two windows show different parts of one street.
  - Weather and seasons show through the glass.
- **Lighting**
  - Shadows are cast from the sun (long at dawn and dusk), the main window, or the nearest lamp at night.
  - Sunlight from each window falls on the floor as panes that slant with the hour, with dust drifting in the beam.
  - Lamps throw pools of light on the floor.
  - Pets get rim light from the nearest light.
  - Overcast dims the scene.
- **Catio**
  - A new cats-only scene: a screened, roofed porch with a translucent roof.
  - A garden beyond the mesh with a birdbath where birds visit.
  - Furniture: cat tree, post shelves, a cat-grass planter, a scratcher.
  - Rain falls beyond the mesh and drips from the roof edge; the deck stays dry.
- **Redrawn props**
  - Bowl: paw emblem; kibble heaps up when full and jiggles while the pet eats.
  - Bed: a donut bed that dips when a pet is on it.
  - Rug: braided.
  - Couch: cushions and a paw pillow.
  - Lamp: glowing shade.
  - Tree, bush and fence: seasonal and snowy.
  - Bench: cast-iron legs, wet sheen after rain.
  - Pond: stone rim, lily pads, reeds, rain rings.
  - Litter boxes are not placed in any room.
- **Props react to pets**
  - The bed dips and bushes rustle.
  - Grass parts around paws and the pond splashes.
  - The cat-tree pom swings and cat grass gets nibbled.
- **Performance**
  - Every prop used to get its own offscreen layer per frame. Now the room tint is mixed into cached paints, so props draw with no layer at all; only pets keep a layer (for tint and rim light).
  - The static backdrop is recorded once into an `SkPicture` and replayed each frame.
  - Shape paths are built once.

## 1. Drop in the files

| From this bundle | Put it in the app |
|---|---|
| `render/*.ts` | The folder that holds the current `world.ts` and `scenery.ts`. Replace both. |
| `actor/sky/` (folder) | `src/.../actor/sky/`, next to `actor/geometry.ts` |
| `actor/catioScene.ts` | `src/.../actor/` |
| `tools/genMoon.mjs` | `tools/`. Dev-only; regenerates the moon calendar. |

`world.ts` and `scenery.ts` keep every existing export and signature. `drawWorld` gains one optional last parameter.

## 2. Types to extend (`actor/scenes.ts`)

Add the new prop kinds to the `Prop['kind']` union:

```ts
'garden' | 'catioScreen' | 'catioPost' | 'catTree' | 'shelf' | 'hammock' | 'planter' | 'scratcher'
```

Add these optional fields to `Prop`:

```ts
foliage?: 'evergreen' | 'deciduous'   // trees
curtain?: string | false              // windows: curtain colour, or no curtains
plant?: 'catgrass' | 'flowers' | 'catnip' // planters
flip?: boolean                        // mirror any prop
```

Add these optional fields to `Scene`:

```ts
species?: 'cat' | 'dog'   // limit a scene to one species (the catio is 'cat')
shelter?: 'roofed'        // rain and snow stay off the floor
roofY?: number            // where the roof beam is (garland placement)
```

When the types are updated, remove the `as unknown as` casts in `catioScene.ts`.

## 3. Real day length: feed `timeOfDay` the solar hour

Wherever `timeOfDay(...)` is built from the clock, pass `solarHour(new Date())` instead of the clock hour:

```ts
import { solarHour } from '../actor/sky';
const tod = timeOfDay(solarHour(new Date()));
```

`solarHour` maps sunrise to 06:00, solar noon to 12:00 and sunset to 18:00. The existing gradients and darkness then follow the real day for the date and place: dark at 16:45 in December, light until 20:30 in June. The renderer places the sun from `tod.hour`, so the sun and the sky always agree, and a dev time-scrubber still works.

Location is guessed from the device time zone (no permission prompt), with about 50 common zones mapped to a city. `setObserver({ lat, lng })` overrides it.

## 4. Register the catio

- Add `catioScene` from `actor/catioScene.ts` to the scene registry.
- Show it only for cats (`scene.species === 'cat'`).
- Its layout is relative to `stageWidth`/`stageHeight`. If the other scenes use fixed `horizon`/`yMin`/`yMax` values, match those.
- If the scene type needs other fields (such as an unlock or a thumbnail), add them.

## 5. Optional: pass a date

`drawWorld(..., overlay, { date })` draws the sky for a given moment (the moon phase, season, decor and weather). `{ sky: null }` turns all of that off for a screen that shouldn't have it (e.g. the wardrobe). With no argument it uses now.

## 6. Dev menu hooks (recommended)

```ts
import { setWeatherOverride, setDecorOverride, setObserver } from '../actor/sky';
setWeatherOverride({ precip: 'rain', intensity: 0.8 });      // or { precip: 'snow', intensity: 0.7, snowCover: 0.8 }, { rainbow: 1 }
setWeatherOverride(null);                                    // back to the schedule
setDecorOverride(['winterHolidays']);                        // preview any decor; null = calendar
```

Pet behaviour can read the same state: `skyAt().weather.precip` (e.g. a cat avoids the window in rain), and `birdVisit(t)` from `catioProps.ts` (a cat watching the birdbath).

## 7. Check on device

- **Android:** frame time in the living room at night with the decor on. It should be better than before (no per-prop layers).
- **Wide screens:** stars, grass and the catio mesh fill the bleed.
- **Windows** are now at least 150×132. Check that each scene's wall art doesn't sit under a bigger window, and move it in the scene data if it does.
- **Old scene particles:** scenes that hard-code `ambient.particles` of kind `rain` or `snow` now rain on top of the real weather. Consider removing them and letting the weather drive it.
- **Reduced motion:** rain and snow freeze in place, and dust, fireflies, bats, drips and sway are off.

## Assumptions made without the files

These were inferred from how `world.ts` and `scenery.ts` use them. Fix any that are wrong:

- `stars` items are `[x 0-1, y 0-1, size, phase]`.
- `tuftsFor(scene)` returns `{ x, y, s }`.
- `Rgba` channels are 0–255 with `a` 0–1.
- `tod` has `hour`, `dark`, `top` and `bot`.
- Actors have an `id`.
- `draw.ts` still exports `clamp`, `fillOval`, `fillCircle`, `oval` and `paintOf`. The toy drawings use them unchanged.

**React Native Skia 2.14 warning:** 2.14 made `SkPath` immutable (no `moveTo` and friends; you build paths with `PathBuilder` instead). The existing code and this code both rely on mutable paths, so stay on ≤ 2.13 until that migration is done.

## Moon calendar

`actor/sky/moonCalendar.ts` is generated and runs out in 2050. After that, the code falls back to mean lunations, so it never breaks. To extend it: `npm i -D astronomy-engine && node tools/genMoon.mjs src/.../actor/sky/moonCalendar.ts 2081`.
