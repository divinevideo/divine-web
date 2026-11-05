/**
 * Concord V2 Community List — CORD-02 §8.
 *
 * A member's memberships sync across devices (and clients) as one kind-13302
 * replaceable event, NIP-44-encrypted to self. Every Community they're in AND
 * every one they've left lives in the document — liveness is DERIVED, never
 * deletion, or merges would depend on gossip order.
 *
 * Per entry, two snapshots solve opposite problems: `seed` holds the EARLIEST
 * epoch ever held (the full-history backfill anchor, only ever moves backward
 * on merge) and `current` the LATEST (instant reconstruction on a fresh
 * device). Tombstones are permanent; the newest of `added_at`/`removed_at`
 * decides liveness, so a re-join legitimately resurrects while a backfill can
 * never re-add a tombstoned id.
 */

import type { Rumor } from "./stream";
import { bytesToHex, controlSignerGroupKey, hex32, verifyCommunityId } from "./derive";

import {
  MAX_LIST_MEMBERSHIPS,
  capRelays,
  type CommunityV2,
  type HeldRoot,
  type PrivateChannelKey,
} from "./types";

/**
 * Join material — the invite bundle's MEMBERSHIP subset (never the icon, never
 * the link fields). Snake_case wire shape; unknown fields are preserved
 * (round-trip discipline, CORD-02 §6). The `held_roots` field is an Armada
 * extension carrying retained prior root epochs so history spanning a
 * Refounding stays readable without a rekey-chain walk.
 */
export interface JoinMaterial {
  community_id: string;
  owner: string;
  owner_salt: string;
  community_root: string;
  root_epoch: number;
  /**
   * The current epoch's Control Plane signer pubkey (CORD-02 §2/§8) — read
   * access to the plane, never write. Absent = a legacy pre-split epoch,
   * whose Control folds at the member-derivable legacy address.
   */
  control_pk?: string;
  /**
   * Armada extension, STAFF ONLY: the current epoch's `control_root` write
   * secret (hex). The list is NIP-44-encrypted to self and already carries the
   * `community_root`, so this is the same trust class — it is how a staffer's
   * write key survives across their own devices. Delivered by a staff-making
   * Grant's `control_wrap` (CORD-04 §3) or a 136-byte base blob (CORD-06 §1).
   */
  control_root?: string;
  /** The PRIVATE channels held (public ones derive from the root — CORD-03). */
  channels: Array<{ id: string; key: string; epoch: number; name: string; priors?: Array<{ key: string; epoch: number; retired_at?: number }> }>;
  relays: string[];
  name: string;
  /**
   * Armada extension: retained prior roots `[{epoch, key}]` (current excluded).
   * `retired_at` (epoch-seconds the superseding rotation published) is the
   * hard read cutoff for that epoch; absent for epochs retired before this
   * client recorded cutoffs. `refounder` names the npub whose Refounding
   * minted that epoch — its Guestbook's snapshot authority (CORD-02 §5).
   * `control_pk` names a split epoch's Control address (absent = legacy).
   */
  held_roots?: Array<{ epoch: number; key: string; retired_at?: number; refounder?: string; control_pk?: string }>;
  /** Armada extension: the npub whose Refounding minted `root_epoch`. */
  refounder?: string;
  [k: string]: unknown;
}

export interface CommunityListEntry {
  community_id: string;
  /** Earliest epoch held — only ever moves BACKWARD on merge. */
  seed: JoinMaterial;
  /** Freshest snapshot — replaced on every Refounding or rename. */
  current: JoinMaterial;
  /** ms; tiebreaks against a tombstone. */
  added_at: number;
  /**
   * The Refounding epoch that EXCLUDED me (a kick/ban rekey that carried no
   * blob for me). Being excluded is NOT leaving: the entry stays LIVE and on
   * the rail, but read-only — my keys can't decrypt this epoch. Cleared
   * automatically when `current.root_epoch` advances past it (a later
   * Refounding re-included me), so re-inclusion needs no explicit reset.
   * Only the user's own Leave or the owner's Dissolve ever removes an icon.
   */
  excluded_at_epoch?: number;
  /**
   * Armada extension: per Private Channel, the CHANNEL epoch whose rotation
   * cut me out (channelAccess.ts revoke, CORD-06 §2). Removal must be monotonic:
   * dropping the key from `current.channels` alone is not enough, because the
   * union merge is additive — an older invite bundle still sitting in my inbox
   * (e.g. from when the channel was ungated and vended to everyone) carries
   * the pre-rotation key and would silently RESTORE access. A cut floors the
   * channel: only a key at or above the cut epoch — a genuine re-admission —
   * is ever accepted again. Max wins on merge; never rolls back.
   */
  channel_cuts?: Array<{ id: string; epoch: number }>;
  /**
   * Armada extension: the invite link this membership was joined through, in
   * the domain-agnostic bare form `<naddr>#<fragment>` (CORD-05 §2/§3). The
   * link's coordinate is stable and its bundle refreshes in place, so a member
   * STRANDED on a superseded epoch (a stale bundle dropped them onto history —
   * see useRekeyWatch2) can re-resolve this same link and merge the refreshed,
   * higher-epoch bundle forward. Self-encrypted like the rest of the list, so
   * carrying the secret fragment here leaks nothing new (the list already
   * holds `community_root`). Absent for direct-invite and creator entries.
   */
  invite_ref?: string;
  [k: string]: unknown;
}

export interface CommunityTombstone {
  community_id: string;
  /** ms. Permanent — pruning would let a long-offline device resurrect a leave. */
  removed_at: number;
  [k: string]: unknown;
}

export interface CommunityList {
  entries: CommunityListEntry[];
  tombstones: CommunityTombstone[];
  [k: string]: unknown;
}

export const EMPTY_COMMUNITY_LIST: CommunityList = { entries: [], tombstones: [] };

/**
 * The Private Channel keys a join-material snapshot holds.
 *
 * `channels` is required by the shape, but the list is a CROSS-CLIENT document
 * (CORD-02 §8) and Private Channels are optional (CORD-03) — a client that
 * vends no keys omits the field. Every reader goes through here so that fact
 * lives in ONE place: read `.channels` off the object and the type promises an
 * array while the wire promises nothing. That matters most in the merge, which
 * is the read-modify-write step of every list write — a throw there fails
 * create, join and leave alike, for as long as the entry sits in the vault.
 */
export function heldChannelKeys(
  channels: JoinMaterial["channels"] | undefined,
): JoinMaterial["channels"] {
  return Array.isArray(channels) ? channels : [];
}

/**
 * The locally cached, already-DECRYPTED community list for one viewer, as
 * persisted in `foldedCache`.
 *
 * Defined here rather than beside the hook that maintains it because it is the
 * only way to enumerate an account's communities without a signer or a relay,
 * which is exactly what the rumor-store migration needs — and it must not have
 * to import React to ask.
 */
export interface PersistedCommunityList {
  event: Rumor | null;
  list: CommunityList;
}

/** Where {@link PersistedCommunityList} is cached, per viewer pubkey. */
export const communityListFoldKey = (pubkey: string) => `concord2-list:${pubkey}`;

// ── Canonical JSON (the total-order tiebreak) ────────────────────────────────

/** JSON with recursively-sorted object keys — a total order for equal-epoch merges. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

// ── Merge (deterministic, commutative, idempotent) ───────────────────────────

/** Higher epoch wins; tie → lexicographically lowest canonical bytes (CORD-02 §8). */
function freshest(a: JoinMaterial, b: JoinMaterial): JoinMaterial {
  if (a.root_epoch !== b.root_epoch) return a.root_epoch > b.root_epoch ? a : b;
  return canonicalJson(a) <= canonicalJson(b) ? a : b;
}

/** Lower epoch wins; tie → lowest canonical bytes. */
function earliest(a: JoinMaterial, b: JoinMaterial): JoinMaterial {
  if (a.root_epoch !== b.root_epoch) return a.root_epoch < b.root_epoch ? a : b;
  return canonicalJson(a) <= canonicalJson(b) ? a : b;
}

/**
 * Union two private-channel key sets by channel id — higher channel epoch
 * wins, tie broken by canonical bytes. Channel epochs advance independently
 * of the root, so a key vended alongside an older root is still current for
 * its channel; the union means a partial vend (one channel's key, e.g. a
 * role-gate grant) can never displace the keys a member already holds.
 * Deterministic, commutative, idempotent — safe inside the list CRDT.
 *
 * Either side may be absent: see {@link heldChannelKeys}.
 */
export function unionChannelKeys(
  a: JoinMaterial["channels"] | undefined,
  b: JoinMaterial["channels"] | undefined,
): JoinMaterial["channels"] {
  const byId = new Map<string, JoinMaterial["channels"][number]>();
  for (const raw of [...heldChannelKeys(a), ...heldChannelKeys(b)]) {
    if (!raw || typeof raw.id !== "string") continue;
    // CORD-01: hex is lowercase — but a merge is fed by other clients'
    // documents, so the spelling is normalized here rather than trusted. Two
    // spellings of one channel must fold to ONE entry, or the copies drift
    // apart forever (and a cut floor keyed on the other spelling never bites).
    const ch = { ...raw, id: raw.id.toLowerCase() };
    const prev = byId.get(ch.id);
    if (!prev) {
      byId.set(ch.id, ch);
      continue;
    }
    if (ch.epoch !== prev.epoch) {
      // The superseded side is KEPT as a prior: it is the key that reads the
      // history written before the rotation, and dropping it here would make
      // a merge silently truncate the conversation.
      const [winner, loser] = ch.epoch > prev.epoch ? [ch, prev] : [prev, ch];
      byId.set(ch.id, withPriorKey(winner, loser));
      continue;
    }
    // Two rotations raced to one channel epoch. CORD-06 converges on a
    // deterministic winner but RETAINS both forks' keys, so whatever was
    // written into the losing branch stays readable — the loser becomes a
    // prior at its own epoch, exactly as a superseded key does.
    if (canonicalJson(ch) < canonicalJson(prev)) byId.set(ch.id, withPriorKey(ch, prev));
    else byId.set(ch.id, withPriorKey(prev, ch));
  }
  return [...byId.values()].sort((p, q) => p.id.localeCompare(q.id));
}

type ChannelKeyEntry = JoinMaterial["channels"][number];
type PriorKey = { key: string; epoch: number; retired_at?: number };

/** Priors of both, plus the loser's own key, deduped by (epoch, key). */
function withPriorKey(winner: ChannelKeyEntry, loser: ChannelKeyEntry): ChannelKeyEntry {
  return attachPriors(winner, [...(loser.priors ?? []), { key: loser.key, epoch: loser.epoch }, ...(winner.priors ?? [])]);
}

function attachPriors(entry: ChannelKeyEntry, priors: PriorKey[]): ChannelKeyEntry {
  const byId = new Map<string, PriorKey>();
  const kept: PriorKey[] = [];
  for (const p of priors) {
    if (!p || typeof p.key !== "string" || typeof p.epoch !== "number") continue;
    if (p.epoch >= entry.epoch && p.key === entry.key) continue; // the current key is not a prior
    const id = `${p.epoch}:${p.key}`;
    const prev = byId.get(id);
    if (prev) {
      // Same key from two documents, only one of which recorded when it was
      // retired: keep the cutoff (dropping it would reopen the epoch for
      // writes on the device that merges the cutoff-less copy).
      if (prev.retired_at === undefined && typeof p.retired_at === "number") prev.retired_at = p.retired_at;
      continue;
    }
    const copy = { ...p };
    byId.set(id, copy);
    kept.push(copy);
  }
  kept.sort((x, y) => y.epoch - x.epoch || x.key.localeCompare(y.key));
  return kept.length > 0 ? { ...entry, priors: kept } : entry;
}

/** Per-channel cut floors, max wins — a removal never rolls back. */
export function mergeChannelCuts(
  a: CommunityListEntry["channel_cuts"],
  b: CommunityListEntry["channel_cuts"],
): CommunityListEntry["channel_cuts"] {
  if (!a?.length && !b?.length) return undefined;
  const byId = new Map<string, number>();
  for (const cut of [...(a ?? []), ...(b ?? [])]) {
    if (!cut || typeof cut.id !== "string" || typeof cut.epoch !== "number") continue;
    const id = cut.id.toLowerCase(); // one spelling per channel (CORD-01)
    const prev = byId.get(id);
    if (prev === undefined || cut.epoch > prev) byId.set(id, cut.epoch);
  }
  if (byId.size === 0) return undefined;
  return [...byId.entries()].map(([id, epoch]) => ({ id, epoch })).sort((p, q) => p.id.localeCompare(q.id));
}

/** Drop channel keys a cut has floored out (epoch below the cut). */
export function applyChannelCuts(
  channels: JoinMaterial["channels"] | undefined,
  cuts: CommunityListEntry["channel_cuts"],
): JoinMaterial["channels"] {
  const held = heldChannelKeys(channels);
  if (!cuts?.length) return held;
  const floor = new Map(cuts.map((c) => [c.id.toLowerCase(), c.epoch]));
  return held.filter((ch) => {
    const cut = floor.get(ch.id.toLowerCase());
    return cut === undefined || ch.epoch >= cut;
  });
}

function mergeEntry(x: CommunityListEntry, y: CommunityListEntry): CommunityListEntry {
  const channelCuts = mergeChannelCuts(x.channel_cuts, y.channel_cuts);
  const current = {
    ...freshest(x.current, y.current),
    // Union first, then floor: a stale bundle can add a key back only if it
    // is at or above the epoch that cut me out.
    channels: applyChannelCuts(unionChannelKeys(x.current.channels, y.current.channels), channelCuts),
  };
  // The higher exclusion epoch wins the merge, but an exclusion only bites
  // while it names an epoch BEYOND what `current` holds: holding the marked
  // epoch's own root is re-inclusion (a later Refounding or a fresh invite
  // for exactly that epoch), so a spent marker is dropped.
  const excludedAt = maxDefined(x.excluded_at_epoch, y.excluded_at_epoch);
  const merged: CommunityListEntry = {
    ...x,
    ...y,
    community_id: x.community_id,
    current,
    seed: earliest(x.seed, y.seed),
    // The newest add wins liveness races against a tombstone, so keep the max.
    added_at: Math.max(x.added_at, y.added_at),
  };
  if (channelCuts) merged.channel_cuts = channelCuts;
  else delete merged.channel_cuts;
  if (excludedAt !== undefined && excludedAt > current.root_epoch) {
    merged.excluded_at_epoch = excludedAt;
  } else {
    delete merged.excluded_at_epoch;
  }
  return merged;
}

/** The larger of two optional numbers, or undefined if neither is set. */
function maxDefined(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
}

/**
 * Deterministically merge two Community Lists. Entries and tombstones both
 * stay in the document; nothing is deleted (liveness is derived).
 */
export function mergeCommunityLists(a: CommunityList, b: CommunityList): CommunityList {
  const entries = new Map<string, CommunityListEntry>();
  for (const e of [...a.entries, ...b.entries]) {
    if (!e || typeof e.community_id !== "string") continue;
    const prev = entries.get(e.community_id);
    entries.set(e.community_id, prev ? mergeEntry(prev, e) : e);
  }
  const tombstones = new Map<string, CommunityTombstone>();
  for (const t of [...a.tombstones, ...b.tombstones]) {
    if (!t || typeof t.community_id !== "string") continue;
    const prev = tombstones.get(t.community_id);
    if (!prev || t.removed_at > prev.removed_at) tombstones.set(t.community_id, t);
  }
  return {
    ...a,
    ...b,
    entries: [...entries.values()].sort((x, y) => x.community_id.localeCompare(y.community_id)),
    tombstones: [...tombstones.values()].sort((x, y) => x.community_id.localeCompare(y.community_id)),
  };
}

/** Whether an entry is live: no tombstone, or the add is newer than the removal. */
export function isLive(list: CommunityList, communityId: string): boolean {
  const entry = list.entries.find((e) => e.community_id === communityId);
  if (!entry) return false;
  const tomb = list.tombstones.find((t) => t.community_id === communityId);
  return !tomb || entry.added_at > tomb.removed_at;
}

/** The live entries (memberships), derived. */
export function liveEntries(list: CommunityList): CommunityListEntry[] {
  return list.entries.filter((e) => isLive(list, e.community_id));
}

/**
 * Whether the member has been EXCLUDED at their current epoch — a kick/ban
 * Refounding they got no key for. The community stays live and on the rail
 * (only Leave/Dissolve remove an icon), but it renders read-only: the member
 * can't decrypt this epoch.
 *
 * The marker names the epoch minted WITHOUT them, so exclusion holds only
 * while that epoch is beyond what they hold — strictly greater. Holding the
 * marked epoch's own root IS re-inclusion, however it arrived: a later
 * Refounding that re-included them, or a fresh invite handing them exactly
 * the epoch they were cut from (an unban + re-invite lands there).
 */
export function isExcluded(entry: CommunityListEntry): boolean {
  return (
    typeof entry.excluded_at_epoch === "number" &&
    entry.excluded_at_epoch > entry.current.root_epoch
  );
}

/** Add/refresh a membership. Pure. */
export function addToList(list: CommunityList, entry: CommunityListEntry): CommunityList {
  return mergeCommunityLists(list, { entries: [entry], tombstones: [] });
}

/** Tombstone a membership (leave/removed). Pure. */
export function removeFromList(list: CommunityList, communityId: string, removedAt: number): CommunityList {
  return mergeCommunityLists(list, { entries: [], tombstones: [{ community_id: communityId, removed_at: removedAt }] });
}

/**
 * Mark a membership EXCLUDED at `epoch` (a kick/ban Refounding I got no blob
 * for). Unlike {@link removeFromList}, this NEVER hides the icon: being kicked
 * is not the same as leaving. The entry stays live and read-only until either
 * a later Refounding re-includes me (auto-clearing the marker) or I choose to
 * leave. Idempotent — a lower/equal epoch never lowers the marker. Pure.
 */
export function markExcluded(list: CommunityList, communityId: string, epoch: number): CommunityList {
  const idx = list.entries.findIndex((e) => e.community_id === communityId);
  if (idx === -1) return list;
  const entries = list.entries.map((e, i) => {
    if (i !== idx) return e;
    // Only bite while >= current epoch; a stale marker below `current` is moot.
    if (epoch < e.current.root_epoch) return e;
    const prior = typeof e.excluded_at_epoch === "number" ? e.excluded_at_epoch : -Infinity;
    return { ...e, excluded_at_epoch: Math.max(prior, epoch) };
  });
  return { ...list, entries };
}

/**
 * Replace a membership's `current` snapshot in place (an authoritative local
 * refresh — e.g. a caught-up Refounding or rename). Bypasses the epoch-keyed
 * `freshest` so a same-epoch update can't silently lose the canonical-bytes
 * tiebreak.
 *
 * Also bumps `added_at` to now: adopting a fresh epoch key is PROOF of current
 * membership, so it must win liveness over any earlier removal tombstone —
 * exactly as a re-join does. Without this, a member excluded in one Refounding
 * (tombstoned) and RE-INCLUDED in a later one keeps their original `added_at`,
 * which stays below `removed_at`, so `isLive` judges the still-valid membership
 * dead and the community silently vanishes from the rail forever.
 *
 * That the bump can resurrect a tombstone is intentional (see
 * communityList.liveness.test.ts), and it is NOT a way for a leave to undo
 * itself: the callers that adopt an epoch — the rekey watcher, a manual
 * Refound — only run for a community whose page is mounted, and
 * `useCommunityEntry2` resolves live memberships only, so a community the
 * user left never arms them. Pure.
 */
export function refreshCurrent(list: CommunityList, current: JoinMaterial, addedAt = Date.now()): CommunityList {
  const idx = list.entries.findIndex((e) => e.community_id === current.community_id);
  if (idx === -1) return list;
  const entries = list.entries.map((e, i) => {
    if (i !== idx) return e;
    const next: CommunityListEntry = { ...e, current, added_at: Math.max(e.added_at, addedAt) };
    // Adopting the marked epoch's key (or any later one) is re-inclusion:
    // drop the spent exclusion marker.
    if (typeof next.excluded_at_epoch === "number" && next.excluded_at_epoch <= current.root_epoch) {
      delete next.excluded_at_epoch;
    }
    return next;
  });
  return { ...list, entries };
}

/**
 * Replace a membership's private-channel set inside `current` — a
 * channel-scope rekey adoption (fresh key at the next channel epoch) or a
 * channel exclusion (the channel dropped so it visibly disappears, CORD-06
 * §2). Unlike {@link refreshCurrent} this NEVER bumps `added_at`: a channel
 * rotation says nothing about community-level membership, and `added_at`
 * feeds the base exclusion-vs-history decision.
 *
 * Merge caveat (CORD-02 §8): `current` snapshots at the same `root_epoch`
 * tie-break on canonical bytes, so a same-root-epoch channel bump can lose a
 * merge to a stale sibling until the watcher re-adopts — deterministic either
 * way, and the rekey events stay fetchable. An excluded channel's original
 * key survives in `seed` for history. Pure.
 */
export function refreshChannels(
  list: CommunityList,
  communityId: string,
  channels: JoinMaterial["channels"],
  /**
   * Channels this update REMOVES because a rotation cut me out, with the
   * channel epoch that did it. Recorded as a floor so no later merge of an
   * older bundle can restore the revoked key (see `channel_cuts`).
   */
  cuts?: CommunityListEntry["channel_cuts"],
): CommunityList {
  const idx = list.entries.findIndex((e) => e.community_id === communityId);
  if (idx === -1) return list;
  const entries = list.entries.map((e, i) => {
    if (i !== idx) return e;
    const channelCuts = mergeChannelCuts(e.channel_cuts, cuts);
    const next: CommunityListEntry = {
      ...e,
      current: { ...e.current, channels: applyChannelCuts(channels, channelCuts) },
    };
    if (channelCuts) next.channel_cuts = channelCuts;
    return next;
  });
  return { ...list, entries };
}

/**
 * Replace a membership's relay set inside `current` — following a Metadata
 * fold whose relay list changed (CORD-02 §6: "clients follow the fold"). The
 * list's copy is bootstrap material for a fresh device; the fold stays the
 * authority, so every device re-derives and re-applies this from its own fold.
 * Like {@link refreshChannels}, NEVER bumps `added_at` (a relay change says
 * nothing about membership) and shares the same same-root-epoch merge caveat:
 * a stale sibling can win the canonical-bytes tiebreak until the watcher
 * re-adopts. `seed` is untouched — it only ever moves backward. Pure.
 */
export function refreshRelays(list: CommunityList, communityId: string, relays: string[]): CommunityList {
  const idx = list.entries.findIndex((e) => e.community_id === communityId);
  if (idx === -1) return list;
  const entries = list.entries.map((e, i) => (i === idx ? { ...e, current: { ...e.current, relays } } : e));
  return { ...list, entries };
}

/**
 * Record the staff write secret for a membership's CURRENT epoch — a
 * `control_wrap` adoption (CORD-04 §3). The caller has already verified the
 * secret derives to the `control_pk` held for exactly this epoch; a stale
 * epoch (the entry advanced while the wrap was in flight) is a no-op. Never
 * bumps `added_at` (holding the write key says nothing about liveness), and
 * shares refreshChannels' same-root-epoch merge caveat: a stale sibling can
 * win the canonical-bytes tiebreak until the watcher re-adopts — the Grant
 * head persists on the plane, so it always can. Pure.
 */
export function setControlRoot(
  list: CommunityList,
  communityId: string,
  epoch: number,
  controlRootHex: string,
): CommunityList {
  const idx = list.entries.findIndex((e) => e.community_id === communityId);
  if (idx === -1) return list;
  const entries = list.entries.map((e, i) => {
    if (i !== idx) return e;
    if (e.current.root_epoch !== epoch || typeof e.current.control_pk !== "string") return e;
    return { ...e, current: { ...e.current, control_root: controlRootHex } };
  });
  return { ...list, entries };
}

/**
 * Enforce the membership cap: the count bounds the common case, the NIP-44
 * byte cap is the law — the caller must ALSO verify the serialized list fits
 * before publishing (CORD-02 §8).
 */
export function assertListBounds(list: CommunityList): void {
  if (liveEntries(list).length > MAX_LIST_MEMBERSHIPS) {
    throw new Error(`the Community List caps at ${MAX_LIST_MEMBERSHIPS} memberships`);
  }
}

// ── Join material ⇄ runtime community ───────────────────────────────────────

/**
 * Rehydrate a runtime {@link CommunityV2} from an entry. Verifies the
 * self-certifying owner commitment (a corrupted entry fails closed).
 *
 * `extraRelays` is unioned into the runtime relay set (community-first) — but
 * note that V2 plane traffic belongs ONLY on the community's own relays:
 * callers must NOT pass the deployment's app/platform relays here. A relay
 * that stores no Concord wraps answers every plane REQ instantly with an empty
 * EOSE, which can win the backfill's page race and starve the real relays
 * (issue #19).
 */
export function rehydrateCommunity(entry: CommunityListEntry, extraRelays: string[] = []): CommunityV2 | undefined {
  const jm = entry.current;
  try {
    if (!verifyCommunityId(jm.community_id, jm.owner, jm.owner_salt)) return undefined;
    const id = hex32(jm.community_id);
    const root = hex32(jm.community_root);
    const rootEpoch = BigInt(jm.root_epoch);

    const asRefounder = (v: unknown): string | undefined =>
      typeof v === "string" && /^[0-9a-f]{64}$/i.test(v) ? v.toLowerCase() : undefined;
    const asHex32 = asRefounder; // same shape: 64 lowercase-hex chars
    // The current head's refounder is the top-level `refounder` field; retained
    // roots carry their own, so historical snapshot authority survives the walk.
    const currentRefounder = asRefounder(jm.refounder);
    const controlPk = asHex32(jm.control_pk);
    const heldRoots: HeldRoot[] = [
      {
        epoch: rootEpoch,
        key: root,
        ...(currentRefounder ? { refounder: currentRefounder } : {}),
        ...(controlPk ? { controlPk } : {}),
      },
    ];
    for (const hr of jm.held_roots ?? []) {
      try {
        const epoch = BigInt(hr.epoch);
        if (epoch === rootEpoch) continue;
        const retiredAt =
          typeof hr.retired_at === "number" && Number.isFinite(hr.retired_at) && hr.retired_at > 0
            ? Math.floor(hr.retired_at)
            : undefined;
        const refounder = asRefounder(hr.refounder);
        const hrControlPk = asHex32(hr.control_pk);
        heldRoots.push({
          epoch,
          key: hex32(hr.key),
          ...(retiredAt !== undefined ? { retiredAt } : {}),
          ...(refounder ? { refounder } : {}),
          ...(hrControlPk ? { controlPk: hrControlPk } : {}),
        });
      } catch {
        // skip malformed retained roots
      }
    }
    // The staff write secret rides only when it still derives to the held
    // address for THIS epoch — a stale or corrupt secret fails closed to a
    // read-only view rather than signing at an address nobody reads
    // (CORD-02 §5; a legacy epoch has no address for it to derive to).
    let controlRoot: Uint8Array | undefined;
    if (controlPk && asHex32(jm.control_root)) {
      const candidate = hex32(jm.control_root as string);
      if (controlSignerGroupKey(candidate, id, rootEpoch).pk === controlPk) controlRoot = candidate;
    }
    // Also anchor the seed's root when it's an epoch we don't otherwise hold.
    if (entry.seed && entry.seed.community_root && entry.seed.root_epoch !== jm.root_epoch) {
      try {
        const seedEpoch = BigInt(entry.seed.root_epoch);
        if (!heldRoots.some((r) => r.epoch === seedEpoch)) {
          heldRoots.push({ epoch: seedEpoch, key: hex32(entry.seed.community_root) });
        }
      } catch {
        // skip malformed seed
      }
    }
    heldRoots.sort((a, b) => (a.epoch > b.epoch ? -1 : a.epoch < b.epoch ? 1 : 0));

    const privateChannels: PrivateChannelKey[] = [];
    for (const ch of heldChannelKeys(jm.channels)) {
      try {
        const priors: PrivateChannelKey["priors"] = [];
        for (const prior of Array.isArray(ch.priors) ? ch.priors : []) {
          try {
            const retiredAt =
              typeof prior.retired_at === "number" && Number.isFinite(prior.retired_at) && prior.retired_at > 0
                ? Math.floor(prior.retired_at)
                : undefined;
            priors.push({
              key: hex32(prior.key),
              epoch: BigInt(prior.epoch),
              ...(retiredAt !== undefined ? { retiredAt } : {}),
            });
          } catch {
            // skip a malformed prior; the current key still stands
          }
        }
        privateChannels.push({
          id: hex32(ch.id),
          key: hex32(ch.key),
          epoch: BigInt(ch.epoch),
          name: typeof ch.name === "string" ? ch.name : "",
          ...(priors.length > 0 ? { priors } : {}),
        });
      } catch {
        // skip malformed channel entries
      }
    }

    return {
      id,
      idHex: jm.community_id.toLowerCase(),
      owner: jm.owner.toLowerCase(),
      ownerSalt: hex32(jm.owner_salt),
      root,
      rootEpoch,
      ...(controlPk ? { controlPk } : {}),
      ...(controlRoot ? { controlRoot } : {}),
      heldRoots,
      privateChannels,
      relays: capRelays([...(Array.isArray(jm.relays) ? jm.relays : []), ...extraRelays]),
      name: typeof jm.name === "string" ? jm.name : "",
      refounder: typeof jm.refounder === "string" && /^[0-9a-f]{64}$/i.test(jm.refounder) ? jm.refounder.toLowerCase() : undefined,
    };
  } catch {
    return undefined;
  }
}

/**
 * Serialize held private-channel keys for a `refresh-channels` list write.
 *
 * `priors` ride along deliberately: CORD-03 §3 has a client query every epoch
 * pubkey it holds so history spanning a rekey stays continuous, and
 * `refreshChannels` REPLACES the stored array. Dropping them here would take
 * every other channel's pre-rotation history dark as a side effect of touching
 * one channel.
 */
export function channelKeysToWire(chs: PrivateChannelKey[]): JoinMaterial["channels"] {
  return chs.map((c) => ({
    id: bytesToHex(c.id),
    key: bytesToHex(c.key),
    epoch: Number(c.epoch),
    name: c.name,
    ...(c.priors?.length
      ? {
          priors: c.priors.map((p) => ({
            key: bytesToHex(p.key),
            epoch: Number(p.epoch),
            ...(p.retiredAt !== undefined ? { retired_at: p.retiredAt } : {}),
          })),
        }
      : {}),
  }));
}

/**
 * The channel epoch a privatisation must mint at (CORD-03 §2): one past the
 * highest generation the channel has EVER used, and 1 when it has never been
 * private. Monotonic and never resetting, so privatise -> publish -> privatise
 * leaves each generation at its own epoch — a stale key is always a LOWER one
 * and can never share a coordinate with the current key, which is what lets
 * the merge (epoch-max) and a `channel_cuts` floor (epoch-min) tell the
 * generations apart at all.
 *
 * `observedFloor` is the highest epoch a rotation was actually seen at
 * (`highestRotatedEpoch`, read off the CORD-06 §2 rekey addresses that derive
 * from the community root alone). It matters because the keys in hand are not
 * the channel's history: whoever privatises a public channel need never have
 * held an earlier generation — they joined after it was published, were never
 * granted its Role, or were rotated out and the `channel_cuts` floor dropped
 * the key from their list. Their empty keyring is not evidence that no
 * generation existed, so the higher of the two bounds wins.
 */
export function nextChannelEpoch(
  held: PrivateChannelKey[],
  channelIdHex: string,
  observedFloor = 0n,
): bigint {
  const wanted = channelIdHex.toLowerCase();
  let highest = observedFloor;
  const mine = held.find((c) => bytesToHex(c.id) === wanted);
  if (mine) {
    if (mine.epoch > highest) highest = mine.epoch;
    for (const p of mine.priors ?? []) if (p.epoch > highest) highest = p.epoch;
  }
  return highest + 1n;
}

/** Snapshot a runtime community back into join material (for `current`). */
export function toJoinMaterial(c: CommunityV2, opts?: { relays?: string[]; prior?: JoinMaterial }): JoinMaterial {
  const heldRoots = c.heldRoots
    .filter((r) => r.epoch !== c.rootEpoch)
    .map((r) => ({
      epoch: Number(r.epoch),
      key: bytesToHex(r.key),
      ...(r.retiredAt !== undefined ? { retired_at: r.retiredAt } : {}),
      ...(r.refounder ? { refounder: r.refounder } : {}),
      ...(r.controlPk ? { control_pk: r.controlPk } : {}),
    }));
  const jm: JoinMaterial = {
    // Round-trip unknown fields from the prior snapshot (CORD-02 §6/§8).
    ...(opts?.prior ?? {}),
    community_id: c.idHex,
    owner: c.owner,
    owner_salt: bytesToHex(c.ownerSalt),
    community_root: bytesToHex(c.root),
    root_epoch: Number(c.rootEpoch),
    channels: channelKeysToWire(c.privateChannels),
    relays: opts?.relays ?? (opts?.prior?.relays as string[] | undefined) ?? [],
    name: c.name,
    ...(heldRoots.length > 0 ? { held_roots: heldRoots } : {}),
    ...(c.refounder ? { refounder: c.refounder } : {}),
  };
  // Written or DELETED, never inherited from `prior`: a snapshot taken at a
  // new epoch must not carry the old epoch's address or secret forward.
  if (c.controlPk) jm.control_pk = c.controlPk;
  else delete jm.control_pk;
  if (c.controlPk && c.controlRoot) jm.control_root = bytesToHex(c.controlRoot);
  else delete jm.control_root;
  return jm;
}
