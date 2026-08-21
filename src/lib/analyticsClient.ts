import type { NostrSigner } from '@nostrify/nostrify';

import {
  getFunnelcakeApiModeOverride,
  getFunnelcakeBaseUrl,
  type FunnelcakeApiMode,
} from '@/config/api';
import type {
  ProductAnalyticsV2Event,
  ProductAnalyticsV2EventName,
  ProductAnalyticsV2ReferrerClass,
} from '@/generated/productAnalytics';
import { getAnalyticsConsent, onAnalyticsConsentChanged } from '@/lib/cookieConsent';
import {
  ProductEventQueue,
  productEventQueue,
  type ProductEventQueueRecord,
} from '@/lib/eventQueue';
import { createNip98AuthHeader } from '@/lib/nip98Auth';
import { createUuid } from '@/lib/uuid';

interface ProductAnalyticsIdentity {
  userPubkey?: string;
  signer?: NostrSigner;
}

type ProductAnalyticsIdentityCallback = () => void;
type ProductAnalyticsEventWithoutId = ProductAnalyticsV2Event extends infer Event
  ? Event extends ProductAnalyticsV2Event
    ? Omit<Event, 'event_id'>
    : never
  : never;
type ProductAnalyticsProperties<Name extends ProductAnalyticsV2EventName> = Extract<
  ProductAnalyticsV2Event,
  { event_name: Name }
>['properties'];

interface ProductAnalyticsClientOptions {
  queue?: ProductEventQueue;
  batchSize?: number;
}

interface ResolveProductAnalyticsEnabledOptions {
  buildEnabled: boolean;
  hostname: string;
  apiMode: FunnelcakeApiMode;
}

interface ProductAnalyticsRequest {
  body: string;
  authorization?: string;
}

type ProductAnalyticsRequestFactory = (
  records: ProductEventQueueRecord[],
) => Promise<ProductAnalyticsRequest | null>;

export interface ProductAnalyticsUtm {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
}

const SESSION_ID_KEY = 'divine_product_analytics_session_id';
const ANONYMOUS_ID_KEY = 'divine_product_analytics_anonymous_id';
const UTM_KEY = 'divine_product_analytics_utm';
const DEFAULT_RELEASE = '0.0.0';
const ANONYMOUS_EVENT_NAMES = new Set<ProductAnalyticsV2EventName>([
  'landing_viewed',
  'registration_started',
]);
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;
const UTM_VALUE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

let currentIdentity: ProductAnalyticsIdentity = {};
let privacyBoundaryVersion = 0;
const identityListeners: ProductAnalyticsIdentityCallback[] = [];
const clients = new Set<ProductAnalyticsClient>();

export function resolveProductAnalyticsEnabled({
  buildEnabled,
  hostname,
  apiMode,
}: ResolveProductAnalyticsEnabledOptions): boolean {
  if (buildEnabled) return true;

  return apiMode === 'staging' && hostname.toLowerCase().endsWith('.pages.dev');
}

export function configureProductAnalyticsIdentity(identity: ProductAnalyticsIdentity): void {
  const previousPubkey = currentIdentity.userPubkey;
  currentIdentity = identity;

  if (previousPubkey !== identity.userPubkey) {
    privacyBoundaryVersion += 1;
    rotateProductAnalyticsIdentifiers();
    clearProductAnalyticsUtm();
    for (const client of clients) {
      client.resetIdentityBoundary();
    }
  }

  for (const listener of identityListeners) listener();
}

export function onProductAnalyticsIdentityChanged(callback: ProductAnalyticsIdentityCallback): () => void {
  identityListeners.push(callback);
  return () => {
    const index = identityListeners.indexOf(callback);
    if (index >= 0) identityListeners.splice(index, 1);
  };
}

export function trackProductEvent<Name extends ProductAnalyticsV2EventName>(
  eventName: Name,
  properties: ProductAnalyticsProperties<Name>,
): Promise<string | null> {
  return productAnalytics.track(eventName, properties);
}

export async function computeProductAnalyticsEventId(
  event: ProductAnalyticsEventWithoutId | ProductAnalyticsV2Event,
): Promise<string> {
  const { event_id: _ignored, ...unsigned } = event as ProductAnalyticsV2Event;
  const canonical = canonicalize(unsigned);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function captureProductAnalyticsUtm(search: string): ProductAnalyticsUtm {
  const params = new URLSearchParams(search);
  const captured: ProductAnalyticsUtm = {};

  for (const key of UTM_KEYS) {
    const value = params.get(key)?.toLowerCase();
    if (value && UTM_VALUE.test(value)) captured[key] = value;
  }

  if (Object.keys(captured).length > 0) {
    getStorage('session')?.setItem(UTM_KEY, JSON.stringify(captured));
    return captured;
  }
  return getProductAnalyticsUtm();
}

export function getProductAnalyticsUtm(): ProductAnalyticsUtm {
  const stored = getStorage('session')?.getItem(UTM_KEY);
  if (!stored) return {};

  try {
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const result: ProductAnalyticsUtm = {};
    for (const key of UTM_KEYS) {
      const value = parsed[key];
      if (typeof value === 'string' && UTM_VALUE.test(value)) result[key] = value;
    }
    return result;
  } catch {
    clearProductAnalyticsUtm();
    return {};
  }
}

export function classifyProductAnalyticsReferrer(
  referrer: string,
  hasCampaign: boolean,
): ProductAnalyticsV2ReferrerClass {
  if (hasCampaign) return 'campaign';
  if (!referrer) return 'direct';

  try {
    const hostname = new URL(referrer).hostname.toLowerCase();
    if (!hostname) return 'unknown';
    if (typeof window !== 'undefined' && hostname === window.location.hostname.toLowerCase()) {
      return 'direct';
    }
    if (/(^|\.)(google|bing|duckduckgo|yahoo)\./.test(hostname)) return 'search';
    if (/(^|\.)(facebook|instagram|tiktok|x|twitter|youtube|reddit)\./.test(hostname)) {
      return 'social';
    }
    return 'referral';
  } catch {
    return 'unknown';
  }
}

export class ProductAnalyticsClient {
  readonly queue: ProductEventQueue;
  private batchSize: number;
  private flushing = false;
  private disposed = false;
  private onlineHandler?: () => void;
  private visibilityHandler?: () => void;
  private intervalId?: number;
  private unsubscribeConsent?: () => void;
  private privacyReset: Promise<void> = Promise.resolve();

  constructor(options: ProductAnalyticsClientOptions = {}) {
    this.queue = options.queue ?? productEventQueue;
    this.batchSize = options.batchSize ?? 50;
    clients.add(this);

    if (canEverCollectAnalytics()) this.registerFlushTriggers();
    this.unsubscribeConsent = onAnalyticsConsentChanged((consented) => {
      if (!consented) {
        privacyBoundaryVersion += 1;
        rotateProductAnalyticsIdentifiers();
        clearProductAnalyticsUtm();
        this.resetIdentityBoundary();
      }
    });
  }

  resetIdentityBoundary(): void {
    this.privacyReset = this.privacyReset.then(() => this.queue.clear());
  }

  async track<Name extends ProductAnalyticsV2EventName>(
    eventName: Name,
    properties: ProductAnalyticsProperties<Name>,
  ): Promise<string | null> {
    if (this.disposed || !canCollectAnalytics()) return null;
    await this.privacyReset;
    if (this.disposed || !canCollectAnalytics()) return null;
    const eventPrivacyBoundary = privacyBoundaryVersion;

    const anonymous = ANONYMOUS_EVENT_NAMES.has(eventName);
    const ownerPubkey = anonymous ? undefined : currentIdentity.userPubkey;
    if (!anonymous && !ownerPubkey) return null;

    const unsigned = {
      schema_version: 2,
      occurred_at: new Date().toISOString(),
      anonymous_id: getAnonymousId(),
      session_id: getSessionId(),
      source: 'web',
      platform: 'web',
      release: getRelease(),
      consent_category: 'product_analytics',
      event_name: eventName,
      properties,
    } as ProductAnalyticsEventWithoutId;
    const event = {
      ...unsigned,
      event_id: await computeProductAnalyticsEventId(unsigned),
    } as ProductAnalyticsV2Event;
    if (eventPrivacyBoundary !== privacyBoundaryVersion || !canCollectAnalytics()) return null;

    await this.queue.enqueue(event, ownerPubkey);
    if (eventPrivacyBoundary !== privacyBoundaryVersion || !canCollectAnalytics()) {
      await this.queue.markSucceeded([event.event_id]);
      return null;
    }
    void this.flush();
    return event.event_id;
  }

  async flush(): Promise<void> {
    if (this.disposed || !canCollectAnalytics() || this.flushing) return;
    this.flushing = true;
    try {
      await this.privacyReset;
      if (this.disposed || !canCollectAnalytics()) return;
      await this.flushAnonymousBatch();
      await this.flushSignedBatch();
    } finally {
      this.flushing = false;
    }
  }

  private async flushAnonymousBatch(): Promise<void> {
    const records = await this.queue.getAnonymousFlushableBatch(this.batchSize);
    if (records.length === 0) return;

    const url = `${getFunnelcakeBaseUrl()}/api/analytics/events/anonymous`;
    await this.send(records, url, async (requestRecords) => ({
      body: JSON.stringify({ events: requestRecords.map((record) => record.event) }),
    }));
  }

  private async flushSignedBatch(): Promise<void> {
    const { signer, userPubkey } = currentIdentity;
    if (!signer || !userPubkey) return;

    const records = await this.queue.getSignedFlushableBatch(this.batchSize, userPubkey);
    if (records.length === 0) return;

    const url = `${getFunnelcakeBaseUrl()}/api/analytics/events`;
    await this.send(records, url, async (requestRecords) => {
      const body = JSON.stringify({
        subject_pubkey: userPubkey,
        events: requestRecords.map((record) => record.event),
      });
      const authorization = await createNip98AuthHeader(signer, url, 'POST', body);
      return authorization ? { body, authorization } : null;
    });
  }

  private async send(
    records: ProductEventQueueRecord[],
    url: string,
    createRequest: ProductAnalyticsRequestFactory,
  ): Promise<void> {
    const request = await createRequest(records);
    if (!request) return;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (request.authorization) headers.Authorization = request.authorization;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: request.body,
        keepalive: true,
      });
      // 5xx and a few 4xx are transient: 408 (timeout), 429 (rate limit), and
      // 401/403 (auth headers that fail on clock skew or an expired token).
      // Any other 4xx is a permanent contract rejection we drop rather than
      // retry forever.
      const retryable = response.status >= 500 || [401, 403, 408, 429].includes(response.status);
      if (response.ok) {
        await this.queue.markSucceeded(records.map((record) => record.id));
      } else if (retryable) {
        await this.queue.markFailed(records);
      } else if (records.length === 1) {
        // A single event that the server permanently rejects cannot become
        // valid on retry, so remove only that event.
        await this.queue.markSucceeded([records[0].id]);
      } else {
        // The API rejects a batch as a unit and does not name the bad event.
        // Retry one at a time so one malformed event cannot delete good ones.
        for (const record of records) {
          await this.send([record], url, createRequest);
        }
      }
    } catch {
      await this.queue.markFailed(records);
    }
  }

  private registerFlushTriggers(): void {
    if (typeof window === 'undefined') return;

    this.onlineHandler = () => void this.flush();
    window.addEventListener('online', this.onlineHandler);
    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') void this.flush();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.intervalId = window.setInterval(() => void this.flush(), 30_000);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    clients.delete(this);
    if (typeof window !== 'undefined') {
      if (this.onlineHandler) window.removeEventListener('online', this.onlineHandler);
      if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
      if (this.intervalId !== undefined) window.clearInterval(this.intervalId);
    }
    this.unsubscribeConsent?.();
  }
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Analytics events require finite numbers');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item === undefined ? null : item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`)
      .join(',')}}`;
  }
  throw new TypeError('Analytics events contain an unsupported value');
}

function canCollectAnalytics(): boolean {
  if (!isProductAnalyticsEnabled()) return false;
  if (typeof window !== 'undefined' && window.__DIVINE_ANALYTICS_DISABLED__) return false;
  return getAnalyticsConsent() === true;
}

function canEverCollectAnalytics(): boolean {
  const buildEnabled = import.meta.env.VITE_PRODUCT_ANALYTICS_ENABLED === 'true';
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase();
  return buildEnabled || hostname.endsWith('.pages.dev');
}

function isProductAnalyticsEnabled(): boolean {
  return resolveProductAnalyticsEnabled({
    buildEnabled: import.meta.env.VITE_PRODUCT_ANALYTICS_ENABLED === 'true',
    hostname: typeof window === 'undefined' ? '' : window.location.hostname,
    apiMode: getFunnelcakeApiModeOverride(),
  });
}

function getRelease(): string {
  return import.meta.env.VITE_APP_VERSION || DEFAULT_RELEASE;
}

function getSessionId(): string {
  return getStoredUuid(getStorage('session'), SESSION_ID_KEY);
}

function getAnonymousId(): string {
  return getStoredUuid(getStorage('local'), ANONYMOUS_ID_KEY);
}

function getStoredUuid(storage: Storage | null, key: string): string {
  const existing = storage?.getItem(key);
  if (existing) return existing;
  const id = createUuid();
  storage?.setItem(key, id);
  return id;
}

function clearProductAnalyticsUtm(): void {
  getStorage('session')?.removeItem(UTM_KEY);
}

function rotateProductAnalyticsIdentifiers(): void {
  getStorage('local')?.removeItem(ANONYMOUS_ID_KEY);
  getStorage('session')?.removeItem(SESSION_ID_KEY);
}

function getStorage(kind: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export const productAnalytics = new ProductAnalyticsClient();
