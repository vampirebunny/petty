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
4. Visible goals, hidden secrets: show every attribute and its maximum potential so players can chase them, and hide the secret trick sequences.
5. Show-off: anything worth bragging about can be shared.
6. Offline-first and guest-first: play immediately, anywhere, and ask for an account later.
7. Safe by default: 13+, private by default, no free-text chat between users, and minimal data.
8. Seamless aging: the pet changes a little every day and the user never sees a stage "switch". Life stages are names for ranges of a continuous scale, not separate art. In the senior years, good care visibly rejuvenates the pet.

## Goals, non-goals and metrics

The MVP exists to answer one question: do people come back to care for, train and show off a pet that has its own personality? Everything that does not help answer it waits.

**Goals**

- A pet that feels alive: needs that change over real time, readable moods, and reactions to touch.
- Six visible attributes, each with a visible, pet-specific maximum potential that players try to reach.
- Training and trick discovery that reward time and skill.
- Ways to show off: learned tricks, a shareable card and clip, and pet-to-pet playdates. Outfits come after the MVP.
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
| Animation | Placeholder shapes first, then Rive | Phase 0 uses plain views. Proposed: a Rive spike after Phase 1 exits, with a placeholder blob rig that proves maturity, vitality, weight, and ageDays (see F2 and F6). The spike does not include outfits. The final art arrives in Phase 3, with attach points for the post-MVP outfit slots. Rive does not run in Expo Go, so it needs a development build. |
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
| 1. Core pet | One breed, a choice of three puppies, age attestation, naming, continuous aging on the closed-time maturity clock and care-driven vitality, a hidden weight condition, internal stage labels and senior bands, six attributes with visible current scores and maximum potential, temperament, levels, and local reminders when a need is low. Placeholder art is driven by maturity, vitality, and weight. A Rive spike is proposed once those inputs are stable. | A user who attests they are 13 or older can compare three puppies by temperament and exact attribute scores, choose one, name it, and care for it. An under-13 attestation stays blocked across relaunch. Debug controls move maturity and vitality across the whole range with no visible jump and no stage name on screen. A senior pet can be moved between bands through care. |
| 2. Play and training | Ball fetch and one toy, training with mastery, 3 to 5 tricks with about 3 discoverable, the trick book, and NPC playdates. | A player can discover and teach a trick and finish an NPC playdate, all offline. |
| 3. Art and audio | The Rive pet and rig built on maturity, vitality, weight, and ageDays, with an attach point for hat, neck, back, and costume. 2 to 3 breeds, pet sounds, UI sounds and music. The cosmetics launch waits until after the MVP (F6). | Final art plays smoothly on real devices, breeds swap through configuration, and the rig exposes one attach point per slot. |
| 4. Accounts and social | Guest-to-account upgrade, Supabase sync, share card and clip, read-only friend visits, age signals, and account and data deletion. | A guest can upgrade, back up the pet, add a friend by invite link and share a card. |
| 5. Beta | Legal and store checks, matching age rating, privacy policy, analytics and a small beta. | The privacy attorney consult is done, the store listing and rating match the 13+ terms, and the beta is released. |

Later, after the MVP proves the loop: the cosmetics launch (starter, earned, and premium items on the Phase 3 attach points, with eyewear as a later slot), cats and more breeds, real-friend playdates, pet exchange or restart, mini-games, multiple pets, and public showcases. Premium cosmetics are cosmetic-only. The rest of the monetization model stays open.

## Functional requirements: care and growth

Requirements are numbered so they can be referenced in tasks and commits. "Proposed" marks a requirement that is a recommendation and not yet a decision.

**F1. Onboarding and adoption (Phase 1)**

- R1.1 First launch shows an age attestation. The screen states that the app is for ages 13 and up and offers two choices: "I am 13 or older" and "I am under 13". It does not ask for a birthdate. A user who attests they are 13 or older continues, and the app stores a local pass so the screen does not appear again. A user who says they are under 13 cannot continue. The app stores only a local blocked note, creates no pet, and shows the blocked screen on later opens. Nothing about the check is sent off the device. Deleting the app clears the note.
- R1.2 After the gate the user goes straight to adoption, with no account step.
- R1.3 After the gate, the user meets three puppies of the single Phase 1 breed. All three are deterministic variations of one seed. For each puppy, the pick screen shows the temperament label, the two attributes it nudges, and every attribute's current score and maximum potential as exact numbers. The user picks one. There is no breed picker. The other two puppies are not saved. (Proposed) Puppies of the same breed have the same total potential, distributed differently.
- R1.4 The user names the pet after choosing it. The temperament is already visible on the pick screen.
- R1.5 The chosen pet stores that one seed and the variation that was picked. The same seed always offers the same three puppies, and the same seed plus variation always creates the same pet.

Acceptance: an under-13 attestation blocks progress, and the block is still there after the app is closed and reopened; a passing attestation reaches the home screen with one named pet and no account screen; the same seed always offers the same three puppies; the same seed and variation always create the same pet; the pick screen shows each puppy's temperament label and attribute potentials.

**F2. Care and aging (Phases 0 and 1)**

- R2.1 Needs are fullness, energy and happiness, each 0 to 100 with higher being better. They change with real elapsed time, including while the app is in the foreground, computed from timestamps, with elapsed time capped at 48 hours. The pet never dies or runs away. Decay and sleep rules are in "Cursor Brief: Pet Blob Prototype".
- R2.2 Actions are feed, toggle rest and pet. While asleep, feeding and petting are ignored and the pet only stirs.
- R2.3 Aging runs on two continuous values, each from 0 to 1. Maturity only goes up. It stays still while the app is in the foreground. When the app returns, maturity gains the time the app was closed, up to 48 hours, and any closed time past that cap is dropped. One return may cross at most one stage boundary; maturity past that boundary is dropped. Debug time controls bypass the cap and the boundary rule. Until the care window exists, maturity accrues at full rate. After that, poor care can slow maturity toward a floor around half speed, and neglect does not stop aging. Vitality moves up and down with care (R2.8) and uses the same capped absence. Life stages are internal labels derived from these values, not separate states with separate art: puppy, older puppy, adolescent, adult and senior, with the senior stage split into bands (R2.9). A stage label sets the level ceiling and the learning speed, and nothing else. The maturity threshold of each label is a tunable constant. The user never sees a stage name.
- R2.4 Mood is derived from the needs using the priority rule in the prototype brief.
- R2.5 Local notifications remind the user when a need is low. They do not announce life stage labels or senior bands. The tone is calm with no guilt wording, and the user can turn them off in settings.
- R2.6 Development builds include a debug panel that fast-forwards time and has sliders for maturity, vitality, and weight. Time jumps and sliders bypass the maturity catch-up cap and the one-boundary rule. The debug panel may show internal stage labels and the weight number. The rest of the app does not.
- R2.7 Seamless aging. The pet's appearance is a function of maturity, vitality, and weight. Maturity and vitality change proportions, size, and aging cues a little at a time. Weight changes the width of the body and the legs. No stage change plays a transition, effect, or swap. On return, the stored values update immediately and the view eases to them over about a second. The user never watches a jump, never sees a stage name, and never sees the weight number.
- R2.8 Vitality is driven by a rolling window of recent care: diet quality, exercise, play and attention. It moves slowly toward a target set by that window, so one action cannot swing it. Neglect lowers it gradually to a floor of "slow and sleepy but content". It never reaches a state that is distressing or fatal.
- R2.9 The senior stage has internal bands, such as early senior, senior and elderly, defined as ranges of vitality. A senior pet moves between bands in both directions: more exercise, play, attention or a better diet raises vitality and rejuvenates it, and neglect lowers it. Band boundaries use hysteresis so the label does not flicker. The current band is remembered so that margin can be applied. Vitality stays the source of truth. Band names are never shown.
- R2.10 Rejuvenation cap. Vitality affects every pet's energy and mood, but its aging cues become visible mainly once maturity reaches the senior range. Proposed: a pet's best possible look is capped by its maturity, so a senior pet can look spry and bright with a graying muzzle but never returns to puppy proportions. Maturity is never reduced.
- R2.11 Vitality drives visible aging cues: muzzle graying, ear droop, posture, coat dullness, eye brightness, and gait and animation speed. It also scales energy recovery and the number of play and training sessions the pet is happy to do. It does not lock the owner out of any feature.
- R2.12 Diet and exercise need something to measure. Proposed: a small set of food types with different quality, and exercise measured from fetch and play sessions. Until Phase 2, vitality uses feeding regularity and attention only.
- R2.13 Weight is a condition from 0 to 100, not an attribute. 50 is the normal middle. Higher is heavier and lower is lighter. Every puppy starts at 50, so the pick is not about weight. The number is never shown. Weight moves slowly toward a target set by a moving average of feedings: feeding more often than the normal rate raises the target, and feeding less often lowers it. One feeding cannot swing it. A long absence uses the same 48-hour cap as needs, so the missed feedings in that gap are capped too. Weight changes the width of the body and the legs (R2.7) and the effective stamina and agility (R3.5). It does not change potential or trained points, and it does not lock any feature.

Acceptance: the simulation tests from the prototype brief pass; a 100-hour absence gives the same result as a 48-hour one for needs, maturity, and weight; maturity never decreases and stays still while the app is in the foreground; a return crosses at most one stage boundary; vitality changes are bounded per day and respond to care in both directions; a senior pet can move between bands through care and back through neglect without flicker; every new puppy starts at weight 50; one feeding barely moves weight; a stretch of extra feedings raises it and a stretch of missed feedings lowers it; the debug sliders move the pet smoothly across the whole range with no visible jump; no user-facing screen shows a stage name or the weight number.

**F3. Attributes and potential (Phase 1)**

- R3.1 Six attributes: stamina, agility, intelligence, boldness, affection and obedience. Obedience replaces willfulness and is its opposite: higher means more cooperative. Energy, as an attribute, becomes stamina. The need named energy is unchanged. Scores are whole numbers on a tunable scale (proposed: 1 to 20). Each pet has a current score and a maximum potential for every attribute. A seventh attribute, instinct (nose), is optional and is not built in the MVP.
- R3.2 Potential for each attribute is the breed's base potential plus a seeded roll within the breed's roll range, derived from the pet's seed and variation by its own hash (rule 11). The same seed and variation always give the same potential. The three variations of one seed differ. Temperament moves about 10% of one attribute's potential onto another, so the breed total stays the same, and gives the pet a label such as "bold explorer".
- R3.3 Current scores start low for a puppy (proposed: about 25% of potential, tunable) and rise toward potential through natural growth with maturity and through training (R3.8). A current score never exceeds its potential. Care patterns can nudge current scores slowly within bounds. Proposed: natural growth from maturity carries a score up to about 70% of potential, and training closes the rest. Both limits are tunable.
- R3.4 Level rises with experience from care, training and play, and each life stage label has a level ceiling. Ceilings are step values by label and do not change gradually, so the level cap only moves when a label changes.
- R3.5 The effective score the simulation uses is natural growth plus trained points plus care drift plus temporary effects, multiplied by the aging modifier (R3.9) and, for stamina and agility, by the weight modifier (R2.13), then capped at potential.
- R3.6 The app shows level, the temperament label, and for each attribute the current score and potential (for example "14 / 18") with a progress bar and any active temporary effect, plus trick mastery. Potential is visible from the adoption screen on, as an exact number. The seed is never shown. Life stage names and senior bands stay internal (R2.3).
- R3.7 (Proposed) Fairness: pets of the same breed have the same total potential, so the seeded roll moves points between attributes and no pet is strictly better or unplayable.
- R3.8 (Proposed) Training raises attributes. Fetch and play raise agility and stamina, trick learning raises intelligence and obedience, and playdates raise boldness and affection. Gains have diminishing returns per day (R5.4) and taper hard as the current score nears potential, so the last points are the slow ones. Trained points push the pet toward potential and are used in the MVP. The activities that award them arrive in Phase 2.
- R3.9 (Proposed) Attributes change over time through five sources: growth with maturity, training, milestone bonus points which the owner places, temporary buffs from food, play, rest and toys, short penalties while tired or hungry, and aging. Seniors lose some effective stamina and agility through low vitality and may gain obedience, and rejuvenation restores them. Weight away from 50 also lowers effective stamina and agility, and returning toward 50 restores them. Aging and weight change only the effective score, never the stored trained points or the potential, so both are fully reversible. Keep a floor so effective scores never drop to unplayable.

Acceptance: the same seed and variation always give the same potentials; the three variations of one seed differ; no current score exceeds its potential; pets of one breed have the same total potential but different distributions; training raises the matching attribute and the gain tapers hard near potential; aging lowers only the effective score and rejuvenation restores it; the pick screen shows each puppy's temperament label, the two attributes it nudges, and each attribute's current score and potential.

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

**F6. Outfits (after the MVP; attach points in Phase 3)**

Phase 3 builds the rig with an attach point for each slot below. The wardrobe, the catalog, and the item art wait until after the MVP. No cosmetics UI is required to finish Phase 3, and none of it is built during Phase 1.

- R6.1 Slots are hat, neck, back, and costume. A collar uses neck, a hat uses hat, and a coat uses costume. Sunglasses wait for an eyewear slot, added after the first cosmetics release. There is no body slot.
- R6.2 The rig owns fit. Each slot has an attach point that moves and scales with breed size and maturity. One item asset fits every breed and every point on the maturity scale. The app keeps no per-stage fit table and writes no offsets or scales into the file.
- R6.3 The user can equip and unequip owned items. Equipped items appear on the pet and, once cosmetics exist, on its share card. Unequip is an equip event with no item. The value `none` exists only in the Rive file. The renderer writes it when the slot is empty.
- R6.4 Three sources, all after the MVP: starter items granted with the pet, items earned through tricks and milestones, and premium items. Ownership is a list separate from `equipped`, and it gates every equip. An owned item can sit unequipped. Premium items are cosmetic only: they do not change attributes, skill, mastery, or any other simulation result. The MVP has no purchases and no randomized rewards.
- R6.5 Each item has a fixed palette. The chosen entry is `colorId` on the equip event. A free hex value is outside this contract. The equipped item and its palette color are bound properties of the Rive file, set through data binding.
- R6.6 The content id is the catalog id and the Rive enum value. Store product ids live in a separate map, and one product may grant several content ids. A content id is never a store product id.
- R6.7 The Rive file receives maturity, vitality, weight, and ageDays, plus the equipped item and palette color per slot. ageDays is maturity times daysToSenior: the maturity clock scaled into days, not calendar time since `bornAt`. Mood and the animation cue stay view props. Breed is not a view input. Breed chooses `artVariant`, `sizeScale`, and pitch through config.

Acceptance: every item displays correctly on every breed at several maturity values from puppy to senior, because the attach point moved with the rig; equipping an owned item persists after restart and survives sync replay; an unowned item cannot be equipped; a premium item leaves every simulation result unchanged; the share card shows what is equipped once cosmetics exist.

## Functional requirements: social, accounts and sync

**F7. Social and show-off (NPC playdates in Phase 2, the rest in Phase 4)**

- R7.1 Share card: an image of the pet showing its name, breed, temperament label, and learned tricks, with a download link. Once cosmetics exist, it also shows the equipped outfit. It does not show a life stage or senior band. It is sent through the phone's share sheet. It contains no personal details by default, such as a username or location.
- R7.2 Trick reel: a short clip, generated on the device, of the pet performing its learned tricks in sequence, shareable the same way.
- R7.3 Friends: a mutual friendship is created through an invite link or friend code and needs an account. Either side can remove a friend or block them.
- R7.4 Friend visit: read-only. The user sees a friend's pet as of its last synced snapshot, with its mood, tricks and trophies, and its outfit once cosmetics exist, and can leave a preset reaction. It works from cached data when offline.
- R7.5 NPC playdates: a roster of NPC pets, each with a breed, temperament, name and a couple of quirks, stored in the app. The same simulation resolves a playdate on the device from a seeded roll, and the replay can play immediately. There is no account, server or accept step, so it works offline and for guests. Each NPC has a friendship level, playdates are capped per day, and small items can be earned. Outfit grants wait until the cosmetics launch. Watching an NPC perform a trick can reveal the first input of a hidden sequence.
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
type Trait = 'stamina' | 'agility' | 'intelligence' | 'boldness' | 'affection' | 'obedience';
type Stats = Record<Trait, number>;
// Internal labels derived from maturity and vitality, never stored as the source of truth,
// and never shown in the product UI
type Stage = 'puppy' | 'olderPuppy' | 'adolescent' | 'adult' | 'senior';
type SeniorBand = 'earlySenior' | 'senior' | 'elderly';
type OutfitSlot = 'hat' | 'neck' | 'back' | 'costume';
// Eyewear is a later slot, added after the first cosmetics release. It is not in this type yet.
type EquippedItem = { itemId: string; colorId?: string };
type CueInput = 'up' | 'down' | 'left' | 'right' | 'tap' | 'hold';

type Pet = {
  id: string;              // UUID created on the device at adoption
  seed: number;            // one seed for the litter; the three puppies are variations of it
  variant: 0 | 1 | 2;       // which variation the user picked
  rngState: number;        // seeded generator state
  name: string;
  breedId: string;
  maturity: number;        // 0 to 1, only increases, drives size and proportions
  vitality: number;        // 0 to 1, care-driven, can rise and fall, drives aging cues
  careWindow: CareSample[]; // rolling recent care used to set the vitality target
  weight: number;          // 0 to 100, 50 is normal, never shown
  feedWindow: FeedDay[];   // moving average of feedings that sets the weight target
  bornAt: number;          // ms timestamp
  lastUpdatedAt: number;   // ms timestamp of the last needs advance
  maturityAppliedAt: number; // ms timestamp of the last maturity settle; foreground ticks refresh it without adding age
  needs: { fullness: number; energy: number; happiness: number };
  asleep: boolean;
  potential: Stats;        // max per attribute, from seed, variant and breed, visible
  trained: Stats;          // points earned through training
  temperament: { boosts: Trait; dampens: Trait };
  drift: Stats;            // slow shift from care patterns
  seniorBand?: SeniorBand; // hysteresis cache, not the source of truth
  level: number;
  xp: number;
  bond: number;
  tricks: Record<string, TrickProgress>;
  equipped: Partial<Record<OutfitSlot, EquippedItem>>;
  favoriteToyId?: string;
};

type FeedDay = {
  day: number;             // day index
  count: number;           // feedings that day
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

// Derived, not stored. Does not read rngState or event history.
const attributeScore = (pet: Pet, trait: Trait): number => { /* growth + trained + drift + effects, times aging modifier, times weight modifier for stamina and agility, capped at potential[trait] */ };

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
  basePotential: Stats;
  rollRange: number;       // how far a seeded roll can shift an attribute's potential
  pitchMultiplier: number; // for audio playback rate
  sizeScale: number;
  sampleSet: string;       // audio set id
  artVariant: string;      // coat, ears, tail, markings
};

// Fixed configuration. The content id is the Rive enum value.
// Store product ids are a separate map and may grant a bundle.
type CosmeticDef = {
  id: string;              // content id
  slot: OutfitSlot;
  name: string;
  palette: { id: string; hex: string }[];
  premium: boolean;
};

type StoreProductGrant = {
  productId: string;       // permanent store id
  grants: string[];        // content ids
};

// Owner state, kept apart from Pet.equipped.
type ItemSource = 'starter' | 'earned' | 'premium';

type OwnedCosmetic = {
  itemId: string;          // content id
  source: ItemSource;
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
  ownedCosmetics: OwnedCosmetic[]; // separate from Pet.equipped; a guest stores the same list locally
};

type PetEvent =
  | { type: 'feed'; at: number }
  | { type: 'toggleRest'; at: number }
  | { type: 'pet'; at: number }
  | { type: 'fetch'; at: number; throwPower: number }
  | { type: 'giveToy'; at: number; toyId: string }
  | { type: 'trainAttempt'; at: number; trickId: string; timingQuality: number }
  | { type: 'cueSequence'; at: number; inputs: CueInput[] }
  | { type: 'equip'; at: number; slot: OutfitSlot; itemId: string | null; colorId?: string }
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
3. The pet view receives only props such as needs, mood, maturity, vitality, weight, ageDays, and an animation cue. ageDays is maturity times daysToSenior, the maturity clock scaled into days, not calendar time since bornAt. It holds no game rules, so Rive can replace the placeholder shapes without touching anything else. In Rive, maturity, vitality, weight, and ageDays are number inputs. Maturity and vitality drive blend states. Weight drives body and leg width. Breed is not a view input; it chooses the rig through breed config. The stage label is never passed to the view. Stage labels are internal and are never shown to the user. The weight number is never shown either. Outfit slots, when cosmetics exist, are bound data on the file (F6). The app writes no fit offsets or scales.
4. All storage sits behind an interface. Local storage is the first implementation and the backend is the second.
5. Tunable numbers live in config files. Breeds, tricks, NPC pets and outfits are data, so adding one is a config entry and not new code.
6. The simulation decides what happens and the view only animates it.
7. The same simulation module runs in the app and in the server's functions, so the server can replay events and reach the same state.
8. Events are the source of truth for sync, and state is derived from them.
9. Trick sequences are checked through a validator interface, so the check can later move to the server.
10. Time is computed lazily from timestamps. There is no per-pet server tick and no background timer for the simulation.
11. Potential and any other value derived from the seed is computed from the seed and variation with its own deterministic hash, so it never depends on the order of events or on the pet's random state.

**Non-functional requirements**

- Offline: the core loop of care, play and training works with no connection at all.
- Performance: animation stays smooth on mid-range phones, and screens open without waiting on the network.
- Size: audio is compressed and loops are short. Core art and sound are bundled, and optional extras can be hosted remotely so new breeds ship without an app update.
- Accessibility: an assist mode for the timing game, an alternative to swipes such as tap rhythms, no meaning carried by color alone, and haptic or on-screen fallbacks for sound.
- Privacy: collect the minimum, keep analytics free of personal data, and support deletion.
- Testing: every simulation feature ships with unit tests for determinism, bounds and thresholds, and the same seed and variation must always give the same potentials.
- Observability: crash reporting, and analytics events for the success metrics, with no personal data.
- Code quality: TypeScript in strict mode, small files, and one commit per task.

## Decisions and open questions

Treat decided items as fixed. For open items, build the proposed default behind configuration and do not spend effort polishing them.

**Decided**

| Topic | Decision |
| --- | --- |
| Platform | Expo / React Native with TypeScript, iOS and Android |
| Camera | Side view, 2D |
| Species in the MVP | Dog only. Phase 1 ships one breed. Phase 3 can add breeds as content. The user does not pick a breed. |
| Age gate | Attestation that the user is 13 or older, or that they are under 13. No birthdate. A local pass or blocked note stays on the device. Apple and Google age-band checks arrive in Phase 4 and override a pass when the store says under 13. |
| Adoption | One seed produces three deterministic puppy variations, with three different temperament labels. The pick shows each puppy's label, the two attributes it nudges, and exact current scores and potentials. The user picks one variation and then names it. The pet stores the seed and the variation. The other two are not saved. |
| Attributes | Six visible attributes, each with a visible current score and a visible per-pet maximum potential. Potential is deterministic from the seed and variation. The seed is never shown. Secret trick sequences stay hidden. |
| Aging model | Two continuous values, maturity (only up) and vitality (care-driven, reversible), with five internal stage labels (puppy, older puppy, adolescent, adult, senior) and senior bands. No stage-change transition and no separate art per stage. |
| Maturity clock | Still while the app is in the foreground. On return, gain closed time up to 48 hours and drop the rest. At most one internal stage boundary per return. Needs keep ticking in the foreground. Debug controls bypass the cap and the boundary rule. |
| Care and maturity | Full rate until the care window exists. After that, poor care can slow maturity toward a floor around half speed. Neglect does not stop aging. |
| Stage labels | Internal only. They set level ceilings and learning speed. They are never shown in the UI, notifications, or share card. |
| Aging art | One continuous dog driven by maturity, vitality, and weight. A stage change does not swap the animation. Weight changes body and leg width and is never shown as a number. |
| Weight | A condition from 0 to 100. 50 is normal. Every puppy starts at 50. A moving average of feedings moves it slowly up or down. It affects body and leg width and effective stamina and agility. |
| Death | None. The pet never dies. |
| Growth model | Pokémon-style stats, levels and growth only. No battles, trading or collecting many pets. |
| Audio | Animal sounds only, with a different pitch per breed |
| Offline | The core game must work offline |
| Accounts | Guest-first, with an account later and no friction at the start |
| Social | Share card, read-only friend visits and NPC playdates in the MVP. Real-friend playdates later, asynchronous, with acceptance by default. |
| Prototype | Standalone Expo repository, local-only, drawn with plain shapes |
| Cosmetics | After the MVP. Phase 3 only builds attach points for hat, neck, back, and costume. Eyewear is a later slot. Fit belongs to the rig. Ownership is a separate list and gates every equip. Sources are starter, earned, and premium. Premium is cosmetic-only. Content ids are separate from store product ids. Recolor is a fixed palette on the equip event. See F6. |

**Open**

| Question | Current default |
| --- | --- |
| Core audience: kids, nostalgic adults, teens or cozy-game players | Open. The working plan is 13+. |
| Pet exchange or restart | Not in the MVP. Revisit once attachment is visible. |
| Real days per life stage | Tunable maturity thresholds, to be set by playtesting. Proposed starting point: puppy days 0 to 7, older puppy 7 to 21, adolescent 21 to 45, adult 45 to 180, senior after 180. |
| Senior rejuvenation limit | Proposed: capped by maturity, so a senior can look spry but never like a puppy (R2.10) |
| How diet and exercise are measured | Proposed: a small set of food types plus exercise from fetch and play (R2.12). Needs a decision before Phase 2. |
| What training changes besides mastery, reliability, owner skill, and attributes | Attribute gains are specified in R3.8. Bond, trophies, and the journal remain TBD. |
| Final attribute list, and whether to add instinct | Six attributes in R3.1. Instinct (nose) is not in the MVP. |
| Score scale and the puppy starting fraction | Proposed: whole numbers from 1 to 20, starting near 25% of potential. |
| Whether same-breed pets share a total potential budget | Proposed: yes. The seeded roll and the temperament nudge move points between attributes (R3.7). |
| How strongly aging affects effective scores | Proposed in R3.9. Aging changes the effective score only. Strength is tunable. |
| Normal feeding rate and how strongly weight affects stamina and agility | Proposed: about 2 feedings a day holds weight at 50. Distance from 50 lowers effective stamina and agility. The strength is tunable (R2.13). |
| Whether maturity alone can reach potential | Proposed: natural growth stops near 70% of potential. Training closes the rest, and gains taper hard near the cap (R3.3, R3.8). |
| Whether short hungry and tired penalties stay | Proposed in R3.9. They lower the effective score only while the need is low. They do not change potential or trained points. |
| Vitality session limit, fatigue, and assist-mode timing | TBD. |
| Which pet survives if a guest signs into an account that already has one | TBD. |
| Where the share-card link goes | TBD. A public pet page and a store listing are different products. |
| Rive placeholder spike in Phase 1 | Proposed, after Phase 1 exits, to validate maturity, vitality, weight, and derived ageDays on a development build. Outfits are outside the spike |
| Sharing | Public share cards for growth, friends-only inside the app |
| Rare tricks confirmed by the server while offline | Proposed: mark as pending until the next sync (R5.11) |
| Monetization model | Undecided, except premium cosmetics, which are post-MVP and cosmetic-only (F6) |
| Number of pets | One at a time in the MVP |
| Meaning of "virtual reality" | Assumed to mean a lifelike, persistent pet and not AR. AR would change the engine choice. |
| App name | Undecided, and no candidate has been cleared for trademark |
