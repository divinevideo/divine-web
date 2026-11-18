// ABOUTME: Canonical platform names for NIP-39 identity claims, shared by every place
// ABOUTME: that matches a claim (the published list, the verification cache, the verifier).

/**
 * Trims and lowercases a claim's platform and reads `x` as `twitter`, as
 * parseIdentityTag and the verifier both do.
 */
export function canonicalPlatform(platform: string): string {
  const normalized = platform.trim().toLowerCase();
  return normalized === 'x' ? 'twitter' : normalized;
}
