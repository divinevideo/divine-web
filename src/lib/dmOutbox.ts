import { encodeConversationId, type DmDeliveryState, type DmMessage, type DmSharePayload } from './dm';

const DM_OUTBOX_STORAGE_PREFIX = 'dm:outbox:';
const DM_RECONCILIATION_WINDOW_SECONDS = 5;

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

function normalizeContent(content: string): string {
  return content.trim();
}

function normalizeSharePayload(share?: DmSharePayload): string {
  if (!share) {
    return '';
  }

  return JSON.stringify({
    url: share.url,
    title: share.title || '',
    videoId: share.videoId || '',
    videoPubkey: share.videoPubkey || '',
    vineId: share.vineId || '',
  });
}

function isReconciledDmMessage(outboxRecord: DmOutboxRecord, message: DmMessage): boolean {
  return (
    buildDmReconciliationFingerprint({
      senderPubkey: outboxRecord.ownerPubkey,
      participantPubkeys: [outboxRecord.ownerPubkey, ...outboxRecord.participantPubkeys],
      content: outboxRecord.content,
      share: outboxRecord.share,
      createdAt: 0,
    }) === buildDmReconciliationFingerprint({
      senderPubkey: message.senderPubkey,
      participantPubkeys: message.participantPubkeys,
      content: message.content,
      share: message.share,
      createdAt: 0,
    }) &&
    Math.abs(outboxRecord.createdAt - message.createdAt) <= DM_RECONCILIATION_WINDOW_SECONDS
  );
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

export function getDmOutboxRecord(ownerPubkey: string, clientId: string): DmOutboxRecord | undefined {
  return readDmOutbox(ownerPubkey).find((record) => record.clientId === clientId);
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

export function buildDmReconciliationFingerprint(input: {
  senderPubkey: string;
  participantPubkeys: string[];
  content: string;
  share?: DmSharePayload;
  createdAt: number;
}): string {
  return JSON.stringify({
    senderPubkey: input.senderPubkey,
    participantPubkeys: [...new Set(input.participantPubkeys)].sort(),
    content: normalizeContent(input.content),
    share: normalizeSharePayload(input.share),
    createdAt: input.createdAt,
  });
}

export function convertOutboxRecordToDmMessage(record: DmOutboxRecord): DmMessage {
  const peerPubkeys = [...new Set(
    record.participantPubkeys.filter((pubkey) => pubkey !== record.ownerPubkey),
  )].sort();
  const participantPubkeys = [...new Set([record.ownerPubkey, ...peerPubkeys])].sort();

  return {
    conversationId: encodeConversationId(peerPubkeys),
    wrapId: `optimistic:${record.clientId}`,
    rumorId: `optimistic:${record.clientId}`,
    senderPubkey: record.ownerPubkey,
    participantPubkeys,
    peerPubkeys,
    content: record.content,
    createdAt: record.createdAt,
    isOutgoing: true,
    share: record.share,
    clientId: record.clientId,
    deliveryState: record.deliveryState,
    errorMessage: record.errorMessage,
    isOptimistic: true,
  };
}

export function mergeFetchedAndOutboxMessages(
  fetched: DmMessage[],
  outbox: DmOutboxRecord[],
): { messages: DmMessage[]; reconciledClientIds: string[] } {
  const reconciledClientIds: string[] = [];
  const optimisticMessages: DmMessage[] = [];

  for (const record of outbox) {
    if (fetched.some((message) => isReconciledDmMessage(record, message))) {
      reconciledClientIds.push(record.clientId);
      continue;
    }

    optimisticMessages.push(convertOutboxRecordToDmMessage(record));
  }

  const messages = [...fetched, ...optimisticMessages].sort((left, right) => left.createdAt - right.createdAt);

  return {
    messages,
    reconciledClientIds,
  };
}

export function markDmOutboxRecordSent(ownerPubkey: string, clientId: string): DmOutboxRecord | undefined {
  const record = getDmOutboxRecord(ownerPubkey, clientId);
  if (!record) {
    return undefined;
  }

  const updatedRecord = {
    ...record,
    deliveryState: 'sent' as const,
    errorMessage: undefined,
    lastAttemptAt: nowInSeconds(),
  };

  upsertDmOutboxRecord(ownerPubkey, updatedRecord);
  return updatedRecord;
}

export function markDmOutboxRecordFailed(
  ownerPubkey: string,
  clientId: string,
  errorMessage: string,
): DmOutboxRecord | undefined {
  const record = getDmOutboxRecord(ownerPubkey, clientId);
  if (!record) {
    return undefined;
  }

  const updatedRecord = {
    ...record,
    deliveryState: 'failed' as const,
    errorMessage,
    lastAttemptAt: nowInSeconds(),
  };

  upsertDmOutboxRecord(ownerPubkey, updatedRecord);
  return updatedRecord;
}
