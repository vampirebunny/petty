# Cursor Brief: NPC Playdates (Boop Boop)

The PRD contract is R7.5. This brief is the build spec for beat templates, rewards, and acceptance checks.

## Goal

Let the user's pet have playdates with NPC pets. A playdate is a scripted scene: the user picks a partner, a place, and an activity, dresses the pet, and then watches. Each playdate is saved as a replayable beat timeline.

Everything is local and works offline. Saved data is keyed to `ownerId`.

## Design principles

- Always rewarding. No bad outcomes. A shy pet gets warm-up beats, then plays.
- No live input. Choices happen before playback. During playback the user watches, skips to the end, or leaves. Leaving before the end saves nothing.
- Data-driven activities and beats. New activities are data, not engine changes.
- Partners are `PetSnapshot`s. NPC playdates use `source: 'npc'`. A friend playdate uses `source: 'friend'`. `rehomed` stays on the type for later.

## Flow

1. Playdate entry on the home screen. On cooldown it shows "Next playdate in 42:17", updating each second while visible. While the cooldown runs, the partner, place, activity, and outfit choices are greyed out and disabled. Replaying a saved playdate still works.
2. Partner picker. Today's 3 NPCs. A card shows the drawn pet, name, breed, a style-and-favorite line, and a bond hint. No life-stage name.
3. Place picker. Living room, park, or bedroom.
4. Activity picker. Up to 3 activities that fit the pair, the place, and both ages, with the attributes each one trains.
5. The same closet picker as home, limited to items the user owns, opening on the everyday outfit. The choice is stored on the playdate only. NPC partners wear the full catalog.
6. Playback at hour 14. It opens on a close-up of each pet, then each one walks in. The close-up stays at its usual zoom when the pet fits. A long pet, such as a dachshund, zooms out until the nose and tail stay in frame.
7. Results: happiness, a bar for each trained attribute, bond, and any rare line. Each bar shows the score before (the app's dark color), the gain (green, right after it), and the potential (a pale bar behind). The row also shows the new total over potential and the gain as numbers. A golden closing gets a line when the record has one. A playdate is not a contest, so results never name a winner or an upset. Replay or finish. A replay from history shows no bars.
8. Recent playdates, newest first, at most 3. Opening one replays the saved beats and does not pay rewards again. The row names a golden moment when the stored record has one.

## Data model

### PetSnapshot

Frozen. It does not age.

```ts
type PetSnapshot = {
  snapshotId: string;
  petId?: string;                 // the user's pet, so history can be cleared with that pet
  source: 'self' | 'npc' | 'rehomed' | 'friend';
  name: string;
  species: 'dog' | 'cat';
  breedId: string;
  look: Look;
  equipped: Equipped;             // NPC outfit, or the user's playdate outfit
  ageDays: number;
  weight: number;                 // the -1..1 index
  vitality: number;
  seed: number;
  originArchetype: Archetype;
  currentStyle: Archetype;
  attributes: Stats;              // stored current scores
  potential: Stats;
  favoriteActivities: ActivityId[];
  partyTricks: Array<'sit' | 'paw' | 'speak'>; // flavor for NPCs; never written back onto the pet
  formerOwnerId?: string;
  bondAtSnapshot?: number;
  createdAt: string;
};
```

The user's pet is snapshotted at the start. `equipped` on that snapshot is the playdate outfit, not the everyday outfit.

### ActivityDefinition

```ts
type ActivityDefinition = {
  id: ActivityId;
  name: string;
  speciesPairs: Array<'dog-dog' | 'cat-cat' | 'dog-cat'>;
  scenes: SceneId[] | 'any';
  maxAgeStage?: AgeStage;          // race stops at adult, so seniors are excluded
  attributesTrained: Partial<Record<Trait, number>>; // flat points, not a training taper
  beatTemplate: BeatTemplateId;
};
```

Starter pool: fetch, tug-of-war, race, chase, hide-and-seek, sniff-and-explore, splash (park, dog-dog only), nap together, trick show-off.

Dog-cat pairings use their own templates. Cats get a longer approach, a pounce or a jump onto a spot, and no tug-of-war or splash. The scene still ends warmly.

### PlaydateRecord

```ts
type PlaydateRecord = {
  version: 1 | 2;                  // new records are 2. A version 1 replay uses the stored beats as they were
  playdateId: string;
  ownerId: string;
  createdAt: string;
  sceneId: SceneId;
  hour: 14;
  petA: PetSnapshot;
  petB: PetSnapshot;
  activityId: ActivityId;
  outfit: Equipped;
  seed: number;
  beats: Beat[];
  outcome: PlaydateOutcome;
};

type Beat = {
  t: number;                       // ms from the start
  actor: 'A' | 'B' | 'both';
  action: string;
  params?: {
    x?: number;                    // a fixed spot, or...
    y?: number;
    toward?: 'partner' | 'meet' | 'away'; // ...follow the partner while the beat runs
    gap?: number;                  // stop distance in multiples of the two bodies touching (1 is nose to nose)
    pace?: number;                 // fraction of top speed
    lane?: number;                 // sideways shift, so pets can circle
    spread?: 'x' | 'y';            // two pets sent to one spot line up in x or in y (lanes)
  };
  emote?: string;                  // set only when the step named it
  fx?: string;
  sfx?: string;
  camera?: 'punch' | 'shake';
  tag?: string;
  gesture?: string;
  prop?: { kind: 'ball' | 'frisbee' | 'squeaky' | 'stick' | 'rope'; holder?: 'A' | 'B' | 'both' | null };
  tempo?: 'snap' | 'normal' | 'linger';
  holdBefore?: number;
  delay?: number;
};

type PlaydateOutcome = {
  moodDelta: number;               // happiness points
  attributeXp: Partial<Record<Trait, number>>;
  bondDelta: number;
  rareEvents: Array<{ type: 'trick_shown'; trickId: 'sit' | 'paw' | 'speak' }>;
};
```

Save the beats. Replays read `beats` and never re-run the generator. A version 1 record keeps today's voice-cue timing and does not play emotes, effects, or camera. New action names are added beside old ones. `tug` still rocks the old way. `tug_rope` is the rope tug.

### Relationship

`relationships[petId][partnerSnapshotId] = { bond: number; playdateCount: number; lastPlaydateAt: string }`

Bond is capped at 100. It is not `pet.bond`.

## Systems

### NPC pool

Generate 10 to 12 regulars once per owner. Use breed ranges, `attributesFor`, a seeded name, a legal coat, mixed `ageDays`, one to three wardrobe pieces, one or two favorite activities the species can do, and one or two party tricks. Store them as snapshots with `source: 'npc'`.

Each local calendar day, 3 are available. Seed the choice by `ownerId` and `YYYY-MM-DD`. The three include at least one dog and one cat.

### Activities

For a partner and a place, offer every legal activity up to 3. Weight the pick toward the partner's favorites. Seed it by date, partner, and place so it is stable that day and can change the next day. If only one activity fits, offer that one.

`playdate.allowCrossSpecies` defaults to true. When it is false, a dog-cat pair is offered nothing. The daily cast still includes both species.

### Timeline

`generatePlaydate({ petA, petB, activity, sceneId, seed, recentTags, latestTags, bond })` returns beats and an outcome. The RNG is seeded. No `Math.random()` and no `Date.now()` on this path. Scene placement, tempo, story picks, and the winner each use their own stream, so a new roll does not move the others.

- Each activity template has intro, main, and finale variants. A twist can replace or follow part of the main act. A twist that just played is not picked again while another one fits.
- Boldness chooses who moves first. If either pet's boldness is under 40, the timeline opens with 1 to 3 beats: sniff, hide, then approach. It still ends in play.
- Affection at 55 or more adds a nuzzle before the close.
- A race compares agility. Anything else compares stamina. The favorite's chance is `0.5 + 0.38 * tanh(gap / 25)`. A tie is the roll, and a tie is not an upset. One winner roll covers every winner and loser beat. When the underdog finishes first, that pet celebrates and the other does a double-take. That moment stays in the animation. Results do not record it.
- Intelligence raises the chance of a `trick_shown` result. When it hits, the guest shows sit, paw, or speak in the finale and the host celebrates. Speak opens the mouth. The line is display-only.
- One closing roll, then the closing place. A nap playdate always ends asleep. Otherwise, about 1 in 50 is a shared nap with one heart, and about 1 in 25 is both pets celebrating toward the camera. Both are tagged golden. After an upset with affection at 55 or more, the loser nuzzles. After zoomies, both flop. The rest end on nap, celebrate, or walk off together.
- The watcher reacts when a beat leaves them free. A shy watcher glances instead of a full-body reaction.
- Length, including a short hold on the last beat, is 45 to 90 seconds. The closing beat stays at the end.

Each activity has its own choreography. Steps carry a weight (share of the time) and can start together with the step before, so one pet can chase while the other runs. Beats that follow the partner are worked out again every frame.

- Fetch: one pet throws a ball, stick, or squeaky and the other brings it back, then they swap. With a cat, the cat stalks and pounces. A squeak stays silent until that clip exists.
- Tug: they meet in the middle and pull a rope until one wins. The rope is a curve between their mouths, and the tug gets one growl.
- Race: line up, sit ready, then run in separate lanes to one finish. The faster pet runs faster. Left and right swap by seed.
- Chase: one follows the other, who runs away (a cornered pet doubles back). Then they swap.
- Hide-and-seek: the shy pet sneaks off, the bold one waits, searches, and finds them.
- Sniff: meet, sniff nose to nose, circle, sit side by side.
- Splash: charge in together, hop around, a victory lap.
- Nap: settle side by side and sleep.
- Trick: take turns showing off while the other watches and cheers.

### Player

A separate world spawns both snapshots. Hour 14 goes through `todAt`. Directed mode maps a known action onto the existing pose channels (walk, run, sit, sleep, jump, pant, paw, bow, stalk, pounce, and the later skid, zoomies, roll, and flop) and does not let idle or fetch take over. An unknown action is skipped. A gesture plays on top of the action. Home play never sets directed mode.

Version 2 fires each beat once, by its index, the first time playback passes that time. Two beats that share a time both fire. Sound comes from the beat: bark and meow use the speak path, a yip is the bark a little faster, and purr, pant, happy, sneeze, growl, and trill play their clips. Squeak, boing, and whoosh stay silent. Version 2 keeps only the first ambient voice cue, and drops it when a sound beat is within 1.5 seconds. Version 1 still plays the full cue list.

A punch or a shake runs only while that beat's window is open, and only for version 2. Reduced motion ignores both. With no camera beat active, the frame is the same as before. A photo finish and an upset punch in. A tug flip shakes. Zoomies punches once at the skid.

Contact: each frame the player works out body size for both pets, aims follow-the-partner beats at the partner's live position, then pushes overlapping bodies apart (a limited speed, so nothing pops). The floor is wide front to back and shallow side to side, so pets in different rows pass in front of or behind one another, and a head-on pair slips past. Pets are not pushed while one is airborne. A stopped pet faces its partner. A `tug` beat rocks both pets the same way.

Skip and a natural ending share one completion path. Replay uses the saved beats only.

### Rewards

Applied once, on complete or skip:

- Happiness `+12`, clamped at 100.
- Flat attribute points from `attributesTrained`, which are the attributes the activity card lists. They are added on top of the score the pet shows (the higher of stored current and natural growth), stored in current, and clamped at potential. No `trainingGain`, no level XP, no change to `pet.bond`.
- The results bars use the shown score before and after, worked out from the pet before the rewards are paid. Aging or a cap can make the shown gain smaller than the points.
- Partner bond `+8`, clamped at 100.
- A rare "showed off a trick" line when the roll hits. Nothing is stored on the pet. Results do not mention a winner or an upset.

### Cooldown

`playdate.cooldownMinutes` defaults to 60. `getCooldownRemaining(last, now)` is `max(0, last + cooldown - now)`, clamped to at most one cooldown. `skipCooldown()` does nothing. A paid skip needs server-verified time.

### Storage

One local blob per `ownerId`: cast, relationships, history (newest first, max 3), `lastPlaydateCompletedAt`. Discarding the pet deletes that pet's history, relationships, and the cooldown. The cast stays.

## Friend playdates

A linked player who has friends can invite them from the partner step. NPC cards stay the one-partner path above.

1. Each friend who has a pet is a toggle. A tap shows a checkmark. A second tap clears it. The cap is 5. A friend with no pet stays on the list and cannot be checked. **Invite to playdate** stays disabled until at least one friend is checked, and while the cooldown is running.
2. Place. Only rooms this pet owns: the living room, the bedroom, and the catio when this pet is a cat. Park and training school stay on the NPC path.
3. Activity. One friend (two pets, counting the player's pet) uses the NPC activity offer for that pair and room. Two or more friends (three to six pets) offer three of four group activities, seeded by the date, the guest ids, and the room, so the set is stable that day and can change the next day.
4. Outfit. The player's closet, same as an NPC playdate. Friends are not dressed here.
5. Playback, results, and history. Rewards still pay once, to the player's pet. Bond is stored for every friend. The results and the history row name every friend.

Group activities are not in the NPC offer:

- **Conga.** Stamina and agility. Single file. The leader walks a loop of floor points. Each friend takes the same path one step later.
- **Line dance.** Obedience and affection. One row. The same step, hop, spin, and sit at the same time.
- **The wave.** Agility and affection. The same row. A hop travels from the player down the line, then a spin travels back.
- **Pass the toy.** Intelligence and affection. An arc. A ball passes from the player through each friend and back.

A pair record stays version 2 with `petA` and `petB`. A group record is version 3. `petB` is the first friend. `party` is every friend, length 2 to 5. Group beats use `slot` (0 is the player's pet) and `actor: 'all'` when every pet does the same thing. A prop may set `holderSlot`. Targets are fixed floor points. Replay reads the stored beats.

Each friend is shown in the outfit on their pet card. They do not wear the NPC catalog. The card's `owned` list is that player's closet: ledger quantities for `hat`, `glasses`, `neckwear`, `jacket`, and `boots`, plus anything they already have equipped. A worn piece is kept only when it is in that list. An owned piece they are not wearing is not added.

## Out of scope

- Rehome, sharing, and async viewing by someone else
- A trick catalog or writing a learned trick onto the pet
- Cooldown-skip purchases
- Notifications when the cooldown ends
- Cloud sync
- Treats or toys brought to the playdate

## Acceptance checks

- The same inputs and seed produce the same beats.
- A saved record replays from `beats` without calling the generator.
- Daily NPCs and activity options stay the same across relaunches on the same day and can change the next day.
- Each day's NPCs include at least one dog and one cat.
- A senior is never offered a race. Splash appears only in the park, and only for two dogs.
- A dog-cat playdate is never offered tug-of-war or splash, and its beats are not the dog-dog template.
- A low-boldness pairing opens with warm-up beats and still ends warmly: nap, celebrate, walk off, flop, or nuzzle. A golden closing is tagged golden.
- The same seed repeats a contest. A tie is an even chance. A huge stat gap still leaves the underdog a small chance, and that finish still includes the celebration and the double-take in the beats. Results do not call it an upset.
- A shown trick has a finale beat and a partner celebrate. The closing beat stays at the end of the timeline.
- Version 1 replays match the stored beat samples. Version 2 uses at most one ambient cue. Parallel sound beats at the same time each fire once. An unknown sound stays silent. With no camera beat active, the stage passes no camera. A punch follows the zoom curve, and the same seed shakes the same way.
- Rewards apply once, including after skip. Happiness never passes 100. Attribute current never passes potential. A second settle of the same id does not pay again.
- Each activity plays a different sequence of moves. A chase has one pet following while the other runs away. A race runs in two lanes to one finish. Pets never overlap in any activity, and pets get close in tug, chase, sniff, nap, and hide-and-seek.
- Results show a bar for each trained attribute with the before, the gain, and the potential, plus the new total and the gain as numbers.
- After a playdate, Start is disabled, every choice is greyed out and disabled, and the countdown matches the remaining time. Changing `playdate.cooldownMinutes` changes the wait. A clock moved backward never reports more than one full cooldown.
- History keeps the newest 3. Bond with a partner remains after that playdate drops off the list.
- The everyday outfit is unchanged by the playdate outfit.
- Works with no network.
