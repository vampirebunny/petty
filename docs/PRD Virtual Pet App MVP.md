# PRD: Virtual Pet App (MVP)

Oct 14, 2026 · @A
Updated Oct 23, 2026 (play mood is 3 seconds of toy movement, or 5 taps or throws; cuddle mood ticks every 3 seconds)

## Overview

A mobile app for iOS and Android where each user adopts a dog or a cat that ages gradually from puppy to senior, develops a breed-based personality, learns tricks the user teaches with treats and practice, needs real care, and can be shown off through outfits, shareable clips and friends. The app name is not decided yet.

**Audience.** The working plan is 13+. The gate uses a store age signal when the platform provides one, then a Yes or No to "Are you at least 13 years old?" It never asks for a birthdate. Whether the core audience is nostalgic adults, teens or cozy-game players is still open.

**What makes it different.** Most virtual pet apps are care loops with mini-games and dress-up. This one has a pet whose personality is visible and different from every other pet, training that rewards the owner's consistency, tricks that unlock as earlier tricks are learned, and ways to show all of it off. It works offline and lets people play before creating an account.

**How to use this document.** Requirements are numbered and each feature has acceptance checks. Build in the order of the release phases, and do not build anything listed as out of scope. Phase 0 is specified in "Cursor Brief: Pet Blob Prototype". Breed anatomy and poses live in `src/actor/breeds.ts` and `src/actor/data/breedShapes.ts`. This PRD is the contract for behavior, scenes, wardrobe, and time of day. When a requirement is unclear or two requirements conflict, ask instead of guessing.

**Product principles**

1. Cute and expressive: the pet's emotion should be readable at a glance.
2. Care without punishment: the pet never dies, there are no guilt mechanics, and training uses positive reinforcement only.
3. Time and attention matter: outcomes depend on the owner's consistency and care, never on payment.
4. Visible goals, quiet surprises: show every attribute and its maximum potential so players can chase them. Locked tricks show as silhouettes with vague hints, and secret tricks are reserved for later.
5. Show-off: anything worth bragging about can be shared.
6. Offline-first and guest-first: play immediately, anywhere, and ask for an account later.
7. Safe by default: 13+, private by default, no free-text chat between users, and minimal data.
8. Seamless aging: the pet changes a little every day and the user never sees a stage "switch". Life stages are names for ranges of a continuous scale, not separate art. In the senior years, good care visibly rejuvenates the pet.

## Goals, non-goals and metrics

The MVP exists to answer one question: do people come back to care for, train and show off a pet that has its own personality? Everything that does not help answer it waits.

**Goals**

- A pet that feels alive: needs that change over real time, readable moods, and reactions to touch.
- Six visible attributes, each with a visible, pet-specific maximum potential that players try to reach.
- A training loop (tricks and treats) that rewards time and consistency. Potty, messes, and house training are not part of the game.
- Ways to show off: learned tricks, a shareable card and clip, and pet-to-pet playdates. Outfits come after the MVP.
- A full experience offline and without an account.

**Non-goals for the MVP**

- Battles, trading and collecting many pets
- Pet exchange or restart
- A live session with another player's pet, public showcases and contests
- Any chat between users
- Advertising, loot boxes and purchases
- 3D pets, AR, and live multiplayer
- Outfits in the MVP. The drawing stays isolated so the look can change later.

**Success metrics**

- Day-1 and day-7 retention
- Sessions per day
- Share of users who house-train their pet and master a first trick
- Share cards sent
- Friend invites accepted
- NPC playdates per user

These decide whether to add breeds and features or to fix the core loop first. No target numbers are set yet.

## Platform, stack and constraints

Build one mobile codebase for iOS and Android, in portrait on phones, as a 2D side-view game. A tablet or an unfolded foldable may rotate once its shorter side is at least 520dp, and the landscape split starts at 600dp. Surface Duo rotates on one screen (about 540×720) so the opened wide posture (about 1114×720) can turn landscape. The opened posture with the hinge horizontal is about 720×1114 and stays stacked. In landscape on those screens, Home puts the scene on the left and a control column on the right, at most a phone wide, scaled down when the column is narrower. Portrait, including an upright iPad, keeps the scene stacked above the controls. Wardrobe, the Pet Shop, and the playdate outfit step put the preview on the left and the choices on the right. The rest of playdate, places, and adopt stay a single centered column. No game engine is needed, and one would make friends, settings, notifications, billing and age signals harder.

| Layer | Choice | Notes |
| --- | --- | --- |
| App | Expo / React Native with TypeScript | New standalone repository. The age-signal APIs in Phase 4 need a development build. The procedural pet does not. |
| Animation | Procedural drawing in `@shopify/react-native-skia` | Phase 0 uses plain views. Phase 1 replaces them with the procedural actor. The HTML files in `docs/` are references to port, not pages to embed. The simulation does not import Skia. Phase 1 does not add `expo-audio`. Playback waits until clip files are in the repo. There is no Rive dependency. |
| Gestures | react-native-gesture-handler | Tap, hold, stroke, flick and swipe. |
| Motion | react-native-reanimated | Squash, bounce, arcs and running. |
| Local storage | AsyncStorage at first, then SQLite | Always behind a storage interface. |
| Backend | Supabase | Postgres, auth with anonymous sign-ins, Edge Functions, scheduled jobs and row-level security. Anonymous sign-in and append-only consent records start with the age gate. Pet sync stays in Phase 4. |
| Push and reminders | Local notifications first | Remote push only if needed later. |
| Payments | RevenueCat | No subscription paywall. Real-money Boops, if added later, are out of scope for the MVP. |
| Age signals | Apple Declared Age Range API, Google Play Age Signals API | Platform-provided age categories. |

**Constraints that shape every feature**

- Offline-first. The core game must run with no connection, because the simulation runs on the device.
- Guest-first. No account is needed to start playing.
- 13+ audience. A store age signal is used when the platform provides one, the person still confirms they are at least 13, and the store age rating matches.
- Side-view camera, which keeps the animation workload low. Angled, top-down and 3D views are out of scope.
- One owned pet at a time. The simulation is a list of actors, so a later encounter can place a second pet beside the owner's without a second save slot.
- Pure simulation module shared between the app and the server, as described under architecture rules.

## Release phases

Six phases take the app from the prototype to a beta. Phase 1 draws the pet in code, so the illustrator's lead time does not block it. Do not start a phase until the previous one meets its exit criteria.

Each phase builds on the one before it and ends at an exit check, listed in the table below.

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| 0. Blob prototype | Needs, feeding, resting and petting on one screen, local-only, drawn with plain shapes. Specified in "Cursor Brief: Pet Blob Prototype". | Runs in Expo Go, state survives closing the app, and the time-jump debug panel works. |
| 1. Core pet | Species and breed choice for dog or cat with each breed's attribute potential ranges and a live preview, a design step (coat color and the pattern variants the breed allows, plus eye color for cats; ears and tail come from the breed), then three attribute sets for that breed (athlete, thinker, charmer), the age and terms gate, naming, aging from the pet's birth time, care-driven vitality, a hidden weight index, internal stage labels and senior bands, six attributes with visible current scores and maximum potential, an archetype, levels, local reminders when a need is low, a bundled starter wardrobe, and the procedural actor in a scene whose sky follows the device clock. The home screen draws that actor from breed anatomy, age curves, vitality, weight, and the scene. | A person who confirms they are at least 13, and who is not under 13 by a store signal, can pick a dog or a cat and a breed, see each breed's potential ranges, customize the look with a live preview, compare three attribute sets for that breed by exact potentials, choose one, name it, and care for it. Feed, drink, rest, a stroke, cuddle, and throw ball start the matching tasks. A tap on the scene drops a ball and starts the chase. An outdoor scene's sky and an indoor scene's windows and lamps follow the device clock, and a scene that omits time does not. At night an indoor pet stays readable while the room still reads as night. An under-13 result stays on the Not Available screen across relaunch and is not sent off the device. Debug controls move age, vitality, and weight across the whole range with no visible jump and no stage name on screen. A senior pet can be moved between bands through care. |
| 2. Play and training | Fetch mastery and one toy, the training loop in F5 (trick tracks, a treat economy and inventory), and NPC playdates. The chase itself already plays in Phase 1. Potty, messes, and house training are out. | A player can master Sit and Speak, unlock Paw or High five, teach it with treats, and finish an NPC playdate, all offline. |
| 3. Art and audio | Recorded pet sounds, UI sounds and music, on the procedural actor. The starter wardrobe already draws in Phase 1. The v1 drawing is flat vector with one sticker outline and soft cel shading. | Sounds match the behavior, breeds sound different, and the behavior modules do not change when the drawing is replaced. |
| 4. Accounts and social | Guest-to-account upgrade, pet sync, share card and clip, read-only friend visits, and account and data deletion. Store age signals and anonymous consent records ship with the age gate. | A guest can upgrade, back up the pet, add a friend by invite link and share a card. |
| 5. Beta | Legal and store checks, matching age rating, privacy policy, analytics and a small beta. | The privacy attorney consult is done, the store listing and rating match the 13+ terms, the store privacy and support URLs point at `https://boopboop.mylisto.app`, and the beta is released. |

Where to? lists Arcade for both dogs and cats. Choosing it uses the same leave as the Pet Shop: the pet walks off to the right, the room fades, and the Arcade cuts in. Reduce Motion skips the walk. Leave on the Arcade returns to the room the pet left, with no walk back in. A return of 3 hours or more also closes the Arcade.

The Arcade lists Cloud Hop and Paddle Paws. Cloud Hop is playable and uses the current pet, including its outfit. There is no species picker. Paddle Paws is shown and does nothing. The run is score only and does not grant Boops or change inventory. The start screen offers Play and Leaderboard, and Back there returns to the Arcade. Pause offers Resume, the app sound switch, and End run. Game over offers Play again, Leaderboard, and Menu. Menu returns to the Arcade.

The leaderboard is one global top 20 of each account's best Cloud Hop score. A row shows rank, handle, the pet name from the run that set the score, and the score. A new run updates that row only when the score is higher. Guests can play. Their best stays on the device and is not uploaded. Game over asks them to log in or create an account to save the score. After the account is linked and has a handle, that pending best is submitted, and the account keeps the higher of the pending score and any stored score.

Later, after the MVP proves the loop: earned and premium cosmetics, more breeds, encounters between the owner's pet and a friend's pet, pet exchange or restart, more mini-games, multiple owned pets, and public showcases. A friend encounter is still not a live session. Premium cosmetics are cosmetic-only. The rest of the monetization model stays open.

## Functional requirements: care and growth

Requirements are numbered so they can be referenced in tasks and commits. "Proposed" marks a requirement that is a recommendation and not yet a decision.

**F1. Onboarding and adoption (Phase 1)**

- R1.1 First launch reads a store age signal when Apple Declared Age Range or Play Age Signals can provide one. The consent screen shows the app icon centered at the top on sky blue (`#DCEEFF`) and asks "Are you at least 13 years old?" with equal Yes and No choices, neither preselected. It does not ask for a birthdate and does not explain the question. Continue stays disabled until a choice is made. The screen also links the Terms of Service and Privacy Policy, and Continue records acceptance of the current versions. A Yes keeps a store band of 13–17 or 18+ when one exists, and otherwise records an attestation of at least 13. That path may create an anonymous Supabase user and append consent records. A No, or a store result under 13, saves under 13 on the device only, creates no id and no Supabase row, and shows the Not Available screen on later opens. The more restrictive result always wins, so a later signal can move someone younger and never older. A terms-version change shows the consent screen again without the age question. Gameplay does not wait on the network. iOS secure storage can survive reinstall. Android secure storage does not.
- R1.2 After the gate the user goes straight to adoption, with no account step.
- R1.3 After the gate, the user designs the pet on one screen. Dog and cat are both selectable on a species toggle. A sticky preview at the top updates as the user picks species, look, and breed. Below the preview, the user picks a coat style from a fixed palette filtered to the patterns that breed allows (solids, stripes, two-tone points, or bicolor, including a few offbeat fantasy colors), then eye color for cats, then a breed from a horizontal scroll of cards. Ears and tail are not user options: they come from the breed. Within a breed, small differences (ear size, tail fluff, marking strength, and a rare one-ear flop on erect dogs) are deterministic from the pet seed. Erect dog ears (corgi, husky) start folded at the puppy stage and rise with growth. The sticky preview stays awake (no nap). Each breed card shows the breed's potential range for each attribute as a min to max bar, and the card always shows the exact min and max numbers, labelled as potential. The app then moves to a "Choose your pup" (or kitten) step with three equal tiles, one per archetype (athlete, thinker, charmer), all deterministic from one seed and all visible with no scrolling. The tiles are a single-choice group with the first selected by default. A detail card shows the selected pup's name, a one-line blurb from data, and every attribute's exact potential as a 0 to 100 bar, with the two strong attributes highlighted and a +N marker where it beats the best of the other two pups. It does not show breed ranges or starting values. A 4-dot step indicator (adopt, choose, name, meet) appears on every adoption screen. The user picks one with "Adopt {archetype}", which does not create the pet yet. The other two are not saved. All three sets for a pet have the same total potential, and that total varies slightly per pet around 375 (375 plus or minus 10), so some pets roll a bit better overall. Phase 1 uses ten breeds: Retriever, Corgi, Dachshund, Husky, and Pug, plus Domestic Shorthair, Siamese, Persian, Maine Coon, and Scottish Fold. Stored ids are camelCase (`domesticShorthair`, `maineCoon`, `scottishFold`); old `tabby`, `domesticshorthair`, `mainecoon`, `bombay` and `black` ids migrate on load. Each breed carries a marking map and silhouette params so breeds stay recognizable in the same coat color and as silhouettes. The engine does not invent anatomy for a breed that is not in data.
- R1.4 Then the user names the pet on a "Name your pup" (or kitten) step: a NAME field validated by `validateName` in `src/adopt/name.ts`, and a "Meet {name}" button that creates the pet, exactly once. A valid name is 1 to 16 characters after NFC normalization, trimming, and collapsing inner spaces; only letters, numbers, spaces, and `' - .` are allowed; control, zero-width, and bidi characters are rejected; URLs and `@` handles are rejected; reserved names (such as admin, staff, boopboop) and a curated profanity list are rejected after leetspeak-normalized matching. Invalid input shows a short hint without quoting the blocked text, and Meet stays disabled. The same rules apply later to display names. There are no name suggestion chips. Back from the name or choose step keeps the same offers, the selected pup and the typed name, and never regenerates the seed. A "Meet {name}" intro follows, with the breed, archetype and Day 1, and current and potential bars for all six attributes (current is 20% of potential). Its "Start playing" button goes to the home screen. The intro has no back button, and it is shown only in the session where the pet was adopted; reopening the app after creation goes straight to home.
- R1.5 The chosen pet stores that one seed, a rules version, the archetype that was picked, its look, and the resulting potential and current scores. The seed is generated once and persisted in the adoption draft before the attribute sets render, so backing out and returning shows the same three sets. The draft also stores the chosen archetype and the typed name while the user is still in the flow. The same seed, species and breed always offer the same three sets, and the same seed, species, breed and archetype always create the same potential. Potential is stored on the pet and never recomputed from the seed after adoption, so a later change to breed ranges does not change existing pets.
- R1.6 Choose a new pet. For now the user can discard the current pet and adopt another. The button is a debug control with no confirmation. It deletes the stored pet, its scheduled reminder, any saved adoption draft, that pet's playdate history, its partner relationships, the playdate cooldown, and (from Phase 2) its care state, training tracks, bath tolerance, milestones, seen coach marks and scheduled care notifications, then shows the adoption flow. The user's inventory and treat economy stay (R5.21). The owner's NPC cast stays (R7.5). There is no way back to the old pet, and nothing about it is archived. The age record, the terms acceptance, the reminders preference, the sound preference, and the silent-mode hint (R9.9) are not pet data and stay as they are. A separate debug action clears the age check without deleting the pet. This is a stopgap. Later, the user can swap pets freely in the first 72 hours, and after that can rehome or retire a pet. Those rules are not built yet, and this requirement does not design them.

Acceptance: an under-13 result blocks progress, and the block is still there after the app is closed and reopened, with nothing about that result sent off the device; a 13+ confirmation reaches adoption and then the home screen with one named pet and no account screen; the same seed, species and breed always offer the same three attribute sets, including after leaving and returning to the choose screen; the same seed, species, breed and archetype always create the same pet potential; the design screen shows each breed's potential ranges and the preview follows the species, breed and look choices; the choose screen shows all three pups at once with exact potentials and +N deltas, and no range shading or starting ticks; an empty, overlong, symbol-heavy, link-like, or blocked name keeps Meet disabled and shows a hint; the pet is created only when "Meet {name}" is tapped with a valid name; after "Start playing", back does not return to onboarding; choosing a new pet shows species selection with no draft left over, no old pet after a restart, and no reminder scheduled for the old pet, and the age record and the reminders and sound preferences are unchanged.

**F2. Care and aging (Phases 0 and 1)**

- R2.1 Needs are hunger, energy and happiness, each 0 to 100. Hunger is higher when the pet needs food (0 = not hungry, ~100 ≈ a day without food). Energy and happiness are higher when better. While the app is open they move from timestamps at the live rates in sim config. That live step loop still refuses to apply more than 48 hours at those rates. While the app is closed, the gap is applied once on return, in ring space (tummy is 100 − hunger). For the first 12 hours tummy drifts toward 60 and mood toward 70, and a value already below its target is not raised. After 12 hours they decay by half-life toward floors of 10 (tummy) and 20 (mood). Energy recovers toward 90 with a 2-hour half-life, because the pet is resting. When the app is opened more than 3 hours after the last open, that rested value is then filled to 100. There is no cap on how long they were gone: a week away still rests energy to about 90, then fills it to 100. The + chip shows only the points added on top of the rested value, after any Boop payouts from that open. A gain that rounds to 0 fills with no chip. Closed elapsed time is capped at 30 days. A clock moved backward applies nothing. No need reaches 0 from closed time alone. The pet never dies or runs away. Older briefs that say "fullness" mean the inverted hunger scale. Hydration is a fourth visible meter, 0 to 100, where 100 is fully hydrated. It is not part of the closed-time away model. It does not move while the pet is still or asleep. Walking, trotting, cantering, galloping, and play spend it at the activity rates in sim config. An empty food bowl or an empty water bowl adds no mood penalty. While the app is open, mood still drops quickly only when tummy or energy is under 30, and it will not rise while either is under 30.
- R2.2 Care actions are Feed, Water, Treat, and Sleep, plus pet and cuddle (R4.8). Sleep does not mark the pet asleep until he is lying down, so the button stays Sleep during the walk. Feed and Treat open a Pantry card. Play opens a toy card. Sit, give paw, and speak are also user actions. While asleep, any of those actions (except sleep itself) wakes the pet and then runs. Idle is not a user control: when no task is running, the pet idles on its own. Pant and purr are not actions. A dog may pant on its own, including after a fetch. A cat may purr on its own, including after batting the ball. Nothing in the interface starts pant or purr. Finishing a meal lowers hunger by up to 40 and raises energy by 2, both clamped to 0–100. A finished drink adds 34 hydration, clamped at 100, and does not change weight. A drink from a water bowl also removes one third of the bowl, so three drinks from a full bowl empty it. A drink from open water, such as the park pond, does not change the bowl. Refill water fills the bowl and does not change hydration. The button label is Water. A tap on the water bowl does the same thing. Sleep starts at once. Feed starts once a food is chosen from the Pantry. Play, a cuddle, a treat, a trick, and a park hello step aside. Water does the same, except it waits while a meal or a nap is already underway. A room change and a collapse nap finish first, and then the pet walks to the bowl or the bed. See docs/boop-boop-home-ui.md.
- R2.3 Aging runs on two continuous values, each from 0 to 1. Maturity only goes up. It is derived from ageDays (R2.7), and ageDays is calendar time since `bornAt`, so it moves while the app is open and for the full time the app was closed. There is no 48-hour cap and no one-boundary clamp on age. Closed-time needs use the 30-day away model (R2.1). The 48-hour cap is only a guard on the live step loop. Until the care window exists, maturity accrues at full rate. After that, poor care can slow maturity toward a floor around half speed, and neglect does not stop aging. Vitality moves up and down with care (R2.8) across that same closed gap, capped at 30 days, and missed care days stay capped at 2. Life stages are internal labels derived from these values, not separate states with separate art: puppy, older puppy, adolescent, adult and senior, with the senior stage split into bands (R2.9). A stage label sets the level ceiling and the learning speed, and nothing else. The day threshold of each label is a tunable constant. The user never sees a stage name.
- R2.4 Mood is derived from the needs using the priority rule in the prototype brief.
- R2.5 Local notifications remind the user when a need is low. From Phase 2 one scheduler owns them all and adds opt-in care notifications (R5.19). They do not announce life stage labels or senior bands. The tone is calm with no guilt wording, and the user can turn them off in settings.
- R2.6 Development builds include a Settings panel (labeled Settings, not Debug) that fast-forwards time and has sliders for ageDays, vitality, and weight. A time jump or an age slider rewrites `bornAt` so ageDays matches the requested value. Settings may show internal stage labels and the weight index. The rest of the app does not. The home screen does not ship a scene JSON editor.
- R2.7 Seamless aging. The pet's appearance is a function of ageDays, vitality, and weight. ageDays is the calendar day count since `bornAt`, including time the app was open and the full time it was closed. The curves clamp at 1000 days. The pet keeps living after that. maturity is `min(1, ageDays / daysToSenior)` with daysToSenior at 180, so the stage boundaries stay on days 7, 21, 45, and 180, and a senior pet still has days left for late visual cues. Each visual feature has its own curve in a data file. Leg length follows an S-curve across growth. The other growth curves do not reverse. Under-eye bags appear across about day 600 to 800 and fade when vitality is high. Cuteness is stronger on a young pet: `cf = cuteness * (0.55 + 0.45 * (1 - growth))` enlarges the head by `1 + 0.28 * cf`, the eye by `0.12 * cf`, lowers the eyes, sets blush to `0.3 * cf`, and enlarges the paws by `1 + 0.25 * cf`. Weight changes body thickness, the belly, and leg width (R2.13). On the floor, the pet draws smaller toward the back of the scene and larger toward the front. No stage change plays a transition, effect, or swap. On a change, the stored values update immediately and the view eases to them over about a second. The user never watches a jump, never sees a stage name, and never sees the weight number.
- R2.8 Vitality is driven by a rolling window of recent care: diet quality, exercise, play and attention. It moves slowly toward a target set by that window, so one action cannot swing it. Neglect lowers it gradually to a floor of "slow and sleepy but content". It never reaches a state that is distressing or fatal.
- R2.9 The senior stage has internal bands, such as early senior, senior and elderly, defined as ranges of vitality. A senior pet moves between bands in both directions: more exercise, play, attention or a better diet raises vitality and rejuvenates it, and neglect lowers it. Band boundaries use hysteresis so the label does not flicker. The current band is remembered so that margin can be applied. Vitality stays the source of truth. Band names are never shown.
- R2.10 Rejuvenation cap. Vitality affects every pet's energy and mood, but its aging cues become visible mainly once maturity reaches the senior range. Proposed: a pet's best possible look is capped by its maturity, so a senior pet can look spry and bright with a graying muzzle but never returns to puppy proportions. Maturity is never reduced.
- R2.11 Senior graying is separate from vitality: `grayLevel` follows age only (0 before about day 550, an S-curve to 1 by day 850, per species in `data/graying.ts`) and rejuvenation never lowers it. It frosts the muzzle and chin from the start, the brows and eye corners from about 0.4, and the chest and paws from about 0.75, as speckles blended toward a light desaturated gray of the region's own color (locked dark regions such as the pug mask and Siamese points included). Cats show about 0.4 of a dog's effect, muzzle only. Vitality drives the other visible aging cues: ear droop, posture, coat dullness, eye brightness, gait and animation speed, and under-eye bags. Bags are a curve from about day 600 to 800, and high vitality fades them. Vitality also scales energy recovery and the number of play and training sessions the pet is happy to do. It does not lock the owner out of any feature.
- R2.12 Diet and exercise need something to measure. Proposed: a small set of food types with different quality, and exercise measured from fetch and play sessions. Until Phase 2, vitality uses feeding regularity and attention only.
- R2.13 Weight is an index `w` from -1 to 1, not an attribute. 0 is the start, and -0.25 to 0.25 is the healthy band. Higher is heavier and lower is lighter. The number is never shown, and neither are the labels Underweight, Lean, Healthy, Plump, and Overweight. While the app is open, hunger subtracts 0.12 per day. While it is closed, weight is unchanged for 24 hours, then approaches the floor of -1 with a 96-hour half-life and never reaches that floor from closed time alone. Age still uses the full closed gap. A meal adds 0.12 across the eat. Drink does not change weight. Running faster than speed 80 burns 0.003 per second. The index clamps at -1 and 1. Thickness is `1 + 0.5 * |w|^1.5` when `w` is positive and `1 - 0.3 * |w|^1.5` when `w` is negative. That thickness scales body height, sags or tucks the belly, thickens the legs slightly, fades ribs in below -0.35, and slows a heavy pet by up to 22%. It changes effective stamina and agility (R3.5). It does not change potential or the stored current score, and it does not lock any feature. A saved weight outside -1 to 1 maps with `(weight - 50) / 50`, clamped. A saved `ageDays` sets `bornAt` so the pet does not become a newborn.

Acceptance: the simulation tests from the prototype brief pass for needs; a closed gap longer than 30 days gives the same needs and away-weight result as 30 days, and the full gap for ageDays and maturity; a weekend away does not thin the pet at the open-app 0.12 per day rate; maturity never decreases; after maturity is 1, further calendar time still raises ageDays until the curves clamp at 1000; vitality changes are bounded per day and respond to care in both directions; a senior pet can move between bands through care and back through neglect without flicker; bags grow across about day 600 to 800 and fade when vitality is high; every new pet starts at weight 0 and ageDays 0; one meal raises weight by 0.12 and a day without a meal lowers it by 0.12; weight never leaves -1 to 1; the debug sliders move the pet smoothly across the whole range with no visible jump; no user-facing screen shows a stage name, the weight number, or a weight label.

**F3. Attributes and potential (Phase 1)**

- R3.1 Six attributes: stamina, agility, intelligence, boldness, affection and obedience. Obedience replaces willfulness and is its opposite: higher means more cooperative. Energy, as an attribute, becomes stamina. The need named energy is unchanged. Scores are whole numbers on a tunable scale. Breed potential ranges run from about 10 to 100. Each pet has a current score and a maximum potential for every attribute. A seventh attribute, instinct (nose), is optional and is not built in the MVP.
- R3.2 Each breed defines a potential range (min and max) for each attribute, as data next to the breed's visual parameters. A pet's potential is a pure function of (seed, species, breed key, archetype), computed by `generateOffers` with its own deterministic hash (rule 11). It offers three sets, one per archetype: athlete (stamina, agility), thinker (intelligence, obedience) and charmer (boldness, affection). Every value stays inside the breed range, all three sets share one total, and each archetype's strong attributes sit higher in the breed range than in the other two sets. Strong is relative to the breed, so breed identity always shows through. The total per pet is 375 plus or minus 10. The generator takes breed ranges as an argument and does not import React, Skia or storage. All of its numbers (base total, quality spread, jitter, boost, start fraction, rules version) live in config. Nothing in generation uses `Math.random()`.
- R3.3 The pet stores `attributes`: the seed, a rules version, the chosen archetype, potential (fixed ceilings) and current. Current starts at 20% of potential (minimum 1, tunable) and is clamped to potential wherever it is written. Natural growth with maturity lifts the effective score toward about 70% of potential, and training raises the stored current score (R3.8). Care patterns can nudge the effective score slowly through drift within bounds. Nothing raises potential, including paid items.
- R3.4 Level rises with experience from care, training and play, and each life stage label has a level ceiling. Ceilings are step values by label and do not change gradually, so the level cap only moves when a label changes.
- R3.5 The effective score the simulation uses is the larger of the stored current score and natural growth for the pet's maturity, plus care drift plus temporary effects, multiplied by the aging modifier (R3.9) and, for stamina and agility, by the weight modifier (R2.13), then capped at potential.
- R3.6 The home screen shows the pet's name and level above the actor. Archetype or style and each attribute's current score and potential (for example "Agility 18 / 88") live behind a `{name}'s personality` control that expands like Settings. Adoption still shows potentials and current scores on the choose and meet steps. Trick mastery joins the personality view when it exists. The seed is never shown. Life stage names and senior bands stay internal (R2.3).
- R3.6a Current style. The pet keeps its origin archetype, unchanged. A derived current style label is a pure function of archetype, stored current and potential, and is never stored or persisted. For each archetype, score = average of current / potential over its two strong attributes (a potential of 0 counts as 0). The style equals the origin unless another archetype's score beats the origin's by at least 0.05 (`STYLE.SWITCH_MARGIN`, in config); ties between non-origin archetypes resolve athlete, thinker, charmer. Labels live in data: origin "The Athlete / The Thinker / The Charmer", style "Athletic / Clever / Charming". The personality panel shows "Born: The Thinker · Style: Athletic" when they differ and the origin label alone when they match. It never changes archetype or potential. Until training raises stored current, every pet's style equals its origin.
- R3.7 Fairness: the three sets offered for one pet have the same total, so the choice is a tradeoff and not an upgrade. Breed midpoints sum to about 375, so no breed is strictly better. The total varies slightly per pet (375 plus or minus 10), which is the "good roll" players will talk about.
- R3.8 (Proposed) Training raises attributes. Fetch and play raise agility and stamina, trick learning raises intelligence and obedience, and playdates raise the attributes that activity trains. Gains have diminishing returns per day (R5.8) and taper hard as the current score nears potential, so the last points are the slow ones. Training raises the stored current score toward potential. The activities that award them arrive in Phase 2. Playdate attribute gains are the exception: they are a flat add to the score the pet shows (the higher of the stored current score and natural growth), capped at potential, with no training taper and no level XP (R7.5). Fetch and trick training still taper when they ship.
- R3.9 (Proposed) Attributes change over time through five sources: growth with maturity, training, milestone bonus points which the owner places, temporary buffs from food, play, rest and toys, short penalties while tired or hungry, and aging. Seniors lose some effective stamina and agility through low vitality and may gain obedience, and rejuvenation restores them. Weight outside the healthy band (-0.25 to 0.25) also lowers effective stamina and agility, and returning into that band restores them. Aging and weight change only the effective score, never the stored current score or the potential, so both are fully reversible. Keep a floor so effective scores never drop to unplayable.

Acceptance: the same seed, species, breed and archetype always give the same potentials; the three sets differ; every potential is inside its breed range; the three sets share one total, and that total is within 375 plus or minus 10; across many seeds each archetype's strong attributes sit highest within the breed range; current starts at 20% of potential (minimum 1) and no current score exceeds its potential; training raises the matching attribute and the gain tapers hard near potential; aging lowers only the effective score and rejuvenation restores it; the pick screen shows each set's archetype and each attribute's exact potential, and the pet's attribute screen shows current and potential.

## Functional requirements: play, training and outfits

**F4. Play interactions (the actor in Phase 1, mastery in Phase 2)**

- R4.1 Petting: a stroke on the pet sends a pet event, at most one every 400 milliseconds, with a light haptic tap. While asleep it wakes the pet and then runs the reaction. The pet event starts that species' reaction. A dog barks or offers a paw. A cat purrs or grooms. The existing roll chooses which of the two. A tap on the scene is the ball drop in R4.2. This quick stroke stays as it is while Cuddle mode (R4.8) is off. Cuddle mode replaces it with the richer gestures in R4.9 and adds no haptics.
- R4.2 Play → Throw ball starts the species' chase through the item system (item kind + play rules). Each toy declares which behaviors it allows (`allows` on the play rule); the pet picks among them by age, mood, energy, and attributes. Play opens a card under the preview listing owned toys. Today that card shows the ball; frisbee, yarn, and squeaky exist in the item registry and draw, and switch on with `world.toyKind`. A dog often play-bows first (front legs fold, chest low, rump up, fast wag, hold 0.5–1.5 s, then a hop into the chase), chases at a sampled pace with short bursts, may leap-catch a flying frisbee or ball (adults and adolescents; puppies and seniors mostly catch after it lands), may overshoot or tumble when clumsy, then returns the toy or shows it off and drops it. After play a dog pants, or flops down when tired or young or old. A cat may stalk a still toy (low crouch, eyes locked), wiggle its butt 0.5–1.5 s, then pounce; with a ball it bats three times with a hop; with yarn it may roll, bunny-kick, and tangle. After play a cat may groom or purr. A squeaky toy is shaken in the mouth then chewed lying down. In Phase 1 the chase always runs. In Phase 2 the simulation may refuse it from the pet's traits and fetch mastery, and a completed chase costs energy and raises bond. Mood is not paid for picking or throwing a toy. Mood rises by 3 after 3 seconds of continuous toy movement, or after 5 taps or throws. Either one is enough. A toy sitting still, and a pet chasing or chewing on its own, does not count. The movement clock clears when the toy stops. The tap count clears when the grant lands, or when the toy is put away. Tummy and energy both have to be at least 30. Scene items are ephemeral; toy ownership is saved. The Throw ball action throws from the left edge (a frisbee flies long and flat; yarn is a low toss). A tap on empty floor soft-drops the ball from a high `z` (about 120) with no upward velocity so the fall reads as a drop from above. A tap on furniture does not (R4.14). A flick throws with velocity. The ball kind's bounce multiplier is 1.5, scaled by the scene surface (`bounce` × kind bounce), so tosses stay lively across rooms. Feed is disabled when the scene has no `food` point. Refill water is disabled when the scene has no refillable water bowl or the bowl is already full. Rest is always available: sleep and idle naps walk to a `bed` point when the scene has one, and otherwise the pet sleeps or naps where it stands.
- R4.3 One toy in the MVP: the user can give the pet a toy from their inventory. The pet may have a favorite based on its personality, and the toy attaches to a mouth point on the actor. This waits for Phase 2.
- R4.4 The simulation decides what happens and the renderer draws it. The renderer never holds game rules.
- R4.5 Eight-octant body, with a 3/4 head in idle. Each actor has a ground position (`x` and depth `y`) and a height `z`. Walking uses `x` and `y`. Facing is E, NE, N, NW, W, SW, S, or SE, derived from velocity with 10° of hysteresis. N is up the screen and S is toward the camera. Five views are drawn (side, front 3/4, front, back 3/4, back); west-side octants mirror the east-side view. A turn steps one octant at a time and prefers the camera side on a tie. More than one octant of change holds the pet in place. A one-octant change tweens. A skid keeps the old octant until horizontal speed falls off. Stopped, the body returns to E or W and then the head eases to the 3/4 idle. `faceCam` turns only the head, and only on E or W. Depth `y` is position on the scene floor. Draw scale is `0.9 + 0.1 * clamp((y - yMin) / (yMax - yMin), 0, 1)` when depth is enabled (the same curve scales the toy), so the pet is slightly smaller toward the back and larger toward the front. A jump (hop, leap-catch, or pounce) is a vertical body offset on `z` with the legs tucked; the ground shadow stays down and shrinks and fades with height; landing is a brief squash that is stronger for heavier pets. The toy keeps its own flight, and its bounce and friction come from the scene surface. Hurdle props (`hurdle: true`) are supported in the engine for a hop-over when the pet runs through them; no shipped scene has one yet. Front and back legs step mostly vertically on the same phase; 3/4 views blend that with the side stride. Switching view does not restart the phase. Legs use a gait system (walk 4-beat lateral, trot diagonal pairs, canter 3-beat, gallop rotary with a flight phase) chosen from current speed with hysteresis and blended over about 150 ms. Stride length and frequency scale with speed and `legLen`, so short-legged breeds take faster, shorter strides. The body has a slight bounce per stride; gallop adds spine stretch and ear/tail streaming back. Pose channels for play include `tuck`, `land`, `bow`, `stalk`, `wiggle`, `stream`, `stretch`, and `skid`. The head uses the pose channel `headTurn` (0 = side view with one eye, 1 = 3/4 toward the camera with two eyes). The behavior state machine sets the target; the renderer only reads the eased value. `headTurn` is 1 only while the pet is stationary in idle `still`, `pant`, or `purr`, or in the plain `sit` or `winddown` tasks. It is 0 for walk, nap, sleep, eat, drink, fetch (every stage including bow, stalk, pounce, zoom), paw, bark, groom, refuse, zoomies, and any locomotion. While speed is above 14 the value is capped at 0.15 so a turned head never shows during translation. The ease rate is about 10 (~300 ms to settle). Cuddle mode (R4.8) adds one exception to the lying veto: `headTurn` may be 1 while the pet is stationary in the Cuddle task, including during roll-over. It eases 1 to 0 before any Cuddle exit walk starts, and the speed cap above still applies. Per-breed `face3q` data (far-eye offset, snout shift and drop, far-ear offset) drives the 3/4 layout; floppy near ears also slide back so they never cover an eye. The pose still has `spineArch` and `crouch` so a later behavior can use them. Phase 1 leaves those channels at 0 unless a shipped behavior sets them. Cosmetics stay attached through jumps, bows, and gaits.
- R4.6 Behaviors are data on top of one task machine. Shared tasks are stand, sit, sleep, eat, drink, walk, jump, and idle. Drink reuses the eat pose at the water point, adds 34 hydration, does not change weight, and may start on its own when water is available. The chance rises as hydration falls. A bowl drink removes one third of the bowl. Open water does not. Refill water fills the home bowl, does not change hydration, and does not play drink. An empty bowl does not penalize mood. A dog also has pant, give paw, bark, and fetch. A cat also has purr, groom, and pounce. Asking a species for a task it does not have does nothing. Feed starts eat at the food point (refuses with a head turn when hunger is 0). Feed and Sleep do not wait for play, a cuddle, a treat, a trick, or a park hello. Water waits only while a meal or a nap is already underway. A room change and a collapse nap finish first. Rest invites the bed. The pet is not asleep until he lies down, and the Sleep button stays Sleep until then. Wake is the same button once he is asleep. Rest starts the walk to the bed when one exists, otherwise where the pet stands. The pet turns to face that walk before it steps. Once it is lying down, every 5 seconds adds +5 energy until energy is 100. The last tick adds only the points left, and the chip shows that amount. Empty energy still drops the pet for 5 seconds and wakes it with +10. Wake returns to idle. Any other user action (sit, paw, speak, eat, fetch, pet) wakes a sleeper and then runs. When no task is running, the pet idles on its own. Idle is not a button. Idle weights are still 3, pant 2, purr 2, nap 1.5, and walk 2.5, with a dynamic zoom weight from the life-stage zoomies rate, energy, and mood. A dog may stand still, pant, nap, wander, or run a short zoomies lap. A cat may stand still, purr, nap, wander, or (when lively enough) zoom. An idle nap walks to a `bed` point when the scene has one. Wander and zoomies are skipped when reduced motion is on. Pant and purr are tasks the machine may enter. They are not controls. The home screen keeps the pet name and actor sticky; need tiles (Tummy, Hydration, Energy, Mood) sit below the animation; the stage does not show a status bubble. Scenes are data. Living room, bedroom, park, and catio are bundled presets. Living room and bedroom are indoor. Park and catio are outdoor. Catio is offered only to cats. The home screen picks a place from a Where row that opens Where to?. There is no Backyard, Groomer, or Vet. The stage is 640 wide by 680 tall (`stageWidth` / `stageHeight` in `src/actor/scenes.ts`). Phones stay portrait. A window whose shorter side is at least 600dp keeps that fitted height and extends the sky and floor to the side edges; the pet, furniture, and walk limits stay in the center 640, and taps outside that band do nothing. Wall height stays near the original horizon (~176–190); the walkable floor extends to about `yMax` 654 so the pet has depth to wander. Indoor `planks` floors grow row height with depth for perspective, then cap near-floor row height so tiling continues across the tall stage instead of stretching into a few huge planks. Furniture and POIs are spread across that floor band. The adoption preview crops to the top 340 of the stage (`previewStageHeight`) so the pet stays framed without the empty foreground. Swapping scenes does not change pet stats. The pet moves to that scene's home point. A prop's `y` is its baseline. Props with `layer: 'sorted'` are depth-sorted against pets and the ball by `y`; `back` props draw under everything; `front` props draw over everything. Scenery is visual only. Furniture is solid and the pet walks around it (R4.14). Other props have no collision except through points of interest. A POI's `face` is the direction the pet faces while using it. For food and water it is only a tie-break when the pet starts exactly level with the bowl; otherwise the pet stands beside the bowl on the side it approached from and faces it. Known prop kinds are shape, bowl, bed, rug, couch, window, lamp, tree, bench, pond, bush, and fence. Scenes extend in three ways: (1) a new scene as JSON using existing prop kinds, the generic `shape` prop, and existing POI types, with no code; (2) a new prop kind as one draw registration; (3) a new POI type with a new action through an affordance registry (poi type, action, approach, pose, duration, optional effects) so the task machine is not hardcoded per POI. Ambient particles (`rain`, `snow`, `leaves`) stay within a small budget and turn off when reduced motion is on. A scene change uses a quick fade. A later `image` shape and downloadable scene packs are allowed; a bad pack must fail validation and never crash the app. Static scenery (sky, layers, floor, `back` props) may render into a cached image and redraw only what moves. The demo scene editor, weight slider, and hour slider do not ship.
- R4.6a Park visitors. Only the home park. Zero, one, or two animals may be on the grass. They walk in from the left or right, wander, may greet the pet, and walk off. Who starts a hello depends on shown boldness and affection (shy under 40 boldness, the same line as playdates). A finished hello with the pet pays +2 mood, once per visitor, and at most +6 mood per 10 minutes. No attribute points and no bond. A player command cancels the hello with no penalty. Visitors do not eat, drink, sleep, or take the toy. Other scenes, the shop, and playdates do not spawn them. See docs/park-visitors.md.

- R4.7 Time of day is a view concern. One module returns the blend for a local hour. Scenes only declare `time`: `outdoor`, `indoor`, or `fixed`. Omitted means `fixed`. An unknown value fails validation with `"time" must be outdoor, indoor or fixed.` Nothing outside scene data names a scene. `outdoor` draws the sky gradient, the sun, the moon, and the stars. `indoor` draws lamps and windows of that same sky. `fixed` does not change with the clock. The tint is applied per layer, not as one rectangle over the finished picture. Backdrop and props take the full tint. Pets and the ball take `lighting.actorTint` times that tint. Defaults are 0.35 indoors, 0.85 outdoors, and 0 for `fixed`, which means no tint. A scene may set `lighting.actorTint`. It must be a number from 0 to 1. Anything else fails validation with a message that names `lighting.actorTint`. Outdoor tint values do not change. An indoor room is not color-mixed, so the floor and props keep their color. Night is a navy veil, `#1B2350` at 0.18 alpha, drawn after the props and before the pet. That is about half the old indoor cap. Lamp light, pumpkin glow, and window moonlight are soft radial pools drawn above the veil. The pet, his toy, and a prop he is using are drawn after the veil, so he is not tinted. His warm floor glow stays under him and above the veil. While the screen is open the veil and those pools ease over 1.5 seconds. Reduce Motion switches them at once. When `dark` is above 0.5 the warm pool under the pet still fades in with `dark`. `actorTint` defaults, the indoor alpha cap, and the pool's radius and strength live in the lighting data file. At the darkest indoor keyframe the pet's luminance stays at least 70% of its daytime luminance. The keyframe table lives in config and moves to a data file. Phases, in local time, are Night 21:30 to 05:00, Dawn 05:00 to 07:30, Morning 07:30 to 12:00, Afternoon 12:00 to 17:00, Dusk 17:00 to 19:00, and Evening 19:00 to 21:30. Keyframe hours are 0, 4.75, 6.25, 8, 10.5, 14, 16.5, 18, 19.75, 21.5, and 24. Each keyframe holds a top color, a bottom color, an outdoor tint, an indoor tint, and `dark` from 0 to 1. Neighbors blend with smoothstep, so phase boundaries do not jump. The sun crosses east to west from 06:00 to 18:00. The moon uses the same path from 18:00 to 06:00 and fades in with `dark`. Stars fade in above `dark` 0.45. A `sky` shape (`{ t: 'sky', x, y, w, h }`) draws that same sky, and window props use it. Lamp `glow` omitted fades in as it gets dark. `true` or `false` forces it. Lamp glows draw after the tint so they stay bright. The view re-reads the device clock about once a second and does not cache it across a day change. The sky layer redraws on that same cadence. Star twinkle can be skipped. Reduced motion uses static stars. Time of day does not write weight, mood, age, or any other pet state. A later sleepy-at-night behavior would read this same clock. Development builds may override the hour. The product has no phase buttons and no hour slider. Do not ask for location permission to move sunrise and sunset. A later painted background keeps the sky as its own layer so the engine still draws the sky and the tint; do not rely on a single painted PNG or a day/night cross-fade as the primary approach.

- R4.8 Cuddle mode core. Cuddle is a toggle action in the action bar. Turning it on sends the pet to the scene's home spot (walk, `headTurn` 0), then settles it into a sit (about 400 ms), then eases `headTurn` 0 to 1 (about 300 ms) with an ear perk and one blink. It is a task (`cuddle`) on the same task machine, with phases: approach, settle, waiting, rollDown, rollOver, belly, rollBack, hold, unturn, shake or swat, leave. Touch zones are head, back, nose, and belly (belly is active only while the pet is on its back). Tolerance is seconds of valid petting the pet accepts before it leaves; sustained petting past an escalation threshold makes a dog roll over and a cat knead. Both thresholds scale with the pet's affection (`cuddleAffinity`, 0 to 1). When a session ends after real petting, one `cuddled` event raises happiness and nudges affection drift and attention. While the pet is accepting touch, every 3 seconds of uninterrupted gesturing pays +5 happiness, or +10 once it is in the belly phase. Lifting resets that streak. Cuddle sends no haptics. Audio is three recorded clips: `cuddle_purr` on a cat's content stroke and kneading, `cuddle_happy` on a dog's content stroke and scratch kick, and `cuddle_pant` (a short cut of a longer pant) on a dog's belly rub. Boop, flinch, swat, and shake-off stay silent. Every duration, amplitude, threshold, and chance lives in `src/actor/data/cuddle.ts`, overridable per species and breed, and multiplied by a life-stage factor so seniors move slower (rule 5).
- R4.9 Gestures and feedback. A valid stroke is a drag at a moderate speed (default 20 to 900 view px/s) over the pet. It leaves a soft, short-lived trail under the finger, and every third valid stroke spawns one small heart that floats up and fades in 600 to 800 ms. A faster swipe shows no trail and no hearts; the pet gives a tiny flinch and ear flick instead, which teaches "slower". Scratch is 3 or more direction reversals within 600 ms over the head zone, and it plays a separate reaction. Boop is a tap on the nose. Four boops within 2 s make the 4th a playful head shake instead of the boop reaction. Gesture classification is a pure module with unit tests. Need gains float up as point chips with a pop, one after another when several land together: the meal's tummy fill, then +2 energy; +5 energy every 5 seconds of sleep until full, or the points left on the last tick; +10 when a collapse nap ends; the cuddle mood amount; and, when the app is opened more than 3 hours after the last open, the points added to reach 100 after the away rest. That return chip uses the same pop, waits until Boop payouts from the open finish, and is skipped when the gain rounds to 0.
- R4.10 Guidance. The first time Cuddle is entered, one blue candy tooltip points at the pet and reads "Stroke his back or head". Doing the stroke marks it seen. Dismissing it allows one later show, then never again. If there is no touch on the pet within 3 s of settling, a faint ghost-finger stroke pulses once over the pet's back (no text), only for the first 3 sessions. Long-pressing the Cuddle button opens the "How to cuddle" sheet (stroke, scratch, boop, belly rub, every pet is different, tap Cuddle again). Cats use the same copy. Other tips are in docs/boop-boop-home-ui.md.
- R4.11 Cuddle animations. Every reaction is pose targets plus easing in the behavior layer. The renderer only draws the pose. Continuous pose channels blend through the pose blender's first-order ease, so a new target never snaps. Keyframed reactions (head tilt, flinch, shake-off) use an easeInOutSine envelope. Spring overshoot is used only for the ear perk and the boop nose scrunch and jolt. Reactions: enter and settle (B1), waiting with an occasional head tilt toward the last touch (B2), stroke with half-closed eyes, a small head and body lean, and flattened ears for dogs, or a purr with a raised tail for cats (B3), scratch with a head tilt and, for dogs, a rare hind-leg kick, or for cats a head-bunt (B4), boop with a squeeze, nose scrunch, and head jolt (B5), dog roll-over and belly rub with paddling legs, or cat kneading with a rare belly-up "trap" that ends in a soft paw swat (B6), tolerance exit with a dog shake-off or a cat tail flick and one claw-free swat, then a walk to idle (B7), and mode exit with a content hold of about 1.5 s if petting just happened (B8). Ease `headTurn` 1 to 0 before the walk starts; this is a hard rule.
- R4.12 Animation constraints. Every transition blends from the current pose, so nothing snaps, including when interrupted by another action or by the user. Reactions scale with body size and life stage. Cosmetics follow every pose. Known gaps are listed in R6.7.
- R4.13 Action bar icons. Every button in the action bar and the settings toggles uses one icon set (`lucide-react-native` on `react-native-svg`), outline style, one size and stroke weight, no emoji. Care is pink (Feed, Water, Treat, Sleep), Bond is blue (Cuddle, Play, Playdate), and Style & sound is lilac pills (Wardrobe, Storage, Traits, Sounds, Music). Sounds and Music are switches. Learned tricks use the blue tiles. Badges are lilac coins and appear only after the trick is awarded. The home screen's need tiles (Tummy, Hydration, Energy, Mood) keep the earlier candy shell. Tummy shows the inverse of stored hunger. Hydration, Energy, and Mood show their stored values, so a full ring is always good. Flavors are peach, aqua, butter, and pink. Each shows a caption by level (75, 50, and 25 cutoffs) plus the rounded value. Under 25 the progress arc and status line turn red and a red "!" badge appears. The tile itself keeps its flavor. Training cards use the same candy shell. A locked trick is gray and not tappable. A freshly unlocked trick shows a "New!" sticker. The Where row opens Where to?, a page of Living room, Bedroom, Park, and Catio (cats only). The current place shows "You're here". Icons come from one `actionId -> iconName` map in `src/ui/actionIcons.ts`, so a new action adds an entry and does not touch layout code. Each button has an `accessibilityLabel` equal to its label and a touch target of at least 44 by 44. Cats use the same icons with species labels where they differ. Both species play with a ball today, so no variant ships; the laser toy later registers `Target` and the label Laser for cats as one map entry. Mapping: Feed `Soup`, Refill water `Droplet`, Play `Volleyball`, Sit `Armchair`, Give paw `PawPrint` (cats: High five, `Hand`), Speak `MessageCircle`, Sleep `Moon`, Wake `Sun`, Cuddle `HandHeart`, Wardrobe `Shirt`, Playdate `Users`, Reminders `Bell`, Sound `Volume2` or `VolumeX`, Personality `Sparkles`, Help `CircleQuestionMark`.
- R4.14 Furniture. Furniture is the owned set the pet walks around: food bowl, water bowl, pet bed, cat tree, planter, and catio post. There is no litter box in any room. Rugs, windows, couches, lamps, trees, bushes, benches, fences, ponds, hammocks, scratchers, shelves, and the garden and screen are scenery. The pet walks around a piece unless its current task is using that piece: eat at the food bowl, drink at the water bowl, or sleep or an idle nap on the bed. Cat trees, planters, and posts have no use, so the pet always walks around them. On the home stage, holding a piece for 400ms opens Put in storage or Move. Move lifts it and the next drag places it inside the walkable floor. Put in storage removes that placement and leaves the piece owned. Bowls and the bed warn first, using the pet's name. A Storage control lists what is owned but not out. A piece that cannot go in the room on screen is listed inactive and cannot be placed. Saved furniture can be placed only in a scene marked as the player's (living room, bedroom, catio, and later scenes with the same flag), including a food or water bowl in the bedroom. Each of the player's rooms holds one food bowl and one water bowl. A second bowl of that kind stays put and says "There's already a food bowl in this room." or "There's already a water bowl in this room." Park and Training School are not the player's. Trick props can still be put out there and still clear on a scene change. A tap never moves a piece. A tap on the food bowl, water bowl, or bed runs that care action. A tap on empty floor still throws. Holding and dragging moves the piece inside the walkable floor, and its point of interest moves with it. A later tap on a piece that has no action does not throw the ball. Cuddle mode does not move furniture. Playdates keep their scripted scenes and ignore saved placements. Ownership is saved on the pet. `furniture` is the pieces the player owns, including ones not placed in a room yet. `furniturePlaced` is `{ pieceId, sceneId, x, y }` for each piece that is out. A new pet owns the pieces already in its rooms, at those spots. An old save with no furniture fields loads that same starter set. Dogs do not own catio pieces. Neither species owns a litter box. Feed and refill water follow the bowls saved in the room on screen, including a bowl placed in the bedroom or the catio, and stay unavailable when that room has no bowl of that kind. They do not follow bowls that are only in the room template. A saved placement is still there after the player leaves the room and comes back. A placement that does not save is removed from the floor. A bowl with no contents still counts: a water id holds water, and any other bowl holds food. Drink still needs a water spot in the scene. Sleep stays available without a bed. A save that still lists `bedroom-food`, `bedroom-water`, `livingroom-litter`, or `bedroom-litter` drops those pieces on load. There is no catalog screen yet.

Acceptance (Cuddle and icons): the first Cuddle entry shows one tooltip, "Stroke his back or head", and the help sheet is reachable later; a valid stroke leaves a trail and every third one a heart, while a too-fast swipe leaves neither and the pet flinches; scratch, boop, roll-over or knead, and the tolerance exit each play smoothly from any starting pose for all 10 breeds and all life stages; `headTurn` is never 1 while the pet is moving across the screen; every action button has an icon from the same set with a consistent active state, a matching accessibility label, and a 44 by 44 target; Cuddle sends no haptics. Unit tests cover gesture classification, the `headTurn` guard, the no-snap blend, tooltip seen-state, and the icon map covering every action id.

Deferred: the obstacle course, the laser pointer, and shifting the keyframe hours by date.

Acceptance: stroking feels continuous but cannot be spammed; a tap on empty floor soft-drops the ball from a high `z` and starts a chase, a tap on a bowl or the bed runs that care action, and a tap on other furniture does not throw; a flick throws with velocity; Play opens a toy card and choosing the ball throws from the left edge; the ball's bounce follows scene surface times the ball kind multiplier (1.5); a dog may play-bow, chase with gait changes and speed variety, return or show off the toy, then pant or flop, and a cat may stalk and pounce, bat three times, or roll with yarn, then groom or purr; all gait and pose transitions are smooth and `headTurn` stays 0 through play; throw ball always produces a chase in Phase 1, and the same traits and seed give the same refusal in Phase 2; no control starts pant or purr; a cat never pants and a dog never grooms; feed and refill water stay disabled when the scene cannot support them, and the UI can show why; rest stays available without a bed, and sleep and idle naps walk to the bed when the scene has one; ball bounce and friction follow the scene surface; all three preset scenes work with both species, including wardrobe and weight; a new scene written only as JSON with existing prop kinds and POI types loads and plays with no code changes; an invalid scene fails with a clear field-named message and leaves the current scene running; swapping scenes leaves weight, wardrobe, age, and mood unchanged and moves the pet to the new home point. Changing the device clock changes the sky in an outdoor scene and the windows, lamps, and tint in an indoor scene, with no jump at 05:00, 07:30, 12:00, 17:00, 19:00, or 21:30. At night an outdoor scene shows stars and the moon and looks as it did with the full outdoor tint. At 23:00 an indoor room still reads as night, and the pet's coat, face, eyes, and cosmetics stay distinguishable from the floor and walls. The indoor navy veil and the floor lights fade over 1.5 seconds across dusk, evening, and night, and the pet's colors stay as they are in the day. Pet luminance at the darkest indoor keyframe is at least 70% of daytime luminance. A bad `lighting.actorTint` is rejected. A scene with `time` omitted, or set to `fixed`, never changes. A window prop and a `sky` shape show the same sky as the outdoor backdrop. The blend wraps past midnight. An unknown `time` value is rejected. Advancing the clock leaves weight, mood, and age unchanged. Unit tests cover scene validation, POI lookup, action availability, the keyframe blend at 05:00, 07:30, 12:00, 17:00, 19:00, and 21:30, the wrap past midnight, and `time` validation.

**F5. Care and training (Phase 2)**

The build spec is `docs/boop-boop-care-training-brief-v2.md`. This feature replaces the earlier F5 (gesture discovery, reliability, skill fade, and the owner skill rating). Where the brief and this section differ, this section wins, and code wins over both. The trick pacing numbers here (tiers, gain, unlock days, treat economy) supersede the brief's track table and config defaults.

- R5.1 Scope. Training is a set of 0 to 100 trick tracks. Collection is the treat economy, an inventory, and milestones. Potty, messes, cleanup, house training, and the walk that replaced Go Out are not in the game. Litter boxes are not in any room (R4.14). Baths and brushing stay specified in R5.14 and are not built. All of it works offline and runs in pure logic modules with no React. Positive reinforcement only: no punishment, and no guilt copy.
- R5.2 Simulation. Open time and closed time both start from `PetState.lastUpdatedAt`, and they are different functions. A short open gap uses the live rates. A closed gap uses the away model once (R5.17). Signals, reward windows, and training outcomes only happen in the foreground. Away time produces only capped, passive outcomes (R5.17). Time of day is visual only (R4.7) and never writes pet state. "Awake time" is sim time while the pet is not in Rest, and every care timer runs on it. Pet-scoped daily limits reset on the pet-age day (`dayIndex(now, bornAt)`). User-scoped daily limits reset on the device's local calendar date.
- R5.3 Randomness and attributes. Every care and training roll consumes `pet.rngState`, with no `Math.random()`. Playdates keep their own seed and never read or advance it. Formulas read `attributeScore`. Every training gain, per rep and at mastery, goes through `trainingGain` onto stored current, so the R3.8 taper applies. Care and training never call `grantFlatAttributes`, which stays playdate-only.
- R5.4 Tracks. One engine runs every trick. A track has an id, species, prerequisites and unlock rules keyed by species (a missing key means none, or at adoption), a tier, linked attributes (one or two), and a reserved `hidden` flag with no content in v1. Unlock rules are evaluated when a prerequisite is mastered, and again on the care clock, from mastered prerequisites, `minAgeDays`, and optional minimum attributes. A new unlock plays a "New trick!" celebration (sparkles, the badge chime, and a success haptic) after any mastery badge from the same moment, and the In Training ring for that trick switches from Locked to New! and pulses. A locked trick stays in the In Training row with a Locked caption. Its hint names the first unmet condition: a prerequisite ("Keep practicing {Prereq} to unlock."), then age ("{Name} needs to grow up a little before learning this."), then an attribute ("{Name} needs to get a bit smarter first.", or "…a bit more focused first." for obedience). Hints never show days, ages, stage names, or attribute numbers.
- R5.5 Starter tracks. Tier decides pace (R5.8). Prerequisites must be mastered.

  | id | species | tier | prerequisite | unlock |
  | --- | --- | --- | --- | --- |
  | sit | dog, cat | 1 | none | at adoption |
  | speak | dog, cat | 1 | none | at adoption |
  | come_when_called | cat | 1 | none | minAgeDays 1 |
  | paw | dog, cat | 2 | sit and speak | when both are mastered |
  | lie_down | dog | 2 | sit | minAgeDays 2 |
  | roll_over | dog | 3 | lie_down | minAgeDays 5 |

  Shipped tracks are sit, speak, and paw. `come_when_called`, `lie_down`, and `roll_over` are not built. Paw is one track for both species: dogs see Paw and, once learned, Give paw; cats see High five. There is no separate high-five track. Every shipped trick links obedience. `lie_down` and `roll_over` would also link intelligence. Roll over has no intelligence gate. Old saves drop a stored `house_training` track and the `house_trained` milestone on load.
- R5.6 Buttons and reps. In Training rings are the practice buttons while a trick is unlocked and not mastered. A locked ring stays visible with a Locked caption and is not tappable. On an unlocked, unmastered track a tap is a rep. The pet performs with probability `pSuccess = clamp(0.55 + 0.003 × obedience + 0.004 × progress, 0.50, 0.97)`, and a mastered trick moves to Learned Tricks as a candy button (Sit, Give paw or High five, Speak) that plays the show-off pose with no gain. Learned Tricks does not also show a text pill for those tricks. A cat's Speak keeps the meow, and before mastery the cat sometimes ignores the cue. A failed rep plays a confused reaction, opens no reward window, consumes no treat, pays nothing, and does not count toward the daily cap. It counts as one session for R2.11.
- R5.7 Reward window. After a successful rep, a treat given within 5 seconds pays full credit (1.0 times the tier factor: basic 1.0, special 1.5). A treat from 5 to 15 seconds pays 0.5 and is still consumed. No treat by 15 seconds, or leaving the scene or screen first, resolves at 0.25. The Treat button glows during the full window and dims during the late one. A chip on the button selects basic or special for the current window and resets to basic afterward. An empty tier falls back to the other tier, and if both are empty the button shows "Out of treats, next in {time}" and the rep resolves at 0.25.
- R5.8 Rep payout and pacing. Every successful rep counts, whatever its credit.
  - **Trick progress per rep:** `baseGainPerRep(tier) × intelligenceFactor × credit × fatigueFactor`, with `intelligenceFactor = 0.8 + 0.4 × clamp(intelligence / 100, 0, 1)`. There is no age factor on tricks.
  - **Tier base gain:** 15 for tier 1, 7.5 for tier 2, 5 for tier 3. At the lowest starting intelligence on the roster (about 9) that is about 8, 16, and 24 full-credit reps to reach 100.
  - **Attributes and XP:** a full-credit rep adds `rawAttrPerRep × credit` (default 0.15) through `trainingGain`, split evenly across the linked attributes, and grants `trainingRepXp` (2, flat).
  - **Fatigue:** each track allows 8 successful reps per pet-age day. Past the cap, progress is multiplied by 0.1, there is no attribute gain or XP, and the pet plays a "had enough {Trick} today" reaction.
  - **Design rule:** no trick may need more than 3 daily caps of full-credit reps at the lowest starting intelligence. Every future trick is assigned tier 1, 2, or 3, and a config test enforces the rule.
- R5.9 Mastery. At 100 the track is mastered. Mastery grants `masteryXp` (20), `rawAttrOnMastery` (default 3.0) through `trainingGain`, a milestone, 10 basic treats and 1 special treat, and a recomputed current style (R3.6a). Mastered tricks give no further progress, attribute gain, or XP. A treat after one is a casual treat. There is no decay in v1 (`decayEnabled: false`).
- R5.10 Fatigue and vitality. R2.11 is unchanged: each rep, success or failure, counts as one session, and nothing is ever locked. The per-track cap in R5.8 is a separate, per-trick diminishing return.
- R5.11 Potty care. Removed. There is no house-training meter, no urge, no signal, no accident, no mess, no Go Out, no Litter, no Clean, and no walk that exists only to replace potty. A successful trick is the only reward window. No room shows a litter box.
- R5.14 Hygiene, baths, brushing.
  - **Hygiene:** it drains over awake time and costs a set amount per walk and per active play action in an outdoor scene. Idling outdoors costs nothing. A dirt overlay appears in two steps as hygiene falls.
  - **Dog bath:** a Bath chip appears below hygiene 40. The bath scene has lather, rinse, towel, and shake steps, and hygiene ends at 100. Happiness changes by `round(bathTolerance / 10)`. Bathing above hygiene 80 gives −5 happiness and no hygiene gain. A treat during the bath raises tolerance by 4 (cap 100) and follows the reward-treat rules.
  - **Cats:** Brush works in the current room, adds 40 hygiene, and adds `round(affection / 25)` happiness. A bath is always in the Care menu but is only prompted below hygiene 15.
  - **Tolerance:** `bathTolerance` is rolled once at adoption and stored. `bathTolerance = clamp(round(lerp(-60, 60, t)) + waterAffinity + speciesModifier, -100, 100)`, where `t` places the pet's Boldness potential within the roster's lowest and highest Boldness potential. Water affinity is a per-breed field (retriever +30, default 0), and the cat species modifier is −40. Later Boldness changes never move it.
  - **Bath Buddy:** the milestone needs a start of −20 or lower and a rise to +20 or higher.
- R5.15 Treats and inventory. Casual "Give treat" (from the inventory, or after a mastered trick) has no daily cap. It keeps the "too full" gate and counts full calories toward weight. A reward treat (training or bath window) skips the too-full gate and counts 25% of the calories. Treat sources belong to the user. Regen gives +1 basic every 20 minutes of real time and pauses while the basic stack is at 15 or more. The daily login bonus is +10 basic per local date. Each mastery or milestone gives +10 basic and +1 special. Playdates give none (R7.5). A stack is capped at 99 per tier. The inventory window has Food, Treats, Toys, Cosmetics, and Care tabs, with a Give, Use, or Equip action on each item. There are no consumable chore supplies. Everything is reachable without a purchase, and `purchaseItem()` is a stub with no store integration.
- R5.16 Weight. Every treat adds weight through the existing index (R2.13), and reward treats add 25% of the casual amount. Weight stays hidden. It is the only brake on treat spending.
- R5.17 Away time and welcome back. On return, closed time is applied once with the away model (R2.1), not the live rates. There is no happiness floor. There are no accidents or messes. Training progress does not change while the app is closed. A gap under 3 hours reopens the scene the pet was left in. A gap of 3 hours or more sets the scene to the living room, and the stage shows that room immediately with no walk home. When the gap is 12 hours or more, the greeting is "{Name} missed you!" and the pet plays one greeting reaction, then a hungry idle if tummy is under 40. If it has been more than 3 hours since the app was last opened, energy is filled to 100 after the away drift (R2.1). The +energy chip and the time-away greeting both wait until Boop payouts from that open finish, and play immediately when that open pays nothing.
- R5.18 UI. The stage shows no status bubble. In Training shows a ring for each unmastered shipped trick, including a locked Paw or High five until Sit and Speak are both mastered. An unlock celebration is "New trick!" and that ring's caption becomes New! while it pulses. Learned Tricks lists mastered tricks as candy buttons only. Gestures stay reserved for toys and Cuddle.
- R5.19 Notifications. One `NotificationScheduler` owns every local notification, including the meal and rest reminder. On a state change it computes the full desired set, then cancels everything and schedules it. Care notifications are opt-in separately: a training cap reset, and treats full. There are no potty or mess notifications. At most 3 a day across all types, in priority order: meal or rest, training reset, treats full. Quiet hours use device local time (default 21:00 to 08:00). The existing reminder keeps its own on and off setting.
- R5.20 Milestones and playdates. A mastered trick records a milestone and plays a badge celebration. Learned Tricks does not repeat that trick as a text pill next to its candy button. Bath Buddy remains specified with baths and is not built. There is no house-trained or first-walk milestone. `getMasteredTricks(pet)` is a read-only helper for playdate scripts. A trick line in a playdate still writes nothing onto the pet.
- R5.21 Discarding a pet (R1.6). It also deletes that pet's care state, training tracks, bath tolerance, milestones, seen coach marks, and its scheduled care notifications. The inventory and treat economy belong to the user and survive.

Deferred: hidden tricks (the flag only), training decay, proofing around distractions, consequences for bad habits, per-pet quirk tricks, real purchases, and server sync of care state (keep it serializable).

Acceptance: a new pet shows Sit and Speak in training and Paw or High five locked until both are mastered. Mastering the second one unlocks that trick immediately, plays "New trick!" after the mastery badge, and turns its ring into a New! practice button. Dogs label it Paw and later Give paw; cats label it High five. There is no potty signal, mess, Go Out, Litter, or Clean control. Trick credit pays 1.0, 0.5, or 0.25 by treat timing. A locked ring is not a rep, an unlocked ring is a rep, a mastered trick always performs from its candy button, and a failed rep opens no window and pays nothing. For every track, mastery takes at most 3 daily caps of full-credit reps at the lowest starting intelligence. All gains go through `trainingGain`, with no `grantFlatAttributes` call in care or training code. Bath tolerance is rolled once from Boldness potential and matches the formula in R5.14. Casual and reward treats follow R5.15, regen pauses at 15, and playdates give no treats. Reopening after 12 hours or more plays "{Name} missed you!" and a greeting reaction, does not raise happiness to a floor, and does not change training. Discarding a pet removes its care, training, milestones, and care notifications and keeps the inventory. Only `NotificationScheduler` schedules notifications, with a combined cap of 3 a day. No `Math.random()` appears in game logic, care rolls advance `pet.rngState`, and playdate RNG is untouched. Unit tests cover the gain formula, Paw unlocking only after Sit and Speak for both species, and reward-window credit.

**F6. Outfits (starter wardrobe in Phase 1; shop and share-card outfits later)**

Phase 1 equips the bundled starter wardrobe. The shop, premium grants, and share-card outfits wait until after the MVP. The simulation exposes anchors each frame. The renderer draws cosmetics from those anchors only.

- R6.1 Slots are hat, glasses, neckwear, jacket, and boots. One item per slot. Neckwear is one piece (collar, bandana, scarf, bell, bow, or none). Glasses temple arms draw before the near ear, and the lenses and bridge draw after it, then the hat. The whole pet, including worn items and a carried toy, shares one sticker outline. The ground shadow, jump dust, hearts, and sleep marks stay outside it. Boots are one unioned silhouette. Sleeves follow the hip-to-knee bone. Hats, glasses, and boots are specified in `docs/boop-boop-wardrobe-brief.md`. Neckwear, jackets, item styling, and the turn draw order are specified in `docs/boop-boop-cosmetics-v2-brief.md`.
- R6.2 The actor owns fit. Each slot has an attach point that moves and scales with breed anatomy and age. One item asset fits every breed and every point on the age scale. The app keeps no per-stage fit table and writes no offsets or scales into the item.
- R6.3 The user can equip and unequip owned items. Equipped items appear on the pet and, once cosmetics exist, on its share card. Unequip is an equip event with no item. An empty slot draws nothing. Home and the playdate outfit step share one closet. The pet sits above the items, with no mirror frame. On a wide landscape screen the preview is on the left and the choices are on the right. Each owned item is drawn on its own. Tapping an unworn item equips it and replaces that slot. Tapping the worn item clears it. "Take it all off" clears every worn slot. Continue under the preview closes the home closet. Start, or the cooldown, sits in that same place and begins the playdate.
- R6.4 Three sources. Starter items ship with the pet in Phase 1 and can be equipped then: red collar, blue bandana, yellow scarf, green beanie, red-rimmed sunglasses, orange puffer, and red boots. The rest of the catalog (bell, bow, gold collar, other hats and glasses, sweater, hoodie, raincoat, vest, rain boots, sneakers) is drawable for NPCs, and is not owned until a later purchase. Items earned through tricks and milestones, and premium items, wait until after the MVP. Ownership is a list of `{ slot, id }` separate from `equipped`, stored locally at `petty.wardrobe.${ownerId}`, and it gates every equip. An owned item can sit unequipped. Premium items are cosmetic only: they do not change attributes, skill, mastery, or any other simulation result. The MVP has no purchases and no randomized rewards. After accounts exist, that ownership list moves to Supabase per user. A playdate between two accounts replays the worn items from the record, not from either closet.
- R6.5 Each item has a fixed palette. The chosen entry is `colorId` on the equip event. A free hex value is outside this contract. The renderer reads the equipped item and its palette color from the pet.
- R6.6 The content id is the catalog id. There is no separate render key. Store product ids live in a separate map, and one product may grant several content ids. A content id is never a store product id. Content ids are permanent: they are never renamed, reused, or deleted.
- R6.7 The renderer draws an actor in a scene. It reads breed anatomy, the pose, vitality, weight, ageDays, the scene, and the equipped slots. ageDays is the calendar day count since `bornAt` (R2.7). Each frame the simulation exposes anchors: head (`x`, `y`, pitch, radius, nearEye, farEye, farEyeAlpha, top), neck, torso (theta, dy, pivot), four paws (`x`, `y`, shin angle), scale, and facing (`1` or `-1`, the horizontal sign). Eye and top points are in head space and follow `headTurn` on the side views. Cosmetics draw from per-view anchors (side, front 3/4, front, back 3/4, back). A missing view logs a dev warning and hides that item. Glasses on back and back 3/4 show the arms only. A bandana shows its triangle in front views and only a knot in back views. Glasses use both eye anchors. `classic` is a wayfarer, `square` is round gold wire, and `red-rim` is a soft square. Each lens stays translucent and carries a glare streak. At `headTurn` 1 the far lens fades in with the far eye and the bridge arches over the snout. Temple arms tuck under the near ear. Hats use `top` and widen slightly at 1 so the far ear does not poke through. In side view neckwear sits on the chin, under the near ear. In the 3/4 and front views it sits under the jaw, the face covers any overlap with the muzzle, and the tag or bandana tip hangs straight down. A bandana is a neck band plus that triangle, with a knot at the back of the neck only in side view. Mood stays a view concern only where the behavior has already turned it into pose targets. Breed is data, not a branch in the renderer. The stage label is never passed to the renderer. Stage labels are internal and are never shown to the user. The weight number is never shown either. Equipped slots are ids on the pet. The app writes no fit offsets or scales. Known gaps during Cuddle roll-over (R4.8): the torso, jacket, boots, and neckwear mirror with the body, so boots and the jacket's markings draw upside down while the pet is on its back; hats and glasses ride the head, which stays upright and only lolls, so they keep fitting. A cosmetic that cannot be fitted falls back to hidden during roll-over, and no such case exists in the starter wardrobe.
- R6.8 The cosmetics catalog is bundled data, and that bundled copy is the offline source of truth. The Phase 1 rows are the starter wardrobe. Earned and premium rows can be added later in the same catalog. One loader returns it. `schemaVersion` changes only when the structure changes. `catalogVersion` changes when items change. New cosmetics ship as data plus art. Item art ships inside the app. Remote art delivery is a separate spike. The Phase 2 toy (R4.3) is not a catalog row: it stays one inventory item on the mouth attach point. A toy that needs a new behavior is an app update.
- R6.9 Retire an item instead of removing it. A retired item cannot be newly acquired. An owner can still render and equip it. Skip an item whose slot the app does not recognize, or whose `minAppVersion` is newer than the app. Never delete a skipped item from stored data. If a pet, including a friend's snapshot, has an equipped id the app cannot resolve, render that slot empty and keep the id. The UI shows nothing broken.
- R6.10 `offer` on the catalog item says how it is offered: starter, earned, or premium. An earned item names the trick or milestone in `earnedBy`. `OwnedCosmetic.source` is how this player got the item, and it stays on the ownership list. A store product grants premium content ids only. It may grant one id or a bundle. It does not grant a starter or earned id. Product ids may differ by platform.

Acceptance: every item displays correctly on every breed at several ages from young to senior, because the attach point moved with the actor; equipping an owned item persists after restart and survives sync replay; an unowned item cannot be equipped; a premium item leaves every simulation result unchanged; the share card shows what is equipped once cosmetics exist; a retired item still renders for an owner and cannot be newly acquired; an unknown equipped id leaves that slot empty and remains in stored data; an older app skips a newer `minAppVersion` without deleting the item. A catalog check fails when ids are not unique, a retired id is reused, a slot is outside hat, glasses, neckwear, jacket, and boots, an earned item points at a missing trick or milestone, or a store product grants an unknown id or an id whose offer is not premium.

## Functional requirements: social, accounts and sync

**F7. Social and show-off (NPC playdates in Phase 2, the rest in Phase 4)**

- R7.1 Share card: an image of the pet showing its name, breed, archetype name (and "Born a Thinker, raised Athletic" when the current style differs, R3.6a), and learned tricks, with a download link. Once cosmetics exist, it also shows the equipped outfit. It does not show a life stage or senior band. It is sent through the phone's share sheet. It contains no personal details by default, such as a username or location.
- R7.2 Trick reel: a short clip, generated on the device, of the pet performing its learned tricks in sequence, shareable the same way.
- R7.3 Friends: a mutual friendship is created through an invite link or friend code and needs an account. Either side can remove a friend or block them.
- R7.4 Friend visit: read-only. The user sees a friend's pet rendered from its last stored snapshot, with its breed, look, age, attributes, and archetype, plus its tricks and trophies, and its outfit once cosmetics exist, and can leave a preset reaction. There is no live connection to the friend's device. It works from the cached snapshot when offline.
- R7.5 NPC playdates. The build spec is `docs/boop-boop-npc-playdates-brief.md`. A playdate is a scripted scene the user watches. All choices happen before it starts: a partner, a place, an activity, and an outfit. It works offline for guests, and every saved row is keyed by `ownerId`. The generator is deterministic, uses no `Math.random()`, and does not advance the pet's saved random state.
  - The owner has a cast of 10 to 12 named NPC regulars, generated once from the same breed, look, and attribute rules as adoption, with mixed ages and one to three pieces from the full wardrobe catalog. Each local day, 3 are available, seeded by `ownerId` and the date, including at least one dog and one cat. `playdate.allowCrossSpecies` defaults to true and only filters which activities are offered.
  - The user picks living room, park, or bedroom, then up to 3 activities that fit the species pair, the place, and both pets' internal age stages. A senior is never offered a race. Splash is park-only and dog-dog only. A dog-cat pair is never offered tug-of-war or splash and uses its own beat templates. The list is seeded by the date and the partner. If only one activity fits, that one is offered.
  - The next screen is the same closet as home, limited to items the user owns, opening on the everyday outfit. Start sits under the sitting pet. The outfit is stored on the playdate and worn only for that playdate. The everyday outfit is unchanged. There are no treats and no brought toys.
  - Playback is daytime. The record stores hour 14, and the player uses that hour for the sky, including on replay. Two actors follow the saved beats. While a playdate is directing them, they do not run home idle or their own fetch. Each activity has its own choreography, and beats can refer to the partner: go to them, meet halfway, run from them, or circle them, so the pets react to each other instead of wandering to separate spots. Pets cannot stand inside each other: overlapping bodies are pushed apart gradually, and pets in different rows pass in front of or behind one another. A stopped pet faces its partner. Unknown beat actions are skipped. New records are version 2. They can carry a gesture, a sound, and a rare punch or shake. Version 1 replays stay on the stored beats with the old voice cues and no camera. The user can play, skip to results, or replay. Leaving before completion saves nothing and does not start the cooldown.
  - The record stores both frozen snapshots, the place, the hour, the activity, the outfit, the seed, the beats, and the outcome. Replays read the beats and do not run the generator. History keeps the newest 3 records. Partner bond lives on the relationship, survives after a record ages out, and does not change `pet.bond`.
  - Rewards apply once, when the playdate completes or is skipped to the end: a flat happiness gain (`playdate.happinessGain`, default 12) clamped at 100, a flat add to the activity's attributes clamped at potential, a partner bond gain, and sometimes a results line that the partner showed off a trick, that the underdog won, or that the closing was a golden moment. The attributes that rise are exactly the ones the activity card lists ("Trains affection", "Trains stamina and agility"). The points are added on top of the score the pet shows, so they still count after natural growth has passed the stored score. Results show a bar for each trained attribute: the score before in the app's dark color, the gain in green right after it, and the potential as a pale bar behind. Each row also shows the new total over potential and the gain as numbers. Those figures come from the same score the home screen shows, so aging or a cap can make a gain smaller than the activity's points. A replay from history shows no bars and pays nothing. That trick line writes nothing onto the pet. Trick learning stays in F5, and a script may read the pet's mastered tricks (R5.20).
  - One playdate per `playdate.cooldownMinutes` (default 60), starting at completion. Remaining time is `max(0, last + cooldown − now)`, clamped to at most one full cooldown, so moving the device clock backward cannot extend the wait. The entry shows a live countdown. While it runs, the partner, place, activity, and outfit choices are greyed out and cannot be tapped, and Start stays disabled until the wait is over. Replaying a saved playdate still works. `skipCooldown()` is a stub; a paid skip needs server-verified time.
  - Stage names stay internal (R2.3). A partner card shows the drawn pet, name, breed, a style-and-favorite line, and a bond hint. Age still filters activities.
  - Discarding the pet deletes that pet's playdate history, relationships, and cooldown (R1.6). The NPC cast stays.
- R7.6 Safety rules apply to every social feature: no free-text chat, blocking and reporting for friends, private by default, and no public discovery of other users.

Deferred: encounters with a friend's pet, public showcases and contests. The planned friend encounter is asynchronous and still not a live session. One friend invites, the other accepts, each device already has the other's snapshot (breed, look, ageDays, attributes, archetype, name), and the device runs the encounter locally from those two actors and a shared seed. The outcome is deterministic. The server, once it exists, delivers the snapshot and the seed. It does not run the meeting.

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
- R9.2 A base set per species, recorded, not synthesized. For dogs: bark, yip, whine, growl, a happy sound and a snore, with several takes of each so they do not repeat audibly. Cats get their own set. Phase 1 can ship a smaller bundled set (Speak bark and meow, Cuddle `cuddle_happy`, `cuddle_purr`, and `cuddle_pant`, and later chew and snore) and stay silent for any clip that is not in the repo yet.
- R9.3 Each breed has a pitch multiplier applied through playback rate, with small breeds higher and large breeds lower, kept within a modest range. Each playback adds a few percent of random variation in pitch and volume.
- R9.4 Maturity, vitality, mood and personality modify the sound: pitch falls smoothly as maturity rises, so puppies sound higher; excited sounds are faster, sleepy sounds softer, and bold pets louder; low vitality gives slower, softer sounds.
- R9.5 The "speak" trick performs on cue once mastered. Before mastery a failed attempt gives a confused reaction and a funny squeak.
- R9.6 The behavior module names the sound. The renderer plays the matching clip so it lines up with the pose. Playback rate is the breed pitch times the age factor, with pitch correction off, so a young pet of a small breed sounds higher. Playback respects the hardware silent switch. Sounds do not continue after the app backgrounds.
- R9.7 UI sounds and one or two calm music loops. Music is quiet by default, easy to mute, respects the phone's silent mode, and has a haptic or on-screen fallback.
- R9.8 Audio ships inside the app, compressed, with a license log recording each asset's source and license.
- R9.9 Silent-mode hint. iOS does not let an app read the hardware silent switch, so the app does not try to detect it. Pet sounds stay on by default. The first time the user taps Speak (the training ring or a mastered trick) or Pet sounds, and only on iOS, a sheet appears over the home screen. Title: "Can't hear anything?". Body: "If your iPhone is on silent, sounds are off. Turn off silent mode to hear them." Button: "Got it". The tap still plays or toggles sound; the sheet does not wait for an answer. It shows once. Dismissing it stores `petty.hasSeenSilentModeHint`. Android never shows it. The sheet uses the same modal as the cuddle help sheet.

Acceptance: two breeds sound audibly different; no sound plays in silent mode; every audio file has a license log entry; the first Speak or Pet sounds tap on iOS shows the silent-mode sheet once and still plays the sound, and a later tap or an Android tap does not show it.

**F10. Safety and compliance (gates Phases 1, 4 and 5)**

- R10.1 The terms say 13+, the age gate enforces it, and the store age rating matches. Marketing and design must agree with 13+. The consent screen itself does not add an explanation beyond the Yes or No question.
- R10.2 Apple's Declared Age Range API and Google's Play Age Signals API are requested on launch and when the app returns to the foreground. If a store reports an age under 13, treat the user as under 13. A missing, declined, or failed signal does not raise an age band. Purchases, when they exist, require an adult result from a store signal.
- R10.3 If a store signal later moves a 13+ anonymous user under 13, the app shows Not Available, drops unsent consent records, and calls `delete_my_guest_data()` to remove that anonymous user. Offline, it retries until the delete succeeds. Account screens and deletion for a permanent account are still later work.
- R10.4 Private by default, friendships by mutual acceptance only, no public discovery of users, and no free-text chat. Pet names and display names use the same client validator as R1.4 (`src/adopt/name.ts`) so they meet the Community Guidelines name rules; when accounts and friends ship, the server must enforce the same checks.
- R10.5 Minimal data collection, no targeted advertising to minors, no streak or guilt mechanics, and no randomized rewards.
- R10.6 A privacy policy, terms of service, community guidelines, and a support page, plus in-app account and data deletion, and blocking and reporting. The public pages are markdown in `site/compliance-docs/`, built to static HTML, and served at `https://boopboop.mylisto.app` on `/privacypolicy`, `/termsofservice`, `/communityguidelines`, `/support`, and `/delete-account`. That host is a second Vercel project with root directory `site/`. It does not replace `mylisto.app`. Store listings and in-app links use these URLs. The privacy, terms, community guidelines, and deletion drafts still have bracketed placeholders, and the support page is still a placeholder, until R10.7 is done.
- R10.7 Before release: a privacy attorney consult, a fresh check of the state app-store age laws, a trademark check on the app name, and a written rights assignment from the illustrator. Fill the privacy-policy placeholders before the URL is treated as final.

Acceptance: an under-13 result cannot continue and cannot create an anonymous user or a consent row; a later store signal of under 13 deletes that anonymous user's server rows; the store listing, terms and marketing all state 13+; a deletion request for a permanent account removes all of that user's server data.

## Data model

These are working types for the simulation and storage layers. Field names can change, but keep the separation between fixed configuration (breeds, tricks, NPC pets, outfits) and per-pet state.

```ts
type Trait = 'stamina' | 'agility' | 'intelligence' | 'boldness' | 'affection' | 'obedience';
type Stats = Record<Trait, number>;
type Archetype = 'athlete' | 'thinker' | 'charmer';
// Per-pet cosmetic look chosen at adoption. Not an outfit item (F6). Ears apply to dogs only.
// pattern and accent are optional. Omitted means the breed's own pattern. stripes darkens the
// coat in bands; points puts the accent on ears, legs, tail, and muzzle; none is a solid coat.
type Look = {
  coat: string;
  ear: string;
  tail: string;
  pattern?: 'stripes' | 'points' | 'none';
  accent?: string;
};
// Internal labels derived from maturity and vitality, never stored as the source of truth,
// and never shown in the product UI
type Stage = 'puppy' | 'olderPuppy' | 'adolescent' | 'adult' | 'senior';
type SeniorBand = 'earlySenior' | 'senior' | 'elderly';
type OutfitSlot = 'hat' | 'glasses' | 'neckwear' | 'jacket' | 'boots';
type EquippedItem = { itemId: string; colorId?: string };

type Pet = {
  id: string;              // UUID created on the device at adoption
  rngState: number;        // seeded generator state
  name: string;
  breedId: string;
  bornAt: number;          // ms timestamp. Source of ageDays.
  ageDays: number;         // calendar days since bornAt, including open time and the full closed gap. Source of maturity and of the visual curves.
  maturity: number;        // derived, min(1, ageDays / daysToSenior). Cache only.
  vitality: number;        // 0 to 1, care-driven, can rise and fall, drives aging cues
  careWindow: CareSample[]; // rolling recent care used to set the vitality target
  weight: number;          // index from -1 to 1. 0 is the start. Never shown.
  weightAppliedAt: number; // ms timestamp of the last weight settle. Open time thins at 0.12/day. Closed time uses the 24-hour grace and 96-hour half-life (R2.13).
  lastUpdatedAt: number;   // ms timestamp the simulation has been applied through. Open gaps use the live rates. Closed gaps use the away model, capped at 30 days (R2.1).
  sceneId: string;         // current scene. A closed gap under 3 hours keeps it. 3 hours or more opens the living room. Changing it while playing is not a stat change.
  needs: { hunger: number; energy: number; happiness: number };
  hydration: number;       // 0 to 100. 100 is fully hydrated. Not part of the away model.
  waterLevel: number;      // home water bowl 0 to 1. Three drinks from full empty it.
  waterEmptySince: number | null; // when the bowl hit empty. Does not change mood.
  toys: string[];          // owned toy kind ids; scene items are ephemeral
  furniture: {             // owned furniture (R4.14). A piece with no placement is not in a room.
    id: string;
    kind: 'bowl' | 'bed' | 'catTree' | 'planter' | 'catioPost';
    contents?: string;
    color?: string;
    w?: number;
    h?: number;
    plant?: 'catgrass' | 'flowers' | 'catnip';
    scale?: number;
    layer?: 'back' | 'sorted' | 'front';
  }[];
  furniturePlaced: { pieceId: string; sceneId: string; x: number; y: number }[];
  treats: { treatId: string; count: number }[]; // Phase 2 moves the stacks to OwnerProfile.inventory (migration needed)
  boosts: { attribute: string; multiplier: number; startAt: number; endAt: number }[];
  asleep: boolean;
  look: Look;              // coat style (color, optional pattern and accent), ears, and tail picked at adoption. Overrides the breed's default look.
  attributes: {
    seed: number;          // generated once at adoption and persisted before the sets are shown. Never shown.
    rulesVersion: number;  // for debugging and migrations
    archetype: Archetype;  // which of the three offered sets was picked
    potential: Stats;      // fixed ceilings, stored. Never recomputed from the seed after adoption.
    current: Stats;        // stored base score. Starts at 20% of potential (min 1). Clamped to potential on every write.
  };
  drift: Stats;            // slow shift from care patterns
  seniorBand?: SeniorBand; // hysteresis cache, not the source of truth
  level: number;
  xp: number;
  bond: number;
  care: PetCareState;      // F5: hygiene, bath tolerance, trick reward window, unclaimed treats
  training: Record<string, TrainingTrack>;
  milestones: string[];
  seenCoachMarks: string[];
  equipped: Partial<Record<OutfitSlot, EquippedItem>>;
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

// Derived, not stored. Does not read rngState or event history.
const attributeScore = (pet: Pet, trait: Trait): number => { /* (max(attributes.current, natural growth) + drift + effects), times aging modifier, times weight modifier for stamina and agility, capped at attributes.potential[trait] */ };

type TrainingTrack = {
  id: string;              // 'sit', 'speak', 'paw', ...
  progress: number;        // 0 to 100
  unlocked: boolean;
  mastered: boolean;
  repsToday: number;       // successful reps on the pet-age day below
  repsPetDay: number;
  pendingPenalty: boolean; // unused; kept on the track so older saves still load
  lastPracticedAt: number | null;
};

// Fixed configuration, not per-pet state
type TrackDef = {
  id: string;
  species: ('dog' | 'cat')[];
  tier?: 1 | 2 | 3;        // tricks: sets baseGainPerRep (15, 7.5, 5)
  hideWhenMastered: boolean;
  prerequisites: Partial<Record<'dog' | 'cat', string[]>>;  // missing key = none
  unlock: Partial<Record<'dog' | 'cat', { minAgeDays?: number; minAttributes?: Partial<Record<Trait, number>> }>>;  // missing key = at adoption
  linkedAttributes: Trait[];  // one or two
  hidden?: boolean;           // reserved, no content in v1
};

type PetCareState = {
  hygiene: number;               // 0 to 100
  lastBathAt: number | null;
  lastBrushAt: number | null;
  bathTolerance: number;         // -100 to 100, rolled once at adoption
  bathToleranceStart: number;    // for the Bath Buddy milestone
  pendingReward: { trackId: string; openedAt: number } | null;
  unclaimed: { basic: number; special: number };
  recentScenes: string[];
};

type BreedAnatomy = {
  bodyLen: number;
  bodyH: number;
  legLen: number;
  head: number;
  snout: number;
  earSize: number;
  earType: string;         // silhouette ear class from breed data (not a Look field)
  tailType: string;        // silhouette tail class from breed data (not a Look field)
  coat: string;
  earColor: string;
  muzzle: string;
  size?: number;
  eyeColor?: string;
  pattern?: string;
  accent?: string;
  patterns: string[];      // Look patterns this breed allows (none, stripes, points, bicolor)
  markings: unknown[];     // named color regions; locked regions ignore the user coat
};

type BreedConfig = {
  id: string;
  name: string;
  species: 'dog' | 'cat';
  anatomy: BreedAnatomy;  // proportions live here. The engine does not hardcode a species body.
  behaviors: string[];     // species tasks added on top of the shared list
  attributeRanges: Record<Trait, [number, number]>; // potential min and max per attribute. Tuning data, never hardcoded in logic.
  blurb: string;           // one-line personality shown on the breed card
  pitchMultiplier: number; // for audio playback rate
  sampleSet: string;       // audio set id
};

// Shared tasks, not stored per breed: stand, sit, sleep, eat, drink, walk, jump, idle.
// Dog behaviors: pant, paw, bark, fetch. Cat behaviors: purr, groom, pounce.
// Pant and purr are in the species lists so the idle machine can enter them. No event starts them.

type Pose = {
  sit: number;
  lie: number;
  walk: number;
  paw: number;
  pant: number;
  headDown: number;
  headRest: number;
  headTurn: number;        // 0 = side head, 1 = 3/4 toward camera. Set by the state machine only.
  eyes: number;
  wagAmp: number;
  breathAmp: number;
  breathRate: number;
  squint: number;
  spineArch: number;       // reserved. Phase 1 behaviors leave this at 0 unless a reference uses it.
  crouch: number;          // reserved, same rule as spineArch.
};

// Runtime body. A friend, an NPC, or a second pet is another entry. Not the saved record.
type Actor = {
  id: string;
  breedId: string;
  x: number;
  y: number;               // depth on the scene floor
  z: number;               // jump or hop height. Gravity writes this.
  face: 1 | -1;
  pose: Pose;
  task: string;
  ageDays: number;
  weight: number;          // -1 to 1
  vitality: number;
  equipped: Partial<Record<OutfitSlot, EquippedItem>>;
  look: Look;
  attributes: Stats;
  archetype: Archetype;
};

// Exposed each frame. The renderer draws cosmetics from these only.
// nearEye, farEye, and top are in head space and follow headTurn (R4.5, R6.7).
type Anchors = {
  head: {
    x: number;
    y: number;
    pitch: number;
    radius: number;
    nearEye: { x: number; y: number };
    farEye: { x: number; y: number };
    farEyeAlpha: number;
    top: { x: number; y: number };
  };
  neck: { x: number; y: number };
  torso: { theta: number; dy: number; pivot: { x: number; y: number } };
  paws: { x: number; y: number; shin: number }[]; // four
  scale: number;
  facing: 1 | -1;
};

type SceneTime = 'outdoor' | 'indoor' | 'fixed';

// Known prop kinds: shape, bowl, bed, rug, couch, window, lamp, tree, bench, pond, bush, fence.
// Shape types: rect, ellipse, circle, poly, line, sky. A later image shape is allowed.
type Shape = {
  t: 'rect' | 'ellipse' | 'circle' | 'poly' | 'line' | 'sky';
  fill?: string;
  stroke?: string;
  lw?: number;
  alpha?: number;
  // plus the shape's own fields (x, y, w, h, r, pts, etc.)
};

type Prop = {
  kind: string;
  id?: string;             // stable id on furniture, linking the prop to its point of interest
  x: number;
  y: number;               // baseline. sorted props depth-sort against pets and the ball by y.
  layer?: 'back' | 'sorted' | 'front';
  scale?: number;
  glow?: boolean;          // lamp: omitted fades in with dark; true/false forces it.
  shapes?: Shape[];        // generic shape prop: list in prop-local coordinates.
  [param: string]: unknown;
};

type Poi = {
  id: string;
  type: string;            // food, water, bed, home, or a later affordance type
  x: number;
  y: number;
  face?: 1 | -1;           // tie-break facing at food/water when the pet starts level with the bowl
  propId?: string;         // furniture prop this spot follows when the player moves it
};

// Scene data. compileScene rejects an unknown prop kind by naming the field.
// An unknown schema version (v) skips the scene and keeps the pet in its current one.
// An unknown time value rejects with: "time" must be outdoor, indoor or fixed.
// Stage canvas is 640×680. On a stacked layout a wide window extends sky and floor past that width and does not grow the height. In a landscape split the scene pane does the same inside the leftover width and may use the full pane height. Adoption preview uses the top 340 (`previewStageHeight`).
type Scene = {
  v: 1;
  id: string;
  name: string;
  time: SceneTime;         // omitted on load means 'fixed'
  sky: [string, string];   // fallback top and bottom. outdoor backdrops and sky shapes use the clock.
  layers: Shape[];         // back decoration in canvas coordinates
  floor: {
    horizon: number;       // wall/floor seam; keep near ~190 when extending stage height
    yMin: number;
    yMax: number;          // front of walkable band; presets use ~654 on the tall stage
    xMin: number;
    xMax: number;
    color: [string, string];
    pattern: 'lines' | 'planks' | 'grass' | 'none';
    lineColor?: string;
  };
  surface: { bounce: number; friction: number }; // ball behavior; defaults 0.55 / 1.8
  props: Prop[];
  pois: Poi[];
  lighting: { actorTint: number }; // 0 to 1. Omitted on load uses 0.35 indoor, 0.85 outdoor, 0 fixed.
  ambient?: {
    tint?: string;
    particles?: { kind: 'rain' | 'snow' | 'leaves'; count?: number; color?: string };
  };
};

// New POI types with new actions go through this registry, not hardcoded task-machine branches.
type Affordance = {
  poiType: string;
  action: string;          // e.g. 'water' -> 'drink'
  approach: 'mouth' | 'body';
  pose: Partial<Pose>;
  durationSec: number;
  effects?: { weight?: number; mood?: number };
};

// View only. Not stored on the pet and not an input to the simulation.
type TimeOfDay = {
  hour: number;            // device local hour, 0 to 24
  phase: 'Night' | 'Dawn' | 'Morning' | 'Afternoon' | 'Dusk' | 'Evening';
  top: string;
  bot: string;
  tint: string;            // outdoor overlay. Applied in full to scenery, and times actorTint for pets and the ball.
  inTint: string;          // indoor overlay. Alpha is capped at 0.35. The blue channels stay.
  dark: number;            // 0 to 1. Drives stars, moon, lamp glow, the indoor floor light, and window clouds.
};

// What a device needs to render someone else's pet and run an encounter. No live state.
type PetSnapshot = {
  breedId: string;
  ageDays: number;
  weight: number;
  vitality: number;
  equipped: Partial<Record<OutfitSlot, EquippedItem>>;
  look: Look;
  attributes: Stats;
  archetype: Archetype;
  name: string;
};

// How a catalog item is offered. OwnedCosmetic.source is how this player got it.
type ItemSource = 'starter' | 'earned' | 'premium';

// Bundled cosmetics catalog. The offline source of truth. Toys are not rows (R4.3).
type Catalog = {
  schemaVersion: number;   // bump only when the structure changes
  catalogVersion: number;  // bump whenever items change
  items: CosmeticDef[];
};

type CosmeticDef = {
  id: string;              // permanent content id
  slot: OutfitSlot;
  name: string;
  species: 'dog' | 'cat' | 'both';
  offer: ItemSource;
  earnedBy?: string;       // trick or milestone id when offer is 'earned'
  palette: { id: string; hex: string }[];
  status: 'active' | 'retired';
  minAppVersion?: string;  // older apps skip the item
  sortOrder: number;
};

// Separate from content ids. Unused until purchases exist.
type StoreProductGrant = {
  platform: 'ios' | 'android';
  productId: string;       // permanent store id
  grants: string[];        // premium content ids; one product may grant a bundle
};

type OwnedCosmetic = {
  itemId: string;          // content id
  source: ItemSource;      // how this player got it, kept apart from Pet.equipped
};

type NpcPet = {
  id: string;
  name: string;
  breedId: string;
  stats: Stats;
  archetype: Archetype;
  quirks: string[];
};

type OwnerProfile = {
  inventory: { itemId: string; qty: number }[]; // treats and other items. User-scoped, survives a discarded pet.
  lastTreatRegenAt: number;
  lastDailyBonusLocalDate: string | null;
  npcFriendship: Record<string, number>;
  ownedCosmetics: OwnedCosmetic[]; // separate from Pet.equipped; a guest stores the same list locally
};

type PetEvent =
  | { type: 'feed'; at: number }
  | { type: 'drink'; at: number }
  | { type: 'toggleRest'; at: number }
  | { type: 'pet'; at: number }
  | { type: 'fetch'; at: number; throwPower: number }
  | { type: 'giveToy'; at: number; toyId: string }
  | { type: 'trickRep'; at: number; trackId: string }
  | { type: 'rewardTreat'; at: number; tier: 'basic' | 'special' }
  | { type: 'cleanMess'; at: number; messId: string }
  | { type: 'bath'; at: number }
  | { type: 'brush'; at: number }
  | { type: 'equip'; at: number; slot: OutfitSlot; itemId: string | null; colorId?: string }
  | { type: 'npcPlaydate'; at: number; npcId: string };
```

**Backend tables (Phase 4)**

| Table | Holds | Access |
| --- | --- | --- |
| pets | The latest synced pet state, keyed by the pet UUID | Owner only, plus a read-only snapshot view for mutual friends |
| pet\_events | An append-only log of the events above, used for replay and sync | Owner only |
| owner\_profiles | Inventory, treat economy and NPC friendship | Owner only |
| friendships | Mutual friend links with a status, created by invite link or code | Both users |
| reactions | Preset reactions left on a friend's pet | Both users |
| blocks | Blocked users | Owner only, and it overrides friend access |

## Architecture rules and non-functional requirements

**Architecture rules**

1. The simulation is pure TypeScript with no React, no I/O, no `Date.now()` and no `Math.random()`. Time comes in as elapsed milliseconds, and randomness comes from a seeded generator whose state is stored with the pet. The device clock is read only by the time-of-day view (R4.7). That view does not write pet state.
2. The user interface never edits pet state directly. It sends an event to the simulation and renders what comes back.
3. The world simulation owns a list of actors and steps every actor from one capped timestep. The scene is its own data layer. Props, points of interest, and the ball are not actors. Logic modules are plain TypeScript and do not import Skia: breeds, growth curves, geometry, pose, legs, behavior, scenes, and sim. The renderer is the only module that draws. It holds no game rules. Each frame the simulation exposes anchors, and the renderer draws the starter wardrobe from those anchors only (F6). Breed anatomy, the species behavior list, scenes, and the wardrobe come from config. The stage label is never passed to the renderer. Stage labels are internal and are never shown to the user. The weight number is never shown either. Equipped slots are ids on the pet. The app writes no fit offsets or scales. A friend or NPC encounter builds actors with `spawnActor(snapshot)` inside a world created from its own seed.
4. All storage sits behind an interface. Local storage is the first implementation and the backend is the second.
5. Tunable numbers live in config files, including sit angle, stride, head targets, pose rates, the age curves, the weight rates, and the time-of-day keyframes. Breeds, tricks, NPC pets, scenes, and outfits are data, so adding one is a config entry and not new code. A scene compiler rejects an unknown prop kind by naming the field, rejects an unknown `time` value, rejects a bad `lighting.actorTint`, and skips a scene whose schema version it does not know. A bad downloaded scene pack fails the same validation and must never crash the app. Nothing outside scene data names a scene. New scenes use existing prop kinds and POI types with no code; a new prop kind is one draw registration; a new POI type with a new action goes through the affordance registry (R4.6).
6. The simulation decides what happens and the view only animates it.
7. The same simulation module runs in the app and in the server's functions, so the server can replay events and reach the same state.
8. Events are the source of truth for sync, and state is derived from them.
9. Trick sequences are checked through a validator interface, so the check can later move to the server.
10. Time is computed lazily from timestamps. There is no per-pet server tick and no background timer for the simulation.
11. Potential and any other value derived from the seed is computed from the seed, species, breed, and archetype with its own deterministic hash, so it never depends on the order of events or on the pet's random state.

**Non-functional requirements**

- Offline: the core loop of care, play and training works with no connection at all.
- Performance: animation stays smooth on mid-range phones, and screens open without waiting on the network.
- Size: audio is compressed and loops are short. Core art and sound are bundled, and optional extras can be hosted remotely so new breeds ship without an app update.
- Accessibility: the 5-second reward window (R5.7) is tap-only and never required for progress, so a reduced-motion or slower-input option should widen it, no meaning carried by color alone, and haptic or on-screen fallbacks for sound. Every action button has an `accessibilityLabel` equal to its label and a touch target of at least 44 by 44. Cuddle is the exception to haptic fallbacks: it sends no haptics.
- Privacy: collect the minimum, keep analytics free of personal data, and support deletion. The public policy is the page at `https://boopboop.mylisto.app/privacypolicy`.
- Testing: every simulation feature ships with unit tests for determinism, bounds and thresholds, and the same seed, species, breed and archetype must always give the same potentials. Scene tests cover validation, POI lookup, and action availability. Time-of-day tests cover the keyframe blend at phase boundaries, the wrap past midnight, and `time` validation. Cuddle tests cover gesture classification, the `headTurn` guard (never 1 while moving), the no-snap pose blend, the roll-over and exit sequence for every breed and life stage, tooltip seen-state, and the icon map covering every action id.
- Observability: crash reporting, and analytics events for the success metrics, with no personal data.
- Code quality: TypeScript in strict mode, small files, and one commit per task.

## Decisions and open questions

Treat decided items as fixed. For open items, build the proposed default behind configuration and do not spend effort polishing them.

**Decided**

| Topic | Decision |
| --- | --- |
| Platform | Expo / React Native with TypeScript, iOS and Android |
| Camera | Eight octants and five views, 2D. Idle settles on a side body, then the head turns to a 3/4 view; see R4.5. |
| Species in the MVP | Dog and cat. The user picks a species and a breed on the design screen. Phase 1 ships five dog breeds (Retriever, Corgi, Dachshund, Husky, Pug) and five cat breeds (Domestic Shorthair, Siamese, Persian, Maine Coon, Scottish Fold). Anatomy lives in `src/actor/breeds.ts` and `src/actor/data/breedShapes.ts` (ids `domesticShorthair` and `scottishFold`; old `tabby`, `domesticshorthair`, `mainecoon`, `bombay` and `black` ids migrate on load). The extra behavior list lives on the breed. |
| Age gate | Store age signal first, then a Yes or No to "Are you at least 13 years old?" No birthdate. The more restrictive result wins. Under 13 stays on the device only. A 13+ confirmation accepts the current terms and can sync consent records under an anonymous id. |
| Adoption | Four steps with a 4-dot indicator: (1) design (species toggle, sticky live preview, coat color and breed-allowed pattern variants, eye color for cats, horizontal breed list with potential ranges and numbers; ears and tail come from the breed), (2) choose one of three pups or kittens (athlete, thinker, charmer) from one seed, all visible with exact potentials, strong attributes and +N deltas, (3) name (validated 1–16 characters per R1.4 / `validateName`; no suggestion chips; "Meet {name}" creates the pet), (4) meet intro with current and potential bars, then "Start playing". Back from choose or name keeps the seed, selection and typed name. The meet intro is same-session only. The pet stores the seed, a rules version, the archetype, the look, and the resulting potential and current. The other two sets are not saved. |
| Attributes | Six visible attributes, each with a visible current score and a visible per-pet maximum potential. Each breed has a min to max potential range per attribute, as data. Potential is deterministic from the seed, species, breed and archetype, then stored and never recomputed. The total is 375 plus or minus 10 per pet, equal across the three offered sets. The seed is never shown. |
| Aging model | Two continuous values, maturity (only up) and vitality (care-driven, reversible), with five internal stage labels (puppy, older puppy, adolescent, adult, senior) and senior bands. No stage-change transition and no separate art per stage. |
| Maturity clock | ageDays is calendar time since `bornAt`. It moves while the app is open and for the full closed gap. There is no 48-hour cap and no one-boundary clamp on age. Stage days stay 7, 21, 45, and 180. Closed-time needs use the 30-day away model. The 48-hour cap is only a guard on the live step loop. A saved `ageDays` sets `bornAt` so an existing pet does not become a newborn. |
| Care and maturity | Full rate until the care window exists. After that, poor care can slow maturity toward a floor around half speed. Neglect does not stop aging. |
| Stage labels | Internal only. They set level ceilings and learning speed. They are never shown in the UI, notifications, or share card. |
| Aging art | One continuous actor driven by ageDays curves, vitality, and weight. The visual lifespan is 1000 calendar days. Curves clamp there. Senior still begins at day 180, and ageDays keeps climbing after maturity reaches 1. Under-eye bags run from about day 600 to 800 and fade when vitality is high. A stage change does not swap the drawing. On the floor, the pet draws smaller toward the back of the scene. The weight number is never shown. |
| Weight | An index from -1 to 1, starting at 0. The healthy band is -0.25 to 0.25. While the app is open, hunger subtracts 0.12 per day. While it is closed, weight is unchanged for 24 hours, then approaches -1 with a 96-hour half-life and never reaches that floor from closed time alone. A meal adds 0.12. Running above speed 80 burns 0.003 per second. Thickness, belly, leg width, ribs, and up to 22% slower movement come from the index. Effective stamina and agility drop as the index leaves the healthy band. A saved weight outside -1 to 1 maps with `(weight - 50) / 50`. |
| Death | None. The pet never dies. |
| Growth model | Pokémon-style stats, levels and growth only. No battles, trading or collecting many pets. |
| Audio | Recorded animal sounds only, with pitch from breed and age. No synthesized bark or meow. Phase 1 ships Speak clips (`bark`, `meow`) plus Cuddle clips (`cuddle_purr`, `cuddle_happy`, `cuddle_pant`) in `src/audio/voice.ts`. A sound with no clip stays silent. Boop, flinch, swat, and shake-off have no Cuddle clip. Pet sounds are on by default. The first Speak or Pet sounds tap on iOS shows a one-time silent-mode sheet and does not delay the sound. Android does not show it. See R9.9. |
| Offline | The core game must work offline |
| Accounts | Guest-first, with an account later and no friction at the start |
| Social | Share card, read-only friend visits and NPC playdates in the MVP. A visit or a later friend encounter renders the other pet from a stored snapshot and runs locally from a seed. There is no live sync. Friend encounters themselves wait until after the MVP. |
| NPC playdates | Phase 2, offline, and available to guests. The flow is partner, then place (living room, park, or bedroom), then activity, then a playdate outfit from the starter wardrobe. Playback is a saved beat timeline at hour 14. Happiness is a flat gain. Attribute points are a flat add capped at potential, with no training taper and no level XP. Partner bond is separate from `pet.bond`. History keeps the newest 3. The cooldown is `playdate.cooldownMinutes` (default 60) and never shows more than one full wait if the clock moves backward. See R7.5. |
| Drawing | Procedural Skia actor. The HTML references are ported. Logic modules do not import Skia. The pet is flat vector with one sticker outline around the whole silhouette and a soft cel shadow and highlight on each body part (`src/actor/data/petStyle.ts`). Chibi proportion multipliers exist and stay off until checked. Pose keeps spineArch, crouch, and a z jump even where Phase 1 leaves them idle. |
| Behaviors | One task machine. Shared tasks: stand, sit, sleep, eat, drink, walk, jump, and idle (including zoomies). Dogs add pant, give paw, bark, and fetch (bow, chase, return, carry, shake, chew). Cats add purr, groom, and pounce (stalk, wiggle, bat, roll, tangle). Pant and purr are never user actions. Home controls are Feed, Water, Treat, Sleep, Cuddle, Play, and Playdate, plus Wardrobe, Storage, Traits, Sounds, and Music. Feed and Treat open a Pantry card. Play opens a toy card. A tap on empty floor soft-drops a ball from high `z`; a flick throws. Leaving a toy out does not pay mood. Continuous movement of the toy for 3 seconds pays +3, and so do 5 taps or throws. Tummy and energy both have to be at least 30. The movement clock clears when the toy stops. A tap on a bowl or the bed runs that care action, and holding a prop offers Put in storage or Move. See docs/boop-boop-home-ui.md and R4.8. Ball bounce is scene surface × kind 1.5. Toys use an item registry with play-rule `allows` (ball live in UI; frisbee, yarn, squeaky engine-ready). Locomotion: four gaits with hysteresis blend, speed variety, jumps with ground shadow, and life-stage / attribute / weight modifiers (`src/actor/data/locomotion.ts`). Scenes are data on a 640×680 stage (preview crops to 340 tall; a stacked wide window extends the backdrop sideways and does not grow the height; a landscape split gives that pane the leftover width and the full pane height): living room, bedroom, park, and catio (cats only). Home picks among them from Where to?. Feed needs a food POI; refill needs a water bowl that is not full; rest always works and walks to a bed when one exists. Props are visual only except through POIs (optional `hurdle` for hop-over). See R4.2, R4.5, R4.6 and the items/treats addendum. The home park may also hold up to two visiting animals who wander in and may greet the pet (R4.6a, docs/park-visitors.md). |
| Time of day | A view concern driven by the device's local hour. Scenes opt in with `outdoor`, `indoor`, or `fixed`. Omitted means `fixed`. Outdoor draws sky, sun, moon, and stars. Indoor draws lamp glow and windows of the same sky. Outdoor scenery takes the full tint and outdoor pets take `lighting.actorTint` 0.85 of it. Indoor rooms keep their color under a navy veil at 0.18 alpha. The pet is not tinted. Lamp, pumpkin, and moonlight pools sit above the veil, and a warm floor light fades in with `dark`. The pet stays readable indoors at night. It does not change weight, mood, or age. Painted backgrounds keep the sky as its own layer. The demo hour slider does not ship. See R4.7. |
| Cosmetics | Phase 1 wears the bundled starter wardrobe, one item per slot: hat, glasses, neckwear, jacket, and boots. The shop, premium grants, and share-card outfits wait until after the MVP. Fit belongs to the actor, and the renderer draws from the frame's anchors. The bundled catalog is the offline source of truth, with permanent content ids. Ownership is a separate list and gates every equip. Sources are starter, earned, and premium. Premium is cosmetic-only. Content ids are separate from store product ids, and a product grants premium ids only. Each catalog item has its own colors. See F6 and `docs/boop-boop-wardrobe-brief.md`. |
| Cuddle mode | A toggle action that sends the pet to its home spot, settles it, and turns the head 3/4 to the camera. Gestures are stroke, scratch, and boop with a trail and hearts as feedback, and a flinch for a too-fast swipe. Dogs escalate to a roll-over and belly rub, cats to kneading and a rare belly-up trap. A 3-second gesture streak pays +5 mood, or +10 during a belly rub. A pet leaves on its tolerance with a shake-off (dog) or tail flick and swat (cat). Content moments play `cuddle_purr` (cat), `cuddle_happy` (dog stroke and scratch), or `cuddle_pant` (dog belly rub). First entry shows one tooltip, and a help sheet stays reachable. No haptics. All numbers are data. See R4.8 to R4.12. |
| Action icons | One `lucide-react-native` outline set for every action button and settings toggle, from a single `actionId -> iconName` map, Care, Bond, and Style & sound use glossy pink, blue, and lilac controls. Sounds and Music are switches. Labels are accessible and targets are at least 44 by 44. See R4.13. |
| Compliance pages | Markdown in `site/compliance-docs/`, built with `node build.mjs` to static HTML. Public URLs are `https://boopboop.mylisto.app/privacypolicy`, `/termsofservice`, `/communityguidelines`, `/support`, and `/delete-account`. Hosted as its own Vercel project from this repo (root `site/`). `mylisto.app` stays the other app. A later domain change keeps redirects on these URLs. See R10.6. |
| Care and training | F5 replaces gesture discovery. Shipped tricks are Sit, Speak, and Paw (High five for cats). Paw unlocks when Sit and Speak are both mastered, with a New trick! celebration. Mastered tricks are candy buttons in Learned Tricks, without a second text pill. Potty, messes, and house training are out. There is no skill fade in v1 and no owner skill rating. See R5.1 to R5.21. |
| Trick pacing | Three tiers set pace: 15, 7.5 and 5 base gain, about 8, 16 and 24 full-credit reps at the lowest starting intelligence. No trick may need more than 3 daily caps of reps (cap 8 per track per pet-age day). No age factor on tricks. See R5.8. |
| Treat economy | User-scoped inventory. Regen +1 basic per 20 minutes, paused at 15. Login bonus +10. Mastery gives +10 basic and +1 special. There is no daily treat cap. Reward treats skip the hunger gate and count 25% calories. Playdates give none. |
| Time and care | Time of day never writes pet state (R4.7). Care timers run on awake time and pause in Rest. Nothing succeeds or fails while the app is closed. |

**Open**

| Question | Current default |
| --- | --- |
| Core audience: kids, nostalgic adults, teens or cozy-game players | Open. The working plan is 13+. |
| Pet exchange or restart | Not in the MVP. Revisit once attachment is visible. |
| Real days per life stage | Decided. Calendar days since `bornAt`: puppy 0 to 7, older puppy 7 to 21, adolescent 21 to 45, adult 45 to 180, senior after 180. Visual curves continue to day 1000 (R2.7). |
| Senior rejuvenation limit | Proposed: capped by maturity, so a senior can look spry but never like a puppy (R2.10) |
| How diet and exercise are measured | Proposed: a small set of food types plus exercise from fetch and play (R2.12). Needs a decision before Phase 2. |
| What training changes besides mastery and attributes | Attribute gains are specified in R3.8 and R5.8. Bond, trophies, and the journal remain TBD. |
| Final attribute list, and whether to add instinct | Six attributes in R3.1. Instinct (nose) is not in the MVP. |
| Score scale and the puppy starting fraction | Decided: whole numbers on the breed range scale (about 10 to 100), starting at 20% of potential (R3.3). All tunable in config. |
| Whether same-breed pets share a total potential budget | Decided: the three sets offered for one pet share a total. The total varies per pet, 375 plus or minus 10 (R3.7). |
| How strongly aging affects effective scores | Proposed in R3.9. Aging changes the effective score only. Strength is tunable. |
| How strongly weight affects stamina and agility | Decided in R2.13. The index leaves the healthy band (-0.25 to 0.25) and effective stamina and agility drop. Returning to the band restores them. The strength of that drop stays tunable. |
| Whether maturity alone can reach potential | Proposed: natural growth stops near 70% of potential. Training closes the rest, and gains taper hard near the cap (R3.3, R3.8). |
| Whether short hungry and tired penalties stay | Proposed in R3.9. They lower the effective score only while the need is low. They do not change potential or the stored current score. |
| Vitality session limit | TBD. Each rep counts as a session (R5.10), but no session consequence exists in code yet. |
| Which pet survives if a guest signs into an account that already has one | TBD. |
| Where the share-card link goes | TBD. A public pet page and a store listing are different products. |
| Sharing | Public share cards for growth, friends-only inside the app |
| Monetization model | Undecided, except premium cosmetics, which are post-MVP and cosmetic-only (F6) |
| Whether food and boosts get catalog entries | Open. They are not cosmetics. Diet and buffs stay in R2.12 and R3.9 until decided. |
| Whether a remote cosmetics catalog ships | Open. The bundled catalog is the offline source of truth (R6.8). If a remote copy ships, it may add and retire items and may not change an existing item's id or slot. A failed fetch uses the last cached copy, then the bundled catalog. |
| Number of owned pets | One in the MVP. Encounters add actors. They do not add a second saved pet. |
| Meaning of "virtual reality" | Assumed to mean a lifelike, persistent pet and not AR. AR would change the engine choice. |
| App name | Undecided, and no candidate has been cleared for trademark |
| Whether a purchasable special treat may carry a gain bonus | Open. Special treats are x1.5 gain (R5.7) and principle 3 says outcomes never depend on payment. The MVP sells nothing. |
| House training gain numbers | Open. The brief's v2.1 values are not in the repo. R5.8 keeps the v2 base gain and age factor until they are. |
| Where care and training tuning lives | Open. Code keeps tuning in `src/sim/config.ts` and `src/playdate/config.ts`. The brief names `src/game/config.ts`, which does not exist. |
