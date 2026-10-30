# Firebase

Push delivery credentials and Analytics for the Boop Boop mobile app. Remote friend-request pushes still go through the **Expo Push Service**; Firebase supplies Android FCM (and the Analytics SDK). iOS remote push uses the APNs key on EAS, not Firebase Messaging.

## Project

| | |
| --- | --- |
| Firebase project | `boop-boop-50b91` |
| Console | https://console.firebase.google.com/project/boop-boop-50b91 |
| iOS bundle / Android package | `app.mylisto.boop` |
| Expo project | `@vampirebunny/boop-boop` (`extra.eas.projectId` in `app.json`) |

## Config files (in repo)

| File | Role |
| --- | --- |
| `google-services.json` | Android client config (FCM registration + Analytics). Safe to commit. |
| `GoogleService-Info.plist` | iOS client config. Safe to commit. |

Wired in `app.json` as `android.googleServicesFile` and `ios.googleServicesFile`. On prebuild / EAS Build, Expo copies them into the native projects and applies the Google services Gradle plugin. Do **not** follow Firebase’s manual Gradle “Add Firebase SDK” steps, and do **not** edit `android/` or `ios/` by hand.

`IS_ANALYTICS_ENABLED` in the plist is often `false` even when Analytics is linked in the console. Treat the Firebase console + the Analytics native library as source of truth, not that flag.

## Remote push (friend requests)

### Client

- Library: `expo-notifications`
- Token registration: `src/friends/push.ts` (`getExpoPushTokenAsync` with the EAS `projectId`)
- Stores token via `register_push_token` / `unregister_push_token` into `push_tokens`
- Android channel: `friends`
- A tap opens the friend-request modal when `data.kind === 'friend_request'`, and the friend-game invite when `data.kind === 'friend_game'`
- The same modals open immediately when that push arrives while the app is in the foreground. A closed or backgrounded app shows the system notification when permission is granted; a tap opens the modal

### Server

- Edge function: `supabase/functions/notify_friend_request`
- Friend-game invite pushes use the same Expo endpoint, tokens, `notification_settings.friend_requests` check, and block check, with `data.kind === 'friend_game'`
- Sends to `https://exp.host/--/api/v2/push/send` with Expo push tokens
- Deletes `DeviceNotRegistered` tokens

### Local care reminders

Separate path: `src/reminders/notifications.ts` schedules **local** notifications only (channel `care` on Android). No Expo Push / FCM involved.

### EAS credentials (required to deliver)

| Platform | Credential | Where |
| --- | --- | --- |
| iOS | Apple Push Key (APNs) | `eas credentials` → iOS → Push Notifications |
| Android | FCM V1 **service account** JSON | Firebase → Project settings → Service accounts → Generate new private key, then `eas credentials` → Android → Google Service Account → FCM V1 |

The FCM V1 private key is **not** `google-services.json`. Do not commit it. Upload only to EAS.

After changing Google services files or notification native config, ship a **new native build**. OTA / `eas update` is not enough for first-time FCM wiring.

## Analytics

### Packages and config

- `@react-native-firebase/app` and `@react-native-firebase/analytics`
- Plugins in `app.json` (Analytics uses `ios.withoutAdIdSupport: true` so the iOS build does not pull IDFA / AdSupport)
- `expo-build-properties` iOS: `useFrameworks: "dynamic"` (required for React Native Firebase / Firebase Apple SDK SPM)

Requires a development or store build — not Expo Go.

### Usage

Automatic events (`first_open`, `session_start`, etc.) start once Analytics is linked and a build with the SDK is installed. Custom events (when product asks for them):

```ts
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';

await logEvent(getAnalytics(), 'event_name');
```

Keep parameters free of personal data (handles, emails, tokens, exact ages). See the PRD privacy notes and update store privacy labels when custom events ship.

### Verify

- Firebase console **Realtime** after a production/preview install
- DebugView needs platform debug flags (`-FIRAnalyticsDebugEnabled` / `adb shell setprop debug.firebase.analytics.app app.mylisto.boop`)

## Privacy

- Audience includes children: no Ad ID support on iOS Analytics; do not add AdMob or IDFA without a product decision
- Analytics events must stay free of personal data
- Push tokens are account device credentials; unregister on active-device handoff and account wipe (`unregisterFriendPushToken`)
