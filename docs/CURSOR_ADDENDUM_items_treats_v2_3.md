# Cursor addendum v2.3: toys, treats, and two fixes

Adds to the v2 brief, the scenes addendum (v2.1) and the time-of-day addendum (v2.2). Everything in those still applies.

**Status: implemented in app (Oct 2026), with the locked MVP deltas below.** The reference file `pet-demo-v2_2.html` still does not implement this addendum; it remains a behavior reference for pose easing, mouth anchor, pet height `z`, and carried-ball logic only.

**Shipped MVP deltas vs this spec:**
- Toy kinds beyond **ball** are stubbed in `ITEM_KINDS` / `PLAY_RULES` (frisbee, squeaky, bone, jingle ball); laser/wand exist as `PointerTarget` stubs only.
- Inventory starts with **ball** only. Tap = soft drop; flick = throw; Play → Throw ball still uses edge throw.
- `fullness` was inverted and renamed to **`hunger`** (0 = not hungry, 100 ≈ 24h without food). Feed refuses at hunger 0 with a head turn.
- Drink became **Refill water**. Home bowl `waterLevel` drains on autonomous drinks; empty bowl after a 3h grace lowers happiness. Park/pond does not use the home bowl.
- Treat kinds are stubbed in `src/treats/` with shared `Effects`; **no** treats in the Feed picker yet. Feed → Kibble / Cat food; Play → Throw ball.

## Part 1: two small fixes

### 1a. Indoor night visibility
Problem: the time-of-day tint is one overlay drawn over the whole scene, pets included. Indoors at full night (alpha about 0.50) the pet is hard to see. Outdoor night is fine and stays as is.

Changes:
1. **Tint per layer, not one overlay.** Apply the tint to the backdrop and props at full strength and to actors (pets, items) at a reduced strength. New scene field `lighting.actorTint`, 0 to 1, a multiplier on the tint applied to actors. Defaults: indoor 0.35, outdoor 0.85, fixed 0. In Skia, apply the tint with a color filter or blend on each layer's paint instead of a full-screen rect drawn last.
2. **Lift the indoor night floor.** Cap the indoor tint alpha at about 0.35 at full night and keep the blue color. Outdoor values do not change.
3. **Warm light on the pet.** When `dark > 0.5` in an indoor scene, draw a soft warm radial pool of light on the floor around the active pet, after the tint, with screen blending. It scales with the same `dark` value as lamp glow and fades with the clock, with no pop.
4. Nothing may mention "livingroom" or "bedroom". Validate `lighting.actorTint` as a number from 0 to 1 and reject anything else with a message naming the field.

Acceptance: at 23:00 in the living room and bedroom, the pet's coat, face, eyes and cosmetics are clearly distinguishable from the floor and walls while the room still feels like night. Park at 23:00 looks as it does now. Unit test: pet luminance at the darkest indoor keyframe is at least 70% of its daytime luminance. All numbers live in the data file.

### 1b. Cat breed names
Breeds are anatomy plus defaults. Coat color and pattern are separate and overridable.
- `black` ("Black cat") becomes `bombay` ("Bombay"). Same sleek anatomy, black default coat.
- `tabby` ("Tabby") becomes `domesticshorthair` ("Domestic Shorthair"). Same anatomy, tabby stripes as the default pattern.
- Update breed data, UI labels, tests, and saved pet data (migrate the old `black` and `tabby` keys to the new ones).

## Part 2: items (toys)

### Why
The demo has one global `ball` (`state: none | free | carried`) and a fetch task written around it. Each new toy would mean copying that code. Replace it with a general item system now, the same way the single global `pet` became an Actor list.

### Data model
```ts
interface Item {
  id: string; kind: string;                 // key into ITEM_KINDS
  x: number; y: number; z: number;          // floor position plus height
  vx: number; vy: number; vz: number;
  state: 'free' | 'carried' | 'resting';
  holderId?: string;                        // actor carrying it
}

interface ItemKind {
  name: string;
  size: number;
  grip: 'mouth' | 'paw' | 'none';           // 'none' for things that cannot be picked up
  physics: { bounce: number; friction: number; drag: number; lift?: number; spin?: number; rolls?: boolean };
  draw: (ctx: Ctx, item: Item) => void;     // one draw function per kind
  sound?: { onBite?: string; onLand?: string };
  carriedPose?: Partial<PoseTargets>;       // for example head shake for a squeaky toy
}
```
Ball physics keep using the scene surface (`bounce`, `friction`) as in v2.1, scaled by the kind's own values.

### Play rules are a registry
```ts
interface PlayRule {
  species: string; itemKind: string;
  steps: Array<'chase' | 'pounce' | 'bat' | 'catch' | 'grab' | 'shake' | 'carry' | 'drop' | 'chew'>;
  endWith: 'sit_pant' | 'purr' | 'idle';
  effects?: Effects;                        // see Part 4
}
```
The demo's behaviors become two rules: dog with ball is fetch (chase, grab, carry home, drop, sit and pant), and cat with ball is bat three times with a hop, then purr. New toys add rules, not new branches in the state machine.

### Three levels of extension
1. **Data only:** a new color or size of an existing kind.
2. **New kind:** one draw function plus physics numbers.
3. **New play rule:** one `PlayRule` entry. If it needs a step that does not exist (for example `catch`), add that step once and reuse it.

### First set of kinds
| Kind | For | Notes |
|---|---|---|
| ball | both | Already behaves this way in the demo. Port it as the first kind. |
| frisbee | dogs | Glides with `lift`, lands flat and slides. Needs a `catch` step: jump using `z` and take it at the mouth anchor mid-air. |
| squeaky toy | dogs | Barely flies, lands with a thud. `grab`, `shake`, squeak sound, then `carry`. |
| chew bone | dogs | Placed, not thrown. The pet walks to it, lies down and chews. |
| jingle ball | cats | Light physics, gets batted repeatedly and skitters. |
| laser pointer | cats | **Not an item.** See below. |
| feather wand | cats | Drag-controlled. See below. |

### Drag-controlled targets
The laser pointer and feather wand are driven by the player's finger the whole time. Model them as a `PointerTarget` (position, active flag, kind) that the sim reads each frame, with no physics and no gripping. The cat chases the laser spot, then pounces on the wand. Keep them out of the item list.

### Input
- **Throwing:** a flick (direction and speed from the gesture) replaces the demo's tap-to-drop. Flick speed sets throw speed. A frisbee throw needs the direction to curve with `lift`.
- **Choosing a toy:** a toy tray UI listing owned toys.
- **One active item per actor.** Define a contention rule for several actors and one item: the nearest actor wins, ties broken by a random roll.
- **Release on task change.** The v2 fix still applies, generalized: whenever an actor's task changes, any item it carries is dropped at the mouth.

### Persistence
Items in a scene are ephemeral and not saved. Only toy ownership (the inventory) is saved.

## Part 3: treats

### Why treats are separate
A toy is reused. A treat is consumed, and it changes something about the pet. It belongs with the feeding system, not with items.

### Data model
```ts
interface TreatKind {
  id: string; name: string;
  species: Array<'dog' | 'cat'>;
  rarity: 'common' | 'special' | 'rare';
  effects: Effects;                         // see Part 4
  reaction: 'wag_burst' | 'hop' | 'spin' | 'purr_headbump';
  tags?: string[];                          // for per-pet preferences later
}
interface TreatStack { treatId: string; count: number }   // inventory
```

### Giving a treat
- The player drags a treat to the pet's mouth, or drops it on the floor.
- The pet walks to it (`approach: 'mouth'`) and eats with the existing eating pose. No bowl or POI is needed.
- A reaction plays after eating (pose targets through the existing easing, never set directly).

### Rules
- **Weight:** treats feed the weight index through the same function as meals, with a smaller gain per treat. Suggested starting range: 0.03 to 0.05 per treat against the demo's 0.12 per meal. A "healthy" treat can add 0 or slightly reduce weight. Tune from play.
- **Limits:** a pet that is full refuses (head turn, no consumption) and a per-game-day cap applies. Both values are data.
- **Training hook:** expose a reward event when a treat is given right after a trick, so the training system can raise the chance the trick sticks. Interface only for now. Do not build training here.
- **Preferences:** leave a hook for per-pet likes and dislikes by `tags`, driven later by the personality attributes. No behavior yet.
- **Timed boosts** (for example extra energy for an hour) are stored as start and end wall-clock timestamps and recomputed on app open, so they stay correct after time offline.
- **Purchases:** treats may be earned, unlocked, or bought. Keep purchase gating (13+ app, 18+ purchase) in the purchase layer, not in the treat code.

## Part 4: shared effects
One effects shape used by treats, play rules and the scene affordances from v2.1, so a bowl, a treat and a toy all go through the same code:
```ts
interface Effects {
  weight?: number;                          // added to the weight index
  mood?: number;
  attributes?: Partial<Record<'stamina' | 'agility' | 'intelligence' | 'boldness' | 'affection' | 'obedience', number>>;
  boost?: { attribute: string; multiplier: number; durationSec: number };
}
```

## Architecture notes
- New modules: `items/` (kinds, physics, play rules), `treats/` (kinds, inventory, rules), `input/` (flick, drag target). Logic stays in plain TypeScript with no Skia imports, so it can be unit tested. Only the renderer imports Skia.
- `sim` takes a scene, a list of actors, a list of items, and the current pointer target.
- Registries (`ITEM_KINDS`, `PLAY_RULES`, `TREAT_KINDS`) live in data files, as with breeds and wardrobe.

## Acceptance criteria
- The old ball behavior is reproduced exactly through the generic item system, for both species.
- A frisbee and a squeaky toy work end to end for dogs without any change to the state machine beyond new play rules and steps.
- Laser pointer and feather wand follow the finger smoothly and never appear in the item list.
- Giving a treat changes the weight index by the treat's amount, plays the reaction, and refuses when the pet is full or over the daily cap.
- A timed boost still shows the right remaining time after the app has been closed.
- The night-visibility and breed-name fixes meet the acceptance criteria in Part 1.
- Unit tests cover: item physics per kind, contention between actors, release on task change, the treat weight formula, the daily cap, and the boost expiry after time away.

## Open decisions (not for Cursor to guess)
- The treat catalog (names, art, rarity) and final tuning numbers.
- Which treats are free, earned or paid.
- Whether a cat tree is wanted for v1 (it needs climbing, so it is deferred).
