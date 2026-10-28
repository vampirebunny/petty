# Sentry

Error and performance monitoring for the Boop Boop mobile app.

## Project

| | |
| --- | --- |
| Organization | `listo-xc` |
| Project | `boop-boop` |
| Platform | React Native (Expo) |
| Dashboard | https://listo-xc.sentry.io/projects/boop-boop/ |

## Code

- Init and options: `src/monitoring/sentry.ts`
- Loaded from `index.ts` (after the default-font install, before gesture-handler), with the root app wrapped in `Sentry.wrap`
- Expo config plugin: `@sentry/react-native/expo` in `app.json` (`organization` / `project`)
- Metro: `metro.config.js` uses `getSentryExpoConfig` so release bundles get Debug IDs for source maps

## Defaults

- Errors and tracing are on
- `sendDefaultPii: false` — the audience includes children
- Session Replay is not enabled
- `environment`: `development` when `__DEV__`, otherwise `production` (preview EAS builds currently report as `production`)
- `tracesSampleRate`: `1.0` in development, `0.2` in production
- Release / dist come from the native build (`app.mylisto.boop@version+build`)

## EAS builds (source maps and debug symbols)

Release and preview uploads need an organization auth token named **`SENTRY_AUTH_TOKEN`** (sensitive) on the Expo project for the `preview` and `production` environments.

```sh
npx eas-cli@latest env:list --environment production
npx eas-cli@latest env:list --environment preview
npx eas-cli@latest env:set --name SENTRY_AUTH_TOKEN --environment production --environment preview --visibility sensitive
```

Create the token under the org’s Auth Tokens settings in Sentry (release / upload scopes). Do not put the DSN in this variable — the DSN is already in `src/monitoring/sentry.ts`.

Local release builds that should upload can set the same name in a gitignored env file or the shell. Skip upload while iterating with `SENTRY_DISABLE_AUTO_UPLOAD=true`.

After changing the Sentry plugin or native deps, regenerate natives before a local run (`npx expo prebuild --clean`, then `npx expo run:ios` / `run:android`). `ios/` and `android/` stay gitignored.

## Privacy

Prefer project settings that avoid storing IP addresses (kids’ app). Do not turn on Session Replay or `sendDefaultPii` without an explicit product decision.
