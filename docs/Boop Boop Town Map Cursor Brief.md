# Boop Boop Town: Cursor Brief

Oct 26, 2026 · @A

## Goal

Replace the "Where to?" icon grid with Boop Boop Town. The town is the road, not a picker laid over a hidden room. Leaving a place puts the pet on the road next to the door it just used. The previous room is not kept underneath.

The visual reference is the Boop Boop Town Map design canvas. Match its cotton-candy look. This pass does not include Vet, Groomer, or their roads. A new place adds its own road when it is built.

- **Doors:** Home, Pet Shop, Park, Training School, Arcade.
- **Home rooms stay off the road.** Tapping Home walks the pet to Home, then a bottom sheet offers the room. Living room and Bedroom show for every pet. Catio shows for a cat, using the scene flags already on the catio (`playerOwned` and `species: 'cat'`), the same ownership as the other home rooms. Dogs see two rooms, centered.
- **No Settings gear** on this screen.
- Keep the scenes themselves. Do not delete the old grid until the town is working; then remove it and its unused styles.

## How leaving works

- Leave the Pet Shop and the pet is on the road outside the Pet Shop. Leave the Arcade and it is outside the Arcade. Leave the Park, Training School, or a home room and it is outside that door.
- The Boop counter and the training sheet still open the Pet Shop directly. Closing the shop still lands on the road outside the shop. The shop's closet button still opens the wardrobe.
- Tap the door the pet is already beside to go in with no walk. Home still opens the room sheet.
- Standing on the road, there is no Back button. During a walk, Back stops the walk and the pet stays by the door it started from. It does not enter a building.
- Opening the app puts the pet back where it was: inside a place, or on the road beside the last door.
- Leaving a scene ends the current action. A nap does not resume in the next place.

## Screen

All map art is drawn in code with react-native-svg, in the existing cotton candy style: soft pastel fills, glossy highlights, puffy shadows. No image files. Titles use Fredoka, the same rounded display font as the other candy headers.

### Header

- Title "Boop Boop Town" and subtitle "Pick a spot for {petName}".
- Back button only while a walk is in progress. White glossy circle, top left.

### Map

- Starts below the header and fills the screen. Top corners rounded (32 pt). Mint grass with lighter and darker soft patches. Grass colors live in one theme object so time of day can tint them later.
- The map is a fixed 390 by 640 space (the design canvas, cropped below the arcade now that the groomer spur is gone). Scale it to the device width and keep the aspect ratio. It scrolls vertically when it is taller than the screen. On open, scroll so the pet is visible.
- Portrait tablets center the map at a max width of 600 pt, with the grass color filling the sides. Landscape keeps the existing phone column (about 400 pt).
- Paths: cream, two stacked strokes (outer tan ~26 pt, inner cream ~18 pt, round caps). Two round plazas join the paths. The lower plaza has a small fountain.
- Decoration: a pond on the left, bush clusters, tiny pastel flower dots. Decoration is not tappable.

### Buildings

Each building is one button, at least 44 pt, with a soft ground shadow and a white pill label overlapping its bottom edge. The pet stands on the path near the label, not on the pill.

| Spot | Art |
| --- | --- |
| Home | Peach cottage, pink roof with a white heart. Must not look like Training School |
| Pet Shop | Purple shop, striped lavender awning, pink and white scallops |
| Park | Two round trees, bench, red ball on a lawn, wider than the other doors |
| Training School | Pink schoolhouse with a bell tower and a yellow bell |
| Arcade | Pink claw machine building with marquee lights |

### Pet

Drawn with the existing procedural pet renderer, side view, about 48 pt long, using its real breed, coat, and outfit. At rest it stands on the path at the current door. Idle is a slow blink. No full idle behaviors.

While walking, scale the pet slightly by y (about 0.9 at the top of the map to 1.0 at the bottom). Face the direction of travel. Use the side-view walk cycle.

### While walking

- A dotted pink route shows the remaining path.
- A pink ring pulses under the destination.
- A white pill at the bottom: paw icon, "Walking to the {placeName}", and "Skip" in purple.
- With Reduce Motion on, the pet moves instantly, the zoom is skipped, and the room sheet appears in place.

### Home room sheet

White sheet, 32 pt top corners, grab handle. Title "Home", subtitle "Which room?", then the room buttons. "Back to map" closes it. Tapping the dimmed road or swiping down closes it too. Picking a room opens that room.

## Data

The road is data-driven and local to the app. It works offline.

`roadSpot` on the pet is `'home' | 'petShop' | 'park' | 'trainingSchool' | 'arcade'` when the pet is on the road beside that door. Missing means the pet is inside `sceneId`, which is how every existing save already works.

### Building boxes and stand nodes (map space)

Stand nodes sit on the path, just below the label.

| Spot | Building box (x, y, w, h) | Stand node |
| --- | --- | --- |
| Home | 46, 22, 104, 96 | home (98, 136) |
| Pet Shop | 234, 30, 110, 100 | petShop (289, 148) |
| Park | 22, 226, 140, 110 | park (118, 354) |
| Training School | 232, 212, 110, 108 | trainingSchool (290, 338) |
| Arcade | 52, 418, 104, 110 | arcade (104, 560) |

Nodes also include plazaA (195, 205) and plazaB (195, 410).

### Edges

Cubic Beziers in map space. The same curves are drawn and walked. Edges are walkable in both directions.

```ts
const EDGES = {
  'home-plazaA': 'M98 136 C 120 175, 165 190, 195 205',
  'petShop-plazaA': 'M289 148 C 270 180, 230 192, 195 205',
  'plazaA-park': 'M195 205 C 185 260, 145 310, 118 354',
  'plazaA-trainingSchool': 'M195 205 C 210 255, 260 300, 290 338',
  'park-plazaB': 'M118 354 C 140 375, 175 395, 195 410',
  'trainingSchool-plazaB': 'M290 338 C 270 365, 220 395, 195 410',
  'plazaB-arcade': 'M195 410 C 175 455, 130 510, 104 560',
};
```

## Walking

Tapping a door starts the walk. There is no confirm step.

1. Shortest route on the waypoint graph (Dijkstra by edge length). Reverse a curve when walking it backward.
2. Move along the curves at a constant speed (sample by arc length). Any trip takes at least 0.8 s and at most 2.5 s.
3. Skip (the pill, or tapping the destination again) arrives at once.
4. Tapping a different door mid-walk re-routes from the current point: back to the nearest node on the current edge, then on to the new door.
5. Arrival at Home opens the room sheet. The pet stays outside Home. Arrival at the Park or Training School opens that scene. Arrival at the Pet Shop or Arcade opens that screen. A short zoom toward the door (about 300 ms) plays first, then the scene.
6. Shop and Arcade, opened from the road, do not also play the in-room walk-off.

## Done when

- [ ] The road is titled Boop Boop Town, with no Settings gear, and the old grid is gone.
- [ ] Leaving a place, including the Pet Shop and the Arcade, puts the pet on the road beside that door. Back does not uncover the previous room.
- [ ] Tapping another door walks the pet along the path, then opens that place. Home opens the room sheet first.
- [ ] Catio shows only for a cat.
- [ ] Every trip takes 0.8–2.5 s, the pet faces its direction of travel, and it stays on the path.
- [ ] Skip arrives at once. Another tap mid-walk re-routes. Back during a walk returns the pet to the door it started from.
- [ ] Reopening the app shows the pet where it last was, inside a place or on the road.
- [ ] Works offline, with Reduce Motion, on a small phone, and on a tablet.
