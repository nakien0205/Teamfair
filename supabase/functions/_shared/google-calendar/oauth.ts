/**
 * Google OAuth 2.0 PKCE and Token Exchange Contracts
 */

export const FROZEN_GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events.owned',
  'https://www.googleapis.com/auth/calendar.events.readonly'
];

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authEndpoint?: string;
  tokenEndpoint?: string;
  revokeEndpoint?: string;
}

export interface OAuthStateEnvelope {
  rawState: string;
  stateDigest: string;
  pkceVerifier: string;
  pkceChallenge: string;
  oidcNonce: string;
  oidcNonceDigest: string;
}

export interface TokenExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  idToken?: string;
  scope: string;
  subjectHash?: string;
}

/**
 * Converts Uint8Array to base64url string without padding
 */
function base64UrlEncode(array: Uint8Array): string {
  const str = btoa(String.fromCharCode(...array));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generates PKCE verifier, challenge, high-entropy state and OIDC nonce
 */
export async function generateOAuthStateEnvelope(): Promise<OAuthStateEnvelope> {
  const stateBytes = crypto.getRandomValues(new Uint8Array(32));
  const rawState = base64UrlEncode(stateBytes);

  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const pkceVerifier = base64UrlEncode(verifierBytes);

  const encoder = new TextEncoder();
  const challengeBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(pkceVerifier));
  const pkceChallenge = base64UrlEncode(new Uint8Array(challengeBuffer));

  const oidcNonceBytes = crypto.getRandomValues(new Uint8Array(32));
  const oidcNonce = base64UrlEncode(oidcNonceBytes);

  const stateHashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawState));
  const stateDigest = Array.from(new Uint8Array(stateHashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const nonceHashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(oidcNonce));
  const oidcNonceDigest = Array.from(new Uint8Array(nonceHashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    rawState,
    stateDigest,
    pkceVerifier,
    pkceChallenge,
    oidcNonce,
    oidcNonceDigest
  };
}

/**
 * Constructs Google Authorization URL with required query parameters
 */
export function buildAuthorizationUrl(config: OAuthConfig, envelope: OAuthStateEnvelope): string {
  const authBase = config.authEndpoint || 'https://accounts.google.com/o/oauth2/v2/auth';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: FROZEN_GOOGLE_SCOPES.join(' '),
    state: envelope.rawState,
    code_challenge: envelope.pkceChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
    nonce: envelope.oidcNonce
  });

  return `${authBase}?${params.toString()}`;
}

/**
 * Exchanges authorization code for tokens using PKCE
 */
export async function exchangeCodeForTokens(
  code: string,
  pkceVerifier: string,
  config: OAuthConfig,
  fetchFn: typeof fetch = fetch
): Promise<TokenExchangeResult> {
  const tokenEndpoint = config.tokenEndpoint || 'https://oauth2.googleapis.com/token';

  const bodyParams = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: pkceVerifier
  });

  const response = await fetchFn(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Token exchange response missing access_token');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 3600,
    idToken: data.id_token,
    scope: data.scope || ''
  };
}

/**
 * Revokes refresh token with Google revocation endpoint
 */
export async function revokeToken(
  token: string,
  revokeEndpoint: string = 'https://oauth2.googleapis.com/revoke',
  fetchFn: typeof fetch = fetch
): Promise<boolean> {
  try {
    const response = await fetchFn(revokeEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString()
    });
    return response.ok;
  } catch (err) {
    return false;
  }
}
