import { describe, expect, it, vi } from 'vitest';
import { extractEntryScript, verifyLiveBundle } from './verify-live-bundle.mjs';

const htmlWith = (entry: string) =>
  `<!doctype html><html><head>` +
  `<meta charset="utf-8">` +
  `<link rel="modulepreload" href="/assets/vendor-deadbeef.js">` +
  `<script type="module" crossorigin src="${entry}"></script>` +
  `</head><body><div id="root"></div></body></html>`;

const okResponse = (body: string) => ({ ok: true, status: 200, text: async () => body });

describe('extractEntryScript', () => {
  it('returns the hashed entry bundle path from the module script tag', () => {
    expect(extractEntryScript(htmlWith('/assets/index-CkdwgBUK.js'))).toBe('/assets/index-CkdwgBUK.js');
  });

  it('ignores modulepreload chunks and only returns the entry script src', () => {
    // The vendor chunk appears first as a modulepreload link; it must not win.
    expect(extractEntryScript(htmlWith('/assets/index-Dm1dxfK-.js'))).toBe('/assets/index-Dm1dxfK-.js');
  });

  it('returns null when there is no hashed entry script', () => {
    expect(extractEntryScript('<html><head></head><body></body></html>')).toBeNull();
  });

  it('extracts the entry from a realistic head with several modulepreloads', () => {
    // Vite hoists modulepreload <link>s for chunks ahead of the entry <script>.
    // None of those <link>s should win — only the <script src> entry.
    const html =
      `<!doctype html><html><head><meta charset="utf-8">` +
      `<link rel="modulepreload" href="/assets/react-vendor-1111aaaa.js">` +
      `<link rel="modulepreload" href="/assets/query-2222bbbb.js">` +
      `<link rel="stylesheet" href="/assets/index-3333cccc.css">` +
      `<script type="module" crossorigin src="/assets/index-CkdwgBUK.js"></script>` +
      `</head><body><div id="root"></div></body></html>`;
    expect(extractEntryScript(html)).toBe('/assets/index-CkdwgBUK.js');
  });
});

describe('verifyLiveBundle', () => {
  const noopSleep = vi.fn(async () => {});

  it('passes when every origin already serves the expected bundle', async () => {
    const expected = '/assets/index-CkdwgBUK.js';
    const fetchImpl = vi.fn(async () => okResponse(htmlWith(expected)));

    await expect(
      verifyLiveBundle({
        expected,
        urls: ['https://divine.video/', 'https://www.divine.video/'],
        fetchImpl,
        attempts: 3,
        sleep: noopSleep,
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(fetchImpl).toHaveBeenCalledTimes(4); // per origin: HTML + asset check
  });

  it('retries a stale origin until it flips to the expected bundle', async () => {
    const expected = '/assets/index-CkdwgBUK.js';
    const stale = '/assets/index-Dm1dxfK-.js';
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      // First poll serves the stale bundle, second poll serves the fresh one.
      return okResponse(htmlWith(calls === 1 ? stale : expected));
    });

    await expect(
      verifyLiveBundle({
        expected,
        urls: ['https://divine.video/'],
        fetchImpl,
        attempts: 5,
        sleep: noopSleep,
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(noopSleep).toHaveBeenCalled();
  });

  it('throws after exhausting attempts when an origin never serves the expected bundle', async () => {
    const expected = '/assets/index-CkdwgBUK.js';
    const stale = '/assets/index-Dm1dxfK-.js';
    const fetchImpl = vi.fn(async () => okResponse(htmlWith(stale)));

    await expect(
      verifyLiveBundle({
        expected,
        urls: ['https://divine.video/'],
        fetchImpl,
        attempts: 3,
        sleep: vi.fn(async () => {}),
      }),
    ).rejects.toThrow(/index-CkdwgBUK\.js/);

    expect(fetchImpl).toHaveBeenCalledTimes(3); // attempts exhausted
  });

  it('treats a thrown fetch (e.g. timeout) as a failed attempt and keeps polling', async () => {
    const expected = '/assets/index-CkdwgBUK.js';
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new DOMException('The operation timed out.', 'TimeoutError');
      return okResponse(htmlWith(expected));
    });

    await expect(
      verifyLiveBundle({
        expected,
        urls: ['https://divine.video/'],
        fetchImpl,
        attempts: 4,
        sleep: vi.fn(async () => {}),
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(fetchImpl).toHaveBeenCalledTimes(3); // html throw, html ok, asset check
  });

  it('treats a non-200 response as not-yet-live and keeps polling', async () => {
    const expected = '/assets/index-CkdwgBUK.js';
    let calls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      // Only count HTML (origin) fetches; the asset GET always 200s here.
      if (url.endsWith('.js')) return { ok: true, status: 200, text: async () => '' };
      calls += 1;
      if (calls === 1) return { ok: false, status: 503, text: async () => '' };
      return okResponse(htmlWith(expected));
    });

    await expect(
      verifyLiveBundle({
        expected,
        urls: ['https://divine.video/'],
        fetchImpl,
        attempts: 4,
        sleep: vi.fn(async () => {}),
      }),
    ).resolves.toMatchObject({ ok: true });
  });

  it('does not converge when the entry HTML matches but the referenced JS asset is not yet 200', async () => {
    // The index.html pointer can converge before the JS blob is fetchable
    // (eventually-consistent KV, or a swallowed dropped blob). Verify must check
    // the asset itself, not just the pointer.
    const expected = '/assets/index-CkdwgBUK.js';
    let assetCalls = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('.js')) {
        assetCalls += 1;
        // 404 on the first check, 200 once the blob converges.
        return { ok: assetCalls >= 2, status: assetCalls >= 2 ? 200 : 404, text: async () => '' };
      }
      return okResponse(htmlWith(expected)); // pointer is already converged
    });

    await expect(
      verifyLiveBundle({
        expected,
        urls: ['https://divine.video/'],
        fetchImpl,
        attempts: 5,
        sleep: vi.fn(async () => {}),
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(assetCalls).toBe(2); // re-checked the asset until it returned 200
  });

  it('throws when the JS asset never returns 200 even though the HTML matches', async () => {
    const expected = '/assets/index-CkdwgBUK.js';
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('.js')) return { ok: false, status: 404, text: async () => '' };
      return okResponse(htmlWith(expected));
    });

    await expect(
      verifyLiveBundle({
        expected,
        urls: ['https://divine.video/'],
        fetchImpl,
        attempts: 2,
        sleep: vi.fn(async () => {}),
      }),
    ).rejects.toThrow(/index-CkdwgBUK\.js/);
  });

  it('requests the asset on the same origin that served the HTML', async () => {
    const expected = '/assets/index-CkdwgBUK.js';
    const assetUrls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('.js')) {
        assetUrls.push(url);
        return { ok: true, status: 200, text: async () => '' };
      }
      return okResponse(htmlWith(expected));
    });

    await verifyLiveBundle({
      expected,
      urls: ['https://www.divine.video/'],
      fetchImpl,
      attempts: 2,
      sleep: vi.fn(async () => {}),
    });

    expect(assetUrls).toContain('https://www.divine.video/assets/index-CkdwgBUK.js');
  });

  it('requests live HTML with no-cache headers', async () => {
    const expected = '/assets/index-CkdwgBUK.js';
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('.js')) return { ok: true, status: 200, text: async () => '' };
      return okResponse(htmlWith(expected));
    });

    await verifyLiveBundle({
      expected,
      urls: ['https://divine.video/'],
      fetchImpl,
      attempts: 2,
      sleep: vi.fn(async () => {}),
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://divine.video/',
      expect.objectContaining({
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      }),
    );
  });
});
