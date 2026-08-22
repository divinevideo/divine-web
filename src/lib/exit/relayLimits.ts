// ABOUTME: Reads destination relay timestamp limits for one account-move run
// ABOUTME: Treats absent or unavailable NIP-11 policy as unknown rather than permission

interface RelayInformationDocument {
  limitation?: {
    created_at_lower_limit?: unknown;
  };
}

interface FetchRelayAgeLimitOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function relayInformationUrl(destination: string): string {
  const url = new URL(destination);
  url.protocol = "https:";
  return url.toString();
}

export async function fetchRelayAgeLimit(
  destination: string,
  options: FetchRelayAgeLimitOptions = {},
): Promise<number | null> {
  const fetcher = options.fetcher ?? fetch;
  const timeout = new AbortController();
  const handle = globalThis.setTimeout(() => timeout.abort(), options.timeoutMs ?? 5_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout.signal])
    : timeout.signal;
  try {
    const response = await fetcher(relayInformationUrl(destination), {
      headers: { Accept: "application/nostr+json" },
      signal,
    });
    if (!response.ok) return null;
    const document = await response.json() as RelayInformationDocument;
    const limit = document.limitation?.created_at_lower_limit;
    return typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? limit : null;
  } catch (error) {
    if (options.signal?.aborted && error instanceof DOMException && error.name === "AbortError") throw error;
    return null;
  } finally {
    globalThis.clearTimeout(handle);
  }
}
