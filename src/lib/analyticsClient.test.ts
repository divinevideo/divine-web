import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrSigner } from '@nostrify/nostrify';

vi.mock('./nip98Auth', () => ({
  createNip98AuthHeader: vi.fn().mockResolvedValue('Nostr signed-auth'),
}));

const consent = vi.hoisted(() => ({ value: true as boolean | null }));
vi.mock('./cookieConsent', () => ({
  getAnalyticsConsent: () => consent.value,
}));

const pubkey = 'b'.repeat(64);
const signer = {
  signEvent: vi.fn(),
} as unknown as NostrSigner;

function createStorage() {
  const values = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    clear: vi.fn(() => {
      values.clear();
    }),
  } as unknown as Storage;
}

describe('analyticsClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    consent.value = true;
    Object.defineProperty(globalThis, 'indexedDB', {
      writable: true,
      value: undefined,
    });
    Object.defineProperty(window, '__DIVINE_ANALYTICS_DISABLED__', {
      configurable: true,
      writable: true,
      value: false,
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createStorage(),
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: createStorage(),
    });
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"accepted":1}', { status: 200 })));
  });

  it('does not enqueue events when analytics consent is absent', async () => {
    consent.value = null;
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });

    await productAnalytics.track('session_started', { surface: 'home' });

    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(0);
  });

  it('does not enqueue events when simulation suppression is active', async () => {
    window.__DIVINE_ANALYTICS_DISABLED__ = true;
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });

    await productAnalytics.track('session_started', { surface: 'home' });

    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(0);
  });

  it('posts a signed batch and preserves the event id until the server accepts it', async () => {
    const { createNip98AuthHeader } = await import('./nip98Auth');
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });

    const eventId = await productAnalytics.track('session_started', { surface: 'home' });
    await productAnalytics.flush();

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall[0]).toBe('https://api.divine.video/api/analytics/events');
    expect(fetchCall[1]?.method).toBe('POST');
    expect(fetchCall[1]?.headers).toMatchObject({
      Accept: 'application/json',
      Authorization: 'Nostr signed-auth',
      'Content-Type': 'application/json',
    });
    expect(createNip98AuthHeader).toHaveBeenCalledWith(
      signer,
      'https://api.divine.video/api/analytics/events',
      'POST',
      fetchCall[1]?.body,
    );
    expect(JSON.parse(fetchCall[1]?.body as string).events[0].event_id).toBe(eventId);
    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(0);
  });

  it('keeps events queued when signing is unavailable', async () => {
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey });

    await productAnalytics.track('session_started', { surface: 'home' });
    await productAnalytics.flush();

    expect(fetch).not.toHaveBeenCalled();
    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(1);
  });
});
