// ABOUTME: Shared search query utilities
// ABOUTME: Guards and sanitizers reused across search hooks

/**
 * Detect URL-like input that causes Funnelcake 500 errors.
 * See: https://github.com/divinevideo/divine-web/issues/166
 */
export function isUrlLikeQuery(query: string): boolean {
  return /^https?:\/\//i.test(query.trim());
}
