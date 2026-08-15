import { describe, expect, it } from 'vitest';

import {
  addBlockProvenance,
  getExplicitBlockedPubkeys,
  removeBlockProvenance,
  type BlockProvenanceStorage,
} from './blockProvenance';

function createStorage(): BlockProvenanceStorage {
  const store = new Map<string, string>();
  return {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: key => {
      store.delete(key);
    },
  };
}

describe('block provenance', () => {
  it('keeps explicit blocks scoped to the owning account and current kind 10000 p-tags', () => {
    const storage = createStorage();
    const ownerA = 'a'.repeat(64);
    const ownerB = 'b'.repeat(64);
    const target = 'c'.repeat(64);

    addBlockProvenance(ownerA, target, storage);
    addBlockProvenance(ownerB, 'd'.repeat(64), storage);

    expect(getExplicitBlockedPubkeys(ownerA, [target], storage)).toEqual(new Set([target]));
    expect(getExplicitBlockedPubkeys(ownerB, [target], storage)).toEqual(new Set());
    expect(getExplicitBlockedPubkeys(ownerA, [], storage)).toEqual(new Set());
  });

  it('removes explicit block provenance without affecting other blocked pubkeys', () => {
    const storage = createStorage();
    const owner = 'a'.repeat(64);
    const first = 'b'.repeat(64);
    const second = 'c'.repeat(64);

    addBlockProvenance(owner, first, storage);
    addBlockProvenance(owner, second, storage);
    removeBlockProvenance(owner, first, storage);

    expect(getExplicitBlockedPubkeys(owner, [first, second], storage)).toEqual(new Set([second]));
  });
});
