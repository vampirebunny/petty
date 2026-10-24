import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { getSupabase } from './supabase';

export const appleAuthRedirect = 'boopboop://auth-callback';

/** The one credential a sign-in sheet may hand to link or restore. Phase C calls this. */
export type AuthCredential = {
  provider: 'apple' | 'google';
  idToken: string | null;
  rawNonce: string | null;
  authorizationCode?: string;
  pkceCode?: string;
  /** Android Apple only. Present when Supabase returns one. Never an authorization code. */
  providerRefreshToken?: string;
};

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function randomNonce(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
}

async function signInWithAppleIos(): Promise<AuthCredential | null> {
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    return null;
  }
  const rawNonce = randomNonce();
  const hashedNonce = await sha256Hex(rawNonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) {
      return null;
    }
    return {
      provider: 'apple',
      idToken: credential.identityToken,
      rawNonce,
      authorizationCode: credential.authorizationCode ?? undefined,
    };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === 'ERR_REQUEST_CANCELED') {
      return null;
    }
    throw error;
  }
}

async function signInWithAppleAndroid(): Promise<AuthCredential | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }
  const oauth = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: appleAuthRedirect, skipBrowserRedirect: true },
  });
  if (oauth.error || !oauth.data.url) {
    throw oauth.error ?? new Error('Apple sign-in did not return a URL');
  }
  const result = await WebBrowser.openAuthSessionAsync(oauth.data.url, appleAuthRedirect);
  if (result.type !== 'success') {
    return null;
  }
  const code = new URL(result.url).searchParams.get('code');
  if (!code) {
    return null;
  }
  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (exchanged.error) {
    throw exchanged.error;
  }
  return {
    provider: 'apple',
    idToken: null,
    rawNonce: null,
    pkceCode: code,
    providerRefreshToken: exchanged.data.session?.provider_refresh_token ?? undefined,
  };
}

function redirectParam(url: string, key: string): string | null {
  const parsed = new URL(url);
  return parsed.searchParams.get(key) ?? new URLSearchParams(parsed.hash.replace(/^#/, '')).get(key);
}

/**
 * Android guest linking. Opens the `linkIdentity` URL and returns the PKCE code.
 * Does not call `exchangeCodeForSession` or `signInWithOAuth`.
 */
export async function beginAppleLink(): Promise<AuthCredential | null> {
  if (Platform.OS === 'ios') {
    return signInWithAppleIos();
  }
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }
  const oauth = await supabase.auth.linkIdentity({
    provider: 'apple',
    options: { redirectTo: appleAuthRedirect, skipBrowserRedirect: true },
  });
  if (oauth.error || !oauth.data.url) {
    throw oauth.error ?? new Error('Apple sign-in did not return a URL');
  }
  const result = await WebBrowser.openAuthSessionAsync(oauth.data.url, appleAuthRedirect);
  if (result.type !== 'success') {
    return null;
  }
  const described = redirectParam(result.url, 'error_description') ?? redirectParam(result.url, 'error');
  if (described) {
    throw new Error(described);
  }
  const code = redirectParam(result.url, 'code');
  if (!code) {
    return null;
  }
  return {
    provider: 'apple',
    idToken: null,
    rawNonce: null,
    pkceCode: code,
  };
}

export async function signInWithApple(): Promise<AuthCredential | null> {
  if (Platform.OS === 'ios') {
    return signInWithAppleIos();
  }
  return signInWithAppleAndroid();
}
