/**
 * Concord V2 Invites — CORD-05.
 *
 * An invite is a URL in two parts: a public locator in the path (a bare NIP-19
 * naddr naming the addressable bundle `(kind 33301, link_signer, d="")`) and a
 * secret in the `#fragment` (a 16-byte unlock token + up to 3 bootstrap
 * relays, encoded as base64url binary against a versioned relay dictionary).
 * The fragment never reaches any server; the token derives exactly one thing —
 * the bundle's decrypt key. The bundle carries the actual membership keys.
 *
 * Minting a link mints a fresh LINK SIGNER keypair used for nothing else; only
 * its holder (the creator, via the self-encrypted Invite List) can refresh or
 * tombstone the bundle, so a link-holder can join but never squat or kill the
 * link.
 */

import { hexToBytes } from "@noble/hashes/utils.js";
import { decrypt as nip44Decrypt, encrypt as nip44Encrypt } from "nostr-tools/nip44";
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from "nostr-tools/pure";
import type { NostrEvent } from "nostr-tools/pure";
import * as nip19 from "nostr-tools/nip19";

import { inviteBundleKey, verifyCommunityId } from "./derive";
import { KIND_INVITE_BUNDLE, VSK_INVITE_LIVE, VSK_INVITE_REVOKED } from "./kinds";
import { MAX_BUNDLE_CHANNELS, capRelays, type ImagePointer } from "./types";

/** The link's unlock token: 16 random bytes (CORD-05 §2). */
export const TOKEN_BYTES = 16;
/** The fragment carries at most 3 bootstrap relays (CORD-05 §3). */
export const MAX_BOOTSTRAP_RELAYS = 3;
/** The fragment format/dictionary generation byte. Lower values are legacy. */
export const FRAGMENT_VERSION = 4;

/**
 * The bundle preview's description cap: far below the 10,000-byte Community
 * metadata cap (CORD-02 §6), because the preview exists to render a card, not
 * to mirror the full about text. Applied at build AND at parse (a hostile
 * bundle is truncated, not refused — the description is cosmetic).
 */
export const BUNDLE_DESCRIPTION_MAX_BYTES = 500;

/** Truncate to the byte cap on a UTF-8 code-point boundary. */
export function capBundleDescription(s: string): string {
  const bytes = new TextEncoder().encode(s);
  if (bytes.length <= BUNDLE_DESCRIPTION_MAX_BYTES) return s;
  let end = BUNDLE_DESCRIPTION_MAX_BYTES;
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end--;
  return new TextDecoder().decode(bytes.subarray(0, end));
}

// ── The bundle (CORD-05 §1) ──────────────────────────────────────────────────

export interface InviteBundle {
  community_id: string;
  owner: string;
  owner_salt: string;
  community_root: string;
  root_epoch: number;
  /**
   * The Control Plane's signer pubkey at `root_epoch` (CORD-02 §5): subscribe,
   * verify, read — never write. Absent = a legacy, pre-split Community (fold
   * Control at the legacy address, CORD-06 §3). Taken on trust — it derives
   * from a secret the joiner never holds, so nothing in the bundle can prove
   * it; a wrong one is eclipse-class self-harm by the inviter (the joiner
   * reads a stale/empty plane), never forged authority, and a later verified
   * base rotation re-delivers the true key (CORD-05 §1).
   */
  control_pk?: string;
  /** The granted (private) Channels. */
  channels: Array<{ id: string; key: string; epoch: number; name: string }>;
  relays: string[];
  /** Preview, so a parked invite can render; the Control fold is the authority. */
  name: string;
  icon?: ImagePointer;
  banner?: ImagePointer;
  /** Preview of the Community description, capped at {@link BUNDLE_DESCRIPTION_MAX_BYTES}. */
  description?: string;
  /** Optional, unix ms: past it the preview still renders, joining refuses. */
  expires_at?: number;
  /** Optional attribution, echoed in the joiner's Guestbook Join. */
  creator_npub?: string;
  label?: string;
  [k: string]: unknown;
}

export class InviteError extends Error {
  constructor(
    public code: "bad-link" | "bad-fragment" | "bad-bundle" | "owner-mismatch" | "revoked" | "expired" | "bounds",
    message: string,
  ) {
    super(message);
    this.name = "InviteError";
  }
}

/**
 * Bound an attacker-crafted bundle before allocating (CORD-05 §1): sane
 * channel count, relays truncated to the Community cap.
 */
function boundBundle(bundle: InviteBundle): InviteBundle {
  if (!Array.isArray(bundle.channels)) bundle.channels = [];
  if (bundle.channels.length > MAX_BUNDLE_CHANNELS) {
    throw new InviteError("bounds", `bundle carries ${bundle.channels.length} channels (cap ${MAX_BUNDLE_CHANNELS})`);
  }
  bundle.relays = capRelays(Array.isArray(bundle.relays) ? bundle.relays : []);
  if (bundle.description !== undefined) {
    if (typeof bundle.description === "string") bundle.description = capBundleDescription(bundle.description);
    else delete bundle.description;
  }
  return bundle;
}

/**
 * Validate a decrypted bundle regardless of how it arrived — fetched from a
 * link's coordinate or handed over whole in a Direct Invite (CORD-05 §6): the
 * §1 bounds apply, and the self-certifying `community_id` must reproduce from
 * (owner, salt), so even a compromised creator can't smuggle a false owner.
 * Throws `bounds` / `owner-mismatch`; expiry is the caller's concern (a parked
 * invite still renders past `expires_at` — joining refuses).
 */
export function validateBundle(bundle: InviteBundle): InviteBundle {
  boundBundle(bundle);
  if (!verifyCommunityId(bundle.community_id, bundle.owner, bundle.owner_salt)) {
    throw new InviteError("owner-mismatch", "bundle's owner does not reproduce its community_id");
  }
  return bundle;
}

/**
 * Re-post events for every live link, carrying `bundle` (the CURRENT keys) at
 * each link's coordinate (CORD-05 §2). `entries` are the creator's Invite List
 * entries for this community — each supplies the `token` + `signer_sk` needed
 * to author its coordinate. A malformed entry is skipped. The per-link
 * `expires_at`/`label` are preserved from the entry; everything else (root,
 * epoch, channels, relays, name) comes from the fresh `bundle`.
 */
export function buildRefreshedBundleEvents(
  bundle: InviteBundle,
  entries: Array<{ token: string; signer_sk: string; expires_at?: number; label?: string }>,
): NostrEvent[] {
  const events: NostrEvent[] = [];
  for (const entry of entries) {
    try {
      const perLink: InviteBundle = {
        ...bundle,
        ...(entry.expires_at ? { expires_at: entry.expires_at * 1000 } : {}),
        ...(entry.label ? { label: entry.label } : {}),
      };
      events.push(buildBundleEvent(perLink, hexToBytes(entry.token), hexToBytes(entry.signer_sk)));
    } catch {
      // A malformed stored entry can't be refreshed; skip it.
    }
  }
  return events;
}

/** Build the addressable bundle event: `(33301, link_signer, d="")`, marked live. */
export function buildBundleEvent(bundle: InviteBundle, token: Uint8Array, linkSignerSk: Uint8Array): NostrEvent {
  const content = nip44Encrypt(JSON.stringify(bundle), inviteBundleKey(token));
  return finalizeEvent(
    {
      kind: KIND_INVITE_BUNDLE,
      content,
      tags: [
        ["d", ""],
        ["vsk", VSK_INVITE_LIVE],
      ],
      created_at: Math.floor(Date.now() / 1000),
    },
    linkSignerSk,
  );
}

/** Re-post the coordinate as a revocation tombstone (creator only — needs the signer). */
export function buildRevocationEvent(linkSignerSk: Uint8Array): NostrEvent {
  return finalizeEvent(
    {
      kind: KIND_INVITE_BUNDLE,
      content: "",
      tags: [
        ["d", ""],
        ["vsk", VSK_INVITE_REVOKED],
      ],
      created_at: Math.floor(Date.now() / 1000),
    },
    linkSignerSk,
  );
}

/**
 * Verify + decrypt a fetched bundle event. `expectedSigner` is the naddr's
 * author — the coordinate itself is the anti-squat guard, but we re-check the
 * signature and author to reject a relay handing back garbage. Throws
 * `revoked` on a tombstone, `expired` past `expires_at`, `owner-mismatch` when
 * (owner, salt) fail to reproduce the community_id.
 */
export function parseBundleEvent(
  event: NostrEvent,
  expectedSigner: string,
  token: Uint8Array,
  nowMs: number,
): InviteBundle {
  if (event.kind !== KIND_INVITE_BUNDLE || event.pubkey !== expectedSigner || !verifyEvent(event)) {
    throw new InviteError("bad-bundle", "not a valid invite bundle event");
  }
  const vsk = event.tags.find((t) => t[0] === "vsk")?.[1];
  if (vsk === VSK_INVITE_REVOKED) {
    throw new InviteError("revoked", "this invite link has been revoked");
  }
  if (vsk !== VSK_INVITE_LIVE) {
    throw new InviteError("bad-bundle", `unknown bundle marker: ${vsk}`);
  }

  let bundle: InviteBundle;
  try {
    bundle = JSON.parse(nip44Decrypt(event.content, inviteBundleKey(token))) as InviteBundle;
  } catch (e) {
    throw new InviteError("bad-bundle", `bundle decrypt: ${e instanceof Error ? e.message : e}`);
  }

  // The community_id self-certifies the owner: a mismatching bundle is refused,
  // so even a compromised creator can't smuggle a false owner (CORD-05 §1).
  validateBundle(bundle);
  if (typeof bundle.expires_at === "number" && nowMs > bundle.expires_at) {
    throw new InviteError("expired", "this invite link has expired");
  }
  return bundle;
}

// ── The fragment codec (CORD-05 §3) ──────────────────────────────────────────

/**
 * The stock relay dictionary, generation 4: four primaries every client knows,
 * referenced by a single byte. Versioned — it grows without breaking older
 * links; both Vector and Soapbox ship it identically.
 */
export const RELAY_DICTIONARY: Record<number, string> = {
  1: "wss://jskitty.com/nostr",
  2: "wss://asia.vectorapp.io/nostr",
  3: "wss://relay.ditto.pub",
  4: "wss://relay.dreamith.to",
};

/** The stock set selected by the flags bit (dictionary ids 1–4, in order). */
export const STOCK_RELAYS: string[] = [1, 2, 3, 4].map((i) => RELAY_DICTIONARY[i]);

/** flags bit 0: the stock set is in use, zero relay bytes follow. */
const FLAG_STOCK_SET = 0x01;

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const DICT_BY_URL = new Map(Object.entries(RELAY_DICTIONARY).map(([id, url]) => [url, Number(id)]));

/**
 * Encode the invite fragment: `[version][flags][relays?][token:16]` as
 * base64url, no padding. The stock set costs zero relay bytes; otherwise each
 * relay is a dictionary id byte, a wss-implied literal (`0, len, host`), or a
 * verbatim literal (`255, len, url`).
 */
export function encodeFragment(token: Uint8Array, relays: string[]): string {
  if (token.length !== TOKEN_BYTES) throw new InviteError("bad-fragment", `token must be ${TOKEN_BYTES} bytes`);
  // The stock set is selected by a flag (zero relay bytes), so it is exempt
  // from the 3-relay bootstrap cap, which applies to explicit entries only.
  const isStock = relays.length === STOCK_RELAYS.length && relays.every((r, i) => r === STOCK_RELAYS[i]);
  const bounded = relays.slice(0, MAX_BOOTSTRAP_RELAYS);

  const bytes: number[] = [FRAGMENT_VERSION];
  if (isStock) {
    bytes.push(FLAG_STOCK_SET);
  } else {
    bytes.push(0x00, bounded.length);
    const encoder = new TextEncoder();
    for (const relay of bounded) {
      const dictId = DICT_BY_URL.get(relay);
      if (dictId !== undefined) {
        bytes.push(dictId);
      } else if (relay.startsWith("wss://")) {
        const host = encoder.encode(relay.slice("wss://".length));
        if (host.length > 255) throw new InviteError("bad-fragment", "relay host too long");
        bytes.push(0, host.length, ...host);
      } else {
        const url = encoder.encode(relay);
        if (url.length > 255) throw new InviteError("bad-fragment", "relay URL too long");
        bytes.push(255, url.length, ...url);
      }
    }
  }
  bytes.push(...token);
  return toBase64Url(new Uint8Array(bytes));
}

/** Decode an invite fragment into its token + bootstrap relays. */
export function decodeFragment(fragment: string): { token: Uint8Array; relays: string[] } {
  let bytes: Uint8Array;
  try {
    bytes = fromBase64Url(fragment.trim());
  } catch {
    throw new InviteError("bad-fragment", "fragment is not base64url");
  }
  let o = 0;
  const need = (n: number) => {
    if (o + n > bytes.length) throw new InviteError("bad-fragment", "fragment truncated");
  };
  need(2);
  const version = bytes[o++];
  if (version < FRAGMENT_VERSION) {
    // A client MAY reject lower values as legacy links rather than decode them
    // against the wrong dictionary (CORD-05 §3).
    throw new InviteError("bad-fragment", `legacy invite format (version ${version})`);
  }
  if (version > FRAGMENT_VERSION) {
    throw new InviteError("bad-fragment", `invite format ${version} is newer than this client`);
  }
  const flags = bytes[o++];

  const relays: string[] = [];
  if (flags & FLAG_STOCK_SET) {
    relays.push(...STOCK_RELAYS);
  } else {
    need(1);
    const count = bytes[o++];
    if (count > MAX_BOOTSTRAP_RELAYS) throw new InviteError("bad-fragment", "too many bootstrap relays");
    const decoder = new TextDecoder();
    for (let i = 0; i < count; i++) {
      need(1);
      const lead = bytes[o++];
      if (lead >= 1 && lead <= 254) {
        const url = RELAY_DICTIONARY[lead];
        if (url) relays.push(url);
        // An unknown dictionary id is skipped, not fatal: the dictionary grows.
      } else {
        need(1);
        const len = bytes[o++];
        need(len);
        const text = decoder.decode(bytes.slice(o, o + len));
        o += len;
        relays.push(lead === 255 ? text : `wss://${text}`);
      }
    }
  }

  need(TOKEN_BYTES);
  const token = bytes.slice(o, o + TOKEN_BYTES);
  o += TOKEN_BYTES;
  if (o !== bytes.length) throw new InviteError("bad-fragment", "trailing bytes in fragment");
  return { token, relays };
}

// ── The link (CORD-05 §2) ────────────────────────────────────────────────────

export const INVITE_PATH_PREFIX = "/invite/";

/** A parsed V2 invite link: the bundle coordinate + the fragment's secrets. */
export interface ParsedInviteLink {
  /** The link signer's pubkey (hex) — the bundle's coordinate author. */
  linkSigner: string;
  token: Uint8Array;
  bootstrapRelays: string[];
  naddr: string;
}

/** Build the bare naddr for a link signer's bundle coordinate (empty `d`). */
export function bundleNaddr(linkSignerPk: string): string {
  return nip19.naddrEncode({ kind: KIND_INVITE_BUNDLE, pubkey: linkSignerPk, identifier: "" });
}

/** Build a shareable invite URL on `base` (any deeplink domain works — the base is cosmetic). */
export function buildInviteUrl(base: string, linkSignerPk: string, token: Uint8Array, relays: string[]): string {
  return `${base.replace(/\/$/, "")}${INVITE_PATH_PREFIX}${bundleNaddr(linkSignerPk)}#${encodeFragment(token, relays)}`;
}

/** Decode a bare naddr into the link-signer pubkey, or undefined if it isn't one. */
function naddrToSigner(naddr: string): string | undefined {
  try {
    const decoded = nip19.decode(naddr);
    if (decoded.type !== "naddr") return undefined;
    const data = decoded.data;
    if (data.kind !== KIND_INVITE_BUNDLE || data.identifier !== "") return undefined;
    return data.pubkey;
  } catch {
    return undefined;
  }
}

/**
 * Whether `input` names a V2 invite bundle coordinate — an `…/invite/<naddr>`
 * path (or bare `naddr`) whose naddr is a valid invite-bundle coordinate —
 * REGARDLESS of whether the `#fragment` secret is present. Use this to route a
 * link to the invite UI (which can then explain a missing secret) rather than
 * letting a fragment-less invite fall through to a generic event card: the
 * bundle's content is encrypted and can never render as a plain event.
 */
export function isInviteUrl(input: string): boolean {
  const trimmed = input.trim();
  let naddr: string | undefined;
  if (/^naddr1[a-z0-9]+/i.test(trimmed)) {
    naddr = trimmed.split("#")[0];
  } else {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return false;
    }
    if (!url.pathname.startsWith(INVITE_PATH_PREFIX)) return false;
    naddr = decodeURIComponent(url.pathname.slice(INVITE_PATH_PREFIX.length)).replace(/\/$/, "");
  }
  return !!naddr && naddrToSigner(naddr) !== undefined;
}

/**
 * Parse a V2 invite from a full URL (`…/invite/<naddr>#<fragment>`) or the
 * domain-agnostic bare form (`<naddr>#<fragment>`). Returns undefined for
 * anything that isn't recognizably a V2 invite (so callers can fall through to
 * other classifiers).
 */
export function parseInviteLink(input: string): ParsedInviteLink | undefined {
  const trimmed = input.trim();

  let naddr: string | undefined;
  let fragment: string | undefined;

  if (/^naddr1[a-z0-9]+#.+$/i.test(trimmed)) {
    const [head, ...rest] = trimmed.split("#");
    naddr = head;
    fragment = rest.join("#");
  } else {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return undefined;
    }
    if (!url.pathname.startsWith(INVITE_PATH_PREFIX)) return undefined;
    naddr = decodeURIComponent(url.pathname.slice(INVITE_PATH_PREFIX.length)).replace(/\/$/, "");
    fragment = url.hash.replace(/^#/, "");
  }

  if (!naddr || !fragment) return undefined;
  const linkSigner = naddrToSigner(naddr);
  if (!linkSigner) return undefined;
  let decoded: { token: Uint8Array; relays: string[] };
  try {
    decoded = decodeFragment(fragment);
  } catch {
    return undefined;
  }
  return { linkSigner, token: decoded.token, bootstrapRelays: decoded.relays, naddr };
}

/** Parse the invite parts as they arrive at the /invite/:naddr route. */
export function parseInviteRoute(naddr: string, fragment: string): ParsedInviteLink | undefined {
  const linkSigner = naddrToSigner(naddr);
  if (!linkSigner) return undefined;
  try {
    const { token, relays } = decodeFragment(fragment);
    return { linkSigner, token, bootstrapRelays: relays, naddr };
  } catch {
    return undefined;
  }
}

// ── The Invite List (CORD-05 §4, kind 13303) ─────────────────────────────────

export interface InviteListEntry {
  /** The link's unlock secret AND its merge key (hex). */
  token: string;
  /** The link_signer secret (hex): refreshing or retiring the bundle needs it. */
  signer_sk: string;
  community_id: string;
  /** The shareable link. */
  url: string;
  label?: string;
  created_at: number;
  expires_at?: number;
  [k: string]: unknown;
}

export interface InviteListTombstone {
  token: string;
  community_id: string;
  [k: string]: unknown;
}

export interface InviteList {
  entries: InviteListEntry[];
  tombstones: InviteListTombstone[];
  [k: string]: unknown;
}

export const EMPTY_INVITE_LIST: InviteList = { entries: [], tombstones: [] };

/**
 * Merge two Invite Lists without coordination: the token is the merge key, an
 * entry is immutable once minted, tombstones union, and a tombstone always
 * beats an entry — terminally, so a stale device can never resurrect a revoked
 * link (CORD-05 §4).
 */
export function mergeInviteLists(a: InviteList, b: InviteList): InviteList {
  const entries = new Map<string, InviteListEntry>();
  for (const e of [...a.entries, ...b.entries]) {
    if (!e || typeof e.token !== "string") continue;
    if (!entries.has(e.token)) entries.set(e.token, e);
  }
  const tombstones = new Map<string, InviteListTombstone>();
  for (const t of [...a.tombstones, ...b.tombstones]) {
    if (!t || typeof t.token !== "string") continue;
    if (!tombstones.has(t.token)) tombstones.set(t.token, t);
  }
  for (const token of tombstones.keys()) entries.delete(token);
  return {
    ...a,
    ...b,
    entries: [...entries.values()].sort((x, y) => x.token.localeCompare(y.token)),
    tombstones: [...tombstones.values()].sort((x, y) => x.token.localeCompare(y.token)),
  };
}

/** Mint a fresh link-signer keypair. */
export function mintLinkSigner(): { sk: Uint8Array; pk: string } {
  const sk = generateSecretKey();
  return { sk, pk: getPublicKey(sk) };
}

/** Mint a fresh 16-byte unlock token. */
export function mintToken(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
}
