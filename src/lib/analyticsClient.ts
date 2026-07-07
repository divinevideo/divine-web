import type { NostrSigner } from '@nostrify/nostrify';

import { getFunnelcakeBaseUrl } from '@/config/api';
import { getAnalyticsConsent } from '@/lib/cookieConsent';
import { ProductEventQueue, productEventQueue, type ProductAnalyticsEvent } from '@/lib/eventQueue';
import { createNip98AuthHeader } from '@/lib/nip98Auth';

export type ProductAnalyticsEventName =
  | 'session_started'
  | 'screen_time'
  | 'feed_scrolled'
  | 'video_engagement_summary'
  | 'experiment_exposed'
  | 'sentiment_prompt_answered';

export type ProductAnalyticsProps = Partial<Omit<
  ProductAnalyticsEvent,
  'event_id' | 'event_name' | 'occurred_at' | 'anonymous_id' | 'session_id' | 'platform' | 'app_version' | 'schema_version'
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
  }

  async track(eventName: ProductAnalyticsEventName, props: ProductAnalyticsProps = {}): Promise<string | null> {
    if (!canCollectAnalytics()) {
      return null;
    }

    const userPubkey = props.user_pubkey ?? currentIdentity.userPubkey;
    if (!userPubkey) {
      return null;
    }

    const eventId = createUuid();
    const event: ProductAnalyticsEvent = compactEvent({
      ...props,
      event_id: eventId,
      event_name: eventName,
      occurred_at: new Date().toISOString(),
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

    await this.queue.enqueue(event);
    void this.flush();
    return eventId;
  }

  async flush(): Promise<void> {
    const signer = currentIdentity.signer;
    if (!signer || !canCollectAnalytics()) {
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
    const authHeader = await createNip98AuthHeader(signer, url, 'POST', body);
    if (!authHeader) {
      return;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: authHeader,
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

function compactEvent(event: ProductAnalyticsEvent): ProductAnalyticsEvent {
  return Object.fromEntries(
    Object.entries(event).filter(([, value]) => value !== undefined),
  ) as ProductAnalyticsEvent;
}

export const productAnalytics = new ProductAnalyticsClient();
