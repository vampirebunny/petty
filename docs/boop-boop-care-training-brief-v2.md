# Boop Boop — Care & Training Systems Brief v2 (for Cursor)

**Status:** This document **supersedes** the original brief and Addendums 1–3. Discard those. The v2.2 trick-pacing patch is folded in below: trick tiers, unlock days, `pSuccess`, and the treat regen numbers. House training still uses the v2 gain and age factor, because the v2.1 house-training numbers are not in the repo.
**PRD:** This pack **replaces F5** (see §0.2). Where this brief references an existing spec (R1.6, R2.11, R3.4, R3.8, R4.7, R7.5), the existing spec wins.
**Tuning:** Every number lives in `src/game/config.ts`. §15 lists all defaults.

---

## 0. Scope and precedence

### 0.1 What this adds
- **Care:** potty, cleanup, walks (dogs), bath (dogs), brush (cats).
- **Training:** 0–100 tracks for house training and tricks.
- **Collection:** treat economy, inventory, milestones.

### 0.2 F5 is replaced
Update the PRD to mark F5 as superseded by this brief:

| F5 concept | Now |
|---|---|
| Gesture discovery | **Removed.** Tricks unlock by rules (§5). |
| Reliability | Replaced by `pSuccess` (§4.3). |
| Skill fade | **Deferred.** `decayEnabled: false`. No decay in v1. |
| Owner skill rating | **Removed as a stat.** Owner skill shows up as reward-timing credit (§4.4). |

---

## 1. Principles
1. **Timestamp simulation.** `simulate(pet, user, now)` advances everything from `PetState.lastUpdatedAt`. The same code path handles a 5-second gap and a 3-day gap.
2. **Nothing succeeds or fails while the app is closed.** Signals and reward windows only happen in the foreground. Away time only produces capped, passive outcomes (§11).
3. **Time of day is visual only** (R4.7). It never writes pet state. Overnight protection comes from the existing **Rest** state.
4. **No lockouts from vitality** (R2.11).
5. **One generic training-track engine** for house training and all tricks.
6. **Pure logic.** The game rules are pure TS modules with no React, unit-tested.

---

## 2. State and scope

### Pet-scoped (deleted with the pet, per R1.6)
```ts
interface PetCareState {
  hygiene: number;                 // 0–100
  lastBathAt: number | null;
  lastBrushAt: number | null;
  messes: Mess[];                  // persistent scenes only (indoor rooms, park)
  litterBoxFill: number;           // cats, post-mastery: 0–100
  potty: PottyCycle;
  walk: { dueAt: number | null };  // dogs, post-mastery
  bathTolerance: number;           // -100…100, rolled once at adoption
  bathToleranceStart: number;      // for the Bath Buddy milestone
  pausedCycleRemainingMs?: number; // potty cycle paused during Rest
}

interface Mess { id: string; sceneId: string; x: number; y: number; createdAt: number; }

interface PottyCycle {
  nextUrgeAt: number | null;
  signal: { startedAt: number; remainingMs: number } | null;   // pausable
  pausedAt: number | null;        // foreground pause timestamp
}

interface TrainingTrack {
  id: string;
  progress: number;                // 0–100
  unlocked: boolean;
  mastered: boolean;
  repsToday: number;
  repsPetDay: number;              // pet-age day index the count belongs to
  pendingPenalty: boolean;         // accident penalty applies to next rep
}

interface PetGameState {
  care: PetCareState;
  training: Record<string, TrainingTrack>;
  milestones: string[];
  seenCoachMarks: string[];
}
```
On discard (R1.6), also **cancel all of this pet's scheduled care notifications**.

### User-scoped (survives discard)
```ts
interface UserEconomy {
  inventory: { itemId: string; qty: number }[];
  lastTreatRegenAt: number;
  lastDailyBonusLocalDate: string | null;   // YYYY-MM-DD, device local
}
```

---

## 3. Clock, RNG, attribute wiring

### Clock
- One clock: `simulate` advances the existing **`PetState.lastUpdatedAt`**. No second timestamp.
- **Pet-scoped daily limits** (per-track `repsToday`, the casual treat cap of 3) reset on the **pet-age day** boundary.
- **User-scoped daily limits** (daily login bonus) reset on the **device local calendar date**.
- **"Awake time"** means sim time while the pet is **not in Rest**. All care timers below run on awake time unless stated otherwise.

### RNG
- All care and training rolls consume **`pet.rngState`**: urge jitter, accident chance and placement, rep success, walk potty delay, reward amounts. No `Math.random()`.
- Playdates keep their own seed and **must not** read or advance `pet.rngState`.

### Attributes
- **Read** everything through **`attributeScore`**.
- **Write** every training gain through **`trainingGain`** onto stored current, so the R3.8 taper applies.
- **Never** use `grantFlatAttributes` in care or training. It stays playdate-only.

---

## 4. Training engine

### 4.1 Track definition
```ts
interface TrackDef {
  id: string;
  species: Species[];
  hideWhenMastered: boolean;                           // house_training: true
  prerequisites: Partial<Record<Species, string[]>>;   // missing key = none
  unlock: Partial<Record<Species, UnlockRule>>;        // missing key = at adoption
  tier?: 1 | 2 | 3;                                // tricks: sets baseGainPerRep (15, 7.5, 5)
  baseGainPerRep: number;                              // house training sets this directly
  linkedAttributes: AttributeId[];                     // 1 or 2
  hidden?: boolean;                                    // reserved; no content in v1
}
type UnlockRule = { minAgeDays?: number; minAttributes?: Partial<Record<AttributeId, number>> };
```
Unlock evaluation runs in `simulate()`. A newly unlocked track shows a "New trick unlocked!" toast.

### 4.2 Rep flow (tricks and potty)
1. **Attempt.** Trick: tap the trick's button. Potty: the pet goes in the right place.
2. **Roll success** (tricks only; a correct potty is always a success).
3. **Failure:** the pet plays a confused reaction. No reward window opens, nothing is paid, no treat is consumed, and it doesn't count toward `repsToday`. It does count as a session for R2.11.
4. **Success:** a **reward window** opens (§4.4).
5. **Resolve** the rep when a treat is given, the next rep starts, the user leaves the scene or screen, or the late window ends, whichever comes first.

### 4.3 Success chance (tricks)
```
pSuccess = clamp(0.55 + 0.003 * obedience + 0.004 * progress, 0.50, 0.97)   // mastered → 1.0
```
`obedience` comes from `attributeScore`.

### 4.4 Reward window (same for tricks and potty)
| Treat given | Credit multiplier |
|---|---|
| Within 5 s of success | 1.0 × tier factor (basic 1.0, special 1.5) |
| 5–15 s | 0.5 (treat still consumed) |
| None by 15 s, or resolved early with no treat | 0.25 |

The Treat button glows during the 5 s window and dims during 5–15 s.

**Tier chip:** basic by default, with a toggle to special for the current window. If the chosen tier is empty, it falls back to the other tier. If both are empty, the button shows "Out of treats — next in Xm" and the rep resolves at 0.25. The chip resets to basic after each window.

### 4.5 What a resolved successful rep pays
Every successful rep counts as a "successful rep" whatever its credit level:
- **Trick progress:** `baseGainPerRep(tier) × intelligenceFactor × credit × fatigueFactor`. Tricks have no age factor and no accident penalty.
- **House-training progress:** `baseGainPerRep × intelligenceFactor × ageFactor × credit × fatigueFactor × penaltyFactor`.
- **Attributes:** `rawAttrPerRep × credit` through `trainingGain`, **split evenly** across `linkedAttributes` (two attributes get half each).
- **XP:** `trainingRepXp` (flat; credit doesn't scale it).
- **If fatigued** (past the daily cap): progress × `fatigueMultiplier`, and **no** attribute gain or XP.

Factors:
```
intelligenceFactor = 0.8 + 0.4 * clamp(intelligence / 100, 0, 1)   // tricks and house training
ageFactor          = by life stage (§15); house training only
fatigueFactor      = repsToday < dailyRepCap ? 1 : fatigueMultiplier
penaltyFactor      = pendingPenalty ? accidentPenaltyMultiplier : 1   // house training only; then clear
```

**Design rule:** no trick may need more than 3 daily caps of full-credit reps at the lowest starting intelligence on the roster. Future tricks are assigned tier 1, 2, or 3. A config test enforces it. At intelligence about 9, tiers 1 / 2 / 3 take about 8 / 16 / 24 full-credit reps.

### 4.6 Mastery (progress reaches 100)
- Set `mastered`. Grant `masteryXp`, plus `rawAttrOnMastery` through `trainingGain` (split evenly across linked attributes), the milestone, `milestoneTreats` basic treats and 1 special treat.
- Recompute the "current style" label.
- Mastered tricks always perform (`pSuccess = 1`). They give no further progress, attribute gain or XP. A treat still gives the casual happiness boost and follows the casual treat rules.

### 4.7 Fatigue and vitality
- **R2.11 is unchanged.** Every rep, success or failure, counts as one session. Beyond the vitality-scaled number of happy sessions, R2.11's existing consequences apply. Nothing is ever locked.
- **The per-track daily cap** is separate: diminishing returns per trick, which encourages variety. When it's hit, the pet plays a "had enough {Trick} today" reaction.

### 4.8 Locked-trick hint
Show the **first unmet condition**, checked in this order:
1. Prerequisite not mastered: "Keep practicing {Prereq} to unlock."
2. Age not reached: "{Name} needs to grow up a little before learning this."
3. Intelligence too low: "{Name} needs to get a bit smarter first." Obedience too low: "…a bit more focused first."

Never show days, ages, stage names or attribute numbers. Locked tricks appear as silhouettes in the training panel.

---

## 5. Track table
| id | species | tier | prerequisites | unlock | gain | linked |
|---|---|---|---|---|---|---|
| house_training | dog, cat | — | — | at adoption | 3.0 (own formula) | obedience |
| sit | dog, cat | 1 | — | at adoption | 15 | obedience |
| speak | dog, cat | 1 | — | at adoption | 15 | obedience |
| come_when_called | cat | 1 | — | minAgeDays 1 | 15 | obedience |
| paw | dog | 2 | dog: sit | minAgeDays 1 | 7.5 | obedience |
| lie_down | dog | 2 | dog: sit | minAgeDays 2 | 7.5 | obedience, intelligence |
| high_five | dog, cat | 2 | dog: paw · cat: sit | minAgeDays 3 | 7.5 | obedience |
| roll_over | dog | 3 | dog: lie_down | minAgeDays 5 | 5 | obedience, intelligence |

Roll over has no intelligence gate. Tier base gain is 15 / 7.5 / 5.

`hideWhenMastered` is true only for house_training.

**Buttons:** the existing Sit, Paw and Speak buttons are the training entry points. A locked track's button is hidden. Unlocked tracks: a tap is a rep. Mastered tracks: a tap is a show-off pose. The cat's Speak button keeps the meow and follows the same rules, so before mastery the cat sometimes ignores the cue. Other tricks get buttons in the training panel.

---

## 6. House training (pre-mastery)

UI labels: meter **"House Training"**. Button **"Go Out"** (dog) / **"Litter Box"** (cat).

### 6.1 Urge cycle (foreground only)
- `nextUrgeAt` is scheduled in awake time: `urgeInterval[lifeStage] × (1 + 0.5 × progress/100)`, with ±15% jitter from `pet.rngState`.
- Reaching it in the foreground starts a **signal** (dog: sniff, circle, whine; cat: sniff, scratch the floor). The potty button pulses for `signalWindow` (90 s).
- **Backgrounded mid-signal:** the remaining time pauses. A return within `resumeGrace` (5 min) resumes it. A longer absence cancels the signal with **no mess and no penalty**, and a new urge is scheduled 20–60 s after the next foreground.
- **Urge passed while away:** a new urge is scheduled 20–60 s after foreground.
- **Rest:** the cycle pauses entirely, with no urges, signals or accidents. It resumes with the remaining time when Rest ends.

### 6.2 Responding
- **Cat:** tap Litter Box. The cat walks to the box, goes, and the reward window opens.
- **Dog:** tap Go Out. The scene changes to the **sidewalk** (§7.2), the dog goes after an 8–20 s RNG delay, and the reward window opens.

### 6.3 Missing the window
- An accident spawns a mess in the **current scene**, indoor or park. A random valid floor spot is picked with `pet.rngState`.
- **Indoor miss:** set `pendingPenalty` (the next house-training rep gets ×`accidentPenaltyMultiplier`).
- **Outdoor (park) miss:** the mess spawns, with no penalty and no credit.
- Progress is never lost.

### 6.4 Random accidents
Separate from urges, pre-mastery pets have random accidents at `randomAccidentRatePerHour` of awake time (live and away). These carry no penalty.

---

## 7. After mastery

### 7.1 Cat litter box
- The cat goes on its own every `postMasteryCatPottyInterval` (awake time). Each time adds `litterFillPerUse`.
- Above `litterAccidentThreshold`, each `careCheckInterval` of awake time rolls `litterAccidentChance` for an indoor accident.
- Tapping the box in Clean mode resets the fill to 0, with a rake animation. The box shows clean, used and gross visual states.

### 7.2 Dog walks
- The walk need comes due every `walkInterval` of awake time. "Walk" is the dog's button, replacing "Go Out" after mastery.
- **Walk scene:** sidewalk, lasting `walkDuration` (60 s). The dog goes potty after the 8–20 s delay. Post-mastery that's a plain potty with no reward window. "Head Home" is available once the dog has gone.
- **Leaving during a reward window** (Head Home, scene change, background): the rep resolves at 0.25 unless a treat was already given.
- **Backgrounded before the dog has gone:** the walk is abandoned with no mess and no penalty. Pre-mastery, the urge gets rescheduled 20–60 s after foreground, per §6.1. Post-mastery, the walk stays due.
- **Overdue:** after `walkGracePeriod`, each `careCheckInterval` rolls `overdueWalkAccidentChance` for an indoor accident. Happiness also drains by `overdueWalkHappinessDrainPerHour` from the due time, capped at `overdueWalkHappinessDrainCap`. A completed walk resets `dueAt`.
- **Sidewalk messes** exist only during the walk. They're removed when the scene closes, with no penalty, and they **don't count** toward the mess cap.

---

## 8. Cleanup
- **Clean** enters tool mode: scooper indoors, bag outdoors, rake on the litter box. A one-time coach mark says "Tap the messes to clean them!" Each tap plays a scoop animation, a sparkle and a sound. Tool mode exits automatically when the scene is clean, or with ✕.
- **Clean lights up only when the current scene has messes.**
- **Mess cap:** at most `maxMesses` (3) across all persistent scenes. At the cap, new accidents don't spawn.
- **Neglect:** a mess shows stink lines after `messStinkAfter` and flies after `messFliesAfter`. Each mess drains happiness and hygiene per hour, capped totals (§15).
- **Off-scene messes:** the care chip (§12) shows a count. Tapping it switches to the scene with the most messes. Ties go to the **most recently visited** scene, then to scene-definition order.

---

## 9. Hygiene, baths, brushing

### Hygiene
- Drains `hygieneDecayPerHour` in awake time, plus `walkHygieneCost` per walk and `outdoorPlayHygieneCost` per active play action in an outdoor scene. Idling outdoors doesn't drain it.
- Dirt overlay: subtle below `dirtSubtle` (60), obvious below `dirtObvious` (30).

### Dog bath
- The Bath chip appears when hygiene < `bathPromptBelow` (40). Bath scene: lather, rinse, towel, shake. Afterward hygiene = 100.
- Happiness Δ = `round(bathTolerance / 10)` (−10…+10).
- A treat during the bath gives `bathTolerance += bathTreatToleranceGain` (cap 100) and follows the reward-treat rules (§10).
- Over-bathing (hygiene > 80 at start): happiness −5, no hygiene gain.
- **Bath Buddy** milestone: `bathToleranceStart ≤ −20` and tolerance reaches ≥ +20.

### Cat grooming
- **Brush** in the current room: hygiene +40 (cap 100), happiness +`round(affection/25)`.
- Bath is always available in the Care menu, but its chip is only prompted when hygiene < 15. It uses the same bath rules.

### Bath tolerance (rolled once at adoption, stored)
```
t = (boldnessPotential - rosterBoldnessPotentialMin) / (rosterBoldnessPotentialMax - rosterBoldnessPotentialMin)
bathTolerance = clamp(round(lerp(-60, 60, t)) + waterAffinity + speciesModifier, -100, 100)
```
- **This uses the pet's Boldness potential**, not current Boldness, because current Boldness is ~5–20 at adoption and would make almost every pet bath-averse. Potential is deterministic and reflects temperament.
- The roster min and max are computed from the breed table across both species, so the result automatically rescales if breeds change.
- `waterAffinity`: `retriever` +30, all others 0 (defaults to 0).
- `speciesModifier`: dog 0, cat −40.
- Target outcomes: a bold retriever ≈ +90, an average dog ≈ 0, a timid cat ≈ −100, a very bold cat ≈ +20.
- Later Boldness changes never move it. Only bath treats do.

---

## 10. Treats and inventory

### Use rules
| Use | Cap of 3 / pet-day | "Too full" gate | Weight calories |
|---|---|---|---|
| Casual "Give treat" (inventory or mastered-trick show-off) | yes | yes | 100% |
| Reward treat (training, potty, bath window) | exempt | exempt | 25% |

### Sources (user-scoped)
| Source | Default |
|---|---|
| Regen | +1 basic every 20 min **of real time**; pauses while basic stack ≥ 15 |
| Daily login bonus | +10 basic per device-local date |
| Milestones | +10 basic, +1 special |
| IAP | stub `purchaseItem()` only |
| Playdates | **none** (R7.5) |

The hard stack ceiling is 99 per tier. Other sources can push the stack past the regen cap.

### Inventory window
- Tabs: Food · Treats · Toys · Cosmetics · Care.
- Every item has a Give / Use / Equip action. Item definitions live in data: `{ id, name, category, tier, icon, effects }`.
- No consumable chore supplies.
- **Free-path rule:** every trick and milestone is reachable without IAP.

---

## 11. Away simulation and welcome back

### Away simulation
This runs in `simulate()` on return, in awake time only, with **the same rules as live play** for the pet's state:

| Pet state | Away outcome |
|---|---|
| Not house trained | Random accidents at `randomAccidentRatePerHour`. No urges, signals or penalties. |
| House-trained cat | Litter fill accrues. Accidents only above the threshold, checked every `careCheckInterval`. |
| House-trained dog | The walk comes due. Overdue accidents and drain follow §7.2. |
| All | Hygiene decay, mess neglect drains, and existing need decay (unchanged). Mess cap 3. No training changes. |

### Happiness floor
Apply `awayHappinessFloor` (40) **once, at the end of a catch-up pass** in which the gap was ≥ `welcomeBackGap`, after all existing drains. It is **not** a live floor.

### Welcome back
When the gap is ≥ `welcomeBackGap` (8 h), the pet runs in excited. Text: "{Name} missed you!" If there are messes, add "A couple of messes to clean up." With zero messes, the greeting plays alone.

---

## 12. UI

- **No status bubble on stage.** On the stage, the pet's behavior is the only cue: signaling, dirt, tired poses, the litter box state.
- **Care chips go inline with the existing Tummy, Energy and Mood rings**, in the same row and style. A chip appears only when its need is due:
  - **Potty** (pulses during a signal)
  - **Clean** (with a count; tapping navigates per §8)
  - **Bath** or **Brush**
  - **Walk**
- **House Training progress** is a small ring in the same row until mastered, then it's removed.
- **Training panel:** unlocked tracks with 0–100 bars, today's reps against the cap, locked silhouettes with hints, and buttons for tricks that aren't on the main bar.
- **Coach marks** appear once per action. Seen marks are stored in `seenCoachMarks`.
- Care actions use buttons, not gestures. Gestures stay reserved for toys.

---

## 13. Notifications

- **One shared scheduler.** Refactor the existing meal/rest reminder scheduler into a single `NotificationScheduler`. It owns every local notification. Each time state changes, it computes the **full desired set** (the existing meal/rest reminder plus care) and does cancel-all, then schedule-all. Nothing else schedules notifications.
- **Opt-in**, separately for care notifications. The existing reminder keeps its current setting.
- **Care types:** a potty urge is due (pre-mastery), messes are waiting, a walk is due, a bath or brush is due, a training cap has reset, treats are full.
- **Daily max of 3 for all notifications combined.** Priority order: meal/rest reminder, then potty, walk, messes, bath/brush, training reset, treats full.
- **Quiet hours** use device local time. That's allowed because it's a device setting, not pet state.

---

## 14. Milestones and playdates
- Milestones: house_trained, a mastery badge per trick, bath_buddy, first_walk. They're shown on the pet profile.
- `getMasteredTricks(pet)` is a **read-only** helper. Playdate scripts may use it to pick trick lines. Trick lines write nothing onto the pet (per the playdate spec).

---

## 15. Config defaults

### Training
| Key | Default |
|---|---|
| dailyRepCap (per track) | 8 |
| fatigueMultiplier | 0.1 |
| pSuccess base / obedience coef / progress coef / min / max | 0.55 / 0.003 / 0.004 / 0.50 / 0.97 |
| intelligenceFactor | 0.8 + 0.4 × clamp(int/100) |
| trick baseGain by tier 1 / 2 / 3 | 15 / 7.5 / 5 |
| ageFactor (house training only): puppy / older puppy / adolescent / adult / senior | 0.7 / 0.9 / 1.0 / 1.0 / 0.8 |
| rewardWindowFull / rewardWindowLate | 5 s / 15 s |
| credit full / late / none | 1.0 / 0.5 / 0.25 |
| treat tier factor basic / special | 1.0 / 1.5 |
| rawAttrPerRep (split across linked) | 0.15 |
| rawAttrOnMastery (split across linked) | 3.0 |
| trainingRepXp / masteryXp | 2 / 20 |
| accidentPenaltyMultiplier | 0.75 |
| decayEnabled | false |

### Potty and house training
| Key | Default |
|---|---|
| urgeInterval (awake min): puppy / older puppy / adolescent / adult / senior | 90 / 120 / 180 / 240 / 210 |
| urge progress stretch | × (1 + 0.5 × progress/100) |
| urgeJitter | ±15% |
| signalWindow | 90 s |
| resumeGrace | 5 min |
| reurgeAfterForeground | 20–60 s |
| walkPottyDelay | 8–20 s |
| randomAccidentRatePerHour (pre-mastery, awake) | 0.33 (≈1 per 3 h) |

### Post-mastery
| Key | Default |
|---|---|
| postMasteryCatPottyInterval | 180 awake min |
| litterFillPerUse | 12 |
| litterAccidentThreshold | 60 |
| litterAccidentChance (per check) | 0.10 |
| walkInterval | 6 awake h |
| walkDuration | 60 s |
| walkGracePeriod | 2 h |
| overdueWalkAccidentChance (per check) | 0.15 |
| overdueWalkHappinessDrainPerHour / cap | 2 / 20 |
| careCheckInterval | 15 awake min |

### Messes
| Key | Default |
|---|---|
| maxMesses (persistent scenes) | 3 |
| messStinkAfter / messFliesAfter | 60 / 180 min |
| mess happiness drain | −1/h per mess, cap −10 total |
| mess hygiene drain | −1/h per mess, cap −10 total |

### Hygiene and bath
| Key | Default |
|---|---|
| hygieneDecayPerHour (awake) | 1 |
| walkHygieneCost | 5 |
| outdoorPlayHygieneCost (per action) | 1 |
| dirtSubtle / dirtObvious | 60 / 30 |
| bathPromptBelow (dog) / catBathPromptBelow | 40 / 15 |
| overBathAbove / overBathHappiness | 80 / −5 |
| bathHappiness | round(tolerance / 10) |
| bathTreatToleranceGain | 4 |
| brushHygiene / brushHappiness | +40 / round(affection/25) |
| bathTolerance lerp range | −60…+60 |
| waterAffinity retriever | +30 |
| speciesModifier dog / cat | 0 / −40 |
| bathBuddy start ≤ / reach ≥ | −20 / +20 |

### Economy
| Key | Default |
|---|---|
| treatRegenInterval / regenCap | 20 min / 15 |
| stackCeiling (per tier) | 99 |
| dailyLoginBonus | 10 |
| milestoneTreats basic / special | 10 / 1 |
| casualTreatCapPerPetDay | 3 |
| rewardTreatCalorieFraction | 0.25 |

### Away and notifications
| Key | Default |
|---|---|
| welcomeBackGap | 8 h |
| awayHappinessFloor | 40 |
| notificationDailyMax (all types) | 3 |
| quietHours | 21:00–08:00 device local |

**Pacing rule** (a config test enforces it):
- No trick needs more than 3 daily caps of full-credit reps at the lowest starting intelligence (about 9).
- That is about 8 / 16 / 24 reps for tiers 1 / 2 / 3.
- House training still uses base gain 3.0 and the age factor, so it stays the slower track.

---

## 16. Acceptance criteria
1. A new pet shows the House Training ring. Urges only signal in the foreground. Backgrounding pauses the signal, and a long absence cancels it with no mess.
2. Dog potty goes to the sidewalk; cat potty goes to the litter box. Credit pays 1.0, 0.5 or 0.25 by treat timing. XP is flat for any successful rep. Attribute gain scales with credit.
3. An indoor miss spawns a mess and penalizes the next rep. A park miss spawns a mess with no penalty.
4. At mastery the ring is removed. Cat litter fill and accidents work as specified. Dog walks come due, and overdue accidents and drain work as specified. Sidewalk messes clear when the walk ends.
5. Trick buttons hide when locked, act as reps when unlocked, and always perform when mastered. Failed reps open no window and pay nothing. Hints show the first unmet condition with no numbers.
6. `lie_down` and `roll_over` split attribute gain evenly. All gains go through `trainingGain`. There are no `grantFlatAttributes` calls in care or training code.
7. Bath tolerance is rolled once from Boldness potential plus modifiers and matches the target outcomes in §9. Bath treats raise it.
8. Casual and reward treats follow the §10 table. Regen pauses at 15. Playdates give no treats. For every trick, mastery takes at most 3 daily caps of full-credit reps at the lowest starting intelligence.
9. Reopening after 24 h: the house-trained, cared-for pet has 0 messes. The untrained pet has ≤ 3. Happiness is ≥ 40 after catch-up. The welcome back plays. Training is unchanged.
10. Discarding a pet removes its care, training and milestone state and its care notifications. The inventory survives.
11. Only `NotificationScheduler` schedules notifications. It enforces a combined daily max of 3.
12. No `Math.random()` in game logic. Care rolls advance `pet.rngState`. Playdate RNG is untouched.
13. Unit tests cover `simulate()` over 5 s, 1 h, 8 h and 72 h gaps for untrained, trained-cat and trained-dog pets, plus the gain formula, unlock evaluation, and the reward-window credit.

## 17. Out of scope (stub or flag only)
- IAP store integration (`purchaseItem()` stub only).
- Hidden tricks (the `hidden` flag only, no content).
- Training decay (`decayEnabled: false`).
- Server sync (keep the state serializable).
