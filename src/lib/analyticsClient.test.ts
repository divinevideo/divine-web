import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrSigner } from '@nostrify/nostrify';

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
  },
}));

const pubkey = 'b'.repeat(64);
const signEvent: NostrSigner['signEvent'] = async (template) => ({
  ...template,
  id: 'c'.repeat(64),
  pubkey,
  sig: 'd'.repeat(128),
});
const signer = {
  signEvent: vi.fn(signEvent),
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
    // clearAllMocks does not drop a queued mockRejectedValueOnce, so a signer
    // failure staged by one test would otherwise leak into the next and make
    // its "did not POST" assertions pass for the wrong reason.
    vi.mocked(signer.signEvent).mockReset().mockImplementation(signEvent);
    consent.value = true;
    consent.listeners.length = 0;
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

  it('purges queued events when the user withdraws analytics consent', async () => {
    // A hanging flush keeps the tracked event pending in the queue.
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });
    await productAnalytics.track('session_started', { surface: 'home' });
    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(1);

    consent.set(false);

    await vi.waitFor(async () => {
      expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(0);
    });
  });

  it('does not enqueue events when simulation suppression is active', async () => {
    window.__DIVINE_ANALYTICS_DISABLED__ = true;
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });

    await productAnalytics.track('session_started', { surface: 'home' });

    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(0);
  });

  it('posts flat event objects on the platform ingest contract', async () => {
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });

    const eventId = await productAnalytics.track('session_started', { surface: 'home' });
    // track() fires a flush; an explicit one no-ops while it is in flight.
    await productAnalytics.flush();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(fetchCall[0]).toBe('https://api.divine.video/api/analytics/events');
    expect(fetchCall[1]?.method).toBe('POST');

    const body = JSON.parse(fetchCall[1]?.body as string);
    // The endpoint ingests flat event objects keyed by event_id, exactly as
    // divine-mobile's analytics_ingest_client.dart sends them.
    expect(Object.keys(body)).toEqual(['events']);
    const event = body.events[0];
    expect(event.event_id).toBe(eventId);
    expect(event.event_name).toBe('session_started');
    expect(event.user_pubkey).toBe(pubkey);
    expect(event.surface).toBe('home');
    expect(event.platform).toBe('web');
    expect(event.schema_version).toBe(1);
    expect(event.properties).toEqual({});

    // No Nostr envelope: no per-event signing, no kind/content/sig/tags.
    expect(signer.signEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: 22237 }),
    );
    expect(event).not.toHaveProperty('kind');
    expect(event).not.toHaveProperty('content');
    expect(event).not.toHaveProperty('sig');
    expect(event).not.toHaveProperty('tags');

    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(0);
  });

  it('sends the typed columns the ingest schema declares', async () => {
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });

    await productAnalytics.track('screen_time', {
      surface: 'home',
      duration_ms: 1500,
      content_id: 'video-1',
      properties: { path: '/' },
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());

    const event = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string).events[0];
    expect(event.duration_ms).toBe(1500);
    expect(event.content_id).toBe('video-1');
    expect(event.properties).toEqual({ path: '/' });
    // Unset typed columns are still present with their zero value rather than
    // omitted, matching the mobile client.
    expect(event.position_ms).toBe(0);
    expect(event.loop_count).toBe(0);
    expect(event.value).toBe(0);
    expect(event.entry_point).toBe('');
    expect(event.flow_name).toBe('');
  });

  it('authenticates the batch with a NIP-98 Authorization header', async () => {
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });

    await productAnalytics.track('session_started', { surface: 'home' });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());

    const init = vi.mocked(fetch).mock.calls[0][1];
    expect(init?.headers).toMatchObject({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: expect.stringMatching(/^Nostr /),
    });
  });

  it('does not POST when a NIP-98 header cannot be produced', async () => {
    const failingSigner = {
      signEvent: vi.fn(async () => {
        throw new Error('signer unavailable');
      }),
    } as unknown as NostrSigner;

    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer: failingSigner });

    await productAnalytics.track('session_started', { surface: 'home' });
    await productAnalytics.flush();

    expect(fetch).not.toHaveBeenCalled();
    // The event stays queued for a later attempt rather than being dropped.
    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(1);
  });

  it('uses keepalive transport so a leave-time flush is not cancelled', async () => {
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });

    await productAnalytics.track('session_started', { surface: 'home' });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());

    expect(vi.mocked(fetch).mock.calls[0][1]?.keepalive).toBe(true);
  });

  it('queues events before a signer is configured and sends them once it is', async () => {
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    // Identity arrives in two steps in the real app tree: the pubkey is known
    // before the signer is wired up. A one-shot event must not be lost.
    configureProductAnalyticsIdentity({ userPubkey: pubkey });

    await productAnalytics.track('session_started', { surface: 'home' });
    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(1);
    expect(fetch).not.toHaveBeenCalled();

    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });
    await productAnalytics.flush();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());

    const event = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string).events[0];
    expect(event.event_name).toBe('session_started');
  });

  it('skips concurrent flushes while one is in flight', async () => {
    let releaseFetch!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { releaseFetch = resolve; })));
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });

    await productAnalytics.track('session_started', { surface: 'home' });
    // track() kicked off a flush against the hanging fetch; wait for it to be
    // in flight, then concurrent flushes must no-op without a second POST.
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await productAnalytics.flush();
    await productAnalytics.flush();

    expect(fetch).toHaveBeenCalledTimes(1);

    releaseFetch(new Response('{"accepted":1}', { status: 200 }));
    await vi.waitFor(async () => {
      expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(0);
    });
  });

  it('never sends one account\'s queued events under another account\'s signature', async () => {
    const otherPubkey = 'e'.repeat(64);
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');

    // Account A tracks before its signer is wired up, so the event stays on
    // disk. A logs out and B logs in with a signer.
    configureProductAnalyticsIdentity({ userPubkey: otherPubkey });
    await productAnalytics.track('session_started', { surface: 'home' });
    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(1);

    configureProductAnalyticsIdentity({});
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });
    await productAnalytics.flush();

    // A's event carries A's pubkey and session id; POSTing it under B's NIP-98
    // signature would attribute A's activity to B.
    expect(fetch).not.toHaveBeenCalled();
    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(1);

    // It is still A's to send when A comes back.
    configureProductAnalyticsIdentity({ userPubkey: otherPubkey, signer });
    await productAnalytics.flush();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());

    const event = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string).events[0];
    expect(event.user_pubkey).toBe(otherPubkey);
  });

  it('flushes when the tab is hidden and not when it becomes visible', async () => {
    const setVisibility = (state: DocumentVisibilityState) => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => state,
      });
    };

    setVisibility('visible');
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({ userPubkey: pubkey });
    const eventId = await productAnalytics.track('session_started', { surface: 'home' });
    configureProductAnalyticsIdentity({ userPubkey: pubkey, signer });

    // Clients built by earlier tests keep their own document listeners, so
    // count only the POSTs carrying this test's event.
    const postsForThisEvent = () => vi.mocked(fetch).mock.calls
      .filter(([, init]) => String(init?.body).includes(String(eventId)));

    // Becoming visible is not a leave-time signal; the interval and the online
    // handler cover retries while the tab is open.
    document.dispatchEvent(new Event('visibilitychange'));
    // flush() awaits the queue read and the NIP-98 header before it POSTs, so
    // give a triggered flush enough turns to actually reach fetch.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(postsForThisEvent()).toHaveLength(0);

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(postsForThisEvent()).toHaveLength(1));
  });

  it('does not enqueue events when no user is identified', async () => {
    const { productAnalytics, configureProductAnalyticsIdentity } = await import('./analyticsClient');
    configureProductAnalyticsIdentity({});

    await productAnalytics.track('session_started', { surface: 'home' });
    await productAnalytics.flush();

    expect(fetch).not.toHaveBeenCalled();
    expect(await productAnalytics.queue.getFlushableBatch(10)).toHaveLength(0);
  });
});
