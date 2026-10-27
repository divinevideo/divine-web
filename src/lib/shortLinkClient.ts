import { decode } from 'nostr-tools/nip19';

const ENDPOINT = 'https://gateway.divine.video/api/links';
const TARGET_PREFIX = 'https://divine.video/';

type Options = {
  enabled: boolean;
  authorize: (endpoint: string, body: string) => Promise<string | null>;
  fetcher?: typeof fetch;
};

export function canShortenUrl(url: string): boolean {
  if (url.length > 2048 || !url.startsWith(TARGET_PREFIX)) return false;
  const match = /^(video|profile)\/([A-Za-z0-9._~-]{1,1024})$/.exec(url.slice(TARGET_PREFIX.length));
  if (!match || match[2] === '.' || match[2] === '..') return false;
  if (match[1] === 'video') return true;
  if (/^[0-9a-fA-F]{64}$/.test(match[2])) return true;
  try {
    const key = decode(match[2]);
    return key.type === 'npub' && /^[0-9a-f]{64}$/.test(key.data);
  } catch { return false; }
}

async function readMapping(response: Response, target: string): Promise<string> {
  if (![200, 201].includes(response.status) || !response.body) throw new Error('short_link_unavailable');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4096) throw new Error('short_link_too_large');
      chunks.push(value);
    }
  } finally { void reader.cancel(); reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const mapping = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!mapping || typeof mapping.code !== 'string' || !/^[A-Za-z0-9]{8}$/.test(mapping.code)
    || mapping.url !== target || mapping.short_url !== `https://divine.video/l/${mapping.code}`) {
    throw new Error('short_link_invalid_mapping');
  }
  return mapping.short_url;
}

export class ShortLinkClient {
  private readonly cache = new Map<string, string>();
  private readonly inflight = new Map<string, Promise<string>>();
  private readonly controllers = new Set<AbortController>();

  constructor(private readonly options: Options) {}

  cachedOrOriginal(target: string): string {
    return this.options.enabled ? this.cache.get(target) ?? target : target;
  }

  prepare(target: string): Promise<string> {
    if (!this.options.enabled || !canShortenUrl(target)) return Promise.resolve(target);
    const cached = this.cache.get(target);
    if (cached) return Promise.resolve(cached);
    const existing = this.inflight.get(target);
    if (existing) return existing;
    const controller = new AbortController();
    this.controllers.add(controller);
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<string>(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve(target); }, 2000);
    });
    const pending = Promise.race([this.create(target, controller.signal), deadline])
      .then(url => {
        if (url !== target && !controller.signal.aborted) {
          if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!);
          this.cache.set(target, url);
        }
        return controller.signal.aborted ? target : url;
      })
      .catch(() => target)
      .finally(() => {
        clearTimeout(timer); controller.abort(); this.controllers.delete(controller);
        if (this.inflight.get(target) === pending) this.inflight.delete(target);
      });
    this.inflight.set(target, pending);
    return pending;
  }

  clear(): void {
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear(); this.inflight.clear(); this.cache.clear();
  }

  private async create(target: string, signal: AbortSignal): Promise<string> {
    const body = JSON.stringify({ url: target });
    const authorization = await this.options.authorize(ENDPOINT, body);
    if (!authorization || signal.aborted) return target;
    const response = await (this.options.fetcher ?? fetch)(ENDPOINT, {
      method: 'POST', body, signal, redirect: 'error', cache: 'no-store', credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Authorization: authorization },
    });
    return readMapping(response, target);
  }
}
