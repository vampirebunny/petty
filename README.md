# Boop Boop

A small virtual pet. Needs change with real time, including while the app is closed. Play does not require an account screen. Before adoption, the app checks a store age signal when one exists, then asks whether the person is at least 13 and records acceptance of the terms and privacy policy. A Yes for someone 13 or older can create an anonymous Supabase user and sync a compliance record when the network is available. A No, or a store signal under 13, stays on the device and is not sent anywhere.

## Run

```sh
npm install
npm test
npx expo start
```

Open the project in Expo Go on a phone signed into the same Expo account as this machine. The dev server prints a QR code. Expo Go has no store age API, so the consent screen asks the age question. A development build is required before Apple Declared Age Range or Play Age Signals can answer.

Copy `.env.local` values for `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` on a machine that should sync consent records. That file is not committed. Migration SQL in `supabase/migrations/` is applied only by the project owner, with `supabase db push` after the CLI is linked. Do not apply it from an agent or another script.

On the home screen the name and actor stay sticky. Need bars sit below the animation. The stage is taller than wide (640×680) with a deep floor so the pet can wander; the adoption preview still uses the top half. Actions are sit, give paw, speak, sleep/wake, eat, drink, and throw ball. Idle is not a button: the pet idles on its own when nothing else is running. While resting (standing, panting, or purring) it occasionally barks or meows unprompted, at most about once a minute. Any action other than sleep wakes a sleeper. Tap the stage to soft-drop the ball from high up, or flick to throw; stroke to pet. `{name}'s personality` expands archetype and attribute scores. Settings (formerly Debug) jumps 1, 6, or 24 hours and can reset the pet. Its "New pet" button deletes the current pet and starts adoption again, with no confirmation and no way back.

## Layout

- `src/age` stores the age record and terms acceptance, merges store signals, and decides who can play or purchase.
- `src/compliance` signs in an anonymous Supabase user after a 13+ confirmation and syncs consent records. `upgradeAnonymousAccount` is a stub.
- `src/config/legal.ts` holds the live Terms and Privacy URLs and their versions.
- `modules/age-signals` is the local native module for Apple Declared Age Range and Play Age Signals. `ios/` and `android/` are generated and are not edited by hand.
- `src/sim` is the pure simulation. It does not import React, read the clock, or generate random numbers itself. Time arrives as elapsed milliseconds. `config.ts` holds the tunable numbers.
- `src/storage` is the `PetStorage` interface and the AsyncStorage implementation. A later backend would be a second implementation.
- `src/state/usePet.ts` loads the pet, advances time on launch, foreground, and every few seconds, applies feed, rest, and pet, and saves.
- `src/ui` draws the bars, buttons, settings panel, and actor. `PetView` draws the scene and pet from state and animation cues.
- `src/screens/HomeScreen.tsx` is the active pet screen.
