/**
 * Concord V2 Chat Plane — CORD-03.
 *
 * A Channel's messages, reactions, edits, and deletes are ordinary rumors
 * inside encrypted seals at the Channel's stream address (one per held epoch,
 * so history spanning a rekey stays continuous). Each rumor MUST commit
 * `["channel", id]` + `["epoch", n]`, checked strict-equal against the
 * coordinate whose key decrypted the wrap (CORD-03 §3).
 *
 * Decoding (two NIP-44 opens + a Schnorr verify per wrap) is memoized per wrap
 * id and chunked off the main thread, so re-reading the append-only local
 * store costs near-nothing after the first pass.
 */



import { KIND_CALENDAR_DATE, KIND_CALENDAR_RSVP, KIND_CALENDAR_TIME, KIND_COMMENT, KIND_DELETE, KIND_EDIT, KIND_MESSAGE, KIND_ONCHAIN_ZAP, KIND_POLL, KIND_POLL_VOTE, KIND_REACTION, KIND_SEAL_ENCRYPTED, KIND_TIMER_NOTICE, KIND_ZAP } from "./kinds";
import { dmTimerSeconds, isExpired } from "./vendor/nip17";
import { reactionContentKey } from "./vendor/reactions";
import type { RsvpVote } from "./vendor/calendar";
import type { PollVote } from "./vendor/polls";
import { verifyOnchainZapRumor, verifyZapRumor, type ZapEntry } from "./vendor/zaps";
import { citationFromTags, type AuthorityCitation } from "./edition";
import { checkChannelBinding, openWrap, type OpenedEvent, type Rumor } from "./stream";
import { MEMO_CAP, memoSet } from "./boundedMemo";
import type { ChannelV2 } from "./types";

/** An opened chat event with its verified channel/epoch coordinate. */
export interface OpenedChat extends OpenedEvent {
  channelIdHex: string;
  epoch: bigint;
}

// ── Decode-once cache ────────────────────────────────────────────────────────

/** `wrapId|channelIdHex` → opened (or null = remembered failure). Session-scoped.
 *  Keyed per channel so one channel's "not my key" can't poison another's decode. */
const decodeMemo = new Map<string, OpenedChat | null>();
/** Memo keys that failed as "no held stream key" — retryable after a rekey catch-up. */
const skippedNoKey = new Set<string>();
/** An evicted memo entry takes its skip marker with it, so the set stays bounded too. */
const forgetSkip = (memoKey: string) => skippedNoKey.delete(memoKey);

/** Entry counts of this module's memos (operational visibility). */
export function chatMemoSize(): number {
  return decodeMemo.size;
}

/** Forget remembered no-key failures (a caught-up rekey may now decode them). */
export function forgetChatSkips(): void {
  for (const id of skippedNoKey) decodeMemo.delete(id);
  skippedNoKey.clear();
}

function openOne(wrap: Rumor, channel: ChannelV2): OpenedChat | null {
  const memoKey = `${wrap.id}|${channel.idHex}`;
  const cached = decodeMemo.get(memoKey);
  if (cached !== undefined) return cached;

  const stream = channel.streams.find((s) => s.group.pk === wrap.pubkey);
  if (!stream) {
    memoSet(decodeMemo, memoKey, null, MEMO_CAP, forgetSkip);
    skippedNoKey.add(memoKey);
    return null;
  }
  let opened: OpenedChat | null = null;
  try {
    const ev = openWrap(wrap, stream.group);
    // Chat seals MUST be encrypted (CORD-02 §5) — a plaintext seal would make
    // the message a standalone signed artifact any relay could display.
    if (ev.sealKind !== KIND_SEAL_ENCRYPTED) throw new Error("chat seal must be encrypted");
    checkChannelBinding(ev, channel.idHex, stream.epoch);
    // A retired epoch is sealed history, not a live channel: the superseding
    // rotation's publish time is a hard cutoff, and anything sealed under the
    // old key but dated after it is refused. Key possession alone must not
    // keep an ejected member writing into epochs the community rotated away
    // from — the roster/banlist can't drop what it can't attribute in time.
    if (stream.retiredAt !== undefined && ev.createdAt > stream.retiredAt) {
      throw new Error("sealed under a retired epoch after its rotation");
    }
    opened = { ...ev, channelIdHex: channel.idHex, epoch: stream.epoch };
  } catch {
    opened = null;
  }
  memoSet(decodeMemo, memoKey, opened, MEMO_CAP, forgetSkip);
  return opened;
}

/**
 * Drop stored events that violate their epoch's retirement cutoff. The decode
 * path ({@link openOne}) refuses these at ingest, but rows written before the
 * rotation was adopted locally (or by a client that predates cutoffs) are
 * already in the store — the read side applies the same rule so a retired
 * epoch is history everywhere, not just for freshly-arriving wraps.
 */
export function filterEpochCutoff(events: OpenedChat[], channel: ChannelV2): OpenedChat[] {
  let cutoffs: Map<string, number> | undefined;
  for (const s of channel.streams) {
    if (s.retiredAt === undefined) continue;
    (cutoffs ??= new Map()).set(s.epoch.toString(), s.retiredAt);
  }
  if (!cutoffs) return events;
  const caps = cutoffs;
  return events.filter((ev) => {
    const cap = caps.get(ev.epoch.toString());
    return cap === undefined || ev.createdAt <= cap;
  });
}

/** Max unbroken main-thread time (ms) to spend decoding before yielding.
 *  Time-based (not a fixed wrap count) so a slow phone yields sooner than a
 *  fast desktop instead of both blocking for a fixed number of Schnorr verifies
 *  — long synchronous tasks are what trip WebKit/Gecko "page unresponsive"
 *  kills and jank. Keep well below 16ms so Android WebView's input pipeline
 *  (swipe-type composition events) has room to run between slices. */
const DECODE_SLICE_MS = 5;

/**
 * Open a batch of sealed wraps for one channel, memoized and time-sliced off
 * the main thread so a large first decode never freezes the UI. Each wrap costs
 * two synchronous NIP-44 decrypts + a Schnorr verify (nostr-tools `@noble`,
 * main-thread), so we yield whenever a slice has run longer than
 * {@link DECODE_SLICE_MS}. Skips (foreign epochs, malformed, spliced) are
 * silent, as in Vector's read path.
 */
export async function openChatBatch(
  wraps: Rumor[],
  channel: ChannelV2,
  opts?: { signal?: AbortSignal },
): Promise<OpenedChat[]> {
  const out: OpenedChat[] = [];
  let sliceStart = performance.now();
  // Crypto time only — the yields between slices are deliberately NOT counted,
  // so this reads as "main thread spent decrypting" rather than wall clock. Both
  // numbers matter and they are very different: `setTimeout(0)` is clamped to
  // ~4ms once nesting passes 5, so a thousand wraps at a 5ms slice adds seconds
  // of wall clock the CPU total will not show. Compare against the wall-clock
  // mark the caller records.
  let cryptoMs = 0;
  for (let i = 0; i < wraps.length; i++) {
    if (opts?.signal?.aborted) break;
    const openStart = performance.now();
    const opened = openOne(wraps[i], channel);
    cryptoMs += performance.now() - openStart;
    if (opened) out.push(opened);
    // Yield once this slice has run long enough (and more work remains), so the
    // main thread stays responsive during a large backfill decode.
    if (i + 1 < wraps.length && performance.now() - sliceStart >= DECODE_SLICE_MS) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      sliceStart = performance.now();
    }
  }
  return out;
}

// ── Tag helpers ──────────────────────────────────────────────────────────────

/**
 * Build the NIP-22 tags for a kind-1111 threaded reply to `parent`. The
 * uppercase `K`/`E`/`P` tags pin the immutable *thread root*; the lowercase
 * `k`/`e`/`p` tags point at the *immediate parent*. When the parent is itself a
 * comment, its uppercase root tags are inherited so the root is stable at any
 * nesting depth (matching the NIP-29 side, `buildCommentTags`). All ids are
 * RUMOR ids (the NIP-01 hash of the inner unsigned event), so a reply cites
 * exactly the decrypted message the user replied to.
 *
 * This is deliberately distinct from a kind-9 `q` tag: NIP-C7 reserves `q` for
 * inline quote-replies, while threads are NIP-22 comments.
 *
 * https://github.com/nostr-protocol/nips/blob/master/22.md
 */
export function buildV2CommentTags(parent: { id: string; kind: number; pubkey: string; tags: string[][] }): string[][] {
  const tags: string[][] = [];

  const rootTags = parent.tags.filter(([n]) => n === "K" || n === "E" || n === "P");
  if (rootTags.length > 0) {
    // Parent is itself a comment: inherit its root pointer verbatim.
    for (const t of rootTags) tags.push([...t]);
  } else {
    // Parent is the root of this thread.
    tags.push(["K", String(parent.kind)]);
    tags.push(["E", parent.id, "", parent.pubkey]);
    tags.push(["P", parent.pubkey]);
  }

  // Immediate-parent pointer (always the event being replied to).
  tags.push(["k", String(parent.kind)]);
  tags.push(["e", parent.id, "", parent.pubkey]);
  tags.push(["p", parent.pubkey]);

  return tags;
}

/**
 * The thread-root rumor id a message belongs to, or undefined for a top-level
 * message. Threaded replies are NIP-22 kind-1111 comments carrying the root in
 * their uppercase `E` tag. A kind-9 `q` tag is an INLINE reply (timeline, not a
 * thread), so it is deliberately NOT treated as a thread root.
 */
export function replyTargetOf(ev: { kind: number; tags: string[][] }): string | undefined {
  return ev.kind === KIND_COMMENT ? ev.tags.find((t) => t[0] === "E")?.[1] : undefined;
}

/** Reactions / edits / deletes name their target rumor with an `e` tag. */
export function eTargetOf(ev: { tags: string[][] }): string | undefined {
  return ev.tags.find((t) => t[0] === "e")?.[1];
}

// ── Timeline fold ────────────────────────────────────────────────────────────

/** Moderation context the read path applies while folding. */
export interface ChatModeration {
  /**
   * Banned author pubkeys — every event from them is dropped (CORD-04 §4).
   *
   * This is the ONLY author-identity drop an honest client performs. Nothing
   * here filters on epoch: a retired epoch's key is held by everyone who ever
   * had it, but CORD-02 §5 makes an author seen publishing *observably
   * present* and a self-signed Join unsuppressable, and CORD-04 §6 makes the
   * Banlist (plus its Refounding) the removal that enforces. An allow-list
   * gate over retired-epoch history would invert both — and would hide real
   * history from exactly the clients whose local anchors are thinnest.
   */
  banned: Set<string>;
  /**
   * Whether `deleter` may delete a message by `author` (MANAGE_MESSAGES).
   *
   * `citation` is the delete rumor's `vac` (CORD-04 §5) — the Grant the deleter
   * claims their rank under. A non-owner moderation delete without a resolvable
   * one PARKS: the permission check alone would honor an actor whose demotion
   * this client has not synced yet. A self-delete is not an authority action and
   * never carries one.
   */
  canDelete: (deleter: string, author: string, action?: { citation?: AuthorityCitation; ms: number }) => boolean;
  /**
   * Whether `author` may be believed about a disappearing-messages timer
   * change (CORD-08 §4): holds MANAGE_METADATA in the fold. A kind-1740 notice
   * is informational — the metadata fold is the authority — but display is
   * gated like an authority claim, or anyone could spell the tag. Optional so
   * bare lib folds (tests) keep notices; the app path always supplies it.
   */
  canSetTimer?: (author: string) => boolean;
}

/** A tallied reaction: reactors (pubkey→rumorId) plus the NIP-30 custom-emoji URL (if any). */
export interface ReactionEntry {
  reactors: Map<string, string>;
  url?: string;
}

export interface FoldedTimeline {
  /** Surviving messages, sorted by ms ascending. */
  messages: OpenedChat[];
  /** target rumor id → emoji → tally. */
  reactions: Map<string, Map<string, ReactionEntry>>;
  /** target rumor id → VERIFIED zaps (CORD.md §4; unverified never enter). */
  zaps: Map<string, ZapEntry[]>;
  /** poll rumor id → its raw votes (tallied per poll by the transport). */
  pollVotes: Map<string, PollVote[]>;
  /** Surviving calendar events (kinds 31922/31923); NOT timeline messages. */
  calendarEvents: OpenedChat[];
  /** event rumor id → its raw RSVPs (tallied per event by the transport). */
  rsvps: Map<string, RsvpVote[]>;
  /**
   * Authorized disappearing-messages timer notices (kind 1740, CORD-08 §4),
   * sorted by ms ascending. Not messages — the transport interleaves them as
   * centered notice rows, like the DM timer entries.
   */
  timerNotices: OpenedChat[];
}

/**
 * Per-rumor CORD.md verdict cache (payment hash when valid, null when not).
 * A rumor's tags never change, so each zap is hashed/decoded once per session
 * no matter how many folds re-run over it. Capped to bound memory.
 */
const zapVerdicts = new Map<string, string | null>();
const ZAP_VERDICT_CAP = 8192;

/**
 * Session-scoped set of reaction rumor ids that have been deleted by a kind-5.
 * The rumor store's NIP-09 only processes deletes within the same write
 * batch — a reaction re-delivered by a relay echo (in a later batch) gets
 * re-added to the store. This set lets the fold skip such re-delivered
 * reactions across fold invocations, so a removed reaction stays removed
 * even when the store forgets the deletion. Capped to bound memory.
 */
const deletedReactionIds = new Set<string>();
const DELETED_REACTION_CAP = 8192;

/**
 * Mark a reaction rumor id as deleted NOW, before the kind-5 delete rumor is
 * sealed and inserted into the cache. The fold skips any reaction whose id is
 * in this set, so the removal is immediate (no waiting for the async send to
 * complete and the fold to re-run with the delete event).
 */
export function markReactionDeleted(rumorId: string): void {
  if (deletedReactionIds.size >= DELETED_REACTION_CAP) {
    deletedReactionIds.delete(deletedReactionIds.values().next().value as string);
  }
  deletedReactionIds.add(rumorId);
}

/**
 * Fold a batch of opened chat events into the channel timeline: drop banned
 * authors, apply edits (author-only, latest by ms), and tally reactions per
 * target.
 *
 * Deletes are DELETES, not hides: a kind-5 rumor physically removes its target
 * from the rumor cache on write (self-delete via the store's NIP-09; a
 * moderator delete is authorized against the roster at the write site before it
 * reaches the store). So a folded set read back from the cache never contains a
 * deleted message. The delete pass here is only a belt-and-suspenders for
 * IN-BATCH deletes — an optimistic or just-arrived kind-5 folded alongside its
 * target before the store's async removal has committed — and applies the same
 * authorization (self, or a `canDelete` moderator) so the two paths agree.
 */
export function foldTimeline(opened: OpenedChat[], moderation?: ChatModeration): FoldedTimeline {
  const byId = new Map<string, OpenedChat>();
  // target rumor id → (deleter → their citation + the delete's own ms). Both
  // have to survive the fold: collapsing to a bare author set is what made the
  // authority check permission-only, and the ms is what lets the check tell a
  // pre-flag-day delete (honored uncited) from a fresh one, and a delete that
  // predates a tombstone from one published after it.
  const deletes = new Map<string, Map<string, { citation?: AuthorityCitation; ms: number }>>();
  // ALL edits per target (author validity is judged against the message in the
  // apply phase — otherwise a non-author's later "edit" would suppress the
  // author's legitimate one).
  const edits = new Map<string, Array<{ author: string; content: string; ms: number }>>();
  const reactions = new Map<string, Map<string, ReactionEntry>>();
  // Raw votes bucketed by their poll's rumor id. Left untallied here (the
  // transport folds them against each poll's declared options + endsAt), and
  // kept even when the poll itself isn't in this window — an orphan vote resolves
  // automatically once its poll decodes and the next fold re-runs.
  const pollVotes = new Map<string, PollVote[]>();
  // Calendar events (kinds 31922/31923), addressably folded downstream, and
  // their RSVPs bucketed by the event rumor id they `e`-reference.
  const calendarById = new Map<string, OpenedChat>();
  const rsvps = new Map<string, RsvpVote[]>();
  // Verified zap candidates, deduped by payment hash (Lightning) or txid
  // (on-chain) after the loop: an announced proof or txid is visible to every
  // member, so without this anyone could replay someone else's and inflate
  // tallies (CORD.md §4).
  const zapCandidates: Array<{ target: string; hash: string; ms: number; entry: ZapEntry }> = [];
  const timerNotices: OpenedChat[] = [];
  // One clock per fold: a rumor expiring mid-loop must not split the batch.
  const nowSecs = Math.floor(Date.now() / 1000);

  for (const ev of opened) {
    if (moderation?.banned.has(ev.author)) continue;
    // Expired rumors are refused at ingest and swept from the store
    // (CORD-08 §3), but rows stored before their deadline passed — and
    // freshly-decrypted events folded in ahead of the store round-trip —
    // reach here, so the read side applies the same rule.
    if (isExpired(ev.tags, nowSecs)) continue;

    if (ev.kind === KIND_TIMER_NOTICE) {
      // A notice with no readable timer value is malformed, not "off"; an
      // author the roster doesn't trust with MANAGE_METADATA is dropped
      // (CORD-08 §4) — anyone can spell the tag, only staff are believed.
      if (dmTimerSeconds(ev) === undefined) continue;
      if (moderation?.canSetTimer && !moderation.canSetTimer(ev.author)) continue;
      timerNotices.push(ev);
      continue;
    }
    if (ev.kind === KIND_DELETE) {
      // NIP-09 shape: possibly several `e` targets.
      for (const t of ev.tags) {
        if (t[0] !== "e" || !t[1]) continue;
        const target = t[1];
        let authors = deletes.get(target);
        if (!authors) deletes.set(target, (authors = new Map()));
        // Prefer a cited delete when the same actor published both — an uncited
        // duplicate must never mask the one that carries authority.
        const cite = citationFromTags(ev.tags);
        if (cite || !authors.has(ev.author)) authors.set(ev.author, { citation: cite, ms: ev.ms });
        // Track deleted reaction rumor ids across fold invocations so a
        // relay-echoed reaction (re-added to the store in a later write
        // batch) stays removed. The `k` tag identifies the target kind.
        const kTag = ev.tags.find(([n]) => n === "k")?.[1];
        if (kTag === String(KIND_REACTION)) {
          if (deletedReactionIds.size >= DELETED_REACTION_CAP) {
            deletedReactionIds.delete(deletedReactionIds.values().next().value as string);
          }
          deletedReactionIds.add(target);
        }
      }
      continue;
    }
    if (ev.kind === KIND_EDIT) {
      const target = eTargetOf(ev);
      if (!target) continue;
      let list = edits.get(target);
      if (!list) edits.set(target, (list = []));
      list.push({ author: ev.author, content: ev.content, ms: ev.ms });
      continue;
    }
    if (ev.kind === KIND_REACTION) {
      const target = eTargetOf(ev);
      if (!target || !ev.content) continue;
      // Skip reactions whose kind-5 delete we've seen in a previous fold
      // invocation (the store may have re-added them via a relay echo).
      if (deletedReactionIds.has(ev.rumorId)) continue;
      const key = reactionContentKey(ev.content);
      const url = ev.tags.find((t) => t[0] === "emoji")?.[2];
      let byEmoji = reactions.get(target);
      if (!byEmoji) reactions.set(target, (byEmoji = new Map()));
      let entry = byEmoji.get(key);
      if (!entry) byEmoji.set(key, (entry = { reactors: new Map() }));
      entry.reactors.set(ev.author, ev.rumorId);
      if (url && !entry.url) entry.url = url;
      continue;
    }
    if (ev.kind === KIND_ZAP) {
      const target = eTargetOf(ev);
      if (!target) continue;
      let verdict = zapVerdicts.get(ev.rumorId);
      if (verdict === undefined) {
        if (zapVerdicts.size >= ZAP_VERDICT_CAP) {
          zapVerdicts.delete(zapVerdicts.keys().next().value as string);
        }
        verdict = verifyZapRumor({ kind: ev.kind, tags: ev.tags });
        zapVerdicts.set(ev.rumorId, verdict);
      }
      if (!verdict) continue;
      const msats = Number(ev.tags.find((t) => t[0] === "amount")?.[1]);
      zapCandidates.push({
        target,
        hash: verdict,
        ms: ev.ms,
        entry: {
          id: ev.rumorId,
          pubkey: ev.author,
          sats: Math.floor(msats / 1000),
          comment: ev.content,
          rail: "lightning",
        },
      });
      continue;
    }
    if (ev.kind === KIND_ONCHAIN_ZAP) {
      const target = eTargetOf(ev);
      if (!target) continue;
      // On-chain zaps have no preimage — the txid on a public ledger is the
      // proof. Dedup by txid so one tx counts once per channel.
      const txid = verifyOnchainZapRumor({ kind: ev.kind, tags: ev.tags });
      if (!txid) continue;
      const sats = Number(ev.tags.find((t) => t[0] === "amount")?.[1]);
      zapCandidates.push({
        target,
        hash: txid,
        ms: ev.ms,
        entry: {
          id: ev.rumorId,
          pubkey: ev.author,
          sats,
          comment: ev.content,
          rail: "onchain",
        },
      });
      continue;
    }
    if (ev.kind === KIND_POLL_VOTE) {
      // A vote is an `e`-referencing side event (like a reaction): bucket it
      // under its poll, latest-per-pubkey resolved by the tally downstream.
      const target = eTargetOf(ev);
      if (!target) continue;
      const optionIds = ev.tags.filter(([n, v]) => n === "response" && v).map(([, v]) => v);
      if (optionIds.length === 0) continue;
      let list = pollVotes.get(target);
      if (!list) pollVotes.set(target, (list = []));
      list.push({ pubkey: ev.author, optionIds, ms: ev.ms });
      continue;
    }
    if (ev.kind === KIND_CALENDAR_RSVP) {
      // An RSVP `e`-references its event's rumor id (v2 has no `a`-coordinate);
      // bucket it like a poll vote, latest-per-pubkey resolved by the tally.
      const target = eTargetOf(ev);
      if (!target) continue;
      const status = ev.tags.find((t) => t[0] === "status")?.[1];
      if (status !== "accepted" && status !== "declined" && status !== "tentative") continue;
      let list = rsvps.get(target);
      if (!list) rsvps.set(target, (list = []));
      list.push({ pubkey: ev.author, status, ms: ev.ms });
      continue;
    }
    if (ev.kind === KIND_CALENDAR_DATE || ev.kind === KIND_CALENDAR_TIME) {
      // A calendar event is NOT a timeline message — it surfaces in the events
      // bar. Deletes/moderation are applied below, then parsing + addressable
      // dedup happen in the transport (shared with the NIP-29 path).
      calendarById.set(ev.rumorId, ev);
      continue;
    }
    if (ev.kind === KIND_MESSAGE || ev.kind === KIND_COMMENT || ev.kind === KIND_POLL) {
      // kind-9 top-level messages, kind-1111 threaded replies, and kind-1068
      // polls all land in the timeline pool; the reader splits them by their
      // NIP-22 root pointer (a poll has none, so it's always top-level).
      byId.set(ev.rumorId, ev);
    }
  }

  // Edits: only the original author may edit; their latest (by ms) wins.
  for (const [id, list] of edits) {
    const msg = byId.get(id);
    if (!msg) continue;
    let best: { content: string; ms: number } | undefined;
    for (const e of list) {
      if (e.author !== msg.author) continue;
      if (!best || e.ms > best.ms) best = e;
    }
    if (best) {
      const tags = msg.tags.filter(([name]) => name !== "edited");
      tags.push(["edited", String(Math.floor(best.ms / 1000))]);
      byId.set(id, { ...msg, content: best.content, tags });
    }
  }

  // In-batch deletes: self-delete, or an authorized moderator delete.
  for (const [id, msg] of byId) {
    const deleters = deletes.get(id);
    if (!deleters) continue;
    const deleted =
      deleters.has(msg.author) ||
      (moderation && [...deleters].some(([d, act]) => moderation.canDelete(d, msg.author, act)));
    if (deleted) byId.delete(id);
  }

  // Calendar deletes: same authorization as messages (self, or a moderator with
  // MANAGE_MESSAGES). The store's NIP-09 covers the durable case; this handles a
  // delete folded alongside its target before the async removal commits.
  for (const [id, ev] of calendarById) {
    const deleters = deletes.get(id);
    if (!deleters) continue;
    const deleted =
      deleters.has(ev.author) ||
      (moderation && [...deleters].some(([d, act]) => moderation.canDelete(d, ev.author, act)));
    if (deleted) calendarById.delete(id);
  }

  // In-batch reaction deletes: a kind-5 targeting a reaction rumor removes
  // that reactor from the tally (the store's NIP-09 handles the persistent
  // case; this covers a delete folded alongside its target before the store
  // async-removes it).
  for (const [targetId, byEmoji] of reactions) {
    for (const [emoji, entry] of byEmoji) {
      for (const [pubkey, rumorId] of entry.reactors) {
        const deleters = deletes.get(rumorId);
        if (deleters && deleters.has(pubkey)) {
          entry.reactors.delete(pubkey);
        }
      }
      if (entry.reactors.size === 0) byEmoji.delete(emoji);
    }
    if (byEmoji.size === 0) reactions.delete(targetId);
  }

  // Zaps: one payment counts once, earliest rumor (ms, then id) winning
  // deterministically so every member folds the same tally.
  const zaps = new Map<string, ZapEntry[]>();
  const claimedHashes = new Set<string>();
  zapCandidates.sort((a, b) => (a.ms !== b.ms ? a.ms - b.ms : a.entry.id < b.entry.id ? -1 : 1));
  for (const { target, hash, entry } of zapCandidates) {
    if (claimedHashes.has(hash)) continue;
    claimedHashes.add(hash);
    let list = zaps.get(target);
    if (!list) zaps.set(target, (list = []));
    list.push(entry);
  }

  return {
    messages: [...byId.values()].sort((a, b) => (a.ms !== b.ms ? a.ms - b.ms : a.rumorId < b.rumorId ? -1 : 1)),
    reactions,
    zaps,
    pollVotes,
    calendarEvents: [...calendarById.values()],
    rsvps,
    timerNotices: timerNotices.sort((a, b) => (a.ms !== b.ms ? a.ms - b.ms : a.rumorId < b.rumorId ? -1 : 1)),
  };
}
