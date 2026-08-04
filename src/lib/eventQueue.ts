import type { ProductAnalyticsPayload } from '@/lib/analyticsClient';

export const PRODUCT_EVENT_MAX_ATTEMPTS = 5;

/**
 * Hard bounds on what may sit on a user's disk.
 *
 * Records here contain a pubkey and a session id, and the ingest endpoint is
 * not live yet, so without these every batch retries to dead and stays there
 * forever. Dead letters expire; pending records expire; and the queue as a
 * whole is capped, dropping the oldest first.
 */
export const PRODUCT_EVENT_MAX_RECORDS = 500;
export const PRODUCT_EVENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const DB_NAME = 'divine_product_events';
const DB_VERSION = 1;
const STORE_NAME = 'product_event_queue';

export interface ProductEventQueueRecord {
  id: string;
  event: ProductAnalyticsPayload;
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

  async enqueue(event: ProductAnalyticsPayload): Promise<void> {
    const record: ProductEventQueueRecord = {
      id: event.event_id,
      event,
      created_at: Date.now(),
      next_attempt_at: Date.now(),
      attempt_count: 0,
      status: 'pending',
    };
    await this.putRecord(record);
    await this.enforceBounds();
  }

  /**
   * Pending records ready to send, oldest first.
   *
   * `ownerPubkey` scopes the read to one account. Records outlive the session
   * that queued them, so an unscoped read lets account A's backlog be POSTed
   * under account B's request signature once B logs in. Callers that send
   * always pass the owner; the bare form exists for inspection and tests.
   */
  async getFlushableBatch(limit: number, ownerPubkey?: string): Promise<ProductEventQueueRecord[]> {
    const records = await this.prune(await this.getAllRecords());
    const now = Date.now();

    return records
      .filter((record) => record.status === 'pending' && record.next_attempt_at <= now)
      .filter((record) => !ownerPubkey || record.event.user_pubkey === ownerPubkey)
      .sort((a, b) => a.created_at - b.created_at)
      .slice(0, limit);
  }

  /**
   * Drop expired records and trim the queue to its cap, oldest first. Returns
   * the records that survived so callers can reuse the read.
   */
  private async prune(records: ProductEventQueueRecord[]): Promise<ProductEventQueueRecord[]> {
    const cutoff = Date.now() - PRODUCT_EVENT_MAX_AGE_MS;
    const live = records.filter((record) => record.created_at > cutoff);

    const surplus = live.length - PRODUCT_EVENT_MAX_RECORDS;
    const kept = surplus > 0
      ? [...live].sort((a, b) => a.created_at - b.created_at).slice(surplus)
      : live;

    const keptIds = new Set(kept.map((record) => record.id));
    const dropped = records.filter((record) => !keptIds.has(record.id));
    if (dropped.length > 0) {
      await this.deleteRecords(dropped.map((record) => record.id));
    }

    return kept;
  }

  private async enforceBounds(): Promise<void> {
    await this.prune(await this.getAllRecords());
  }

  async markSucceeded(ids: string[]): Promise<void> {
    await this.deleteRecords(ids);
  }

  private async deleteRecords(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const db = await this.ensureDB();
    if (!db) {
      ids.forEach((id) => this.memoryRecords.delete(id));
      return;
    }

    await new Promise<void>((resolve) => {
      // Evict from the in-memory mirror whatever the durable store does —
      // getAllRecords() re-populates the map from IDB, so without this it grows
      // unbounded per session, and a record left in memory after a failed
      // delete would be re-sent on the next flush.
      const settle = () => {
        ids.forEach((id) => this.memoryRecords.delete(id));
        resolve();
      };

      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        ids.forEach((id) => store.delete(id));
        transaction.oncomplete = settle;
        transaction.onerror = settle;
        transaction.onabort = settle;
      } catch {
        settle();
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
    const records = await this.prune(await this.getAllRecords());
    return records.filter((record) => record.status === 'dead');
  }

  async clear(): Promise<void> {
    const db = await this.ensureDB();
    this.memoryRecords.clear();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const request = transaction.objectStore(STORE_NAME).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
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

    // Every failure path resolves rather than rejects. Callers fire and forget
    // (`void track()`), so a QuotaExceededError or a failed transaction has to
    // degrade to the in-memory mirror set above, not become an unhandled
    // rejection in the app.
    await new Promise<void>((resolve) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const request = transaction.objectStore(STORE_NAME).put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
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
