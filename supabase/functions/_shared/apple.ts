import { importPKCS8, SignJWT } from 'npm:jose@5';

function pem(secret: string): string {
  const normalized = secret.includes('\\n') ? secret.replace(/\\n/g, '\n') : secret;
  if (normalized.includes('BEGIN PRIVATE KEY')) {
    return normalized;
  }
  return `-----BEGIN PRIVATE KEY-----\n${normalized}\n-----END PRIVATE KEY-----`;
}

export async function appleClientSecret(clientId: string): Promise<string> {
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  if (!privateKey || !keyId || !teamId) {
    throw new Error('Apple signing secrets are not set');
  }
  const key = await importPKCS8(pem(privateKey), 'ES256');
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setSubject(clientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60 * 24 * 180)
    .sign(key);
}

export function appleClientId(kind: 'native' | 'web'): string {
  const name = kind === 'native' ? 'APPLE_BUNDLE_ID' : 'APPLE_SERVICES_ID';
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

/** Exchange a native authorization code. Returns the refresh token, or null when Apple refuses. */
export async function exchangeAuthorizationCode(code: string): Promise<string | null> {
  const clientId = appleClientId('native');
  const secret = await appleClientSecret(clientId);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: secret,
  });
  const response = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    console.error('apple token exchange failed', response.status, await response.text());
    return null;
  }
  const payload = (await response.json()) as { refresh_token?: string };
  return payload.refresh_token ?? null;
}

/** True when Apple accepted the revoke. A failure is logged and must not block deletion. */
export async function revokeRefreshToken(refreshToken: string, kind: 'native' | 'web'): Promise<boolean> {
  try {
    const clientId = appleClientId(kind);
    const secret = await appleClientSecret(clientId);
    const body = new URLSearchParams({
      token: refreshToken,
      client_id: clientId,
      client_secret: secret,
      token_type_hint: 'refresh_token',
    });
    const response = await fetch('https://appleid.apple.com/auth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) {
      console.error('apple revoke failed', kind, response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('apple revoke failed', kind, error);
    return false;
  }
}
