# Boop Boop

A small offline virtual pet. One blob has fullness, energy, and happiness. Those needs change with real time, including while the app is closed. There is no account, server, or network call.

## Run

```sh
npm install
npm test
npx expo start
```

Open the project in Expo Go on a phone signed into the same Expo account as this machine. The dev server prints a QR code.

Feed and Rest are the buttons under the blob. Tap or stroke the blob to pet it. Debug, at the bottom, jumps 1, 6, or 24 hours and can reset the pet.

## Layout

This matches the prototype brief.

- `src/sim` is the pure simulation. It does not import React, read the clock, or generate random numbers itself. Time arrives as elapsed milliseconds. `config.ts` holds the tunable numbers.
- `src/storage` is the `PetStorage` interface and the AsyncStorage implementation. A later backend would be a second implementation.
- `src/state/usePet.ts` loads the pet, advances time on launch, foreground, and every few seconds, applies feed, rest, and pet, and saves.
- `src/ui` draws the bars, buttons, debug panel, and blob. `PetView` only receives the needs, mood, and animation cue.
- `src/screens/HomeScreen.tsx` is the one screen.
