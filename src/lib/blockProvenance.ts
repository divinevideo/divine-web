const STORAGE_PREFIX = 'divine:block-provenance';
export const BLOCK_PROVENANCE_EVENT = 'divine:block-provenance-changed';

export interface BlockProvenanceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getStorageKey(ownerPubkey: string): string {
  return `${STORAGE_PREFIX}:${ownerPubkey}`;
}

function notifyBlockProvenanceChanged(ownerPubkey: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BLOCK_PROVENANCE_EVENT, { detail: getStorageKey(ownerPubkey) }));
}

function readRawBlockedPubkeys(ownerPubkey: string, storage: BlockProvenanceStorage): string[] {
  try {
    const storedValue = storage.getItem(getStorageKey(ownerPubkey));
    if (!storedValue) return [];
    const parsed = JSON.parse(storedValue);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

export function readBlockProvenance(
  ownerPubkey: string | undefined,
  storage: BlockProvenanceStorage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): Set<string> {
  if (!ownerPubkey || !storage) return new Set();
  return new Set(readRawBlockedPubkeys(ownerPubkey, storage));
}

export function addBlockProvenance(
  ownerPubkey: string,
  blockedPubkey: string,
  storage: BlockProvenanceStorage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): void {
  if (!storage || ownerPubkey === blockedPubkey) return;
  const next = readBlockProvenance(ownerPubkey, storage);
  next.add(blockedPubkey);
  try {
    storage.setItem(getStorageKey(ownerPubkey), JSON.stringify([...next].sort()));
    notifyBlockProvenanceChanged(ownerPubkey);
  } catch {
    // Keep the published block even when local provenance cannot persist.
  }
}

export function removeBlockProvenance(
  ownerPubkey: string,
  blockedPubkey: string,
  storage: BlockProvenanceStorage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): void {
  if (!storage) return;
  const next = readBlockProvenance(ownerPubkey, storage);
  next.delete(blockedPubkey);
  try {
    if (next.size === 0) {
      storage.removeItem(getStorageKey(ownerPubkey));
    } else {
      storage.setItem(getStorageKey(ownerPubkey), JSON.stringify([...next].sort()));
    }
    notifyBlockProvenanceChanged(ownerPubkey);
  } catch {
    // Ignore persistence failures; the kind 10000 publish is authoritative.
  }
}

export function getExplicitBlockedPubkeys(
  ownerPubkey: string | undefined,
  mutedPubkeys: Iterable<string>,
  storage: BlockProvenanceStorage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): Set<string> {
  const provenance = readBlockProvenance(ownerPubkey, storage);
  if (!ownerPubkey || provenance.size === 0) return new Set();
  const muted = new Set(mutedPubkeys);
  return new Set([...provenance].filter(pubkey => muted.has(pubkey)));
}
