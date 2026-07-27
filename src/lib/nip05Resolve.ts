export interface ParsedNip05 {
  name: string;
  domain: string;
}

export interface ResolvedNip05 extends ParsedNip05 {
  pubkey: string;
}

export interface Nip05Parts {
  name: string;
  domain: string;
}

const NIP05_NAME_RE = /^[a-zA-Z0-9._-]+$/;
const NIP05_DOMAIN_RE = /^[a-zA-Z0-9.-]+$/;

function isValidNip05Parts(name: string, domain: string): boolean {
  return Boolean(domain)
    && domain.includes('.')
    && NIP05_DOMAIN_RE.test(domain)
    && NIP05_NAME_RE.test(name);
}

export function parseNip05Handle(raw: string): ParsedNip05 | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    const [namePart, domainPart] = trimmed.split('@', 2);
    const name = namePart || '_';
    if (!domainPart || !isValidNip05Parts(name, domainPart)) return null;
    return { name, domain: domainPart };
  }

  if (isValidNip05Parts('_', trimmed)) {
    return { name: '_', domain: trimmed };
  }
  return null;
}

export function parseNip05(nip05: string): Nip05Parts | null {
  const trimmed = nip05.trim();
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex === -1) return null;

  const name = trimmed.slice(0, atIndex) || '_';
  const domain = trimmed.slice(atIndex + 1);

  if (!domain || !NIP05_DOMAIN_RE.test(domain)) return null;
  if (!NIP05_NAME_RE.test(name)) return null;

  return { name, domain };
}

export async function resolveNip05(
  handle: string,
  signal?: AbortSignal,
): Promise<ResolvedNip05 | null> {
  const parsed = parseNip05Handle(handle);
  if (!parsed) return null;
  const url = `https://${parsed.domain}/.well-known/nostr.json?name=${encodeURIComponent(parsed.name)}`;

  const res = await fetch(url, {
    signal: signal ?? AbortSignal.timeout(5000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;

  const body = await res.json().catch(() => null) as { names?: Record<string, string> } | null;
  const pubkey = body?.names?.[parsed.name];
  if (typeof pubkey !== 'string' || !/^[0-9a-f]{64}$/i.test(pubkey)) return null;
  return { pubkey: pubkey.toLowerCase(), name: parsed.name, domain: parsed.domain };
}

export async function resolveNip05ToPubkey(
  nip05: string,
  options: { signal?: AbortSignal } = {},
): Promise<string | null> {
  const resolved = await resolveNip05(nip05, options.signal);
  return resolved?.pubkey ?? null;
}
