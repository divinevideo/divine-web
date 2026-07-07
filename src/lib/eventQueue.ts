export const PRODUCT_EVENT_MAX_ATTEMPTS = 5;

const DB_NAME = 'divine_product_events';
const DB_VERSION = 1;
const STORE_NAME = 'product_event_queue';

export interface ProductAnalyticsEvent {
  event_id: string;
  event_name: string;
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

export interface ProductEventQueueRecord {
  id: string;
  event: ProductAnalyticsEvent;
  created_at: number;
  next_attempt_at: number;
  attempt_count: number;
  status: 'pending' | 'dead';
}

interface ProductEventQueueOptions {
  baseRetryDelayMs?: number;
}

export class ProductEventQueue {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void>;
  private memoryRecords = new Map<string, ProductEventQueueRecord>();
  private baseRetryDelayMs: number;

  constructor(options: ProductEventQueueOptions = {}) {
    this.baseRetryDelayMs = options.baseRetryDelayMs ?? 30_000;
    this.initPromise = this.init();
  }

  async enqueue(event: ProductAnalyticsEvent): Promise<void> {
    const record: ProductEventQueueRecord = {
      id: event.event_id,
      event,
      created_at: Date.now(),
      next_attempt_at: Date.now(),
      attempt_count: 0,
      status: 'pending',
    };
    await this.putRecord(record);
  }

  async getFlushableBatch(limit: number): Promise<ProductEventQueueRecord[]> {
    const records = await this.getAllRecords();
    const now = Date.now();

    return records
      .filter((record) => record.status === 'pending' && record.next_attempt_at <= now)
      .sort((a, b) => a.created_at - b.created_at)
      .slice(0, limit);
  }

  async markSucceeded(ids: string[]): Promise<void> {
    const db = await this.ensureDB();
    if (!db) {
      ids.forEach((id) => this.memoryRecords.delete(id));
      return;
    }

    await new Promise<void>((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        ids.forEach((id) => store.delete(id));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      } catch {
        ids.forEach((id) => this.memoryRecords.delete(id));
        resolve();
      }
    });
  }

  async markFailed(records: ProductEventQueueRecord[]): Promise<void> {
    await Promise.all(records.map((record) => {
      const attemptCount = record.attempt_count + 1;
      const failedRecord: ProductEventQueueRecord = {
        ...record,
        attempt_count: attemptCount,
        next_attempt_at: Date.now() + this.retryDelay(attemptCount),
        status: attemptCount >= PRODUCT_EVENT_MAX_ATTEMPTS ? 'dead' : 'pending',
      };
      return this.putRecord(failedRecord);
    }));
  }

  async getDeadLetters(): Promise<ProductEventQueueRecord[]> {
    const records = await this.getAllRecords();
    return records.filter((record) => record.status === 'dead');
  }

  async clear(): Promise<void> {
    const db = await this.ensureDB();
    this.memoryRecords.clear();
    if (!db) return;

    await new Promise<void>((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const request = transaction.objectStore(STORE_NAME).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch {
        resolve();
      }
    });
  }

  private retryDelay(attemptCount: number): number {
    return this.baseRetryDelayMs * Math.max(1, 2 ** (attemptCount - 1));
  }

  private async init(): Promise<void> {
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      return;
    }

    await new Promise<void>((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => resolve();
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = () => {
        const db = request.result;
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('next_attempt_at', 'next_attempt_at', { unique: false });
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase | null> {
    await this.initPromise;
    return this.db;
  }

  private async putRecord(record: ProductEventQueueRecord): Promise<void> {
    const db = await this.ensureDB();
    this.memoryRecords.set(record.id, record);
    if (!db) return;

    await new Promise<void>((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const request = transaction.objectStore(STORE_NAME).put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch {
        resolve();
      }
    });
  }

  private async getAllRecords(): Promise<ProductEventQueueRecord[]> {
    const db = await this.ensureDB();
    if (!db) {
      return Array.from(this.memoryRecords.values());
    }

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const request = transaction.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => {
          const records = request.result as ProductEventQueueRecord[];
          records.forEach((record) => this.memoryRecords.set(record.id, record));
          resolve(records);
        };
        request.onerror = () => resolve(Array.from(this.memoryRecords.values()));
      } catch {
        resolve(Array.from(this.memoryRecords.values()));
      }
    });
  }
}

export const productEventQueue = new ProductEventQueue();
