/**
 * Concord V2 core types — the runtime model the hooks and UI operate on.
 *
 * Ids and keys are raw 32-byte values in memory (lowercase hex on the wire).
 * A Community's identity (`community_id`) is a self-certifying commitment to
 * its owner; its access (`community_root`) is a separate 32-byte secret so
 * access can rotate while identity stays fixed (CORD-02 §1–2).
 */

import type { GroupKey } from "./derive";
import {
  normalizeGitRepositoryAttachments,
  parseGitRepositoryAddress,
  type GitRepositoryAttachment,
} from "./vendor/gitActivity";

/** Protocol recommendation for a community's relay set (CORD-02 §6). */
export const MAX_COMMUNITY_RELAYS = 5;

/** Community/channel/role name cap: 64 bytes of UTF-8 (CORD-02 §6). */
export const NAME_MAX_BYTES = 64;
/** Community description cap: 10,000 bytes of UTF-8 (CORD-02 §6). */
export const DESCRIPTION_MAX_BYTES = 10_000;
/** Hostile-bundle bound: reject an invite carrying more channels than this (CORD-05 §1). */
export const MAX_BUNDLE_CHANNELS = 256;
/** The Community List caps at 50 memberships (CORD-02 §8). */
export const MAX_LIST_MEMBERSHIPS = 50;
/** Bound hostile channel metadata while retaining a useful attachment history. */
export const MAX_CHANNEL_GIT_ATTACHMENTS = 128;
/** Relay hints are hints, not an unbounded metadata transport. */
export const MAX_CHANNEL_GIT_RELAY_HINTS = 8;

/** Armada's namespaced channel-custom member for Git repository attachments. */
export const ARMADA_GIT_CHANNEL_METADATA_KEY = "armada.git";

/** The wire form deliberately stores the canonical address rather than a parsed object. */
export interface ChannelGitRepositoryAttachment {
  address: string;
  relayHints: string[];
  attachedAt: number;
  detachedAt?: number;
}

/** Dedupe (order-preserving) + truncate a relay set to the recommended cap. */
export function capRelays(relays: string[], cap = MAX_COMMUNITY_RELAYS): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of relays) {
    if (out.length >= cap) break;
    if (typeof r === "string" && r && !seen.has(r)) {
      seen.add(r);
      out.push(r);
    }
  }
  return out;
}

/** Byte length of a string as UTF-8. */
export function utf8Len(s: string): number {
  return new TextEncoder().encode(s).length;
}

/**
 * An encrypted-blob pointer (icon / banner): the media host stores ciphertext,
 * the per-image key + nonce ride inside member-sealed metadata, and `hash` is
 * the SHA-256 of the plaintext so a swapped blob fails closed (CORD-02 §6).
 */
export interface ImagePointer {
  url: string;
  /** Hex AES-256-GCM key. */
  key: string;
  /** Hex AES-GCM nonce/IV. */
  nonce: string;
  /** Hex SHA-256 of the plaintext. */
  hash: string;
}

/** Runtime check that a value is a plausible {@link ImagePointer}. */
export function isImagePointer(v: unknown): v is ImagePointer {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.url === "string" &&
    typeof o.key === "string" &&
    typeof o.nonce === "string" &&
    typeof o.hash === "string"
  );
}

/** Community metadata — the vsk=0 Control Plane entity's content (CORD-02 §6). */
export interface CommunityMetadata {
  name: string;
  description?: string;
  /** The Community's evolving relay set (the fold is the authority). */
  relays: string[];
  icon?: ImagePointer;
  banner?: ImagePointer;
  /**
   * Disappearing-messages timer in seconds (CORD-08): while set, every durable
   * chat-plane rumor (except deletes and timer notices) carries a NIP-40
   * `expiration` of its send time plus this. Absent, 0, or malformed = off;
   * read through `messageExpirationOf`, never directly.
   */
  message_expiration?: number;
  /** Client-extensible opaque fields; editors MUST round-trip what they don't understand. */
  custom?: Record<string, unknown>;
  /** Unknown top-level fields, preserved for round-tripping. */
  [k: string]: unknown;
}

/** Channel metadata — the vsk=2 Control Plane entity's content (CORD-03 §2). */
export interface ChannelMetadata {
  name: string;
  private: boolean;
  /** Terminal: the id is never reused; clients drop the Channel from display. */
  deleted?: boolean;
  custom?: Record<string, unknown>;
  [k: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Read valid, bounded Git attachment intervals from a channel's opaque custom
 * metadata. Bad extension data is ignored rather than invalidating the channel.
 */
export function channelGitRepositoryAttachments(metadata: ChannelMetadata): GitRepositoryAttachment[] {
  const extension = isRecord(metadata.custom) ? metadata.custom[ARMADA_GIT_CHANNEL_METADATA_KEY] : undefined;
  if (!isRecord(extension) || !Array.isArray(extension.repositories)) return [];

  const attachments: GitRepositoryAttachment[] = [];
  for (const value of extension.repositories) {
    if (!isRecord(value) || typeof value.address !== "string" || !Array.isArray(value.relayHints)) continue;
    const address = parseGitRepositoryAddress(value.address);
    const attachedAt = value.attachedAt;
    const detachedAt = value.detachedAt;
    if (!address || typeof attachedAt !== "number" || !Number.isSafeInteger(attachedAt) || attachedAt < 0) continue;
    if (detachedAt !== undefined && (typeof detachedAt !== "number" || !Number.isSafeInteger(detachedAt) || detachedAt < attachedAt)) continue;
    attachments.push({
      address,
      relayHints: value.relayHints.filter((relay): relay is string => typeof relay === "string").slice(0, MAX_CHANNEL_GIT_RELAY_HINTS),
      attachedAt,
      ...(detachedAt === undefined ? {} : { detachedAt }),
    });
  }
  return normalizeGitRepositoryAttachments(attachments)
    .map((attachment) => ({ ...attachment, relayHints: attachment.relayHints.slice(0, MAX_CHANNEL_GIT_RELAY_HINTS) }))
    .slice(0, MAX_CHANNEL_GIT_ATTACHMENTS);
}

/**
 * Normalize known Git fields while preserving every unknown channel/custom/Git
 * extension member for forward-compatible metadata round trips.
 */
export function normalizeChannelMetadata(metadata: ChannelMetadata): ChannelMetadata {
  if (!isRecord(metadata.custom)) return metadata;
  const extension = metadata.custom[ARMADA_GIT_CHANNEL_METADATA_KEY];
  if (!isRecord(extension)) {
    // A malformed known extension is ignored; unrelated custom members survive.
    const { [ARMADA_GIT_CHANNEL_METADATA_KEY]: _ignored, ...custom } = metadata.custom;
    const { custom: _oldCustom, ...rest } = metadata;
    return { ...rest, ...(Object.keys(custom).length ? { custom } : {}) };
  }
  const attachments = channelGitRepositoryAttachments(metadata);
  return {
    ...metadata,
    custom: {
      ...metadata.custom,
      [ARMADA_GIT_CHANNEL_METADATA_KEY]: {
        ...extension,
        repositories: attachments.map((attachment): ChannelGitRepositoryAttachment => ({
          address: attachment.address.coordinate,
          relayHints: attachment.relayHints,
          attachedAt: attachment.attachedAt,
          ...(attachment.detachedAt === undefined ? {} : { detachedAt: attachment.detachedAt }),
        })),
      },
    },
  };
}

/** Replace attachment intervals without disturbing ordinary or opaque channel metadata. */
export function withChannelGitRepositoryAttachments(
  metadata: ChannelMetadata,
  attachments: readonly GitRepositoryAttachment[],
): ChannelMetadata {
  const custom = isRecord(metadata.custom) ? metadata.custom : {};
  const extension = isRecord(custom[ARMADA_GIT_CHANNEL_METADATA_KEY]) ? custom[ARMADA_GIT_CHANNEL_METADATA_KEY] : {};
  const bounded = normalizeGitRepositoryAttachments(attachments)
    .map((attachment) => ({ ...attachment, relayHints: attachment.relayHints.slice(0, MAX_CHANNEL_GIT_RELAY_HINTS) }))
    .slice(0, MAX_CHANNEL_GIT_ATTACHMENTS);
  return {
    ...metadata,
    custom: {
      ...custom,
      [ARMADA_GIT_CHANNEL_METADATA_KEY]: {
        ...extension,
        repositories: bounded.map((attachment): ChannelGitRepositoryAttachment => ({
          address: attachment.address.coordinate,
          relayHints: attachment.relayHints,
          attachedAt: attachment.attachedAt,
          ...(attachment.detachedAt === undefined ? {} : { detachedAt: attachment.detachedAt }),
        })),
      },
    },
  };
}

/** A private Channel's independent key material, as delivered by an invite. */
export interface PrivateChannelKey {
  /** Channel id (32 bytes). */
  id: Uint8Array;
  /** Independent random key (32 bytes) — cryptographically unrelated to the root. */
  key: Uint8Array;
  epoch: bigint;
  /** Join-time preview name; the ChannelMetadata fold is the authority. */
  name: string;
  /**
   * Superseded keys for this channel, retained so HISTORY stays readable
   * across rotations. A rotation re-keys the channel forward; without the
   * priors, every message sealed under an earlier epoch becomes undecryptable
   * to a member who is still fully entitled — the conversation would appear
   * to start over on every revoke. Read-only: never used to write.
   *
   * `retiredAt` is the epoch-seconds the superseding rotation published: the
   * hard read cutoff for the retired key. Anything sealed under it with a
   * later `created_at` is refused — a retired epoch is history, never a live
   * channel an ejected keyholder can keep writing into. Absent for keys
   * retired before this client recorded cutoffs (those decode uncapped).
   */
  priors?: Array<{ key: Uint8Array; epoch: bigint; retiredAt?: number }>;
}

/** A held root-key epoch (the current one plus retained priors for history). */
export interface HeldRoot {
  epoch: bigint;
  key: Uint8Array;
  /**
   * The epoch's Control Plane signer pubkey (`control_pk`, x-only hex) —
   * HELD, never derived: it derives from a `control_root` only the owner and
   * staff hold (CORD-02 §2), and arrives in invites, base rekey blobs, and the
   * Community List. Present = a split epoch (subscribe/verify by this address,
   * decrypt under the community_root-derived read key); absent = a LEGACY
   * pre-split epoch, whose Control Plane folds at the member-derivable
   * `concord/control` address (CORD-02 §5).
   */
  controlPk?: string;
  /**
   * Epoch-seconds the rotation that superseded this root published — the hard
   * read cutoff for everything derived from it (see the priors doc above).
   * Absent on the current root, and on roots retired before cutoffs existed.
   */
  retiredAt?: number;
  /**
   * The npub whose Refounding minted this epoch (x-only hex) — the snapshot
   * authority for ITS Guestbook (CORD-02 §5: a snapshot "is honored only from
   * the npub whose Refounding minted that epoch"). Recorded so historical
   * epochs' snapshots stay verifiable after the rotator's rank (or the
   * `refounder` field, which only names the CURRENT epoch's) has moved on.
   * Absent at genesis (the owner) and on epochs adopted before this existed.
   */
  refounder?: string;
}

/**
 * A Concord V2 community as the client holds it — rehydrated from the
 * Community List entry (join material) with the deployment's app relays
 * unioned in. Channel DEFINITIONS live on the Control Plane; this carries only
 * identity, access keys, and the private-channel keys the member holds.
 */
export interface CommunityV2 {
  id: Uint8Array;
  idHex: string;
  /** The proven owner (x-only hex) — verified against the id commitment. */
  owner: string;
  ownerSalt: Uint8Array;
  /** The current community_root at `rootEpoch`. */
  root: Uint8Array;
  rootEpoch: bigint;
  /**
   * The CURRENT epoch's Control Plane signer pubkey (see
   * {@link HeldRoot.controlPk}); absent on a legacy pre-split epoch. Mirrors
   * the current entry in `heldRoots`, the way `root`/`rootEpoch` do.
   */
  controlPk?: string;
  /**
   * The CURRENT epoch's staff write secret (`control_root`, CORD-02 §2) —
   * held only by the owner and staff, delivered on promotion inside the
   * staff-making Grant (CORD-04 §3) or in a 136-byte base rekey blob
   * (CORD-06 §1). Absent for regular members and on legacy epochs. Possession
   * gates publishing to the Control Plane, never authority.
   */
  controlRoot?: Uint8Array;
  /** Every held root epoch (current + retained priors), newest first. */
  heldRoots: HeldRoot[];
  /** Private-channel keys held (public channels derive from the root). */
  privateChannels: PrivateChannelKey[];
  relays: string[];
  /** Join-time preview name; the metadata fold is the authority. */
  name: string;
  /** The npub whose Refounding minted the current epoch (snapshot authority). */
  refounder?: string;
}

/**
 * A Channel's call coordinates (CORD-07 §1), derived from the same
 * (secret, epoch) that addresses its Chat Plane — so they rotate exactly when
 * the Channel's key does. Every Channel is callable.
 */
export interface VoiceKeys {
  /** The SFU room keypair: `pk` IS the room name, `sk` signs token grants. */
  room: GroupKey;
  /** The raw 32-byte media root; every per-sender frame key derives from it. */
  mediaKey: Uint8Array;
}

/** One channel as the UI consumes it: folded definition + derived stream keys. */
export interface ChannelV2 {
  id: Uint8Array;
  idHex: string;
  name: string;
  isPrivate: boolean;
  /** Sidebar grouping (channelCategory.ts); undefined renders ungrouped. */
  category?: string;
  /** Sidebar position (channelOrder.ts); undefined sorts last, by name. */
  position?: number;
  /**
   * The current epoch's call coordinates — every Channel is callable
   * (CORD-07 §1). A lazy memoized getter on the objects `channelsView`
   * builds: the room keypair costs a point multiplication, so it derives on
   * first read (joining or resolving a call), not on every sidebar rebuild.
   */
  readonly voice: VoiceKeys;
  /**
   * Stream keys across every held epoch, newest first (reads span rekeys).
   * A retired epoch carries its rotation's publish time as `retiredAt` — the
   * decode path refuses anything sealed under it with a later `created_at`.
   */
  streams: Array<{ epoch: bigint; group: GroupKey; retiredAt?: number }>;
  /** The current write coordinate. */
  current: { epoch: bigint; group: GroupKey };
}
