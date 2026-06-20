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

    expect(fetchImpl).toHaveBeenCalledTimes(2); // one per origin, no retries needed
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

    expect(fetchImpl).toHaveBeenCalledTimes(2);
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

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('treats a non-200 response as not-yet-live and keeps polling', async () => {
    const expected = '/assets/index-CkdwgBUK.js';
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
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

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
