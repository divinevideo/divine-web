// ABOUTME: Header normalization for static content served through Fastly Compute.
// ABOUTME: Keeps HTML fresh while preserving long-lived caching for hashed assets.

export function applyStaticResponseHeaders(headers, { isHtml = false } = {}) {
  const next = new Headers(headers);
  next.append('Vary', 'X-Original-Host');

  if (isHtml) {
    next.set('Cache-Control', 'no-store');
  }

  return next;
}
