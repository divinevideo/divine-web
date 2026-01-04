// ABOUTME: Keycast Identity Server API client for custodial Nostr identity
// ABOUTME: Handles registration, login, and bunker URL retrieval for email-based auth

const KEYCAST_API_URL = 'https://oauth.divine.video';

// OAuth configuration for login.divine.video
export const KEYCAST_OAUTH_URL = 'https://login.divine.video';
export const OAUTH_CLIENT_ID = 'divine-web';
export const OAUTH_REDIRECT_URI = typeof window !== 'undefined'
  ? `${window.location.origin}/auth/callback`
  : 'https://divine.video/auth/callback';

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

export interface KeycastBunkerResponse {
  bunker_url: string;
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

/**
 * Get NIP-46 bunker URL for authenticated user
 * @param token - JWT token from register or login
 * @returns Bunker URL for remote signing via NIP-46
 */
export async function getBunkerUrl(token: string): Promise<string> {
  const response = await fetch(`${KEYCAST_API_URL}/api/user/bunker`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data: KeycastBunkerResponse | KeycastError = await response.json();

  if (!response.ok) {
    throw new Error(
      (data as KeycastError).error || 'Failed to get bunker URL'
    );
  }

  return (data as KeycastBunkerResponse).bunker_url;
}

export interface OAuthAuthorizeParams {
  codeChallenge: string;
  state: string;
  /** If true, shows registration form by default on Keycast */
  signup?: boolean;
}

/**
 * Build the OAuth authorization URL for Keycast
 */
export function buildOAuthAuthorizeUrl(params: OAuthAuthorizeParams): string {
  const url = new URL('/api/oauth/authorize', KEYCAST_OAUTH_URL);
  url.searchParams.set('client_id', OAUTH_CLIENT_ID);
  url.searchParams.set('redirect_uri', OAUTH_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  if (params.signup) {
    url.searchParams.set('default_register', 'true');
  }
  return url.toString();
}

export interface TokenExchangeResponse {
  token: string;
  pubkey: string;
}

/**
 * Exchange authorization code for JWT token
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string
): Promise<TokenExchangeResponse> {
  const response = await fetch(`${KEYCAST_OAUTH_URL}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: OAUTH_CLIENT_ID,
      redirect_uri: OAUTH_REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Token exchange failed');
  }

  return {
    token: data.access_token,
    pubkey: data.pubkey,
  };
}
