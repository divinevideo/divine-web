const STORAGE_PREFIX = 'divine:moderation-provenance:v1';
const LEGACY_BLOCK_STORAGE_PREFIX = 'divine:block-provenance';
export const BLOCK_PROVENANCE_EVENT = 'divine:block-provenance-changed';

export interface ModerationProvenanceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * The most recent kind 10000 event web has seen or published for the owner.
 * Relays can miss the list or answer with an older copy; remembering the last
 * known-good snapshot keeps a mutation from republishing a downgraded list.
 */
export interface RememberedOwnMuteList {
  createdAt: number;
  tags: string[][];
  content: string;
  eventId?: string;
}

interface ModerationProvenanceRecord {
  blockedPubkeys: string[];
  webMutedPubkeys: string[];
  rememberedOwnMuteList?: RememberedOwnMuteList;
}

function getStorageKey(ownerPubkey: string): string {
  return `${STORAGE_PREFIX}:${ownerPubkey}`;
}

function getLegacyBlockStorageKey(ownerPubkey: string): string {
  return `${LEGACY_BLOCK_STORAGE_PREFIX}:${ownerPubkey}`;
}

function notifyBlockProvenanceChanged(ownerPubkey: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BLOCK_PROVENANCE_EVENT, { detail: getStorageKey(ownerPubkey) }));
}

function normalizePubkeys(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function normalizeRememberedList(value: unknown): RememberedOwnMuteList | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const remembered = value as Partial<RememberedOwnMuteList>;
  if (
    typeof remembered.createdAt !== 'number'
    || !Array.isArray(remembered.tags)
    || typeof remembered.content !== 'string'
  ) {
    return undefined;
  }

  return {
    createdAt: remembered.createdAt,
    tags: remembered.tags
      .filter((tag): tag is string[] => Array.isArray(tag))
      .map(tag => tag.filter((part): part is string => typeof part === 'string')),
    content: remembered.content,
    eventId: typeof remembered.eventId === 'string' ? remembered.eventId : undefined,
  };
}

function readRecord(ownerPubkey: string, storage: ModerationProvenanceStorage): ModerationProvenanceRecord {
  try {
    const storedValue = storage.getItem(getStorageKey(ownerPubkey));
    const legacyStoredValue = storage.getItem(getLegacyBlockStorageKey(ownerPubkey));
    if (!storedValue && !legacyStoredValue) return { blockedPubkeys: [], webMutedPubkeys: [] };
    if (!storedValue && legacyStoredValue) {
      return { blockedPubkeys: normalizePubkeys(JSON.parse(legacyStoredValue)), webMutedPubkeys: [] };
    }
    if (!storedValue) return { blockedPubkeys: [], webMutedPubkeys: [] };
    const parsed = JSON.parse(storedValue);
    if (Array.isArray(parsed)) {
      return { blockedPubkeys: normalizePubkeys(parsed), webMutedPubkeys: [] };
    }
    if (!parsed || typeof parsed !== 'object') {
      return { blockedPubkeys: [], webMutedPubkeys: [] };
    }
    const record = parsed as Partial<ModerationProvenanceRecord>;
    return {
      blockedPubkeys: normalizePubkeys(record.blockedPubkeys),
      webMutedPubkeys: normalizePubkeys(record.webMutedPubkeys),
      rememberedOwnMuteList: normalizeRememberedList(record.rememberedOwnMuteList),
    };
  } catch {
    return { blockedPubkeys: [], webMutedPubkeys: [] };
  }
}

function writeRecord(
  ownerPubkey: string,
  record: ModerationProvenanceRecord,
  storage: ModerationProvenanceStorage,
): void {
  const normalized: ModerationProvenanceRecord = {
    blockedPubkeys: [...new Set(record.blockedPubkeys)].sort(),
    webMutedPubkeys: [...new Set(record.webMutedPubkeys)].sort(),
    ...(record.rememberedOwnMuteList ? { rememberedOwnMuteList: record.rememberedOwnMuteList } : {}),
  };
  if (
    normalized.blockedPubkeys.length === 0
    && normalized.webMutedPubkeys.length === 0
    && !normalized.rememberedOwnMuteList
  ) {
    storage.removeItem(getStorageKey(ownerPubkey));
  } else {
    storage.setItem(getStorageKey(ownerPubkey), JSON.stringify(normalized));
  }
}

export function readBlockProvenance(
  ownerPubkey: string | undefined,
  storage: ModerationProvenanceStorage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): Set<string> {
  if (!ownerPubkey || !storage) return new Set();
  return new Set(readRecord(ownerPubkey, storage).blockedPubkeys);
}

export function addBlockProvenance(
  ownerPubkey: string,
  blockedPubkey: string,
  storage: ModerationProvenanceStorage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): void {
  if (!storage || ownerPubkey === blockedPubkey) return;
  const record = readRecord(ownerPubkey, storage);
  try {
    writeRecord(ownerPubkey, {
      ...record,
      blockedPubkeys: [...record.blockedPubkeys, blockedPubkey],
    }, storage);
    notifyBlockProvenanceChanged(ownerPubkey);
  } catch {
    // Keep the published block even when local provenance cannot persist.
  }
}

export function removeBlockProvenance(
  ownerPubkey: string,
  blockedPubkey: string,
  storage: ModerationProvenanceStorage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): void {
  if (!storage) return;
  const record = readRecord(ownerPubkey, storage);
  try {
    writeRecord(ownerPubkey, {
      ...record,
      blockedPubkeys: record.blockedPubkeys.filter(pubkey => pubkey !== blockedPubkey),
    }, storage);
    notifyBlockProvenanceChanged(ownerPubkey);
  } catch {
    // Ignore persistence failures; the kind 10000 publish is authoritative.
  }
}

export function getExplicitBlockedPubkeys(
  ownerPubkey: string | undefined,
  mutedPubkeys: Iterable<string>,
  storage: ModerationProvenanceStorage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): Set<string> {
  const provenance = readBlockProvenance(ownerPubkey, storage);
  if (!ownerPubkey || provenance.size === 0) return new Set();
  const muted = new Set(mutedPubkeys);
  return new Set([...provenance].filter(pubkey => muted.has(pubkey)));
}

export function recordWebMute(
  ownerPubkey: string,
  mutedPubkey: string,
  storage: ModerationProvenanceStorage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): void {
  if (!storage || ownerPubkey === mutedPubkey) return;
  const record = readRecord(ownerPubkey, storage);
  try {
    writeRecord(ownerPubkey, {
      ...record,
      webMutedPubkeys: [...record.webMutedPubkeys, mutedPubkey],
    }, storage);
  } catch {
    // Mute provenance is best-effort; the relay list stays authoritative.
  }
}

export function clearWebMute(
  ownerPubkey: string,
  mutedPubkey: string,
  storage: ModerationProvenanceStorage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): void {
  if (!storage) return;
  const record = readRecord(ownerPubkey, storage);
  try {
    writeRecord(ownerPubkey, {
      ...record,
      webMutedPubkeys: record.webMutedPubkeys.filter(pubkey => pubkey !== mutedPubkey),
    }, storage);
  } catch {
    // Mute provenance is best-effort; the relay list stays authoritative.
  }
}

export function isWebAuthoredMute(
  ownerPubkey: string | undefined,
  mutedPubkey: string,
  storage: ModerationProvenanceStorage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): boolean {
  if (!ownerPubkey || !storage) return false;
  return readRecord(ownerPubkey, storage).webMutedPubkeys.includes(mutedPubkey);
}

export function getWebMutedPubkeys(
  ownerPubkey: string | undefined,
  storage: ModerationProvenanceStorage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): Set<string> {
  if (!ownerPubkey || !storage) return new Set();
  return new Set(readRecord(ownerPubkey, storage).webMutedPubkeys);
}

export function rememberOwnMuteList(
  ownerPubkey: string,
  list: RememberedOwnMuteList,
  storage: ModerationProvenanceStorage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): void {
  if (!storage) return;
  const record = readRecord(ownerPubkey, storage);
  try {
    writeRecord(ownerPubkey, {
      ...record,
      rememberedOwnMuteList: {
        createdAt: list.createdAt,
        tags: list.tags.map(tag => [...tag]),
        content: list.content,
        eventId: list.eventId,
      },
    }, storage);
  } catch {
    // Best-effort: a missed snapshot only costs us the downgrade guard.
  }
}

export function getRememberedOwnMuteList(
  ownerPubkey: string | undefined,
  storage: ModerationProvenanceStorage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): RememberedOwnMuteList | null {
  if (!ownerPubkey || !storage) return null;
  const remembered = readRecord(ownerPubkey, storage).rememberedOwnMuteList;
  if (!remembered) return null;

  return {
    createdAt: remembered.createdAt,
    tags: remembered.tags.map(tag => [...tag]),
    content: remembered.content,
    eventId: remembered.eventId,
  };
}
