// ABOUTME: Manages OAuth state in sessionStorage for PKCE flow
// ABOUTME: Stores code verifier and return URL across redirects

const OAUTH_STATE_KEY = 'keycast_oauth_state';

export interface OAuthState {
  codeVerifier: string;
  returnTo: string;
  nonce: string;
}

export function saveOAuthState(state: OAuthState): void {
  sessionStorage.setItem(OAUTH_STATE_KEY, JSON.stringify(state));
}

export function getOAuthState(): OAuthState | null {
  try {
    const stored = sessionStorage.getItem(OAUTH_STATE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearOAuthState(): void {
  sessionStorage.removeItem(OAUTH_STATE_KEY);
}
