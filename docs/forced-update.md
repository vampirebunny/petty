# Forced update

`app_config` holds one row (`id = 1`) with `min_app_version`. Null means every binary may open. A value is `major.minor.patch`. An older install shows a screen with no skip and a button that opens the store.

The row is public. `anon` and `authenticated` can select it. Clients cannot write it. It lives apart from `shop_config`, so changing the minimum does not bump the shop catalog.

## Client

- Decision: `src/appUpdate/required.ts`, using `versionAllows` and `appVersion()` (`expo.version` in `app.json`).
- Read: `src/appUpdate/check.ts` selects the row at launch and again when the app becomes active. A missing client, error, or timeout (4 seconds) leaves the app open. The check does not delay startup.
- Screen: `src/screens/UpdateRequiredScreen.tsx`, shown in front of home, welcome, adopt, and the age gate.
- Development builds and web skip the check.

## Stores

- Android: `https://play.google.com/store/apps/details?id=app.mylisto.boop`
- iOS: `https://apps.apple.com/app/id000000000` in `src/appUpdate/stores.ts`. That id is a placeholder until the App Store listing is approved. Replace it with the real id.

## Turning it on

Ship the binary that contains this gate, and wait until that build is on the store you care about. Then set `app_config.min_app_version` to that version, for example `1.2.0`. Installs below it see the screen. Installs at or above it do not.

`shop_items.min_app_version` is separate. It hides one shop row on an older binary. This row blocks the whole app.
