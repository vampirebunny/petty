# Cursor Brief: QR Code Friend Add

## Goal

Let a player add a friend by scanning their QR code. The scan opens the Find friends screen with the handle filled in and the lookup already run. The player taps Send request. The QR is only a shortcut for typing the handle. Scanning does not create a friendship by itself.

Find friends is a full screen owned by Home, with a back button. It can cover Home, the playdate screen, and Settings. There is no Expo Router.

## Link

Every QR encodes `https://boopboop.mylisto.app/add/{handle}`.

- `{handle}` is the stored handle: 3–20 letters and digits.
- `buildFriendLink` and `parseFriendLink` live in one module. The parser accepts only that host and a single `/add/{handle}` path. Lookup lowercases the handle. `normalize_handle` stays on the reserved-word check and is not applied to the link.
- A handle that matches the signed-in handle, ignoring case, shows "That's you!" and does not call lookup.
- A missing handle and a block both show "No player found with that handle."

## My code

Settings → Friends → My code. Guests stay on the account sheet. A linked account with no handle is sent to the handle screen.

- QR from `react-native-qrcode-svg`. Dark modules, white background, quiet zone. No center logo.
- The handle under the code, for example @rosie.
- Scan a code opens the scanner.

## Scanner

Scan a code on My code, and a scan button on Find friends.

- `expo-camera` `CameraView`, QR only. Permission is requested when the scanner opens: "Boop Boop uses the camera to scan friends' codes."
- If permission is denied: a short message, a button to system settings, and "Type a handle instead."
- A Boop Boop link closes the scanner and opens Find friends with that handle. Anything else shows "That's not a Boop Boop code" and scanning continues. One code fires once.

## Deep links

`Linking.getInitialURL` and the URL event. Invalid links are ignored. A valid handle is saved until Home is on screen and the handle prompt is finished.

- Linked account: open Find friends, then clear the saved handle.
- Guest: show the account sheet. Cancel clears the saved handle. After the account is linked, open Find friends and clear it.
- Still onboarding: keep the handle until Home.

Universal links need a development build. Expo Go will not open `https://boopboop.mylisto.app/add/...`.

Android claims `/add/` so `/address` is left alone. iOS already has `applinks:boopboop.mylisto.app`.

## Find friends results

Reuse the current labels. An incoming request shows Accept and Decline. Cooldown stays "You can't send another request yet."

## Website

`apple-app-site-association` keeps `/get` and `/get/*` and adds `/add/*`, for team `89T43H6V58` and bundle `app.mylisto.boop`.

`/add/:handle` rewrites to one static page. The page reads and escapes the handle, shows the icon and "Add @{handle} on Boop Boop," and says to search that handle in Find friends after installing. Store badges match `/get`. There is no timed store redirect while the store URLs are empty. `/.well-known` is not redirected.

`assetlinks.json` waits on the Play signing fingerprint.

## Out of scope

Profile pages, automatic friending, deferred deep links, rotating codes, a center logo, and sharing the QR image. The invite banner already shares the app.
