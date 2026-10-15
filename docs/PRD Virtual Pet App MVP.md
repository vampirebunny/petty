# PRD: Virtual Pet App (MVP)

Oct 14, 2026 · @A
Updated Oct 15, 2026

## Overview

A mobile app for iOS and Android where each user adopts a dog (cats come later) that ages gradually from puppy to senior, develops a breed-based personality, learns tricks the user has to discover and teach, and can be shown off through outfits, shareable clips and friends. The app name is not decided yet.

**Audience.** The working plan is 13+. The gate is an age attestation. Whether the core audience is nostalgic adults, teens or cozy-game players is still open.

**What makes it different.** Most virtual pet apps are care loops with mini-games and dress-up. This one has a pet whose personality is visible and different from every other pet, training that rewards the owner's real time and skill, tricks that must be discovered, and ways to show all of it off. It works offline and lets people play before creating an account.

**How to use this document.** Requirements are numbered and each feature has acceptance checks. Build in the order of the release phases, and do not build anything listed as out of scope. Phase 0 is specified in "Cursor Brief: Pet Blob Prototype". Phase 1 is specified in "Phase 1 Brief: Core Pet". When a requirement is unclear or two requirements conflict, ask instead of guessing.

**Product principles**

1. Cute and expressive: the pet's emotion should be readable at a glance.
2. Care without punishment: the pet never dies, there are no guilt mechanics, and training uses positive reinforcement only.
3. Time and skill matter: outcomes depend on the owner's consistency and skill, never on payment.
4. Hidden depth: show progress, hide the rolls and secret trick sequences, and let discovery be part of the fun.
5. Show-off: anything worth bragging about can be shared.
6. Offline-first and guest-first: play immediately, anywhere, and ask for an account later.
7. Safe by default: 13+, private by default, no free-text chat between users, and minimal data.
8. Seamless aging: the pet changes a little every day and the user never sees a stage "switch". Life stages are names for ranges of a continuous scale, not separate art. In the senior years, good care visibly rejuvenates the pet.

## Goals, non-goals and metrics

The MVP exists to answer one question: do people come back to care for, train and show off a pet that has its own personality? Everything that does not help answer it waits.

**Goals**

- A pet that feels alive: needs that change over real time, readable moods, and reactions to touch.
- A personality system that makes every pet different, with visible traits and hidden potential.
- Training and trick discovery that reward time and skill.
- Ways to show off: outfits, learned tricks, a shareable card and clip, and pet-to-pet playdates.
- A full experience offline and without an account.

**Non-goals for the MVP**

- Battles, trading and collecting many pets
- Cats, and more than 2 to 3 dog breeds
- Pet exchange or restart
- Real-friend playdates, public showcases and contests
- Any chat between users
- Advertising, loot boxes and purchases
- 3D pets, AR, and live multiplayer

**Success metrics**

- Day-1 and day-7 retention
- Sessions per day
- Share of users who train their pet and discover a trick
- Share cards sent
- Friend invites accepted
- NPC playdates per user

These decide whether to add breeds and features or to fix the core loop first. No target numbers are set yet.

## Platform, stack and constraints

Build one mobile codebase for iOS and Android, in portrait, as a 2D side-view game. No game engine is needed, and one would make friends, settings, notifications, billing and age signals harder.

| Layer | Choice | Notes |
| --- | --- | --- |
| App | Expo / React Native with TypeScript | New standalone repository. Needs a development build once Rive and the age-signal APIs are added. |
| Animation | Placeholder shapes first, then Rive | Phase 0 uses plain views. Proposed: a Rive spike in Phase 1 with a placeholder blob rig that proves the two aging inputs (maturity and vitality, see F2). The final art arrives in Phase 3. Rive does not run in Expo Go, so it needs a development build. |
| Gestures | react-native-gesture-handler | Tap, hold, stroke, flick and swipe. |
| Motion | react-native-reanimated | Squash, bounce, arcs and running. |
| Local storage | AsyncStorage at first, then SQLite | Always behind a storage interface. |
| Backend | Supabase | Postgres, auth with anonymous sign-ins, Edge Functions, scheduled jobs and row-level security. Not needed until Phase 4. |
| Push and reminders | Local notifications first | Remote push only if needed later. |
| Payments | RevenueCat | Only if purchases are added, which is out of scope for the MVP. |
| Age signals | Apple Declared Age Range API, Google Play Age Signals API | Platform-provided age categories. |

**Constraints that shape every feature**

- Offline-first. The core game must run with no connection, because the simulation runs on the device.
- Guest-first. No account is needed to start playing.
- 13+ audience with an age attestation and matching store age rating.
- Side-view camera, which keeps the animation workload low. Angled, top-down and 3D views are out of scope.
- One pet at a time in the MVP.
- Pure simulation module shared between the app and the server, as described under architecture rules.

## Release phases

Six phases take the app from the prototype to a beta. Phases 1 and 2 run on placeholder art, so the illustrator's lead time does not block them. Do not start a phase until the previous one meets its exit criteria.

Each phase builds on the one before it and ends at an exit check, listed in the table below.

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| 0. Blob prototype | Needs, feeding, resting and petting on one screen, local-only, drawn with plain shapes. Specified in "Cursor Brief: Pet Blob Prototype". | Runs in Expo Go, state survives closing the app, and the time-jump debug panel works. |
| 1. Core pet | One assigned dog, age attestation, naming, temperament reveal, continuous aging on the closed-time maturity clock and care-driven vitality, internal stage labels and senior bands, personality traits, levels, and local reminders when a need is low. Placeholder art is driven by maturity and vitality. A Rive spike is proposed once those inputs are stable. | A user who attests they are 13 or older can name the assigned puppy and care for it. An under-13 attestation stays blocked across relaunch. Debug controls move maturity and vitality across the whole range with no visible jump and no stage name on screen. A senior pet can be moved between bands through care. |
| 2. Play and training | Ball fetch and one toy, training with mastery, 3 to 5 tricks with about 3 discoverable, the trick book, and NPC playdates. | A player can discover and teach a trick and finish an NPC playdate, all offline. |
| 3. Art and audio | The Rive pet and rig built on the maturity and vitality inputs, 2 to 3 breeds, outfits, pet sounds, UI sounds and music. | Final art plays smoothly on real devices, and breeds and outfits swap through configuration. |
| 4. Accounts and social | Guest-to-account upgrade, Supabase sync, share card and clip, read-only friend visits, age signals, and account and data deletion. | A guest can upgrade, back up the pet, add a friend by invite link and share a card. |
| 5. Beta | Legal and store checks, matching age rating, privacy policy, analytics and a small beta. | The privacy attorney consult is done, the store listing and rating match the 13+ terms, and the beta is released. |

Later, after the MVP proves the loop: cats and more breeds, real-friend playdates, pet exchange or restart, purchases and a larger outfit catalog, mini-games, multiple pets, and public showcases.

## Functional requirements: care and growth

Requirements are numbered so they can be referenced in tasks and commits. "Proposed" marks a requirement that is a recommendation and not yet a decision.

**F1. Onboarding and adoption (Phase 1)**

- R1.1 First launch shows an age attestation. The screen states that the app is for ages 13 and up and offers two choices: "I am 13 or older" and "I am under 13". It does not ask for a birthdate. A user who attests they are 13 or older continues, and the app stores a local pass so the screen does not appear again. A user who says they are under 13 cannot continue. The app stores only a local blocked note, creates no pet, and shows the blocked screen on later opens. Nothing about the check is sent off the device. Deleting the app clears the note.
- R1.2 After the gate the user goes straight to adoption, with no account step.
- R1.3 The app assigns one puppy of the single Phase 1 breed, created from a seed. The user does not choose a breed or pick among puppies.
- R1.4 The user names the pet, and the app then reveals the pet's temperament label.
- R1.5 The pet is created from a seed, and the seed is stored with it.

Acceptance: an under-13 attestation blocks progress, and the block is still there after the app is closed and reopened; a passing attestation reaches the home screen with a named pet and no account screen; the same seed always creates the same pet.

**F2. Care and aging (Phases 0 and 1)**

- R2.1 Needs are fullness, energy and happiness, each 0 to 100 with higher being better. They change with real elapsed time, including while the app is in the foreground, computed from timestamps, with elapsed time capped at 48 hours. The pet never dies or runs away. Decay and sleep rules are in "Cursor Brief: Pet Blob Prototype".
- R2.2 Actions are feed, toggle rest and pet. While asleep, feeding and petting are ignored and the pet only stirs.
- R2.3 Aging runs on two continuous values, each from 0 to 1. Maturity only goes up. It stays still while the app is in the foreground. When the app returns, maturity gains the time the app was closed, up to 48 hours, and any closed time past that cap is dropped. One return may cross at most one stage boundary; maturity past that boundary is dropped. Debug time controls bypass the cap and the boundary rule. Until the care window exists, maturity accrues at full rate. After that, poor care can slow maturity toward a floor around half speed, and neglect does not stop aging. Vitality moves up and down with care (R2.8) and uses the same capped absence. Life stages are internal labels derived from these values, not separate states with separate art: puppy, older puppy, adolescent, adult and senior, with the senior stage split into bands (R2.9). A stage label sets the level ceiling and the learning speed, and nothing else. The maturity threshold of each label is a tunable constant. The user never sees a stage name.
- R2.4 Mood is derived from the needs using the priority rule in the prototype brief.
- R2.5 Local notifications remind the user when a need is low. They do not announce life stage labels or senior bands. The tone is calm with no guilt wording, and the user can turn them off in settings.
- R2.6 Development builds include a debug panel that fast-forwards time and has sliders for maturity and vitality. Time jumps and sliders bypass the maturity catch-up cap and the one-boundary rule. The debug panel may show internal stage labels. The rest of the app does not.
- R2.7 Seamless aging. The pet's appearance is a function of maturity and vitality only, so proportions, size and aging cues change a little at a time. No stage change plays a transition, effect or swap. On return, the stored maturity updates immediately and the view eases to it over about a second. The user never watches a jump, and the user never sees a stage name.
- R2.8 Vitality is driven by a rolling window of recent care: diet quality, exercise, play and attention. It moves slowly toward a target set by that window, so one action cannot swing it. Neglect lowers it gradually to a floor of "slow and sleepy but content". It never reaches a state that is distressing or fatal.
- R2.9 The senior stage has internal bands, such as early senior, senior and elderly, defined as ranges of vitality. A senior pet moves between bands in both directions: more exercise, play, attention or a better diet raises vitality and rejuvenates it, and neglect lowers it. Band boundaries use hysteresis so the label does not flicker. The current band is remembered so that margin can be applied. Vitality stays the source of truth. Band names are never shown.
- R2.10 Rejuvenation cap. Vitality affects every pet's energy and mood, but its aging cues become visible mainly once maturity reaches the senior range. Proposed: a pet's best possible look is capped by its maturity, so a senior pet can look spry and bright with a graying muzzle but never returns to puppy proportions. Maturity is never reduced.
- R2.11 Vitality drives visible aging cues: muzzle graying, ear droop, posture, coat dullness, eye brightness, and gait and animation speed. It also scales energy recovery and the number of play and training sessions the pet is happy to do. It does not lock the owner out of any feature.
- R2.12 Diet and exercise need something to measure. Proposed: a small set of food types with different quality, and exercise measured from fetch and play sessions. Until Phase 2, vitality uses feeding regularity and attention only.

Acceptance: the simulation tests from the prototype brief pass; a 100-hour absence gives the same result as a 48-hour one for needs and for maturity; maturity never decreases and stays still while the app is in the foreground; a return crosses at most one stage boundary; vitality changes are bounded per day and respond to care in both directions; a senior pet can move between bands through care and back through neglect without flicker; the debug sliders move the pet smoothly across the whole range with no visible jump; no user-facing screen shows a stage name.

**F3. Personality and stats (Phase 1)**

- R3.1 Four traits in the MVP: energy, boldness, affection and willfulness. Each pet's value is the breed base plus a hidden roll taken from its seed.
- R3.2 Temperament boosts one trait by about 10 percent and dampens another by about 10 percent, and gives the pet a label such as "bold explorer".
- R3.3 Care patterns nudge traits slowly, within bounds, so a pet drifts but never loses its breed character.
- R3.4 Level rises with experience from care, training and play, and each life stage label has a level ceiling. Ceilings are step values by label and do not change gradually, so the level cap only moves when a label changes.
- R3.5 A stat's effective value is the breed base plus the hidden roll plus trained points, scaled by level and adjusted by temperament. Trained points are not used in the MVP.
- R3.6 The app shows level, the temperament label with the two stats it nudges, approximate stat bars and trick mastery. It never shows life stage names, senior bands, or exact roll values. Stage names stay internal (R2.3).
- R3.7 Roll ranges are narrow enough that no pet is unplayable, and care and training outweigh luck.

Acceptance: the same seed always gives the same traits; two pets of the same breed differ; stats stay within bounds; no screen shows an exact roll value.

## Functional requirements: play, training and outfits

**F4. Play interactions (Phase 2)**

- R4.1 Petting: a tap or a stroke on the pet sends a pet event, at most one every 400 milliseconds, with a light haptic tap. It is ignored while the pet is asleep.
- R4.2 Ball fetch: a flick sends the ball along an arc computed in code. The simulation decides whether the pet fetches it, brings it back or ignores it, from its traits and its fetch mastery. The view only animates that outcome. Fetch costs energy and raises happiness and bond.
- R4.3 One toy in the MVP: the user can give the pet a toy from their inventory. The pet may have a favorite based on its personality, and the toy attaches to a mouth attach point on the rig.
- R4.4 The simulation decides what happens and the view plays it out. The view never holds game rules.
- R4.5 Side view only. The pet moves left and right along a ground line.

Deferred: the obstacle course, and the laser pointer that arrives with cats.

Acceptance: stroking feels continuous but cannot be spammed; a flicked ball always produces a simulation outcome that the view plays; the same traits and seed give the same fetch result.

**F5. Training and tricks (Phase 2)**

- R5.1 A trick is defined by an id, a name, the base motions it chains, a difficulty tier, prerequisites, trait affinities, an optional discoverable cue sequence, and an unlock condition.
- R5.2 The MVP has 3 to 5 tricks, about 3 of them discoverable by sequence, built from a small library of base motions: sit, jump, spin, roll and paw.
- R5.3 In a training session the owner picks a trick and plays a reward-timing moment, tapping within a short window after the pet performs the behavior. Harder tricks are taught in steps. An assist mode removes the timing game.
- R5.4 Short, regular sessions beat long ones, through diminishing returns and a daily fatigue meter. Skills fade without practice but are never lost.
- R5.5 Each trick tracks mastery, meaning whether the pet knows it, and reliability, meaning how consistently it performs. An attempt succeeds by a seeded roll against the trick's difficulty, with modifiers from the pet's stats, energy and bond and from the owner's skill rating.
- R5.6 The owner skill rating grows from doing training well. It is earned and never bought.
- R5.7 Positive reinforcement only. There are no punishment mechanics.
- R5.8 Discovery uses six cue inputs: swipe up, down, left and right, tap and hold. A command is 3 to 5 inputs in sequence, and hidden sequences unlock tricks in the trick book.
- R5.9 A near miss gets a pet reaction, such as a head tilt or an ear perk, so guessing feels warmer or colder. Each attempt costs a little energy, and the pet gets confused after many wrong tries, with a short cooldown.
- R5.10 The trick book shows undiscovered tricks as silhouettes with hints. Hints come from the pet's own spontaneous behavior, a journal, and watching NPC pets perform.
- R5.11 Sequences are checked through a validator interface. In the MVP the sequences ship inside the app. Later, rare tricks are confirmed by the server on sync and stay marked as pending while the phone is offline.
- R5.12 Discovering a sequence unlocks the trick, but mastery and reliability still have to be built through training.

Deferred: proofing around distractions, consequences for bad habits, and per-pet quirk tricks.

Acceptance: a hidden sequence can be found by guessing with near-miss feedback; training raises mastery over several sessions and decays with neglect; the same seed and inputs give the same attempt result; no screen offers a way to pay for skill.

**F6. Outfits (Phase 3)**

- R6.1 Outfit slots are hat, neck, back and full costume. The MVP uses 2 slots and 4 to 6 items.
- R6.2 Each rig exposes an attach point per slot. One item asset fits every breed and every point on the maturity scale, because the attach points move with the rig and scale with breed size and maturity, with no per-stage overrides.
- R6.3 The user can equip and unequip items. Equipped items appear on the pet and on its share card.
- R6.4 Items are earned through tricks and milestones, plus a few free starters. There are no purchases and no randomized rewards in the MVP.
- R6.5 The equipped item is a bound property of the Rive file, set through data binding.

Acceptance: every item displays correctly on every breed at several maturity values from puppy to senior; equipping persists after restarting the app; the share card shows what is equipped.

## Functional requirements: social, accounts and sync

**F7. Social and show-off (NPC playdates in Phase 2, the rest in Phase 4)**

- R7.1 Share card: an image of the pet showing its name, breed, temperament label, equipped outfit and learned tricks, with a download link. It does not show a life stage or senior band. It is sent through the phone's share sheet. It contains no personal details by default, such as a username or location.
- R7.2 Trick reel: a short clip, generated on the device, of the pet performing its learned tricks in sequence, shareable the same way.
- R7.3 Friends: a mutual friendship is created through an invite link or friend code and needs an account. Either side can remove a friend or block them.
- R7.4 Friend visit: read-only. The user sees a friend's pet as of its last synced snapshot, with its mood, outfit, tricks and trophies, and can leave a preset reaction. It works from cached data when offline.
- R7.5 NPC playdates: a roster of NPC pets, each with a breed, temperament, name and a couple of quirks, stored in the app. The same simulation resolves a playdate on the device from a seeded roll, and the replay can play immediately. There is no account, server or accept step, so it works offline and for guests. Each NPC has a friendship level, playdates are capped per day, and small items or outfits can be earned. Watching an NPC perform a trick can reveal the first input of a hidden sequence.
- R7.6 Safety rules apply to every social feature: no free-text chat, blocking and reporting for friends, private by default, and no public discovery of other users.

Deferred: real-friend playdates, public showcases and contests. The planned real-friend flow is asynchronous: one friend invites, the other accepts, the server snapshots both pets, resolves the outcome once from their traits and a seeded roll, notifies both, and each device replays it.

Acceptance: a guest can share a card and complete an NPC playdate with no connection; a signed-in user can add a friend by invite link and view their pet; blocking removes all access immediately; no share card contains personal details.

**F8. Accounts and sync (Phase 4)**

- R8.1 Guest-first. The entire core game works without an account. The pet has a UUID created on the device at adoption.
- R8.2 Upgrade through Sign in with Apple, Google or an emailed magic link, with no passwords. The guest pet becomes the account's pet and keeps the same UUID. Confirm the current app store sign-in rules before building.
- R8.3 Sign-up prompts appear at moments of value: adding a friend, after the pet is named and has learned a first trick, when backing up, and when using a second device. They are skippable, framed as protecting the pet, and never nagging.
- R8.4 Locked until sign-up: friends, visits, real-friend playdates, backup and other devices. NPC playdates and share cards stay available to guests.
- R8.5 Sync: actions are saved locally as events and uploaded when the phone is online. The server replays them through the same simulation module, and conflicts are resolved by event timestamp order.
- R8.6 Clock integrity: cap how much elapsed time counts, and reconcile with server time on sync.
- R8.7 In-app account deletion removes the server data. A guest can delete local data.

Acceptance: a guest can upgrade without losing the pet; two devices converge to the same pet state; a pet played offline for several days syncs correctly; deleting the account removes the server data.

## Functional requirements: audio and safety

**F9. Audio (Phase 3)**

- R9.1 Animal sounds only. Pets do not speak in words.
- R9.2 A base set per species. For dogs: bark, yip, whine, growl, a happy sound and a snore, with several takes of each so they do not repeat audibly.
- R9.3 Each breed has a pitch multiplier applied through playback rate, with small breeds higher and large breeds lower, kept within a modest range. Each playback adds a few percent of random variation in pitch and volume.
- R9.4 Maturity, vitality, mood and personality modify the sound: pitch falls smoothly as maturity rises, so puppies sound higher; excited sounds are faster, sleepy sounds softer, and bold pets louder; low vitality gives slower, softer sounds.
- R9.5 The "speak" trick scales with mastery, for example the number of barks or their pitch, and a failed attempt gives a funny squeak.
- R9.6 Sounds are triggered by Rive events so they line up with the animation.
- R9.7 UI sounds and one or two calm music loops. Music is quiet by default, easy to mute, respects the phone's silent mode, and has a haptic or on-screen fallback.
- R9.8 Audio ships inside the app, compressed, with a license log recording each asset's source and license.

Acceptance: two breeds sound audibly different; no sound plays in silent mode; every audio file has a license log entry.

**F10. Safety and compliance (gates Phases 1, 4 and 5)**

- R10.1 The terms say 13+, the attestation gate enforces it, and the store age rating matches. Marketing and design must agree with 13+.
- R10.2 In Phase 4, integrate Apple's Declared Age Range API and Google's Play Age Signals API. If a store reports an age under 13, treat the user as under 13.
- R10.3 Have a process to delete an account when a user turns out to be under 13.
- R10.4 Private by default, friendships by mutual acceptance only, no public discovery of users, and no free-text chat.
- R10.5 Minimal data collection, no targeted advertising to minors, no streak or guilt mechanics, and no randomized rewards.
- R10.6 A privacy policy, in-app account and data deletion, and blocking and reporting.
- R10.7 Before release: a privacy attorney consult, a fresh check of the state app-store age laws, a trademark check on the app name, and a written rights assignment from the illustrator.

Acceptance: an under-13 attestation cannot continue, and a store age signal of under 13 cannot create an account or reach social features; the store listing, terms and marketing all state 13+; a deletion request removes all the user's server data.

## Data model

These are working types for the simulation and storage layers. Field names can change, but keep the separation between fixed configuration (breeds, tricks, NPC pets, outfits) and per-pet state.

```ts
type Trait = 'energy' | 'boldness' | 'affection' | 'willfulness';
type Stats = Record<Trait, number>;
// Internal labels derived from maturity and vitality, never stored as the source of truth,
// and never shown in the product UI
type Stage = 'puppy' | 'olderPuppy' | 'adolescent' | 'adult' | 'senior';
type SeniorBand = 'earlySenior' | 'senior' | 'elderly';
type OutfitSlot = 'hat' | 'neck' | 'back' | 'costume';
type CueInput = 'up' | 'down' | 'left' | 'right' | 'tap' | 'hold';

type Pet = {
  id: string;              // UUID created on the device at adoption
  seed: number;            // makes the pet reproducible
  rngState: number;        // seeded generator state
  name: string;
  breedId: string;
  maturity: number;        // 0 to 1, only increases, drives size and proportions
  vitality: number;        // 0 to 1, care-driven, can rise and fall, drives aging cues
  careWindow: CareSample[]; // rolling recent care used to set the vitality target
  bornAt: number;          // ms timestamp
  lastUpdatedAt: number;   // ms timestamp of the last needs advance
  maturityAppliedAt: number; // ms timestamp of the last maturity settle; foreground ticks refresh it without adding age
  needs: { fullness: number; energy: number; happiness: number };
  asleep: boolean;
  roll: Stats;             // hidden birth roll, never shown
  temperament: { boosts: Trait; dampens: Trait };
  drift: Stats;            // slow shift from care patterns
  seniorBand?: SeniorBand; // hysteresis cache, not the source of truth
  level: number;
  xp: number;
  bond: number;
  tricks: Record<string, TrickProgress>;
  equipped: Partial<Record<OutfitSlot, string>>;
  favoriteToyId?: string;
};

type CareSample = {
  day: number;             // day index
  dietQuality: number;     // 0 to 1
  exercise: number;        // 0 to 1
  play: number;            // 0 to 1
  attention: number;       // 0 to 1
};

// Fixed configuration: stage labels and senior bands are ranges, not states
type StageDef = {
  stage: Stage;
  minMaturity: number;     // tunable threshold
  levelCeiling: number;
  learningSpeed: number;
};

type SeniorBandDef = {
  band: SeniorBand;
  minVitality: number;
  maxVitality: number;
  hysteresis: number;      // margin before the label changes
};

// Derived, never stored
const stageOf = (pet: Pet): Stage => { /* from maturity via StageDef config */ };
const seniorBandOf = (pet: Pet): SeniorBand | null => { /* from vitality, only when the stage is senior */ };

type TrickProgress = {
  discovered: boolean;
  pending?: boolean;       // discovered offline, awaiting server confirmation
  mastery: number;         // 0 to 100, does the pet know it
  reliability: number;     // 0 to 100, does it perform consistently
  lastPracticedAt: number;
};

// Fixed configuration, not per-pet state
type TrickDef = {
  id: string;
  name: string;
  motions: string[];       // base motions it chains, e.g. spin then jump
  difficulty: number;      // difficulty tier
  prerequisites: string[];
  affinities: Partial<Record<Trait, number>>;
  sequence?: CueInput[];   // hidden 3 to 5 input command, if discoverable
  unlock: 'start' | 'sequence' | 'milestone';
};

type BreedConfig = {
  id: string;
  species: 'dog' | 'cat';
  baseStats: Stats;
  pitchMultiplier: number; // for audio playback rate
  sizeScale: number;
  sampleSet: string;       // audio set id
  artVariant: string;      // coat, ears, tail, markings
};

type NpcPet = {
  id: string;
  name: string;
  breedId: string;
  stats: Stats;
  temperament: { boosts: Trait; dampens: Trait };
  quirks: string[];
};

type OwnerProfile = {
  skillRating: number;
  techniqueUnlocks: string[];
  npcFriendship: Record<string, number>;
};

type PetEvent =
  | { type: 'feed'; at: number }
  | { type: 'toggleRest'; at: number }
  | { type: 'pet'; at: number }
  | { type: 'fetch'; at: number; throwPower: number }
  | { type: 'giveToy'; at: number; toyId: string }
  | { type: 'trainAttempt'; at: number; trickId: string; timingQuality: number }
  | { type: 'cueSequence'; at: number; inputs: CueInput[] }
  | { type: 'equip'; at: number; slot: OutfitSlot; itemId: string | null }
  | { type: 'npcPlaydate'; at: number; npcId: string };
```

**Backend tables (Phase 4)**

| Table | Holds | Access |
| --- | --- | --- |
| pets | The latest synced pet state, keyed by the pet UUID | Owner only, plus a read-only snapshot view for mutual friends |
| pet\_events | An append-only log of the events above, used for replay and sync | Owner only |
| owner\_profiles | Skill rating, technique unlocks and NPC friendship | Owner only |
| friendships | Mutual friend links with a status, created by invite link or code | Both users |
| reactions | Preset reactions left on a friend's pet | Both users |
| blocks | Blocked users | Owner only, and it overrides friend access |

## Architecture rules and non-functional requirements

**Architecture rules**

1. The simulation is pure TypeScript with no React, no I/O, no `Date.now()` and no `Math.random()`. Time comes in as elapsed milliseconds, and randomness comes from a seeded generator whose state is stored with the pet.
2. The user interface never edits pet state directly. It sends an event to the simulation and renders what comes back.
3. The pet view receives only props such as needs, mood, maturity, vitality and an animation cue. It holds no game rules, so Rive can replace the placeholder shapes without touching anything else. In Rive, maturity and vitality are number inputs that drive blend states, and the stage label is never passed to the view. Stage labels are internal and are never shown to the user.
4. All storage sits behind an interface. Local storage is the first implementation and the backend is the second.
5. Tunable numbers live in config files. Breeds, tricks, NPC pets and outfits are data, so adding one is a config entry and not new code.
6. The simulation decides what happens and the view only animates it.
7. The same simulation module runs in the app and in the server's functions, so the server can replay events and reach the same state.
8. Events are the source of truth for sync, and state is derived from them.
9. Trick sequences are checked through a validator interface, so the check can later move to the server.
10. Time is computed lazily from timestamps. There is no per-pet server tick and no background timer for the simulation.

**Non-functional requirements**

- Offline: the core loop of care, play and training works with no connection at all.
- Performance: animation stays smooth on mid-range phones, and screens open without waiting on the network.
- Size: audio is compressed and loops are short. Core art and sound are bundled, and optional extras can be hosted remotely so new breeds ship without an app update.
- Accessibility: an assist mode for the timing game, an alternative to swipes such as tap rhythms, no meaning carried by color alone, and haptic or on-screen fallbacks for sound.
- Privacy: collect the minimum, keep analytics free of personal data, and support deletion.
- Testing: every simulation feature ships with unit tests for determinism, bounds and thresholds, and the same seed must always give the same result.
- Observability: crash reporting, and analytics events for the success metrics, with no personal data.
- Code quality: TypeScript in strict mode, small files, and one commit per task.

## Decisions and open questions

Treat decided items as fixed. For open items, build the proposed default behind configuration and do not spend effort polishing them.

**Decided**

| Topic | Decision |
| --- | --- |
| Platform | Expo / React Native with TypeScript, iOS and Android |
| Camera | Side view, 2D |
| Species in the MVP | Dog only. Phase 1 ships one breed and assigns one puppy. Phase 3 can add breeds as content. The user does not pick a breed or a puppy. |
| Age gate | Attestation that the user is 13 or older, or that they are under 13. No birthdate. A local pass or blocked note stays on the device. Apple and Google age-band checks arrive in Phase 4 and override a pass when the store says under 13. |
| Adoption | One assigned puppy from a seed. The user names it and then sees the temperament label. |
| Aging model | Two continuous values, maturity (only up) and vitality (care-driven, reversible), with five internal stage labels (puppy, older puppy, adolescent, adult, senior) and senior bands. No stage-change transition and no separate art per stage. |
| Maturity clock | Still while the app is in the foreground. On return, gain closed time up to 48 hours and drop the rest. At most one internal stage boundary per return. Needs keep ticking in the foreground. Debug controls bypass the cap and the boundary rule. |
| Care and maturity | Full rate until the care window exists. After that, poor care can slow maturity toward a floor around half speed. Neglect does not stop aging. |
| Stage labels | Internal only. They set level ceilings and learning speed. They are never shown in the UI, notifications, or share card. |
| Aging art | One continuous dog driven by maturity and vitality. A stage change does not swap the animation. |
| Death | None. The pet never dies. |
| Growth model | Pokémon-style stats, levels and growth only. No battles, trading or collecting many pets. |
| Audio | Animal sounds only, with a different pitch per breed |
| Offline | The core game must work offline |
| Accounts | Guest-first, with an account later and no friction at the start |
| Social | Share card, read-only friend visits and NPC playdates in the MVP. Real-friend playdates later, asynchronous, with acceptance by default. |
| Prototype | Standalone Expo repository, local-only, drawn with plain shapes |

**Open**

| Question | Current default |
| --- | --- |
| Core audience: kids, nostalgic adults, teens or cozy-game players | Open. The working plan is 13+. |
| Outfits: earned, purchasable or a mix | Mix, with earned items signaling effort. None purchasable in the MVP. |
| Pet exchange or restart | Not in the MVP. Revisit once attachment is visible. |
| Real days per life stage | Tunable maturity thresholds, to be set by playtesting. Proposed starting point: puppy days 0 to 7, older puppy 7 to 21, adolescent 21 to 45, adult 45 to 180, senior after 180. |
| Senior rejuvenation limit | Proposed: capped by maturity, so a senior can look spry but never like a puppy (R2.10) |
| How diet and exercise are measured | Proposed: a small set of food types plus exercise from fetch and play (R2.12). Needs a decision before Phase 2. |
| What training changes besides mastery, reliability, and owner skill | TBD. Bond, trophies, and the journal are undefined. |
| Vitality session limit, fatigue, and assist-mode timing | TBD. |
| Which pet survives if a guest signs into an account that already has one | TBD. |
| Where the share-card link goes | TBD. A public pet page and a store listing are different products. |
| Rive placeholder spike in Phase 1 | Proposed, to validate the aging inputs and the development build before commissioning art |
| Sharing | Public share cards for growth, friends-only inside the app |
| Rare tricks confirmed by the server while offline | Proposed: mark as pending until the next sync (R5.11) |
| Monetization model | Undecided |
| Number of pets | One at a time in the MVP |
| Meaning of "virtual reality" | Assumed to mean a lifelike, persistent pet and not AR. AR would change the engine choice. |
| App name | Undecided, and no candidate has been cleared for trademark |
