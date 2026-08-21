const ORIGINAL_HOST_VARY = 'X-Original-Host';
const CRAWLER_VARY = `${ORIGINAL_HOST_VARY}, User-Agent`;

export const HOST_DEPENDENT_CRAWLER_VARY = CRAWLER_VARY;

export function createEdgeTemplateHeaders({
  cacheControl,
  subdomain,
  varyByUserAgent = true,
}) {
  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': cacheControl,
    'Vary': varyByUserAgent ? CRAWLER_VARY : ORIGINAL_HOST_VARY,
    'X-Divine-Edge': 'template',
  });

  if (subdomain) {
    headers.set('X-Divine-Subdomain', subdomain);
  }

  return headers;
}
