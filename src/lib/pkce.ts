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
