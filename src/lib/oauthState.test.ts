// ABOUTME: Tests for OAuth state management utilities
// ABOUTME: Verifies localStorage operations for PKCE flow

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveOAuthState, getOAuthState, clearOAuthState } from './oauthState';

describe('OAuth State Management', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('should save and retrieve OAuth state', () => {
    const state = {
      codeVerifier: 'test-verifier',
      returnTo: '/home',
      nonce: 'abc123',
    };
    saveOAuthState(state);
    const retrieved = getOAuthState();
    expect(retrieved?.codeVerifier).toBe(state.codeVerifier);
    expect(retrieved?.returnTo).toBe(state.returnTo);
    expect(retrieved?.nonce).toBe(state.nonce);
    expect(retrieved?.createdAt).toBeDefined();
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
    localStorage.setItem('keycast_oauth_state', 'not-json');
    expect(getOAuthState()).toBeNull();
  });

  it('should expire state after 10 minutes', () => {
    saveOAuthState({ codeVerifier: 'test', returnTo: '/', nonce: 'xyz' });
    expect(getOAuthState()).not.toBeNull();

    // Advance time by 11 minutes
    vi.advanceTimersByTime(11 * 60 * 1000);

    expect(getOAuthState()).toBeNull();
  });
});
