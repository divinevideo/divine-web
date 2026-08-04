import type { NostrSigner } from '@nostrify/nostrify';

import { getFunnelcakeBaseUrl } from '@/config/api';
import { getAnalyticsConsent, onAnalyticsConsentChanged } from '@/lib/cookieConsent';
import { ProductEventQueue, productEventQueue } from '@/lib/eventQueue';
import { createNip98AuthHeader } from '@/lib/nip98Auth';

/**
 * Wire format for POST /api/analytics/events.
 *
 * The endpoint ingests flat event objects and dedupes on `event_id`; request
 * authentication is NIP-98 at the request level, not a signature per event.
 * divine-mobile's `analytics_ingest_client.dart` sends exactly this shape, and
 * both clients must stay in step — see `ProductAnalyticsEvent.toJson()` there.
 *
 * The typed columns are always present, carrying '' or 0 when unset, so the
 * ingest schema does not have to distinguish absent from empty.
 */
export interface ProductAnalyticsPayload {
  event_id: string;
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
  build_number: string;
  entry_point: string;
  flow_name: string;
  step_name: string;
  result: string;
  reason_code: string;
  content_id: string;
  creator_pubkey: string;
  feed_algorithm: string;
  traffic_source: string;
  feature_key: string;
  experiment_key: string;
  variant_key: string;
  variation_id: number;
  duration_ms: number;
  position_ms: number;
  loop_count: number;
  value: number;
  locale?: string;
  country?: string;
}

const STRING_COLUMNS = [
  'entry_point',
  'flow_name',
  'step_name',
  'result',
  'reason_code',
  'content_id',
  'creator_pubkey',
  'feed_algorithm',
  'traffic_source',
  'feature_key',
  'experiment_key',
  'variant_key',
] as const;

const NUMBER_COLUMNS = [
  'variation_id',
  'duration_ms',
  'position_ms',
  'loop_count',
  'value',
] as const;

export type ProductAnalyticsEventName =
  | 'session_started'
  | 'screen_time'
  | 'feed_scrolled'
  | 'video_engagement_summary';

export type ProductAnalyticsProps = Partial<Omit<
  ProductAnalyticsPayload,
  'event_id' | 'event_name' | 'occurred_at' | 'anonymous_id' | 'session_id' | 'platform' | 'app_version' | 'schema_version'
>> & {
  properties?: Record<string, unknown>;
};

interface ProductAnalyticsIdentity {
  userPubkey?: string;
  signer?: NostrSigner;
}

type ProductAnalyticsIdentityCallback = () => void;

interface ProductAnalyticsClientOptions {
  queue?: ProductEventQueue;
  batchSize?: number;
}

const SESSION_ID_KEY = 'divine_product_analytics_session_id';
const ANONYMOUS_ID_KEY = 'divine_product_analytics_anonymous_id';
const DEFAULT_APP_VERSION = '0.0.0';
const PRODUCT_ANALYTICS_ENABLED = import.meta.env.VITE_PRODUCT_ANALYTICS_ENABLED === 'true';

let currentIdentity: ProductAnalyticsIdentity = {};
const identityListeners: ProductAnalyticsIdentityCallback[] = [];

export function configureProductAnalyticsIdentity(identity: ProductAnalyticsIdentity): void {
  currentIdentity = identity;
  for (const listener of identityListeners) {
    listener();
  }
}

export function onProductAnalyticsIdentityChanged(callback: ProductAnalyticsIdentityCallback): () => void {
  identityListeners.push(callback);

  return () => {
    const index = identityListeners.indexOf(callback);
    if (index >= 0) {
      identityListeners.splice(index, 1);
    }
  };
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
  private flushing = false;
  private disposed = false;
  private onlineHandler?: () => void;
  private visibilityHandler?: () => void;
  private intervalId?: number;
  private unsubscribeConsent?: () => void;

  constructor(options: ProductAnalyticsClientOptions = {}) {
    this.queue = options.queue ?? productEventQueue;
    this.batchSize = options.batchSize ?? 50;
    if (!PRODUCT_ANALYTICS_ENABLED) {
      return;
    }
    this.registerFlushTriggers();
    // Withdrawn consent must also discard events queued while consent was
    // granted — the gate on track/flush alone would leave them on disk.
    this.unsubscribeConsent = onAnalyticsConsentChanged((consented) => {
      if (!consented) {
        void this.queue.clear();
      }
    });
  }

  async track(eventName: ProductAnalyticsEventName, props: ProductAnalyticsProps = {}): Promise<string | null> {
    if (this.disposed || !canCollectAnalytics()) {
      return null;
    }

    const userPubkey = props.user_pubkey ?? currentIdentity.userPubkey;
    if (!userPubkey) {
      return null;
    }

    // Web product analytics is intentionally authenticated-only: Funnelcake
    // ingest batches require NIP-98, so logged-out traffic is left to GA4.
    // The signer is only needed to authenticate the request at flush time, so
    // an event tracked before the signer is wired up is queued rather than
    // dropped. AnalyticsPageTracker's one-shot session_started can otherwise
    // mount before AnalyticsUserTracker has configured identity.
    const occurredAt = new Date();
    const payload = buildPayload(eventName, props, {
      eventId: createUuid(),
      occurredAt,
      userPubkey,
    });

    await this.queue.enqueue(payload);
    void this.flush();
    return payload.event_id;
  }

  async flush(): Promise<void> {
    if (this.disposed || !canCollectAnalytics()) {
      return;
    }

    // Concurrent flushes (track() + interval + online/visibility triggers) would
    // read the same pending batch and POST duplicates; skip while one is in flight.
    if (this.flushing) {
      return;
    }
    this.flushing = true;

    try {
      await this.flushBatch();
    } finally {
      this.flushing = false;
    }
  }

  private async flushBatch(): Promise<void> {
    const { signer, userPubkey } = currentIdentity;
    if (!signer || !userPubkey) {
      // Nothing can be authenticated yet; leave the batch queued.
      return;
    }

    // Scoped to the signed-in account. Queued records outlive the session that
    // created them, so an unscoped read would send an earlier account's events
    // — carrying that account's pubkey and session id — under this account's
    // NIP-98 signature. The other account's backlog stays queued for its own
    // next flush, bounded by the queue's cap and TTL.
    const records = await this.queue.getFlushableBatch(this.batchSize, userPubkey);
    if (records.length === 0) {
      return;
    }

    const url = `${getFunnelcakeBaseUrl()}/api/analytics/events`;
    const body = JSON.stringify({
      events: records.map((record) => record.event),
    });

    const authorization = await createNip98AuthHeader(signer, url, 'POST', body);
    if (!authorization) {
      // A transient signer failure must not burn a retry attempt or drop the
      // batch — leave it pending and try again on the next flush.
      return;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: authorization,
        },
        body,
        // Leave-time flushes run from a hidden tab; without keepalive the
        // request is cancelled as the document unloads.
        keepalive: true,
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

    // Retry when connectivity returns.
    this.onlineHandler = () => {
      void this.flush();
    };
    window.addEventListener('online', this.onlineHandler);
    // Leave time. `visibilityState` is only 'hidden' or 'visible', so testing
    // for both is the same as no test at all; a flush on becoming visible has
    // no batch that the interval below would not already have sent.
    this.visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        void this.flush();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.intervalId = window.setInterval(() => {
      void this.flush();
    }, 30_000);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    if (this.intervalId !== undefined) {
      window.clearInterval(this.intervalId);
    }
    this.unsubscribeConsent?.();
  }
}

function canCollectAnalytics(): boolean {
  if (!PRODUCT_ANALYTICS_ENABLED) {
    return false;
  }

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

function buildPayload(
  eventName: ProductAnalyticsEventName,
  props: ProductAnalyticsProps,
  context: { eventId: string; occurredAt: Date; userPubkey: string },
): ProductAnalyticsPayload {
  const payload: ProductAnalyticsPayload = {
    event_id: context.eventId,
    event_name: eventName,
    occurred_at: context.occurredAt.toISOString(),
    anonymous_id: getAnonymousId(),
    session_id: getSessionId(),
    user_pubkey: context.userPubkey,
    platform: 'web',
    app_version: getAppVersion(),
    build_number: getBuildNumber(),
    surface: props.surface ?? 'unknown',
    schema_version: 1,
    properties: props.properties ?? {},
    entry_point: '',
    flow_name: '',
    step_name: '',
    result: '',
    reason_code: '',
    content_id: '',
    creator_pubkey: '',
    feed_algorithm: '',
    traffic_source: '',
    feature_key: '',
    experiment_key: '',
    variant_key: '',
    variation_id: 0,
    duration_ms: 0,
    position_ms: 0,
    loop_count: 0,
    value: 0,
  };

  for (const column of STRING_COLUMNS) {
    const value = props[column];
    if (typeof value === 'string' && value) {
      payload[column] = value;
    }
  }

  for (const column of NUMBER_COLUMNS) {
    const value = props[column];
    if (typeof value === 'number' && Number.isFinite(value)) {
      payload[column] = value;
    }
  }

  const locale = props.locale ?? getLocale();
  if (locale) payload.locale = locale;
  if (props.country) payload.country = props.country;

  return payload;
}

function getBuildNumber(): string {
  return import.meta.env.VITE_APP_BUILD_NUMBER || '';
}

export const productAnalytics = new ProductAnalyticsClient();
