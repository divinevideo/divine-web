// ABOUTME: Tests for PKCE (Proof Key for Code Exchange) utilities
// ABOUTME: Validates RFC 7636 compliance for OAuth 2.0 security

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
