import type { NostrSigner } from '@nostrify/nostrify';

import { getFunnelcakeBaseUrl } from '@/config/api';
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
const PRODUCT_ANALYTICS_ENABLED = import.meta.env.VITE_PRODUCT_ANALYTICS_ENABLED === 'true';
const ANONYMOUS_EVENT_NAMES = new Set<ProductAnalyticsV2EventName>([
  'landing_viewed',
  'registration_started',
]);
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;
const UTM_VALUE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

let currentIdentity: ProductAnalyticsIdentity = {};
const identityListeners: ProductAnalyticsIdentityCallback[] = [];
const clients = new Set<ProductAnalyticsClient>();

export function configureProductAnalyticsIdentity(identity: ProductAnalyticsIdentity): void {
  const previousPubkey = currentIdentity.userPubkey;
  currentIdentity = identity;

  if (previousPubkey && previousPubkey !== identity.userPubkey) {
    clearProductAnalyticsUtm();
    for (const client of clients) {
      void client.queue.clearOwner(previousPubkey);
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

  constructor(options: ProductAnalyticsClientOptions = {}) {
    this.queue = options.queue ?? productEventQueue;
    this.batchSize = options.batchSize ?? 50;
    clients.add(this);
    if (!PRODUCT_ANALYTICS_ENABLED) return;

    this.registerFlushTriggers();
    this.unsubscribeConsent = onAnalyticsConsentChanged((consented) => {
      if (!consented) {
        clearProductAnalyticsUtm();
        void this.queue.clear();
      }
    });
  }

  async track<Name extends ProductAnalyticsV2EventName>(
    eventName: Name,
    properties: ProductAnalyticsProperties<Name>,
  ): Promise<string | null> {
    if (this.disposed || !canCollectAnalytics()) return null;

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

    await this.queue.enqueue(event, ownerPubkey);
    void this.flush();
    return event.event_id;
  }

  async flush(): Promise<void> {
    if (this.disposed || !canCollectAnalytics() || this.flushing) return;
    this.flushing = true;
    try {
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
    const body = JSON.stringify({ events: records.map((record) => record.event) });
    await this.send(records, url, body);
  }

  private async flushSignedBatch(): Promise<void> {
    const { signer, userPubkey } = currentIdentity;
    if (!signer || !userPubkey) return;

    const records = await this.queue.getSignedFlushableBatch(this.batchSize, userPubkey);
    if (records.length === 0) return;

    const url = `${getFunnelcakeBaseUrl()}/api/analytics/events`;
    const body = JSON.stringify({
      subject_pubkey: userPubkey,
      events: records.map((record) => record.event),
    });
    const authorization = await createNip98AuthHeader(signer, url, 'POST', body);
    if (!authorization) return;
    await this.send(records, url, body, authorization);
  }

  private async send(
    records: ProductEventQueueRecord[],
    url: string,
    body: string,
    authorization?: string,
  ): Promise<void> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (authorization) headers.Authorization = authorization;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        keepalive: true,
      });
      if (response.ok || (response.status < 500 && response.status !== 429)) {
        await this.queue.markSucceeded(records.map((record) => record.id));
      } else {
        await this.queue.markFailed(records);
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
  if (!PRODUCT_ANALYTICS_ENABLED) return false;
  if (typeof window !== 'undefined' && window.__DIVINE_ANALYTICS_DISABLED__) return false;
  return getAnalyticsConsent() === true;
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

function getStorage(kind: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (Number(char) ^ (random & (15 >> (Number(char) / 4)))).toString(16);
  });
}

export const productAnalytics = new ProductAnalyticsClient();
