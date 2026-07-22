import type { NostrSigner } from '@nostrify/nostrify';

import { getFunnelcakeBaseUrl } from '@/config/api';
import { getAnalyticsConsent, onAnalyticsConsentChanged } from '@/lib/cookieConsent';
import { ProductEventQueue, productEventQueue } from '@/lib/eventQueue';

export const PRODUCT_ANALYTICS_EVENT_KIND = 22237;

interface ProductAnalyticsPayload {
  event_name: ProductAnalyticsEventName;
  occurred_at: string;
  anonymous_id: string;
  session_id: string;
  user_pubkey: string;
  platform: 'web';
  app_version: string;
  surface: string;
  schema_version: 1;
  properties: Record<string, unknown>;
  build_number?: string;
  locale?: string;
  country?: string;
  entry_point?: string;
  flow_name?: string;
  step_name?: string;
  result?: string;
  reason_code?: string;
  content_id?: string;
  creator_pubkey?: string;
  feed_algorithm?: string;
  traffic_source?: string;
  feature_key?: string;
  experiment_key?: string;
  variant_key?: string;
  variation_id?: number;
  duration_ms?: number;
  position_ms?: number;
  loop_count?: number;
  value?: number;
}

export type ProductAnalyticsEventName =
  | 'session_started'
  | 'screen_time'
  | 'feed_scrolled'
  | 'video_engagement_summary'
  | 'experiment_exposed'
  | 'sentiment_prompt_answered';

export type ProductAnalyticsProps = Partial<Omit<
  ProductAnalyticsPayload,
  'event_name' | 'occurred_at' | 'anonymous_id' | 'session_id' | 'platform' | 'app_version' | 'schema_version'
>> & {
  properties?: Record<string, unknown>;
};

interface ProductAnalyticsIdentity {
  userPubkey?: string;
  signer?: NostrSigner;
}

interface ProductAnalyticsClientOptions {
  queue?: ProductEventQueue;
  batchSize?: number;
}

const SESSION_ID_KEY = 'divine_product_analytics_session_id';
const ANONYMOUS_ID_KEY = 'divine_product_analytics_anonymous_id';
const DEFAULT_APP_VERSION = '0.0.0';

let currentIdentity: ProductAnalyticsIdentity = {};

export function configureProductAnalyticsIdentity(identity: ProductAnalyticsIdentity): void {
  currentIdentity = identity;
}

export function trackProductEvent(
  eventName: ProductAnalyticsEventName,
  props: ProductAnalyticsProps = {},
): Promise<string | null> {
  return productAnalytics.track(eventName, props);
}

export class ProductAnalyticsClient {
  readonly queue: ProductEventQueue;
  private batchSize: number;

  constructor(options: ProductAnalyticsClientOptions = {}) {
    this.queue = options.queue ?? productEventQueue;
    this.batchSize = options.batchSize ?? 50;
    this.registerFlushTriggers();
    // Withdrawn consent must also discard events queued while consent was
    // granted — the gate on track/flush alone would leave them on disk.
    onAnalyticsConsentChanged((consented) => {
      if (!consented) {
        void this.queue.clear();
      }
    });
  }

  async track(eventName: ProductAnalyticsEventName, props: ProductAnalyticsProps = {}): Promise<string | null> {
    if (!canCollectAnalytics()) {
      return null;
    }

    const signer = currentIdentity.signer;
    const userPubkey = props.user_pubkey ?? currentIdentity.userPubkey;
    if (!userPubkey || !signer) {
      return null;
    }

    const occurredAt = new Date();
    const payload: ProductAnalyticsPayload = compactPayload({
      ...props,
      event_name: eventName,
      occurred_at: occurredAt.toISOString(),
      anonymous_id: getAnonymousId(),
      session_id: getSessionId(),
      user_pubkey: userPubkey,
      platform: 'web',
      app_version: getAppVersion(),
      surface: props.surface ?? 'unknown',
      locale: props.locale ?? getLocale(),
      schema_version: 1,
      properties: props.properties ?? {},
    });
    const signedEvent = await signer.signEvent({
      kind: PRODUCT_ANALYTICS_EVENT_KIND,
      content: JSON.stringify(payload),
      created_at: Math.floor(occurredAt.getTime() / 1000),
      tags: buildTelemetryTags(payload),
    });

    await this.queue.enqueue(signedEvent);
    void this.flush();
    return signedEvent.id;
  }

  async flush(): Promise<void> {
    if (!canCollectAnalytics()) {
      return;
    }

    const records = await this.queue.getFlushableBatch(this.batchSize);
    if (records.length === 0) {
      return;
    }

    const url = `${getFunnelcakeBaseUrl()}/api/analytics/events`;
    const body = JSON.stringify({
      batch_id: createUuid(),
      sent_at: new Date().toISOString(),
      events: records.map((record) => record.event),
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body,
      });

      if (!response.ok) {
        await this.queue.markFailed(records);
        return;
      }

      await this.queue.markSucceeded(records.map((record) => record.id));
    } catch {
      await this.queue.markFailed(records);
    }
  }

  private registerFlushTriggers(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('online', () => {
      void this.flush();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' || document.visibilityState === 'visible') {
        void this.flush();
      }
    });
    window.setInterval(() => {
      void this.flush();
    }, 30_000);
  }
}

function canCollectAnalytics(): boolean {
  if (typeof window !== 'undefined' && window.__DIVINE_ANALYTICS_DISABLED__) {
    return false;
  }

  return getAnalyticsConsent() === true;
}

function getAppVersion(): string {
  return import.meta.env.VITE_APP_VERSION || DEFAULT_APP_VERSION;
}

function getLocale(): string {
  if (typeof navigator === 'undefined') {
    return '';
  }

  return navigator.language || '';
}

function getSessionId(): string {
  const storage = getStorage('session');
  return getStoredUuid(storage, SESSION_ID_KEY);
}

function getAnonymousId(): string {
  const storage = getStorage('local');
  return getStoredUuid(storage, ANONYMOUS_ID_KEY);
}

function getStoredUuid(storage: Storage | null, key: string): string {
  const existing = storage?.getItem(key);
  if (existing) {
    return existing;
  }

  const id = createUuid();
  storage?.setItem(key, id);
  return id;
}

function getStorage(kind: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

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

function buildTelemetryTags(payload: ProductAnalyticsPayload): string[][] {
  const tags: string[][] = [
    ['client', 'divine-web'],
    ['schema', 'product_analytics_v1'],
    ['event_name', payload.event_name],
    ['surface', payload.surface],
    ['session', payload.session_id],
    ['platform', payload.platform],
  ];

  if (payload.content_id) {
    tags.push(['e', payload.content_id]);
  }
  if (payload.creator_pubkey) {
    tags.push(['p', payload.creator_pubkey]);
  }
  if (payload.feature_key) {
    tags.push(['feature_key', payload.feature_key]);
  }
  if (payload.experiment_key) {
    tags.push(['experiment_key', payload.experiment_key]);
  }

  return tags;
}

function compactPayload(payload: ProductAnalyticsPayload): ProductAnalyticsPayload {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as ProductAnalyticsPayload;
}

export const productAnalytics = new ProductAnalyticsClient();
