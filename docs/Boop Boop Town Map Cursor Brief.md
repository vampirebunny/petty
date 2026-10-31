# Boop Boop Town: Cursor Brief

Oct 26, 2026 · @A

## Goal

Boop Boop Town is the road, not a picker laid over a hidden room. Leaving a place puts the pet on the road next to the door it just used. The previous room is not kept underneath. The old "Where to?" grid is gone.

The map is drawn in the cotton-candy style. This pass does not include Vet, Groomer, or their roads. A new place adds its own road when it is built.

- **Doors:** Home, Pet Shop, Park, Training School, The Catwalk, Arcade, and Stadium. Tapping The Catwalk walks the pet there and opens the venue. The screen is specified in `docs/Boop Boop Fashion Show — Cursor Brief.md`.
- **Home rooms stay off the road.** Tapping Home walks the pet to Home, then a bottom sheet offers the room. Living room and Bedroom show for every pet. Catio shows for a cat, using the scene flags already on the catio (`playerOwned` and `species: 'cat'`), the same ownership as the other home rooms. Dogs see two rooms, centered.
- **No Settings gear** on this screen.
- Keep the scenes themselves. The grid and its unused styles are already removed.

## How leaving works

- Leave the Pet Shop and the pet is on the road outside the Pet Shop. Leave the Arcade and it is outside the Arcade. Leave the living room, bedroom, catio, park, or training school and the pet walks off to the right, the room fades, and the map cuts in with the pet outside that door. Home rooms share the Home door. Reduce Motion skips the walk and the fade.
- The Boop counter and the training sheet still open the Pet Shop directly. Closing the shop still lands on the road outside the shop. The shop's closet button still opens the wardrobe.
- Tap the door the pet is already beside to enter with no walk along the road. Home still opens the room sheet. The living room, bedroom, catio, park, and training school still walk the pet in from the left.
- Standing on the road, there is no Back button. During a walk, Back stops the walk and the pet stays by the door it started from. It does not enter a building.
- Opening the app puts the pet back where it was: inside a place, or on the road beside the last door.
- Leaving a scene ends the current action. A nap does not resume in the next place.

## Screen

All map art is drawn in code with react-native-svg, in the existing cotton candy style: soft pastel fills, glossy highlights, puffy shadows. No image files. Titles use Fredoka, the same rounded display font as the other candy headers.

### Header

- Title "Boop Boop Town" and subtitle "Pick a spot for {petName}".
- Back button only while a walk is in progress. White glossy circle, top left.

### Map

- Starts below the header and fills the screen. Top corners stay rounded (32 pt) in portrait and on the landscape split. The grass, path, pond, and trees follow the app sky and the same season as the rooms: lush mint in summer, turning and thinning in autumn, bare branches and dull lawns in winter, and spring blossom. Wetter greens show in rain, and a pale snow palette builds with snow cover. Dawn and dusk wash the map warm. Night washes it blue, dims the header, and turns the door pills dark. Morning and afternoon stay the day colors. Rain streaks, snowflakes, and a rainbow are drawn on the map from the same weather the rooms use. Reduce Motion holds the streaks and flakes still.
- Portrait, including an upright iPad and a Surface Duo on one screen, uses a 390 by 724 zigzag. Scale it to the width, up to 600 pt, and keep the aspect ratio. It scrolls vertically when it is taller than the pane. On open, scroll so the pet is visible.
- The landscape split (short side at least 600, and wider than tall) uses a separate 1194 by 722 horizontal road, scaled to the full pane width. It scrolls vertically the same way. The pet and place labels grow with that scale. Title and subtitle sit on one row.
- The header clears the status bar the way the other screens do (64 pt, plus the opened-Duo inset). The walk pill sits above the home indicator.
- Paths: cream, two stacked strokes with round caps, plus a dashed center. The same cubics are drawn and walked. A bend under The Catwalk keeps the switchback on the path. The Catwalk is a door on that bend.
- Decoration: a pond, seasonal trees and bushes, flower beds that follow the bloom cycle, and drifting clouds. Decoration is not tappable.

### Buildings

Each building is one button, at least 44 pt, with a soft ground shadow and a white pill label overlapping its bottom edge. The pet stands on the path near the label, not on the pill.

| Spot | Art |
| --- | --- |
| Home | Peach cottage, coral roof, round window. Must not look like Training School |
| Pet Shop | Teal shop, gold sign, teal and white scallops, an orange ball in the window |
| Park | Garden gate between seasonal trees, bloom-cycle flower beds, a ball on the lawn |
| Training School | Blue schoolhouse with a bell tower and a yellow bell |
| The Catwalk | Fashion house with a gold marquee, spotlights, and a runway carpet. Drawn for dogs and cats. A tap walks the pet there and opens the venue |
| Arcade | Orange claw machine building with a gold marquee |
| Stadium | The current arena art. Its own four pennants wave. No extra poles are drawn on top |

Night dims each building and lights its windows. Snow caps the roofs and trees. Flowers follow a bloom cycle: spring tulips, summer sunflowers and bright beds, autumn mums while the lawn is still lush, and none in winter or under snow. There are no dead flowers. Three path lamps glow at night. Smoke, the bell, the spotlights, the marquee lights, the clouds, the pond shine, the stadium pennants, the arcade claw, and the shop-window ball play. Reduce Motion holds them still.

### Pet

Drawn with the existing procedural pet renderer, side view, about 48 pt long, using its real breed, coat, and outfit. At rest it stands on the path at the current door. Idle is a slow blink. No full idle behaviors.

While walking, scale the pet slightly by y (about 0.9 at the top of the map to 1.0 at the bottom). Face the direction of travel. Use the side-view walk cycle.

### While walking

- A dotted pink route shows the remaining path.
- A pink ring pulses under the destination.
- A white pill at the bottom: paw icon, "Walking to the {placeName}", and "Skip" in purple.
- With Reduce Motion on, the pet moves instantly and the room sheet appears in place. There is no zoom.

### Home room sheet

White sheet, 32 pt top corners, grab handle. Title "Home", subtitle "Which room?", then the room buttons. "Back to map" closes it. Tapping the dimmed road or swiping down closes it too. Picking a room opens that room.

## Data

The road is data-driven and local to the app. It works offline.

`roadSpot` on the pet is `'home' | 'petShop' | 'park' | 'trainingSchool' | 'catwalk' | 'arcade' | 'stadium'` when the pet is on the road beside that door. Missing means the pet is inside `sceneId`, which is how every existing save already works.

The road is two layouts. Portrait visits Home, Pet Shop, Park, Training School, the Catwalk bend, Arcade, then Stadium. Widescreen runs Home, Pet Shop, Park, and Training School along the top, drops down the right side through the bend, then Arcade and Stadium along the bottom. Stand nodes sit on the path in front of each label, including The Catwalk. The bend stays so the switchback remains on the path. Crossing the landscape split mid-walk cancels the walk and puts the pet on that layout's stand node for the current door.

## Walking

Tapping a door starts the walk. There is no confirm step.

1. Shortest route on the waypoint graph (Dijkstra by edge length). Reverse a curve when walking it backward.
2. Move along the curves at a constant speed (sample by arc length). Any trip takes at least 0.8 s and at most 2.5 s.
3. Skip (the pill, or tapping the destination again) arrives at once.
4. Tapping a different door mid-walk re-routes from the current point: back to the nearest node on the current edge, then on to the new door.
5. Arrival at Home opens the room sheet. The pet stays outside Home. Choosing the living room, bedroom, catio, park, or training school cuts to that scene and the pet walks in from off the left. Reduce Motion skips the walk-in. Arrival at the Pet Shop, Arcade, Stadium, or The Catwalk opens that screen. There is no zoom. The town pet is taken off the map before the place draws its own pet.
6. Shop and Arcade, opened from the road, do not also play the in-room walk-off.

## Done when

- [x] The road is titled Boop Boop Town, with no Settings gear, and the old grid is gone.
- [x] Leaving the living room, bedroom, catio, park, or training school walks the pet off to the right and fades the room before the map. Leaving the Pet Shop or the Arcade puts the pet on the road beside that door. Back does not uncover the previous room.
- [x] Tapping another door walks the pet along the path, then opens that place. Home opens the room sheet first. The living room, bedroom, catio, park, and training school walk the pet in from the left.
- [x] Catio shows only for a cat.
- [x] Every trip takes 0.8–2.5 s, the pet faces its direction of travel, and it stays on the path.
- [x] Skip arrives at once. Another tap mid-walk re-routes. Back during a walk returns the pet to the door it started from.
- [x] Reopening the app shows the pet where it last was, inside a place or on the road.
- [x] Works offline, with Reduce Motion, on a small phone, and on a tablet.
