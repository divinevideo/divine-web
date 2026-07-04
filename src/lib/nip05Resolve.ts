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

export function parseNip05Handle(raw: string): ParsedNip05 | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    const [namePart, domainPart] = trimmed.split('@', 2);
    if (namePart === '') {
      if (domainPart && domainPart.includes('.')) {
        return { name: '_', domain: domainPart };
      }
      return null;
    }
    if (!domainPart || !domainPart.includes('.')) return null;
    return { name: namePart, domain: domainPart };
  }

  if (trimmed.includes('.')) {
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

  if (!domain || !/^[a-zA-Z0-9.-]+$/.test(domain)) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return null;

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
