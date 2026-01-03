// ABOUTME: Tests for OAuth state management utilities
// ABOUTME: Verifies sessionStorage operations for PKCE flow

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
