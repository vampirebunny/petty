# Phase 1 Brief: Core Pet

Oct 15, 2026 · @A
Updated Oct 17, 2026

## Goal and scope

Phase 0 is done. The app has one blob, three needs, feed, rest, and pet, saved on the device, with a debug panel that jumps time. This phase gives that pet a life: an age check, a name, a personality, gradual aging, and a procedural body. The blob drawing is replaced by an actor. There is no Rive step.

**Superseded (Oct 18, 2026).** Adoption and attributes changed in the PRD (R1.3, R1.5, F3). The litter of three temperament variants is replaced by three archetype attribute sets (athlete, thinker, charmer) from `generateOffers(seed, species, breedKey, ranges)`, after a breed step with potential ranges and a look step (coat, ears, tail) with a live preview. `variant`, `temperament`, `trained` and `createLitter` are gone. The pet stores `attributes { seed, rulesVersion, archetype, potential, current }` and `look`. Scores use the breed range scale (about 10 to 100), `current` starts at 20% of potential, and totals are 375 plus or minus 10. Wherever the sections below mention variants, temperament labels, the 1 to 20 scale, or `createLitter`, follow the PRD instead.

Build it in the existing Expo app. The PRD is the contract. This brief is the build order for Phase 1. Requirement numbers below point at `docs/PRD Virtual Pet App MVP.md`. Decay, sleep, mood, and the current events stay as they are in "Cursor Brief: Pet Blob Prototype" unless this brief says otherwise.

**Done means**

A fresh install asks the user to attest that they are 13 or older. Saying they are under 13 leaves the app blocked after it is closed and reopened, with no pet saved. A passing attestation picks a species and a breed, meets three young pets of that breed, picks one, names it, and lands on the home screen. The home screen draws that pet as an actor. Feed, rest, petting, and throw ball start tasks. Nothing in the interface starts panting. Playing with the app open does not age the pet. Coming back later ages the credited day count by at most 48 hours, eases the view over about a second, and never shows a stage name. Debug controls can walk age, maturity, and vitality across the whole range.

## What to build

- An age attestation, stored locally as a pass or a blocked note (R1.1).
- A species choice, then a breed choice, then three young pets of that breed derived from one seed. The user picks one variation, and that pet is stored with the seed, the breed, and the variation (R1.3, R1.5).
- On each pet before the pick: the temperament label, the two attributes it nudges, and every attribute as an exact current score and potential. Then a name for the chosen pet (R1.4).
- `ageDays` and vitality on the clocks in R2.1, R2.3, and R2.7. Maturity is derived from `ageDays`.
- Internal stage labels and senior bands (R2.3, R2.9). The product UI never shows them.
- Six attributes with visible current scores and maximum potential, temperament, level, and xp (F3). Training, milestone points, and temporary buffs stay at zero until the activities that award them exist.
- A procedural actor drawn from breed anatomy, age curves, vitality, and weight (R2.7, R4.6). Weight is never shown as a number.
- Feed starts eat, rest starts sleep, a stroke starts the species reaction, and throw ball starts fetch for a dog or pounce for a cat (R4.1, R4.2, R4.6).
- A reminder when a need is about to run low, with a switch to turn reminders off (R2.5).
- Debug sliders and time jumps that bypass the maturity cap (R2.6). The age slider runs from day 0 through day 1000.

## Do not build

- A birthdate field for the user. The pet's age is the credited day count, not a date the user types.
- A control that starts panting. A dog may pant on its own. The button row does not include it.
- Stage names on the home screen, in a details view, in a notification, or on any share image.
- Accounts, sync, friends, share cards, tricks, training, fetch mastery, toys, or outfits.
- A second pet on screen. The sim is an actor list, and a test may step two actors, but the home screen shows the owner's pet only.
- A server, analytics, or purchases.
- Any Rive dependency. The HTML files in `docs/` are references to port.

## Stack

Stay on the current Expo SDK and the libraries already in the app. Add `expo-notifications` with `npx expo install` for R2.5. Add `@shopify/react-native-skia` and `expo-audio` the same way for the actor and the recorded sounds. Both are included in Expo Go for this SDK, so they do not force a development build. If some other install forces a development build, stop and ask before adding it. Do not add any other dependency without asking.

## Simulation

Keep `src/sim` pure. Time comes in as milliseconds. Randomness comes from the seeded generator. The screen sends events and draws results. The world is a list of actors. The saved pet is one record. `spawnActor` builds an actor from that record, or from a snapshot. Phase 1 shows one actor. A unit test steps two.

The actor logic is plain TypeScript, with no Skia import:

- `breeds`: config. `species` is a field. Anatomy, pitch, and the extra behavior ids live here.
- `growth`: one curve per visual feature, keyed by `ageDays`.
- `geometry`: proportions from breed anatomy and those curves.
- `pose`: targets and easing, including `spineArch` and `crouch`.
- `legs`: the IK solver and the gait.
- `behavior`: the shared task machine, plus the species list.
- `sim`: `update(dt)` steps props, then every actor, with dt capped at 50ms.
- The Skia renderer is outside this folder. It only draws.

Extend the pet with the Phase 1 fields from the PRD: `id`, `seed`, `variant`, `name`, `breedId`, `ageDays`, `maturity`, `vitality`, `careWindow`, `weight`, `feedWindow`, `bornAt`, `maturityAppliedAt`, `potential`, `trained`, `temperament`, `drift`, `seniorBand`, `level`, `xp`, and `bond` left at 0. Keep the existing needs, `asleep`, `lastUpdatedAt`, and `rngState`. There is no `roll` field. `ageDays` starts at 0. `weight` starts at 50. The feed window starts as if the pet had been fed at the normal rate, so weight holds at 50 until the player's feeding differs.

`id` is a string chosen outside the sim and passed into `createPet`. The seed and the `breedId` are chosen outside the sim too. `createLitter(seed, breedId)` and `createPet(seed, breedId, variant, now, name, id)` are pure. The same seed, breed, and variant always return the same pet. Potential is hashed from the seed, breed, and variant and does not read `rngState`. `rngState` is still derived from the seed and the chosen variant, so the three variations do not share one random stream after adoption.

### Two clocks

Needs and age no longer share one advance path.

**Foreground tick** (the existing 5-second loop):

- Apply need decay for the elapsed time since `lastUpdatedAt`, using the current step size and the 48-hour cap.
- Leave `ageDays` and maturity unchanged.
- Set `maturityAppliedAt` to now so closed time starts when the ticks stop.

**Cold start and return to foreground:**

- Closed time is `now - maturityAppliedAt`.
- Credit `min(closed time, 48 hours)` toward `ageDays`. Drop the rest.
- Until maturity is 1, also stop at the next stage boundary and drop the time past it.
- Then set `maturityAppliedAt` to now.
- Apply needs for the same credited gap, still capped at 48 hours, through the existing decay rules.
- Set maturity to `min(1, ageDays / daysToSenior)`.

A 100-hour gap and a 48-hour gap produce the same needs, the same `ageDays`, and the same maturity. Opening and closing again only counts new closed time. After maturity is 1, a return still adds the capped closed time to `ageDays`. The visual curves clamp at 1000. The pet keeps living after that.

`daysToSenior` starts at 180. `careMultiplier` is 1 in this phase. Maturity clamps to 0–1 and never decreases. `ageDays` never decreases except through a debug control.

### One boundary per return

Stage thresholds are fractions of the 180-day span:

| Internal label | Maturity |
| --- | --- |
| puppy | 0 to 7/180 |
| older puppy | 7/180 to 21/180 |
| adolescent | 21/180 to 45/180 |
| adult | 45/180 to 1 |
| senior | 1 |

On a normal return, if the gain would pass more than one threshold, stop `ageDays` on the first threshold and drop the rest. The next return can continue. This clamp stops applying once maturity is 1. Debug time jumps and the age slider apply the requested value and ignore this clamp. Setting `ageDays` recomputes maturity.

### Vitality

Until Phase 2, vitality uses feeding and attention only (R2.12). Store that as `careWindow` samples. `exercise` and `play` stay 0 until fetch and play exist. Starting values, all in config:

- The window holds up to 7 daily samples. A new pet starts with one sample at diet quality 0.75 and attention 0.75.
- A feed raises today's diet quality by 0.08, clamped to 0–1. A pet raises today's attention by 0.05, clamped to 0–1.
- Credited absence writes low samples for those days only, at most two days because of the 48-hour cap. Each missed day is diet quality 0.25 and attention 0.25.
- `vitalityTarget` is the average of diet quality and attention across the window, and it is at least 0.35.
- Vitality moves toward that target by at most 0.03 per day, including a matching fraction of a day on the foreground tick.

The care formula never sets vitality below 0.35. The debug slider may set any value from 0 to 1. One feed or pet changes the target a little and barely moves vitality.

### Senior bands

Bands apply only when the internal stage is senior. They are a hysteresis cache on the pet. Vitality remains the source of truth. Starting edges, with a margin of 0.05:

| Band | Vitality |
| --- | --- |
| elderly | below 0.40 |
| senior | 0.40 to 0.70 |
| early senior | above 0.70 |

To leave a band, vitality must pass the edge by the margin. Tests cover both directions.

### Attributes, potential, and level

Five dog breeds, taken from `docs/Procedural Dog.html`: retriever, corgi, dachshund, husky, and pug. Each record has `species: 'dog'` and the anatomy numbers from that file. Cat breeds are the same kind of record, filled from the cat reference when that file is in `docs/`. Do not invent cat anatomy before then. Shared tasks are stand, sit, sleep, eat, walk, and jump. Dog records add pant, paw, bark, and fetch. Cat records add purr, groom, and pounce. Six attributes: stamina, agility, intelligence, boldness, affection, obedience. Scores are whole numbers. Proposed scale: 1 to 20.

Starting config:

- Each base potential is 12. The breed total is 72.
- `rollRange` is 3. The hash from the seed and variant moves points between attributes. Each attribute stays within 3 of its base, and the total stays 72.
- Temperament then moves about 10% of one attribute's potential onto another, at least 1 point, without leaving 1 to 20. The total stays 72. The three variants boost three different attributes.
- A puppy's growth at maturity 0 is about 25% of potential, rounded to the nearest whole number and at least 1. Natural growth rises with maturity and stops near 70% of potential. `trained` starts at 0. Phase 1 has no training UI, and a pure gain function still exists so a test can show that gains taper hard near potential.

The label comes from the boosted attribute. These strings are starting copy in config:

| Boosted attribute | Label |
| --- | --- |
| stamina | steady pacer |
| agility | quick step |
| intelligence | bright pupil |
| boldness | bold explorer |
| affection | soft heart |
| obedience | willing partner |

Effective score = natural growth + trained + drift + temporary effects, multiplied by the aging modifier and, for stamina and agility, by the weight modifier, then capped at potential. Temporary effects are 0 in this phase. The aging modifier lowers effective stamina and agility when the internal stage is senior and vitality is low, and it can raise effective obedience by a small amount in that same case. The weight modifier is 1 at weight 50 and falls toward about 0.85 at 0 or at 100. Neither modifier changes `potential` or `trained`. Effective scores stay at least 1.

The product UI shows level, the temperament label, and each attribute as `current / potential`. It does not show the seed, a stage name, or the weight number.

### Weight

Weight is 0 to 100. 50 is normal. Every puppy starts at 50.

Proposed config:

- The normal rate is 2 feedings a day. A 7-day moving average at that rate holds the target at 50.
- Each extra feeding per day, sustained, raises the target by 25. Each missing feeding per day lowers it by 25. The target clamps to 0–100.
- Weight eases toward the target by at most 4 points per day. One feeding barely moves it.
- A return counts missed feedings only up to the 48-hour cap. A 100-hour gap matches a 48-hour gap.

The debug panel may show the number and set it with a slider. No other screen shows it.

Drift starts at 0 and each attribute stays within -2 to 2. A pet adds 0.05 to affection drift. A feed adds 0.02 to stamina drift. During credited absence, each drift value moves 0.05 toward 0 per day.

Xp starts at 0. A feed adds 5. A pet adds 2. Earned level is `1 + floor(xp / 25)`. Shown level is the earned level clamped to the current ceiling:

| Internal stage | Level ceiling |
| --- | --- |
| puppy | 6 |
| older puppy | 12 |
| adolescent | 20 |
| adult | 32 |
| senior | 45 |

Xp is kept when a debug control lowers the ceiling. The shown level follows the ceiling down and can rise again when the ceiling does.

`bond` stays 0. Do not spend it, show it, or design rules for it.

## Age gate and adoption

No navigation library. A small flow in the app is enough: attest, blocked, species, breed, litter, name, home.

**Attest.** "This app is for ages 13 and up." Actions: "I am 13 or older" and "I am under 13". Store `passed` or `blocked` under a key of its own, separate from the pet, because a blocked user has no pet.

**Blocked.** A short screen that says they can't use the app. No second chance on that install. Relaunch shows this screen again.

**Species and breed.** Dog or cat, then a breed of that species. The five dog breeds are available now. Cat breeds appear when the cat reference is in `docs/`. Store the choice with the seed until a pet is saved, so leaving and coming back shows the same breed.

**Litter.** A pure `createLitter(seed, breedId)` returns three variations of that one seed and breed, with three different temperament labels and three different potential spreads that share one total. Show each pet's temperament label, the two attributes it nudges, and every attribute as an exact `current / potential`. Generate the seed once and store it until a pet is saved, so leaving and coming back shows the same three. The two variations that are not picked are not saved. The seed is never shown.

**Name.** Show the chosen pet and the temperament the user already saw. The name is required, trimmed, and at most 16 characters. Confirming the name creates the pet from the seed, the breed, and the picked variant.

**Home.** The pet's name, temperament, level, the six `current / potential` lines, need bars, feed, rest, and throw ball. No stage word. No pant button.

A saved Phase 0 pet has none of the new fields. If the loaded pet does not match this shape, drop it and start from the age gate. Do not crash.

Debug reset replaces the pet and keeps the attestation. A separate debug action clears the attestation so both gate paths can be tested.

A debug "New pet" action deletes the saved pet and returns to the species step. It has no confirmation, and the old pet is not kept. It also cancels the scheduled reminder and clears the saved adoption draft, so the flow starts fresh with a new seed. It keeps the attestation and the reminders and sound preferences. The delete goes through the same save queue as every other pet write, so a pending save cannot bring the old pet back. A swap window, rehome, and retire are not part of Phase 1.

## View

The home screen draws one actor with Skia. The renderer imports Skia. The modules listed under Simulation do not. Port `docs/Procedural Dog.html`. Do not embed it. When the cat reference arrives, add cat breeds and a cat draw path the same way. The species picker lists a species only when it has at least one breed.

The frame clock is separate from the 5-second needs tick. Cap each frame at 50ms. Pause it when the app is not active. On return, drop an in-progress eat, fetch, or pounce and show the pet standing, or sleeping if rest is on. Save the pet record. Do not save the pose, the gait, or the ball.

Behavior, from the species list:

- Feed starts eat, unless the pet is asleep, which keeps the current stir.
- Rest starts sleep. Wake returns to stand.
- A stroke starts the species reaction. A dog barks or offers a paw. A cat purrs or grooms. The existing purr-versus-wiggle roll chooses which.
- Throw ball starts fetch for a dog and pounce for a cat. Phase 1 always runs that chase.
- Pant is not a control. The dog task machine may enter it, including the sit-and-pant at the end of a fetch.

Every actor has `x`, depth `y`, and height `z`. A jump is a scripted arc on `z`. Pounce uses it. Fetch stays on the ground. The pose eases `spineArch` and `crouch` with the other channels. Leave them at 0 unless the reference you are porting sets them.

Age curves live in a data file. Leg length is an S-curve across growth. Under-eye bags rise from about day 600 to day 800, and high vitality fades them. The other growth curves do not reverse. Weight still changes body width and leg width: 1 at 50, about 0.75 at 0, and about 1.3 at 100. On an age or weight change, ease the displayed value over about one second. The stored value updates immediately.

The renderer never reads a stage label, and it never draws the weight number. Tuning numbers (sit angle, stride, head targets, pose rates) are named constants.

Recorded clips play from `expo-audio`, with pitch correction off. Pitch is the breed pitch times the age factor from the dog reference (`1.35 - 0.35 × growth`) until a curve replaces that factor. Respect the hardware silent switch. If a clip is missing, that action stays silent. Phase 1 wants a dog bark, chew, pant, and snore, and a cat meow, chew, purr, and snore.

Tests cover pose easing, IK, gait foot targets, each shared and species task, the age curves including bag reversal, and `update(dt)` with two actors. They do not import Skia.

## Reminders

Schedule a local notification for the next time fullness will cross 25 or energy will cross 20, using the same decay rules as the sim. If the need is already low, wait until it recovers and would cross again. Copy uses the pet's name and stays calm, for example "Maple could use a meal." No guilt, and no stage words.

A reminders switch on the home screen defaults to on. If the system permission is denied, turn the switch off and keep the rest of the app working. Reschedule after each save.

## Debug panel

Keep the 1-hour, 6-hour, and 24-hour jumps. Those jumps add the full requested time to `ageDays` and apply the vitality absence rule for that full duration, with no 48-hour cap and no boundary clamp. Maturity follows `ageDays`.

Add sliders that set `ageDays`, vitality, and weight directly. `ageDays` runs from 0 through 1000, and past 180 maturity stays at 1. Show the internal stage, senior band, `ageDays`, maturity, vitality, weight, care window, feed window, level, xp, and each attribute's effective score and potential in this panel only. Do not show the seed.

## Tasks

Work in this order. Do not start a task until the previous check passes. Commit after each task.

1. **Types and config.** Add the new pet fields, the breed records, and the starting numbers in `config.ts`. Check: the project compiles, and a created pet has `ageDays` 0, maturity 0, vitality near the care target, and a name. The five dog breeds carry anatomy from the reference. No logic file imports Skia.
2. **Identity and attributes.** `createLitter(seed, breedId)` returns three variations with three different labels and the same total potential. `createPet(seed, breedId, variant)` keeps that variation's potentials and temperament. Check: one seed and breed always return the same three pets; one seed, breed, and variant always match themselves; a second seed can differ; potentials do not change if `rngState` changes.
3. **Maturity clock and stages.** Split the foreground tick from the resume path. Add the 48-hour cap, the one-boundary clamp, and `stageOf`. Check: foreground time leaves `ageDays` unchanged; a 100-hour gap matches a 48-hour gap; a gain that would pass two thresholds stops on the first; maturity never falls; after maturity is 1, more closed time still raises `ageDays`.
4. **Vitality, weight, and bands.** Add `careWindow`, `feedWindow`, the daily bounds, and senior-band hysteresis. Check: one feed barely moves vitality or weight; a stretch of extra feedings raises weight and missed feedings lower it; a 100-hour gap matches a 48-hour gap for weight; a new pet starts at 50; the band does not flicker inside the margin; vitality never goes below 0.35 from the care formula.
5. **Level, growth, and drift.** Add xp, ceilings, drift, the maturity growth cap, the aging modifier, the weight modifier, and the training-gain taper. Check: no current score exceeds potential; growth at full maturity stays near 70% of potential; a gain near the cap is much smaller than the same gain far from it; aging and weight change the effective score only; weight away from 50 lowers stamina and agility; drift moves back toward 0 on a capped absence; the shown level respects the ceiling.
6. **Age gate.** Persist pass and blocked separately from the pet. Check: under 13 stays blocked across a reload and saves no pet; a pass does not show the gate again.
7. **Adoption.** Pick a species and a breed, then show the three variations with temperament, nudged attributes, and exact `current / potential` lines. Pick one and name it. Check: the same three are still there after a reload before naming; an empty name cannot continue; the saved pet stores that seed, breed, and variant; home shows the chosen pet's name, temperament, level, and six scores with no stage word and no seed; the other two variations are not saved.
8. **Actor.** Port the dog reference into the modules above and draw it with Skia. Hook feed, rest, pet, and throw ball to the tasks in the View section. Check: the five dog breeds render and age from day 0 to day 1000; bags appear across days 600 to 800 and fade when vitality is high; sit, sleep, eat, fetch, bark, and give paw transition without a pop; pant happens after a fetch and from no button; a headless test steps two actors; the behavior tests do not import Skia; backgrounding pauses the frame clock.
9. **Reminders.** Schedule, cancel, and toggle the low-need notifications. Check: a stage word never appears in the copy, and denying permission leaves care usable.
10. **Playtest.** Close the app, reopen it later, and use the debug jumps. Check: needs follow the Phase 0 table, `ageDays` follows this brief, and a Phase 0 save does not crash.

Outfits stay on the cosmetics contract in the PRD. Phase 1 does not build a wardrobe. The pose keeps `spineArch`, `crouch`, and `z` so a later hurdle or a cat file can use them. A friend encounter is a later feature. It will spawn a second actor from a snapshot and a seed. Do not build that screen in this phase.
