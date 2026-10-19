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
| `sound` / `soundOff` | Pet sounds | `Volume2` / `VolumeX` |
| `music` / `musicOff` | Music | `Music` (lucide has no slashed variant, so off shows through the inactive style) |
| `personality` | Personality | `Sparkles` |
| `help` | Help | `CircleQuestionMark` |

The map is `src/ui/actionIcons.ts`. Cats share the dog icons because both species throw a ball today. The laser toy later adds `play: Target` and the label "Laser" for cats as one entry each.
Lucide has no bowl or ball glyph, so Feed is `Soup` (a bowl with steam) and Play is `Volleyball`. Check both on a device. `Bone` is the fallback for Play.

## Known gaps

- Roll-over mirrors the torso, legs, tail, coat, boots, collar and bandana about the body's center line. Boots and coat markings therefore draw upside down while a pet is on its back. Hats and glasses ride the head, which stays upright and only lolls, so they keep fitting. No cosmetic is hidden today.
- The roll-over, kneading and leg-kick poses are procedural and were checked by the simulation tests (every breed and life stage), not by rendering on a device. Look at them in a development build and tune `src/actor/data/cuddle.ts` and the leg and head offsets in `src/ui/skia/pet.ts`.
- Pose channels blend with the existing first-order ease rather than a per-channel easeInOutSine tween. Keyframed reactions use easeInOutSine envelopes, and only the ear perk and boop use a spring.
- The cat belly-up "trap" uses the existing raised-paw wave for its swat, not a dedicated swat pose.
- Boop, flinch, swat, and shake-off have no clip and stay silent.
- `expo lint` still reports the "refs during render" errors that already existed in `HomeScreen.tsx`, `PetView.tsx` and `DebugPanel.tsx`. The new gesture callbacks follow the same pattern and add three more of the same kind.

## Sounds (shipped)

| Id | Clip | Used for |
| --- | --- | --- |
| `cuddle_purr` | `universfield-purring-cat-156459.mp3` | Cat content stroke and kneading |
| `cuddle_happy` | `yodguard-friendly-small-dog-bark-1-535470.mp3` | Dog content stroke and scratch kick |
| `cuddle_pant` | `fnx_sound-animated-dog-panting-287307-short.mp3` | Dog belly rub (2.2 s cut of the 9 s pant; full file kept for later idle) |

Boop, flinch, swat, and shake-off stay silent. Speak still uses the existing bark and meow clips.


## Background music

- Both the Pet sounds and Music toggles default to on and are saved separately (`petty.sound`, `petty.music`).
- `src/audio/music.ts` plays the tracks in `assets/background music/` at volume 0.075. Each next track is picked at random and never repeats the previous one (`pickNext`). The track list is an explicit `require` list, so a new file needs a new entry. The files stay in the app bundle and are not loaded from storage.
- The set is 21 tracks, about 52 minutes, encoded as 128 kbps stereo MP3 (about 48 MB). Re-encode a new file to that bitrate before adding its `require`.
- Music starts when `HomeScreen` mounts, which is after adoption and the meet screen, and is released when it unmounts. It pauses while the app is in the background.

## Testing

- `src/actor/__tests__/cuddle-test.ts`: params, zones, reactions, and a full session for all 10 breeds at 5 life stages. It asserts the phase order, `headTurn` at most 0.16 while moving, `headTurn` below 0.06 when the walk starts, and no pose channel jump above 25% of its range in one frame.
- `src/input/__tests__/cuddleGesture-test.ts`, `src/cuddle/__tests__/guidance-test.ts`, `src/ui/__tests__/actionIcons-test.ts`, `src/audio/__tests__/voice-test.ts`, `src/audio/__tests__/music-test.ts`, and new event tests.
- Run `npx tsc --noEmit`, `npx jest`, `npx expo lint`.
