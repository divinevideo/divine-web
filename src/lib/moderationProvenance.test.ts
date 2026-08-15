import { describe, expect, it } from 'vitest';

import {
  addBlockProvenance,
  clearWebMute,
  getExplicitBlockedPubkeys,
  getRememberedOwnMuteList,
  getWebMutedPubkeys,
  isWebAuthoredMute,
  removeBlockProvenance,
  recordWebMute,
  rememberOwnMuteList,
  type ModerationProvenanceStorage,
} from './moderationProvenance';

function createStorage(): ModerationProvenanceStorage {
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

  it('preserves web mute provenance when block provenance changes', () => {
    const storage = createStorage();
    const owner = 'a'.repeat(64);
    const blocked = 'b'.repeat(64);
    const muted = 'c'.repeat(64);

    recordWebMute(owner, muted, storage);
    addBlockProvenance(owner, blocked, storage);
    removeBlockProvenance(owner, blocked, storage);

    expect(isWebAuthoredMute(owner, muted, storage)).toBe(true);
    clearWebMute(owner, muted, storage);
    expect(isWebAuthoredMute(owner, muted, storage)).toBe(false);
  });

  it('reads the previous block-only array storage shape', () => {
    const storage = createStorage();
    const owner = 'a'.repeat(64);
    const target = 'b'.repeat(64);
    storage.setItem(`divine:block-provenance:${owner}`, JSON.stringify([target]));

    expect(getExplicitBlockedPubkeys(owner, [target], storage)).toEqual(new Set([target]));
  });
});

describe('web mute provenance', () => {
  it('returns every web-authored mute for the owner and nobody else', () => {
    const storage = createStorage();
    const ownerA = 'a'.repeat(64);
    const ownerB = 'b'.repeat(64);
    const first = 'c'.repeat(64);
    const second = 'd'.repeat(64);

    recordWebMute(ownerA, first, storage);
    recordWebMute(ownerA, second, storage);
    recordWebMute(ownerB, first, storage);

    expect(getWebMutedPubkeys(ownerA, storage)).toEqual(new Set([first, second]));
    expect(getWebMutedPubkeys(undefined, storage)).toEqual(new Set());
  });
});

describe('remembered own mute list', () => {
  const owner = 'a'.repeat(64);
  const snapshot = {
    createdAt: 1_900_000_000,
    tags: [['p', 'b'.repeat(64)], ['t', 'nsfw']],
    content: 'encrypted',
    eventId: 'e'.repeat(64),
  };

  it('round-trips the snapshot without sharing tag arrays', () => {
    const storage = createStorage();
    rememberOwnMuteList(owner, snapshot, storage);

    const remembered = getRememberedOwnMuteList(owner, storage);
    expect(remembered).toEqual(snapshot);

    remembered!.tags[0][1] = 'mutated';
    expect(getRememberedOwnMuteList(owner, storage)).toEqual(snapshot);
  });

  it('survives a write that empties both pubkey lists', () => {
    const storage = createStorage();
    const muted = 'c'.repeat(64);

    rememberOwnMuteList(owner, snapshot, storage);
    recordWebMute(owner, muted, storage);
    clearWebMute(owner, muted, storage);

    expect(getRememberedOwnMuteList(owner, storage)).toEqual(snapshot);
  });

  it('stays scoped to the owning account', () => {
    const storage = createStorage();
    rememberOwnMuteList(owner, snapshot, storage);

    expect(getRememberedOwnMuteList('f'.repeat(64), storage)).toBeNull();
    expect(getRememberedOwnMuteList(undefined, storage)).toBeNull();
  });

  it('ignores a malformed stored snapshot instead of throwing', () => {
    const storage = createStorage();
    storage.setItem(
      `divine:moderation-provenance:v1:${owner}`,
      JSON.stringify({ blockedPubkeys: [], webMutedPubkeys: [], rememberedOwnMuteList: { createdAt: 'nope' } }),
    );

    expect(getRememberedOwnMuteList(owner, storage)).toBeNull();
  });
});
