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
