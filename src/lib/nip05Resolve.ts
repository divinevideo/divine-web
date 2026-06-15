// ABOUTME: Resolve a NIP-05 identifier (name@domain) to a hex pubkey via the
// ABOUTME: standard .well-known/nostr.json endpoint. Works for any domain.

export interface Nip05Parts {
  name: string;
  domain: string;
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

export async function resolveNip05ToPubkey(
  nip05: string,
  options: { signal?: AbortSignal } = {},
): Promise<string | null> {
  const parts = parseNip05(nip05);
  if (!parts) return null;

  const url = `https://${parts.domain}/.well-known/nostr.json?name=${encodeURIComponent(parts.name)}`;

  const response = await fetch(url, {
    signal: options.signal,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) return null;

  const data = await response.json().catch(() => null) as { names?: Record<string, string> } | null;
  const pubkey = data?.names?.[parts.name];
  if (typeof pubkey !== 'string' || !/^[0-9a-f]{64}$/i.test(pubkey)) return null;
  return pubkey.toLowerCase();
}
