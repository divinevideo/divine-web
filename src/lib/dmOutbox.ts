import type { DmDeliveryState, DmSharePayload } from './dm';

const DM_OUTBOX_STORAGE_PREFIX = 'dm:outbox:';

export interface DmOutboxRecord {
  clientId: string;
  ownerPubkey: string;
  participantPubkeys: string[];
  content: string;
  share?: DmSharePayload;
  createdAt: number;
  lastAttemptAt: number;
  deliveryState: DmDeliveryState;
  errorMessage?: string;
  retryCount: number;
}

interface CreateDmOutboxRecordInput {
  ownerPubkey: string;
  participantPubkeys: string[];
  content: string;
  share?: DmSharePayload;
}

function getStorageKey(ownerPubkey: string): string {
  return `${DM_OUTBOX_STORAGE_PREFIX}${ownerPubkey}`;
}

function nowInSeconds(): number {
  return Math.round(Date.now() / 1000);
}

function getLocalStorage(): Storage | undefined {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return undefined;
  }

  return globalThis.localStorage;
}

function buildClientId(ownerPubkey: string, participantPubkeys: string[], createdAt: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `dm-${crypto.randomUUID()}`;
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  return `dm-${ownerPubkey.slice(0, 8)}-${participantPubkeys.join('-').slice(0, 16)}-${createdAt}-${randomPart}`;
}

function normalizeRecord(record: DmOutboxRecord): DmOutboxRecord {
  return {
    ...record,
    participantPubkeys: [...new Set(record.participantPubkeys)].sort(),
  };
}

function isDmOutboxRecord(value: unknown): value is DmOutboxRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Partial<DmOutboxRecord>;

  return (
    typeof record.clientId === 'string' &&
    typeof record.ownerPubkey === 'string' &&
    Array.isArray(record.participantPubkeys) &&
    record.participantPubkeys.every((pubkey) => typeof pubkey === 'string') &&
    typeof record.content === 'string' &&
    typeof record.createdAt === 'number' &&
    typeof record.lastAttemptAt === 'number' &&
    (record.deliveryState === 'sending' || record.deliveryState === 'failed' || record.deliveryState === 'sent') &&
    typeof record.retryCount === 'number'
  );
}

export function createDmOutboxRecord(input: CreateDmOutboxRecordInput): DmOutboxRecord {
  const createdAt = nowInSeconds();
  const participantPubkeys = [...new Set(input.participantPubkeys)].sort();

  return {
    clientId: buildClientId(input.ownerPubkey, participantPubkeys, createdAt),
    ownerPubkey: input.ownerPubkey,
    participantPubkeys,
    content: input.content,
    share: input.share,
    createdAt,
    lastAttemptAt: createdAt,
    deliveryState: 'sending',
    retryCount: 0,
  };
}

export function readDmOutbox(ownerPubkey?: string): DmOutboxRecord[] {
  if (!ownerPubkey) {
    return [];
  }

  const storage = getLocalStorage();
  if (!storage) {
    return [];
  }

  const serialized = storage.getItem(getStorageKey(ownerPubkey));
  if (!serialized) {
    return [];
  }

  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isDmOutboxRecord).map(normalizeRecord);
  } catch {
    return [];
  }
}

export function writeDmOutbox(ownerPubkey: string, records: DmOutboxRecord[]): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  storage.setItem(
    getStorageKey(ownerPubkey),
    JSON.stringify(records.map(normalizeRecord)),
  );
}

export function upsertDmOutboxRecord(ownerPubkey: string, record: DmOutboxRecord): DmOutboxRecord[] {
  const records = readDmOutbox(ownerPubkey);
  const nextRecords = records.some((existing) => existing.clientId === record.clientId)
    ? records.map((existing) => (existing.clientId === record.clientId ? normalizeRecord(record) : existing))
    : [...records, normalizeRecord(record)];

  writeDmOutbox(ownerPubkey, nextRecords);
  return nextRecords;
}

export function removeDmOutboxRecord(ownerPubkey: string, clientId: string): DmOutboxRecord[] {
  const nextRecords = readDmOutbox(ownerPubkey).filter((record) => record.clientId !== clientId);
  writeDmOutbox(ownerPubkey, nextRecords);
  return nextRecords;
}

export function hydrateDmOutbox(ownerPubkey: string, staleAfterSeconds: number): DmOutboxRecord[] {
  const now = nowInSeconds();
  const hydrated = readDmOutbox(ownerPubkey).map((record) => {
    if (record.deliveryState !== 'sending') {
      return record;
    }

    if ((now - record.lastAttemptAt) <= staleAfterSeconds) {
      return record;
    }

    return {
      ...record,
      deliveryState: 'failed' as const,
      errorMessage: record.errorMessage || 'Send timed out',
    };
  });

  writeDmOutbox(ownerPubkey, hydrated);
  return hydrated;
}
