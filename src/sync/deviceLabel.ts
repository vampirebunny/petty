import { Platform } from 'react-native';

export type DeviceLabel = 'iPhone' | 'iPad' | 'Android';

export function deviceLabel(platform: string = Platform.OS, isPad = Platform.OS === 'ios' && Platform.isPad): DeviceLabel {
  if (platform === 'ios') {
    return isPad ? 'iPad' : 'iPhone';
  }
  return 'Android';
}

export function devicePhrase(label: string | null | undefined): string {
  if (label === 'iPhone' || label === 'iPad' || label === 'Android') {
    return `your ${label}`;
  }
  return 'your other device';
}
