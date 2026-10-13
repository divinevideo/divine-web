/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// ABOUTME: Pure TypeScript Concord protocol (CORD-01..08) — no React, no IO, no new signer.
// ABOUTME: Derivations/kinds per Concord spec Appx A/B; secp256k1 and NIP-44 via nostr-tools, SHA-256/HMAC/HKDF implemented here.

import { finalizeEvent, generateSecretKey, getPublicKey, nip44, verifyEvent, type Event as NostrEvent } from 'nostr-tools';

// --- byte helpers ---
export const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
export const hexToBytes = (hex: string): Uint8Array => {
  if (!/^[0-9a-f]*$/.test(hex) || hex.length % 2) throw new Error('concord: bad hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};
export const bytesToHex = (b: Uint8Array): string => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
export const concatBytes = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
export const u64be = (n: number | bigint): Uint8Array => {
  const out = new Uint8Array(8); let v = BigInt(n);
  for (let i = 7; i >= 0; i--) { out[i] = Number(v & 0xffn); v >>= 8n; }
  return out;
};
export const byteLen = (s: string): number => utf8(s).length;
/** Unpadded base64url (43 chars for 32 bytes), CORD-02 §8. Never case-fold. */
export function bytesToB64url(b: Uint8Array): string {
  let bin = ''; for (const x of b) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64urlToBytes(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('concord: bad base64url');
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
export const hexToB64url = (hex: string): string => bytesToB64url(hexToBytes(hex));
export const b64urlToHex = (s: string): string => bytesToHex(b64urlToBytes(s));
export const isB64url32 = (s: unknown): s is string => typeof s === 'string' && s.length === 43 && /^[A-Za-z0-9_-]{43}$/.test(s);

// --- SHA-256 / HMAC / HKDF (pure, byte-exact) ---
const K = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
];
const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
export function sha256Bytes(input: Uint8Array): Uint8Array {
  const bitLen = input.length * 8;
  const padded = new Uint8Array((((input.length + 9 + 63) >> 6) << 6));
  padded.set(input); padded[input.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen >>> 0);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 2 ** 32));
  let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const w = new Uint32Array(64);
  for (let block = 0; block < padded.length; block += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(block + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15] >>> 3);
      const s1 = rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    let [a,b,c,d,e,f,g,hh] = h;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + s1 + ch + K[i] + w[i]) | 0;
      const s0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) | 0;
      hh=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
    }
    h = [(h[0]+a)|0,(h[1]+b)|0,(h[2]+c)|0,(h[3]+d)|0,(h[4]+e)|0,(h[5]+f)|0,(h[6]+g)|0,(h[7]+hh)|0];
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  h.forEach((x, i) => ov.setUint32(i * 4, x >>> 0));
  return out;
}
export const sha256Hex = (input: string): string => bytesToHex(sha256Bytes(utf8(input)));
function hmacSha256(key: Uint8Array, msg: Uint8Array): Uint8Array {
  const k = key.length > 64 ? sha256Bytes(key) : key;
  const block = new Uint8Array(64); block.set(k);
  const ipad = block.map((x) => x ^ 0x36); const opad = block.map((x) => x ^ 0x5c);
  return sha256Bytes(concatBytes(opad, sha256Bytes(concatBytes(ipad, msg))));
}
/** HKDF-SHA256 per CORD-02 A.1: salt empty, info=utf8(label)||0x00||id[32]||epoch_be[8]?. */
export function hkdfSeed(secret: Uint8Array, label: string, id: Uint8Array, epoch?: number | bigint, counter?: number): Uint8Array {
  if (id.length !== 32) throw new Error('concord: hkdf id must be 32 bytes');
  let info = concatBytes(utf8(label), new Uint8Array([0]), id);
  if (epoch !== undefined) info = concatBytes(info, u64be(epoch));
  if (counter !== undefined) info = concatBytes(info, new Uint8Array([counter]));
  const prk = hmacSha256(new Uint8Array(0), secret);
  return hmacSha256(prk, concatBytes(info, new Uint8Array([1]))).slice(0, 32);
}

// --- group_key / scalar_normalize (A.2/A.3) ---
const SECP_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
export const isValidScalar = (seed: Uint8Array): boolean => {
  if (seed.length !== 32) return false;
  const v = BigInt('0x' + bytesToHex(seed));
  return v > 0n && v < SECP_ORDER;
};
export interface GroupKey { seed: Uint8Array; secretKey: Uint8Array; pubkey: string; conversationKey: Uint8Array }
export function groupKey(label: string, secret: Uint8Array, id: Uint8Array, epoch?: number | bigint): GroupKey {
  let counter: number | undefined;
  for (;;) {
    const seed = hkdfSeed(secret, label, id, epoch, counter);
    if (isValidScalar(seed)) {
      const pubkey = getPublicKey(seed);
      return { seed, secretKey: seed, pubkey, conversationKey: nip44.getConversationKey(seed, pubkey) };
    }
    counter = (counter ?? -1) + 1;
    if (counter > 255) throw new Error('concord: scalar_normalize exhausted');
  }
}
export const groupKeyHex = (label: string, secretHex: string, idHex: string, epoch?: number): GroupKey =>
  groupKey(label, hexToBytes(secretHex), hexToBytes(idHex), epoch);

/** community_id = sha256(utf8('concord/community') || owner_xonly[32] || owner_salt[32]) — A.4 */
export function deriveCommunityId(ownerXonlyHex: string, ownerSaltHex: string): string {
  return bytesToHex(sha256Bytes(concatBytes(utf8('concord/community'), hexToBytes(ownerXonlyHex), hexToBytes(ownerSaltHex))));
}
export const verifyCommunityId = (communityId: string, ownerXonlyHex: string, ownerSaltHex: string): boolean =>
  deriveCommunityId(ownerXonlyHex, ownerSaltHex) === communityId;
/** prevcommit = sha256(utf8('concord/epoch-key-commitment') || prev_epoch_be[8] || prev_key[32]) — A.5 */
export const epochKeyCommitment = (prevEpoch: number, prevKeyHex: string): string =>
  bytesToHex(sha256Bytes(concatBytes(utf8('concord/epoch-key-commitment'), u64be(prevEpoch), hexToBytes(prevKeyHex))));
export const ZERO32_HEX = '0'.repeat(64);
export const dissolvedPubkey = (communityIdHex: string): string =>
  groupKey('concord/dissolved', hexToBytes(communityIdHex), new Uint8Array(32)).pubkey;
export const grantLocator = (communityIdHex: string, memberXonlyHex: string): string =>
  bytesToHex(hkdfSeed(hexToBytes(communityIdHex), 'concord/grant', hexToBytes(memberXonlyHex)));
export const banlistLocator = (communityIdHex: string): string =>
  bytesToHex(hkdfSeed(hexToBytes(communityIdHex), 'concord/banlist', new Uint8Array(32)));
export const pinsLocator = (communityIdHex: string, channelIdHex: string): string =>
  bytesToHex(hkdfSeed(hexToBytes(communityIdHex), 'concord/pins', hexToBytes(channelIdHex)));
export const inviteRegistryLocator = (communityIdHex: string, creatorXonlyHex: string): string =>
  bytesToHex(hkdfSeed(hexToBytes(communityIdHex), 'concord/invite-links', hexToBytes(creatorXonlyHex)));
/** Split control keys (CORD-02 §5) + legacy pre-split derivation retained for old epochs. */
export const controlSignerKey = (controlRootHex: string, communityIdHex: string, epoch: number): GroupKey =>
  groupKeyHex('concord/control-signer', controlRootHex, communityIdHex, epoch);
export const controlReadKey = (communityRootHex: string, communityIdHex: string, epoch: number): GroupKey =>
  groupKeyHex('concord/control', communityRootHex, communityIdHex, epoch);
/** Legacy epoch address/signer is the controlReadKey's pubkey/secret (same derivation, pre-split use). */
export const legacyControlKey = controlReadKey;
export const guestbookKey = (communityRootHex: string, communityIdHex: string, epoch: number): GroupKey =>
  groupKeyHex('concord/guestbook', communityRootHex, communityIdHex, epoch);

// --- limits (CORD-02 Appx B, CORD-04 §7, CORD-05 §1) ---
export const NIP44_MAX_PLAINTEXT = 65535;
export const LIST_EVENT_MAX_BYTES = 65536;
export const LIST_TARGET_BYTES = 56 * 1024;
export const NAME_MAX_BYTES = 64;
export const DESCRIPTION_MAX_BYTES = 10000;
export const MAX_ROLES_PER_MEMBER = 64;
export const MAX_ROLES_PER_COMMUNITY = 100;
export const BANLIST_PRACTICAL_CAP = 500;
export const PIN_MAX_ENTRIES = 25;
export const PIN_MAX_CONTENT_BYTES = 32768;
export const REKEY_MAX_RECIPIENTS = 120;
export const SNAPSHOT_CHUNK = 400;
export const INVITE_MAX_CHANNELS = 256;
export function assertNip44Plaintext(text: string): void {
  if (byteLen(text) > NIP44_MAX_PLAINTEXT) throw new Error('concord: NIP-44 plaintext exceeds 65535 bytes');
}
export function assertNameBytes(name: string): void {
  if (byteLen(name) > NAME_MAX_BYTES) throw new Error('concord: name exceeds 64 UTF-8 bytes');
}
export function assertDescriptionBytes(desc: string): void {
  if (byteLen(desc) > DESCRIPTION_MAX_BYTES) throw new Error('concord: description exceeds 10000 UTF-8 bytes');
}
/** Fully-encoded event size guard; a strictly-shrinking write is exempt (CORD-02 §8). */
export function assertListEventSize(encodedBytes: number, opts?: { shrinks?: boolean }): void {
  if (opts?.shrinks) return;
  if (encodedBytes > LIST_EVENT_MAX_BYTES) throw new Error('concord: 33302 encoded event exceeds 65536 bytes; start a new fragment');
}
export const pinsWithinLimits = (content: string, entryCount: number): boolean =>
  entryCount <= PIN_MAX_ENTRIES && byteLen(content) <= PIN_MAX_CONTENT_BYTES;

// --- NIP-01 rumor + stream envelope shapes (CORD-01) ---
export interface Rumor { id?: string; kind: number; pubkey: string; content: string; tags: string[][]; created_at: number }
export function computeEventId(e: Omit<Rumor, 'id'>): string {
  return sha256Hex(JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]));
}
export const withId = (e: Omit<Rumor, 'id'>): Rumor => ({ ...e, id: computeEventId(e) });
const tagVal = (r: Rumor, name: string): string | undefined => r.tags.find((t) => t[0] === name)?.[1];
export const msOf = (r: Rumor): number | null => {
  const v = tagVal(r, 'ms'); if (v === undefined || !/^\d+$/.test(v)) return null;
  const n = Number(v); return n >= 0 && n <= 999 ? n : null;
};
export const eventTimeMs = (r: Rumor): number => r.created_at * 1000 + (msOf(r) ?? 0);

const CHAT_BINDING_KINDS = new Set([9, 1111, 7, 5, 3302, 1740, 3310]);
/** Strict author/channel/epoch/ms/id binding check (CORD-03 §3). Returns rejection reason or null. */
export function verifyChatRumor(r: Rumor, expect: { channelId: string; epoch: number; author?: string }): string | null {
  if (!CHAT_BINDING_KINDS.has(r.kind)) return 'unsupported-kind';
  if (expect.author && r.pubkey !== expect.author) return 'author-mismatch';
  if (tagVal(r, 'channel') !== expect.channelId) return 'channel-mismatch';
  if (tagVal(r, 'epoch') !== String(expect.epoch)) return 'epoch-mismatch';
  if (msOf(r) === null) return 'bad-ms';
  if (r.id && r.id !== computeEventId(r)) return 'id-mismatch';
  return null;
}
const bindingTags = (channelId: string, epoch: number, ms: number): string[][] => {
  if (!Number.isInteger(ms) || ms < 0 || ms > 999) throw new Error('concord: ms must be 0..999');
  return [['channel', channelId], ['epoch', String(epoch)], ['ms', String(ms)]];
};
export function messageRumor(p: { author: string; channelId: string; epoch: number; body: string; createdAt: number; ms: number; quote?: { id: string; author: string }; expirationSec?: number }): Rumor {
  assertNip44Plaintext(p.body);
  const tags = bindingTags(p.channelId, p.epoch, p.ms);
  if (p.quote) tags.push(['q', p.quote.id, '', p.quote.author]);
  if (p.expirationSec) tags.push(['expiration', String(p.createdAt + p.expirationSec)]);
  return withId({ kind: 9, pubkey: p.author, content: p.body, tags, created_at: p.createdAt });
}
export function threadReplyRumor(p: { author: string; channelId: string; epoch: number; body: string; createdAt: number; ms: number; root: { id: string; author: string; kind: number }; parent: { id: string; author: string; kind: number }; expirationSec?: number }): Rumor {
  const tags = [...bindingTags(p.channelId, p.epoch, p.ms),
    ['K', String(p.root.kind)], ['E', p.root.id, '', p.root.author], ['P', p.root.author],
    ['k', String(p.parent.kind)], ['e', p.parent.id, '', p.parent.author], ['p', p.parent.author]];
  if (p.expirationSec) tags.push(['expiration', String(p.createdAt + p.expirationSec)]);
  return withId({ kind: 1111, pubkey: p.author, content: p.body, tags, created_at: p.createdAt });
}
export function reactionRumor(p: { author: string; channelId: string; epoch: number; emoji: string; createdAt: number; ms: number; target: { id: string; author: string; kind: number }; expirationSec?: number }): Rumor {
  const tags = [...bindingTags(p.channelId, p.epoch, p.ms), ['e', p.target.id], ['p', p.target.author], ['k', String(p.target.kind)]];
  if (p.expirationSec) tags.push(['expiration', String(p.createdAt + p.expirationSec)]);
  return withId({ kind: 7, pubkey: p.author, content: p.emoji, tags, created_at: p.createdAt });
}
export function editRumor(p: { author: string; channelId: string; epoch: number; body: string; createdAt: number; ms: number; targetId: string; expirationSec?: number }): Rumor {
  const tags = [...bindingTags(p.channelId, p.epoch, p.ms), ['e', p.targetId]];
  if (p.expirationSec) tags.push(['expiration', String(p.createdAt + p.expirationSec)]);
  return withId({ kind: 3302, pubkey: p.author, content: p.body, tags, created_at: p.createdAt });
}
/** Kind 5 delete: own ids only enforced by fold (author check); never carries expiration (CORD-08). */
export function deleteRumor(p: { author: string; channelId: string; epoch: number; createdAt: number; ms: number; targets: { id: string; kind: number }[]; reason?: string }): Rumor {
  const tags = bindingTags(p.channelId, p.epoch, p.ms);
  for (const t of p.targets) { tags.push(['e', t.id]); tags.push(['k', String(t.kind)]); }
  return withId({ kind: 5, pubkey: p.author, content: p.reason ?? '', tags, created_at: p.createdAt });
}
export function timerNoticeRumor(p: { author: string; channelId: string; epoch: number; createdAt: number; ms: number; timerSec: number }): Rumor {
  return withId({ kind: 1740, pubkey: p.author, content: '', tags: [...bindingTags(p.channelId, p.epoch, p.ms), ['timer', String(p.timerSec)]], created_at: p.createdAt });
}
/** Apply edit/delete fold: edits author-only targeting original, deletes author-only. */
export function foldChatRumors(rumors: Rumor[]): Rumor[] {
  const deleted = new Set<string>(); const edits = new Map<string, Rumor>();
  const sorted = [...rumors].sort((a, b) => eventTimeMs(a) - eventTimeMs(b));
  for (const r of sorted) {
    if (r.kind === 5) for (const t of r.tags) if (t[0] === 'e') deleted.add(`${r.pubkey}:${t[1]}`);
    if (r.kind === 3302) {
      const target = tagVal(r, 'e'); const orig = rumors.find((x) => x.id === target);
      if (target && orig && orig.pubkey === r.pubkey) edits.set(target, r);
    }
  }
  return sorted.filter((r) => (r.kind === 9 || r.kind === 1111) && r.id && !deleted.has(`${r.pubkey}:${r.id}`))
    .map((r) => { const e = r.id ? edits.get(r.id) : undefined; return e ? { ...r, content: e.content } : r; });
}

// --- envelope: kind 1059 wrap / 20013|20014 seal (shapes only; cipher injected, signer external) ---
export interface Nip44Cipher { encrypt(pubkey: string, plaintext: string): Promise<string>; decrypt(pubkey: string, ciphertext: string): Promise<string> }
export function sealKindForPlane(plane: 'chat' | 'guestbook' | 'rekey' | 'control'): 20013 | 20014 {
  return plane === 'control' ? 20014 : 20013;
}
export interface StreamWrapShape { kind: 1059; pubkey: string; tags: string[][]; content: string }
export const buildStreamWrapShape = (streamPubkey: string, ephemeralPubkey: string, ciphertext: string): StreamWrapShape =>
  ({ kind: 1059, pubkey: streamPubkey, tags: [['p', ephemeralPubkey]], content: ciphertext });
export const DIRECT_INVITE_WRAP_K_TAG: string[] = ['k', '3313'];

// --- disappearing messages (CORD-08) ---
export function parseMessageExpiration(metadataContent: string): number {
  try {
    const v = (JSON.parse(metadataContent) as { message_expiration?: unknown }).message_expiration;
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch { return 0; }
}
export const rumorExpiresAt = (r: Rumor): number | null => {
  if (r.kind === 5 || r.kind === 1740) return null;
  const v = tagVal(r, 'expiration'); return v && /^\d+$/.test(v) ? Number(v) : null;
};
export const isExpiredRumor = (r: Rumor, nowSec: number): boolean => {
  const exp = rumorExpiresAt(r); return exp !== null && exp <= nowSec;
};
export const purgeExpiredRumors = (rumors: Rumor[], nowSec: number): Rumor[] => rumors.filter((r) => !isExpiredRumor(r, nowSec));
/** Timer notice is shown only if its author holds MANAGE_METADATA in the fold. */
export const shouldShowTimerNotice = (r: Rumor, hasManageMetadata: (author: string) => boolean): boolean =>
  r.kind === 1740 && hasManageMetadata(r.pubkey);

// --- channels (CORD-03) ---
export interface ChannelKeying { pubkey: string; secretKind: 'public' | 'private'; epoch: number }
export function publicChannelKey(communityRootHex: string, channelIdHex: string, rootEpoch: number): ChannelKeying {
  return { pubkey: groupKeyHex('concord/channel', communityRootHex, channelIdHex, rootEpoch).pubkey, secretKind: 'public', epoch: rootEpoch };
}
export function privateChannelKey(channelKeyHex: string, channelIdHex: string, channelEpoch: number): ChannelKeying {
  return { pubkey: groupKeyHex('concord/channel', channelKeyHex, channelIdHex, channelEpoch).pubkey, secretKind: 'private', epoch: channelEpoch };
}
/** Resolve the live stream key for a channel from kind-33302-held material.
 *  List fields are base64url-43; a held channel `key` means private (per-channel
 *  epoch), otherwise the key derives from community_root at root_epoch. */
type HeldJoinMaterial = Pick<JoinMaterial, 'community_root' | 'root_epoch' | 'channels'>;
export function streamKeyFromListEntry(entry: { current: HeldJoinMaterial }, channelIdB64: string): GroupKey | null {
  const channel = entry.current.channels.find((c) => c.id === channelIdB64);
  if (!channel) return null;
  const channelIdHex = b64urlToHex(channel.id);
  if (channel.key) return groupKeyHex('concord/channel', b64urlToHex(channel.key), channelIdHex, channel.epoch);
  return groupKeyHex('concord/channel', b64urlToHex(entry.current.community_root), channelIdHex, entry.current.root_epoch);
}
/** A held channel's stream key plus the canonical binding its rumors carry (hex channel id, key epoch). */
export interface HeldStream { key: GroupKey; channelId: string; epoch: number }
/** Held stream for the route's community (base64url or hex id) and channel (name or id); null when not held. */
export function heldStream(entries: { community_id: string; current: HeldJoinMaterial }[], communityId: string | undefined, channelRef: string): HeldStream | null {
  if (!communityId) return null;
  const id = /^[0-9a-f]{64}$/.test(communityId) ? hexToB64url(communityId) : communityId;
  const entry = entries.find((e) => e.community_id === id);
  const channel = entry?.current.channels.find((c) => c.name === channelRef || c.id === channelRef);
  const key = entry && channel ? streamKeyFromListEntry(entry, channel.id) : null;
  if (!entry || !channel || !key) return null;
  return { key, channelId: b64urlToHex(channel.id), epoch: channel.key ? channel.epoch : entry.current.root_epoch };
}
/** Privatise mints an independent key at the NEXT monotonic channel_epoch (first = 1). */
export const nextPrivateEpoch = (currentEpoch: number): number => Math.max(0, Math.floor(currentEpoch)) + 1;
export interface ChannelMetadata { name: string; private: boolean; deleted?: boolean; custom?: Record<string, unknown>; [unknown: string]: unknown }
export function validateChannelMetadata(m: ChannelMetadata): string | null {
  if (byteLen(m.name ?? '') > NAME_MAX_BYTES) return 'name-too-long';
  if (typeof m.private !== 'boolean') return 'bad-private-flag';
  return null;
}

// --- control editions + fold (CORD-04) ---
export const PERM = { MANAGE_ROLES: 1n << 0n, MANAGE_CHANNELS: 1n << 1n, MANAGE_METADATA: 1n << 2n, KICK: 1n << 3n, BAN: 1n << 4n, MANAGE_MESSAGES: 1n << 5n, CREATE_INVITE: 1n << 6n, VIEW_AUDIT_LOG: 1n << 8n, MENTION_EVERYONE: 1n << 9n, PIN_MESSAGES: 1n << 11n } as const;
export const STAFF_PERMS: bigint = PERM.MANAGE_ROLES | PERM.MANAGE_CHANNELS | PERM.MANAGE_METADATA | PERM.BAN | PERM.CREATE_INVITE | PERM.PIN_MESSAGES;
export function parsePermissions(v: string | number): bigint {
  if (typeof v === 'number') return BigInt(Math.trunc(v));
  if (!/^\d+$/.test(v)) throw new Error('concord: permissions must be decimal string');
  return BigInt(v);
}
export const formatPermissions = (v: bigint): string => v.toString(10);
const EDITION_LABEL = 'vector-community/v1/edition';
const len64 = (b: Uint8Array): Uint8Array => concatBytes(u64be(b.length), b);
export function editionHash(entityIdHex: string, version: number, prevHex: string | undefined, content: string): string {
  const prevPart = prevHex ? concatBytes(new Uint8Array([1]), hexToBytes(prevHex)) : concatBytes(new Uint8Array([0]), new Uint8Array(32));
  return bytesToHex(sha256Bytes(concatBytes(len64(utf8(EDITION_LABEL)), hexToBytes(entityIdHex), u64be(version), prevPart, len64(utf8(content)))));
}
export interface ControlEdition { rumorId: string; actor: string; vsk: number; eid: string; ev: number; ep?: string; vac?: [string, string, string]; content: string; createdAt?: number; ms?: number }
export function editionFromRumor(r: Rumor): ControlEdition {
  if (r.kind !== 3308) throw new Error('concord: not a 3308 edition');
  const vacTag = r.tags.find((t) => t[0] === 'vac');
  return {
    rumorId: r.id ?? computeEventId(r), actor: r.pubkey,
    vsk: Number(tagVal(r, 'vsk')), eid: tagVal(r, 'eid') ?? '', ev: Number(tagVal(r, 'ev')),
    ep: tagVal(r, 'ep'), vac: vacTag ? [vacTag[1], vacTag[2], vacTag[3]] as [string, string, string] : undefined,
    content: r.content, createdAt: r.created_at, ms: msOf(r) ?? undefined,
  };
}
export function buildEditionRumor(p: { actor: string; vsk: number; eid: string; ev: number; ep?: string; vac?: [string, string, string]; content: string; createdAt: number; ms: number }): Rumor {
  assertNip44Plaintext(p.content);
  const tags: string[][] = [['vsk', String(p.vsk)], ['eid', p.eid], ['ev', String(p.ev)]];
  if (p.ep) tags.push(['ep', p.ep]);
  if (p.vac) tags.push(['vac', ...p.vac]);
  tags.push(['ms', String(p.ms)]);
  return withId({ kind: 3308, pubkey: p.actor, content: p.content, tags, created_at: p.createdAt });
}
export interface RoleDef { role_id: string; name: string; position: number; permissions: string; scope: { kind: string; channel_id?: string }; color: number }
export interface GrantDef { member: string; role_ids: string[]; control_wrap?: string }
export interface FoldedControl {
  owner: string; roles: Map<string, RoleDef>; grants: Map<string, GrantDef>; bans: string[];
  channels: Map<string, ChannelMetadata>; metadata?: Record<string, unknown>;
  heads: Map<string, ControlEdition & { hash: string }>;
  parked: { rumorId: string; reason: string }[]; rejected: { rumorId: string; reason: string }[];
}
const REQUIRED_PERM: Record<number, bigint | null> = { 0: PERM.MANAGE_METADATA, 1: PERM.MANAGE_ROLES, 2: PERM.MANAGE_CHANNELS, 3: PERM.MANAGE_ROLES, 4: PERM.BAN, 8: PERM.CREATE_INVITE, 11: PERM.PIN_MESSAGES };
export function memberRank(state: FoldedControl, member: string): { position: number; permissions: bigint; roleIds: string[] } {
  if (member === state.owner) return { position: 0, permissions: (1n << 64n) - 1n, roleIds: [] };
  const grant = state.grants.get(member);
  const roleIds = (grant?.role_ids ?? []).slice(0, MAX_ROLES_PER_MEMBER);
  let position = Number.MAX_SAFE_INTEGER; let permissions = 0n;
  for (const id of roleIds) { const role = state.roles.get(id); if (!role) continue; position = Math.min(position, role.position); try { permissions |= parsePermissions(role.permissions); } catch { /* malformed role ignored */ } }
  return { position, permissions, roleIds };
}
export const hasPerm = (state: FoldedControl, member: string, perm: bigint): boolean =>
  member === state.owner || (memberRank(state, member).permissions & perm) === perm;
export const canPostToChat = (state: FoldedControl, member: string): boolean => !state.bans.includes(member);
/**
 * Fold editions: highest chain-intact version wins, refuse downgrade, tie = authority then lower rumor id.
 * vac is block-until-synced (park) and rank is judged against the CURRENT roster,
 * so a stale citation never restores a demoted actor.
 */
export function foldControlEditions(owner: string, editions: ControlEdition[]): FoldedControl {
  const state: FoldedControl = { owner, roles: new Map(), grants: new Map(), bans: [], channels: new Map(), heads: new Map(), parked: [], rejected: [] };
  const byEntity = new Map<string, ControlEdition[]>();
  for (const e of editions) { const list = byEntity.get(e.eid) ?? []; list.push(e); byEntity.set(e.eid, list); }
  // Deterministic multi-pass: grants/roles may arrive after dependent editions.
  let pending = [...editions];
  for (let pass = 0; pass < 4 && pending.length; pass++) {
    const deferred: ControlEdition[] = [];
    // Order candidates per entity by version desc, then authority, then rumor id.
    const sorted = [...pending].sort((a, b) => (b.ev - a.ev) || (a.rumorId < b.rumorId ? -1 : 1));
    for (const e of sorted) {
      const key = e.eid; const head = state.heads.get(key);
      if (head && e.ev < head.ev) { state.rejected.push({ rumorId: e.rumorId, reason: 'downgrade-refused' }); continue; }
      if (head && e.ev === head.ev) { state.rejected.push({ rumorId: e.rumorId, reason: 'superseded-tie' }); continue; }
      if (e.ev > 1 && e.ep) {
        const prevOk = [...(byEntity.get(key) ?? [])].some((p) => p.ev === e.ev - 1 && editionHash(p.eid, p.ev, p.ep, p.content) === e.ep);
        // Fresh-joiner baseline: highest authority-verified head accepted despite dangling prev (handled by authority check below); tracked gap parks.
        if (!prevOk && head) { state.parked.push({ rumorId: e.rumorId, reason: 'chain-gap' }); continue; }
      }
      if (e.vac) {
        const [gEid, gVer, gHash] = e.vac;
        const held = [...editions].find((g) => g.eid === gEid && g.ev === Number(gVer));
        if (!held || editionHash(held.eid, held.ev, held.ep, held.content) !== gHash) { state.parked.push({ rumorId: e.rumorId, reason: 'vac-unsynced' }); deferred.push(e); continue; }
      }
      if (e.actor !== owner) {
        const req = REQUIRED_PERM[e.vsk];
        const rank = memberRank(state, e.actor);
        // Owner-rooted bootstrap: before any grant exists only the owner can act; others park for later passes.
        if (req === undefined) { state.rejected.push({ rumorId: e.rumorId, reason: 'unknown-vsk' }); continue; }
        if (req !== null && (rank.permissions & req) !== req) {
          if (pass < 3) { deferred.push(e); continue; }
          state.rejected.push({ rumorId: e.rumorId, reason: 'actor-not-authorised' }); continue;
        }
        // Hierarchy: a non-owner acts only on roles and members it strictly outranks (lower position = higher rank).
        if (e.vsk === 1) {
          let role: RoleDef;
          try { role = JSON.parse(e.content) as RoleDef; } catch { role = null as unknown as RoleDef; }
          if (!role || typeof role !== 'object' || typeof role.position !== 'number') { state.rejected.push({ rumorId: e.rumorId, reason: 'bad-role-content' }); continue; }
          if (role.position === 0) { state.rejected.push({ rumorId: e.rumorId, reason: 'position-zero-reserved' }); continue; }
          const existing = state.roles.get(e.eid);
          if (role.position <= rank.position || (existing && existing.position <= rank.position)) { state.rejected.push({ rumorId: e.rumorId, reason: 'role-outranks-actor' }); continue; }
        }
        if (e.vsk === 3) {
          let grant: GrantDef;
          try { grant = JSON.parse(e.content) as GrantDef; } catch { grant = null as unknown as GrantDef; }
          if (!grant || typeof grant !== 'object' || typeof grant.member !== 'string' || !Array.isArray(grant.role_ids)) { state.rejected.push({ rumorId: e.rumorId, reason: 'bad-grant-content' }); continue; }
          const roles = grant.role_ids.map((id) => state.roles.get(id));
          if (roles.some((r) => r === undefined)) {
            if (pass < 3) { deferred.push(e); continue; }
            state.rejected.push({ rumorId: e.rumorId, reason: 'unknown-role' }); continue;
          }
          if (roles.some((r) => r!.position <= rank.position)) { state.rejected.push({ rumorId: e.rumorId, reason: 'grant-outranks-actor' }); continue; }
          if (grant.member !== e.actor && memberRank(state, grant.member).position <= rank.position) { state.rejected.push({ rumorId: e.rumorId, reason: 'target-outranks-actor' }); continue; }
        }
      }
      // Apply
      try {
        if (e.vsk === 1) { const role = JSON.parse(e.content) as RoleDef; assertNameBytes(role.name); if (state.roles.size < MAX_ROLES_PER_COMMUNITY || state.roles.has(role.role_id)) state.roles.set(e.eid, role); }
        else if (e.vsk === 3) { const grant = JSON.parse(e.content) as GrantDef; state.grants.set(grant.member, { ...grant, role_ids: grant.role_ids.slice(0, MAX_ROLES_PER_MEMBER) }); }
        else if (e.vsk === 4) { const list = JSON.parse(e.content) as string[]; state.bans = [...new Set(list)].slice(0, BANLIST_PRACTICAL_CAP); }
        else if (e.vsk === 2) { const meta = JSON.parse(e.content) as ChannelMetadata; const bad = validateChannelMetadata(meta); if (bad) { state.rejected.push({ rumorId: e.rumorId, reason: bad }); continue; } state.channels.set(e.eid, meta); }
        else if (e.vsk === 0) { const meta = JSON.parse(e.content) as Record<string, unknown>; if (typeof meta.name === 'string') assertNameBytes(meta.name); if (typeof meta.description === 'string') assertDescriptionBytes(meta.description); state.metadata = meta; }
      } catch (err) { state.rejected.push({ rumorId: e.rumorId, reason: err instanceof Error ? err.message : 'bad-content' }); continue; }
      state.heads.set(key, { ...e, hash: editionHash(e.eid, e.ev, e.ep, e.content) });
    }
    pending = deferred.filter((e) => !state.heads.has(e.eid) || state.heads.get(e.eid)!.rumorId !== e.rumorId);
    if (!deferred.length) break;
  }
  for (const e of pending) if (!state.rejected.some((r) => r.rumorId === e.rumorId) && !state.parked.some((r) => r.rumorId === e.rumorId)) state.parked.push({ rumorId: e.rumorId, reason: 'unresolved-authority' });
  void byEntity;
  return state;
}
/** Dissolution tombstone: vsk 10, eid MUST equal this community_id (CORD-02 §9). */
export function verifyDissolution(e: ControlEdition, communityIdHex: string, owner: string): boolean {
  return e.vsk === 10 && e.eid === communityIdHex && e.actor === owner;
}

// --- guestbook fold (CORD-02 §5): coalesce, 1h future drop, tie = lower rumor id ---
export type GuestbookEntry =
  | { kind: 3306; actor: string; action: 'join' | 'leave'; rumorId: string; createdAt: number; ms: number }
  | { kind: 3309; actor: string; target: string; vac?: [string, string, string]; rumorId: string; createdAt: number; ms: number }
  | { kind: 3312; actor: string; members: string[]; snapId: string; index: number; total: number; rumorId: string; createdAt: number; ms: number };
export function foldGuestbook(entries: GuestbookEntry[], opts: { nowMs: number; isAuthorizedKick: (e: GuestbookEntry & { kind: 3309 }) => boolean; refounder?: string }): Map<string, 'present' | 'left' | 'kicked'> {
  const state = new Map<string, { status: 'present' | 'left' | 'kicked'; atMs: number; rumorId: string; selfSigned: boolean }>();
  const apply = (member: string, status: 'present' | 'left' | 'kicked', atMs: number, rumorId: string, selfSigned: boolean) => {
    const cur = state.get(member);
    if (!cur || atMs > cur.atMs || (atMs === cur.atMs && rumorId < cur.rumorId)) state.set(member, { status, atMs, rumorId, selfSigned });
    else if (!cur.selfSigned && selfSigned && atMs >= cur.atMs) state.set(member, { status, atMs, rumorId, selfSigned });
  };
  const sorted = [...entries].sort((a, b) => (a.createdAt * 1000 + a.ms) - (b.createdAt * 1000 + b.ms));
  for (const e of sorted) {
    const atMs = e.createdAt * 1000 + e.ms;
    if (e.ms < 0 || e.ms > 999) continue;
    if (atMs > opts.nowMs + 3600_000) continue;
    if (e.kind === 3306) apply(e.actor, e.action === 'join' ? 'present' : 'left', atMs, e.rumorId, true);
    else if (e.kind === 3309) { if (opts.isAuthorizedKick(e)) apply(e.target, 'kicked', atMs, e.rumorId, false); }
    else if (e.kind === 3312) {
      if (opts.refounder && e.actor !== opts.refounder) continue;
      // A snapshot only seeds: never overrides a self-signed entry, and a missing chunk never implies removal.
      for (const m of e.members.slice(0, SNAPSHOT_CHUNK)) if (!state.has(m)) state.set(m, { status: 'present', atMs, rumorId: e.rumorId, selfSigned: false });
    }
  }
  return new Map([...state].map(([k, v]) => [k, v.status]));
}

// --- rekey (CORD-06): missing chunk never implies removal ---
export interface RekeyChunk { index: number; total: number; newEpoch: number; prevEpoch: number; prevCommit: string; blobs: { locator: string; wrapped: string }[] }
export function rekeyLocator(rotatorXonlyHex: string, recipientXonlyHex: string, scopeIdHex: string, epoch: number): string {
  const ikm = concatBytes(hexToBytes(rotatorXonlyHex), hexToBytes(recipientXonlyHex));
  return bytesToHex(hkdfSeed(ikm, 'concord/recipient-pseudonym', hexToBytes(scopeIdHex), epoch));
}
export function parseRekeyBlob(plain: Uint8Array): { scopeId: string; epoch: number; newKey: string; newControlPk?: string; newControlRoot?: string; form: 'channel' | 'base-member' | 'base-staff' | 'base-legacy' } | null {
  if (![72, 104, 136].includes(plain.length)) return null;
  const view = new DataView(plain.buffer, plain.byteOffset, plain.byteLength);
  const epoch = Number(view.getBigUint64(32));
  const scopeId = bytesToHex(plain.slice(0, 32));
  if (plain.length === 72) return { scopeId, epoch, newKey: bytesToHex(plain.slice(40, 72)), form: scopeId === ZERO32_HEX ? 'base-legacy' : 'channel' };
  if (plain.length === 104) return { scopeId, epoch, newKey: bytesToHex(plain.slice(40, 72)), newControlPk: bytesToHex(plain.slice(72, 104)), form: 'base-member' };
  if (plain.length === 136) return { scopeId, epoch, newKey: bytesToHex(plain.slice(40, 72)), newControlPk: bytesToHex(plain.slice(72, 104)), newControlRoot: bytesToHex(plain.slice(104, 136)), form: 'base-staff' };
  return null;
}
export function evaluateRekey(chunks: RekeyChunk[], myLocator: string, current: { epoch: number; keyHex: string }): 'included' | 'removed' | 'incomplete' | 'fork' {
  if (!chunks.length) return 'incomplete';
  const total = chunks[0].total;
  const consistent = chunks.every((c) => c.total === total && c.newEpoch === chunks[0].newEpoch && c.prevCommit === chunks[0].prevCommit);
  if (!consistent) return 'fork';
  if (chunks[0].prevCommit !== epochKeyCommitment(current.epoch, current.keyHex)) return 'fork';
  const seen = new Set(chunks.map((c) => c.index));
  const found = chunks.some((c) => c.blobs.some((b) => b.locator === myLocator));
  if (found) return 'included';
  // Only a complete chunk set (1..n all present) can conclude removal.
  for (let i = 0; i < total; i++) if (!seen.has(i)) return 'incomplete';
  return 'removed';
}
/** Same-epoch race: lexicographically lowest new base key wins. */
export const pickRefoundingWinner = (candidateKeyHexes: string[]): string => [...candidateKeyHexes].sort()[0];

// --- kind 33302 Community List (CORD-02 §8) ---
export const COMMUNITY_LIST_KIND = 33302;
export interface JoinMaterial { owner: string; owner_salt: string; community_root: string; root_epoch: number; control_pk?: string; control_root?: string; channels: { id: string; key?: string; epoch: number; name: string; [u: string]: unknown }[]; relays: string[]; name: string; [unknown: string]: unknown }
export interface ListEntry { community_id: string; seed?: JoinMaterial; current: JoinMaterial; added_at: number; [unknown: string]: unknown }
export interface ListTombstone { community_id: string; removed_at: number; [unknown: string]: unknown }
export interface CommunityListDoc { frags: number; entries: ListEntry[]; tombstones: ListTombstone[]; [unknown: string]: unknown }
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  const rec = v as Record<string, unknown>;
  return `{${Object.keys(rec).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(rec[k])}`).join(',')}}`;
}
/** seed omitted when equal to current; seed cosmetics overwritten from current on serialization. */
export function normalizeEntry(e: ListEntry): ListEntry {
  if (!e.seed) return e;
  const seed: JoinMaterial = { ...e.seed, name: e.current.name, relays: e.current.relays, channels: e.seed.channels.map((c, i) => ({ ...c, name: e.current.channels[i]?.name ?? c.name })) };
  if (canonicalJson(seed) === canonicalJson(e.current)) { const { seed: _drop, ...rest } = e; void _drop; return rest as ListEntry; }
  return { ...e, seed };
}
export function packCommunityListFragment(doc: CommunityListDoc, index: number): { kind: 33302; tags: string[][]; content: string } {
  const normalized: CommunityListDoc = { ...doc, entries: doc.entries.map(normalizeEntry) };
  const content = JSON.stringify(normalized);
  assertNip44Plaintext(content);
  return { kind: COMMUNITY_LIST_KIND, tags: [['d', String(index)]], content };
}
export function unpackCommunityListFragment(event: { kind: number; content: string; tags?: string[][] }): { doc: CommunityListDoc; index: number } {
  if (event.kind !== COMMUNITY_LIST_KIND) throw new Error('concord: not a 33302 fragment');
  const doc = JSON.parse(event.content) as CommunityListDoc;
  if (typeof doc.frags !== 'number' || !Array.isArray(doc.entries) || !Array.isArray(doc.tombstones)) throw new Error('concord: malformed 33302 fragment');
  for (const en of doc.entries) if (!isB64url32(en.community_id)) throw new Error('concord: 33302 community_id must be base64url-43');
  const d = event.tags?.find((t) => t[0] === 'd')?.[1];
  return { doc, index: d !== undefined ? Number(d) : 0 };
}
/**
 * Union-merge fragments. A partial read NEVER erases: entries/tombstones absent
 * from the read set are untouched (merge only over what was read); a stale
 * citation/entry never restores a tombstoned membership (newest timestamp wins);
 * unknown fields ride through verbatim at every level.
 */
export function mergeCommunityLists(docs: CommunityListDoc[]): CommunityListDoc {
  const frags = Math.max(1, ...docs.map((d) => d.frags));
  const tombstones = new Map<string, ListTombstone>();
  for (const d of docs) for (const t of d.tombstones) {
    const cur = tombstones.get(t.community_id);
    if (!cur || t.removed_at > cur.removed_at) tombstones.set(t.community_id, t);
  }
  const entries = new Map<string, ListEntry>();
  for (const d of docs) for (const raw of d.entries) {
    const e = normalizeEntry(raw); const cur = entries.get(e.community_id);
    if (!cur) { entries.set(e.community_id, e); continue; }
    const seedCur = cur.seed ?? cur.current; const seedNew = e.seed ?? e.current;
    const seed = seedNew.root_epoch < seedCur.root_epoch ? seedNew : seedCur.root_epoch < seedNew.root_epoch ? seedCur : (canonicalJson(seedNew) < canonicalJson(seedCur) ? seedNew : seedCur);
    const current = e.current.root_epoch > cur.current.root_epoch ? e.current : cur.current.root_epoch > e.current.root_epoch ? cur.current : (canonicalJson(e.current) < canonicalJson(cur.current) ? e.current : cur.current);
    entries.set(e.community_id, normalizeEntry({ ...cur, ...e, seed, current, added_at: Math.max(cur.added_at, e.added_at) }));
  }
  const live = [...entries.values()].filter((e) => {
    const t = tombstones.get(e.community_id);
    return !t || e.added_at > t.removed_at;
  });
  // Fragment-level unknowns belong to the List: union, lowest doc index wins (docs passed in index order).
  const fragUnknown: Record<string, unknown> = {};
  for (const d of docs) for (const [k, v] of Object.entries(d)) if (!['frags', 'entries', 'tombstones'].includes(k) && !(k in fragUnknown)) fragUnknown[k] = v;
  return { ...fragUnknown, frags, entries: live, tombstones: [...tombstones.values()] };
}
/** Repack (changing frags) requires the complete list; scoped single-membership writes do not. */
export const canRepack = (heldIndexes: number[], frags: number): boolean =>
  Array.from({ length: frags }, (_, i) => i).every((i) => heldIndexes.includes(i));

// --- invites (CORD-05) ---
export interface CommunityInvite {
  community_id: string; owner: string; owner_salt: string; community_root: string; root_epoch: number;
  control_pk?: string; channels: { id: string; key?: string; epoch: number; name: string }[];
  relays: string[]; name: string; icon?: unknown; expires_at?: number; creator_npub?: string; label?: string;
  [unknown: string]: unknown;
}
export function validateInviteBundle(b: CommunityInvite, _nowMs = Date.now()): string | null {
  void _nowMs;
  if (!b.community_id || !verifyCommunityId(b.community_id, b.owner, b.owner_salt)) return 'owner-proof-failed';
  if (!Array.isArray(b.channels) || b.channels.length > INVITE_MAX_CHANNELS) return 'too-many-channels';
  if (byteLen(b.name ?? '') > NAME_MAX_BYTES) return 'name-too-long';
  return null;
}
export const inviteJoinable = (b: CommunityInvite, nowMs = Date.now()): boolean =>
  validateInviteBundle(b, nowMs) === null && !(b.expires_at !== undefined && b.expires_at <= nowMs);
export const RELAY_DICTIONARY: Record<number, string> = { 1: 'wss://jskitty.com/nostr', 2: 'wss://asia.vectorapp.io/nostr', 3: 'wss://relay.ditto.pub', 4: 'wss://relay.dreamith.to' };
export function bundleKeyFromToken(tokenHex: string): string {
  return bytesToHex(hkdfSeed(hexToBytes(tokenHex), 'concord/invite-key', new Uint8Array(32)));
}
/** Fragment = [ver=4][flags][relays?][token16] base64url-nopad; token never leaves the client. */
export function encodeInviteFragment(tokenHex: string, relays?: string[]): string {
  const token = hexToBytes(tokenHex); if (token.length !== 16) throw new Error('concord: invite token must be 16 bytes');
  const useStock = !relays || relays.length === 0;
  const bytes: number[] = [4, useStock ? 1 : 0];
  if (!useStock) {
    if (relays!.length > 3) throw new Error('concord: at most 3 bootstrap relays in fragment');
    bytes.push(relays!.length);
    for (const r of relays!) {
      const dictId = Object.entries(RELAY_DICTIONARY).find(([, u]) => u === r)?.[0];
      if (dictId) bytes.push(Number(dictId));
      else if (r.startsWith('wss://')) { const host = utf8(r.slice(6)); bytes.push(0, host.length, ...host); }
      else { const full = utf8(r); bytes.push(255, full.length, ...full); }
    }
  }
  return bytesToB64url(new Uint8Array([...bytes, ...token]));
}
export function decodeInviteFragment(fragment: string): { tokenHex: string; relays: string[] } {
  const bytes = b64urlToBytes(fragment.replace(/^#/, ''));
  if (bytes[0] !== 4) throw new Error('concord: unsupported invite fragment version');
  let i = 2; let relays: string[] = [];
  if (bytes[1] & 1) relays = Object.values(RELAY_DICTIONARY);
  else {
    const count = bytes[i++]; 
    for (let n = 0; n < count; n++) {
      const lead = bytes[i++];
      if (lead >= 1 && lead <= 254) relays.push(RELAY_DICTIONARY[lead] ?? '');
      else { const len = bytes[i++]; const raw = new TextDecoder().decode(bytes.slice(i, i + len)); i += len; relays.push(lead === 0 ? `wss://${raw}` : raw); }
    }
  }
  const token = bytes.slice(i, i + 16);
  if (token.length !== 16) throw new Error('concord: invite fragment token truncated');
  return { tokenHex: bytesToHex(token), relays };
}
export interface InviteListDoc { entries: ({ token: string; signer_sk: string; community_id: string; url: string; label?: string; created_at: number; expires_at?: number } & Record<string, unknown>)[]; tombstones: { token: string; community_id: string }[]; [unknown: string]: unknown }
/** Invite List merge: token is merge key, entry immutable, tombstone always beats entry. */
export function mergeInviteLists(a: InviteListDoc, b: InviteListDoc): InviteListDoc {
  const tomb = new Map([...a.tombstones, ...b.tombstones].map((t) => [t.token, t]));
  const entries = new Map<string, InviteListDoc['entries'][number]>();
  for (const e of [...a.entries, ...b.entries]) if (!entries.has(e.token) && !tomb.has(e.token)) entries.set(e.token, e);
  return { ...a, ...b, entries: [...entries.values()], tombstones: [...tomb.values()] };
}
export const inviteEventShape = (live: boolean): { kind: 33301; tags: string[][] } =>
  ({ kind: 33301, tags: [['d', ''], ['vsk', live ? '6' : '9']] });

// --- sealed envelope plane: wrap 1059 (stream key) / seal 20013|20014 (author) / rumor ---
export type SealSigner = (t: { kind: number; content: string; tags: string[][]; created_at: number }) => Promise<NostrEvent>;
/** Seal a rumor with the author's real identity (20013 encrypts under the stream conversation key). */
export async function sealRumor(rumor: Rumor, sealKind: 20013 | 20014, stream: GroupKey, signer: SealSigner): Promise<NostrEvent> {
  assertNip44Plaintext(JSON.stringify(rumor));
  const content = sealKind === 20013 ? nip44.encrypt(JSON.stringify(rumor), stream.conversationKey) : JSON.stringify(rumor);
  return signer({ kind: sealKind, content, tags: [], created_at: rumor.created_at });
}
/** Wrap a signed seal under the stream key (kind 1059, random ephemeral p tag). */
export function wrapSeal(seal: NostrEvent, stream: GroupKey, opts?: { expiration?: number }): NostrEvent {
  const tags: string[][] = [['p', getPublicKey(generateSecretKey())]];
  if (opts?.expiration !== undefined) tags.push(['expiration', String(Math.floor(opts.expiration))]);
  return finalizeEvent({ kind: 1059, content: nip44.encrypt(JSON.stringify(seal), stream.conversationKey), tags, created_at: Math.floor(Date.now() / 1000) }, stream.secretKey);
}
export interface OpenedStreamEvent { rumorId: string; author: string; kind: number; content: string; tags: string[][]; createdAt: number; sealKind: number; rumor: Rumor }
/** Open + fully verify a wrap: stream author, seal signature, rumor author == seal signer, rumor id == NIP-01 hash. */
export function openWrap(wrap: NostrEvent, stream: GroupKey): OpenedStreamEvent {
  if (wrap.kind !== 1059) throw new Error('concord: bad-wrap-kind');
  if (wrap.pubkey !== stream.pubkey) throw new Error('concord: wrap author is not this stream address');
  const seal = JSON.parse(nip44.decrypt(wrap.content, stream.conversationKey)) as NostrEvent;
  if (seal.kind !== 20013 && seal.kind !== 20014) throw new Error('concord: bad-seal-kind');
  if (!verifyEvent(seal)) throw new Error('concord: bad-seal-signature');
  const rumor = JSON.parse(seal.kind === 20013 ? nip44.decrypt(seal.content, stream.conversationKey) : seal.content) as Rumor;
  if (rumor.pubkey !== seal.pubkey) throw new Error('concord: rumor author does not match seal signer');
  if (rumor.id !== computeEventId(rumor)) throw new Error('concord: bad-rumor-id');
  return { rumorId: rumor.id, author: seal.pubkey, kind: rumor.kind, content: rumor.content, tags: rumor.tags, createdAt: rumor.created_at, sealKind: seal.kind, rumor };
}

// --- signer capability probe (reuses DivineJWTSigner / any NostrSigner; adds no signer) ---
export interface SignerLike { getPublicKey(): Promise<string>; signEvent(e: never): Promise<unknown>; nip44?: Nip44Cipher }
export interface SignerCapabilities { signEvent: boolean; nip44: boolean; gap: string | null }
export function probeSignerCapabilities(signer: SignerLike | undefined): SignerCapabilities {
  if (!signer) return { signEvent: false, nip44: false, gap: 'no signer (logged out)' };
  const nip44ok = typeof signer.nip44?.encrypt === 'function' && typeof signer.nip44?.decrypt === 'function';
  return { signEvent: typeof signer.signEvent === 'function', nip44: nip44ok, gap: nip44ok ? null : 'signer lacks nip44 (e.g. some external NIP-07 signers); stream envelopes unavailable, control/message signing still works' };
}



