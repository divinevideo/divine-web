/**
 * Concord V2 Control Plane editions — CORD-04 §1.
 *
 * An edition is a kind-3308 RUMOR (unsigned; authorship is the seal's Schnorr
 * signature, which for the Control Plane is a plaintext seal so it survives a
 * compaction re-wrap). Its machinery rides tags:
 *
 *   ["vsk", n]                — entity type (the registry, CORD-02 Appendix B)
 *   ["eid", hex32]            — the entity's stable coordinate
 *   ["ev",  n]                — this edition's version, climbing from 1
 *   ["ep",  hex32]            — prev edition hash (absent on the first)
 *   ["vac", eid, ver, hash]   — the authority citation (absent when the owner acts)
 *
 * There is deliberately NO version tag: absence of a version field always
 * means this spec (CORD-02 Appendix B).
 */

import { hexToBytes } from "@noble/hashes/utils.js";

import { bytesToHex } from "./derive";
import { KIND_CONTROL, KIND_SEAL_PLAINTEXT } from "./kinds";
import { buildRumor, type OpenedEvent, type Rumor } from "./stream";
import { editionHash, type Edition } from "./version";

const TAG_SUBKIND = "vsk";
const TAG_ENTITY = "eid";
const TAG_EVERSION = "ev";
const TAG_EPREV = "ep";
const TAG_CITATION = "vac";

const HEX64 = /^[0-9a-f]{64}$/i;

/**
 * CORD-01 §5: a tag number rides as "its decimal form with no leading zeros".
 * So `"4"` and `"0"` are the shape; `"04"`, `"+4"`, `"0x4"`, `"1e2"` and `" 4 "`
 * are not. `BigInt()`/`Number()` accept several of those, and a peer that
 * doesn't would drop the event we honored — a divergence neither side can see,
 * because a declined parse is never logged.
 */
const DECIMAL = /^(0|[1-9][0-9]*)$/;

/** True if `s` is a spec-shaped tag number (see {@link DECIMAL}). */
export function isTagDecimal(s: string | undefined): s is string {
  return s !== undefined && DECIMAL.test(s);
}

/** The pinned authority an actor claims for an action (CORD-04 §5). */
export interface AuthorityCitation {
  entityId: Uint8Array;
  version: bigint;
  editionHash: Uint8Array;
}

export function citationToTag(c: AuthorityCitation): string[] {
  return [TAG_CITATION, bytesToHex(c.entityId), c.version.toString(), bytesToHex(c.editionHash)];
}

export function citationFromTags(tags: string[][]): AuthorityCitation | undefined {
  const t = tags.find((t) => t.length >= 4 && t[0] === TAG_CITATION);
  if (!t) return undefined;
  if (!HEX64.test(t[1]) || !HEX64.test(t[3]) || !isTagDecimal(t[2])) return undefined;
  return { entityId: hexToBytes(t[1]), version: BigInt(t[2]), editionHash: hexToBytes(t[3]) };
}

/** Build an unsigned edition rumor (kind 3308). The plaintext SEAL proves the actor. */
export function buildEditionRumor(opts: {
  vsk: string;
  entityId: Uint8Array;
  version: bigint;
  prevHash?: Uint8Array;
  content: string;
  actorPubkey: string;
  createdAtSecs?: number;
  authority?: AuthorityCitation;
}): Rumor {
  const tags: string[][] = [
    [TAG_SUBKIND, opts.vsk],
    [TAG_ENTITY, bytesToHex(opts.entityId)],
    [TAG_EVERSION, opts.version.toString()],
  ];
  if (opts.prevHash) tags.push([TAG_EPREV, bytesToHex(opts.prevHash)]);
  if (opts.authority) tags.push(citationToTag(opts.authority));
  return buildRumor({
    kind: KIND_CONTROL,
    content: opts.content,
    tags,
    pubkey: opts.actorPubkey,
    ms: null,
    createdAtSecs: opts.createdAtSecs,
  });
}

export interface ParsedEdition {
  /** The real npub (hex) that signed the seal around this edition. */
  author: string;
  vsk: string;
  entityId: Uint8Array;
  version: bigint;
  prevHash?: Uint8Array;
  content: string;
  /** `editionHash` of this edition — what the next edition's `ep` cites. */
  selfHash: Uint8Array;
  createdAt: number;
  /** The rumor id (bytes) — the equal-version fold tiebreak. */
  rumorId: Uint8Array;
  authority?: AuthorityCitation;
  /** The opened stream event this edition arrived in (carries the re-wrappable seal). */
  opened: OpenedEvent;
}

export class EditionError extends Error {
  constructor(public code: "missing-field" | "bad-field", message: string) {
    super(message);
    this.name = "EditionError";
  }
}

function decodeHash(hex: string | undefined, field: string): Uint8Array {
  if (!hex || !HEX64.test(hex)) throw new EditionError("bad-field", field);
  return hexToBytes(hex.toLowerCase());
}

/**
 * Parse an OPENED control stream event into an edition. The stream layer
 * already proved authorship (seal signature) and rumor integrity (id hash);
 * this extracts the edition machinery and computes selfHash. Rejects duplicate
 * machinery tags (which would make the canonical bytes ambiguous). Does NOT
 * check roster authorization — that's the fold's separate step.
 */
export function parseEdition(opened: OpenedEvent): ParsedEdition {
  if (opened.kind !== KIND_CONTROL) throw new EditionError("bad-field", "kind");
  // Control seals MUST be plaintext (CORD-02 §5) — an encrypted-seal edition
  // could never survive a compaction re-wrap, so honoring it would mint state
  // that silently vanishes for every fresh joiner at the next Refounding.
  //
  // Checked whenever the seal form is KNOWN, which is any event still holding
  // its wrap — including the freshly-swept ones that reach a fold in memory
  // without being read back from the store. A STORED rumor has no envelope at
  // all, and needs none: `writeOpened` applied this same rule before it could
  // be stored.
  if (opened.sealKind !== undefined && opened.sealKind !== KIND_SEAL_PLAINTEXT) {
    throw new EditionError("bad-field", "seal-kind");
  }

  for (const name of [TAG_SUBKIND, TAG_ENTITY, TAG_EVERSION, TAG_EPREV, TAG_CITATION]) {
    if (opened.tags.filter((t) => t[0] === name).length > 1) {
      throw new EditionError("bad-field", `duplicate tag: ${name}`);
    }
  }
  const get = (name: string): string | undefined => opened.tags.find((t) => t[0] === name)?.[1];

  const vsk = get(TAG_SUBKIND);
  if (vsk === undefined) throw new EditionError("missing-field", "vsk");
  const entityId = decodeHash(get(TAG_ENTITY), "eid");
  const evStr = get(TAG_EVERSION);
  if (evStr === undefined) throw new EditionError("missing-field", "ev");
  if (!isTagDecimal(evStr)) throw new EditionError("bad-field", "ev");
  const version = BigInt(evStr);
  const epStr = get(TAG_EPREV);
  const prevHash = epStr !== undefined ? decodeHash(epStr, "ep") : undefined;

  const selfHash = editionHash(entityId, version, prevHash, new TextEncoder().encode(opened.content));

  return {
    author: opened.author,
    vsk,
    entityId,
    version,
    prevHash,
    content: opened.content,
    selfHash,
    createdAt: opened.createdAt,
    rumorId: hexToBytes(opened.rumorId),
    authority: citationFromTags(opened.tags),
    opened,
  };
}

/** The `version.Edition` view used by `version.fold`. */
export function toFoldEdition(p: ParsedEdition): Edition {
  return {
    version: p.version,
    prevHash: p.prevHash,
    selfHash: p.selfHash,
    createdAt: p.createdAt,
    tiebreakId: p.rumorId,
  };
}
