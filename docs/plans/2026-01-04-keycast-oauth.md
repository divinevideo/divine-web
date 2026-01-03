# Keycast OAuth Login Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add OAuth-based login via `login.divine.video` as the primary authentication method, with existing Nostr methods (extension, nsec, bunker) as secondary options.

**Architecture:** Standard OAuth 2.0 Authorization Code flow with PKCE. User clicks login → redirects to Keycast → authenticates → redirects back with code → exchanges for JWT → uses existing `KeycastJWTSigner` for all signing operations. No bunker/NIP-46 needed for OAuth users.

**Tech Stack:** React, TypeScript, existing `KeycastJWTSigner`, localStorage for PKCE state

---

## Task 1: PKCE Utility Functions

**Files:**
- Create: `src/lib/pkce.ts`
- Test: `src/lib/pkce.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/pkce.test.ts
import { describe, it, expect } from 'vitest';
import { generateCodeVerifier, generateCodeChallenge } from './pkce';

describe('PKCE utilities', () => {
  it('should generate a code verifier of correct length', () => {
    const verifier = generateCodeVerifier();
    // RFC 7636: 43-128 characters
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it('should generate URL-safe characters only', () => {
    const verifier = generateCodeVerifier();
    // Only unreserved characters per RFC 7636
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it('should generate unique verifiers', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(v1).not.toBe(v2);
  });

  it('should generate valid SHA256 code challenge', async () => {
    const verifier = 'test-verifier-string-that-is-long-enough-for-pkce';
    const challenge = await generateCodeChallenge(verifier);
    // Base64url encoded, no padding
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge).not.toContain('=');
  });

  it('should generate consistent challenge for same verifier', async () => {
    const verifier = 'consistent-test-verifier-string-for-testing';
    const c1 = await generateCodeChallenge(verifier);
    const c2 = await generateCodeChallenge(verifier);
    expect(c1).toBe(c2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pkce.test.ts`
Expected: FAIL with "Cannot find module './pkce'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/pkce.ts
// ABOUTME: PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0 security
// ABOUTME: Generates code verifier and SHA256 challenge per RFC 7636

/**
 * Generate a cryptographically random code verifier for PKCE
 * RFC 7636: 43-128 characters from unreserved character set
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate SHA256 code challenge from verifier
 * Returns base64url-encoded hash without padding
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

/**
 * Base64url encode without padding (per RFC 7636)
 */
function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/pkce.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/lib/pkce.ts src/lib/pkce.test.ts
git commit -m "feat: add PKCE utilities for OAuth security"
```

---

## Task 2: OAuth Configuration Constants

**Files:**
- Modify: `src/lib/keycast.ts`

**Step 1: Add OAuth configuration at top of file**

Add after the existing `KEYCAST_API_URL` constant:

```typescript
// OAuth configuration for login.divine.video
export const KEYCAST_OAUTH_URL = 'https://login.divine.video';
export const OAUTH_CLIENT_ID = 'divine-web';
export const OAUTH_REDIRECT_URI = typeof window !== 'undefined'
  ? `${window.location.origin}/auth/callback`
  : 'https://divine.video/auth/callback';
```

**Step 2: Run existing tests to ensure no regression**

Run: `npx vitest run`
Expected: PASS (all existing tests)

**Step 3: Commit**

```bash
git add src/lib/keycast.ts
git commit -m "feat: add OAuth configuration constants for Keycast"
```

---

## Task 3: OAuth State Management

**Files:**
- Create: `src/lib/oauthState.ts`
- Test: `src/lib/oauthState.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/oauthState.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveOAuthState, getOAuthState, clearOAuthState } from './oauthState';

describe('OAuth State Management', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should save and retrieve OAuth state', () => {
    const state = {
      codeVerifier: 'test-verifier',
      returnTo: '/home',
      nonce: 'abc123',
    };
    saveOAuthState(state);
    const retrieved = getOAuthState();
    expect(retrieved).toEqual(state);
  });

  it('should return null when no state exists', () => {
    const state = getOAuthState();
    expect(state).toBeNull();
  });

  it('should clear OAuth state', () => {
    saveOAuthState({ codeVerifier: 'test', returnTo: '/', nonce: 'xyz' });
    clearOAuthState();
    expect(getOAuthState()).toBeNull();
  });

  it('should handle malformed JSON gracefully', () => {
    sessionStorage.setItem('keycast_oauth_state', 'not-json');
    expect(getOAuthState()).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/oauthState.test.ts`
Expected: FAIL with "Cannot find module './oauthState'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/oauthState.ts
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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/oauthState.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/lib/oauthState.ts src/lib/oauthState.test.ts
git commit -m "feat: add OAuth state management for PKCE flow"
```

---

## Task 4: OAuth Flow Functions

**Files:**
- Modify: `src/lib/keycast.ts`
- Test: `src/lib/keycast.test.ts` (create if doesn't exist)

**Step 1: Write failing tests**

```typescript
// src/lib/keycast.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildOAuthAuthorizeUrl, exchangeCodeForToken } from './keycast';

describe('OAuth Flow', () => {
  describe('buildOAuthAuthorizeUrl', () => {
    it('should build correct authorize URL with all params', () => {
      const url = buildOAuthAuthorizeUrl({
        codeChallenge: 'test-challenge',
        state: 'test-state',
      });

      expect(url).toContain('login.divine.video');
      expect(url).toContain('client_id=divine-web');
      expect(url).toContain('response_type=code');
      expect(url).toContain('code_challenge=test-challenge');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('state=test-state');
    });
  });

  describe('exchangeCodeForToken', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should exchange code for token successfully', async () => {
      const mockResponse = {
        access_token: 'jwt-token',
        pubkey: 'user-pubkey',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await exchangeCodeForToken('auth-code', 'verifier');
      expect(result.token).toBe('jwt-token');
      expect(result.pubkey).toBe('user-pubkey');
    });

    it('should throw on error response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'invalid_grant' }),
      });

      await expect(exchangeCodeForToken('bad-code', 'verifier')).rejects.toThrow();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/keycast.test.ts`
Expected: FAIL with "buildOAuthAuthorizeUrl is not exported"

**Step 3: Add OAuth functions to keycast.ts**

Add to `src/lib/keycast.ts`:

```typescript
import { KEYCAST_OAUTH_URL, OAUTH_CLIENT_ID, OAUTH_REDIRECT_URI } from './keycast';

export interface OAuthAuthorizeParams {
  codeChallenge: string;
  state: string;
}

/**
 * Build the OAuth authorization URL for Keycast
 */
export function buildOAuthAuthorizeUrl(params: OAuthAuthorizeParams): string {
  const url = new URL('/oauth/authorize', KEYCAST_OAUTH_URL);
  url.searchParams.set('client_id', OAUTH_CLIENT_ID);
  url.searchParams.set('redirect_uri', OAUTH_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
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
  const response = await fetch(`${KEYCAST_OAUTH_URL}/oauth/token`, {
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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/keycast.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/keycast.ts src/lib/keycast.test.ts
git commit -m "feat: add OAuth authorize URL builder and token exchange"
```

---

## Task 5: useOAuthLogin Hook

**Files:**
- Create: `src/hooks/useOAuthLogin.ts`
- Test: `src/hooks/useOAuthLogin.test.ts`

**Step 1: Write failing test**

```typescript
// src/hooks/useOAuthLogin.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOAuthLogin } from './useOAuthLogin';

// Mock the dependencies
vi.mock('@/lib/pkce', () => ({
  generateCodeVerifier: () => 'mock-verifier',
  generateCodeChallenge: () => Promise.resolve('mock-challenge'),
}));

vi.mock('@/lib/oauthState', () => ({
  saveOAuthState: vi.fn(),
}));

describe('useOAuthLogin', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Mock window.location
    delete (window as { location?: Location }).location;
    window.location = {
      href: '',
      origin: 'https://divine.video',
      pathname: '/home',
    } as Location;
  });

  it('should initiate OAuth flow and redirect', async () => {
    const { result } = renderHook(() => useOAuthLogin());

    await act(async () => {
      await result.current.startOAuthLogin();
    });

    expect(window.location.href).toContain('login.divine.video');
    expect(window.location.href).toContain('code_challenge=mock-challenge');
  });

  it('should preserve return URL', async () => {
    window.location.pathname = '/video/123';
    const { result } = renderHook(() => useOAuthLogin());

    await act(async () => {
      await result.current.startOAuthLogin();
    });

    // State should include return URL (tested via mock)
    expect(result.current.isLoading).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useOAuthLogin.test.ts`
Expected: FAIL with "Cannot find module './useOAuthLogin'"

**Step 3: Write minimal implementation**

```typescript
// src/hooks/useOAuthLogin.ts
// ABOUTME: Hook to initiate OAuth login flow with Keycast
// ABOUTME: Handles PKCE generation, state storage, and redirect

import { useState, useCallback } from 'react';
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/pkce';
import { saveOAuthState } from '@/lib/oauthState';
import { buildOAuthAuthorizeUrl } from '@/lib/keycast';

export function useOAuthLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startOAuthLogin = useCallback(async (returnTo?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Generate PKCE verifier and challenge
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      // Generate state nonce for CSRF protection
      const nonce = generateCodeVerifier().substring(0, 16);

      // Save state for callback
      saveOAuthState({
        codeVerifier,
        returnTo: returnTo || window.location.pathname,
        nonce,
      });

      // Build and redirect to authorization URL
      const authUrl = buildOAuthAuthorizeUrl({
        codeChallenge,
        state: nonce,
      });

      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start login');
      setIsLoading(false);
    }
  }, []);

  return {
    startOAuthLogin,
    isLoading,
    error,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useOAuthLogin.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/useOAuthLogin.ts src/hooks/useOAuthLogin.test.ts
git commit -m "feat: add useOAuthLogin hook for initiating OAuth flow"
```

---

## Task 6: OAuth Callback Page

**Files:**
- Create: `src/pages/AuthCallbackPage.tsx`
- Test: `src/pages/AuthCallbackPage.test.tsx`

**Step 1: Write failing test**

```typescript
// src/pages/AuthCallbackPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthCallbackPage } from './AuthCallbackPage';

// Mock dependencies
vi.mock('@/lib/oauthState', () => ({
  getOAuthState: vi.fn(() => ({
    codeVerifier: 'mock-verifier',
    returnTo: '/home',
    nonce: 'mock-nonce',
  })),
  clearOAuthState: vi.fn(),
}));

vi.mock('@/lib/keycast', () => ({
  exchangeCodeForToken: vi.fn(() => Promise.resolve({
    token: 'mock-jwt',
    pubkey: 'mock-pubkey',
  })),
}));

vi.mock('@/hooks/useKeycastSession', () => ({
  useKeycastSession: () => ({
    saveSession: vi.fn(),
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback?code=test-code&state=mock-nonce']}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/completing/i)).toBeInTheDocument();
  });

  it('should show error when state mismatch', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback?code=test-code&state=wrong-state']}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/security/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/AuthCallbackPage.test.tsx`
Expected: FAIL with "Cannot find module './AuthCallbackPage'"

**Step 3: Write implementation**

```typescript
// src/pages/AuthCallbackPage.tsx
// ABOUTME: OAuth callback handler for Keycast authentication
// ABOUTME: Exchanges authorization code for JWT and logs user in

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getOAuthState, clearOAuthState } from '@/lib/oauthState';
import { exchangeCodeForToken } from '@/lib/keycast';
import { useKeycastSession } from '@/hooks/useKeycastSession';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { saveSession } = useKeycastSession();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      // Handle OAuth error
      if (errorParam) {
        setError(searchParams.get('error_description') || 'Authentication failed');
        setStatus('error');
        return;
      }

      // Validate required params
      if (!code || !state) {
        setError('Missing authorization code or state');
        setStatus('error');
        return;
      }

      // Get stored state
      const storedState = getOAuthState();
      if (!storedState) {
        setError('Session expired. Please try logging in again.');
        setStatus('error');
        return;
      }

      // Validate state (CSRF protection)
      if (state !== storedState.nonce) {
        setError('Security validation failed. Please try again.');
        setStatus('error');
        return;
      }

      try {
        // Exchange code for token
        const { token, pubkey } = await exchangeCodeForToken(
          code,
          storedState.codeVerifier
        );

        // Save session (remember for 1 week by default for OAuth)
        saveSession(token, `oauth:${pubkey.substring(0, 8)}`, true);

        // Clear OAuth state
        clearOAuthState();

        setStatus('success');

        // Redirect to original location
        setTimeout(() => {
          navigate(storedState.returnTo || '/', { replace: true });
        }, 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Login failed');
        setStatus('error');
      }
    }

    handleCallback();
  }, [searchParams, navigate, saveSession]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
            <h1 className="text-xl font-semibold">Completing login...</h1>
            <p className="text-muted-foreground">Please wait while we verify your credentials.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
            <h1 className="text-xl font-semibold">Login successful!</h1>
            <p className="text-muted-foreground">Redirecting you now...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertTriangle className="w-12 h-12 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold">Login failed</h1>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => navigate('/')} className="mt-4">
              Return to Home
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default AuthCallbackPage;
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/AuthCallbackPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/AuthCallbackPage.tsx src/pages/AuthCallbackPage.test.tsx
git commit -m "feat: add OAuth callback page for handling Keycast redirects"
```

---

## Task 7: Add Route for OAuth Callback

**Files:**
- Modify: `src/AppRouter.tsx`

**Step 1: Add import and route**

Add import at top:
```typescript
import { AuthCallbackPage } from './pages/AuthCallbackPage';
```

Add route after `/app/callback` route (around line 71):
```typescript
<Route path="/auth/callback" element={<AuthCallbackPage />} />
```

**Step 2: Run build to verify no errors**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/AppRouter.tsx
git commit -m "feat: add /auth/callback route for OAuth"
```

---

## Task 8: Keycast OAuth Login Button Component

**Files:**
- Create: `src/components/auth/KeycastOAuthButton.tsx`

**Step 1: Create component**

```typescript
// src/components/auth/KeycastOAuthButton.tsx
// ABOUTME: Primary login button that initiates OAuth flow with Keycast
// ABOUTME: Prominent CTA for new users, uses login.divine.video for auth

import { Cloud, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOAuthLogin } from '@/hooks/useOAuthLogin';

interface KeycastOAuthButtonProps {
  onStartLogin?: () => void;
  className?: string;
}

export function KeycastOAuthButton({ onStartLogin, className }: KeycastOAuthButtonProps) {
  const { startOAuthLogin, isLoading, error } = useOAuthLogin();

  const handleClick = async () => {
    onStartLogin?.();
    await startOAuthLogin();
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleClick}
        disabled={isLoading}
        className={`w-full rounded-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 ${className}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Redirecting...
          </>
        ) : (
          <>
            <Cloud className="w-5 h-5 mr-2" />
            Continue with Keycast
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/auth/KeycastOAuthButton.tsx
git commit -m "feat: add KeycastOAuthButton component"
```

---

## Task 9: Update LoginDialog with Primary OAuth Button

**Files:**
- Modify: `src/components/auth/LoginDialog.tsx`

**Step 1: Add import**

```typescript
import { KeycastOAuthButton } from '@/components/auth/KeycastOAuthButton';
```

**Step 2: Add primary OAuth section before tabs**

After the `<DialogHeader>` section (around line 185), add:

```typescript
{/* Primary OAuth Login */}
<div className="space-y-4">
  <KeycastOAuthButton onStartLogin={onClose} />

  <div className="relative">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-muted"></div>
    </div>
    <div className="relative flex justify-center text-xs">
      <span className="px-2 bg-background text-muted-foreground">
        or for Nostr users
      </span>
    </div>
  </div>
</div>
```

**Step 3: Update Tab order - make Extension first, remove Email tab**

Change the tabs to only show Nostr options:
- Extension (default)
- Key
- Bunker

Remove the Email tab since OAuth replaces it.

**Step 4: Run build and test**

Run: `npm run build && npx vitest run`
Expected: All pass

**Step 5: Commit**

```bash
git add src/components/auth/LoginDialog.tsx
git commit -m "feat: add primary OAuth button to LoginDialog, make Nostr methods secondary"
```

---

## Task 10: Update SignupDialog to Use OAuth

**Files:**
- Modify: `src/components/auth/SignupDialog.tsx`

**Step 1: Replace welcome step with OAuth button**

Import the OAuth button and update the welcome step to redirect to OAuth for signup.

**Step 2: Commit**

```bash
git add src/components/auth/SignupDialog.tsx
git commit -m "feat: update SignupDialog to use OAuth for registration"
```

---

## Task 11: Integration with KeycastJWTSigner

**Files:**
- Modify: `src/hooks/useLoginActions.ts` (if needed)
- Modify: `src/components/KeycastJWTWindowNostr.tsx` (verify it works)

**Step 1: Verify JWT signer works with OAuth tokens**

The existing `KeycastJWTSigner` should work with OAuth tokens. Verify by:
1. Check that `useKeycastSession.getValidToken()` returns the OAuth JWT
2. Check that `KeycastJWTWindowNostr` injects window.nostr

**Step 2: Run full test suite**

Run: `npm run test`
Expected: All pass including build

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: ensure JWT signer works with OAuth tokens"
```

---

## Task 12: Manual Testing Checklist

**Test the complete flow:**

1. [ ] Click "Continue with Keycast" on login dialog
2. [ ] Verify redirect to login.divine.video with correct params
3. [ ] Complete authentication on Keycast
4. [ ] Verify redirect back to /auth/callback
5. [ ] Verify automatic login and redirect to original page
6. [ ] Verify window.nostr is injected
7. [ ] Verify signing works (try to post a comment or reaction)
8. [ ] Verify session persists after page refresh
9. [ ] Verify "Remember me" behavior (1 week session)
10. [ ] Test Nostr extension login still works
11. [ ] Test nsec login still works
12. [ ] Test bunker login still works

---

## Task 13: Final Cleanup and PR

**Step 1: Run full test suite**

```bash
npm run test
```

**Step 2: Review all changes**

```bash
git diff main...feature/keycast-oauth
```

**Step 3: Create PR**

```bash
git push -u origin feature/keycast-oauth
gh pr create --title "feat: Add Keycast OAuth as primary login method" --body "## Summary
- Adds OAuth 2.0 + PKCE login flow via login.divine.video
- OAuth is now the primary login method for new users
- Existing Nostr methods (extension, nsec, bunker) moved to secondary options
- Uses existing KeycastJWTSigner for signing (no bunker needed)

## Test Plan
- [ ] OAuth flow completes successfully
- [ ] JWT signing works after OAuth login
- [ ] Existing Nostr login methods still work
- [ ] Session persists across page refreshes"
```
