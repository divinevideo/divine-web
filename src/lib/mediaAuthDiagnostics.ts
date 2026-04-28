// ABOUTME: Diagnostic helpers for surfacing why divine-blossom rejects a viewer auth header
// ABOUTME: Decodes the Nostr Authorization header and logs the response body on 401 / 403

const DEFAULT_BODY_LIMIT = 512;

interface ParsedAuthEvent {
  pubkey: string;
  kind: number;
  createdAt: number;
  tags: string[][];
  id: string;
}

/**
 * Decode a `Nostr <base64-event>` Authorization header for logging.
 * Returns null when the header is absent or unparseable. Never throws.
 */
export function decodeAuthHeaderForLogging(authHeader: string | null | undefined): ParsedAuthEvent | null {
  if (!authHeader) return null;
  const stripped = authHeader.startsWith('Nostr ') ? authHeader.slice('Nostr '.length) : authHeader;
  try {
    const event = JSON.parse(atob(stripped)) as Record<string, unknown>;
    return {
      pubkey: typeof event.pubkey === 'string' ? event.pubkey : '<missing>',
      kind: typeof event.kind === 'number' ? event.kind : -1,
      createdAt: typeof event.created_at === 'number' ? event.created_at : -1,
      tags: Array.isArray(event.tags) ? (event.tags as string[][]) : [],
      id: typeof event.id === 'string' ? event.id : '<missing>',
    };
  } catch {
    return null;
  }
}

/**
 * Read an auth-failure response body, log everything that helps explain the rejection,
 * and return the parsed body so callers can branch on `error: "age_restricted"` vs
 * `error: "auth_invalid"`. Safe to call even when the body has already been consumed —
 * uses `clone()` internally where possible.
 */
export async function logMediaAuthFailure(
  context: string,
  url: string,
  response: Response,
  authHeader: string | null | undefined,
): Promise<{ body: string; parsed?: { error?: string } }> {
  let body = '';
  try {
    body = await response.clone().text();
  } catch {
    // Body already consumed by another reader — skip
  }

  const trimmed = body.length > DEFAULT_BODY_LIMIT ? `${body.slice(0, DEFAULT_BODY_LIMIT)}…` : body;
  const decoded = decodeAuthHeaderForLogging(authHeader);
  const localNow = Math.floor(Date.now() / 1000);

  // eslint-disable-next-line no-console
  console.error(`[mediaAuth] ${context} ${response.status} on ${url}`, {
    body: trimmed,
    sentAuth: decoded
      ? {
          pubkey: decoded.pubkey,
          kind: decoded.kind,
          createdAt: decoded.createdAt,
          createdAtSkewSeconds: decoded.createdAt > 0 ? localNow - decoded.createdAt : null,
          tags: decoded.tags,
          id: decoded.id,
        }
      : '<missing or unparseable>',
    localNow,
  });

  let parsed: { error?: string } | undefined;
  try {
    parsed = JSON.parse(body) as { error?: string };
  } catch {
    parsed = undefined;
  }

  return { body, parsed };
}
