/**
 * Concord V2 Rekeys & Refoundings — CORD-06.
 *
 * Post-removal secrecy without ratchets: a rotation mints a fresh key at the
 * next epoch and delivers it as per-recipient "rekey blobs" (kind 3303, up to
 * 120 per event, chunked) at an address derived from the PRIOR secret — so
 * every current holder can find it, and a removed member finding no blob for
 * their locator across ALL chunks knows they're out.
 *
 * The wrapped plaintext is fixed-width PER FORM, the width declaring the form
 * (CORD-06 §1), NIP-44-encrypted under the Rotator↔recipient pairwise key
 * (one ECDH either side can compute, so a NIP-46 bunker opens its blob with a
 * single nip44_decrypt):
 *
 *   - a Channel rotation's blob is 72 bytes:
 *     `scope_id[32] ‖ epoch_be[8] ‖ new_key[32]`;
 *   - a base rotation's member blob is 104, appending the next epoch's
 *     `new_control_pk[32]` (CORD-02 §2);
 *   - a staff recipient's is 136, appending `new_control_root[32]`;
 *   - a 72-byte BASE blob is the legacy pre-split form — honored when reading
 *     old rotations, never minted anew (CORD-06 §3).
 *
 * Any other width is malformed and the blob is dropped. NOTE: signer nip44
 * interfaces carry STRINGS, so this implementation transports the raw bytes as
 * base64 inside the NIP-44 plaintext (the spec doesn't pin a byte-transport
 * for string-only signers — flagged as spec feedback).
 */

import { bytesToHex, channelRekeyGroupKey, controlSignerGroupKey, epochKeyCommitment, random32, recipientLocator } from "./derive";
import { KIND_REKEY, KIND_SEAL_ENCRYPTED } from "./kinds";
import { citationFromTags, citationToTag, isTagDecimal, type AuthorityCitation } from "./edition";
import { buildRumor, type OpenedEvent, type Rumor } from "./stream";
import { readFolded, writeFolded } from "./vendor/foldedCache";

/** Per-recipient blobs per rekey event (CORD-06 §1). */
export const REKEY_BLOBS_PER_EVENT = 120;

/**
 * How many channel epochs past the one I hold to watch for rotations.
 *
 * Watching only `held + 1` strands anyone who MISSES a rotation — offline
 * through it, behind an auth-gating relay, or holding a key a stale list
 * merge resurrected: the channel moves on without them and the address they
 * poll is never published again. They keep a key that decrypts nothing while
 * the channel still sits in their sidebar, and no later rotation can tell
 * them they were removed. A window lets the client catch up (or learn it is
 * out) across any gap up to this depth; the cost is one extra author per
 * epoch per held root on a filter that is already author-scoped.
 */
export const CHANNEL_REKEY_LOOKAHEAD = 8;

const ZERO32 = new Uint8Array(32);
const ZERO32_HEX = "0".repeat(64);

/** A rotation's scope: one Private Channel, or the community_root (a Refounding). */
export type RekeyScope = { kind: "channel"; channelId: Uint8Array } | { kind: "root" };

/** The 32-byte scope id: the channel id, or all-zeroes for the root (never collides). */
export function rekeyScopeId(scope: RekeyScope): Uint8Array {
  return scope.kind === "channel" ? scope.channelId : ZERO32;
}

// ── The wrapped plaintext (fixed-width per form, CORD-06 §1) ─────────────────

/** `scope_id[32] ‖ epoch_be[8] ‖ new_key[32]` — scope and epoch live INSIDE the ciphertext. */
export function encodeWrappedKey(scopeId: Uint8Array, newEpoch: bigint, newKey: Uint8Array): Uint8Array {
  const out = new Uint8Array(72);
  out.set(scopeId, 0);
  new DataView(out.buffer).setBigUint64(32, newEpoch, false);
  out.set(newKey, 40);
  return out;
}

/**
 * A BASE rotation's blob: the 72-byte layout plus the next epoch's
 * `new_control_pk[32]` (104 bytes, every member), a staff recipient's
 * additionally `new_control_root[32]` (136 bytes) — CORD-06 §1.
 */
export function encodeWrappedBaseKey(
  newEpoch: bigint,
  newRoot: Uint8Array,
  newControlPk: Uint8Array,
  newControlRoot?: Uint8Array,
): Uint8Array {
  const out = new Uint8Array(newControlRoot ? 136 : 104);
  out.set(encodeWrappedKey(ZERO32, newEpoch, newRoot), 0);
  out.set(newControlPk, 72);
  if (newControlRoot) out.set(newControlRoot, 104);
  return out;
}

/**
 * Parse + verify a decrypted 72-byte CHANNEL blob against the event's tags: a
 * recipient accepts the key only when the INNER scope and epoch match, which
 * is what makes a blob unspliceable across channels/epochs (CORD-06 §1).
 */
export function decodeWrappedKey(
  plain: Uint8Array,
  expectedScopeId: Uint8Array,
  expectedEpoch: bigint,
): Uint8Array {
  if (plain.length !== 72) throw new Error(`wrapped key must be 72 bytes, got ${plain.length}`);
  const scopeId = plain.slice(0, 32);
  const epoch = new DataView(plain.buffer, plain.byteOffset).getBigUint64(32, false);
  if (bytesToHex(scopeId) !== bytesToHex(expectedScopeId)) throw new Error("wrapped key scope mismatch");
  if (epoch !== expectedEpoch) throw new Error("wrapped key epoch mismatch");
  return plain.slice(40, 72);
}

/** A parsed base-rotation blob (CORD-06 §1); the width declared the form. */
export interface WrappedBaseKey {
  newRoot: Uint8Array;
  /**
   * The next epoch's Control Plane address (hex) — absent on a legacy 72-byte
   * blob, whose acceptor folds that epoch's Control at the legacy
   * member-derivable address instead (CORD-06 §3).
   */
  controlPk?: string;
  /** The staff write secret (136-byte form only), already verified to derive to `controlPk`. */
  controlRoot?: Uint8Array;
}

/**
 * Parse + verify a decrypted BASE blob (CORD-06 §1). Accepts the three fixed
 * widths — 72 (legacy pre-split), 104 (member), 136 (staff) — and drops any
 * other as malformed. The scope must be the all-zero base scope and the epoch
 * must match the event's tags (unspliceable), and a 136-byte blob's
 * `new_control_root` must derive to exactly its `new_control_pk`
 * (CORD-02 §5) — a mismatched pair is refused whole rather than adopting a
 * plane split from its readers.
 */
export function decodeWrappedBaseKey(
  plain: Uint8Array,
  communityId: Uint8Array,
  expectedEpoch: bigint,
): WrappedBaseKey {
  if (plain.length !== 72 && plain.length !== 104 && plain.length !== 136) {
    throw new Error(`wrapped base key must be 72, 104 or 136 bytes, got ${plain.length}`);
  }
  const scopeId = plain.slice(0, 32);
  const epoch = new DataView(plain.buffer, plain.byteOffset).getBigUint64(32, false);
  if (bytesToHex(scopeId) !== ZERO32_HEX) throw new Error("wrapped key scope mismatch");
  if (epoch !== expectedEpoch) throw new Error("wrapped key epoch mismatch");
  const newRoot = plain.slice(40, 72);
  if (plain.length === 72) return { newRoot };
  const controlPk = bytesToHex(plain.slice(72, 104));
  if (plain.length === 104) return { newRoot, controlPk };
  const controlRoot = plain.slice(104, 136);
  if (controlSignerGroupKey(controlRoot, communityId, expectedEpoch).pk !== controlPk) {
    throw new Error("wrapped control_root does not derive to its control_pk");
  }
  return { newRoot, controlPk, controlRoot };
}

/** base64 helpers for carrying the 72 bytes through string-only nip44 signers. */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
export function base64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── The 3303 rumor ───────────────────────────────────────────────────────────

/** One located, wrapped key. */
export interface RekeyBlob {
  /** Where its recipient finds it (hex of {@link recipientLocator}). */
  locator: string;
  /** NIP-44 ciphertext under the Rotator↔recipient pairwise key. */
  wrapped: string;
}

export interface RekeyRotation {
  scope: RekeyScope;
  newEpoch: bigint;
  prevEpoch: bigint;
  /** The epoch-key commitment over the key being replaced (continuity check). */
  prevCommit: string;
}

/** Build the chunked 3303 rumors for one rotation. */
export function buildRekeyRumors(
  rotatorPubkey: string,
  rotation: RekeyRotation,
  blobs: RekeyBlob[],
  ms: number,
  /**
   * The Grant the rotator acts under (CORD-04 §5 / CORD-06 §Authority). Rides
   * on EVERY chunk, like the continuity fields, so a receiver that only has
   * some chunks can still judge the authority. Absent when the owner rotates.
   */
  authority?: AuthorityCitation,
): Rumor[] {
  const chunks: RekeyBlob[][] = [];
  for (let i = 0; i < blobs.length; i += REKEY_BLOBS_PER_EVENT) {
    chunks.push(blobs.slice(i, i + REKEY_BLOBS_PER_EVENT));
  }
  if (chunks.length === 0) chunks.push([]);
  const n = chunks.length;
  const scopeHex = bytesToHex(rekeyScopeId(rotation.scope));
  return chunks.map((chunk, i) =>
    buildRumor({
      kind: KIND_REKEY,
      content: JSON.stringify(chunk),
      tags: [
        ["scope", scopeHex],
        ["newepoch", rotation.newEpoch.toString()],
        ["prevepoch", rotation.prevEpoch.toString()],
        ["prevcommit", rotation.prevCommit],
        ["chunk", (i + 1).toString(), n.toString()],
        ...(authority ? [citationToTag(authority)] : []),
      ],
      pubkey: rotatorPubkey,
      ms,
    }),
  );
}

export interface ParsedRekey {
  /** The rotator's real pubkey (the seal's signer). */
  rotator: string;
  scopeIdHex: string;
  newEpoch: bigint;
  prevEpoch: bigint;
  prevCommit: string;
  chunkIndex: number;
  chunkCount: number;
  blobs: RekeyBlob[];
  /** ms of the rumor (ordering / correlation aid). */
  ms: number;
  /** The CORD-04 §5 citation the rotator acts under (absent when the owner acts). */
  authority?: AuthorityCitation;
}

/** Parse an opened rekey stream event into its rotation fields. */
export function parseRekey(opened: OpenedEvent): ParsedRekey {
  if (opened.kind !== KIND_REKEY) throw new Error("not a rekey rumor");
  // Checked while the seal form is known (an event still holding its wrap); a
  // stored rumor has no envelope and passed this at ingest — see parseEdition.
  if (opened.sealKind !== undefined && opened.sealKind !== KIND_SEAL_ENCRYPTED) {
    throw new Error("rekey seals must be encrypted (CORD-02 §5)");
  }
  const get = (name: string) => opened.tags.find((t) => t[0] === name);
  const scope = get("scope")?.[1];
  const newEpoch = get("newepoch")?.[1];
  const prevEpoch = get("prevepoch")?.[1];
  const prevCommit = get("prevcommit")?.[1];
  const chunk = get("chunk");
  if (!scope || !/^[0-9a-f]{64}$/i.test(scope)) throw new Error("bad scope tag");
  if (!isTagDecimal(newEpoch)) throw new Error("bad newepoch tag");
  if (!isTagDecimal(prevEpoch)) throw new Error("bad prevepoch tag");
  if (!prevCommit || !/^[0-9a-f]{64}$/i.test(prevCommit)) throw new Error("bad prevcommit tag");
  // Spec-shaped decimals, not `Number()` — that would take "1e2", "0x2" and
  // " 2 " as chunk coordinates a stricter peer refuses.
  if (chunk && (!isTagDecimal(chunk[1]) || !isTagDecimal(chunk[2]))) throw new Error("bad chunk tag");
  const chunkIndex = chunk ? Number(chunk[1]) : 1;
  const chunkCount = chunk ? Number(chunk[2]) : 1;
  if (chunkIndex < 1 || chunkCount < 1 || chunkIndex > chunkCount) {
    throw new Error("bad chunk tag");
  }
  let blobs: RekeyBlob[];
  try {
    const parsed = JSON.parse(opened.content) as RekeyBlob[];
    blobs = Array.isArray(parsed)
      ? parsed.filter((b) => b && typeof b.locator === "string" && typeof b.wrapped === "string")
      : [];
  } catch {
    throw new Error("bad rekey content");
  }
  return {
    rotator: opened.author,
    scopeIdHex: scope.toLowerCase(),
    newEpoch: BigInt(newEpoch),
    prevEpoch: BigInt(prevEpoch),
    prevCommit: prevCommit.toLowerCase(),
    chunkIndex,
    chunkCount,
    blobs,
    ms: opened.ms,
    authority: citationFromTags(opened.tags),
  };
}

/**
 * Group parsed rekey chunks into complete rotations. Chunks correlate by
 * (rotator, scope, newepoch, prevcommit) so two Rotators concurrently rekeying
 * the same epoch never merge into one set (CORD-06 §2). A rotation is COMPLETE
 * only when all `n` chunks are held — a missing chunk is never a removal.
 */
export interface RekeyRotationSet {
  rotator: string;
  scopeIdHex: string;
  newEpoch: bigint;
  prevEpoch: bigint;
  prevCommit: string;
  chunkCount: number;
  /** chunkIndex → chunk. */
  chunks: Map<number, ParsedRekey>;
  complete: boolean;
  /**
   * The rotation's authority citation, taken from its first chunk. Every chunk
   * of one rotation carries identical authority fields (CORD-06 §2), so a
   * disagreeing chunk is the caller's cue to distrust the set — mirrored on the
   * continuity fields, which are already part of the correlation key.
   */
  authority?: AuthorityCitation;
}

export function groupRotations(parsed: ParsedRekey[]): RekeyRotationSet[] {
  const byKey = new Map<string, RekeyRotationSet>();
  for (const p of parsed) {
    const key = `${p.rotator}:${p.scopeIdHex}:${p.newEpoch}:${p.prevCommit}`;
    let set = byKey.get(key);
    if (!set) {
      byKey.set(
        key,
        (set = {
          rotator: p.rotator,
          scopeIdHex: p.scopeIdHex,
          newEpoch: p.newEpoch,
          prevEpoch: p.prevEpoch,
          prevCommit: p.prevCommit,
          chunkCount: p.chunkCount,
          chunks: new Map(),
          complete: false,
          authority: p.authority,
        }),
      );
    }
    if (p.chunkCount === set.chunkCount) set.chunks.set(p.chunkIndex, p);
  }
  for (const set of byKey.values()) {
    set.complete = set.chunks.size >= set.chunkCount;
  }
  return [...byKey.values()];
}

/**
 * Verify a rotation's CONTINUITY against the key we currently hold: the
 * commitment over (prevEpoch, heldKey) must equal the event's `prevcommit`.
 * A mismatch with a HIGHER prevepoch means we missed a rotation (fetch the gap
 * first); any other mismatch is a fork or garbage — reject (CORD-06 §2).
 */
export function checkContinuity(set: { prevEpoch: bigint; prevCommit: string }, heldEpoch: bigint, heldKey: Uint8Array):
  | { ok: true }
  | { ok: false; reason: "gap" | "fork" } {
  if (set.prevEpoch === heldEpoch) {
    const commit = bytesToHex(epochKeyCommitment(heldEpoch, heldKey));
    return commit === set.prevCommit ? { ok: true } : { ok: false, reason: "fork" };
  }
  return { ok: false, reason: set.prevEpoch > heldEpoch ? "gap" : "fork" };
}

/** Find my blob across a complete rotation's chunks by my locator. */
export function findBlob(set: RekeyRotationSet, locatorHex: string): RekeyBlob | undefined {
  for (const chunk of set.chunks.values()) {
    const hit = chunk.blobs.find((b) => b.locator === locatorHex);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * When did this rotation publish? The newest of its chunks' rumor ms.
 * Used to tell a removal apart from community history: a rotation that
 * entirely predates a member's join happened before they existed in the
 * community, so its lack of a blob for them is not an exclusion.
 */
export function rotationPublishedAtMs(set: RekeyRotationSet): number {
  let newest = 0;
  for (const chunk of set.chunks.values()) if (chunk.ms > newest) newest = chunk.ms;
  return newest;
}

/**
 * Does a complete rotation carrying no blob for me actually EXCLUDE me, or is
 * it community history that predates my membership? A member who joins via a
 * stale public invite (bundle epoch N) lands ON a historical `N→N+1`
 * Refounding they were never part of. It is continuity-valid and complete, yet
 * has no blob at their locator — but it was published before they joined, so it
 * must not be read as a removal (else the community's rail icon vanishes
 * seconds after every join, while chat stays fully usable — a liveness-only
 * bug). Only a rotation published at/after the join can exclude me (CORD-06).
 *
 * `joinedAtMs` is the member's own Community-List `added_at`; `rotatedAtMs` is
 * {@link rotationPublishedAtMs}. Clock skew only ever fails toward KEEPING the
 * icon (a slightly-early real exclusion), which is safe: key rotation, not the
 * rail, enforces post-removal secrecy.
 */
export function rotationExcludesMe(rotatedAtMs: number, joinedAtMs: number): boolean {
  return rotatedAtMs >= joinedAtMs;
}


/**
 * Race convergence (CORD-06 §3): among authorized candidates at the same
 * continuity point, the lexicographically lowest NEW KEY wins. Callers holding
 * multiple adopted candidates keep both keys but converge the chain on the
 * winner; the heal is DOWN-ONLY (a held epoch re-converges solely to a
 * strictly lower sibling).
 */
export function lowerKeyWins(a: Uint8Array, b: Uint8Array): Uint8Array {
  return bytesToHex(a) <= bytesToHex(b) ? a : b;
}

/** Mint the fresh key for a rotation. */
export function mintRotationKey(): Uint8Array {
  return random32();
}

/**
 * Mint the key for a rotation ONCE and hand the SAME one back to every retry.
 *
 * A rotation publishes in stages — compaction, then the root roll, then each
 * private channel — and any stage can lose its relays. Retrying is the
 * expected recovery. But {@link groupRotations} keys a rotation set by
 * `(rotator, scope, newEpoch, prevCommit)`, and a retry matches on all four,
 * so a second attempt carrying a FRESHLY minted key merges into the first
 * attempt's set chunk-for-chunk. Members then adopt whichever key happened to
 * ride the chunk carrying their locator: the community splits in half at the
 * same epoch, both halves continuity-valid, with nothing to signal it.
 *
 * Reserving the key under those same four inputs makes a retry byte-identical
 * to the attempt it resumes. A reservation that can't be persisted (private
 * mode, no IndexedDB) falls back to a fresh key — no worse than before, and
 * the caller is a human clicking retry, not a loop.
 *
 * DEVICE-LOCAL. Two devices signed in as the same rotator, both rotating the
 * same continuity point, still mint two keys into one correlated set. Closing
 * that needs a deterministic derivation from a rotator-only secret, which a
 * NIP-46 bunker will not hand over. What keeps it rare is that the rotation
 * path advances the local epoch the instant the roll lands, so the second
 * device's next rotation starts from a different tuple.
 */
export async function mintOrReuseRotationKey(
  communityIdHex: string,
  scope: RekeyScope,
  newEpoch: bigint,
  prevCommit: string,
): Promise<Uint8Array> {
  const key = `rekey-mint:${communityIdHex}:${bytesToHex(rekeyScopeId(scope))}:${newEpoch}:${prevCommit}`;
  const held = await readFolded<Uint8Array>(key);
  if (held instanceof Uint8Array && held.length === 32) return held;
  const minted = mintRotationKey();
  await writeFolded(key, minted);
  return minted;
}

/**
 * The fresh `control_root` minted BESIDE a base rotation's new root
 * (CORD-06 §3: every compliant base rotation mints the split), reserved under
 * the same four inputs as {@link mintOrReuseRotationKey} and for the same
 * reason: a retried rotation merges into the first attempt's set, so both
 * attempts must carry ONE pair or staff adopt whichever secret rode the chunk
 * with their locator.
 */
export async function mintOrReuseControlRoot(
  communityIdHex: string,
  newEpoch: bigint,
  prevCommit: string,
): Promise<Uint8Array> {
  const key = `rekey-mint:${communityIdHex}:${ZERO32_HEX}:${newEpoch}:${prevCommit}:control`;
  const held = await readFolded<Uint8Array>(key);
  if (held instanceof Uint8Array && held.length === 32) return held;
  const minted = mintRotationKey();
  await writeFolded(key, minted);
  return minted;
}

// ── The Grant's control_wrap plaintext (CORD-04 §3) ──────────────────────────

/**
 * `epoch_be[8] ‖ control_root[32]` — the staff write key as delivered inside a
 * staff-making Grant, NIP-44-encrypted under the granter↔member pairwise key
 * (the rekey-blob discipline: fixed width, the epoch INSIDE the ciphertext).
 */
export function encodeControlWrap(epoch: bigint, controlRoot: Uint8Array): Uint8Array {
  const out = new Uint8Array(40);
  new DataView(out.buffer).setBigUint64(0, epoch, false);
  out.set(controlRoot, 8);
  return out;
}

/** Parse a decrypted 40-byte control_wrap; the caller verifies the derivation. */
export function decodeControlWrap(plain: Uint8Array): { epoch: bigint; controlRoot: Uint8Array } {
  if (plain.length !== 40) throw new Error(`control_wrap must be 40 bytes, got ${plain.length}`);
  return {
    epoch: new DataView(plain.buffer, plain.byteOffset).getBigUint64(0, false),
    controlRoot: plain.slice(8, 40),
  };
}

/** Compute my locator for a rotation (public inputs only — bunker-friendly). */
export function myLocator(rotatorHex: string, myHex: string, scopeIdHex: string, newEpoch: bigint): string {
  const hexToBytes32 = (h: string) => {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
    return out;
  };
  return bytesToHex(
    recipientLocator(hexToBytes32(rotatorHex), hexToBytes32(myHex), hexToBytes32(scopeIdHex), newEpoch),
  );
}

export { ZERO32_HEX as ROOT_SCOPE_HEX };

/**
 * Every rekey address a channel could have published a rotation to, from
 * epoch 1 up to `maxEpoch`, under each of the roots this client holds.
 *
 * The point is that this needs no channel key. CORD-06 §2 derives a channel's
 * rekey address from the `community_root` and the `channel_id` alone, both of
 * which every member has, so a member who never held a single generation of a
 * channel can still see where its rotations went — and therefore how far its
 * epoch counter has climbed. That is what makes CORD-03 §2's "monotonic,
 * never resetting" checkable by whoever is about to privatise a public
 * channel, rather than a promise resting on which keys they happen to keep.
 *
 * Returns address pubkey → the epoch it stands for.
 */
export function channelRekeyAddressWindow(
  roots: ReadonlyArray<{ key: Uint8Array }>,
  channelId: Uint8Array,
  maxEpoch: number,
): Map<string, bigint> {
  const out = new Map<string, bigint>();
  for (const root of roots) {
    for (let e = 1; e <= maxEpoch; e++) {
      out.set(channelRekeyGroupKey(root.key, channelId, BigInt(e)).pk, BigInt(e));
    }
  }
  return out;
}

/**
 * The highest channel epoch any observed rotation address accounts for — the
 * floor a privatisation must climb past (0n when the channel has never been
 * private, so the first privatisation is epoch 1, CORD-03 §2).
 */
export function highestRotatedEpoch(
  window: ReadonlyMap<string, bigint>,
  seenAuthors: Iterable<string>,
): bigint {
  let highest = 0n;
  for (const pk of seenAuthors) {
    const epoch = window.get(pk);
    if (epoch !== undefined && epoch > highest) highest = epoch;
  }
  return highest;
}

/**
 * {@link highestRotatedEpoch}, but refusing an INCONCLUSIVE read.
 *
 * The probe covers epochs 1..`maxEpoch`, so a rotation found at `maxEpoch`
 * itself proves only that the channel reached the edge of what was looked at —
 * there may be more above it. Returning the ceiling anyway would mint the next
 * generation at an epoch the channel has already used, and CORD-03 §2's
 * counter is "monotonic, never resetting" precisely so that cannot happen: it
 * is what lets the list merge (epoch-max) and a `channel_cuts` floor
 * (epoch-min) tell two generations apart at all. A collision is silent at
 * mint time and unrecoverable afterwards, so a saturated probe throws.
 */
export function channelEpochFloor(
  window: ReadonlyMap<string, bigint>,
  seenAuthors: Iterable<string>,
  maxEpoch: number,
): bigint {
  const highest = highestRotatedEpoch(window, seenAuthors);
  if (highest >= BigInt(maxEpoch)) {
    throw new Error(
      `This channel has rotated at least ${maxEpoch} times; this client can't establish its next epoch safely.`,
    );
  }
  return highest;
}
