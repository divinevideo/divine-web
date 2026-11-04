/**
 * Concord V2 Guestbook Plane — CORD-02 §5.
 *
 * One stream per Community (community_root-keyed), carrying only membership
 * motion: self-signed Joins/Leaves, authorized Kicks, and refounder-signed
 * post-Refounding snapshots. Off-consensus: nothing in Control or Chat depends
 * on it, so it loads last and can lag without harm.
 *
 * A client folds it by COALESCING flat — one final state per npub (latest
 * entry wins by millisecond time, ties broken by the lower rumor id) — then
 * merges observed authors (anyone seen publishing anywhere in the Community is
 * observably present, forward of their latest departure), minus the Banlist.
 */

import type { NostrEvent } from "nostr-tools/pure";

import { guestbookGroupKey, type GroupKey } from "./derive";
import { citationFromTags, type AuthorityCitation } from "./edition";
import { KIND_JOIN_LEAVE, KIND_KICK, KIND_SEAL_ENCRYPTED, KIND_SNAPSHOT } from "./kinds";
import { buildRumor, openWrap, sealRumor, wrapSeal, type OpenedEvent, type StreamSigner, type Rumor } from "./stream";
import type { CommunityV2 } from "./types";
import { memoSet } from "./boundedMemo";

/** Entries dated further than this ahead of the local clock are dropped outright. */
export const GUESTBOOK_MAX_FUTURE_MS = 60 * 60 * 1000;
/** Snapshot chunk size: 400 members per event (CORD-02 §5). */
export const SNAPSHOT_CHUNK = 400;

// ── Addressing ───────────────────────────────────────────────────────────────

/** Every guestbook stream key across held root epochs, newest first. */
export function guestbookGroups(community: CommunityV2): GroupKey[] {
  return community.heldRoots.map((r) => guestbookGroupKey(r.key, community.id, r.epoch));
}

/** The CURRENT guestbook stream key (where new entries publish). */
export function currentGuestbookGroup(community: CommunityV2): GroupKey {
  return guestbookGroupKey(community.root, community.id, community.rootEpoch);
}

/**
 * The npubs whose Refoundings minted the epochs this client holds — the
 * snapshot authorities for the guestbooks {@link guestbookGroups} sweeps
 * (CORD-02 §5).
 *
 * Genesis (epoch 0) has no snapshot, so it contributes no authority. An epoch
 * whose refounder was never recorded (adopted before `HeldRoot.refounder`
 * existed) contributes none either: accepting NO snapshot is the safe miss —
 * §5 heals it by observation and by the member's own unsuppressable Join —
 * whereas falling back to the owner would let an npub who never minted an
 * epoch seed arbitrary members into it.
 */
export function snapshotAuthorities(community: CommunityV2): Set<string> {
  const out = new Set<string>();
  for (const r of community.heldRoots) {
    if (r.epoch > 0n && r.refounder) out.add(r.refounder);
  }
  if (community.rootEpoch > 0n && community.refounder) out.add(community.refounder);
  return out;
}

// ── Builders ─────────────────────────────────────────────────────────────────

/** A self-signed Join, optionally attributing the invite link used (CORD-05 §1). */
export function buildJoinRumor(pubkey: string, ms: number, attribution?: { creator: string; label?: string }): Rumor {
  const tags: string[][] = [];
  if (attribution) tags.push(["invite", attribution.creator, attribution.label ?? ""]);
  return buildRumor({ kind: KIND_JOIN_LEAVE, content: "join", tags, pubkey, ms });
}

/** A self-signed Leave. */
export function buildLeaveRumor(pubkey: string, ms: number): Rumor {
  return buildRumor({ kind: KIND_JOIN_LEAVE, content: "leave", tags: [], pubkey, ms });
}

/**
 * An admin-signed Kick, naming its target and citing the Grant it acts under
 * (the `vac`, CORD-04 §5). Honored only if the signer holds KICK and strictly
 * outranks the target.
 */
export function buildKickRumor(
  adminPubkey: string,
  targetHex: string,
  ms: number,
  vac?: { eid: string; version: bigint; hash: string },
): Rumor {
  const tags: string[][] = [["p", targetHex]];
  if (vac) tags.push(["vac", vac.eid, vac.version.toString(), vac.hash]);
  return buildRumor({ kind: KIND_KICK, content: "", tags, pubkey: adminPubkey, ms });
}

/**
 * Refounder-signed snapshot rumors seeding a new epoch's Guestbook: present
 * members only, chunked at {@link SNAPSHOT_CHUNK}, all chunks sharing one
 * snapshot id and one timestamp (CORD-02 §5).
 */
export function buildSnapshotRumors(refounderPubkey: string, members: string[], snapshotIdHex: string, ms: number): Rumor[] {
  const chunks: string[][] = [];
  for (let i = 0; i < members.length; i += SNAPSHOT_CHUNK) chunks.push(members.slice(i, i + SNAPSHOT_CHUNK));
  if (chunks.length === 0) chunks.push([]);
  const n = chunks.length;
  return chunks.map((chunk, i) =>
    buildRumor({
      kind: KIND_SNAPSHOT,
      content: JSON.stringify(chunk),
      tags: [["snap", snapshotIdHex, (i + 1).toString(), n.toString()]],
      pubkey: refounderPubkey,
      ms,
    }),
  );
}

/** Sign (encrypted seal) + wrap one guestbook rumor. */
export async function sealGuestbook(rumor: Rumor, guestbook: GroupKey, signer: StreamSigner): Promise<NostrEvent> {
  const seal = await sealRumor(rumor, KIND_SEAL_ENCRYPTED, guestbook, signer);
  return wrapSeal(seal, guestbook);
}

// ── Coalesce fold ────────────────────────────────────────────────────────────

export type MemberState = "join" | "leave" | "kick";

export interface CoalescedMember {
  pubkey: string;
  state: MemberState;
  /** Millisecond time of the winning entry. */
  ms: number;
  /** Rumor id of the winning entry (the tiebreak). */
  rumorId: string;
  /** Whether the winning state came from a secondhand snapshot seed. */
  fromSnapshot: boolean;
  /** Invite attribution (Joins only): the link creator + label. */
  invite?: { creator: string; label?: string };
}

/** Open every guestbook wrap that decodes under one of `groups`. Memoized per wrap. */
const openedGuestbookMemo = new Map<string, OpenedEvent | null>();

export function openGuestbookWraps(wraps: NostrEvent[], groups: GroupKey[]): OpenedEvent[] {
  const byPk = new Map(groups.map((g) => [g.pk, g]));
  const out: OpenedEvent[] = [];
  for (const wrap of wraps) {
    const cached = openedGuestbookMemo.get(wrap.id);
    if (cached !== undefined) {
      if (cached) out.push(cached);
      continue;
    }
    const group = byPk.get(wrap.pubkey);
    if (!group) continue;
    let opened: OpenedEvent | null = null;
    try {
      opened = openWrap(wrap, group);
    } catch {
      opened = null;
    }
    memoSet(openedGuestbookMemo, wrap.id, opened);
    if (opened) out.push(opened);
  }
  return out;
}

/**
 * The Guestbook fold input when events are ALREADY opened (from the decrypted
 * opened-event cache). The wrap decrypt happened at ingest; nothing to do but
 * pass them through — kept as a named seam so the read path reads symmetrically
 * with the control plane's `openControlEditions`.
 */
export function openGuestbookOpened(opened: OpenedEvent[]): OpenedEvent[] {
  return opened;
}

/**
 * Coalesce opened guestbook events flat: one final state per npub.
 *
 *   - entries dated > 1h ahead of the local clock are dropped outright;
 *   - a malformed `ms` was already dropped by the stream layer;
 *   - every entry from a `banned` author is dropped — a banned npub's events,
 *     kicks included, are never honored (CORD-04 §4);
 *   - guestbook seals must be encrypted (CORD-02 §5);
 *   - latest wins by ms; ties break by the LOWER rumor id;
 *   - a Kick is honored only when `canKick(actor, target)` (KICK bit + strict
 *     outrank, resolved against the caller's folded roster);
 *   - a snapshot chunk is honored only from a `snapshotAuthorities` npub (a
 *     refounder whose Refounding minted one of the held epochs), and merely
 *     SEEDS an npub's state — any self-signed entry (or authorized kick) newer
 *     than it supersedes it.
 */
export function coalesceGuestbook(
  opened: OpenedEvent[],
  opts: {
    nowMs: number;
    /**
     * KICK bit + strict outrank, PLUS the CORD-04 §5 sync floor: `citation` is
     * the kick's `vac`. A kick is an authority action, so a client whose roster
     * is one sweep stale must not honor one from an already-demoted admin.
     */
    canKick: (actorHex: string, targetHex: string, citation: AuthorityCitation | undefined, atMs: number) => boolean;
    /**
     * The npubs whose Refoundings minted the held epochs (CORD-02 §5: a
     * snapshot "is honored only from the npub whose Refounding minted that
     * epoch"). A SET, because the sweep spans every held epoch's guestbook
     * (`guestbookGroups`) and each was minted by its own refounder — matching
     * only the current one drops every prior epoch's snapshot. Empty/absent
     * honors NO snapshot rather than falling back to the owner.
     *
     * Per-epoch exactness isn't reachable here: which epoch's stream carried a
     * rumor is wire-only (`streamPk`) and deliberately not persisted beside it,
     * and a snapshot rumor doesn't name its own epoch. The residual is that a
     * refounder of one held epoch is accepted on another's snapshot — all of
     * them are npubs that legitimately held that key, and a snapshot only
     * seeds a state any newer firsthand entry supersedes.
     */
    snapshotAuthorities?: ReadonlySet<string>;

    /** Banned npubs (the Banlist fold) — their entries are dropped entirely. */
    banned?: Set<string>;
  },
): Map<string, CoalescedMember> {
  const byMember = new Map<string, CoalescedMember>();

  /** Does `next` beat `prev`? Later ms wins; tie → lower rumor id. A firsthand
   *  entry at the same instant beats a snapshot seed (secondhand). */
  const supersedes = (prev: CoalescedMember | undefined, next: CoalescedMember): boolean => {
    if (!prev) return true;
    if (next.ms !== prev.ms) return next.ms > prev.ms;
    if (prev.fromSnapshot !== next.fromSnapshot) return prev.fromSnapshot;
    return next.rumorId < prev.rumorId;
  };

  const apply = (candidate: CoalescedMember) => {
    const prev = byMember.get(candidate.pubkey);
    if (supersedes(prev, candidate)) byMember.set(candidate.pubkey, candidate);
  };

  for (const ev of opened) {
    if (ev.ms > opts.nowMs + GUESTBOOK_MAX_FUTURE_MS) continue;
    // Encrypted-seal (CORD-02 §5), while the seal form is known; a stored
    // rumor has no envelope and passed this at ingest — see parseEdition.
    if (ev.sealKind !== undefined && ev.sealKind !== KIND_SEAL_ENCRYPTED) continue;
    if (opts.banned?.has(ev.author)) continue;

    if (ev.kind === KIND_JOIN_LEAVE) {
      const verb = ev.content === "join" ? "join" : ev.content === "leave" ? "leave" : undefined;
      if (!verb) continue;
      const inviteTag = verb === "join" ? ev.tags.find((t) => t[0] === "invite") : undefined;
      apply({
        pubkey: ev.author,
        state: verb,
        ms: ev.ms,
        rumorId: ev.rumorId,
        fromSnapshot: false,
        invite: inviteTag?.[1] ? { creator: inviteTag[1], label: inviteTag[2] || undefined } : undefined,
      });
      continue;
    }

    if (ev.kind === KIND_KICK) {
      const target = ev.tags.find((t) => t[0] === "p")?.[1];
      if (!target || !opts.canKick(ev.author, target, citationFromTags(ev.tags), ev.ms)) continue;
      apply({ pubkey: target, state: "kick", ms: ev.ms, rumorId: ev.rumorId, fromSnapshot: false });
      continue;
    }

    if (ev.kind === KIND_SNAPSHOT) {
      if (!opts.snapshotAuthorities?.has(ev.author)) continue;
      let members: unknown;
      try {
        members = JSON.parse(ev.content);
      } catch {
        continue;
      }
      if (!Array.isArray(members)) continue;
      for (const pk of members) {
        if (typeof pk !== "string" || !/^[0-9a-f]{64}$/i.test(pk)) continue;
        apply({
          pubkey: pk.toLowerCase(),
          state: "join",
          ms: ev.ms,
          rumorId: ev.rumorId,
          fromSnapshot: true,
        });
      }
    }
  }

  return byMember;
}

/**
 * The Complete Memberlist: the coalesced Guestbook, merged with OBSERVED
 * authors (an author seen publishing is present, forward of their latest
 * departure), minus the Banlist. `observed` maps author → the newest ms they
 * were seen publishing anywhere in the Community.
 */
export function completeMemberlist(
  coalesced: Map<string, CoalescedMember>,
  observed: Map<string, number>,
  banned: Set<string>,
  bannedAt?: Map<string, number>,
): Set<string> {
  // A Join or activity that predates a member's most recent ban is STALE: a ban
  // is a departure the Guestbook never records (self-removal is network-silent),
  // so on unban an old Join would resurface as a phantom member. `bannedAt` (the
  // control plane's authorized ban history) is in SECONDS; ms compares to it×1000.
  // Activity/Join AFTER the ban still counts — that's a genuine rejoin. (A member
  // offline for the WHOLE ban→unban window never actually left; they're briefly
  // suppressed until they next publish — the `observed` path then re-adds them.)
  const stalePreBan = (pk: string, ms: number): boolean => {
    const at = bannedAt?.get(pk);
    return at !== undefined && ms <= at * 1000;
  };
  const out = new Set<string>();
  for (const [pk, m] of coalesced) {
    if (m.state === "join" && !banned.has(pk) && !stalePreBan(pk, m.ms)) out.add(pk);
  }
  for (const [pk, seenMs] of observed) {
    if (banned.has(pk) || stalePreBan(pk, seenMs)) continue;
    const m = coalesced.get(pk);
    // Observation only counts FORWARD: activity newer than the latest Leave/
    // Kick re-enters them; a departed member's old history never resurrects them.
    if (!m || m.state === "join" || seenMs > m.ms) out.add(pk);
  }
  return out;
}
