# Boop Boop

A small offline virtual pet. One blob has fullness, energy, and happiness. Those needs change with real time, including while the app is closed. There is no account, server, or network call.

## Run

```sh
npm install
npm test
npx expo start
```

Open the project in Expo Go on a phone signed into the same Expo account as this machine. The dev server prints a QR code.

On the home screen the name and actor stay sticky. Need bars sit below the animation. Actions are sit, give paw, speak, sleep/wake, eat, drink, and throw ball. Idle is not a button: the pet idles on its own when nothing else is running. Any action other than sleep wakes a sleeper. Tap the stage to throw the ball; stroke to pet. `{name}'s personality` expands archetype and attribute scores. Settings (formerly Debug) jumps 1, 6, or 24 hours and can reset the pet. Its "New pet" button deletes the current pet and starts adoption again, with no confirmation and no way back.

## Layout

- `src/sim` is the pure simulation. It does not import React, read the clock, or generate random numbers itself. Time arrives as elapsed milliseconds. `config.ts` holds the tunable numbers.
- `src/storage` is the `PetStorage` interface and the AsyncStorage implementation. A later backend would be a second implementation.
- `src/state/usePet.ts` loads the pet, advances time on launch, foreground, and every few seconds, applies feed, rest, and pet, and saves.
- `src/ui` draws the bars, buttons, settings panel, and actor. `PetView` draws the scene and pet from state and animation cues.
- `src/screens/HomeScreen.tsx` is the active pet screen.
