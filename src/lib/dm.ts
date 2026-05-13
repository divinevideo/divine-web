import { NPool, NRelay1, type NostrEvent, type NostrFilter, type NostrSigner } from '@nostrify/nostrify';
import { bytesToHex } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { finalizeEvent, generateSecretKey, nip44, verifyEvent } from 'nostr-tools';

import { PRESET_RELAYS, PROFILE_RELAYS, getRelayUrls } from '@/config/relays';
import { getVideoShareUrl } from '@/lib/shareUtils';
import { getApexShareUrl } from '@/lib/subdomainLinks';
import type { ParsedVideoData } from '@/types/video';
import { SHORT_VIDEO_KIND } from '@/types/video';

export const DM_GIFT_WRAP_KIND = 1059;
export const DM_SEAL_KIND = 13;
export const DM_RUMOR_KIND = 14;
export const DM_RELAY_LIST_KIND = 10050;

export const DIVINE_SUPPORT_PUBKEY = '78a5c21b5166dc1474b64ddf7454bf79e6b5d6b4a77148593bf1e866b73c2738';

const TWO_DAYS_IN_SECONDS = 2 * 24 * 60 * 60;
const PUBKEY_PATTERN = /^[a-f0-9]{64}$/;

export interface DmSharePayload {
  url: string;
  title?: string;
  videoId?: string;
  videoPubkey?: string;
  vineId?: string;
}

export type DmDeliveryState = 'sending' | 'failed' | 'sent';

export interface DmMessage {
  conversationId: string;
  wrapId: string;
  rumorId: string;
  senderPubkey: string;
  participantPubkeys: string[];
  peerPubkeys: string[];
  content: string;
  createdAt: number;
  isOutgoing: boolean;
  share?: DmSharePayload;
  subject?: string;
  clientId?: string;
  deliveryState?: DmDeliveryState;
  errorMessage?: string;
  isOptimistic?: boolean;
}

export interface DmConversation {
  id: string;
  participantPubkeys: string[];
  lastMessage: DmMessage;
  unreadCount: number;
}

interface DmRumorEvent {
  id: string;
  pubkey: string;
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
}

export interface CreateDmGiftWrapsInput {
  signer: NostrSigner;
  senderPubkey: string;
  recipientPubkeys: string[];
  content: string;
  additionalTags?: string[][];
}

export interface FetchDmMessagesInput {
  signer: NostrSigner;
  currentUserPubkey: string;
  relayUrls: string[];
  signal?: AbortSignal;
  limit?: number;
}

/**
 * Outcome of unwrapping a single NIP-17 gift wrap.
 *
 * - `ok: true` — fully unwrapped to a valid kind-14 rumor.
 * - `decrypt-failed` — the signer's `nip44.decrypt` RPC threw. This is
 *   distinct from "malformed" because it usually points at infrastructure
 *   (bunker rejected, RPC timeout, missing permission grant) rather than a
 *   bad payload, and lets callers surface "inbox unavailable" instead of
 *   silently rendering an empty state.
 * - `malformed` — decrypt succeeded but the recovered content failed
 *   validation (not JSON, wrong kind, sig invalid, hash mismatch). Drop
 *   quietly; the wrap was either authored incorrectly or wasn't ours.
 */
export type DmUnwrapResult =
  | { ok: true; rumor: DmRumorEvent }
  | { ok: false; reason: 'decrypt-failed'; cause: unknown }
  | { ok: false; reason: 'malformed' };

/**
 * Result of `fetchDmMessages`. `messages` are the successfully unwrapped
 * messages. The counts let the UI distinguish "inbox is genuinely empty"
 * from "every wrap we got back failed to decrypt" (the latter usually
 * means the bunker can't decrypt — see `DmUnwrapResult.decrypt-failed`).
 */
export interface FetchDmMessagesResult {
  messages: DmMessage[];
  fetchedCount: number;
  decryptFailures: number;
  malformedCount: number;
}

export interface ResolveDmRelaysInput {
  appRelayUrls: string[];
  signer?: NostrSigner;
  currentUserPubkey?: string;
  recipientPubkeys?: string[];
  signal?: AbortSignal;
}

function now(): number {
  return Math.round(Date.now() / 1000);
}

function randomNow(): number {
  return Math.round(now() - Math.random() * TWO_DAYS_IN_SECONDS);
}

function normalizeRelayUrls(relayUrls: string[]): string[] {
  return [...new Set(
    relayUrls
      .map((relayUrl) => relayUrl.trim())
      .filter(Boolean)
      .filter((relayUrl) => relayUrl.startsWith('ws://') || relayUrl.startsWith('wss://')),
  )];
}

function isPubkey(value: string): boolean {
  return PUBKEY_PATTERN.test(value);
}

function getBase64Encoder() {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return {
      encode: (value: string) => window.btoa(value),
      decode: (value: string) => window.atob(value),
    };
  }

  if (typeof globalThis.btoa === 'function' && typeof globalThis.atob === 'function') {
    return {
      encode: (value: string) => globalThis.btoa(value),
      decode: (value: string) => globalThis.atob(value),
    };
  }

  throw new Error('Base64 encoding is not available in this environment');
}

function encodeBase64Url(value: string): string {
  const encoded = getBase64Encoder().encode(value);
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return getBase64Encoder().decode(padded);
}

function getDirectMessageRelayUrls(): string[] {
  return normalizeRelayUrls([
    ...getRelayUrls(PROFILE_RELAYS),
    ...PRESET_RELAYS.map((relay) => relay.url),
  ]);
}

function createRelayPool(relayUrls: string[]): NPool<NRelay1> {
  return new NPool({
    open: (url) => new NRelay1(url, { idleTimeout: false }),
    reqRouter: (filters) => new Map(relayUrls.map((url) => [url, filters])),
    eventRouter: () => relayUrls,
  });
}

function isRumorEvent(value: unknown): value is DmRumorEvent {
  if (!value || typeof value !== 'object') return false;

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

function getConversationPubkeys(rumor: DmRumorEvent, currentUserPubkey: string): string[] {
  const taggedPubkeys = rumor.tags
    .filter((tag) => tag[0] === 'p' && typeof tag[1] === 'string' && isPubkey(tag[1]))
    .map((tag) => tag[1]);

  const participants = [...new Set([rumor.pubkey, ...taggedPubkeys].filter(isPubkey))];
  const peers = participants.filter((pubkey) => pubkey !== currentUserPubkey);

  if (peers.length > 0) {
    return peers.sort();
  }

  if (rumor.pubkey !== currentUserPubkey) {
    return [rumor.pubkey];
  }

  return [];
}

function getRumorSubject(rumor: DmRumorEvent): string | undefined {
  return rumor.tags.find((tag) => tag[0] === 'subject' && tag[1])?.[1];
}

function getRumorShare(rumor: DmRumorEvent): DmSharePayload | undefined {
  const coordinate = rumor.tags.find((tag) => tag[0] === 'a' && tag[1]?.startsWith(`${SHORT_VIDEO_KIND}:`))?.[1];
  const eventId = rumor.tags.find((tag) => tag[0] === 'e' && tag[1])?.[1];
  const title = rumor.tags.find((tag) => tag[0] === 'title' && tag[1])?.[1];
  const taggedUrl = rumor.tags.find((tag) => tag[0] === 'r' && tag[1]?.startsWith('http'))?.[1];

  if (!coordinate && !eventId && !taggedUrl) {
    return undefined;
  }

  if (coordinate) {
    const [, videoPubkey, vineId] = coordinate.split(':');
    return {
      url: taggedUrl || getApexShareUrl(`/video/${vineId}`),
      title,
      videoId: vineId,
      videoPubkey,
      vineId,
    };
  }

  return {
    url: taggedUrl || getApexShareUrl(`/video/${eventId}`),
    title,
    videoId: eventId,
  };
}

async function publishEventToAllRelays(
  pool: NPool<NRelay1>,
  relayUrls: string[],
  event: NostrEvent,
  signal?: AbortSignal,
): Promise<void> {
  const results = await Promise.allSettled(
    relayUrls.map((relayUrl) => pool.relay(relayUrl).event(event, { signal })),
  );

  if (results.every((result) => result.status === 'rejected')) {
    const firstFailure = results.find((result) => result.status === 'rejected');
    throw firstFailure?.status === 'rejected'
      ? firstFailure.reason
      : new Error('Failed to publish direct message');
  }
}

async function queryPreferredRelayMap(
  relayUrls: string[],
  authors: string[],
  signal?: AbortSignal,
): Promise<Record<string, string[]>> {
  if (!authors.length || !relayUrls.length) {
    return {};
  }

  const pool = createRelayPool(relayUrls);

  try {
    const events = await pool.query(
      [{
        kinds: [DM_RELAY_LIST_KIND],
        authors,
        limit: Math.max(authors.length * 2, 10),
      }],
      { signal, relays: relayUrls },
    );

    const newestEvents = new Map<string, NostrEvent>();
    for (const event of events) {
      const existing = newestEvents.get(event.pubkey);
      if (!existing || event.created_at > existing.created_at) {
        newestEvents.set(event.pubkey, event);
      }
    }

    return Object.fromEntries(
      [...newestEvents.entries()].map(([pubkey, event]) => {
        const urls = normalizeRelayUrls(
          event.tags
            .filter((tag) => (tag[0] === 'r' || tag[0] === 'relay') && typeof tag[1] === 'string')
            .map((tag) => tag[1]),
        );
        return [pubkey, urls];
      }),
    );
  } finally {
    await pool.close();
  }
}

function createRumorEvent(
  senderPubkey: string,
  participantPubkeys: string[],
  content: string,
  additionalTags: string[][] = [],
): DmRumorEvent {
  const tags = [
    ...participantPubkeys.map((pubkey) => ['p', pubkey]),
    ...additionalTags,
  ];

  const rumor: DmRumorEvent = {
    pubkey: senderPubkey,
    kind: DM_RUMOR_KIND,
    created_at: now(),
    tags,
    content,
    id: '',
  };

  rumor.id = calculateUnsignedEventHash(rumor);
  return rumor;
}

async function createSealEvent(
  signer: NostrSigner,
  targetPubkey: string,
  rumor: DmRumorEvent,
): Promise<NostrEvent> {
  if (!signer.nip44) {
    throw new Error('Current signer does not support NIP-44 encryption');
  }

  const encryptedRumor = await signer.nip44.encrypt(targetPubkey, JSON.stringify(rumor));
  return signer.signEvent({
    kind: DM_SEAL_KIND,
    content: encryptedRumor,
    created_at: randomNow(),
    tags: [],
  });
}

function createWrapEvent(seal: NostrEvent, targetPubkey: string): NostrEvent {
  const ephemeralSecretKey = generateSecretKey();
  const conversationKey = nip44.v2.utils.getConversationKey(ephemeralSecretKey, targetPubkey);
  const encryptedSeal = nip44.v2.encrypt(JSON.stringify(seal), conversationKey);

  return finalizeEvent(
    {
      kind: DM_GIFT_WRAP_KIND,
      content: encryptedSeal,
      created_at: randomNow(),
      tags: [['p', targetPubkey]],
    },
    ephemeralSecretKey,
  );
}

export async function createDmGiftWraps(input: CreateDmGiftWrapsInput): Promise<NostrEvent[]> {
  const { signer, senderPubkey, recipientPubkeys, content, additionalTags = [] } = input;
  const participants = [...new Set([senderPubkey, ...recipientPubkeys.filter(isPubkey)])];

  if (participants.length < 2) {
    throw new Error('Direct messages require at least one recipient');
  }

  const rumor = createRumorEvent(senderPubkey, participants, content, additionalTags);
  const wraps: NostrEvent[] = [];

  for (const participant of participants) {
    const seal = await createSealEvent(signer, participant, rumor);
    wraps.push(createWrapEvent(seal, participant));
  }

  return wraps;
}

const HEALTHCHECK_PROBE_PAYLOAD = '__divine_dm_probe__';

/**
 * Verify the signer's nip44 RPC actually works by encrypting a small
 * payload to self and decrypting it back. Returns true iff the round-trip
 * succeeds AND the recovered plaintext matches the input.
 *
 * Used at session attach time to avoid promising DM capability that the
 * remote bunker will later silently reject. Without this, a NIP-46 bunker
 * that exposes the `nip44` API surface but rejects the underlying RPC
 * looks "DM-capable" to feature detection while the entire inbox renders
 * empty (see issue #307).
 */
export async function probeBunkerNip44(signer: NostrSigner, pubkey: string): Promise<boolean> {
  if (!signer.nip44) return false;
  try {
    const ciphertext = await signer.nip44.encrypt(pubkey, HEALTHCHECK_PROBE_PAYLOAD);
    if (typeof ciphertext !== 'string' || !ciphertext) return false;
    const plaintext = await signer.nip44.decrypt(pubkey, ciphertext);
    return plaintext === HEALTHCHECK_PROBE_PAYLOAD;
  } catch {
    return false;
  }
}

export async function unwrapDmGiftWrap(
  wrap: NostrEvent,
  signer: NostrSigner,
): Promise<DmUnwrapResult> {
  if (!signer.nip44) {
    return {
      ok: false,
      reason: 'decrypt-failed',
      cause: new Error('Current signer does not support NIP-44 encryption'),
    };
  }

  let decryptedSeal: string;
  try {
    decryptedSeal = await signer.nip44.decrypt(wrap.pubkey, wrap.content);
  } catch (cause) {
    return { ok: false, reason: 'decrypt-failed', cause };
  }

  let seal: NostrEvent;
  try {
    seal = JSON.parse(decryptedSeal) as NostrEvent;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (seal.kind !== DM_SEAL_KIND || !verifyEvent(seal)) {
    return { ok: false, reason: 'malformed' };
  }

  let decryptedRumor: string;
  try {
    decryptedRumor = await signer.nip44.decrypt(seal.pubkey, seal.content);
  } catch (cause) {
    return { ok: false, reason: 'decrypt-failed', cause };
  }

  let rumor: DmRumorEvent;
  try {
    rumor = JSON.parse(decryptedRumor) as DmRumorEvent;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!isRumorEvent(rumor) || rumor.kind !== DM_RUMOR_KIND) {
    return { ok: false, reason: 'malformed' };
  }
  // TODO(#321): split attestation/hash mismatch into its own
  // `DmUnwrapResult.code` discriminator (mirroring `InviteApiError.code`
  // in `src/lib/inviteApi.ts:21-31`). Forgery-adjacent signals deserve to
  // be distinguishable from bare decode failures for telemetry.
  if (seal.pubkey !== rumor.pubkey) {
    return { ok: false, reason: 'malformed' };
  }
  if (calculateUnsignedEventHash(rumor) !== rumor.id) {
    return { ok: false, reason: 'malformed' };
  }

  return { ok: true, rumor };
}

function buildMessageFromRumor(
  wrap: NostrEvent,
  rumor: DmRumorEvent,
  currentUserPubkey: string,
): DmMessage | null {
  const peerPubkeys = getConversationPubkeys(rumor, currentUserPubkey);
  if (!peerPubkeys.length) return null;

  const participantPubkeys = [...new Set([currentUserPubkey, ...peerPubkeys])].sort();

  return {
    conversationId: encodeConversationId(peerPubkeys),
    wrapId: wrap.id,
    rumorId: rumor.id,
    senderPubkey: rumor.pubkey,
    participantPubkeys,
    peerPubkeys,
    content: rumor.content,
    createdAt: rumor.created_at,
    isOutgoing: rumor.pubkey === currentUserPubkey,
    share: getRumorShare(rumor),
    subject: getRumorSubject(rumor),
  } satisfies DmMessage;
}

export async function fetchDmMessages(input: FetchDmMessagesInput): Promise<FetchDmMessagesResult> {
  const { signer, currentUserPubkey, relayUrls, signal, limit = 200 } = input;
  const normalizedRelays = normalizeRelayUrls(relayUrls);

  if (!normalizedRelays.length) {
    return { messages: [], fetchedCount: 0, decryptFailures: 0, malformedCount: 0 };
  }

  const pool = createRelayPool(normalizedRelays);

  try {
    const events = await pool.query(
      [{
        kinds: [DM_GIFT_WRAP_KIND],
        '#p': [currentUserPubkey],
        limit,
      } as NostrFilter],
      {
        signal,
        relays: normalizedRelays,
      },
    );

    const outcomes = await Promise.all(
      events.map((wrap) => unwrapDmGiftWrap(wrap, signer)),
    );

    const messages: DmMessage[] = [];
    let decryptFailures = 0;
    let malformedCount = 0;

    for (let i = 0; i < outcomes.length; i++) {
      const outcome = outcomes[i];
      if (outcome.ok) {
        const built = buildMessageFromRumor(events[i], outcome.rumor, currentUserPubkey);
        if (built) messages.push(built);
        else malformedCount++;
      } else if (outcome.reason === 'decrypt-failed') {
        decryptFailures++;
      } else {
        malformedCount++;
      }
    }
    messages.sort((a, b) => a.createdAt - b.createdAt);

    return {
      messages,
      fetchedCount: events.length,
      decryptFailures,
      malformedCount,
    };
  } finally {
    await pool.close();
  }
}

export async function publishDmMessages(
  relayUrls: string[],
  events: NostrEvent[],
  signal?: AbortSignal,
): Promise<void> {
  const normalizedRelays = normalizeRelayUrls(relayUrls);

  if (!events.length || !normalizedRelays.length) {
    throw new Error('No relay routes available for direct messages');
  }

  const pool = createRelayPool(normalizedRelays);

  try {
    for (const event of events) {
      await publishEventToAllRelays(pool, normalizedRelays, event, signal);
    }
  } finally {
    await pool.close();
  }
}

export async function resolveDmReadRelays(input: ResolveDmRelaysInput): Promise<string[]> {
  const { appRelayUrls, signer, currentUserPubkey, signal } = input;
  const fallbackRelays = normalizeRelayUrls([
    ...appRelayUrls,
    ...getDirectMessageRelayUrls(),
  ]);

  const signerRelays = signer?.getRelays
    ? normalizeRelayUrls(
        Object.entries(await signer.getRelays().catch(() => ({})))
          .filter(([, policy]) => policy.read)
          .map(([relayUrl]) => relayUrl),
      )
    : [];

  const preferredRelayMap = currentUserPubkey
    ? await queryPreferredRelayMap(fallbackRelays, [currentUserPubkey], signal).catch(() => ({}))
    : {};

  return normalizeRelayUrls([
    ...fallbackRelays,
    ...signerRelays,
    ...(currentUserPubkey ? preferredRelayMap[currentUserPubkey] || [] : []),
  ]);
}

export async function resolveDmWriteRelays(input: ResolveDmRelaysInput): Promise<string[]> {
  const { appRelayUrls, signer, recipientPubkeys = [], signal } = input;
  const fallbackRelays = normalizeRelayUrls([
    ...appRelayUrls,
    ...getDirectMessageRelayUrls(),
  ]);

  const signerRelays = signer?.getRelays
    ? normalizeRelayUrls(
        Object.entries(await signer.getRelays().catch(() => ({})))
          .filter(([, policy]) => policy.write)
          .map(([relayUrl]) => relayUrl),
      )
    : [];

  const preferredRelayMap = await queryPreferredRelayMap(fallbackRelays, recipientPubkeys, signal).catch(() => ({}));

  return normalizeRelayUrls([
    ...fallbackRelays,
    ...signerRelays,
    ...recipientPubkeys.flatMap((pubkey) => preferredRelayMap[pubkey] || []),
  ]);
}

export function encodeConversationId(pubkeys: string[]): string {
  const peers = [...new Set(pubkeys.filter(isPubkey))].sort();
  if (!peers.length) {
    throw new Error('Conversation requires at least one participant');
  }

  return encodeBase64Url(peers.join(','));
}

export function calculateUnsignedEventHash(
  event: Pick<DmRumorEvent, 'pubkey' | 'created_at' | 'kind' | 'tags' | 'content'>,
): string {
  const serializedEvent = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);

  return bytesToHex(sha256(Uint8Array.from(new TextEncoder().encode(serializedEvent))));
}

export function decodeConversationId(conversationId: string): string[] {
  try {
    const decoded = decodeBase64Url(conversationId);
    return [...new Set(decoded.split(',').filter(isPubkey))].sort();
  } catch {
    return [];
  }
}

export function getDmConversationPath(pubkeys: string[]): string {
  return `/messages/${encodeConversationId(pubkeys)}`;
}

export function getDmMessagePreview(message: DmMessage): string {
  const trimmed = message.content.trim();
  if (trimmed) {
    return trimmed;
  }

  if (message.share?.title) {
    return `Shared ${message.share.title}`;
  }

  if (message.share) {
    return 'Shared a vine';
  }

  return 'Sent a message';
}

interface BuildOptimisticDmMessageInput {
  currentUserPubkey: string;
  participantPubkeys: string[];
  content: string;
  share?: DmSharePayload;
  wraps: NostrEvent[];
  createdAt?: number;
}

export function buildOptimisticDmMessage(input: BuildOptimisticDmMessageInput): DmMessage | null {
  const {
    currentUserPubkey,
    participantPubkeys,
    content,
    share,
    wraps,
    createdAt = Math.round(Date.now() / 1000),
  } = input;

  const peerPubkeys = [...new Set(participantPubkeys.filter((pubkey) => pubkey !== currentUserPubkey))].sort();
  if (!peerPubkeys.length) {
    return null;
  }

  const participantList = [...new Set([currentUserPubkey, ...peerPubkeys])].sort();
  const selfWrap = wraps.find((wrap) => wrap.tags.some((tag) => tag[0] === 'p' && tag[1] === currentUserPubkey));
  const wrapId = selfWrap?.id || `optimistic:${currentUserPubkey}:${peerPubkeys.join(',')}:${createdAt}`;

  return {
    conversationId: encodeConversationId(peerPubkeys),
    wrapId,
    rumorId: wrapId,
    senderPubkey: currentUserPubkey,
    participantPubkeys: participantList,
    peerPubkeys,
    content,
    createdAt,
    isOutgoing: true,
    share,
  };
}

export function groupDmConversations(
  messages: DmMessage[],
  readState: Record<string, number>,
): DmConversation[] {
  const conversationMap = new Map<string, DmMessage[]>();

  for (const message of messages) {
    const group = conversationMap.get(message.conversationId) || [];
    group.push(message);
    conversationMap.set(message.conversationId, group);
  }

  return [...conversationMap.entries()]
    .map(([id, group]) => {
      const sortedMessages = [...group].sort((a, b) => a.createdAt - b.createdAt);
      const lastMessage = sortedMessages[sortedMessages.length - 1];
      const readAt = readState[id] || 0;
      const unreadCount = sortedMessages.filter(
        (message) => !message.isOutgoing && message.createdAt > readAt,
      ).length;

      return {
        id,
        participantPubkeys: lastMessage.peerPubkeys,
        lastMessage,
        unreadCount,
      } satisfies DmConversation;
    })
    .sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt);
}

export function buildDmSharePayloadFromVideo(video: ParsedVideoData): DmSharePayload {
  return {
    url: getVideoShareUrl(video),
    title: video.title,
    videoId: video.id,
    videoPubkey: video.pubkey,
    vineId: video.vineId || undefined,
  };
}

export function buildDmShareTags(share?: DmSharePayload): string[][] {
  if (!share) {
    return [];
  }

  const tags: string[][] = [['r', share.url]];

  if (share.title) {
    tags.push(['title', share.title]);
  }

  if (share.vineId && share.videoPubkey) {
    tags.push(['a', `${SHORT_VIDEO_KIND}:${share.videoPubkey}:${share.vineId}`]);
  } else if (share.videoId) {
    tags.push(['e', share.videoId]);
  }

  return tags;
}

export function buildDmShareQueryString(share?: DmSharePayload): string {
  if (!share) {
    return '';
  }

  const params = new URLSearchParams({ shareUrl: share.url });

  if (share.title) params.set('shareTitle', share.title);
  if (share.videoId) params.set('shareVideoId', share.videoId);
  if (share.videoPubkey) params.set('shareVideoPubkey', share.videoPubkey);
  if (share.vineId) params.set('shareVineId', share.vineId);

  return params.toString();
}

export function parseDmShareQuery(searchParams: URLSearchParams): DmSharePayload | undefined {
  const url = searchParams.get('shareUrl');
  if (!url) {
    return undefined;
  }

  return {
    url,
    title: searchParams.get('shareTitle') || undefined,
    videoId: searchParams.get('shareVideoId') || undefined,
    videoPubkey: searchParams.get('shareVideoPubkey') || undefined,
    vineId: searchParams.get('shareVineId') || undefined,
  };
}
