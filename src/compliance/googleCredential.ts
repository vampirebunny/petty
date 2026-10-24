import { Platform } from 'react-native';

import type { AuthCredential } from './appleCredential';

let configured = false;

/** Native Google sign-in. This library version has no nonce argument. */
export async function signInWithGoogle(): Promise<AuthCredential | null> {
  const { GoogleSignin, statusCodes } = await import('@react-native-google-signin/google-signin');
  if (!configured) {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    if (!webClientId) {
      throw new Error('Google sign-in is not configured');
    }
    GoogleSignin.configure({ webClientId, iosClientId });
    configured = true;
  }
  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }
  try {
    const result = await GoogleSignin.signIn();
    if (result.type !== 'success' || !result.data.idToken) {
      return null;
    }
    return { provider: 'google', idToken: result.data.idToken, rawNonce: null };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }
    throw error;
  }
}
