# Cursor addendum: scenes (reference demo v2.1)

This adds to the v2 brief. Everything in v2 still applies. The attached `pet-demo-v2_1.html` replaces `pet-demo-v2.html` as the reference.

## What changed since v2
1. **Scenes are data.** The demo's hardcoded room (floor limits, bowl, home spot) is gone. A scene object now defines the backdrop, walkable floor, props, points of interest (POIs), and ambient effects. Three presets ship: Living room, Park, Bedroom at night.
2. **Points of interest drive behavior.** Actions look up a spot by type (`food`, `water`, `bed`, `home`) instead of using fixed coordinates.
3. **New action: Drink.** It reuses the eating pose at a `water` POI, with no weight gain and no kibble.
4. **Actions are gated by the scene.** Eat is disabled where there is no `food` POI, Drink where there is no `water` POI. Sleep and idle naps walk to a `bed` POI first if the scene has one; otherwise the pet naps where it stands.
5. **Scene surface.** Ball bounce and friction come from the scene (grass is deader than a wood floor).
6. **Ambient effects.** Optional falling particles (`rain`, `snow`, `leaves`) and a color tint over the whole scene (the bedroom's night tint).
7. **Live scene editor in the demo.** Paste scene JSON, apply it, and get a plain-language error if something is wrong. This is how you check that a new scene needs no code.
8. **Removed constants.** `HOME`, `BOWL`, and fixed floor bounds no longer exist. `HORIZON`, `YMIN`, `YMAX`, `XMIN`, `XMAX` now come from `scene.floor`.

## Requirements
- **Scene is its own layer, separate from the pet.** Swapping scenes must never touch pet state (weight, wardrobe, age, mood). Only position resets, to the scene's `home` POI.
- **Build around `Actor` plus `Scene`.** The sim takes a scene and a list of actors. A friend's pet or an NPC visiting a scene is just another actor in it.
- **No scene-specific code paths.** Nothing outside the scene data may mention "park" or "bedroom".

## Scene schema (version 1)
```ts
interface Scene {
  v: 1; id: string; name: string;
  sky: [string, string];                       // top and bottom color of the backdrop
  layers?: Shape[];                            // back decoration in canvas coordinates
  floor: { horizon: number; yMin: number; yMax: number; xMin?: number; xMax?: number;
           color: [string, string]; pattern?: 'lines' | 'planks' | 'grass' | 'none'; lineColor?: string };
  surface?: { bounce: number; friction: number };   // ball behavior, default 0.55 / 1.8
  props: Prop[];
  pois: Poi[];
  ambient?: { tint?: string; particles?: { kind: 'rain' | 'snow' | 'leaves'; count?: number; color?: string } };
}
interface Prop { kind: string; x: number; y: number; layer?: 'back' | 'sorted' | 'front'; scale?: number; [param: string]: unknown }
interface Poi  { id: string; type: string; x: number; y: number; face?: 1 | -1 }
type Shape = { t: 'rect' | 'ellipse' | 'circle' | 'poly' | 'line'; fill?: string; stroke?: string; lw?: number; alpha?: number; /* plus the shape's own fields */ };
```
- A prop's `y` is its baseline. `sorted` props are depth-sorted against the pets and ball by `y`. `back` props draw flat under everything (rugs, ponds). `front` props draw over everything.
- A POI's `face` is the direction the pet faces while using it. For food and water it is only a tie-break: the pet eats or drinks from the side of the bowl it starts on, standing beside it and facing it, and uses `face` only when it starts exactly level with the bowl.
- The walkable floor band also sets depth scaling. The pet shrinks slightly toward `yMin`.

## Three levels of extension
1. **New scene, no code.** Use existing prop kinds, the generic `shape` prop (a list of shapes in prop-local coordinates), and existing POI types. This is the common case, and the snowy yard test in the demo is built this way.
2. **New prop kind.** Register one draw function: `PROP_KINDS['name'] = (ctx, prop) => {...}`. Existing kinds: shape, bowl, bed, rug, couch, window, lamp, tree, bench, pond, bush, fence.
3. **New POI type with a new action** (for example `toy_box` leading to play, or `scratching_post` for cats). The demo hardcodes food, water, and bed in `setTask` and `update`. **In the app, replace that with an affordance registry**:
```ts
interface Affordance {
  poiType: string; action: string;            // e.g. 'water' -> 'drink'
  approach: 'mouth' | 'body';                 // where the pet stands relative to the POI
  pose: Partial<PoseTargets>; durationSec: number;
  effects?: { weight?: number; mood?: number };
}
```
Actions, their enabled state, the approach logic, and the effects then come from the registry, and a new POI type needs no changes to the state machine.

## Validation and loading
- Validate every scene on load (the demo's `compileScene` is the model). Reject with an error that names the field, for example `props[2]: unknown kind "spaceship"`. Never silently ignore unknown kinds.
- Scenes carry a schema version (`v`). If the app meets a version it does not know, skip that scene and keep the pet in its current one.
- Downloaded scene packs (JSON plus assets) must pass the same validation. A bad pack must never crash the app.

## Production notes (differences from the demo)
- **Art:** add an `image` shape (`{ t: 'image', src, x, y, w, h }`) drawn with Skia. Painted PNG layers are fine. The demo can't load images, so it uses vector shapes only.
- **Performance:** render static layers (sky, layers, floor, `back` props) once into a cached image and redraw only what moves.
- **Offline and size:** bundle a few core scenes and download extra scene packs on demand, cached for offline use. This also supports selling scenes later.
- **Art direction:** each painted background needs a clear walkable floor band with perspective that matches the pet depth scale. Size props against the pets.
- **Particles:** keep a budget (a few dozen at most) and turn them off when reduced motion is enabled, as the demo does.
- **Transitions:** a quick fade between scenes is enough for v1.
- **Not in the demo:** pets walk through props with no collisions. Props are visual only except through POIs.

## Acceptance criteria
- All three preset scenes work with both species, including wardrobe and weight.
- Eat and Drink are disabled where the scene has no matching POI, and the reason is available (tooltip or label).
- Sleep and idle naps walk to the bed when the scene has one.
- Ball bounce and friction follow the scene surface.
- A new scene written only as JSON loads and plays with no code changes.
- Invalid scenes fail with a clear message and leave the current scene running.
- Unit tests cover scene validation, POI lookup, and action availability.
