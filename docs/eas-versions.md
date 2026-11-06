# Store and build versions

The user-facing version is `expo.version` in `app.json`. That string is the iOS short version and the Android version name. Change it in `app.json` and commit it. EAS does not increment it.

The developer-facing build numbers live on EAS. `eas.json` sets `cli.appVersionSource` to `remote`, and the production profile sets `autoIncrement` to `true`. A production build ignores `ios.buildNumber` and `android.versionCode` in `app.json`. EAS reads the number it has stored, adds 1, and puts that value on the binary.

`ios.buildNumber` in `app.json` still shows up in the manifest through `expo-constants`. It is not the build number on the archive.

## Read the remote numbers

```sh
npx eas-cli build:version:get -p all --json --non-interactive
```

`buildNumber` is iOS. `versionCode` is Android.

## iOS production build

`eas build:version:set` is a prompt. It has no version flag. Pass `-p ios` so the Android version code stays as it is, then enter the number.

```sh
npx eas-cli build:version:set -p ios
```

To ship iOS build `1`, set the remote build number to `0` before the production build. Auto-increment turns `0` into `1`. To ship build `N`, set the remote number to `N - 1`.

Leave `autoIncrement` on. Do not change the Android version code unless asked.
