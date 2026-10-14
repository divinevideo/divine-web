const RELAY_HINT_ROUTE_PREFIXES = ['/event', '/people-lists'];

function canConsumeRelayHints(path: string): boolean {
  return RELAY_HINT_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function parseRelayHints(search: string): string[] {
  const params = new URLSearchParams(search);
  return params
    .getAll('relays')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function appendRelayHints(path: string, relayHints?: string[]): string {
  if (!canConsumeRelayHints(path) || !relayHints?.length) {
    return path;
  }

  const [pathname, search = ''] = path.split('?', 2);
  const params = new URLSearchParams(search);
  params.set('relays', relayHints.join(','));
  return `${pathname}?${params.toString()}`;
}
