# Cursor addendum: time of day (reference demo v2.2)

Adds to the v2 brief and the scenes addendum (v2.1). The attached `pet-demo-v2_2.html` replaces `pet-demo-v2_1.html` as the reference.

## What changed since v2.1
1. **The sky follows the user's local clock.** Six phases: Dawn, Morning, Afternoon, Dusk, Evening, Night. Colors blend smoothly between keyframes, so there are no jumps at phase boundaries.
2. **Scenes opt in with one field**: `time: 'outdoor' | 'indoor' | 'fixed'` (default `fixed`, so existing scenes behave as before).
   - `outdoor`: the backdrop sky, sun, moon, and stars. Scenery takes the full outdoor tint. Pets and the ball take 0.85 of it.
   - `indoor`: lamps that switch on at dusk, and windows that show the real sky. Scenery takes the indoor tint with alpha capped at 0.35. Pets and the ball take 0.35 of that tint. After dusk a warm pool fades in on the floor under the pet.
   - `fixed`: nothing changes with time (a snow globe, a studio backdrop). No tint.
3. **New shape type `sky`** (`{ t: 'sky', x, y, w, h }`). It draws a window-sized piece of the current sky. Use it for any window painted into a scene's `layers`. The `window` prop uses it too.
4. **Lamp glow is automatic.** `glow` omitted means it fades in as it gets dark. `true` or `false` forces it. Glows are drawn after the tint so they stay bright.
5. **The tint is per layer.** Do not draw one rectangle over the finished picture. Backdrop and props take the full tint. Pets and the ball take `lighting.actorTint` times that tint. Defaults: indoor 0.35, outdoor 0.85, fixed 0. The scene decides through `time` and `lighting.actorTint`. Nothing outside scene data may name a room. Validate `lighting.actorTint` as a number from 0 to 1 and reject anything else with a message that names the field. Cap indoor `inTint` alpha at 0.35 and keep the blue. Outdoor tint values stay as in `TOD_KEYS`. When `dark` is above 0.5 indoors, draw a warm radial pool on the floor under and around the pet, after the tint, with screen blending, scaled by `dark`, fading in and out with the clock. The actorTint defaults, the alpha cap, and the pool radius and strength live in the lighting data file. At the darkest indoor keyframe, pet luminance stays at least 70% of daytime luminance.
6. **Scene changes.**
   - Park: the painted sun is removed, because the engine draws it.
   - Bedroom: recolored to daytime colors and renamed from "Bedroom at night" to "Bedroom". Night now comes from the clock.
   - Living room: window panes use `sky`.
   - The `night: true` window option and the bedroom's fixed tint are gone.
7. **Demo test controls**: a Live button, six phase buttons and an hour slider. `petDemo.setHour(h)` takes an hour from 0 to 24, or `null` for live. `petDemo.tod()` returns the current blend.

## Phases and keyframes (local time)
| Phase | Range | Keyframe hour |
|---|---|---|
| Night | 21:30 to 05:00 | 0, 4.75, 21.5, 24 |
| Dawn | 05:00 to 07:30 | 6.25 |
| Morning | 07:30 to 12:00 | 8, 10.5 |
| Afternoon | 12:00 to 17:00 | 14, 16.5 |
| Dusk | 17:00 to 19:00 | 18 |
| Evening | 19:00 to 21:30 | 19.75 |

Each keyframe holds `top` and `bot` (sky gradient), `tint` (outdoor overlay, RGBA), `inTint` (indoor overlay, RGBA) and `dark` (0 to 1, drives stars, moon, lamp glow and window clouds). Blend between neighbors with smoothstep. The table is in the demo as `TOD_KEYS`. Move it to a data file.

Sun: crosses the sky east to west from 06:00 to 18:00, orange near the horizon and pale yellow at noon. Moon: same path from 18:00 to 06:00, fading in with `dark`. Stars fade in above `dark` 0.45 and twinkle (static with reduced motion).

## Requirements
- **One clock, not per-scene logic.** A `TimeOfDay` module returns the blended values for a given hour. Scenes only declare `outdoor`, `indoor` or `fixed`. Nothing outside scene data may mention "park" or "bedroom".
- **Use the device's local time.** Re-evaluate about once a second, or per frame if it is cheap. Do not cache it across a day change.
- **Tint scenery and actors separately.** A full-screen overlay makes an indoor pet hard to see at night. The room still takes the night tint. The pet takes only `lighting.actorTint` of it, and the indoor alpha cap keeps the floor readable. Outdoor night stays on the full outdoor tint.
- **Keep it a view concern.** Time of day must not touch pet state (weight, mood, age). If later the pet should get sleepy at night, that is a separate feature that reads the same clock.
- Validate `time` on load like every other scene field. Unknown value: reject with `"time" must be outdoor, indoor or fixed.`

## Production notes
- **Cost:** the gradient, sun, moon and stars change slowly. Redraw the sky layer about once a second into a cached image, not every frame. Only the star twinkle needs more, and it can be skipped.
- **Painted backgrounds:** a single painted PNG cannot change with time on its own. Two options: (a) paint the sky as its own layer and keep the foreground separate, so the engine draws the sky and tint; (b) paint a day and a night version and cross-fade by `dark`. Option (a) is preferred and matches how the park works.
- **Sunrise and sunset:** phase boundaries are fixed hours in the demo. Real sunrise and sunset move through the year. A later upgrade could shift the `TOD_KEYS` hours using the date, with no change to scenes. Do not ask for location permission just for this.
- **Reduced motion:** static stars, and no moving sun between frames beyond the once-a-second update.

## Acceptance criteria
- Changing the device clock changes the sky in `outdoor` scenes and the windows and tint in `indoor` scenes, with no jump at phase boundaries.
- At night: stars and moon outdoors, and the park looks the same as the full outdoor tint. Indoors at 23:00 the room still reads as night, the lamp is glowing, a warm pool sits under the pet, and the coat, face, eyes, and cosmetics stay distinguishable. The tint and the pool fade across dusk, evening, and night with no pop.
- Pet luminance at the darkest indoor keyframe is at least 70% of its daytime luminance.
- A `lighting.actorTint` outside 0 to 1 is rejected, and the error names that field.
- A scene with `time` omitted (or `fixed`) never changes.
- A `window` prop and `sky` shapes show the same sky as the outdoor backdrop.
- Unit tests cover the keyframe blend at the boundary hours (05:00, 07:30, 12:00, 17:00, 19:00, 21:30), the wrap past midnight, and `time` validation.
