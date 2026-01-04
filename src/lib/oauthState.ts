// ABOUTME: Manages OAuth state in localStorage for PKCE flow
// ABOUTME: Stores code verifier and return URL across redirects (uses localStorage for cross-tab persistence)

const OAUTH_STATE_KEY = 'keycast_oauth_state';

export interface OAuthState {
  codeVerifier: string;
  returnTo: string;
  nonce: string;
  /** Timestamp when state was created, for expiry check */
  createdAt: number;
}

// State expires after 10 minutes
const STATE_EXPIRY_MS = 10 * 60 * 1000;

export function saveOAuthState(state: Omit<OAuthState, 'createdAt'>): void {
  const stateWithTimestamp: OAuthState = {
    ...state,
    createdAt: Date.now(),
  };
  localStorage.setItem(OAUTH_STATE_KEY, JSON.stringify(stateWithTimestamp));
}

export function getOAuthState(): OAuthState | null {
  try {
    const stored = localStorage.getItem(OAUTH_STATE_KEY);
    if (!stored) return null;

    const state = JSON.parse(stored) as OAuthState;

    // Check if state has expired
    if (state.createdAt && Date.now() - state.createdAt > STATE_EXPIRY_MS) {
      localStorage.removeItem(OAUTH_STATE_KEY);
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

export function clearOAuthState(): void {
  localStorage.removeItem(OAUTH_STATE_KEY);
}
