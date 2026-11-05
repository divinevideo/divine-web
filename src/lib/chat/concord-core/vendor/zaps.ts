/**
 * Zaps — shared pure helpers for both zap surfaces:
 *
 *  - NIP-29 group chat: standard NIP-57. The LNURL provider publishes a public
 *    kind-9735 receipt to our app relays; we aggregate receipts per message
 *    ({@link tallyZaps}), verifying the embedded request's signature and
 *    holding the bolt11 invoice as the single source of truth for amounts.
 *
 *  - Concord v2 channels: CORD.md private zaps. No public event exists — the
 *    payer seals a kind-9735-shaped rumor (NIP-57 receipt shape + `preimage`
 *    tag) into the Chat Plane, and every member verifies the payment locally
 *    ({@link verifyZapRumor}): sha256(preimage) must equal the invoice's
 *    payment hash and the `amount` tag must match the invoice's amount.
 *
 * Everything here is pure (no React, no network) so it tests in isolation and
 * folds can call it synchronously.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { decode as decodeBolt11 } from "light-bolt11-decoder";
import { verifyEvent } from "nostr-tools/pure";

import type { NostrEvent } from "@nostrify/nostrify";
import type { Event as NostrToolsEvent } from "nostr-tools/pure";

/** Bounded insertion-order cache (entries are immutable; the cap only bounds memory). */
function boundedSet<K, V>(map: Map<K, V>, key: K, value: V, cap = 4096): V {
  if (map.size >= cap) map.delete(map.keys().next().value as K);
  map.set(key, value);
  return value;
}

export const KIND_ZAP_RECEIPT = 9735;
/** On-chain Bitcoin zap attribution (kind 8333). */
export const KIND_ONCHAIN_ZAP = 8333;

/** Preset amounts (sats) for the zap dialog. */
export const ZAP_PRESETS = [21, 100, 500, 1000, 5000, 21000];

/** How the sats were sent. */
export type ZapRail = "lightning" | "onchain";

/** One counted zap on a message. */
export interface ZapEntry {
  /** Receipt event id (NIP-29) or rumor id (Concord). */
  id: string;
  /** The zapper's pubkey (embedded 9734 author for NIP-29; seal author for Concord). */
  pubkey: string;
  sats: number;
  comment: string;
  /** The payment rail: Lightning (NIP-57) or on-chain Bitcoin (kind 8333). */
  rail: ZapRail;
}

/** Aggregated zaps for one message. */
export interface ZapTally {
  totalSats: number;
  count: number;
  /** Whether the current user is among the zappers. */
  mine: boolean;
  /** Individual zaps, largest first. */
  zaps: ZapEntry[];
}

/** "1234567" → "1.2m", "21000" → "21k", "950" → "950". */
export function formatSats(sats: number): string {
  if (sats >= 1_000_000) return `${trimmed(sats / 1_000_000)}m`;
  if (sats >= 1_000) return `${trimmed(sats / 1_000)}k`;
  return String(sats);
}

function trimmed(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
}

// ── bolt11 ────────────────────────────────────────────────────────────────────

interface Bolt11Info {
  /** Millisats, or null for an amountless invoice. */
  amountMsats: number | null;
  /** Lowercase hex payment hash, or null if absent/undecodable. */
  paymentHash: string | null;
}

/** Decode the two invoice fields zaps care about. Never throws. */
export function bolt11Info(invoice: string): Bolt11Info {
  try {
    const decoded = decodeBolt11(invoice.trim());
    let amountMsats: number | null = null;
    let paymentHash: string | null = null;
    for (const section of decoded.sections as Array<{ name: string; value?: unknown }>) {
      if (section.name === "amount") {
        const n = Number(section.value);
        if (Number.isFinite(n) && n > 0) amountMsats = n;
      } else if (section.name === "payment_hash" && typeof section.value === "string") {
        paymentHash = section.value.toLowerCase();
      }
    }
    return { amountMsats, paymentHash };
  } catch {
    return { amountMsats: null, paymentHash: null };
  }
}

/** Whole sats encoded in an invoice, or null (amountless/undecodable). */
export function bolt11AmountSats(invoice: string): number | null {
  const { amountMsats } = bolt11Info(invoice);
  return amountMsats === null ? null : Math.floor(amountMsats / 1000);
}

// ── NIP-29: public kind-9735 receipts ────────────────────────────────────────

function tagValue(ev: NostrEvent, name: string): string | undefined {
  return ev.tags.find((t) => t[0] === name)?.[1];
}

/**
 * The embedded kind-9734 zap request, or null. Its signature is verified —
 * the only self-authenticating part of a receipt; without it anyone could
 * attribute a zap to an arbitrary pubkey (including the viewer's own,
 * spoofing "you zapped this"). Cached per receipt id.
 */
const requestCache = new Map<string, NostrEvent | null>();
export function receiptZapRequest(receipt: NostrEvent): NostrEvent | null {
  const hit = requestCache.get(receipt.id);
  if (hit !== undefined) return hit;

  const description = tagValue(receipt, "description");
  if (!description) return boundedSet(requestCache, receipt.id, null);
  try {
    const request = JSON.parse(description) as NostrEvent;
    const valid =
      request &&
      request.kind === 9734 &&
      typeof request.pubkey === "string" &&
      verifyEvent(request as NostrToolsEvent);
    return boundedSet(requestCache, receipt.id, valid ? request : null);
  } catch {
    return boundedSet(requestCache, receipt.id, null);
  }
}

/**
 * A receipt's amount in sats. The bolt11 invoice is the source of truth
 * (NIP-57 receipts MUST carry one); a request amount that disagrees with the
 * invoice voids the receipt, and the receipt's own `amount` tag is never
 * trusted alone.
 */
export function receiptAmountSats(receipt: NostrEvent, request: NostrEvent): number {
  const bolt11 = tagValue(receipt, "bolt11");
  if (!bolt11) return 0;
  const { amountMsats } = bolt11Info(bolt11);
  if (amountMsats === null) return 0;
  const requested = Number(request.tags.find((t) => t[0] === "amount")?.[1]);
  if (Number.isFinite(requested) && requested > 0 && requested !== amountMsats) return 0;
  return Math.floor(amountMsats / 1000);
}

/**
 * Fold public kind-9735 receipts for ONE target message into a tally. A relay
 * answering a `#e` query is trusted for routing, not content: dedupe by
 * receipt id AND payment hash (one payment counts once), drop receipts whose
 * request doesn't name `targetId`, fails signature verification, or claims an
 * amount its invoice doesn't carry. Residual trust: the receipt author isn't
 * pinned to the recipient's LNURL `nostrPubkey` (that fetch would leak every
 * reader's IP to every author's wallet provider), so a forger paying nothing
 * can still mint an unpaid invoice + self-signed request — what's closed here
 * is impersonation and free amount inflation.
 */
export function tallyZaps(
  receipts: NostrEvent[],
  targetId: string,
  userPubkey?: string,
): ZapTally {
  const seen = new Set<string>();
  const seenHashes = new Set<string>();
  const zaps: ZapEntry[] = [];
  for (const receipt of receipts) {
    if (receipt.kind !== KIND_ZAP_RECEIPT || seen.has(receipt.id)) continue;
    const request = receiptZapRequest(receipt);
    if (!request) continue;
    if (!request.tags.some((t) => t[0] === "e" && t[1] === targetId)) continue;
    const sats = receiptAmountSats(receipt, request);
    if (sats <= 0) continue;
    const { paymentHash } = bolt11Info(tagValue(receipt, "bolt11") ?? "");
    if (paymentHash) {
      if (seenHashes.has(paymentHash)) continue;
      seenHashes.add(paymentHash);
    }
    seen.add(receipt.id);
    zaps.push({ id: receipt.id, pubkey: request.pubkey, sats, comment: request.content ?? "", rail: "lightning" });
  }
  zaps.sort((a, b) => b.sats - a.sats);
  return {
    totalSats: zaps.reduce((sum, z) => sum + z.sats, 0),
    count: zaps.length,
    mine: Boolean(userPubkey && zaps.some((z) => z.pubkey === userPubkey)),
    zaps,
  };
}

// ── NIP-29: public on-chain zap events (kind 8333) ──────────────────────────

/**
 * Fold public kind-8333 on-chain zap events for ONE target message into a
 * tally. Unlike Lightning receipts, the proof is the Bitcoin transaction
 * itself (on a public ledger), so we validate only structural integrity and
 * dedup by txid (one tx = one zap). The sender's pubkey is the event author
 * (the event is self-signed); the amount comes from the `amount` tag.
 */
export function tallyOnchainZaps(
  events: NostrEvent[],
  targetId: string,
  userPubkey?: string,
): ZapTally {
  const seenTxids = new Set<string>();
  const zaps: ZapEntry[] = [];
  for (const event of events) {
    if (event.kind !== KIND_ONCHAIN_ZAP) continue;
    if (!event.tags.some((t) => t[0] === "e" && t[1] === targetId)) continue;
    const txid = verifyOnchainZapRumor({ kind: event.kind, tags: event.tags });
    if (!txid) continue;
    if (seenTxids.has(txid)) continue;
    seenTxids.add(txid);
    const sats = Number(event.tags.find((t) => t[0] === "amount")?.[1]);
    if (!Number.isFinite(sats) || sats <= 0) continue;
    zaps.push({
      id: event.id,
      pubkey: event.pubkey,
      sats,
      comment: event.content ?? "",
      rail: "onchain",
    });
  }
  zaps.sort((a, b) => b.sats - a.sats);
  return {
    totalSats: zaps.reduce((sum, z) => sum + z.sats, 0),
    count: zaps.length,
    mine: Boolean(userPubkey && zaps.some((z) => z.pubkey === userPubkey)),
    zaps,
  };
}

// ── CORD.md: sealed zap rumors ────────────────────────────────────────────────

/**
 * Verify a CORD.md zap rumor's payment proof (§4):
 *   - sha256(preimage) equals the bolt11 invoice's payment hash, and
 *   - the `amount` tag equals the invoice's encoded amount (millisats).
 * Returns the invoice's payment hash on success (the fold dedupes on it —
 * every settled payment counts at most once per channel, §4), null on any
 * failure. Channel/epoch binding is the plane decoder's job (it checks every
 * chat rumor); this checks only what is zap-specific. Never throws.
 */
export function verifyZapRumor(rumor: {
  kind: number;
  tags: string[][];
}): string | null {
  if (rumor.kind !== KIND_ZAP_RECEIPT) return null;
  const find = (name: string) => rumor.tags.find((t) => t[0] === name)?.[1];
  const bolt11 = find("bolt11");
  const preimage = find("preimage");
  const amount = Number(find("amount"));
  if (!bolt11 || !preimage || !/^[0-9a-f]{64}$/.test(preimage)) return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const { amountMsats, paymentHash } = bolt11Info(bolt11);
  if (!paymentHash || amountMsats === null) return null; // amountless invoices are not zappable
  if (amountMsats !== amount) return null;
  try {
    return bytesToHex(sha256(hexToBytes(preimage))) === paymentHash ? paymentHash : null;
  } catch {
    return null;
  }
}

/**
 * Build the CORD.md zap rumor tag set (binding tags are added by the send
 * path). `omitTarget` skips the `e` tag for senders whose transport appends
 * the target itself.
 */
export function zapRumorTags(opts: {
  targetId: string;
  targetKind: number;
  recipient: string;
  amountMsats: number;
  bolt11: string;
  preimage: string;
  omitTarget?: boolean;
}): string[][] {
  return [
    ...(opts.omitTarget ? [] : [["e", opts.targetId]]),
    ["p", opts.recipient],
    ["k", String(opts.targetKind)],
    ["amount", String(opts.amountMsats)],
    ["bolt11", opts.bolt11],
    ["preimage", opts.preimage],
  ];
}

// ── CORD.md: on-chain zap rumors (kind 8333) ─────────────────────────────────

/**
 * Verify a CORD.md on-chain zap rumor. Unlike Lightning zaps there is no
 * preimage proof — the "proof" is the Bitcoin transaction itself, which lives
 * on a public ledger anyone can check independently. Here we only validate
 * structural integrity: kind 8333, a well-formed `i` tag (`bitcoin:tx:<txid>`),
 * and a positive `amount` tag. The txid is the dedup key (one tx = one zap),
 * returned on success so the fold can count each tx at most once per channel.
 *
 * Channel/epoch binding is the plane decoder's job (it checks every chat
 * rumor); this checks only what is on-chain-zap-specific. Never throws.
 */
export function verifyOnchainZapRumor(rumor: {
  kind: number;
  tags: string[][];
}): string | null {
  if (rumor.kind !== KIND_ONCHAIN_ZAP) return null;
  const find = (name: string) => rumor.tags.find((t) => t[0] === name)?.[1];
  const i = find("i");
  const amount = Number(find("amount"));
  if (!i || !i.startsWith("bitcoin:tx:")) return null;
  const txid = i.slice("bitcoin:tx:".length);
  if (!/^[0-9a-f]{64}$/.test(txid)) return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return txid;
}
