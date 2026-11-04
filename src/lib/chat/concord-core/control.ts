/**
 * Concord V2 Control Plane — CORD-02 §5/§6/§9, CORD-04.
 *
 * The Control Plane is one Private Stream per Community carrying versioned,
 * real-npub-signed editions inside PLAINTEXT seals (kind 20014 — the one plane
 * whose seals stay plaintext so a compaction can re-wrap signed editions
 * across epochs). Its stream key is SPLIT (CORD-01 Write-Restricted Streams):
 * the address-and-signer keypair derives from the staff-held `control_root`,
 * while the wraps' content is encrypted under the community_root-derived read
 * key every member holds — a spam gate, never authority. Epochs minted before
 * the split keyed the whole plane by the `concord/control` derivation alone,
 * retained here for reading them (CORD-02 §5).
 *
 * `foldControlState` replays the whole plane into current state in one pass:
 * the owner-rooted roster first (delegation fixpoint — the owner's rank comes
 * from the community_id itself, never from any fold), then every authority-
 * gated entity (metadata, channels, banlist, invite registries).
 */

import type { NostrEvent } from "nostr-tools/pure";

import {
  banlistLocator,
  bytesToHex,
  controlGroupKey,
  controlSignerGroupKey,
  dissolvedGroupKey,
  grantLocator,
  hex32,
  inviteLinksLocator,
  type GroupKey,
  type StreamKeyView,
} from "./derive";
import {
  buildEditionRumor,
  parseEdition,
  toFoldEdition,
  type AuthorityCitation,
  type ParsedEdition,
} from "./edition";
import {
  KIND_SEAL_PLAINTEXT,
  VSK_BANLIST,
  VSK_CHANNEL,
  VSK_DISSOLVED,
  VSK_GRANT,
  VSK_INVITE_REGISTRY,
  VSK_METADATA,
  VSK_PINS,
  VSK_ROLE,
} from "./kinds";
import {
  canActOnMember,
  canActOnPosition,
  emptyRoles,
  grantFromJSON,
  grantToJSON,
  hasPermission,
  highestPosition,
  isAuthorized,
  MAX_ROLES_PER_COMMUNITY,
  outranks,
  Permissions,
  roleFromJSON,
  roleToJSON,
  type CommunityRoles,
  type MemberGrant,
  type Role,
} from "./roles";
import { buildRumor, openWrap, sealRumor, wrapSeal, type OpenedEvent, type StreamSigner, type Rumor } from "./stream";
import { readFolded } from "./vendor/foldedCache";
import { memoSet } from "./boundedMemo";
import {
  utf8Len,
  DESCRIPTION_MAX_BYTES,
  NAME_MAX_BYTES,
  capRelays,
  isImagePointer,
  normalizeChannelMetadata,
  type ChannelMetadata,
  type CommunityMetadata,
  type CommunityV2,
} from "./types";
import { bootstrapHead, bytesEq, fold, type Edition } from "./version";

// ── Addressing ───────────────────────────────────────────────────────────────

/**
 * One held root epoch's Control Plane read view (CORD-02 §5).
 *
 * A SPLIT epoch (the root carries a held `control_pk`) subscribes and verifies
 * by that address while decrypting under the community_root-derived read key;
 * its `sk` is present only when this member holds the epoch's `control_root`
 * and it actually derives to the held address (staff). A LEGACY epoch is the
 * `concord/control` derivation whole — address, signer and encryption in one
 * key every member holds.
 */
function controlStreamOf(community: CommunityV2, rootKey: Uint8Array, epoch: bigint, controlPk?: string): StreamKeyView {
  const read = controlGroupKey(rootKey, community.id, epoch);
  if (!controlPk) return read;
  const signerSk =
    community.controlRoot !== undefined && epoch === community.rootEpoch
      ? controlSignerGroupKey(community.controlRoot, community.id, epoch)
      : undefined;
  return {
    pk: controlPk,
    get convKey() {
      return read.convKey;
    },
    // The reader's half of the write gate: the wrap signature proves a
    // control_root holder published it, so openWrap verifies it (CORD-01
    // Write-Restricted Streams; CORD-02 §5).
    restricted: true,
    // A held secret that does not derive to the held address is corrupt state,
    // not a signer: leave `sk` absent (fail closed to read-only) rather than
    // mint wraps at an address nobody subscribes to.
    ...(signerSk && signerSk.pk === controlPk ? { sk: signerSk.sk } : {}),
  };
}

/** Every control-plane stream view across the community's held root epochs, newest first. */
export function controlGroups(community: CommunityV2): StreamKeyView[] {
  return community.heldRoots.map((r) => controlStreamOf(community, r.key, r.epoch, r.controlPk));
}

/** The CURRENT control-plane stream view (address + read key; `sk` when writable). */
export function currentControlGroup(community: CommunityV2): StreamKeyView {
  return controlStreamOf(community, community.root, community.rootEpoch, community.controlPk);
}

/** Whether this member can PUBLISH to the current Control Plane (CORD-02 §2). */
export function canWriteControl(community: CommunityV2): boolean {
  return currentControlGroup(community).sk !== undefined;
}

/**
 * The CURRENT control-plane WRITE key: address, signing secret and read
 * conv_key. Throws when the epoch is split and this member does not hold its
 * `control_root` — publishing there would mint a wrap that fails the plane's
 * signature check at every reader and relay (CORD-02 §2).
 */
export function currentControlWriteGroup(community: CommunityV2): GroupKey {
  const stream = currentControlGroup(community);
  const sk = stream.sk;
  if (sk === undefined) {
    throw new Error("Only community staff hold this community's write key; ask a moderator to re-send it.");
  }
  return {
    sk,
    pk: stream.pk,
    get convKey() {
      return stream.convKey;
    },
  };
}

// ── Sealing / opening ────────────────────────────────────────────────────────

/** Sign (plaintext seal) + wrap one edition rumor for the control stream. */
export async function sealEdition(rumor: Rumor, control: GroupKey, signer: StreamSigner): Promise<NostrEvent> {
  const seal = await sealRumor(rumor, KIND_SEAL_PLAINTEXT, control, signer);
  return wrapSeal(seal, control);
}

/**
 * Decode-once memo for opened+parsed control editions, keyed by wrap id. The
 * roster/metadata/banlist consumers re-fold on every mount and poll; a wrap's
 * decryption + seal verify is immutable, so parse each exactly once per
 * session. `null` remembers a failure (not ours / malformed) so it isn't
 * retried either.
 */
const parsedEditionMemo = new Map<string, ParsedEdition | null>();

/** Open every control wrap that decodes under one of `groups` into editions. */
export function openControlWraps(wraps: NostrEvent[], groups: StreamKeyView[]): ParsedEdition[] {
  const byPk = new Map(groups.map((g) => [g.pk, g]));
  const out: ParsedEdition[] = [];
  for (const wrap of wraps) {
    const cached = parsedEditionMemo.get(wrap.id);
    if (cached !== undefined) {
      if (cached) out.push(cached);
      continue;
    }
    const group = byPk.get(wrap.pubkey);
    if (!group) continue; // an epoch we don't hold — leave uncached (a caught-up rekey may open it)
    let parsed: ParsedEdition | null = null;
    try {
      parsed = parseEdition(openWrap(wrap, group));
    } catch {
      parsed = null;
    }
    memoSet(parsedEditionMemo, wrap.id, parsed);
    if (parsed) out.push(parsed);
  }
  return out;
}

/**
 * Parse already-OPENED control events (from the decrypted opened-event cache)
 * into editions. The wrap decrypt + seal verify happened at ingest; this only
 * extracts the edition machinery. Memoized per rumor id, so re-folds are cheap.
 */
export function openControlEditions(opened: OpenedEvent[]): ParsedEdition[] {
  const out: ParsedEdition[] = [];
  for (const ev of opened) {
    const cached = parsedEditionMemo.get(ev.rumorId);
    if (cached !== undefined) {
      if (cached) out.push(cached);
      continue;
    }
    let parsed: ParsedEdition | null = null;
    try {
      parsed = parseEdition(ev);
    } catch {
      parsed = null;
    }
    memoSet(parsedEditionMemo, ev.rumorId, parsed);
    if (parsed) out.push(parsed);
  }
  return out;
}

// ── Edition builders ─────────────────────────────────────────────────────────

interface BuildCommon {
  actorPubkey: string;
  version: bigint;
  prevHash?: Uint8Array;
  createdAtSecs?: number;
  authority?: AuthorityCitation;
}

/** Community metadata (vsk 0); eid = the community_id. Gated by MANAGE_METADATA. */
export function buildMetadataEdition(communityId: Uint8Array, metadata: CommunityMetadata, o: BuildCommon): Rumor {
  if (utf8Len(metadata.name) > NAME_MAX_BYTES) throw new Error(`community name exceeds ${NAME_MAX_BYTES} bytes`);
  if (metadata.description !== undefined && utf8Len(metadata.description) > DESCRIPTION_MAX_BYTES) {
    throw new Error(`description exceeds ${DESCRIPTION_MAX_BYTES} bytes`);
  }
  return buildEditionRumor({ vsk: VSK_METADATA, entityId: communityId, content: JSON.stringify(metadata), ...o });
}

/** Role (vsk 1); eid = the role_id. Gated by MANAGE_ROLES. */
export function buildRoleEdition(role: Role, o: BuildCommon): Rumor {
  if (utf8Len(role.name) > NAME_MAX_BYTES) throw new Error(`role name exceeds ${NAME_MAX_BYTES} bytes`);
  // CORD-04 §3: position 0 is the owner's alone — "no Role may ever claim
  // position 0, or an owner could create a peer nobody outranks". Refused
  // here, like the name cap, so a malformed mint fails at its author rather
  // than being dropped by every verifier after it lands.
  if (!Number.isInteger(role.position) || role.position < 1) {
    throw new Error("role position must be an integer of 1 or greater (position 0 is the owner's)");
  }
  return buildEditionRumor({ vsk: VSK_ROLE, entityId: hex32(role.roleId), content: roleToJSON(role), ...o });
}

/** Channel metadata (vsk 2); eid = the channel_id. Gated by MANAGE_CHANNELS. */
export function buildChannelEdition(channelId: Uint8Array, metadata: ChannelMetadata, o: BuildCommon): Rumor {
  if (utf8Len(metadata.name) > NAME_MAX_BYTES) throw new Error(`channel name exceeds ${NAME_MAX_BYTES} bytes`);
  return buildEditionRumor({ vsk: VSK_CHANNEL, entityId: channelId, content: JSON.stringify(metadata), ...o });
}

/** Grant (vsk 3); eid = grant_locator(cid, member). Empty role_ids = a revoke. */
export function buildGrantEdition(communityId: Uint8Array, grant: MemberGrant, o: BuildCommon): Rumor {
  const entityId = grantLocator(communityId, hex32(grant.member));
  return buildEditionRumor({ vsk: VSK_GRANT, entityId, content: grantToJSON(grant), ...o });
}

/** Banlist (vsk 4); eid = banlist_locator(cid). The whole list, replaced entire. */
export function buildBanlistEdition(communityId: Uint8Array, banned: string[], o: BuildCommon): Rumor {
  return buildEditionRumor({
    vsk: VSK_BANLIST,
    entityId: banlistLocator(communityId),
    content: JSON.stringify(banned),
    ...o,
  });
}

/** Invite Registry (vsk 8); eid = invite_links_locator(cid, creator). Locators only. */
export function buildRegistryEdition(communityId: Uint8Array, creatorHex: string, linkSigners: string[], o: BuildCommon): Rumor {
  return buildEditionRumor({
    vsk: VSK_INVITE_REGISTRY,
    entityId: inviteLinksLocator(communityId, hex32(creatorHex)),
    content: JSON.stringify(linkSigners),
    ...o,
  });
}

// ── The one-pass fold ────────────────────────────────────────────────────────

export interface EntityHead {
  version: bigint;
  hash: Uint8Array;
}

/** One channel's folded definition. */
export interface FoldedChannel {
  channelIdHex: string;
  name: string;
  isPrivate: boolean;
  deleted: boolean;
  /** Full normalized metadata, retained so mutations can round-trip extensions. */
  metadata: ChannelMetadata;
}

/**
 * Where a community's folded control snapshot is cached (`foldedCache`).
 *
 * Lives here rather than beside the hook that writes it because non-React
 * code reads it too — the notification-subscription builder, the switcher, and
 * the rumor-store migration, none of which should drag React into their import
 * graph to learn a string.
 */
export const controlFoldKey = (idHex: string) => `concord2-fold:${idHex}`;

/** The Control Plane replayed into current state. */
export interface FoldedControl {
  roster: CommunityRoles;
  /** The proven owner (from the community_id commitment) — position 0, supreme. */
  ownerHex: string;
  metadata?: CommunityMetadata;
  /** channelIdHex → folded definition (deleted channels included, flagged). */
  channels: Map<string, FoldedChannel>;
  banned: Set<string>;
  /** Aggregate live public-invite link signers (the Public/Private source of truth). */
  liveInviteLinks: Set<string>;
  /** creatorHex → that creator's own registry list (for maintaining one's registry). */
  registriesByCreator: Map<string, string[]>;
  /**
   * Pin Lists (vsk 11) by their `pins_locator` eid → the head's RAW content.
   * Content is never decoded here: the sealed form needs a Channel key the
   * fold has no business holding, and a cap-violating or unreadable list reads
   * as EMPTY rather than affecting the fold at all (CORD-04 §7).
   */
  pinLists: Map<string, { content: string; author: string }>;
  /** Per-entity head version + hash, for chaining the next edition (key = eid hex). */
  heads: Map<string, EntityHead>;
  /**
   * The chosen head EDITION per entity (key = eid hex) — carries the
   * re-wrappable plaintext seal a Refounding's compaction republishes.
   */
  headEditions: Map<string, ParsedEdition>;
  /**
   * Floored entities the served set could not account for: gap-held (the
   * chain to our floor is withheld), or with zero served editions at all. A
   * data-availability signal ONLY — an entity that was served but
   * authority-rejected (stripped, banned) is deliberately absent, not listed.
   * A Refounding MUST NOT compact while non-empty (CORD-06 §3
   * fold-all-or-abort), or the entities listed here are silently dropped from
   * the new epoch.
   */
  incomplete: string[];
  /**
   * npub → the created_at (SECONDS) of the newest AUTHORIZED banlist edition
   * that named them. A member's Guestbook Join that predates their most recent
   * ban is a stale membership: a ban is a departure the Guestbook never records
   * (self-removal is network-silent), so without this an unbanned member's old
   * Join resurfaces as a phantom on the roster. Derived from the same authority
   * gate as `banned`, so a forged banlist can't backdate-suppress a member.
   */
  bannedAt: Map<string, number>;
}

/**
 * Whether a snapshot decoded off disk still has the shape this build reads.
 *
 * `readFolded` rehydrates JSON behind an unchecked `as T`, so a snapshot written
 * by an older build arrives TYPED as current and is then dereferenced as
 * current. That is not hypothetical: {@link FoldedChannel.metadata} was added
 * after this cache already existed, and the readers came later still —
 * `channelsView` reads `def.metadata.custom` unguarded, so an older snapshot
 * threw during the boot render, and a moderator's next reorder would have built
 * its edition from a metadata object that isn't there.
 *
 * Checked at the boundary rather than patched at each reader, because the fold
 * is a pure cache: rejecting it costs one re-fold from editions already on
 * disk, and the next {@link writeFolded} replaces the entry under the same key,
 * so there is nothing to migrate and nothing left behind. Extend this when the
 * persisted shape gains a field readers assume is there.
 */
export function isCurrentFoldedControl(value: unknown): value is FoldedControl {
  const fold = value as FoldedControl | undefined;
  if (!fold || !(fold.channels instanceof Map) || !(fold.heads instanceof Map)) return false;
  // Every Map the fold carries has to be checked, not a representative sample:
  // a snapshot from a build that predates a field passes every check that
  // field is missing from, and then throws on first read. `pinLists` arrived
  // after `channels` and `heads`, and a snapshot without it must be a MISS
  // rather than an empty list — an empty pin list reads as "nothing pinned",
  // which would let a write replace entries it never saw (CORD-04 §7).
  if (!(fold.pinLists instanceof Map)) return false;
  for (const def of fold.channels.values()) {
    if (!def || typeof def.metadata !== "object" || def.metadata === null) return false;
  }
  return true;
}

/**
 * A community's cached control fold, or undefined on a miss OR a snapshot this
 * build can't read. Every reader of the persisted fold goes through here.
 */
export async function readControlFold(idHex: string): Promise<FoldedControl | undefined> {
  const folded = await readFolded<FoldedControl>(controlFoldKey(idHex));
  return isCurrentFoldedControl(folded) ? folded : undefined;
}

function pushEdition(m: Map<string, ParsedEdition[]>, key: string, p: ParsedEdition) {
  const list = m.get(key);
  if (list) list.push(p);
  else m.set(key, [p]);
}

/**
 * Fold one entity's editions into an ORDERED candidate list:
 *
 *   1. the chain-verified fold head first (refuse-downgrade, contiguity — the
 *      steady-state answer, and the compaction case too: a re-wrapped head
 *      with a dangling `prev` is still the lowest-anchored walk's top);
 *   2. then EVERY remaining edition, version-DESCENDING (equal versions by
 *      rumor id, the fold's tiebreak winner first) — the candidates a client
 *      may accept when (and only when) a higher-priority candidate fails the
 *      caller's authority gate. "The highest authority-verified head"
 *      (CORD-04 §1) requires gating before choosing, or a forger could
 *      suppress a legit entity with garbage at a higher (or dangling lower)
 *      version.
 *
 * Equal-version fork SIBLINGS are all kept: the tiebreak (lower rumor id) is
 * grindable, so evicting the loser here would let an id-mined fork of the
 * chain tip suppress the real edition before any authority gate ever saw it
 * (an unauthorized banlist fork emptying the banlist, a low-rank grant fork
 * revoking an admin). The tiebreak orders siblings; the gate decides.
 *
 * The caller picks the first candidate that passes its gate and records it in
 * `heads`.
 *
 * `floor` is a TRACKING client's last-accepted head for this entity (from the
 * prior fold's snapshot). When present and the served editions don't link
 * contiguously up to it (a hostile relay withholding the middle of the chain),
 * the fold reports a GAP: a synced client must fail closed and NOT downgrade to
 * the dangling head (CORD-04 §1). We drop every candidate strictly above the
 * floor in that case, so the entity holds at its last-known-good head and
 * refetches. A FRESH joiner (no floor) still accepts the highest head despite a
 * dangling `prev` — that is the legitimate compaction bootstrap.
 *
 * `snapshot` is the subset of editions wrapped under the CURRENT epoch's
 * control group, passed once the community has Refounded at least once. A
 * Refounding compacts every head into the new epoch (CORD-06 §3), so the
 * current epoch is self-contained and readable-but-superseded fragments from
 * older epochs must not outrank it. The snapshot folds by BOOTSTRAP
 * (highest signed version, floor as version-only refuse-downgrade), NEVER the
 * chain walk: behind a compaction, dangling `prev`s are normal, and — since
 * seal signatures survive re-wrap — any group-key holder can re-serve a real
 * OLD edition under the current group. Version anchoring is what bounds that:
 * a re-wrap cannot raise the version inside the signed seal, so a re-served
 * stale edition always loses to the compacted head. Old-epoch editions remain
 * fallback candidates for the authority gate.
 */
function headCandidates(
  editions: ParsedEdition[],
  floor?: EntityHead,
  snapshot?: ParsedEdition[],
  onGap?: () => void,
): ParsedEdition[] {
  const ordered: ParsedEdition[] = [];
  const seenRumors = new Set<string>();
  let gapped = false;

  if (snapshot) {
    // Compaction-era arm. Snapshot presence selects the ARM; version selects
    // the HEAD — over ALL editions, not the subset. Honest paths are identical
    // (the compacted head is ≥ every readable old-epoch edition), but bounding
    // the bootstrap to the subset would let colluding relays serve only a
    // stale re-wrap and outrank a higher true head sitting in our own store.
    const idx = bootstrapHead(editions.map(toFoldEdition), floor?.version ?? 0n);
    if (idx !== null) {
      ordered.push(editions[idx]);
      seenRumors.add(bytesToHex(editions[idx].rumorId));
    } else if (floor !== undefined) {
      // Nothing at/above our floor was served: the head we already accepted
      // vanished from the served set — withheld, fail closed.
      gapped = true;
      onGap?.();
    }
  } else {
    const folds: Edition[] = editions.map(toFoldEdition);
    const result = fold(folds, floor?.version ?? 0n, floor?.hash);

    // Tracking client + a gap: the served chain doesn't reach our floor. Refuse
    // to adopt anything above the floor — a withheld-middle attack can't push a
    // higher dangling edition onto a client that already advanced the chain.
    //
    // A null head under a floor is that same withholding by omission: every
    // served edition sat BELOW the floor, so the head we already accepted was
    // not served at all. `fold` reports no gap for it (it skips below-floor
    // editions before it ever looks for a chain), which is why this arm has to
    // name the case itself — the snapshot arm does the same above.
    gapped = floor !== undefined && (result.gap || result.head === null);
    if (gapped) onGap?.();

    // No floor, and the served chain is broken in the middle.
    //
    // `fold` anchors on the LOWEST served version and walks up, stopping at the
    // first discontinuity, so a relay that serves v1 and v3 and withholds v2
    // seats v1 on a client with nothing to compare against. Withholding is
    // enough — no forgery — and the relay therefore picks which authorized
    // edition a fresh client believes: a Banlist before a ban, a Grant before
    // a revoke.
    //
    // Seating the HIGHEST instead is not the fix. It is the wrong answer just
    // as often in the other direction: a rejoiner whose missing middle lives in
    // an epoch they could not read (the CORD-06 §3 case below) would drop a ban
    // that is still in force. Neither end of a chain with a hole in it is
    // knowable from the chain alone — `snapshot` (epoch attribution) is the
    // mechanism that actually resolves this, and when it is absent the fold is
    // guessing whichever way it leans.
    //
    // So leave the seated head alone and stop being SILENT about it: report the
    // hole whenever a higher version was served than the one being seated. With
    // no floor `gapped` stays false, nothing is suppressed, and bootstrap still
    // works — but the caller learns the entity is incomplete and can refetch
    // the middle instead of acting on a state a relay chose for it.
    if (floor === undefined && result.gap && result.head !== null) {
      const highest = bootstrapHead(folds, 0n);
      if (highest !== null && folds[highest].version > folds[result.head].version) onGap?.();
    }

    if (result.head !== null && !gapped) {
      ordered.push(editions[result.head]);
      seenRumors.add(bytesToHex(editions[result.head].rumorId));
    }
  }
  const rest = editions
    .filter((e) => {
      // A compaction re-wrap carries the same rumor — one candidacy per rumor.
      const id = bytesToHex(e.rumorId);
      if (seenRumors.has(id)) return false;
      seenRumors.add(id);
      // Refuse-to-downgrade (CORD-04 §1): "a lower version is ignored, so a
      // relay replaying a stale Grant or a lifted Ban is rejected". A
      // below-floor edition is never a candidate — not even as the last one
      // standing, which is exactly the shape that replay takes. Withholding
      // everything at or above the floor must suspend the entity (it is
      // reported as a gap above, and refetched), never quietly seat the stale
      // state the attacker chose to serve.
      if (floor !== undefined && e.version < floor.version) return false;
      // Under a gap, suppress every candidate above the floor too: only the
      // floor's own version (a re-served head we can still verify against our
      // snapshot) remains admissible, so the entity never downgrades to a
      // dangling head either.
      if (gapped && e.version > floor!.version) return false;
      // ...and "verify against our snapshot" has to actually verify. Without
      // this the surviving floor-version candidate was merely the lowest rumor
      // id at that version, so an equal-version FORK — same version, different
      // content, grindable id — silently replaced the head we had already
      // accepted, and `pickHead` then recorded the fork's hash as the new
      // floor. A re-served head is admissible; a different edition wearing its
      // version number is not.
      if (gapped && !bytesEq(e.selfHash, floor!.hash)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.version !== b.version) return a.version > b.version ? -1 : 1;
      return bytesToHex(a.rumorId) < bytesToHex(b.rumorId) ? -1 : 1;
    });
  ordered.push(...rest);
  return ordered;
}

/**
 * Pick the first candidate passing `gate`; record it as the entity's head.
 *
 * `rankOf` breaks an equal-version tie by authority, and every gated entity
 * passes it. Without it the tie fell to the candidate order, whose last term is
 * the rumor id — a hash of content the publisher chooses, so it can be ground.
 * That let any holder of the relevant bit fork the owner's edition at the same
 * version and mine an id that sorted first: a community's name or a channel's
 * definition overwritten indefinitely, by someone who could not have replaced
 * that edition on authority. `authorizeDelegation` already orders roles and
 * grants this way; this is the same rule for the entities it does not cover.
 *
 * Only the tie is affected. Version ordering, the refuse-to-downgrade floor and
 * the gap rules are settled in `headCandidates` before anything gets here.
 */
function pickHead(
  candidates: ParsedEdition[],
  heads: Map<string, EntityHead>,
  headEditions: Map<string, ParsedEdition>,
  gate: (p: ParsedEdition) => boolean,
  rankOf: (author: string) => number,
): ParsedEdition | undefined {
  let head: ParsedEdition | undefined;
  for (const p of candidates) {
    if (!gate(p)) continue;
    if (head === undefined) {
      head = p;
      continue;
    }
    // Candidates arrive version-descending, so once the version drops below the
    // first passing one there is nothing left that could outrank it.
    if (p.version !== head.version) break;
    if (rankOf(p.author) < rankOf(head.author)) head = p;
  }
  if (head === undefined) return undefined;
  heads.set(bytesToHex(head.entityId), { version: head.version, hash: head.selfHash });
  headEditions.set(bytesToHex(head.entityId), head);
  return head;
}

/** Order role/grant candidates oldest version first (the admissibility walk). */
function byVersionAsc(a: { parsed: ParsedEdition }, b: { parsed: ParsedEdition }): number {
  return a.parsed.version < b.parsed.version ? -1 : a.parsed.version > b.parsed.version ? 1 : 0;
}

/** Version-ascending groups; equal-version fork siblings share a group. */
function versionGroups<T extends { parsed: ParsedEdition }>(candidates: T[]): T[][] {
  const groups: T[][] = [];
  for (const c of [...candidates].sort(byVersionAsc)) {
    const last = groups[groups.length - 1];
    if (last && last[0].parsed.version === c.parsed.version) last.push(c);
    else groups.push([c]);
  }
  return groups;
}

/**
 * The delegation fixpoint (CORD-04 §2): start with the owner authorized (their
 * rank comes from the community_id, not any fold), then admit role/grant
 * entities whose signer is authorized to make them, repeating until stable.
 * Per entity the ORDERED candidates are tried in turn and the first authorized
 * one settles it, so a forger's garbage edition can't suppress a legit head.
 * Anything whose signer never becomes authorized is dropped (the
 * self-promotion / forged-delegation defense).
 *
 * Editing is ACTING ON A TARGET (CORD-04 §5): besides outranking what an
 * edition hands out, a non-owner signer must strictly outrank what it REPLACES
 * — the standing role position, or the rank a grant's predecessor conferred —
 * or a revoke (empty role_ids) / demotion would be free to anyone. Each
 * entity's candidates are walked version-ascending so the "standing" state is
 * itself an admissible edition, never a forger's plant. Equal-version fork
 * siblings settle to ONE winner per version, highest authority first — the
 * grindable rumor-id tiebreak never lets a lower rank evict its superior's
 * edition.
 *
 * The fold must be a function of the edition SET, never its arrival order:
 * entities are processed in sorted-eid order, and an entity DEFERS while any
 * state its gate reads is still pending — a handed-out role definition, or a
 * candidate author's own rank source (their grant entity). A stalled fixpoint
 * freezes those deferrals one at a time (a still-pending dependency is then
 * provably dead or cyclic), so it always terminates.
 */
function authorizeDelegation(
  roleCandidates: Map<string, Array<{ role: Role; author: string; parsed: ParsedEdition }>>,
  grantCandidates: Map<string, Array<{ grant: MemberGrant; author: string; parsed: ParsedEdition }>>,
  communityId: Uint8Array,
  ownerHex: string,
  heads: Map<string, EntityHead>,
  headEditions: Map<string, ParsedEdition>,
): CommunityRoles {
  const roster = emptyRoles();
  const settledRoles = new Set<string>();
  const settledGrants = new Set<string>();
  // Deterministic processing order — never keyed to edition arrival.
  const roleEids = [...roleCandidates.keys()].sort();
  const grantEids = [...grantCandidates.keys()].sort();
  // member → their grant entity: the rank source the author-deferral watches.
  const grantEidOfMember = new Map<string, string>();
  for (const [eid, cands] of grantCandidates) {
    if (cands.length > 0) grantEidOfMember.set(cands[0].grant.member, eid);
  }
  // The CORD-04 §5 sync floor, for the delegation chain itself. A Role or Grant
  // edition is an authority action like any other, so a non-owner must name the
  // Grant it acts under — otherwise a client whose roster is one sweep stale
  // honors a promotion (or a demotion) issued by an admin already stripped of
  // MANAGE_ROLES.
  //
  // Resolved against the heads settled by THIS pass, not a pre-built candidate
  // index. Owner-rooted grants settle first (the owner cites nothing), which
  // unlocks the admins' citations on a later round, so the fixpoint bootstraps
  // itself and no circularity arises.
  const citedOk = (p: ParsedEdition): boolean =>
    citationSatisfied({ heads, ownerHex }, communityId, p.author, p.authority);

  let changed = true;
  // While false, a grant handing out a role that still has unsettled candidates
  // WAITS (that role may yet reach the roster and set the standing rank). Once
  // the fixpoint can settle no more roles, the flag flips: any still-unsettled
  // role is provably dead, so the grants blocked only on dead roles resolve
  // (and drop, since a dead role confers nothing) instead of hanging forever.
  let rolesFrozen = false;
  // While false, an entity with a candidate whose author's own grant entity is
  // unsettled WAITS — the author's rank decides that candidate's admissibility,
  // so settling early would key the roster to edition ARRIVAL order (a real
  // admin's revoke dropped because their grant folded later). Flipped only
  // after a stall with roles already frozen: what's left is dead or a genuine
  // revocation cycle, resolved in sorted-eid order (deterministic either way).
  let ranksFrozen = false;

  const settle = (p: ParsedEdition) => {
    heads.set(bytesToHex(p.entityId), { version: p.version, hash: p.selfHash });
    headEditions.set(bytesToHex(p.entityId), p);
  };

  /** Is a non-owner author's rank still undetermined (their grant entity pending)? */
  const rankPending = (author: string, selfEid?: string): boolean => {
    if (author === ownerHex) return false;
    const aeid = grantEidOfMember.get(author);
    // An entity never waits on itself: a self-grant's only possible rank source
    // is the entity being decided, which is exactly the self-promotion the
    // fixpoint exists to drop.
    return aeid !== undefined && aeid !== selfEid && !settledGrants.has(aeid);
  };

  /**
   * Equal-version fork siblings, highest authority first: the owner, then rank
   * (lower position), then the fold's rumor-id tiebreak. The id is grindable;
   * authority is not — so a fork can only displace an edition its author could
   * have overwritten anyway.
   */
  const authorityFirst = (a: { author: string; parsed: ParsedEdition }, b: { author: string; parsed: ParsedEdition }): number => {
    const rank = (author: string) => (author === ownerHex ? -1 : (highestPosition(roster, author) ?? Number.MAX_SAFE_INTEGER));
    const ra = rank(a.author);
    const rb = rank(b.author);
    if (ra !== rb) return ra - rb;
    const ia = bytesToHex(a.parsed.rumorId);
    const ib = bytesToHex(b.parsed.rumorId);
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  };

  while (changed) {
    changed = false;

    // Roles: the owner may define any role (position ≥ 1 — the top is not
    // mintable, enforced at parse); a non-owner needs MANAGE_ROLES, must
    // strictly outrank the position they mint, AND must strictly outrank the
    // standing position they replace (no repositioning a role above you).
    for (const eid of roleEids) {
      if (settledRoles.has(eid)) continue;
      const candidates = roleCandidates.get(eid)!;
      if (!ranksFrozen && candidates.some((c) => rankPending(c.author))) continue;
      const admissible = new Set<ParsedEdition>();
      let standing: number | undefined; // the admissible predecessor's position
      for (const group of versionGroups(candidates)) {
        for (const { role, author, parsed } of [...group].sort(authorityFirst)) {
          const mintOk = author === ownerHex || canActOnPosition(roster, author, ownerHex, role.position, Permissions.MANAGE_ROLES);
          const replaceOk = author === ownerHex || standing === undefined || outranks(roster, author, ownerHex, standing);
          if (!mintOk || !replaceOk || !citedOk(parsed)) continue;
          admissible.add(parsed);
          standing = role.position;
          break; // one winner per version — a fork sibling can't sidestep it
        }
      }
      // The fold's candidate priority (chain-verified head first), gated.
      const pick = candidates.find((c) => admissible.has(c.parsed));
      if (!pick) continue;
      roster.roles.push(pick.role);
      settledRoles.add(eid);
      settle(pick.parsed);
      changed = true;
    }

    // Grants: a non-owner needs MANAGE_ROLES, must strictly outrank every
    // Role handed out, AND must strictly outrank the target's standing rank —
    // a revoke (empty role_ids) or demotion acts ON the member (CORD-04 §5/§6),
    // so it is never free to a lower rank (or to no rank at all).
    //
    // The standing walk reads role POSITIONS and author RANKS, so a grant may
    // only settle once every role its candidates hand out AND every candidate
    // author's own grant entity has stopped being PENDING. Otherwise a
    // predecessor handing out a not-yet-settled role would compute an empty
    // `standing` (a low-rank revoke chained behind it settling vacuously), and
    // a not-yet-ranked author's legitimate revoke would drop as inadmissible —
    // either way the very holes the gate closes, re-opened by fold ORDER.
    for (const eid of grantEids) {
      if (settledGrants.has(eid)) continue;
      const candidates = grantCandidates.get(eid)!;
      // A referenced role is unresolved iff it still has live role candidates
      // that haven't settled; such a grant entity waits for a later pass — but
      // only until roles are frozen (past that, an unsettled role is dead).
      const rolePending = (rid: string) => roleCandidates.has(rid) && !settledRoles.has(rid);
      if (!rolesFrozen && candidates.some((c) => c.grant.roleIds.some(rolePending))) continue;
      if (!ranksFrozen && candidates.some((c) => rankPending(c.author, eid))) continue;

      const admissible = new Set<ParsedEdition>();
      let standing: number | undefined; // the rank the admissible predecessor conferred
      for (const group of versionGroups(candidates)) {
        for (const { grant, author, parsed } of [...group].sort(authorityFirst)) {
          const positions = grant.roleIds
            .map((rid) => roster.roles.find((r) => r.roleId === rid)?.position)
            .filter((p): p is number => p !== undefined);
          const allKnown = positions.length === grant.roleIds.length;
          const ok =
            author === ownerHex ||
            (allKnown &&
              hasPermission(roster, author, Permissions.MANAGE_ROLES) &&
              positions.every((pos) => outranks(roster, author, ownerHex, pos)) &&
              (standing === undefined || outranks(roster, author, ownerHex, standing)));
          if (!ok || !citedOk(parsed)) continue;
          admissible.add(parsed);
          standing = positions.length ? Math.min(...positions) : undefined;
          break; // one winner per version
        }
      }
      const pick = candidates.find((c) => admissible.has(c.parsed));
      if (!pick) continue;
      roster.grants.push(pick.grant);
      settledGrants.add(eid);
      settle(pick.parsed);
      changed = true;
    }

    // The fixpoint stalled with deferrals still holding entities back: flip
    // one freeze latch (roles first — a rank source may itself be blocked only
    // on a dead role) and let another round resolve them. Each latch only ever
    // moves its gate later and flips once, so termination is preserved.
    if (!changed && !rolesFrozen) {
      rolesFrozen = true;
      changed = true;
    } else if (!changed && !ranksFrozen) {
      ranksFrozen = true;
      changed = true;
    }
  }

  // Deterministic cap: a Community carries at most 100 Roles — fold the 100
  // lowest role_ids and ignore the rest (CORD-04 §2).
  if (roster.roles.length > MAX_ROLES_PER_COMMUNITY) {
    roster.roles.sort((a, b) => (a.roleId < b.roleId ? -1 : a.roleId > b.roleId ? 1 : 0));
    roster.roles = roster.roles.slice(0, MAX_ROLES_PER_COMMUNITY);
  }
  return roster;
}

/** Fold-once memo, keyed on the community + the exact edition set. */
const foldMemo = new Map<string, FoldedControl>();

/**
 * Replay a set of opened control editions into current state. `ownerHex` is
 * the community's proven owner (verified against the id commitment when the
 * membership entry was accepted).
 *
 * Runs in up to two passes: the first fold resolves the Banlist (itself
 * roster-gated), and if any edition was authored by a banned npub the fold
 * re-runs with those editions excluded — a banned npub's authority actions are
 * dropped like every other event of theirs (CORD-04 §4). The first pass's
 * Banlist stays the final word (the owner is never bannable, so the anti-
 * roster can't be used to erase itself).
 */
export function foldControlState(
  editions: ParsedEdition[],
  communityId: Uint8Array,
  ownerHex: string,
  priorHeads?: Map<string, EntityHead>,
  snapshotIds?: Set<string>,
): FoldedControl {
  const cidHex = bytesToHex(communityId);
  const floorSig = priorHeads
    ? [...priorHeads.entries()].map(([k, v]) => `${k}@${v.version}`).sort().join(",")
    : "";
  // snapshotIds is part of the key: attribution can change (a re-wrap arriving)
  // without the edition set changing, and must not serve a stale fold.
  const snapSig = snapshotIds ? [...snapshotIds].sort().join(",") : "";
  // Identified by RUMOR id, not the carrier wrap's: the one thing a re-wrap
  // changes without changing the edition set is attribution, and `snapSig`
  // above already covers that.
  const memoKey = `${cidHex}:${ownerHex}:${floorSig}:${snapSig}:${editions.map((e) => e.opened.rumorId).sort().join(",")}`;
  const hit = foldMemo.get(memoKey);
  // A memo HIT is not free: the key above sorts and joins every edition id in the
  // plane, so a large plane pays O(n log n) of string work per call just to
  // discover it already has the answer. Counted separately so that cost is
  // visible instead of hiding inside the miss.
  if (hit) {
    return hit;
  }

  const first = foldOnce(editions, communityId, ownerHex, priorHeads, snapshotIds);
  // The owner is "supreme and unremovable" (CORD-04 §2), so a Banlist naming
  // them is honored for everyone it validly names and inert as to them. The
  // filter belongs HERE, on the set every reader consumes, not in each reader:
  // "every honest client drops every event from a banned npub" (§4) is applied
  // by the chat fold, the guestbook, the rekey rotator gate, the call roster
  // and the join path, and a rule only some of them apply is one an authorized
  // BAN holder can use to silence the owner in every member's client while the
  // fold still (correctly) honors the owner's authority.
  const banned = new Set([...first.banned].filter((pk) => pk !== ownerHex));
  let result: FoldedControl = banned.size === first.banned.size ? first : { ...first, banned };
  if (banned.size > 0 && editions.some((e) => banned.has(e.author))) {
    // Pass 1 stays authoritative for `incomplete`: pass 2 drops banned authors'
    // editions by SEMANTICS (CORD-04 §4), not data loss — a gap it introduces
    // must not read as "plane unserved" and block the ban→refound flow.
    result = {
      ...foldOnce(editions.filter((e) => !banned.has(e.author)), communityId, ownerHex, priorHeads, snapshotIds),
      banned,
      bannedAt: first.bannedAt,
      incomplete: first.incomplete,
    };
  }

  // Single-entry-per-community cache so the memo doesn't grow unbounded.
  for (const k of foldMemo.keys()) if (k.startsWith(`${cidHex}:`)) foldMemo.delete(k);
  foldMemo.set(memoKey, result);
  return result;
}

/**
 * The community's Public/Private mode, derived (CORD-05 §5): a non-empty
 * aggregate live-link set means Public. Behavior hangs off this — a ban in a
 * Public community is the Banlist alone (a rotation can't sever someone who
 * can re-fetch the refreshed bundle, and it strands every stale link's future
 * joiners on a dead epoch); only a Private ban Refounds (CORD-06 §3).
 *
 * `excludingCreator` evaluates the mode as if that member's registry were
 * already dropped: the target of an in-flight ban loses their links with
 * their authority, so banning the sole link creator still severs.
 */
export function isCommunityPublic(folded: FoldedControl, excludingCreator?: string): boolean {
  for (const [creator, signers] of folded.registriesByCreator) {
    if (creator === excludingCreator) continue;
    if (signers.length > 0) return true;
  }
  return false;
}

/**
 * Whether any live link belongs to someone OTHER than `viewer` — the links a
 * rotation by `viewer` would strand. The rotation gate, refined: a rotator
 * refreshes their OWN bundles atomically with the rotation (they hold every
 * signer_sk), so their links survive any rotation; only a foreign creator's
 * link goes stale, because nobody else can re-post its bundle. So a client
 * must not rotate while a foreign live link exists, and may rotate freely
 * when every live link is its own — even though the community still reads
 * Public (the CORD-05 §5 flag is unchanged by this).
 *
 * `excludingCreators` drops further registries from the view — the target(s)
 * of an in-flight ban, whose links die with their authority.
 */
export function hasForeignLiveLinks(
  folded: FoldedControl,
  viewer: string,
  excludingCreators?: string | string[],
): boolean {
  const excluded = new Set(
    typeof excludingCreators === "string" ? [excludingCreators] : excludingCreators ?? [],
  );
  for (const [creator, signers] of folded.registriesByCreator) {
    if (creator === viewer || excluded.has(creator)) continue;
    if (signers.length > 0) return true;
  }
  return false;
}

/**
 * Whether an actor's `vac` satisfies the CORD-04 §5 sync floor against a folded
 * control plane — the read-side half of an authority action taken OUTSIDE the
 * roster fold (a moderation delete, a kick).
 *
 * COMPLETENESS, NOT AUTHORIZATION. It answers "have I synced enough of this
 * actor's Grant to judge them", never "may they act" — the caller still resolves
 * rank against the CURRENT roster, so citing an old-but-once-valid Grant
 * grandfathers nobody and a since-demoted actor is refused regardless.
 *
 * Deliberately mirrors Vector's `authority_citation_satisfied` case for case;
 * the two clients diverging here means one honors a moderation action the other
 * silently ignores, which is invisible to both sides.
 *
 * NOT usable inside the roster fold itself: on a bootstrap there are no folded
 * heads yet, so gating editions on them refuses every non-owner edition and the
 * roster can never fold at all. The in-fold path indexes grants from the same
 * pass instead (see `citationOk` in {@link foldControlState}).
 */
export function citationSatisfied(
  folded: Pick<FoldedControl, "heads" | "ownerHex">,
  communityId: Uint8Array,
  actorHex: string,
  citation: AuthorityCitation | undefined,
): boolean {
  // The owner is proven by the community_id itself — no Grant exists to cite.
  if (actorHex === folded.ownerHex) return true;
  if (!citation) return false;
  // It must name the actor's OWN Grant coordinate: citing a foreign edition we
  // happen to hold cannot borrow completeness.
  const eid = bytesToHex(grantLocator(communityId, hex32(actorHex)));
  if (bytesToHex(citation.entityId) !== eid) return false;
  const head = folded.heads.get(eid);
  if (!head) return false;
  // Synced PAST it: the roster check already reflects the later head.
  if (head.version > citation.version) return true;
  // Synced to exactly it: the cited hash must be the edition that won our fold,
  // else they cited a non-canonical fork of their own Grant.
  if (head.version === citation.version) return bytesToHex(head.hash) === bytesToHex(citation.editionHash);
  // BEHIND it — we cannot confirm the authority, so the action parks and
  // self-heals when the Grant arrives. Fail closed.
  return false;
}

/**
 * Whether banning `targets` should also rotate the keys — judged ONCE for the
 * whole group, because the rotation is: a mass ban excludes every target from
 * a single Refounding, never one rotation per target (each rotation forces
 * every member through another adoption round).
 *
 * Ordinarily no rotation while a foreign live link exists — see
 * {@link hasForeignLiveLinks}; every target's own registry is excluded from
 * that view, since their links die with their authority. `force` overrides,
 * and exists for a ban answering control-plane abuse: there the rotation IS
 * the remedy, because a banlist silences a flooder but leaves them holding the
 * root they mint junk with. Stranding a foreign link (until its creator next
 * opens the app and republishes its bundle) is the lesser harm against an
 * attack that otherwise continues indefinitely.
 */
export function banShouldRotateMany(
  folded: FoldedControl | undefined,
  viewer: string,
  targets: string[],
  force = false,
): boolean {
  if (!folded) return false;
  return force || !hasForeignLiveLinks(folded, viewer, targets);
}

/** Single-target {@link banShouldRotateMany}. */
export function banShouldRotate(
  folded: FoldedControl | undefined,
  viewer: string,
  target: string,
  force = false,
): boolean {
  return banShouldRotateMany(folded, viewer, [target], force);
}

function foldOnce(
  editions: ParsedEdition[],
  communityId: Uint8Array,
  ownerHex: string,
  priorHeads?: Map<string, EntityHead>,
  snapshotIds?: Set<string>,
): FoldedControl {
  const cidHex = bytesToHex(communityId);

  // 1. Group by (vsk, entity).
  const byVsk = new Map<string, Map<string, ParsedEdition[]>>();
  for (const p of editions) {
    let m = byVsk.get(p.vsk);
    if (!m) byVsk.set(p.vsk, (m = new Map()));
    pushEdition(m, bytesToHex(p.entityId), p);
  }

  const heads = new Map<string, EntityHead>();
  const headEditions = new Map<string, ParsedEdition>();
  const gapHeld = new Set<string>();
  /** Ordered head candidates per entity of one vsk (floored per prior head). */
  const candidatesOf = (vsk: string): Map<string, ParsedEdition[]> => {
    const out = new Map<string, ParsedEdition[]>();
    for (const [eid, list] of byVsk.get(vsk) ?? new Map<string, ParsedEdition[]>()) {
      // Current-epoch subset: when any edition of this entity arrived under
      // the current control group, the chain walk anchors there (see
      // headCandidates) — an entity never re-wrapped keeps full-set semantics.
      const snap = snapshotIds ? list.filter((p: ParsedEdition) => snapshotIds.has(bytesToHex(p.rumorId))) : [];
      out.set(
        eid,
        headCandidates(list, priorHeads?.get(eid), snap.length > 0 ? snap : undefined, () => gapHeld.add(eid)),
      );
    }
    return out;
  };

  // 2. Roster (owner-rooted fixpoint) — resolved before any gated entity.
  const roleCandidates = new Map<string, Array<{ role: Role; author: string; parsed: ParsedEdition }>>();
  for (const [eid, candidates] of candidatesOf(VSK_ROLE)) {
    const parsed = candidates
      .map((p) => ({ role: roleFromJSON(p.content), author: p.author, parsed: p }))
      // The entity coordinate must be the role's own id (anti-spoofing).
      .filter((c): c is { role: Role; author: string; parsed: ParsedEdition } =>
        Boolean(c.role && bytesToHex(hex32(c.role.roleId)) === eid),
      );
    if (parsed.length > 0) roleCandidates.set(eid, parsed);
  }
  const grantCandidates = new Map<string, Array<{ grant: MemberGrant; author: string; parsed: ParsedEdition }>>();
  for (const [eid, candidates] of candidatesOf(VSK_GRANT)) {
    const parsed = candidates
      .map((p) => ({ grant: grantFromJSON(p.content), author: p.author, parsed: p }))
      // The coordinate must be the member's grant locator (anti-spoofing).
      .filter((c): c is { grant: MemberGrant; author: string; parsed: ParsedEdition } =>
        Boolean(c.grant && bytesToHex(grantLocator(communityId, hex32(c.grant.member))) === eid),
      );
    if (parsed.length > 0) grantCandidates.set(eid, parsed);
  }
  const roster = authorizeDelegation(roleCandidates, grantCandidates, communityId, ownerHex, heads, headEditions);

  // The `vac` authority-citation check (CORD-04 §5). A non-owner authority
  // action MUST cite the exact Grant it acts under, pinned by (eid, version,
  // hash). A verifier honors it only once it holds that Grant at ≥ the cited
  // version with a MATCHING hash — otherwise the action "parks" (is dropped
  // this fold) rather than being honored on the strength of some other grant.
  // This closes the forged-citation and never-resolves-citation holes: without
  // it the fold ignored `p.authority` entirely and honored any gated action
  // whose author currently resolves as authorized.
  //
  // Resolved against the Grant heads `authorizeDelegation` just settled, via the
  // same `citationSatisfied` the delete, kick and rekey gates use — one rule in
  // one place, mirroring Vector's `authority_citation_satisfied`.
  //
  // "Synced AT LEAST that Grant" (CORD-04 §5) means a LATER head passes. An
  // exact-version index would have dropped an edition whose cited version has
  // since been superseded — and compaction re-wraps only each entity's head, so
  // after a Refounding the superseded versions are gone and every edition citing
  // one would fall out of the fold. That loses a community's name, or its
  // admins, on rotation.
  const citationOk = (p: ParsedEdition): boolean =>
    citationSatisfied({ heads, ownerHex }, communityId, p.author, p.authority);

  /** Authority order for equal-version tiebreaks: owner first, then position. */
  const rankOf = (author: string): number =>
    author === ownerHex ? -1 : (highestPosition(roster, author) ?? Number.MAX_SAFE_INTEGER);

  // 3. Metadata (vsk 0): must be the community's own entity + an authorized actor.
  let metadata: CommunityMetadata | undefined;
  {
    const candidates = candidatesOf(VSK_METADATA).get(cidHex) ?? [];
    const head = pickHead(candidates, heads, headEditions, (p) => {
      if (!isAuthorized(roster, p.author, ownerHex, Permissions.MANAGE_METADATA)) return false;
      if (!citationOk(p)) return false;
      try {
        const parsed = JSON.parse(p.content) as CommunityMetadata;
        // The protocol caps are read-side rules too (CORD-02 §6): an oversize
        // name/description is malformed, not merely impolite.
        if (typeof parsed.name !== "string" || utf8Len(parsed.name) > NAME_MAX_BYTES) return false;
        if (parsed.description !== undefined && (typeof parsed.description !== "string" || utf8Len(parsed.description) > DESCRIPTION_MAX_BYTES)) return false;
        return true;
      } catch {
        return false;
      }
    }, rankOf);
    if (head) {
      const parsed = JSON.parse(head.content) as CommunityMetadata;
      metadata = {
        ...parsed,
        relays: capRelays(Array.isArray(parsed.relays) ? parsed.relays : []),
        icon: isImagePointer(parsed.icon) ? parsed.icon : undefined,
        banner: isImagePointer(parsed.banner) ? parsed.banner : undefined,
      };
    }
  }

  // 4. Channels (vsk 2), each gated by MANAGE_CHANNELS.
  const channels = new Map<string, FoldedChannel>();
  for (const [eid, candidates] of candidatesOf(VSK_CHANNEL)) {
    const channelGate = (p: ParsedEdition): boolean => {
      if (!isAuthorized(roster, p.author, ownerHex, Permissions.MANAGE_CHANNELS)) return false;
      if (!citationOk(p)) return false;
      try {
        const meta = JSON.parse(p.content) as ChannelMetadata;
        return typeof meta.name === "string" && meta.name.length > 0 && utf8Len(meta.name) <= NAME_MAX_BYTES;
      } catch {
        return false;
      }
    };
    const head = pickHead(candidates, heads, headEditions, channelGate, rankOf);
    if (!head) continue;
    const meta = normalizeChannelMetadata(JSON.parse(head.content) as ChannelMetadata);
    // CORD-03 §2: "Deletion is terminal: the id is never reused, clients drop
    // the Channel from display and may discard its keys." Terminal means the
    // HEAD cannot lift it — an authorized, correctly-chained edition clearing
    // the flag is ignored as to deletion (everything else in it still folds).
    //
    // The key-discard permission is what makes this load-bearing rather than
    // cosmetic: members who honored it can never read a resurrected private
    // channel, members who ignored it can, and no rotation heals the split,
    // because every fold agrees the channel is live. So deletion is decided
    // over the whole chain this client accepted, not off the head alone.
    // Gated by the SAME predicate the head was picked with: an unauthorized
    // author's tombstone is not a deletion, or anyone could erase a channel.
    const everDeleted = candidates.some((p) => {
      if (!channelGate(p)) return false;
      try {
        return (JSON.parse(p.content) as ChannelMetadata).deleted === true;
      } catch {
        return false;
      }
    });
    channels.set(eid, {
      channelIdHex: eid,
      name: meta.name,
      isPrivate: meta.private === true,
      deleted: meta.deleted === true || everDeleted,
      metadata: everDeleted ? { ...meta, deleted: true } : meta,
    });
  }

  // 5. Banlist (vsk 4): the one anti-roster; unauthorized head → empty (fail closed).
  const banned = new Set<string>();
  const bannedAt = new Map<string, number>();
  {
    const eid = bytesToHex(banlistLocator(communityId));
    const candidates = candidatesOf(VSK_BANLIST).get(eid) ?? [];
    /** The npubs an edition names, normalized; undefined if it is not a list. */
    const parseList = (p: ParsedEdition): string[] | undefined => {
      let list: unknown;
      try {
        list = JSON.parse(p.content);
      } catch {
        return undefined;
      }
      if (!Array.isArray(list)) return undefined;
      return list
        .filter((pk): pk is string => typeof pk === "string" && /^[0-9a-f]{64}$/i.test(pk))
        .map((pk) => pk.toLowerCase());
    };

    /**
     * Holding BAN is not authority over everyone. Banning is acting on a
     * member, so it takes the bit AND a strict outrank — the same rule kicks
     * go through (`canKick`) and grants go through (the standing-rank walk).
     * The gate used to ask only for the bit, which let a stock Moderator, who
     * holds BAN at position 2, publish a list naming every position-1 Admin
     * and have every client honor it: the admins land in `banned`, and the
     * re-fold below then drops all of THEIR editions too. `canActOnMember`
     * also refuses the owner as a target, so supremacy needs no special case.
     */
    const entitled = (author: string, pk: string): boolean =>
      canActOnMember(roster, author, ownerHex, pk, Permissions.BAN);

    const wellFormed = (p: ParsedEdition): boolean =>
      isAuthorized(roster, p.author, ownerHex, Permissions.BAN) && citationOk(p) && parseList(p) !== undefined;

    /**
     * Equal-version fork siblings, highest authority first — the same ordering
     * `authorizeDelegation` applies to roles and grants, for the same reason.
     * The rumor id is a hash of content the publisher chooses, so a sibling
     * that ties on version can be ground until it sorts first; rank cannot.
     */
    const banlistAuthorityFirst = (a: ParsedEdition, b: ParsedEdition): number => {
      const ra = rankOf(a.author);
      const rb = rankOf(b.author);
      if (ra !== rb) return ra - rb;
      const ia = bytesToHex(a.rumorId);
      const ib = bytesToHex(b.rumorId);
      return ia < ib ? -1 : ia > ib ? 1 : 0;
    };

    /**
     * Walk the versions ascending, carrying the standing list, and decide each
     * edition against the state it inherits rather than against nothing.
     *
     * Two things fall out that a head-only rule cannot express. An author the
     * standing list already bans is not admissible, which is what stops a
     * banned moderator who still holds BAN from publishing the next version
     * without themselves in it — the ban does not strip the bit, so under the
     * old rule the unban was simply the newest authorized edition and won.
     * And an edition rewrites only the entries its author is entitled to:
     * everything else is carried over, so "the list replaces entire" can no
     * longer be used to lift a ban its author could never have issued.
     */
    const standingAt = new Map<ParsedEdition, Set<string>>();
    const admissible = new Set<ParsedEdition>();
    let standing = new Set<string>();
    for (const group of versionGroups(candidates.map((parsed) => ({ parsed })))) {
      for (const { parsed: p } of [...group].sort((a, b) => banlistAuthorityFirst(a.parsed, b.parsed))) {
        if (!wellFormed(p) || standing.has(p.author)) continue;
        const named = new Set(parseList(p)!.filter((pk) => entitled(p.author, pk)));
        for (const pk of standing) if (!entitled(p.author, pk)) named.add(pk);
        standing = named;
        standingAt.set(p, named);
        admissible.add(p);
        break;
      }
    }

    // The head is still chosen by the existing ordering — the chain decides it,
    // not the version number alone — so the list is read from the state as of
    // whichever edition that is, not from the walk's last step.
    const head = pickHead(candidates, heads, headEditions, (p) => admissible.has(p), rankOf);
    if (head) for (const pk of standingAt.get(head) ?? []) banned.add(pk);

    // Ban history (for phantom-member suppression, see FoldedControl.bannedAt):
    // the newest ADMISSIBLE edition that named each npub, counting only the
    // names its author was entitled to name. Same rules as the head, so a
    // forged or over-reaching banlist can't backdate-suppress a legit member.
    // `createdAt` is seconds. Editions span every held epoch, so the history is
    // as complete as the reader's key set — which, by the compaction
    // correlation, is exactly whenever they also hold the stale Join that would
    // otherwise phantom.
    for (const p of candidates) {
      if (!admissible.has(p)) continue;
      for (const pk of parseList(p)!) {
        if (!entitled(p.author, pk)) continue;
        const prev = bannedAt.get(pk);
        if (prev === undefined || p.createdAt > prev) bannedAt.set(pk, p.createdAt);
      }
    }
  }

  // 6. Invite registries (vsk 8): each creator owns exactly their own list
  // (the coordinate binds to the author), honored only while its author holds
  // CREATE_INVITE. The aggregate active set is the Public/Private source of
  // truth (CORD-05 §5).
  const liveInviteLinks = new Set<string>();
  const registriesByCreator = new Map<string, string[]>();
  for (const [eid, candidates] of candidatesOf(VSK_INVITE_REGISTRY)) {
    const head = pickHead(candidates, heads, headEditions, (p) => {
      if (bytesToHex(inviteLinksLocator(communityId, hex32(p.author))) !== eid) return false;
      if (!isAuthorized(roster, p.author, ownerHex, Permissions.CREATE_INVITE)) return false;
      if (!citationOk(p)) return false;
      try {
        return Array.isArray(JSON.parse(p.content));
      } catch {
        return false;
      }
    }, rankOf);
    if (!head) continue;
    const list = (JSON.parse(head.content) as unknown[]).filter(
      (s): s is string => typeof s === "string" && /^[0-9a-f]{64}$/i.test(s),
    );
    registriesByCreator.set(head.author, list);
    for (const pk of list) liveInviteLinks.add(pk.toLowerCase());
  }

  // 7. Pin Lists (vsk 11), each gated by PIN_MESSAGES (CORD-04 §7). Only the
  // authority question is settled here; the content is carried verbatim, since
  // a violating list reads as empty rather than as a refused edition.
  const pinLists = new Map<string, { content: string; author: string }>();
  for (const [eid, candidates] of candidatesOf(VSK_PINS)) {
    const head = pickHead(candidates, heads, headEditions, (p) => {
      if (!isAuthorized(roster, p.author, ownerHex, Permissions.PIN_MESSAGES)) return false;
      return citationOk(p);
    }, rankOf);
    if (!head) continue;
    pinLists.set(eid, { content: head.content, author: head.author });
  }

  // Data-availability roll-up: gap-held entities, plus floored entities with
  // ZERO served editions this fold. A floored entity whose editions were
  // served but authority-rejected is NOT flagged — that's a deliberate drop
  // (a stripped role, a banned creator's registry, CORD-04 §4), and flagging
  // it would false-abort the very ban→refound flow the gate protects.
  const servedEids = new Set<string>();
  for (const m of byVsk.values()) for (const eid of m.keys()) servedEids.add(eid);
  const incomplete = [...gapHeld];
  for (const eid of priorHeads?.keys() ?? []) {
    if (!servedEids.has(eid) && !gapHeld.has(eid)) incomplete.push(eid);
  }

  const result: FoldedControl = { roster, ownerHex, metadata, channels, banned, bannedAt, liveInviteLinks, registriesByCreator, pinLists, heads, headEditions, incomplete };
  return result;
}

// ── Dissolution (CORD-02 §9) ─────────────────────────────────────────────────


/**
 * Build the owner-dissolution tombstone rumor: chainless (no ev/ep/vac), empty
 * content, `eid` = the community_id. Published at `dissolved_pk`, a coordinate
 * derived from the community_id alone, so every member past or present
 * resolves it.
 *
 * The `eid` binds the tombstone to the community it kills, and MUST. The
 * dissolved plane's key derives from the community_id with no secret input, so
 * anyone holding that public id (it ships in every invite) can derive the
 * keypair, read the plane, and sign at it — the only thing an attacker lacks is
 * an owner-signed vsk-10 rumor. With the frozen §9 all-zero `eid` that rumor
 * names nothing, so an owner's genuine tombstone for community X can be lifted,
 * re-wrapped at the dissolved address of any OTHER community the same owner
 * runs, and kill it permanently — no membership, no keys, and no un-dissolve.
 * Committing the community_id makes a seal minted for X fail the check at Y.
 */
export function buildDissolvedRumor(
  ownerPubkey: string,
  communityId: Uint8Array,
  createdAtSecs?: number,
): Rumor {
  return buildRumor({
    kind: 3308,
    content: "",
    tags: [
      ["vsk", VSK_DISSOLVED],
      ["eid", bytesToHex(communityId)],
    ],
    pubkey: ownerPubkey,
    ms: null,
    createdAtSecs,
  });
}

/** Sign + wrap the dissolution tombstone at the community's dissolved address. */
export async function sealDissolved(communityId: Uint8Array, ownerPubkey: string, signer: StreamSigner): Promise<NostrEvent> {
  const group = dissolvedGroupKey(communityId);
  const rumor = buildDissolvedRumor(ownerPubkey, communityId);
  const seal = await sealRumor(rumor, KIND_SEAL_PLAINTEXT, group, signer);
  return wrapSeal(seal, group);
}

/**
 * Whether any of `wraps` is a valid owner-signed dissolution tombstone for
 * this community. Only the owner's signature counts; an impostor's event at
 * the (findable-by-anyone) address is noise. Terminal: on sight, the client
 * seals the community read-only.
 */
export function isDissolved(wraps: NostrEvent[], communityId: Uint8Array, ownerHex: string): boolean {
  const group = dissolvedGroupKey(communityId);
  for (const wrap of wraps) {
    let opened: OpenedEvent;
    try {
      opened = openWrap(wrap, group);
    } catch {
      continue;
    }
    if (isDissolvedOpened(opened, ownerHex, communityId)) return true;
  }
  return false;
}

/**
 * Whether an already-opened dissolved-address event is a valid owner tombstone
 * FOR THIS COMMUNITY.
 *
 * The `eid` check is the replay binding (see {@link buildDissolvedRumor}), and
 * the address it was found at proves nothing — an attacker chooses where to
 * publish. An all-zero `eid` is REFUSED rather than grandfathered: accepting it
 * is the vulnerability itself, and the failure mode of refusing is a community
 * that reads alive and can simply be re-dissolved, against one that dies
 * permanently with no recovery.
 */
export function isDissolvedOpened(opened: OpenedEvent, ownerHex: string, communityId: Uint8Array): boolean {
  // Authenticated by the SEAL SIGNER being the owner — the stream it arrived at
  // is not an authority claim, since only the owner can sign this wherever it
  // was published. The seal FORM (plaintext, CORD-02 §5) is checked while known;
  // a stored rumor has no envelope and passed at ingest — see parseEdition.
  if (opened.author !== ownerHex) return false;
  if (opened.sealKind !== undefined && opened.sealKind !== KIND_SEAL_PLAINTEXT) return false;
  const vsk = opened.tags.find((t) => t[0] === "vsk")?.[1];
  const eid = opened.tags.find((t) => t[0] === "eid")?.[1];
  return opened.kind === 3308 && vsk === VSK_DISSOLVED && eid === bytesToHex(communityId);
}
