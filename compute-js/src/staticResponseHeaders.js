// ABOUTME: Header normalization for static content served through Fastly Compute.
// ABOUTME: Keeps HTML fresh while preserving long-lived caching for hashed assets.

export function applyStaticResponseHeaders(headers, { isHtml = false, decoded = false } = {}) {
  const next = new Headers(headers);
  next.append('Vary', 'X-Original-Host');

  if (isHtml) {
    next.set('Cache-Control', 'no-store');
    // Fastly's surrogate cache honors Surrogate-Control when present.
    next.set('Surrogate-Control', 'no-store');
  }

  // When the caller has read the body back as a string (e.g. response.text() to
  // inject feed data), it is now identity-encoded plain text. The original headers
  // were copied from the compressed publisher response, so they still advertise
  // Content-Encoding: br/gzip plus a now-wrong Content-Length/ETag. Serving identity
  // bytes under those headers makes the browser fail to decompress -> "Content
  // Encoding Error". Drop the headers that are coupled to the original byte stream.
  if (decoded) {
    next.delete('Content-Encoding');
    next.delete('Content-Length');
    next.delete('ETag');
  }

  return next;
}
