export interface ParsedNip05 {
  name: string;
  domain: string;
}

export interface ResolvedNip05 extends ParsedNip05 {
  pubkey: string;
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

export async function resolveNip05(
  handle: string,
  signal?: AbortSignal,
): Promise<ResolvedNip05 | null> {
  const parsed = parseNip05Handle(handle);
  if (!parsed) return null;
  const url = `https://${parsed.domain}/.well-known/nostr.json?name=${encodeURIComponent(parsed.name)}`;
  try {
    const res = await fetch(url, { signal: signal ?? AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body = await res.json() as { names?: Record<string, string> };
    const pubkey = body?.names?.[parsed.name];
    if (typeof pubkey !== 'string' || !/^[0-9a-f]{64}$/i.test(pubkey)) return null;
    return { pubkey: pubkey.toLowerCase(), name: parsed.name, domain: parsed.domain };
  } catch {
    return null;
  }
}
