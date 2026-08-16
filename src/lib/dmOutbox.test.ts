import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDmRumor, type DmRumorEvent } from './dm';
import {
  attachDmOutboxRumor,
  createDmOutboxRecord,
  getDmOutboxRecord,
  hydrateDmOutbox,
  markDmOutboxRecordSending,
  readDmOutbox,
  upsertDmOutboxRecord,
  writeDmOutbox,
} from './dmOutbox';

const TEST_PUBKEY = 'a'.repeat(64);
const RECIPIENT_PUBKEY = 'b'.repeat(64);

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  localStorageMock.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  localStorageMock.clear();
});

describe('dmOutbox', () => {
  it('writes and reads outbox records per owner pubkey', () => {
    const record = createDmOutboxRecord({
      ownerPubkey: TEST_PUBKEY,
      participantPubkeys: [RECIPIENT_PUBKEY],
      content: 'hello',
    });

    writeDmOutbox(TEST_PUBKEY, [record]);

    expect(readDmOutbox(TEST_PUBKEY)).toEqual([record]);
    expect(readDmOutbox('c'.repeat(64))).toEqual([]);
  });

  it('updates an existing outbox record by clientId', () => {
    const record = createDmOutboxRecord({
      ownerPubkey: TEST_PUBKEY,
      participantPubkeys: [RECIPIENT_PUBKEY],
      content: 'hello',
    });

    const updated = {
      ...record,
      deliveryState: 'failed' as const,
      errorMessage: 'boom',
    };

    writeDmOutbox(TEST_PUBKEY, [record]);
    upsertDmOutboxRecord(TEST_PUBKEY, updated);

    expect(readDmOutbox(TEST_PUBKEY)).toEqual([updated]);
  });

  it('demotes stale sending records to failed during hydration', () => {
    vi.spyOn(Date, 'now').mockReturnValue(3_700_000);

    const stale = {
      ...createDmOutboxRecord({
        ownerPubkey: TEST_PUBKEY,
        participantPubkeys: [RECIPIENT_PUBKEY],
        content: 'hello',
      }),
      deliveryState: 'sending' as const,
      lastAttemptAt: 1,
    };

    writeDmOutbox(TEST_PUBKEY, [stale]);

    expect(hydrateDmOutbox(TEST_PUBKEY, 3600)).toEqual([
      expect.objectContaining({
        clientId: stale.clientId,
        deliveryState: 'failed',
      }),
    ]);
  });

  it('keeps the attached rumor across a retry marked sending', () => {
    // The retry path re-wraps this rumor, so losing it on the way through
    // markDmOutboxRecordSending would silently restore the double-delivery.
    const record = createDmOutboxRecord({
      ownerPubkey: TEST_PUBKEY,
      participantPubkeys: [RECIPIENT_PUBKEY],
      content: 'hello',
    });
    upsertDmOutboxRecord(TEST_PUBKEY, record);

    const rumor = buildDmRumor({
      senderPubkey: TEST_PUBKEY,
      recipientPubkeys: [RECIPIENT_PUBKEY],
      content: 'hello',
    });
    attachDmOutboxRumor(TEST_PUBKEY, record.clientId, rumor);

    const retried = markDmOutboxRecordSending(TEST_PUBKEY, record.clientId, {
      participantPubkeys: [RECIPIENT_PUBKEY],
      content: 'hello',
    });

    expect(retried?.rumor).toEqual(rumor);
    expect(retried?.retryCount).toBe(1);
    expect(getDmOutboxRecord(TEST_PUBKEY, record.clientId)?.rumor).toEqual(rumor);
  });

  it('drops a persisted rumor that is not a well-formed event', () => {
    // localStorage is user-writable and survives app versions; a corrupt
    // rumor must cost the replay, not the pending message.
    const record = createDmOutboxRecord({
      ownerPubkey: TEST_PUBKEY,
      participantPubkeys: [RECIPIENT_PUBKEY],
      content: 'hello',
    });

    writeDmOutbox(TEST_PUBKEY, [{
      ...record,
      rumor: { id: 'only-an-id' } as unknown as DmRumorEvent,
    }]);

    const [stored] = readDmOutbox(TEST_PUBKEY);
    expect(stored.rumor).toBeUndefined();
    expect(stored.content).toBe('hello');
  });

  it('does not throw when localStorage writes fail', () => {
    const record = createDmOutboxRecord({
      ownerPubkey: TEST_PUBKEY,
      participantPubkeys: [RECIPIENT_PUBKEY],
      content: 'hello',
    });

    vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    expect(() => writeDmOutbox(TEST_PUBKEY, [record])).not.toThrow();
    expect(() => upsertDmOutboxRecord(TEST_PUBKEY, record)).not.toThrow();
    expect(() => hydrateDmOutbox(TEST_PUBKEY, 3600)).not.toThrow();
  });
});
