/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// ABOUTME: Pure TypeScript Concord POC protocol — no React, no IO, no new signer.
// ABOUTME: Wire format is a clean-room POC pending final spec; see test-fixtures/concord/v1.

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

/** Standard SHA-256 (FIPS 180-4) of a UTF-8 string, hex-encoded. */
export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const padded = new Uint8Array((((bytes.length + 9 + 63) >> 6) << 6));
  padded.set(bytes);
  padded[bytes.length] = 0x80;
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
  return h.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

export const deriveId = (namespace: string, ...parts: string[]): string =>
  sha256Hex(['concord:v1', namespace, ...parts].join(':'));
export const deriveCommunityId = (ownerPubkey: string, slug: string) => deriveId('community', ownerPubkey, slug);
export const deriveChannelId = (communityId: string, slug: string) => deriveId('channel', communityId, slug);
export const deriveStreamId = (communityId: string, channelId: string) => deriveId('stream', communityId, channelId);
export const deriveThreadId = (channelId: string, rootMessageId: string) => deriveId('thread', channelId, rootMessageId);

// --- Expiry ---
export interface Expiring { exp: number }
export const stampExpiry = <T extends object>(payload: T, ttlSeconds: number, nowSeconds = Math.floor(Date.now()/1000)): T & Expiring =>
  ({ ...payload, exp: nowSeconds + ttlSeconds });
export const isExpired = (p: Expiring, nowSeconds = Math.floor(Date.now()/1000)) => p.exp <= nowSeconds;
export function assertNotExpired(p: Expiring, nowSeconds?: number): void {
  if (isExpired(p, nowSeconds)) throw new Error('concord: expired payload');
}

// --- Payloads ---
export type ChatPayload =
  | { type: 'message'; id: string; channelId: string; body: string; replyTo?: string }
  | { type: 'thread'; id: string; channelId: string; rootMessageId: string; body: string }
  | { type: 'reaction'; id: string; targetId: string; emoji: string; remove?: boolean }
  | { type: 'edit'; id: string; targetId: string; body: string }
  | { type: 'delete'; id: string; targetId: string; reason?: string };
export const messagePayload = (channelId: string, body: string, seed: string, replyTo?: string): ChatPayload =>
  ({ type: 'message', id: deriveId('msg', channelId, seed, body), channelId, body, ...(replyTo ? { replyTo } : {}) });
export const threadPayload = (channelId: string, rootMessageId: string, body: string, seed: string): ChatPayload =>
  ({ type: 'thread', id: deriveId('msg', channelId, seed, body), channelId, rootMessageId, body });
export const reactionPayload = (targetId: string, emoji: string, seed: string, remove = false): ChatPayload =>
  ({ type: 'reaction', id: deriveId('reaction', targetId, seed, emoji), targetId, emoji, ...(remove ? { remove } : {}) });
export const editPayload = (targetId: string, body: string, seed: string): ChatPayload =>
  ({ type: 'edit', id: deriveId('edit', targetId, seed, body), targetId, body });
export const deletePayload = (targetId: string, seed: string, reason?: string): ChatPayload =>
  ({ type: 'delete', id: deriveId('delete', targetId, seed), targetId, ...(reason ? { reason } : {}) });

// --- Control folding (roles/grants/bans) with authority citations ---
export type ControlAction =
  | { kind: 'role.assign'; pubkey: string; role: string }
  | { kind: 'role.revoke'; pubkey: string; role: string }
  | { kind: 'grant'; pubkey: string; permission: string }
  | { kind: 'grant.revoke'; pubkey: string; permission: string }
  | { kind: 'ban'; pubkey: string }
  | { kind: 'unban'; pubkey: string };
export interface ControlEvent { seq: number; actor: string; authorityEventId: string; action: ControlAction }
export interface ControlState { owner: string; roles: Record<string, string[]>; grants: Record<string, string[]>; bans: string[]; applied: string[]; rejected: { seq: number; reason: string }[] }
const add = (m: Record<string,string[]>, k: string, v: string) => { m[k] = [...new Set([...(m[k] ?? []), v])]; };
const del = (m: Record<string,string[]>, k: string, v: string) => { m[k] = (m[k] ?? []).filter((x) => x !== v); };
/** Fold an ordered control log. Only owner or role=admin actors apply; every event must cite an authority event id. */
export function foldControlLog(owner: string, events: ControlEvent[]): ControlState {
  const state: ControlState = { owner, roles: { [owner]: ['owner'] }, grants: {}, bans: [], applied: [], rejected: [] };
  for (const ev of [...events].sort((a,b) => a.seq - b.seq)) {
    if (!ev.authorityEventId) { state.rejected.push({ seq: ev.seq, reason: 'missing-authority-citation' }); continue; }
    const isAuthority = ev.actor === owner || (state.roles[ev.actor] ?? []).includes('admin');
    if (!isAuthority) { state.rejected.push({ seq: ev.seq, reason: 'actor-not-authorised' }); continue; }
    const a = ev.action;
    if (a.kind === 'role.assign') add(state.roles, a.pubkey, a.role);
    else if (a.kind === 'role.revoke') del(state.roles, a.pubkey, a.role);
    else if (a.kind === 'grant') add(state.grants, a.pubkey, a.permission);
    else if (a.kind === 'grant.revoke') del(state.grants, a.pubkey, a.permission);
    else if (a.kind === 'ban') state.bans = [...new Set([...state.bans, a.pubkey])];
    else state.bans = state.bans.filter((x) => x !== a.pubkey);
    state.applied.push(ev.authorityEventId);
  }
  return state;
}
export const canPost = (s: ControlState, pubkey: string) => !s.bans.includes(pubkey);

// --- Stream envelope: distinct from NIP-59 (no kind 13 seal / 1059 gift-wrap) ---
export interface Nip44Cipher { encrypt(pubkey: string, plaintext: string): Promise<string>; decrypt(pubkey: string, ciphertext: string): Promise<string> }
export interface StreamEnvelope extends Expiring { v: 1; alg: 'concord-stream-nip44-v1'; kindHint: 33303; streamId: string; seq: number; ciphertext: string }
export async function sealStreamEnvelope(cipher: Nip44Cipher, peerPubkey: string, streamId: string, seq: number, payload: ChatPayload, ttlSeconds = 300, nowSeconds?: number): Promise<StreamEnvelope> {
  const stamped = stampExpiry({ payload }, ttlSeconds, nowSeconds);
  return { v: 1, alg: 'concord-stream-nip44-v1', kindHint: 33303, streamId, seq, exp: stamped.exp, ciphertext: await cipher.encrypt(peerPubkey, JSON.stringify(stamped)) };
}
export async function openStreamEnvelope(cipher: Nip44Cipher, peerPubkey: string, env: StreamEnvelope, nowSeconds?: number): Promise<ChatPayload> {
  if (env.v !== 1 || env.alg !== 'concord-stream-nip44-v1') throw new Error('concord: unsupported stream envelope');
  assertNotExpired(env, nowSeconds);
  const plain = JSON.parse(await cipher.decrypt(peerPubkey, env.ciphertext)) as { payload: ChatPayload } & Expiring;
  assertNotExpired(plain, nowSeconds);
  return plain.payload;
}

// --- Kind 33302 Community List fragment pack/unpack, preserving unknown fields ---
export const COMMUNITY_LIST_KIND = 33302;
export interface CommunityListFragment { communityId: string; channelIds: string[]; [unknown: string]: unknown }
export function packCommunityListFragment(f: CommunityListFragment): { kind: 33302; content: string; tags: string[][] } {
  return { kind: COMMUNITY_LIST_KIND, tags: [['d', f.communityId], ...f.channelIds.map((c) => ['channel', c])], content: JSON.stringify(f) };
}
export function unpackCommunityListFragment(event: { kind: number; content: string }): CommunityListFragment {
  if (event.kind !== COMMUNITY_LIST_KIND) throw new Error('concord: not a 33302 fragment');
  const parsed = JSON.parse(event.content) as CommunityListFragment;
  if (!parsed.communityId || !Array.isArray(parsed.channelIds)) throw new Error('concord: malformed 33302 fragment');
  return parsed; // unknown fields ride through untouched in the parsed object
}

// --- Signer capability probe (reuses DivineJWTSigner / any NostrSigner; records gaps, adds no signer) ---
export interface SignerLike { getPublicKey(): Promise<string>; signEvent(e: never): Promise<unknown>; nip44?: Nip44Cipher }
export interface SignerCapabilities { signEvent: boolean; nip44: boolean; gap: string | null }
export function probeSignerCapabilities(signer: SignerLike | undefined): SignerCapabilities {
  if (!signer) return { signEvent: false, nip44: false, gap: 'no signer (logged out)' };
  const nip44 = typeof signer.nip44?.encrypt === 'function' && typeof signer.nip44?.decrypt === 'function';
  return { signEvent: typeof signer.signEvent === 'function', nip44, gap: nip44 ? null : 'signer lacks nip44 (e.g. some external NIP-07 signers); stream envelopes unavailable, control/message signing still works' };
}
