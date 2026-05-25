const APP_LINK_WELL_KNOWN_PATHS = new Set([
  '/.well-known/apple-app-site-association',
  '/.well-known/assetlinks.json',
]);

export function shouldServeWellKnownBeforeWwwRedirect(hostname, pathname) {
  return hostname.startsWith('www.') && APP_LINK_WELL_KNOWN_PATHS.has(pathname);
}

export function isJsonWellKnownPath(pathname) {
  return pathname.endsWith('.json') || pathname.endsWith('/apple-app-site-association');
}
