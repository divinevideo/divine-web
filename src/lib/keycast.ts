// ABOUTME: Keycast Identity Server API client for custodial Nostr identity
// ABOUTME: Handles registration, login, and OAuth for email-based auth

// Keycast API URL - use localhost for development, login.divine.video for production
export const KEYCAST_API_URL = import.meta.env.VITE_KEYCAST_API_URL || 'https://login.divine.video';
export const OAUTH_CLIENT_ID = 'divine-web';

/** Get redirect URI dynamically based on current origin */
export function getOAuthRedirectUri(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }
  return 'https://divine.video/auth/callback';
}

export interface KeycastRegisterResponse {
  user_id: string;
  email: string;
  pubkey: string;
  token: string;
}

export interface KeycastLoginResponse {
  token: string;
  pubkey: string;
}

export interface KeycastError {
  error: string;
}

/**
 * Register a new user with Keycast identity server
 * @param email - User's email address
 * @param password - User's password (min 8 characters)
 * @returns JWT token, pubkey, and user_id
 */
export async function registerUser(
  email: string,
  password: string
): Promise<KeycastRegisterResponse> {
  const response = await fetch(`${KEYCAST_API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Registration failed');
  }

  return data;
}

/**
 * Login existing user with Keycast identity server
 * @param email - User's email address
 * @param password - User's password
 * @returns JWT token and pubkey
 */
export async function loginUser(
  email: string,
  password: string
): Promise<KeycastLoginResponse> {
  const response = await fetch(`${KEYCAST_API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }

  return data;
}

export interface OAuthAuthorizeParams {
  codeChallenge: string;
  state: string;
  /** If true, shows registration form by default on Keycast */
  signup?: boolean;
  /** Authorization handle for silent re-authentication (skips consent screen) */
  authorizationHandle?: string;
}

/**
 * Build the OAuth authorization URL for Keycast
 */
export function buildOAuthAuthorizeUrl(params: OAuthAuthorizeParams): string {
  const redirectUri = getOAuthRedirectUri();
  const url = new URL('/api/oauth/authorize', KEYCAST_API_URL);
  url.searchParams.set('client_id', OAUTH_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  if (params.signup) {
    url.searchParams.set('default_register', 'true');
  }
  if (params.authorizationHandle) {
    url.searchParams.set('authorization_handle', params.authorizationHandle);
  }
  console.log('[KeycastOAuth] Authorize URL built:', {
    redirect_uri: redirectUri,
    state: params.state.substring(0, 8) + '...',
    signup: params.signup,
    hasAuthHandle: !!params.authorizationHandle,
  });
  return url.toString();
}

export interface TokenExchangeResponse {
  token: string;
  pubkey: string;
  refreshToken?: string;
  authorizationHandle?: string;
}

/**
 * Get the user's actual pubkey by calling the Keycast API
 * This is required because bunker URLs contain the remote-signer-pubkey, not the user-pubkey
 */
async function getUserPubkey(token: string): Promise<string> {
  const response = await fetch(`${KEYCAST_API_URL}/api/nostr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ method: 'get_public_key', params: [] }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error || 'Failed to get user pubkey');
  }

  if (!data.result || typeof data.result !== 'string') {
    throw new Error('Invalid pubkey response');
  }

  return data.result;
}

/**
 * Exchange authorization code for access token and pubkey
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string
): Promise<TokenExchangeResponse> {
  const redirectUri = getOAuthRedirectUri();
  const requestBody = {
    code,
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  };

  const response = await fetch(`${KEYCAST_API_URL}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Token exchange failed');
  }

  const token = data.access_token;
  if (!token) {
    throw new Error('Missing access_token in response');
  }

  // Get the real user pubkey via the API (bunker URL contains remote-signer-pubkey, not user-pubkey)
  console.log('[exchangeCodeForToken] Getting user pubkey from API...');
  const pubkey = await getUserPubkey(token);
  console.log('[exchangeCodeForToken] User pubkey:', pubkey);

  // Extract refresh_token for silent background refresh (RFC 6749)
  const refreshToken = data.refresh_token as string | undefined;
  if (refreshToken) {
    console.log('[exchangeCodeForToken] Got refresh_token for silent refresh');
  }

  // Extract authorization_handle for consent-skip re-authentication (valid for 30 days)
  const authorizationHandle = data.authorization_handle as string | undefined;
  if (authorizationHandle) {
    console.log('[exchangeCodeForToken] Got authorization_handle for consent-skip re-auth');
  }

  return {
    token,
    pubkey,
    refreshToken,
    authorizationHandle,
  };
}

/**
 * Refresh an access token using a refresh token (OAuth 2.0 standard)
 * This enables silent re-authentication without redirects
 * Uses grant_type=refresh_token per RFC 6749 §6
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenExchangeResponse> {
  const response = await fetch(`${KEYCAST_API_URL}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: OAUTH_CLIENT_ID,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error || 'Token refresh failed');
  }

  const data = await response.json();

  // Get pubkey from API (same as initial login)
  const pubkey = await getUserPubkey(data.access_token);

  return {
    token: data.access_token,
    pubkey,
    refreshToken: data.refresh_token,  // Rotated refresh token
    authorizationHandle: data.authorization_handle,
  };
}
