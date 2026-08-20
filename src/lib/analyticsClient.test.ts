import type { NostrSigner } from '@nostrify/nostrify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const consent = vi.hoisted(() => ({
  value: true as boolean | null,
  listeners: [] as Array<(consented: boolean) => void>,
  set(next: boolean) {
    this.value = next;
    for (const listener of this.listeners) listener(next);
  },
}));

vi.mock('./cookieConsent', () => ({
  getAnalyticsConsent: () => consent.value,
  onAnalyticsConsentChanged: (callback: (consented: boolean) => void) => {
    consent.listeners.push(callback);
    if (consent.value !== null) callback(consent.value);
    return () => {
      const index = consent.listeners.indexOf(callback);
      if (index >= 0) consent.listeners.splice(index, 1);
    };
  },
}));

const pubkey = 'b'.repeat(64);
const signEvent: NostrSigner['signEvent'] = async (template) => ({
  ...template,
  id: 'c'.repeat(64),
  pubkey,
  sig: 'd'.repeat(128),
});
const signer = { signEvent: vi.fn(signEvent) } as unknown as NostrSigner;

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
    clear: vi.fn(() => values.clear()),
  } as unknown as Storage;
}

const impression = {
  content_id: 'note:test',
  surface: 'feed' as const,
  position: 1,
  visible_ms: 1000,
};

const landing = {
  landing_page: 'home' as const,
  referrer_class: 'campaign' as const,
  utm_source: 'newsletter',
  utm_medium: 'email',
};

describe('analyticsClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.mocked(signer.signEvent).mockReset().mockImplementation(signEvent);
    vi.stubEnv('VITE_PRODUCT_ANALYTICS_ENABLED', 'true');
    consent.value = true;
    consent.listeners.length = 0;
    Object.defineProperty(globalThis, 'indexedDB', { writable: true, value: undefined });
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('{"accepted":true}', { status: 200 }),
    ));
  });

  afterEach(async () => {
    const { productAnalytics } = await import('./analyticsClient');
    productAnalytics.dispose();
    vi.unstubAllEnvs();
  });

  it('matches the cross-language RFC 8785 event ID vector', async () => {
    const { computeProductAnalyticsEventId } = await import('./analyticsClient');
    const event = {
      schema_version: 2 as const,
      occurred_at: '2026-08-20T00:00:00Z',
      anonymous_id: '22222222-2222-4222-8222-222222222222',
      session_id: '33333333-3333-4333-8333-333333333333',
      source: 'web' as const,
      platform: 'web' as const,
      release: '2026.08.20',
      consent_category: 'product_analytics' as const,
      event_name: 'content_impression_recorded' as const,
      properties: {
        content_id: '4444444444444444444444444444444444444444444444444444444444444444',
        surface: 'feed' as const,
        position: 3,
        visible_ms: 1500,
      },
    };

    await expect(computeProductAnalyticsEventId(event)).resolves.toBe(
      '0592b5a4908ee37cc24348ca8292152498e7caed970c043526051818c15b22cd',
    );
    const { properties, ...rest } = event;
    const reordered = { properties, ...rest };
    await expect(computeProductAnalyticsEventId(reordered)).resolves.toBe(
      '0592b5a4908ee37cc24348ca8292152498e7caed970c043526051818c15b22cd',
    );
  });

  it('does not enqueue while the launch flag is off', async () => {
    vi.stubEnv('VITE_PRODUCT_ANALYTICS_ENABLED', 'false');
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });

    await productAnalytics.track('content_impression_recorded', impression);
    await productAnalytics.track('landing_viewed', landing);

    expect(fetch).not.toHaveBeenCalled();
    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(0);
  });

  it('rechecks whether analytics is enabled after the client starts', async () => {
    vi.stubEnv('VITE_PRODUCT_ANALYTICS_ENABLED', 'false');
    const { productAnalytics } = await import('./analyticsClient');

    vi.stubEnv('VITE_PRODUCT_ANALYTICS_ENABLED', 'true');
    await productAnalytics.track('landing_viewed', landing);

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  });

  it('allows an explicit staging test from a Cloudflare preview', async () => {
    const { resolveProductAnalyticsEnabled } = await import('./analyticsClient');

    expect(resolveProductAnalyticsEnabled({
      buildEnabled: false,
      hostname: 'analytics-test.divine-web-direct-deploy.pages.dev',
      apiMode: 'staging',
    })).toBe(true);
  });

  it('does not turn analytics on for ordinary previews or Divine domains', async () => {
    const { resolveProductAnalyticsEnabled } = await import('./analyticsClient');

    expect(resolveProductAnalyticsEnabled({
      buildEnabled: false,
      hostname: 'analytics-test.divine-web-direct-deploy.pages.dev',
      apiMode: 'auto',
    })).toBe(false);
    expect(resolveProductAnalyticsEnabled({
      buildEnabled: false,
      hostname: 'alice.divine.video',
      apiMode: 'staging',
    })).toBe(false);
    expect(resolveProductAnalyticsEnabled({
      buildEnabled: false,
      hostname: 'divine.video',
      apiMode: 'staging',
    })).toBe(false);
  });

  it('requires analytics consent for signed and anonymous events', async () => {
    consent.value = null;
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });

    await productAnalytics.track('content_impression_recorded', impression);
    await productAnalytics.track('landing_viewed', landing);

    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(0);
  });

  it('posts signed version-two events with the subject outside the event', async () => {
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });

    const eventId = await productAnalytics.track('content_impression_recorded', impression);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(url).toBe('https://api.divine.video/api/analytics/events');
    expect(body.subject_pubkey).toBe(pubkey);
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      event_id: eventId,
      schema_version: 2,
      source: 'web',
      platform: 'web',
      consent_category: 'product_analytics',
      event_name: 'content_impression_recorded',
      properties: impression,
    });
    expect(body.events[0]).not.toHaveProperty('user_pubkey');
    expect(body.events[0]).not.toHaveProperty('creator_pubkey');
    expect(body.events[0].event_id).toMatch(/^[0-9a-f]{64}$/);
    expect(init?.headers).toMatchObject({ Authorization: expect.stringMatching(/^Nostr /) });
    expect(init?.keepalive).toBe(true);
  });

  it('posts acquisition events to the anonymous route without authentication', async () => {
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({});

    await productAnalytics.track('landing_viewed', landing);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(url).toBe('https://api.divine.video/api/analytics/events/anonymous');
    expect(Object.keys(body)).toEqual(['events']);
    expect(body.events[0]).toMatchObject({ event_name: 'landing_viewed', properties: landing });
    expect(init?.headers).not.toHaveProperty('Authorization');
    expect(signer.signEvent).not.toHaveBeenCalled();
  });

  it('does not queue user-linked product activity without an identity', async () => {
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({});

    await expect(productAnalytics.track('content_impression_recorded', impression)).resolves.toBeNull();
    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(0);
  });

  it('preserves an event ID across a retry', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('{"accepted":false}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{"accepted":true}', { status: 200 })));
    const { ProductAnalyticsClient, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    const { ProductEventQueue } = await import('./eventQueue');
    const client = new ProductAnalyticsClient({
      queue: new ProductEventQueue({ baseRetryDelayMs: 0 }),
    });
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });

    const eventId = await client.track('content_impression_recorded', impression);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await vi.waitFor(async () => {
      expect(await client.queue.getFlushableBatch(10)).toHaveLength(1);
    });
    await client.flush();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    const sentIds = vi.mocked(fetch).mock.calls.map(([, init]) => (
      JSON.parse(init?.body as string).events[0].event_id
    ));
    expect(sentIds).toEqual([eventId, eventId]);
    client.dispose();
  });

  it('drops permanent contract errors and retries temporary failures', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 400 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 })));
    const { ProductAnalyticsClient, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    const { ProductEventQueue } = await import('./eventQueue');
    const productAnalytics = new ProductAnalyticsClient({
      queue: new ProductEventQueue({ baseRetryDelayMs: 0 }),
    });
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });

    await productAnalytics.track('content_impression_recorded', impression);
    await vi.waitFor(async () => {
      expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(0);
    });
    await productAnalytics.track('content_impression_recorded', { ...impression, position: 2 });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await vi.waitFor(async () => {
      expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(1);
    });
    productAnalytics.dispose();
  });

  it('retries a transient auth failure instead of dropping the event', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"accepted":true}', { status: 200 })));
    const { ProductAnalyticsClient, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    const { ProductEventQueue } = await import('./eventQueue');
    const client = new ProductAnalyticsClient({
      queue: new ProductEventQueue({ baseRetryDelayMs: 0 }),
    });
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });

    await client.track('content_impression_recorded', impression);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    // A 401 is transient (clock skew / expired auth); the event must stay queued.
    await vi.waitFor(async () => {
      expect(await client.queue.getFlushableBatch(10)).toHaveLength(1);
    });
    await client.flush();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await vi.waitFor(async () => {
      expect(await client.queue.getFlushableBatch(10)).toHaveLength(0);
    });
    client.dispose();
  });

  it('leaves a signed event queued when the signer is unavailable', async () => {
    const failingSigner = {
      signEvent: vi.fn(async () => { throw new Error('unavailable'); }),
    } as unknown as NostrSigner;
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer: failingSigner });

    await productAnalytics.track('content_impression_recorded', impression);
    await productAnalytics.flush();

    await vi.waitFor(() => expect(failingSigner.signEvent).toHaveBeenCalled());
    expect(fetch).not.toHaveBeenCalled();
    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(1);
  });

  it('purges queued records and stored acquisition data on consent withdrawal', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    const {
      captureProductAnalyticsUtm,
      configureProductAnalyticsIdentity,
      productAnalytics,
    } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });
    captureProductAnalyticsUtm('?utm_source=newsletter');
    await productAnalytics.track('content_impression_recorded', impression);
    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(1);

    consent.set(false);

    await vi.waitFor(async () => {
      expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(0);
    });
    expect(window.sessionStorage.removeItem).toHaveBeenCalled();
  });

  it('purges the previous account on logout or account switch', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    const {
      captureProductAnalyticsUtm,
      configureProductAnalyticsIdentity,
      productAnalytics,
    } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey });
    captureProductAnalyticsUtm('?utm_source=newsletter');
    await productAnalytics.track('content_impression_recorded', impression);
    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(1);

    configureProductAnalyticsIdentity({ userPubkey: 'e'.repeat(64), signer });

    await vi.waitFor(async () => {
      expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(0);
    });
    expect(window.sessionStorage.removeItem).toHaveBeenCalled();
  });

  it('keeps only allowlisted bounded UTM values for registration', async () => {
    const { captureProductAnalyticsUtm, getProductAnalyticsUtm } = await import('./analyticsClient');

    expect(captureProductAnalyticsUtm(
      '?utm_source=Newsletter&utm_medium=email&utm_campaign=launch-1&utm_term=secret&utm_content=x%20y',
    )).toEqual({
      utm_source: 'newsletter',
      utm_medium: 'email',
      utm_campaign: 'launch-1',
    });
    expect(getProductAnalyticsUtm()).toEqual({
      utm_source: 'newsletter',
      utm_medium: 'email',
      utm_campaign: 'launch-1',
    });
  });

  it('skips concurrent flushes while one is in flight', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });

    await productAnalytics.track('content_impression_recorded', impression);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await productAnalytics.flush();
    await productAnalytics.flush();

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('disposes its browser triggers and consent listener', async () => {
    const removeWindowListener = vi.spyOn(window, 'removeEventListener');
    const removeDocumentListener = vi.spyOn(document, 'removeEventListener');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const { ProductAnalyticsClient } = await import('./analyticsClient');
    const listenersBefore = consent.listeners.length;
    const client = new ProductAnalyticsClient();

    client.dispose();

    expect(removeWindowListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeDocumentListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(clearIntervalSpy).toHaveBeenCalledWith(expect.anything());
    expect(consent.listeners).toHaveLength(listenersBefore);
  });
});
