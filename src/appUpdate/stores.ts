import { Platform } from 'react-native';

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.mylisto.boop';

// Placeholder until the App Store listing is approved. Replace the id with the real one.
export const APP_STORE_URL = 'https://apps.apple.com/app/id000000000';

export function storeUrl(os: string = Platform.OS): string {
  return os === 'android' ? PLAY_STORE_URL : APP_STORE_URL;
}
