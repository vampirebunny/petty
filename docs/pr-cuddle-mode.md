# PR: Cuddle mode, guidance, animations and action icons

## Summary

- PRD updated first: R4.8 to R4.13, edits to R2.2, R4.1, R4.5 and R6.7, new Decided rows, sound ids, accessibility and testing notes.
- Cuddle mode: a `cuddle` task on the existing task machine (`src/actor/cuddle.ts`), tuned by `src/actor/data/cuddle.ts`.
- Gestures: pure classifier in `src/input/cuddleGesture.ts` (stroke, too-fast swipe, scratch) plus nose boop.
- Guidance: first-entry coach marks, in-mode pill, ghost finger (first 3 sessions), "How to cuddle" sheet.
- Icons: one `lucide-react-native` set for every action button and settings toggle.

## Action bar icon mapping (final)

| Action id | Label | Icon |
| --- | --- | --- |
| `sit` | Sit | `Armchair` |
| `paw` | Give paw | `PawPrint` |
| `speak` | Speak | `MessageCircle` |
| `cuddle` | Cuddle | `HandHeart` |
| `rest` | Sleep | `Moon` |
| `wake` | Wake | `Sun` |
| `feed` | Feed | `Soup` |
| `refill` | Refill water | `Droplet` |
| `play` | Play | `Volleyball` |
| `wardrobe` | Wardrobe | `Shirt` |
| `reminders` | Reminders | `Bell` |
| `sound` / `soundOff` | Sound | `Volume2` / `VolumeX` |
| `personality` | Personality | `Sparkles` |
| `help` | Help | `CircleQuestionMark` |

The map is `src/ui/actionIcons.ts`. Cats share the dog icons because both species throw a ball today. The laser toy later adds `play: Target` and the label "Laser" for cats as one entry each.
Lucide has no bowl or ball glyph, so Feed is `Soup` (a bowl with steam) and Play is `Volleyball`. Check both on a device. `Bone` is the fallback for Play.

## Known gaps

- Roll-over mirrors the torso, legs, tail, coat, boots, collar and bandana about the body's center line. Boots and coat markings therefore draw upside down while a pet is on its back. Hats and glasses ride the head, which stays upright and only lolls, so they keep fitting. No cosmetic is hidden today.
- The roll-over, kneading and leg-kick poses are procedural and were checked by the simulation tests (every breed and life stage), not by rendering on a device. Look at them in a development build and tune `src/actor/data/cuddle.ts` and the leg and head offsets in `src/ui/skia/pet.ts`.
- Pose channels blend with the existing first-order ease rather than a per-channel easeInOutSine tween. Keyframed reactions use easeInOutSine envelopes, and only the ear perk and boop use a spring.
- The cat belly-up "trap" uses the existing raised-paw wave for its swat, not a dedicated swat pose.
- Placeholder sounds are silent until clips are added (see below).
- `expo lint` still reports the "refs during render" errors that already existed in `HomeScreen.tsx`, `PetView.tsx` and `DebugPanel.tsx`. The new gesture callbacks follow the same pattern and add three more of the same kind.

## Sounds needed (silent until a clip is added to `clips` in `src/audio/voice.ts`)

| Id | Used for |
| --- | --- |
| `cuddle_sneeze` | Boop reaction (small sneeze or snort) |
| `cuddle_purr_loop` | Cat stroke (loopable, 2 to 4 s) |
| `cuddle_content_sigh` | Dog content moment (stroke and belly rub) |
| `cuddle_whimper_happy` | Dog scratch and leg kick |
| `cuddle_shake_off` | Dog tolerance exit |
| `cuddle_swat` | Cat swat (trap and tolerance exit) |
| `cuddle_flinch_chirp` | Too-fast swipe flinch |
| `cuddle_kneading_loop` | Cat kneading |

## Testing

- `src/actor/__tests__/cuddle-test.ts`: params, zones, reactions, and a full session for all 10 breeds at 5 life stages. It asserts the phase order, `headTurn` at most 0.16 while moving, `headTurn` below 0.06 when the walk starts, and no pose channel jump above 25% of its range in one frame.
- `src/input/__tests__/cuddleGesture-test.ts`, `src/cuddle/__tests__/guidance-test.ts`, `src/ui/__tests__/actionIcons-test.ts`, `src/audio/__tests__/voice-test.ts`, and new event tests.
- Run `npx tsc --noEmit`, `npx jest`, `npx expo lint`.
