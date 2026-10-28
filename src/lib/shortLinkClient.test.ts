import { afterEach, describe, expect, it, vi } from 'vitest';

import { npubEncode } from 'nostr-tools/nip19';

import { ShortLinkClient } from '@/lib/shortLinkClient';

const target = 'https://divine.video/video/CaseSensitive_Stable-ID';
const short = 'https://divine.video/l/Abc12345';
const mapping = (url = target) => new Response(JSON.stringify({ code: 'Abc12345', short_url: short, url }), { status: 201 });

describe('ShortLinkClient', () => {
  afterEach(() => vi.useRealTimers());

  it('does no work when disabled or the target is outside the canonical contract', async () => {
    const authorize = vi.fn(); const fetcher = vi.fn();
    const disabled = new ShortLinkClient({ enabled: false, authorize, fetcher });
    expect(await disabled.prepare(target)).toBe(target);
    const client = new ShortLinkClient({ enabled: true, authorize, fetcher });
    for (const url of ['https://evil.example/video/a', 'https://divine.video/video/a?at=1', 'https://divine.video/profile/short', 'https://divine.video/l/Abc12345', `https://divine.video/profile/${npubEncode('01')}`]) {
      expect(await client.prepare(url)).toBe(url);
    }
    expect(authorize).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });

  it('deduplicates, signs the exact body and caches only a validated successful mapping', async () => {
    const authorize = vi.fn().mockResolvedValue('Nostr synthetic');
    const fetcher = vi.fn().mockImplementation(async () => mapping());
    const client = new ShortLinkClient({ enabled: true, authorize, fetcher });
    expect(client.cachedOrOriginal(target)).toBe(target);
    expect(await Promise.all([client.prepare(target), client.prepare(target)])).toEqual([short, short]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const body = JSON.stringify({ url: target });
    expect(authorize).toHaveBeenCalledWith('https://gateway.divine.video/api/links', body);
    expect(fetcher).toHaveBeenCalledWith('https://gateway.divine.video/api/links', expect.objectContaining({ method: 'POST', body, redirect: 'error', credentials: 'omit', headers: { 'Content-Type': 'application/json', Authorization: 'Nostr synthetic' } }));
    expect(client.cachedOrOriginal(target)).toBe(short);
    expect(await client.prepare(target)).toBe(short);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('falls back on quota, malformed, mismatched, oversized and offline responses without caching failures', async () => {
    for (const response of [() => new Response('{}', { status: 401 }), () => new Response('{}', { status: 429 }), () => new Response('{}', { status: 503 }), () => new Response('', { status: 302 }), () => mapping('https://divine.video/video/other'), () => new Response('{'), () => new Response(' '.repeat(4097)), () => Promise.reject(new Error('offline')), () => new Response(new ReadableStream({ start(controller) { controller.error(new Error('body-stream-failed')); } }))]) {
      const fetcher = vi.fn().mockImplementationOnce(response).mockImplementationOnce(async () => mapping());
      const client = new ShortLinkClient({ enabled: true, authorize: async () => 'Nostr synthetic', fetcher });
      expect(await client.prepare(target)).toBe(target);
      expect(client.cachedOrOriginal(target)).toBe(target);
      expect(await client.prepare(target)).toBe(short);
    }
  });

  it('preserves complete hex and checksum-valid npub profile identifiers', async () => {
    const hex = '01'.repeat(32);
    for (const id of [hex, npubEncode(hex)]) {
      const url = `https://divine.video/profile/${id}`;
      const fetcher = vi.fn().mockImplementation(async (_endpoint, init) => mapping(JSON.parse(init.body).url));
      const client = new ShortLinkClient({ enabled: true, authorize: async () => 'Nostr synthetic', fetcher });
      expect(await client.prepare(url)).toBe(short);
      expect(JSON.parse(fetcher.mock.calls[0][1].body).url).toBe(url);
    }
  });

  it('bounds slow signing and never sends after timeout or cleanup', async () => {
    vi.useFakeTimers();
    let finish!: (value: string) => void;
    const authorize = vi.fn(() => new Promise<string>(resolve => { finish = resolve; }));
    const fetcher = vi.fn();
    const client = new ShortLinkClient({ enabled: true, authorize, fetcher });
    const pending = client.prepare(target);
    await vi.advanceTimersByTimeAsync(2001);
    expect(await pending).toBe(target);
    finish('Nostr synthetic'); await Promise.resolve();
    expect(fetcher).not.toHaveBeenCalled();
    const cancelled = client.prepare(target); client.clear(); finish('Nostr synthetic');
    await vi.advanceTimersByTimeAsync(2001); expect(await cancelled).toBe(target);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
