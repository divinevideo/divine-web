import {
  encodeConversationId,
  type DmDeliveryState,
  type DmMessage,
  type DmRumorEvent,
  type DmSharePayload,
} from './dm';

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
  /**
   * The kind-14 rumor built for the first attempt. A retry re-wraps this
   * rumor instead of minting a new one, so every attempt carries the same
   * rumor id — the only identity a receiver can dedupe on (#578). Absent on
   * records written before the rumor was persisted, and on records whose
   * first attempt failed before the rumor was built.
   */
  rumor?: DmRumorEvent;
}

interface CreateDmOutboxRecordInput {
  ownerPubkey: string;
  participantPubkeys: string[];
  content: string;
  share?: DmSharePayload;
  clientId?: string;
}

function getStorageKey(ownerPubkey: string): string {
  return `${DM_OUTBOX_STORAGE_PREFIX}${ownerPubkey}`;
}

function nowInSeconds(): number {
  return Math.round(Date.now() / 1000);
}

function getLocalStorage(): Storage | undefined {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
      return undefined;
    }

    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function buildClientId(participantPubkeys: string[], createdAt: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `dm-${crypto.randomUUID()}`;
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  return `dm-${participantPubkeys.join('-').slice(0, 16)}-${createdAt}-${randomPart}`;
}

function isPersistedRumor(value: unknown): value is DmRumorEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const rumor = value as Partial<DmRumorEvent>;

  return (
    typeof rumor.id === 'string' &&
    typeof rumor.pubkey === 'string' &&
    typeof rumor.kind === 'number' &&
    typeof rumor.created_at === 'number' &&
    typeof rumor.content === 'string' &&
    Array.isArray(rumor.tags) &&
    rumor.tags.every((tag) => Array.isArray(tag) && tag.every((entry) => typeof entry === 'string'))
  );
}

function normalizeRecord(record: DmOutboxRecord): DmOutboxRecord {
  // A malformed persisted rumor drops rather than invalidating the whole
  // record: the pending message is still sendable, it just mints a fresh
  // rumor instead of replaying one that cannot be trusted.
  const { rumor, ...rest } = record;

  return {
    ...rest,
    participantPubkeys: [...new Set(record.participantPubkeys)].sort(),
    ...(isPersistedRumor(rumor) ? { rumor } : {}),
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

/**
 * Mint the client-side identity for a send.
 *
 * Called at the moment the user sends, so the id exists before the mutation
 * runs and every later step — the outbox record, the persisted rumor, a retry
 * — keys off the same value (#578).
 */
export function createDmClientId(participantPubkeys: string[]): string {
  return buildClientId([...new Set(participantPubkeys)].sort(), nowInSeconds());
}

export function createDmOutboxRecord(input: CreateDmOutboxRecordInput): DmOutboxRecord {
  const createdAt = nowInSeconds();
  const participantPubkeys = [...new Set(input.participantPubkeys)].sort();

  return {
    clientId: input.clientId || buildClientId(participantPubkeys, createdAt),
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

  try {
    storage.setItem(
      getStorageKey(ownerPubkey),
      JSON.stringify(records.map(normalizeRecord)),
    );
  } catch {
    // Persistence is best-effort. DM rendering should still work without storage.
  }
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

/**
 * Persist the rumor built for a send so a later retry re-wraps the same one.
 *
 * Called once the rumor exists, which is after `onMutate` has already written
 * the record — hence a separate write rather than a field on creation.
 */
export function attachDmOutboxRumor(
  ownerPubkey: string,
  clientId: string,
  rumor: DmRumorEvent,
): DmOutboxRecord | undefined {
  const record = getDmOutboxRecord(ownerPubkey, clientId);
  if (!record) {
    return undefined;
  }

  const updatedRecord = { ...record, rumor };
  upsertDmOutboxRecord(ownerPubkey, updatedRecord);
  return updatedRecord;
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

export function markDmOutboxRecordSending(
  ownerPubkey: string,
  clientId: string,
  input?: Pick<DmOutboxRecord, 'participantPubkeys' | 'content' | 'share'>,
): DmOutboxRecord | undefined {
  const record = getDmOutboxRecord(ownerPubkey, clientId);
  if (!record) {
    return undefined;
  }

  const updatedRecord = {
    ...record,
    participantPubkeys: input?.participantPubkeys || record.participantPubkeys,
    content: input?.content ?? record.content,
    share: input?.share ?? record.share,
    deliveryState: 'sending' as const,
    errorMessage: undefined,
    lastAttemptAt: nowInSeconds(),
    retryCount: record.retryCount + 1,
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
