// ABOUTME: Helpers for validating relay URLs by scheme
// ABOUTME: Uses the URL constructor instead of regex for correctness

export function isWssUrl(value: string): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'wss:';
  } catch {
    return false;
  }
}