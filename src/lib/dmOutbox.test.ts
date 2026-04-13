import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createDmOutboxRecord,
  hydrateDmOutbox,
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
});
